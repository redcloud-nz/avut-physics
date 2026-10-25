/**
 * A picture's curves: each pin's direction, each segment's cubic, and its length, bends and box. Pins holding an
 * angle keep it; each run of pins between them gets its directions from Hobby's method, with curl 1 at a free end
 * of the strand. A locked segment's tensions are scaled together, keeping their ratio, until it has its length.
 *
 * Working out a picture again after a change, pass the geometry from before it: every segment whose pins (by
 * identity), directions (by value) and own values are unchanged keeps its old results.
 */

import { Cubic, type Box } from "@/lib/bezier";
import { hobbyControls, hobbyDirections, MAX_TENSION, MIN_TENSION, type RunEnd } from "@/lib/hobby";
import { rad } from "@/lib/math";
import { bisect } from "@/lib/numeric";
import { Vector2 } from "@/lib/vector2";

import type { Picture, Pin, Strand, StrandSegment } from "./format";

/** Bends tighter than this radius (diameters) are shaded on ropes as a warning. */
export const TIGHTEST_BEND = 1.75;

/** How well a locked segment meets its length, against its reach: the shortest and longest it can be. */
export type LockStatus = { reach: [number, number] } & (
    | { kind: "ok" }
    | { kind: "too-short"; by: number }
    | { kind: "too-long"; by: number }
);

export type SegmentGeometry = {
    /** What it was worked out from, to tell when it can be kept. */
    from: Pin;
    to: Pin;
    leaving: Vector2;
    arriving: Vector2;
    segment: StrandSegment;
    strandKind: Strand["kind"];

    cubic: Cubic;
    /** The tensions it's drawn with: its own, or for a locked segment, scaled to meet its length. */
    tension: [number, number];
    length: number;
    /** For a locked segment, whether it meets its length. */
    lock?: LockStatus;
    /** Its tightest bend: the least radius (diameters) and where it is. */
    tightest: { radius: number; t: number };
    /** On a rope, the stretches (ranges of t) bending tighter than `TIGHTEST_BEND`. None on an arrow. */
    bends: [number, number][];
    box: Box;
    /** Points along it, evenly spaced in t, for finding crossings. */
    samples: Vector2[];
};

export type StrandGeometry = {
    /** Each pin's direction (a unit vector). */
    directions: Vector2[];
    segments: SegmentGeometry[];
    /** How far along the strand each segment starts. */
    starts: number[];
    length: number;
};

export type PictureGeometry = { strands: StrandGeometry[] };

const pinAt = (pin: Pin) => new Vector2(pin.x, pin.y);
const held = (pin: Pin) =>
    pin.angle === undefined ? undefined : Vector2.fromAngle(rad(pin.angle));

/** Each pin's direction: held, or from Hobby's run between the nearest pins holding one (or the strand's ends). */
export function strandDirections(pins: readonly Pin[]): Vector2[] {
    const points = pins.map(pinAt);
    const holding = pins.map(held);
    const directions: Vector2[] = new Array(pins.length);
    let start = 0;
    for (let k = 1; k < pins.length; k++) {
        if (holding[k] === undefined && k < pins.length - 1) continue;
        const end = (direction: Vector2 | undefined): RunEnd =>
            direction ? { direction } : { curl: 1 };
        const run = hobbyDirections(
            points.slice(start, k + 1),
            end(holding[start]),
            end(holding[k]),
        );
        run.forEach((d, j) => (directions[start + j] = holding[start + j] ?? d));
        start = k;
    }
    return directions;
}

/** The segment's curve with these tensions. */
const curveWith = (
    a: Vector2,
    b: Vector2,
    leaving: Vector2,
    arriving: Vector2,
    tension: [number, number],
) => new Cubic(a, ...hobbyControls(a, b, leaving, arriving, tension), b);

/**
 * A locked segment's tensions: its own scaled by one factor until the curve has `length`, by bisection on the factor
 * (the curve grows longer as the tensions fall). Outside its reach, the nearer end of it, and by how much it misses.
 */
function meetLength(
    a: Vector2,
    b: Vector2,
    leaving: Vector2,
    arriving: Vector2,
    ratio: [number, number],
    length: number,
): { tension: [number, number]; cubic: Cubic; lock: LockStatus } {
    const scaled = (k: number): [number, number] => [ratio[0] * k, ratio[1] * k];
    const curve = (k: number) => curveWith(a, b, leaving, arriving, scaled(k));
    const [loosest, tightest] = [
        MIN_TENSION / Math.min(...ratio),
        MAX_TENSION / Math.max(...ratio),
    ];
    const [longest, shortest] = [curve(loosest).length(), curve(tightest).length()];
    const reach: [number, number] = [shortest, longest];
    let k: number;
    let lock: LockStatus;
    if (length > longest) {
        k = loosest;
        lock = { kind: "too-long", by: length - longest, reach };
    } else if (length < shortest) {
        k = tightest;
        lock = { kind: "too-short", by: shortest - length, reach };
    } else {
        const [lo, hi] = bisect((f) => curve(f).length() > length, loosest, tightest, 40);
        k = (lo + hi) / 2;
        lock = { kind: "ok", reach };
    }
    return { tension: scaled(k), cubic: curve(k), lock };
}

function segmentGeometry(
    from: Pin,
    to: Pin,
    leaving: Vector2,
    arriving: Vector2,
    segment: StrandSegment,
    strandKind: Strand["kind"],
): SegmentGeometry {
    const [a, b] = [pinAt(from), pinAt(to)];
    const shaped =
        segment.length === undefined
            ? {
                  tension: segment.tension,
                  cubic: curveWith(a, b, leaving, arriving, segment.tension),
              }
            : meetLength(a, b, leaving, arriving, segment.tension, segment.length);
    const { cubic } = shaped;
    const tightest = cubic.tightest();
    return {
        from,
        to,
        leaving,
        arriving,
        segment,
        strandKind,
        ...shaped,
        length: cubic.length(),
        tightest,
        bends:
            strandKind === "rope" && tightest.radius < TIGHTEST_BEND
                ? cubic.tighterThan(TIGHTEST_BEND)
                : [],
        box: cubic.bounds(),
        samples: cubic.points(cubic.pieces()),
    };
}

const sameDirection = (a: Vector2, b: Vector2) => a.x === b.x && a.y === b.y;

/** Whether old results still hold for a segment worked out from these. */
const unchanged = (
    old: SegmentGeometry,
    from: Pin,
    to: Pin,
    leaving: Vector2,
    arriving: Vector2,
    strandKind: Strand["kind"],
) =>
    old.from === from &&
    old.to === to &&
    old.strandKind === strandKind &&
    sameDirection(old.leaving, leaving) &&
    sameDirection(old.arriving, arriving);

/** The picture's curves, keeping `previous`'s results for every segment that didn't change. */
export function pictureGeometry(picture: Picture, previous?: PictureGeometry): PictureGeometry {
    const before = new Map<StrandSegment, SegmentGeometry>();
    for (const strand of previous?.strands ?? [])
        for (const seg of strand.segments)
            if (!before.has(seg.segment)) before.set(seg.segment, seg);

    return {
        strands: picture.strands.map((strand) => {
            const directions = strandDirections(strand.pins);
            const segments = strand.segments.map((segment, k) => {
                const [from, to] = [strand.pins[k], strand.pins[k + 1]];
                const [leaving, arriving] = [directions[k], directions[k + 1]];
                const old = before.get(segment);
                return old && unchanged(old, from, to, leaving, arriving, strand.kind)
                    ? old
                    : segmentGeometry(from, to, leaving, arriving, segment, strand.kind);
            });
            const starts: number[] = [];
            let length = 0;
            for (const seg of segments) {
                starts.push(length);
                length += seg.length;
            }
            return { directions, segments, starts, length };
        }),
    };
}

/** Where along the strand a distance from its start is: the segment and t (clamped to the strand). */
export function strandPosition(
    strand: StrandGeometry,
    distance: number,
): { segment: number; t: number } {
    const { segments, starts } = strand;
    if (distance <= 0) return { segment: 0, t: 0 };
    let k = starts.findLastIndex((s) => s <= distance);
    if (k < 0) k = 0;
    const seg = segments[k];
    return { segment: k, t: seg.cubic.tAtLength(distance - starts[k], seg.length) };
}

/** How far along the strand a place on one of its segments is. */
export const strandDistance = (strand: StrandGeometry, segment: number, t: number) =>
    strand.starts[segment] +
    (t >= 1 ? strand.segments[segment].length : strand.segments[segment].cubic.lengthTo(t));

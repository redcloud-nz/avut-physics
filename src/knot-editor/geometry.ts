/**
 * A picture's curves: each pin's direction, each segment's cubic, and its length, bends and box. Pins holding an
 * angle keep it; each run of pins between them gets its directions from Hobby's method, with curl 1 at a free end
 * of the strand. A locked segment's tensions are scaled together, keeping their ratio, until it has its length.
 *
 * Linked pins are placed from their leaders first (`placedPins`), so to the curves every pin is a place, holding an angle
 * or not.
 *
 * Working out a picture again after a change, pass the geometry from before it: every segment whose pins' places and
 * directions (by value) and own values are unchanged keeps its old results. (By value, as a linked pin moves with its
 * leader without itself changing.)
 */

import { Cubic, type Box } from "@/lib/bezier";
import { hobbyControls, hobbyDirections, MAX_TENSION, MIN_TENSION, type RunEnd } from "@/lib/hobby";
import { rad } from "@/lib/math";
import { bisect } from "@/lib/numeric";
import { Vector2 } from "@/lib/vector2";

import {
    isLinked,
    strandSize,
    type Id,
    type Picture,
    type Pin,
    type Strand,
    type StrandSegment,
} from "./format";

/**
 * Bends tighter than this radius (rope diameters, to the rope's centre line) are shaded on ropes as a warning: about as
 * tight as a rope pulled snug round another of its size. To be made a setting later.
 */
export const TIGHTEST_BEND = 1;

/** How wide a strand is drawn, with its outline (in its sizes): ropes linked side by side are set this far apart. */
export const DRAWN_WIDTH = 1.25;

/** How well a locked segment meets its length, against its reach: the shortest and longest it can be. */
export type LockStatus = { reach: [number, number] } & (
    | { kind: "ok" }
    | { kind: "too-short"; by: number }
    | { kind: "too-long"; by: number }
);

export type SegmentGeometry = {
    /** What it was worked out from, to tell when it can be kept. */
    from: PlacedPin;
    to: PlacedPin;
    leaving: Vector2;
    arriving: Vector2;
    segment: StrandSegment;
    strandKind: Strand["kind"];
    /** The strand's size (`strandSize`). */
    size: number;

    cubic: Cubic;
    /** The tensions it's drawn with: its own, or for a locked segment, scaled to meet its length. */
    tension: [number, number];
    length: number;
    /** For a locked segment, whether it meets its length. */
    lock?: LockStatus;
    /** Its tightest bend: the least radius and where it is. */
    tightest: { radius: number; t: number };
    /** On a rope, the stretches (ranges of t) bending tighter than `TIGHTEST_BEND` diameters. None on an arrow. */
    bends: [number, number][];
    box: Box;
    /** Points along it, evenly spaced in t, for finding crossings: about a quarter of the strand's size apart. */
    samples: Vector2[];
};

export type StrandGeometry = {
    /** Each pin where it is, linked pins placed from their leaders. */
    pins: PlacedPin[];
    /** Each pin's direction (a unit vector). */
    directions: Vector2[];
    segments: SegmentGeometry[];
    /** How far along the strand each segment starts. */
    starts: number[];
    length: number;
};

export type PictureGeometry = { strands: StrandGeometry[] };

/** A pin where it is, and the way it runs through it (degrees) where that's held or comes from a link. */
export type PlacedPin = { x: number; y: number; angle?: number };

const pinAt = (pin: PlacedPin) => new Vector2(pin.x, pin.y);
const held = (pin: PlacedPin) =>
    pin.angle === undefined ? undefined : Vector2.fromAngle(rad(pin.angle));

/** An angle in degrees, brought into (−180, 180]. */
const angleWithin = (angle: number) => {
    const turned = (((angle + 180) % 360) + 360) % 360;
    return turned === 0 ? 180 : turned - 180;
};

/**
 * Every pin of the picture where it is. A free pin is where it's placed. A linked pin is beside its leader (placed
 * first): across the way the leader runs, to the side its link names, the two strands' half-widths and the link's
 * gap from it, running the leader's way or, reversed, the other way. (y is down, so left of a direction d is
 * (d.y, −d.x).) A leader with no angle (which the file refuses) is taken as running along x.
 */
export function placedPins(picture: Picture): PlacedPin[][] {
    const where = new Map<Id, { pin: Pin; size: number }>();
    for (const strand of picture.strands)
        for (const pin of strand.pins) where.set(pin.id, { pin, size: strandSize(strand) });
    const placed = new Map<Id, PlacedPin>();
    const place = (pin: Pin, size: number, from: Set<Id>): PlacedPin => {
        const known = placed.get(pin.id);
        if (known) return known;
        if (!isLinked(pin)) return pin;
        const leading = where.get(pin.link.pin);
        // A missing leader or a loop (which the file refuses) leaves the pin at the origin.
        if (!leading || from.has(pin.id)) return { x: 0, y: 0, angle: 0 };
        const leader = place(leading.pin, leading.size, new Set([...from, pin.id]));
        const angle = leader.angle ?? 0;
        const d = Vector2.fromAngle(rad(angle));
        const left = new Vector2(d.y, -d.x);
        const apart = (DRAWN_WIDTH * (leading.size + size)) / 2 + (pin.link.gap ?? 0);
        const at = pinAt(leader).add(left.scale(pin.link.side === "left" ? apart : -apart));
        const result = {
            x: at.x,
            y: at.y,
            angle: pin.link.reverse ? angleWithin(angle + 180) : angle,
        };
        placed.set(pin.id, result);
        return result;
    };
    return picture.strands.map((strand) =>
        strand.pins.map((pin) => place(pin, strandSize(strand), new Set())),
    );
}

/** Each pin's direction: held, or from Hobby's run between the nearest pins holding one (or the strand's ends). */
export function strandDirections(pins: readonly PlacedPin[]): Vector2[] {
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
    from: PlacedPin,
    to: PlacedPin,
    leaving: Vector2,
    arriving: Vector2,
    segment: StrandSegment,
    strandKind: Strand["kind"],
    size: number,
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
        size,
        ...shaped,
        length: cubic.length(),
        tightest,
        bends:
            strandKind === "rope" && tightest.radius < TIGHTEST_BEND * size
                ? cubic.tighterThan(TIGHTEST_BEND * size)
                : [],
        box: cubic.bounds(),
        samples: cubic.points(cubic.pieces(SAMPLE_SPACING * size)),
    };
}

/** How far apart a segment's samples are, roughly, in strand sizes. */
const SAMPLE_SPACING = 0.25;

const sameDirection = (a: Vector2, b: Vector2) => a.x === b.x && a.y === b.y;

/** Whether old results still hold for a segment worked out from these. */
const samePlace = (a: PlacedPin, b: PlacedPin) => a.x === b.x && a.y === b.y && a.angle === b.angle;

const unchanged = (
    old: SegmentGeometry,
    from: PlacedPin,
    to: PlacedPin,
    leaving: Vector2,
    arriving: Vector2,
    strandKind: Strand["kind"],
    size: number,
) =>
    samePlace(old.from, from) &&
    samePlace(old.to, to) &&
    old.strandKind === strandKind &&
    old.size === size &&
    sameDirection(old.leaving, leaving) &&
    sameDirection(old.arriving, arriving);

/** The picture's curves, keeping `previous`'s results for every segment that didn't change. */
export function pictureGeometry(picture: Picture, previous?: PictureGeometry): PictureGeometry {
    const before = new Map<StrandSegment, SegmentGeometry>();
    for (const strand of previous?.strands ?? [])
        for (const seg of strand.segments)
            if (!before.has(seg.segment)) before.set(seg.segment, seg);

    const placed = placedPins(picture);
    return {
        strands: picture.strands.map((strand, i) => {
            const pins = placed[i];
            const directions = strandDirections(pins);
            const size = strandSize(strand);
            const segments = strand.segments.map((segment, k) => {
                const [from, to] = [pins[k], pins[k + 1]];
                const [leaving, arriving] = [directions[k], directions[k + 1]];
                const old = before.get(segment);
                return old && unchanged(old, from, to, leaving, arriving, strand.kind, size)
                    ? old
                    : segmentGeometry(from, to, leaving, arriving, segment, strand.kind, size);
            });
            const starts: number[] = [];
            let length = 0;
            for (const seg of segments) {
                starts.push(length);
                length += seg.length;
            }
            return { pins, directions, segments, starts, length };
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

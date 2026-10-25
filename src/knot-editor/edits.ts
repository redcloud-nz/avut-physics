/**
 * Edits to a picture: pure functions from a picture to a new one, sharing every strand, pin, segment, crossing entry
 * and prop they don't change (so the geometry cache keeps their results). The edits that need the curves (lock,
 * unlock, insert and delete) take the picture's geometry too. Those that renumber pins or strands also say how the
 * old numbers map to the new, so the selection can follow.
 *
 * An edit that can't be made (a tension set on a locked segment, a pin deleted from a strand of two) gives back the
 * picture itself.
 */

import type { Cubic } from "@/lib/bezier";
import { hobbyTensions, MAX_TENSION, MIN_TENSION } from "@/lib/hobby";
import { clamp, deg } from "@/lib/math";
import type { Vector2 } from "@/lib/vector2";

import { firstUnusedColour } from "./colours";
import { pictureCrossings } from "./crossing-geometry";
import {
    crossingPair,
    sameSegment,
    segmentBefore,
    type CrossingEntry,
    type PassEntry,
    type PassSide,
    type Picture,
    type Pin,
    type PinRef,
    type Prop,
    type RopeColour,
    type SegmentRef,
    type Strand,
    type StrandSegment,
} from "./format";
import { pictureGeometry, type PictureGeometry } from "./geometry";
import { kindOf } from "./props";

/** Where an edit moved each pin and segment: none where it went, two where a segment was split. */
export type Renumbering = {
    pin(ref: PinRef): PinRef | undefined;
    segment(ref: SegmentRef): SegmentRef[];
};

/** A picture after an edit that renumbers, and how. */
export type Edited = { picture: Picture; renumbering?: Renumbering };

// Sharing what doesn't change

function replaced<T>(list: readonly T[], k: number, item: T): T[] {
    const copy = list.slice();
    copy[k] = item;
    return copy;
}

/** The picture with strand i changed, or itself where the change gives back the same strand. */
function withStrand(picture: Picture, i: number, change: (strand: Strand) => Strand): Picture {
    const old = picture.strands[i];
    if (!old) return picture;
    const strand = change(old);
    return strand === old ? picture : { ...picture, strands: replaced(picture.strands, i, strand) };
}

function withPin(picture: Picture, [i, k]: PinRef, change: (pin: Pin) => Pin): Picture {
    return withStrand(picture, i, (strand) => {
        const old = strand.pins[k];
        if (!old) return strand;
        const pin = change(old);
        return pin === old ? strand : { ...strand, pins: replaced(strand.pins, k, pin) };
    });
}

function withSegment(
    picture: Picture,
    [i, k]: SegmentRef,
    change: (segment: StrandSegment) => StrandSegment,
): Picture {
    return withStrand(picture, i, (strand) => {
        const old = strand.segments[k];
        if (!old) return strand;
        const segment = change(old);
        return segment === old
            ? strand
            : { ...strand, segments: replaced(strand.segments, k, segment) };
    });
}

const tensionWithin = (t: number) => clamp(t, MIN_TENSION, MAX_TENSION);
const tensionsWithin = ([a, b]: readonly [number, number]): [number, number] => [
    tensionWithin(a),
    tensionWithin(b),
];

/** An angle in degrees, brought into (−180, 180]. */
const angleWithin = (angle: number) => {
    const turned = (((angle + 180) % 360) + 360) % 360;
    return turned === 0 ? 180 : turned - 180;
};

/** A direction as a pin's angle (degrees). */
const angleOf = (direction: Vector2) => angleWithin(deg(direction.angle()));

// Pins and segments

export const movePin = (picture: Picture, ref: PinRef, x: number, y: number) =>
    withPin(picture, ref, (pin) => (pin.x === x && pin.y === y ? pin : { ...pin, x, y }));

/** The pin holding this angle (degrees), or, given none, free again. */
export const setPinAngle = (picture: Picture, ref: PinRef, angle: number | undefined) =>
    withPin(picture, ref, (pin) => {
        if (angle === undefined) return pin.angle === undefined ? pin : { x: pin.x, y: pin.y };
        const held = angleWithin(angle);
        return pin.angle === held ? pin : { x: pin.x, y: pin.y, angle: held };
    });

/** A segment's tensions, kept within 0.75 to 4. Refused on a locked segment, whose tensions follow its length. */
export const setTensions = (picture: Picture, ref: SegmentRef, tension: [number, number]) =>
    withSegment(picture, ref, (segment) =>
        segment.length !== undefined ? segment : { tension: tensionsWithin(tension) },
    );

/** A segment locked at the length it's drawn with, its tensions kept as the ratio, so nothing moves. */
export const lockSegment = (picture: Picture, geometry: PictureGeometry, [i, k]: SegmentRef) =>
    withSegment(picture, [i, k], (segment) =>
        segment.length !== undefined
            ? segment
            : { tension: segment.tension, length: geometry.strands[i].segments[k].length },
    );

/** A segment unlocked, keeping the tensions it's drawn with, so nothing moves. */
export const unlockSegment = (picture: Picture, geometry: PictureGeometry, [i, k]: SegmentRef) =>
    withSegment(picture, [i, k], (segment) =>
        segment.length === undefined
            ? segment
            : { tension: tensionsWithin(geometry.strands[i].segments[k].tension) },
    );

/** A locked segment's length. Refused on one that isn't locked, or a length that isn't more than 0. */
export const setSegmentLength = (picture: Picture, ref: SegmentRef, length: number) =>
    withSegment(picture, ref, (segment) =>
        segment.length === undefined || !(length > 0) ? segment : { ...segment, length },
    );

/**
 * Rope shifted through a pin: the locked segment before it longer by Δ and the one after shorter by Δ, so the total
 * stays the same. Refused unless both are locked, and where either would be left no length.
 */
export function shiftAt(picture: Picture, [i, k]: PinRef, delta: number): Picture {
    const strand = picture.strands[i];
    const [before, after] = [strand?.segments[k - 1], strand?.segments[k]];
    if (before?.length === undefined || after?.length === undefined) return picture;
    const [longer, shorter] = [before.length + delta, after.length - delta];
    if (!(longer > 0 && shorter > 0)) return picture;
    const segments = strand.segments.slice();
    segments[k - 1] = { ...before, length: longer };
    segments[k] = { ...after, length: shorter };
    return { ...picture, strands: replaced(picture.strands, i, { ...strand, segments }) };
}

// Following crossings and passes through an edit

/** Where a place on a segment is after an edit: on which segment, and where along it (in the same order). */
type Moved = { ref: SegmentRef; t: number };
type MovePlace = (ref: SegmentRef, t: number) => Moved | undefined;

const pairKey = ([a, b]: [SegmentRef, SegmentRef]) => `${a[0]}.${a[1]}:${b[0]}.${b[1]}`;
const passKey = (prop: number, [i, k]: SegmentRef) => `${prop}:${i}.${k}`;

/** The first n from 1 not in `taken`, or `n` itself if it's free. */
function freeN(taken: Set<number>, n: number) {
    if (!taken.has(n)) return n;
    let free = 1;
    while (taken.has(free)) free++;
    return free;
}

/**
 * The picture's crossing entries and props' passes after an edit that splits, joins, renumbers or removes segments.
 * Each crossing and pass found before the edit is moved to where it ends up and counted again along its new pair's
 * first segment (or its new segment); each entry follows the one it was matched to. An entry that matched nothing
 * keeps its n where it's free, and goes on the first of a split segment's halves; one on a removed segment goes.
 */
function followEntries(
    picture: Picture,
    geometry: PictureGeometry,
    move: MovePlace,
): Pick<Picture, "crossings" | "props"> {
    const found = pictureCrossings(picture, geometry);

    // Crossings: each one found, at its new place, counted again along its new pair.
    const newPairs = new Map<
        string,
        { at: number; refs: [SegmentRef, SegmentRef]; was: string }[]
    >();
    for (const c of found.crossings) {
        const [a, b] = [move(c.pair[0], c.t[0]), move(c.pair[1], c.t[1])];
        if (!a || !b) continue;
        const aFirst = !segmentBefore(b.ref, a.ref);
        const pair: [SegmentRef, SegmentRef] = aFirst ? [a.ref, b.ref] : [b.ref, a.ref];
        const key = pairKey(pair);
        const list = newPairs.get(key) ?? [];
        list.push({
            at: aFirst ? a.t : b.t,
            refs: [a.ref, b.ref],
            was: `${pairKey(c.pair)}#${c.n}`,
        });
        newPairs.set(key, list);
    }
    const followed = new Map<string, { refs: [SegmentRef, SegmentRef]; n: number }>();
    const taken = new Map<string, Set<number>>();
    for (const [key, list] of newPairs) {
        list.sort((p, q) => p.at - q.at);
        list.forEach((c, k) => followed.set(c.was, { refs: c.refs, n: k + 1 }));
        taken.set(key, new Set(list.map((_, k) => k + 1)));
    }
    const sameEntry = (a: CrossingEntry, b: CrossingEntry) =>
        sameSegment(a.over, b.over) && sameSegment(a.under, b.under) && a.n === b.n;
    const crossings: CrossingEntry[] = [];
    const unmatched: CrossingEntry[] = [];
    for (const entry of picture.crossings) {
        const pair = crossingPair(entry);
        const to = followed.get(`${pairKey(pair)}#${entry.n}`);
        if (!to) {
            unmatched.push(entry);
            continue;
        }
        const overFirst = sameSegment(entry.over, pair[0]);
        const moved = {
            over: to.refs[overFirst ? 0 : 1],
            under: to.refs[overFirst ? 1 : 0],
            n: to.n,
        };
        crossings.push(sameEntry(moved, entry) ? entry : moved);
    }
    for (const entry of unmatched) {
        const [over, under] = [move(entry.over, 0), move(entry.under, 0)];
        if (!over || !under) continue;
        const moved = { over: over.ref, under: under.ref, n: entry.n };
        const key = pairKey(crossingPair(moved));
        const used = taken.get(key) ?? new Set<number>();
        moved.n = freeN(used, entry.n);
        used.add(moved.n);
        taken.set(key, used);
        crossings.push(sameEntry(moved, entry) ? entry : moved);
    }

    // Passes, the same way, per prop and segment.
    const newPasses = new Map<string, { at: number; was: string; ref: SegmentRef }[]>();
    for (const p of found.passes) {
        const to = move([p.strand, p.segment], p.t);
        if (!to) continue;
        const key = passKey(p.prop, to.ref);
        const list = newPasses.get(key) ?? [];
        list.push({
            at: to.t,
            was: `${passKey(p.prop, [p.strand, p.segment])}#${p.n}`,
            ref: to.ref,
        });
        newPasses.set(key, list);
    }
    const followedPasses = new Map<string, { ref: SegmentRef; n: number }>();
    const takenPasses = new Map<string, Set<number>>();
    for (const [key, list] of newPasses) {
        list.sort((p, q) => p.at - q.at);
        list.forEach((p, k) => followedPasses.set(p.was, { ref: p.ref, n: k + 1 }));
        takenPasses.set(key, new Set(list.map((_, k) => k + 1)));
    }
    const props = picture.props.map((prop, p) => {
        const kind = kindOf(prop);
        const entries = kind.passes(prop);
        if (!entries.length) return prop;
        const passes: PassEntry[] = [];
        const left: PassEntry[] = [];
        for (const entry of entries) {
            const to = followedPasses.get(`${passKey(p, [entry[0], entry[1]])}#${entry[2]}`);
            if (to) passes.push([to.ref[0], to.ref[1], to.n, entry[3]]);
            else left.push(entry);
        }
        for (const entry of left) {
            const to = move([entry[0], entry[1]], 0);
            if (!to) continue;
            const key = passKey(p, to.ref);
            const used = takenPasses.get(key) ?? new Set<number>();
            const n = freeN(used, entry[2]);
            used.add(n);
            takenPasses.set(key, used);
            passes.push([to.ref[0], to.ref[1], n, entry[3]]);
        }
        const same =
            passes.length === entries.length &&
            passes.every((q, k) => q.every((v, j) => v === entries[k][j]));
        return same ? prop : kind.withPasses(prop, passes);
    });

    return { crossings, props };
}

// Crossings

const samePair = (a: [SegmentRef, SegmentRef], b: [SegmentRef, SegmentRef]) =>
    sameSegment(a[0], b[0]) && sameSegment(a[1], b[1]);

/**
 * Which of a crossing's pair is on top (0 for the pair's first segment, 1 for its second): its entry changed, or
 * added after the others.
 */
export function setCrossing(
    picture: Picture,
    pair: [SegmentRef, SegmentRef],
    n: number,
    over: 0 | 1,
): Picture {
    const entry: CrossingEntry = { over: pair[over], under: pair[1 - over], n };
    const k = picture.crossings.findIndex((e) => e.n === n && samePair(crossingPair(e), pair));
    if (k < 0) return { ...picture, crossings: [...picture.crossings, entry] };
    if (sameSegment(picture.crossings[k].over, entry.over)) return picture;
    return { ...picture, crossings: replaced(picture.crossings, k, entry) };
}

/** An entry deleted (one that's lost, its segments no longer crossing there). */
export function deleteCrossing(picture: Picture, entry: CrossingEntry): Picture {
    const crossings = picture.crossings.filter(
        (e) =>
            !(
                e.n === entry.n &&
                sameSegment(e.over, entry.over) &&
                sameSegment(e.under, entry.under)
            ),
    );
    return crossings.length === picture.crossings.length ? picture : { ...picture, crossings };
}

/**
 * A pair's entries, when they're to check, replaced by its crossings as they're drawn now, numbered afresh along the
 * pair's first segment. A crossing drawn with no side yet gets the pair's first segment on top, as a click would give
 * it. The new entries go where the pair's first one was.
 */
export function confirmCrossings(
    picture: Picture,
    geometry: PictureGeometry,
    pair: [SegmentRef, SegmentRef],
): Picture {
    const found = pictureCrossings(picture, geometry).crossings.filter((c) =>
        samePair(c.pair, pair),
    );
    const entries = found.map((c): CrossingEntry => {
        const over = c.over ?? 0;
        return { over: pair[over], under: pair[1 - over], n: c.n };
    });
    const at = picture.crossings.findIndex((e) => samePair(crossingPair(e), pair));
    if (at < 0) return picture;
    // None of the entries before `at` are the pair's, so they keep their places.
    const others = picture.crossings.filter((e) => !samePair(crossingPair(e), pair));
    return { ...picture, crossings: [...others.slice(0, at), ...entries, ...others.slice(at)] };
}

// Props and their passes

export const addProp = (picture: Picture, prop: Prop): Picture => ({
    ...picture,
    props: [...picture.props, prop],
});

/** A prop changed (moved, or a field set), or the picture itself where the change gives back the same prop. */
export function changeProp(picture: Picture, p: number, change: (prop: Prop) => Prop): Picture {
    const old = picture.props[p];
    if (!old) return picture;
    const prop = change(old);
    return prop === old ? picture : { ...picture, props: replaced(picture.props, p, prop) };
}

export const deleteProp = (picture: Picture, p: number): Picture =>
    picture.props[p] ? { ...picture, props: picture.props.filter((_, q) => q !== p) } : picture;

/** A prop's passes changed, where it has a kind with passes. */
function withPasses(
    picture: Picture,
    p: number,
    change: (passes: PassEntry[]) => PassEntry[],
): Picture {
    return changeProp(picture, p, (prop) => {
        const kind = kindOf(prop);
        const old = kind.passes(prop);
        const passes = change(old);
        return passes === old ? prop : kind.withPasses(prop, passes);
    });
}

const onSegment = (entry: PassEntry, [i, k]: SegmentRef) => entry[0] === i && entry[1] === k;

/** Which side of a prop a segment's nth pass across it goes: its entry changed, or added after the others. */
export const setPass = (
    picture: Picture,
    p: number,
    ref: SegmentRef,
    n: number,
    side: PassSide,
): Picture =>
    withPasses(picture, p, (passes) => {
        const entry: PassEntry = [ref[0], ref[1], n, side];
        const k = passes.findIndex((e) => onSegment(e, ref) && e[2] === n);
        if (k < 0) return [...passes, entry];
        return passes[k][3] === side ? passes : replaced(passes, k, entry);
    });

/** A pass's entry deleted (one that's lost, its segment no longer passing there). */
export const deletePass = (picture: Picture, p: number, entry: PassEntry): Picture =>
    withPasses(picture, p, (passes) => {
        const kept = passes.filter((e) => !e.every((v, j) => v === entry[j]));
        return kept.length === passes.length ? passes : kept;
    });

/**
 * A segment's passes across a prop, when they're to check, replaced by its passes as they're drawn now, numbered
 * afresh along it. One drawn with no side yet is drawn behind, and is entered behind. The new entries go where the
 * segment's first one was.
 */
export function confirmPasses(
    picture: Picture,
    geometry: PictureGeometry,
    p: number,
    ref: SegmentRef,
): Picture {
    const found = pictureCrossings(picture, geometry).passes.filter(
        (q) => q.prop === p && q.strand === ref[0] && q.segment === ref[1],
    );
    const entries = found.map((q): PassEntry => [ref[0], ref[1], q.n, q.side ?? "behind"]);
    return withPasses(picture, p, (passes) => {
        const at = passes.findIndex((e) => onSegment(e, ref));
        if (at < 0) return passes;
        const others = passes.filter((e) => !onSegment(e, ref));
        return [...others.slice(0, at), ...entries, ...others.slice(at)];
    });
}

// Adding and deleting pins

/** A curve's tensions, read back from its control points, kept within 0.75 to 4. */
const tensionsOf = (c: Cubic) => tensionsWithin(hobbyTensions(c.p0, c.p1, c.p2, c.p3));

/**
 * A pin added on a segment at t, splitting it in two (de Casteljau), so the curve stays where it was unless a
 * tension is clamped. The new pin holds the curve's direction there, and so do the segment's two ends where they
 * were free: Hobby's directions come from runs between pins holding an angle, so without them the runs either side
 * would be solved again and move. Each half takes its tensions from its piece of the curve; a locked segment's
 * halves are both locked, at the curve's lengths up to and after the new pin. Crossings and passes on the segment
 * go to the half they're on.
 */
export function insertPin(
    picture: Picture,
    geometry: PictureGeometry,
    [i, k]: SegmentRef,
    t: number,
): Edited {
    const strand = picture.strands[i];
    const segment = strand?.segments[k];
    if (!segment || !(t > 1e-3 && t < 1 - 1e-3)) return { picture };
    const strandGeometry = geometry.strands[i];
    const { cubic, length } = strandGeometry.segments[k];
    const [first, second] = cubic.split(t);
    const holding = (pin: Pin, direction: Vector2): Pin =>
        pin.angle === undefined ? { ...pin, angle: angleOf(direction) } : pin;
    const pins = [
        ...strand.pins.slice(0, k),
        holding(strand.pins[k], strandGeometry.directions[k]),
        { x: first.p3.x, y: first.p3.y, angle: angleOf(cubic.tangentAt(t)) },
        holding(strand.pins[k + 1], strandGeometry.directions[k + 1]),
        ...strand.pins.slice(k + 2),
    ];
    const lengthBefore = cubic.lengthTo(t);
    const halves: StrandSegment[] =
        segment.length === undefined
            ? [{ tension: tensionsOf(first) }, { tension: tensionsOf(second) }]
            : [
                  { tension: tensionsOf(first), length: lengthBefore },
                  { tension: tensionsOf(second), length: length - lengthBefore },
              ];
    const segments = [...strand.segments.slice(0, k), ...halves, ...strand.segments.slice(k + 1)];

    const move: MovePlace = (ref, u) => {
        if (ref[0] !== i || ref[1] < k) return { ref, t: u };
        if (ref[1] > k) return { ref: [i, ref[1] + 1], t: u };
        return u < t ? { ref: [i, k], t: u / t } : { ref: [i, k + 1], t: (u - t) / (1 - t) };
    };
    return {
        picture: {
            strands: replaced(picture.strands, i, { ...strand, pins, segments }),
            ...followEntries(picture, geometry, move),
        },
        renumbering: {
            pin: ([s, p]) => (s === i && p > k ? [s, p + 1] : [s, p]),
            segment: ([s, j]) =>
                s !== i || j < k
                    ? [[s, j]]
                    : j === k
                      ? [
                            [s, k],
                            [s, k + 1],
                        ]
                      : [[s, j + 1]],
        },
    };
}

/**
 * A pin deleted. Between two segments it joins them: locked at the sum of their lengths when both were locked, and
 * unlocked otherwise, with the tensions they were drawn with at its two ends. At a strand's end it takes its segment
 * with it. Crossings and passes move to the joined segment, counted again; an entry between the two segments joined
 * now names one segment twice, and is left to check. Refused on a strand of two pins.
 */
export function deletePin(picture: Picture, geometry: PictureGeometry, [i, k]: PinRef): Edited {
    const strand = picture.strands[i];
    const last = strand ? strand.pins.length - 1 : -1;
    if (!strand || k < 0 || k > last || last < 2) return { picture };
    const pins = strand.pins.filter((_, j) => j !== k);
    let segments: StrandSegment[];
    let move: MovePlace;
    let segmentMap: (j: number) => number[];
    if (k === 0 || k === last) {
        const gone = k === 0 ? 0 : last - 1;
        segments = strand.segments.filter((_, j) => j !== gone);
        const shift = (j: number) => (j > gone ? j - 1 : j);
        move = (ref, u) =>
            ref[0] !== i
                ? { ref, t: u }
                : ref[1] === gone
                  ? undefined
                  : { ref: [i, shift(ref[1])], t: u };
        segmentMap = (j) => (j === gone ? [] : [shift(j)]);
    } else {
        const [before, after] = [strand.segments[k - 1], strand.segments[k]];
        const drawn = geometry.strands[i].segments;
        const tension = tensionsWithin([drawn[k - 1].tension[0], drawn[k].tension[1]]);
        const joined: StrandSegment =
            before.length !== undefined && after.length !== undefined
                ? { tension, length: before.length + after.length }
                : { tension };
        segments = [...strand.segments.slice(0, k - 1), joined, ...strand.segments.slice(k + 1)];
        move = (ref, u) => {
            if (ref[0] !== i || ref[1] < k - 1) return { ref, t: u };
            if (ref[1] === k - 1) return { ref, t: u / 2 };
            if (ref[1] === k) return { ref: [i, k - 1], t: 0.5 + u / 2 };
            return { ref: [i, ref[1] - 1], t: u };
        };
        segmentMap = (j) => [j < k ? j : j - 1];
    }
    return {
        picture: {
            strands: replaced(picture.strands, i, { ...strand, pins, segments }),
            ...followEntries(picture, geometry, move),
        },
        renumbering: {
            pin: ([s, p]) => (s !== i ? [s, p] : p === k ? undefined : [s, p > k ? p - 1 : p]),
            segment: ([s, j]) => (s !== i ? [[s, j]] : segmentMap(j).map((m) => [s, m])),
        },
    };
}

/** One renumbering after another. */
const andThen = (first: Renumbering, second: Renumbering): Renumbering => ({
    pin: (ref) => {
        const moved = first.pin(ref);
        return moved && second.pin(moved);
    },
    segment: (ref) => first.segment(ref).flatMap((moved) => second.segment(moved)),
});

/**
 * Pins deleted, as Delete does with the selected pins: one by one, last first, so the others keep their numbers
 * until they go. A strand that would be left with fewer than two pins is deleted whole.
 */
export function deletePins(picture: Picture, pins: PinRef[]): Edited {
    const strands = [...new Set(pins.map(([i]) => i))].sort((a, b) => b - a);
    let edited: Edited = { picture };
    let geometry: PictureGeometry | undefined;
    const then = (next: Edited) => {
        edited = {
            picture: next.picture,
            renumbering:
                edited.renumbering && next.renumbering
                    ? andThen(edited.renumbering, next.renumbering)
                    : (edited.renumbering ?? next.renumbering),
        };
    };
    for (const i of strands) {
        const strand = picture.strands[i];
        if (!strand) continue;
        const going = [...new Set(pins.filter(([s]) => s === i).map(([, k]) => k))]
            .filter((k) => k < strand.pins.length)
            .sort((a, b) => b - a);
        if (strand.pins.length - going.length < 2) {
            then(deleteStrand(edited.picture, i));
            continue;
        }
        for (const k of going) {
            geometry = pictureGeometry(edited.picture, geometry);
            then(deletePin(edited.picture, geometry, [i, k]));
        }
    }
    return edited;
}

// Strands

/** A straight rope (in the first colour not used yet) or arrow from one point to another, after the others. */
export function addStrand(
    picture: Picture,
    kind: Strand["kind"],
    from: Vector2,
    to: Vector2,
): Picture {
    const shape = {
        pins: [
            { x: from.x, y: from.y },
            { x: to.x, y: to.y },
        ],
        segments: [{ tension: [1, 1] as [number, number] }],
    };
    const strand: Strand =
        kind === "rope"
            ? { kind, colour: firstUnusedColour(picture), ...shape }
            : { kind, ...shape };
    return { ...picture, strands: [...picture.strands, strand] };
}

/** A strand deleted, with its crossing entries and passes; later strands' numbers move down by one. */
export function deleteStrand(picture: Picture, i: number): Edited {
    if (!picture.strands[i]) return { picture };
    const after = (s: number) => (s > i ? s - 1 : s);
    const ref = ([s, k]: SegmentRef): SegmentRef => (s > i ? [s - 1, k] : [s, k]);
    const crossings = picture.crossings
        .filter((c) => c.over[0] !== i && c.under[0] !== i)
        .map((c) =>
            c.over[0] > i || c.under[0] > i ? { ...c, over: ref(c.over), under: ref(c.under) } : c,
        );
    const props = picture.props.map((prop) => {
        const kind = kindOf(prop);
        const entries = kind.passes(prop);
        if (!entries.some((e) => e[0] >= i)) return prop;
        return kind.withPasses(
            prop,
            entries.filter((e) => e[0] !== i).map(([s, k, n, side]) => [after(s), k, n, side]),
        );
    });
    return {
        picture: { strands: picture.strands.filter((_, s) => s !== i), crossings, props },
        renumbering: {
            pin: ([s, p]) => (s === i ? undefined : [after(s), p]),
            segment: ([s, k]) => (s === i ? [] : [[after(s), k]]),
        },
    };
}

export const setRopeColour = (picture: Picture, i: number, colour: RopeColour) =>
    withStrand(picture, i, (strand) =>
        strand.kind !== "rope" || strand.colour === colour ? strand : { ...strand, colour },
    );

/** A rope's name for the panel, or none, given only spaces. */
export const setRopeName = (picture: Picture, i: number, name: string | undefined) =>
    withStrand(picture, i, (strand) => {
        if (strand.kind !== "rope") return strand;
        const named = name?.trim() || undefined;
        if (named === strand.name) return strand;
        if (named !== undefined) return { ...strand, name: named };
        const unnamed = { ...strand };
        delete unnamed.name;
        return unnamed;
    });

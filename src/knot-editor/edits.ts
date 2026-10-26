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
import { Vector2 } from "@/lib/vector2";

import { firstUnusedColour } from "./colours";
import { pictureCrossings } from "./crossing-geometry";
import {
    crossingPair,
    isLinked,
    sameSegment,
    segmentBefore,
    type CrossingAt,
    type CrossingEntry,
    type Frame,
    type Id,
    type KnotFile,
    type LinkSide,
    type PassAt,
    type PassEntry,
    type PassSide,
    type Picture,
    type Pin,
    type PinRef,
    type Prop,
    type RopeColour,
    type SegmentRef,
    type Step,
    type Strand,
    type StrandSegment,
} from "./format";
import { pictureGeometry, placedPins, type PictureGeometry } from "./geometry";
import { crossingEntry, passEntry, passesAt, segmentIdAt, segmentPlaces, type Ids } from "./ids";
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

/** A pin moved. Refused on a linked pin, which goes where its leader puts it. */
export const movePin = (picture: Picture, ref: PinRef, x: number, y: number) =>
    withPin(picture, ref, (pin) =>
        isLinked(pin) || (pin.x === x && pin.y === y) ? pin : { ...pin, x, y },
    );

/** Whether any pin is linked to this one. */
const leads = (picture: Picture, id: Id) =>
    picture.strands.some((strand) =>
        strand.pins.some((pin) => isLinked(pin) && pin.link.pin === id),
    );

/**
 * The pin holding this angle (degrees), or, given none, free again. Refused on a linked pin, which runs the way its
 * leader puts it, and clearing the angle of a pin that leads, as its followers are placed across it.
 */
export const setPinAngle = (picture: Picture, ref: PinRef, angle: number | undefined) =>
    withPin(picture, ref, (pin) => {
        if (isLinked(pin)) return pin;
        if (angle === undefined)
            return pin.angle === undefined || leads(picture, pin.id)
                ? pin
                : { id: pin.id, x: pin.x, y: pin.y };
        const held = angleWithin(angle);
        return pin.angle === held ? pin : { id: pin.id, x: pin.x, y: pin.y, angle: held };
    });

// Linked pins

/** Where a pin is, and which way it runs: its own place and angle, or for a linked pin, where its link puts it. */
const placeOf = (picture: Picture, [i, k]: PinRef) => placedPins(picture)[i]?.[k];

/**
 * The pins linked to any of these (by id) made free again, each left where it was and holding the angle it ran at,
 * as when its leader is deleted.
 */
function unlinkFollowers(picture: Picture, leaders: Set<Id>): Picture {
    if (!picture.strands.some((s) => s.pins.some((p) => isLinked(p) && leaders.has(p.link.pin))))
        return picture;
    const placed = placedPins(picture);
    return {
        ...picture,
        strands: picture.strands.map((strand, i) =>
            strand.pins.some((p) => isLinked(p) && leaders.has(p.link.pin))
                ? {
                      ...strand,
                      pins: strand.pins.map((pin, k) =>
                          isLinked(pin) && leaders.has(pin.link.pin)
                              ? freed(pin.id, placed[i][k])
                              : pin,
                      ),
                  }
                : strand,
        ),
    };
}

/** A free pin at a placed pin's place, holding its angle (if it has one). */
const freed = (id: Id, at: { x: number; y: number; angle?: number }): Pin => ({
    id,
    x: at.x,
    y: at.y,
    ...(at.angle !== undefined && { angle: angleWithin(at.angle) }),
});

/**
 * The follower linked to the leader: on whichever side of the leader it is now, running the leader's way or, where
 * it runs the other way now, reversed, with no gap. A free leader with no angle first holds the way it runs now.
 * Refused where they're the same pin, or where the leader already follows the follower (however far back), which
 * would link them round in a loop.
 */
export function linkPins(
    picture: Picture,
    geometry: PictureGeometry,
    leaderRef: PinRef,
    followerRef: PinRef,
): Picture {
    const leader = picture.strands[leaderRef[0]]?.pins[leaderRef[1]];
    const follower = picture.strands[followerRef[0]]?.pins[followerRef[1]];
    if (!leader || !follower || leader === follower) return picture;
    const pins = new Map<Id, Pin>();
    for (const strand of picture.strands) for (const pin of strand.pins) pins.set(pin.id, pin);
    for (let at: Pin | undefined = leader; at && isLinked(at); at = pins.get(at.link.pin))
        if (at.link.pin === follower.id) return picture;

    const [li, lk] = leaderRef;
    const [fi, fk] = followerRef;
    const direction = geometry.strands[li].directions[lk];
    const holding =
        !isLinked(leader) && leader.angle === undefined
            ? setPinAngle(picture, leaderRef, angleOf(direction))
            : picture;
    const [from, to] = [geometry.strands[li].pins[lk], geometry.strands[fi].pins[fk]];
    const left = new Vector2(direction.y, -direction.x);
    const side = new Vector2(to.x - from.x, to.y - from.y).dot(left) >= 0 ? "left" : "right";
    const reverse = geometry.strands[fi].directions[fk].dot(direction) < 0;
    const linked: Pin = {
        id: follower.id,
        link: { pin: leader.id, side, ...(reverse && { reverse: true as const }) },
    };
    return withPin(holding, followerRef, () => linked);
}

/** A linked pin made free, left where it is, holding the angle it runs at. */
export function unlinkPin(picture: Picture, ref: PinRef): Picture {
    const pin = picture.strands[ref[0]]?.pins[ref[1]];
    if (!pin || !isLinked(pin)) return picture;
    return withPin(picture, ref, () => freed(pin.id, placeOf(picture, ref)!));
}

/** A linked pin's side, gap (0 or more; 0 is left out) or reverse changed. */
export function setLink(
    picture: Picture,
    ref: PinRef,
    change: { side?: LinkSide; gap?: number; reverse?: boolean },
): Picture {
    return withPin(picture, ref, (pin) => {
        if (!isLinked(pin)) return pin;
        const side = change.side ?? pin.link.side;
        const gap = change.gap ?? pin.link.gap ?? 0;
        const reverse = change.reverse ?? pin.link.reverse ?? false;
        if (!(gap >= 0)) return pin;
        if (side === pin.link.side && gap === (pin.link.gap ?? 0) && reverse === !!pin.link.reverse)
            return pin;
        return {
            id: pin.id,
            link: {
                pin: pin.link.pin,
                side,
                ...(gap > 0 && { gap }),
                ...(reverse && { reverse: true as const }),
            },
        };
    });
}

/** A segment's tensions, kept within 0.75 to 4. Refused on a locked segment, whose tensions follow its length. */
export const setTensions = (picture: Picture, ref: SegmentRef, tension: [number, number]) =>
    withSegment(picture, ref, (segment) =>
        segment.length !== undefined
            ? segment
            : { id: segment.id, tension: tensionsWithin(tension) },
    );

/** A segment locked at the length it's drawn with, its tensions kept as the ratio, so nothing moves. */
export const lockSegment = (picture: Picture, geometry: PictureGeometry, [i, k]: SegmentRef) =>
    withSegment(picture, [i, k], (segment) =>
        segment.length !== undefined
            ? segment
            : {
                  id: segment.id,
                  tension: segment.tension,
                  length: geometry.strands[i].segments[k].length,
              },
    );

/** A segment unlocked, keeping the tensions it's drawn with, so nothing moves. */
export const unlockSegment = (picture: Picture, geometry: PictureGeometry, [i, k]: SegmentRef) =>
    withSegment(picture, [i, k], (segment) =>
        segment.length === undefined
            ? segment
            : { id: segment.id, tension: tensionsWithin(geometry.strands[i].segments[k].tension) },
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
 * The picture's crossing entries and props' passes after an edit that splits, joins or removes segments, the edit's
 * `strands` replacing the picture's. Each crossing and pass found before the edit is moved to where it ends up and
 * counted again along its new pair's first segment (or its new segment); each entry follows the one it was matched
 * to. An entry that matched nothing keeps its n where it's free, and goes on the first of a split segment's halves;
 * one on a removed segment goes. (It works by where segments are, and gives the entries back by id.)
 */
function followEntries(
    picture: Picture,
    geometry: PictureGeometry,
    move: MovePlace,
    strands: Strand[],
): Pick<Picture, "crossings" | "props"> {
    const found = pictureCrossings(picture, geometry);
    const after: Picture = { ...picture, strands };
    const places = segmentPlaces(picture);
    const idAt = (ref: SegmentRef) => segmentIdAt(after, ref)!;

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
        a.over === b.over && a.under === b.under && a.n === b.n;
    /** An entry by place after the edit, by id, kept as the one it was where it's unchanged. */
    const asBefore = (moved: CrossingAt, was: CrossingEntry): CrossingEntry => {
        const entry = { over: idAt(moved.over), under: idAt(moved.under), n: moved.n };
        return sameEntry(entry, was) ? was : entry;
    };
    const crossings: CrossingEntry[] = [];
    const unmatched: { at: CrossingAt; was: CrossingEntry }[] = [];
    for (const was of picture.crossings) {
        const [over, under] = [places.get(was.over), places.get(was.under)];
        if (!over || !under) continue;
        const entry: CrossingAt = { over, under, n: was.n };
        const pair = crossingPair(entry);
        const to = followed.get(`${pairKey(pair)}#${entry.n}`);
        if (!to) {
            unmatched.push({ at: entry, was });
            continue;
        }
        const overFirst = sameSegment(entry.over, pair[0]);
        const moved = {
            over: to.refs[overFirst ? 0 : 1],
            under: to.refs[overFirst ? 1 : 0],
            n: to.n,
        };
        crossings.push(asBefore(moved, was));
    }
    for (const { at: entry, was } of unmatched) {
        const [over, under] = [move(entry.over, 0), move(entry.under, 0)];
        if (!over || !under) continue;
        const moved = { over: over.ref, under: under.ref, n: entry.n };
        const key = pairKey(crossingPair(moved));
        const used = taken.get(key) ?? new Set<number>();
        moved.n = freeN(used, entry.n);
        used.add(moved.n);
        taken.set(key, used);
        crossings.push(asBefore(moved, was));
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
        const old = kind.passes(prop);
        if (!old.length) return prop;
        const entries = passesAt(picture, p, places);
        const passes: PassEntry[] = [];
        const left: PassAt[] = [];
        for (const entry of entries) {
            const to = followedPasses.get(`${passKey(p, [entry[0], entry[1]])}#${entry[2]}`);
            if (to) passes.push([idAt(to.ref), to.n, entry[3]]);
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
            passes.push([idAt(to.ref), n, entry[3]]);
        }
        const same =
            passes.length === old.length &&
            passes.every((q, k) => q.every((v, j) => v === old[k][j]));
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
    const entry = crossingEntry(picture, { over: pair[over], under: pair[1 - over], n });
    if (!entry) return picture;
    const ids = [entry.over, entry.under];
    const k = picture.crossings.findIndex(
        (e) => e.n === n && ids.includes(e.over) && ids.includes(e.under),
    );
    if (k < 0) return { ...picture, crossings: [...picture.crossings, entry] };
    if (picture.crossings[k].over === entry.over) return picture;
    return { ...picture, crossings: replaced(picture.crossings, k, entry) };
}

/** An entry deleted (one that's lost, its segments no longer crossing there), given by where its segments are. */
export function deleteCrossing(picture: Picture, at: CrossingAt): Picture {
    const entry = crossingEntry(picture, at);
    if (!entry) return picture;
    const crossings = picture.crossings.filter(
        (e) => !(e.n === entry.n && e.over === entry.over && e.under === entry.under),
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
    const entries = found.flatMap((c) => {
        const over = c.over ?? 0;
        const entry = crossingEntry(picture, { over: pair[over], under: pair[1 - over], n: c.n });
        return entry ? [entry] : [];
    });
    const ids = pair.map((ref) => segmentIdAt(picture, ref));
    const ofPair = (e: CrossingEntry) => ids.includes(e.over) && ids.includes(e.under);
    const at = picture.crossings.findIndex(ofPair);
    if (at < 0) return picture;
    // None of the entries before `at` are the pair's, so they keep their places.
    const others = picture.crossings.filter((e) => !ofPair(e));
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

/** Which side of a prop a segment's nth pass across it goes: its entry changed, or added after the others. */
export function setPass(
    picture: Picture,
    p: number,
    ref: SegmentRef,
    n: number,
    side: PassSide,
): Picture {
    const id = segmentIdAt(picture, ref);
    if (id === undefined) return picture;
    return withPasses(picture, p, (passes) => {
        const entry: PassEntry = [id, n, side];
        const k = passes.findIndex((e) => e[0] === id && e[1] === n);
        if (k < 0) return [...passes, entry];
        return passes[k][2] === side ? passes : replaced(passes, k, entry);
    });
}

/** A pass's entry deleted (one that's lost, its segment no longer passing there), given by where its segment is. */
export function deletePass(picture: Picture, p: number, at: PassAt): Picture {
    const entry = passEntry(picture, at);
    if (!entry) return picture;
    return withPasses(picture, p, (passes) => {
        const kept = passes.filter((e) => !e.every((v, j) => v === entry[j]));
        return kept.length === passes.length ? passes : kept;
    });
}

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
    const id = segmentIdAt(picture, ref);
    if (id === undefined) return picture;
    const entries = found.map((q): PassEntry => [id, q.n, q.side ?? "behind"]);
    return withPasses(picture, p, (passes) => {
        const at = passes.findIndex((e) => e[0] === id);
        if (at < 0) return passes;
        const others = passes.filter((e) => e[0] !== id);
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
 * go to the half they're on. The first half keeps the segment's id; the new pin and the second half get new ones.
 */
export function insertPin(
    picture: Picture,
    geometry: PictureGeometry,
    [i, k]: SegmentRef,
    t: number,
    ids: Ids,
): Edited {
    const strand = picture.strands[i];
    const segment = strand?.segments[k];
    if (!segment || !(t > 1e-3 && t < 1 - 1e-3)) return { picture };
    const strandGeometry = geometry.strands[i];
    const { cubic, length } = strandGeometry.segments[k];
    const [first, second] = cubic.split(t);
    const holding = (pin: Pin, direction: Vector2): Pin =>
        !isLinked(pin) && pin.angle === undefined ? { ...pin, angle: angleOf(direction) } : pin;
    const pins = [
        ...strand.pins.slice(0, k),
        holding(strand.pins[k], strandGeometry.directions[k]),
        { id: ids(), x: first.p3.x, y: first.p3.y, angle: angleOf(cubic.tangentAt(t)) },
        holding(strand.pins[k + 1], strandGeometry.directions[k + 1]),
        ...strand.pins.slice(k + 2),
    ];
    const lengthBefore = cubic.lengthTo(t);
    const secondId = ids();
    const halves: StrandSegment[] =
        segment.length === undefined
            ? [
                  { id: segment.id, tension: tensionsOf(first) },
                  { id: secondId, tension: tensionsOf(second) },
              ]
            : [
                  { id: segment.id, tension: tensionsOf(first), length: lengthBefore },
                  { id: secondId, tension: tensionsOf(second), length: length - lengthBefore },
              ];
    const segments = [...strand.segments.slice(0, k), ...halves, ...strand.segments.slice(k + 1)];

    const move: MovePlace = (ref, u) => {
        if (ref[0] !== i || ref[1] < k) return { ref, t: u };
        if (ref[1] > k) return { ref: [i, ref[1] + 1], t: u };
        return u < t ? { ref: [i, k], t: u / t } : { ref: [i, k + 1], t: (u - t) / (1 - t) };
    };
    const strands = replaced(picture.strands, i, { ...strand, pins, segments });
    return {
        picture: { strands, ...followEntries(picture, geometry, move, strands) },
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
 * now names one segment twice, and is left to check. The joined segment keeps the first one's id. Refused on a strand
 * of two pins.
 */
export function deletePin(before: Picture, geometry: PictureGeometry, [i, k]: PinRef): Edited {
    const going = before.strands[i]?.pins[k];
    const last = going ? before.strands[i].pins.length - 1 : -1;
    if (!going || last < 2) return { picture: before };
    // Its followers stay where they are, free.
    const picture = unlinkFollowers(before, new Set([going.id]));
    const strand = picture.strands[i];
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
                ? { id: before.id, tension, length: before.length + after.length }
                : { id: before.id, tension };
        segments = [...strand.segments.slice(0, k - 1), joined, ...strand.segments.slice(k + 1)];
        move = (ref, u) => {
            if (ref[0] !== i || ref[1] < k - 1) return { ref, t: u };
            if (ref[1] === k - 1) return { ref, t: u / 2 };
            if (ref[1] === k) return { ref: [i, k - 1], t: 0.5 + u / 2 };
            return { ref: [i, ref[1] - 1], t: u };
        };
        segmentMap = (j) => [j < k ? j : j - 1];
    }
    const strands = replaced(picture.strands, i, { ...strand, pins, segments });
    return {
        picture: { strands, ...followEntries(picture, geometry, move, strands) },
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

/** A new rope's diameter (millimetres), in a picture with no rope to take one from. */
export const NEW_ROPE_DIAMETER = 11;

/**
 * A straight rope or arrow from one point to another, after the others. A rope is in the first colour not used yet,
 * and as thick as the picture's last rope.
 */
export function addStrand(
    picture: Picture,
    kind: Strand["kind"],
    from: Vector2,
    to: Vector2,
    ids: Ids,
): Picture {
    const shape = {
        id: ids(),
        pins: [
            { id: ids(), x: from.x, y: from.y },
            { id: ids(), x: to.x, y: to.y },
        ],
        segments: [{ id: ids(), tension: [1, 1] as [number, number] }],
    };
    const strand: Strand =
        kind === "rope"
            ? {
                  kind,
                  colour: firstUnusedColour(picture),
                  diameter:
                      picture.strands.findLast((s) => s.kind === "rope")?.diameter ??
                      NEW_ROPE_DIAMETER,
                  ...shape,
              }
            : { kind, ...shape };
    return { ...picture, strands: [...picture.strands, strand] };
}

/** A strand deleted, with its crossing entries and passes; later strands' places move down by one. */
export function deleteStrand(before: Picture, i: number): Edited {
    const going = before.strands[i];
    if (!going) return { picture: before };
    // Pins following its pins, on other strands, stay where they are, free.
    const picture = unlinkFollowers(before, new Set(going.pins.map((pin) => pin.id)));
    const strand = picture.strands[i];
    const after = (s: number) => (s > i ? s - 1 : s);
    const gone = new Set(strand.segments.map((segment) => segment.id));
    const crossings = picture.crossings.filter((c) => !gone.has(c.over) && !gone.has(c.under));
    const props = picture.props.map((prop) => {
        const kind = kindOf(prop);
        const entries = kind.passes(prop);
        const kept = entries.filter((e) => !gone.has(e[0]));
        return kept.length === entries.length ? prop : kind.withPasses(prop, kept);
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

/** A rope's diameter (millimetres, above 0). */
export const setRopeDiameter = (picture: Picture, i: number, diameter: number) =>
    withStrand(picture, i, (strand) =>
        strand.kind !== "rope" || !(diameter > 0) || strand.diameter === diameter
            ? strand
            : { ...strand, diameter },
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

// Steps and the knot's details

/**
 * A step added after the chosen picture: after a step, a copy of its picture numbered one more; with the knot chosen,
 * after the last step, a copy of the knot numbered one more than the last. Its instructions start empty. Gives back
 * where it went.
 */
export function insertStep(
    file: KnotFile,
    after: "knot" | number,
): { file: KnotFile; index: number } {
    const index = after === "knot" ? file.steps.length : after + 1;
    const from = after === "knot" ? undefined : file.steps[after];
    const last = file.steps[file.steps.length - 1];
    const step: Step = {
        number: (from ?? last ?? { number: 0 }).number + 1,
        instructions: "",
        picture: from ? from.picture : file.knot,
    };
    const steps = [...file.steps.slice(0, index), step, ...file.steps.slice(index)];
    return { file: { ...file, steps }, index };
}

/** A step copied, with the same number, just after it: the same step shown in a second picture. */
export function duplicateStep(file: KnotFile, k: number): KnotFile {
    const step = file.steps[k];
    if (!step) return file;
    const steps = [...file.steps.slice(0, k + 1), { ...step }, ...file.steps.slice(k + 1)];
    return { ...file, steps };
}

export const deleteStep = (file: KnotFile, k: number): KnotFile =>
    file.steps[k] ? { ...file, steps: file.steps.filter((_, j) => j !== k) } : file;

/** A step moved up (−1) or down (1) the list, keeping its number. Refused past either end. */
export function moveStep(file: KnotFile, k: number, by: -1 | 1): KnotFile {
    const to = k + by;
    if (!file.steps[k] || !file.steps[to]) return file;
    const steps = file.steps.slice();
    [steps[k], steps[to]] = [steps[to], steps[k]];
    return { ...file, steps };
}

function withStep(file: KnotFile, k: number, change: (step: Step) => Step): KnotFile {
    const old = file.steps[k];
    if (!old) return file;
    const step = change(old);
    return step === old ? file : { ...file, steps: replaced(file.steps, k, step) };
}

/** A step's number: a whole number from 1, or refused. Numbers are only ever typed, never counted. */
export const setStepNumber = (file: KnotFile, k: number, number: number) =>
    withStep(file, k, (step) =>
        !Number.isInteger(number) || number < 1 || step.number === number
            ? step
            : { ...step, number },
    );

export const setStepInstructions = (file: KnotFile, k: number, instructions: string) =>
    withStep(file, k, (step) =>
        step.instructions === instructions ? step : { ...step, instructions },
    );

export type KnotDetails = Pick<KnotFile, "name" | "description" | "about">;

/** The knot's name (refused blank), description and about text (left out when blank). */
export function setDetails(file: KnotFile, details: KnotDetails): KnotFile {
    const name = details.name.trim();
    const [description, about] = [
        details.description?.trim() || undefined,
        details.about?.trim() || undefined,
    ];
    if (!name) return file;
    if (name === file.name && description === file.description && about === file.about) return file;
    const changed: KnotFile = { ...file, name };
    delete changed.description;
    delete changed.about;
    return {
        ...changed,
        ...(description && { description }),
        ...(about && { about }),
    };
}

// The frame

/** The knot's frame, refused unless every value is a number and its width and height are above 0. */
export function setFrame(file: KnotFile, frame: Frame): KnotFile {
    const { x, y, w, h } = frame;
    if (![x, y, w, h].every(Number.isFinite) || !(w > 0) || !(h > 0)) return file;
    const was = file.frame;
    if (x === was.x && y === was.y && w === was.w && h === was.h) return file;
    return { ...file, frame: { x, y, w, h } };
}

/** Which of the frame's edges a drag moves, across and down: -1 the left or top, 1 the right or bottom, 0 neither. */
export type FrameSides = [-1 | 0 | 1, -1 | 0 | 1];

/** How close a dragged edge comes to the opposite one (millimetres). */
const NARROWEST_FRAME = 1;

/** The frame with the edges `sides` names moved by `by`, each stopping a millimetre short of the opposite edge. */
export function draggedFrame(frame: Frame, [across, down]: FrameSides, by: Vector2): Frame {
    let [x0, x1, y0, y1] = [frame.x, frame.x + frame.w, frame.y, frame.y + frame.h];
    if (across < 0) x0 = Math.min(x0 + by.x, x1 - NARROWEST_FRAME);
    if (across > 0) x1 = Math.max(x1 + by.x, x0 + NARROWEST_FRAME);
    if (down < 0) y0 = Math.min(y0 + by.y, y1 - NARROWEST_FRAME);
    if (down > 0) y1 = Math.max(y1 + by.y, y0 + NARROWEST_FRAME);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

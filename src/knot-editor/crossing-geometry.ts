/**
 * Where a picture's strands cross each other and pass across its props, matched to the picture's entries saying
 * which is on top; and each strand as a `RopePath`, with a stretch marked over at each place it goes on top.
 *
 * Matching (as in the plan's Decisions): each crossing found is matched to the entry for its pair of segments and
 * its `n`, counted along the pair's first segment. One with no entry is unset; an entry with no crossing is lost.
 * Where a pair crosses a different number of times than it has entries, all of them are "to check": still drawn as
 * their entries say, by `n`, but no longer trusted to name the same crossings. Passes across props are matched the
 * same way, per segment and prop.
 */

import { over, plain, type RopePath } from "@/knots/rope-path";
import { boxesOverlap } from "@/lib/bezier";
import { bisect } from "@/lib/numeric/roots";
import type { Vector2 } from "@/lib/vector2";

import {
    crossingPair,
    sameSegment,
    segmentBefore,
    strandSize,
    type CrossingAt,
    type PassAt,
    type PassSide,
    type Picture,
    type SegmentRef,
} from "./format";
import {
    DRAWN_WIDTH,
    strandDistance,
    strandPosition,
    type PictureGeometry,
    type StrandGeometry,
} from "./geometry";
import { crossingsAt, passesAt, segmentPlaces } from "./ids";
import { kindOf } from "./props";

export type MatchStatus = "set" | "unset" | "to-check";

/** A place two segments cross. */
export type FoundCrossing = {
    /** The two segments, in the picture's order. */
    pair: [SegmentRef, SegmentRef];
    /** Which of the pair's crossings this is, along its first segment (from 1). */
    n: number;
    /** How far along each of the pair's segments (0 to 1). */
    t: [number, number];
    /** How far along each one's strand. */
    s: [number, number];
    at: Vector2;
    /** The sine of the angle between the two strands there (0 to 1). */
    sin: number;
    status: MatchStatus;
    /** Which of the pair is on top, where an entry says (always when set; when to check, if one has its `n`). */
    over?: 0 | 1;
};

/** A place a segment passes across a prop. */
export type FoundPass = {
    prop: number;
    strand: number;
    segment: number;
    /** Which of the segment's passes across the prop this is (from 1). */
    n: number;
    t: number;
    /** How far along the strand. */
    s: number;
    at: Vector2;
    /** The stretch of strand that covers the prop, from and to (distances along the strand). */
    cover: [number, number];
    status: MatchStatus;
    side?: PassSide;
};

export type PictureCrossings = {
    crossings: FoundCrossing[];
    /** Entries whose pair of segments no longer cross. */
    lost: CrossingAt[];
    /** Pairs crossing a different number of times than they have entries. */
    toCheck: { pair: [SegmentRef, SegmentRef]; entries: CrossingAt[]; found: number }[];
    passes: FoundPass[];
    lostPasses: { prop: number; entry: PassAt }[];
    /** Segments passing a prop a different number of times than they have entries. */
    passesToCheck: {
        prop: number;
        strand: number;
        segment: number;
        entries: PassAt[];
        found: number;
    }[];
};

const pairKey = ([a, b]: [SegmentRef, SegmentRef]) => `${a[0]}.${a[1]}:${b[0]}.${b[1]}`;

/**
 * How entries match what was found: all set when there are as many as found and their `n` run 1 to that number,
 * all lost when nothing was found, unset when there are none, and to check otherwise.
 */
function matchStatus(found: number, ns: number[]): MatchStatus | "lost" {
    if (found === 0) return "lost";
    if (ns.length === 0) return "unset";
    const exact = ns.length === found && [...ns].sort((a, b) => a - b).every((n, k) => n === k + 1);
    return exact ? "set" : "to-check";
}

/** Every crossing between two segments of the picture, matched to its entries, and every pass across its props. */
export function pictureCrossings(picture: Picture, geometry: PictureGeometry): PictureCrossings {
    const segments = geometry.strands.flatMap((strand, i) =>
        strand.segments.map((seg, k) => ({ ref: [i, k] as SegmentRef, seg })),
    );

    // Found, grouped by pair.
    const byPair = new Map<string, FoundCrossing[]>();
    for (let i = 0; i < segments.length; i++)
        for (let j = i + 1; j < segments.length; j++) {
            const [a, b] = [segments[i], segments[j]];
            if (!boxesOverlap(a.seg.box, b.seg.box)) continue;
            const neighbours = a.ref[0] === b.ref[0] && b.ref[1] === a.ref[1] + 1;
            const pair: [SegmentRef, SegmentRef] = [a.ref, b.ref];
            const hits = a.seg.cubic
                .crossings(b.seg.cubic, a.seg.samples, b.seg.samples)
                // Neighbours meet at their shared pin, and that isn't a crossing.
                .filter((hit) => !(neighbours && hit.at.distanceTo(b.seg.cubic.p0) < 1e-6));
            if (!hits.length) continue;
            byPair.set(
                pairKey(pair),
                hits.map((hit, k) => ({
                    pair,
                    n: k + 1,
                    t: [hit.t, hit.u],
                    s: [
                        strandDistance(geometry.strands[a.ref[0]], a.ref[1], hit.t),
                        strandDistance(geometry.strands[b.ref[0]], b.ref[1], hit.u),
                    ],
                    at: hit.at,
                    sin: Math.abs(a.seg.cubic.tangentAt(hit.t).cross(b.seg.cubic.tangentAt(hit.u))),
                    status: "unset",
                })),
            );
        }

    const places = segmentPlaces(picture);
    const entriesByPair = new Map<string, CrossingAt[]>();
    for (const entry of crossingsAt(picture, places)) {
        const key = pairKey(crossingPair(entry));
        entriesByPair.set(key, [...(entriesByPair.get(key) ?? []), entry]);
    }

    const result: PictureCrossings = {
        crossings: [],
        lost: [],
        toCheck: [],
        passes: [],
        lostPasses: [],
        passesToCheck: [],
    };
    for (const key of new Set([...byPair.keys(), ...entriesByPair.keys()])) {
        const found = byPair.get(key) ?? [];
        const entries = entriesByPair.get(key) ?? [];
        const status = matchStatus(
            found.length,
            entries.map((e) => e.n),
        );
        if (status === "lost") {
            const [a, b] = crossingPair(entries[0]);
            // One segment named twice (left by joining two that crossed) can't be lost or matched, only checked.
            if (sameSegment(a, b)) result.toCheck.push({ pair: [a, b], entries, found: 0 });
            else result.lost.push(...entries);
            continue;
        }
        if (status === "to-check")
            result.toCheck.push({ pair: found[0].pair, entries, found: found.length });
        for (const crossing of found) {
            const entry = entries.find((e) => e.n === crossing.n);
            result.crossings.push({
                ...crossing,
                status,
                ...(entry && {
                    over:
                        entry.over[0] === crossing.pair[0][0] &&
                        entry.over[1] === crossing.pair[0][1]
                            ? 0
                            : 1,
                }),
            });
        }
    }
    result.crossings.sort(
        (a, b) =>
            (segmentBefore(a.pair[0], b.pair[0])
                ? -1
                : segmentBefore(b.pair[0], a.pair[0])
                  ? 1
                  : 0) ||
            (segmentBefore(a.pair[1], b.pair[1])
                ? -1
                : segmentBefore(b.pair[1], a.pair[1])
                  ? 1
                  : 0) ||
            a.n - b.n,
    );

    picture.props.forEach((prop, p) => {
        const kind = kindOf(prop);
        const entries = passesAt(picture, p, places);
        geometry.strands.forEach((strand, i) =>
            strand.segments.forEach((seg, k) => {
                const size = strandSize(picture.strands[i]);
                const ts = kind.passesAcross(prop, seg.cubic, seg.samples);
                const mine = entries.filter((e) => e[0] === i && e[1] === k);
                const status = matchStatus(
                    ts.length,
                    mine.map((e) => e[2]),
                );
                if (status === "lost") {
                    result.lostPasses.push(...mine.map((entry) => ({ prop: p, entry })));
                    return;
                }
                if (status === "to-check")
                    result.passesToCheck.push({
                        prop: p,
                        strand: i,
                        segment: k,
                        entries: mine,
                        found: ts.length,
                    });
                ts.forEach((t, j) => {
                    const entry = mine.find((e) => e[2] === j + 1);
                    const s = strandDistance(strand, k, t);
                    result.passes.push({
                        prop: p,
                        strand: i,
                        segment: k,
                        n: j + 1,
                        t,
                        s,
                        at: seg.cubic.pointAt(t),
                        cover: coverAround(
                            strand,
                            s,
                            size,
                            (point) => kind.covers(prop, point, size),
                            kind.across?.(prop),
                        ),
                        status,
                        ...(entry && { side: entry[3] }),
                    });
                });
            }),
        );
    });
    return result;
}

/** The point at a distance along the strand. */
function pointAlong(strand: StrandGeometry, distance: number): Vector2 {
    const { segment, t } = strandPosition(strand, distance);
    return strand.segments[segment].cubic.pointAt(t);
}

/** The strand's direction at a distance along it. */
function directionAlong(strand: StrandGeometry, distance: number): Vector2 {
    const { segment, t } = strandPosition(strand, distance);
    return strand.segments[segment].cubic.tangentAt(t);
}

/**
 * How far along the strand, each way from `s`, `covers` keeps holding: stepped along (a tenth of the strand's size at
 * a time), then bisected. Given the way strands pass `across` the prop, it stops, too, where the strand turns back
 * along it, as a rope wrapped round a bar does at its edge: there one pass ends and the next, on the other side,
 * begins.
 */
function coverAround(
    strand: StrandGeometry,
    s: number,
    size: number,
    covers: (point: Vector2) => boolean,
    across?: Vector2,
): [number, number] {
    const STEP = 0.1 * size;
    const way0 = across && Math.sign(directionAlong(strand, s).dot(across));
    const holds = (distance: number) =>
        covers(pointAlong(strand, distance)) &&
        (!across || Math.sign(directionAlong(strand, distance).dot(across)) === way0);
    const edge = (way: 1 | -1) => {
        let [inside, outside] = [s, s];
        for (;;) {
            const next = inside + way * STEP;
            if (next <= 0 || next >= strand.length) return way > 0 ? strand.length : 0;
            if (!holds(next)) {
                outside = next;
                break;
            }
            inside = next;
        }
        return bisect(holds, inside, outside, 20)[1];
    };
    return [edge(-1), edge(1)];
}

// Over stretches

/** Half a strand's drawn width, with its outline (in its sizes). */
const HALF_WIDTH = DRAWN_WIDTH / 2;

/** How much of their ends two stretches may share (millimetres): passes meeting at a turn, found by bisection. */
const SHARED = 1e-3;

/** The sine of the shallowest angle the over stretches allow for; shallower crossings are treated as this. */
const SHALLOWEST = 0.15;

/**
 * How far along a strand of this size going over a crossing it's marked over, each way: the old editor's
 * angle-dependent amount (in strand sizes), longer at a shallow crossing.
 */
export const overReach = (sin: number, size = 1) =>
    size * Math.min(4, 0.75 + 0.6 / Math.max(sin, SHALLOWEST));

/**
 * How far along a strand (of size `own`), each way from a crossing, it must be for its square-cut end to be clear of
 * the other strand (of size `other`): the other's half-width, and its own half-width turned by the angle between
 * them, over the sine of that angle. An over stretch must reach at least this far past its own crossing, and stop at
 * least this short of a crossing where its strand goes under.
 */
export const clearance = (sin: number, own = 1, other = 1) =>
    (HALF_WIDTH * (other + own * Math.sqrt(1 - sin * sin))) / Math.max(sin, SHALLOWEST);

/** Where along a strand it goes under: at a crossing (with the clearance it needs) or behind a prop (its cover). */
type Under = { from: number; to: number };

/** A stretch a strand wants marked over: where it's centred, how far it reaches, and how far it must. */
type Want = {
    at: number;
    from: number;
    to: number;
    need: [number, number];
    crossing?: number;
    pass?: number;
};

export type StrandPaths = {
    paths: RopePath[];
    /** Crossings (indices into `crossings.crossings`) too close to another for their over stretches to fit. */
    tooClose: number[];
    /** Passes (indices into `crossings.passes`) whose over stretch can't cover the prop. */
    tooClosePasses: number[];
};

/** A coordinate as written in path data, rounded as `rope-drawing.tsx` rounds for drawing. */
const coordinate = (value: number) => Math.round(value * 1e4) / 1e4 || 0;
const pointText = (p: Vector2) => `${coordinate(p.x)} ${coordinate(p.y)}`;

/** The strand from one distance along it to another, as `C` commands, one per piece of each segment. */
function curvesBetween(strand: StrandGeometry, from: number, to: number): string {
    const [a, b] = [strandPosition(strand, from), strandPosition(strand, to)];
    const commands: string[] = [];
    for (let k = a.segment; k <= b.segment; k++) {
        const [t0, t1] = [k === a.segment ? a.t : 0, k === b.segment ? b.t : 1];
        if (t1 - t0 < 1e-9) continue;
        const piece = strand.segments[k].cubic.between(t0, t1);
        commands.push(`C ${pointText(piece.p1)}, ${pointText(piece.p2)}, ${pointText(piece.p3)}`);
    }
    return commands.join(" ");
}

/** The strand from one distance along it to another, as path data from its `M`. */
export const pathBetween = (strand: StrandGeometry, from: number, to: number) =>
    `M ${pointText(pointAlong(strand, from))} ${curvesBetween(strand, from, to)}`;

/**
 * Each strand as a `RopePath`: one `C` per Bézier, split where an over stretch starts and ends. A strand is marked
 * over the angle-dependent reach either side of each crossing where it's on top, and across each prop it passes in
 * front of. A stretch stops short of any crossing where its strand goes under and of any pass where it goes behind,
 * and stretches that overlap are merged. Where a stretch can't then reach as far as it must, its crossing (and the
 * one that cut it short) is too close.
 */
export function strandPaths(
    picture: Picture,
    geometry: PictureGeometry,
    crossings: PictureCrossings,
): StrandPaths {
    const tooClose = new Set<number>();
    const tooClosePasses = new Set<number>();
    const sizes = picture.strands.map(strandSize);
    const paths = geometry.strands.map((strand, i) => {
        const wants: Want[] = [];
        const unders: (Under & { crossing?: number; pass?: number })[] = [];
        crossings.crossings.forEach((c, index) =>
            c.pair.forEach((ref, side) => {
                if (ref[0] !== i || c.over === undefined) return;
                const s = c.s[side];
                const [own, other] = [sizes[i], sizes[c.pair[1 - side][0]]];
                if (c.over === side) {
                    const need = clearance(c.sin, own, other);
                    // Never short of clearing the other strand, as over a thicker one it would be.
                    const reach = Math.max(overReach(c.sin, own), need);
                    wants.push({
                        at: s,
                        from: s - reach,
                        to: s + reach,
                        need: [s - need, s + need],
                        crossing: index,
                    });
                } else {
                    const gap = clearance(c.sin, own, other);
                    unders.push({ from: s - gap, to: s + gap, crossing: index });
                }
            }),
        );
        crossings.passes.forEach((p, index) => {
            if (p.strand !== i || p.side === undefined) return;
            if (p.side === "front")
                wants.push({
                    at: p.s,
                    from: p.cover[0],
                    to: p.cover[1],
                    need: p.cover,
                    pass: index,
                });
            else unders.push({ from: p.cover[0], to: p.cover[1], pass: index });
        });

        const flag = (item: { crossing?: number; pass?: number }) => {
            if (item.crossing !== undefined) tooClose.add(item.crossing);
            if (item.pass !== undefined) tooClosePasses.add(item.pass);
        };
        const stretches: [number, number][] = [];
        for (const want of wants) {
            let [from, to] = [Math.max(0, want.from), Math.min(strand.length, want.to)];
            const [needFrom, needTo] = [
                Math.max(0, want.need[0]),
                Math.min(strand.length, want.need[1]),
            ];
            // Where it's under within the stretch it must have, it doesn't fit. Two passes meeting where a strand turns
            // back round a prop share only their ends, found by bisection, so they're allowed that much.
            const inTheWay = unders.filter(
                (u) => u.from < needTo - SHARED && u.to > needFrom + SHARED,
            );
            let inside = false;
            for (const under of unders) {
                if (under.to <= want.at) from = Math.max(from, under.to);
                else if (under.from >= want.at) to = Math.min(to, under.from);
                else inside = true;
            }
            if (inTheWay.length) [want, ...inTheWay].forEach(flag);
            if (!inside && to > from) stretches.push([from, to]);
        }
        stretches.sort((a, b) => a[0] - b[0]);
        const merged: [number, number][] = [];
        for (const r of stretches)
            if (merged.length && r[0] <= merged[merged.length - 1][1])
                merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], r[1]);
            else merged.push([...r]);

        const path: RopePath = [];
        const start = `M ${pointText(strand.segments[0].cubic.p0)} `;
        const add = (from: number, to: number, isOver: boolean) => {
            if (to - from < 1e-9) return;
            const d = (path.length ? "" : start) + curvesBetween(strand, from, to);
            path.push(isOver ? over(d) : plain(d));
        };
        let at = 0;
        for (const [from, to] of merged) {
            add(at, from, false);
            add(from, to, true);
            at = to;
        }
        add(at, strand.length, false);
        return path;
    });
    return {
        paths,
        tooClose: [...tooClose].sort((a, b) => a - b),
        tooClosePasses: [...tooClosePasses].sort((a, b) => a - b),
    };
}

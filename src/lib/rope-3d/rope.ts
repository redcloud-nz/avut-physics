import type { Vector3 } from "@/lib/vector3";

/**
 * A rope in 3D as the knot editor works on it: its centreline's points (metres) and each point's segment. Segments are
 * numbered from 1 at the rope's start, each a run of neighbouring points, every number from 1 to the last with at least
 * one point. A point keeps its segment as rope is added, taken up or slides through a knot, so a segment is a piece of
 * the rope itself, not a place in the knot.
 */
export type Rope3 = { points: Vector3[]; seg: number[] };

/** A straight bar the rope can't pass through: its axis through `at` along `along` (a unit vector), `r` in radius. */
export type Bar = { at: Vector3; along: Vector3; r: number };

/** What the rope's made of and what it's round: lengths in metres. */
export type RopeSetup = {
    diameter: number;
    /** The tightest it bends: the radius of its centreline round the bend. */
    minBend: number;
    /** How much it straightens each step, 0 to 1. */
    stiffness: number;
    bars: Bar[];
};

/** How far along a run of points each one is, from the first. */
export function arcLengths(points: readonly Vector3[]): number[] {
    const out = [0];
    for (let i = 1; i < points.length; i++)
        out.push(out[i - 1] + points[i].distanceTo(points[i - 1]));
    return out;
}

/** The point `s` along a run of points (`arc` its arc lengths), clamped to its ends. */
export function pointAt(points: readonly Vector3[], arc: readonly number[], s: number): Vector3 {
    if (s <= 0) return points[0];
    const last = points.length - 1;
    if (s >= arc[last]) return points[last];
    let [lo, hi] = [0, last];
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (arc[mid] <= s) lo = mid;
        else hi = mid;
    }
    const piece = arc[hi] - arc[lo];
    return points[lo].lerp(points[hi], piece > 0 ? (s - arc[lo]) / piece : 0);
}

/** How long each piece between neighbouring points usually is: the median, so a few short or long pieces don't count. */
export function spacingOf(points: readonly Vector3[]): number {
    const pieces = points.slice(1).map((p, i) => p.distanceTo(points[i]));
    pieces.sort((a, b) => a - b);
    return pieces[Math.floor(pieces.length / 2)] ?? 0;
}

/** Each point's segment from how many points each segment has, in order. */
export function segFromCounts(counts: readonly number[]): number[] {
    return counts.flatMap((count, k) => Array.from({ length: count }, () => k + 1));
}

/** How many points each segment has, in order. */
export function countsOf(seg: readonly number[]): number[] {
    const counts: number[] = [];
    for (const s of seg) counts[s - 1] = (counts[s - 1] ?? 0) + 1;
    return counts;
}

/** How many segments a rope has. */
export const segmentCount = (rope: Rope3) => rope.seg.at(-1) ?? 0;

/** The first and last point of segment `k`. */
export function pointsOf(rope: Rope3, k: number): [number, number] {
    return [rope.seg.indexOf(k), rope.seg.lastIndexOf(k)];
}

/**
 * Where segment `k` starts and ends along the rope: halfway between its first point and the one before it, and its
 * last and the one after (the rope's own ends at its ends).
 */
export function segmentSpan(
    rope: Rope3,
    k: number,
    arc = arcLengths(rope.points),
): [number, number] {
    const [a, b] = pointsOf(rope, k);
    const start = a > 0 ? (arc[a - 1] + arc[a]) / 2 : 0;
    const end = b < arc.length - 1 ? (arc[b] + arc[b + 1]) / 2 : arc[b];
    return [start, end];
}

/** Segment `k`'s centre: the point halfway along it. */
export function segmentCentre(rope: Rope3, k: number): Vector3 {
    const arc = arcLengths(rope.points);
    const [start, end] = segmentSpan(rope, k, arc);
    return pointAt(rope.points, arc, (start + end) / 2);
}

/**
 * Segment `k`'s middle by its points: halfway between its first and last point, counting points rather than length.
 * It's where the 3D knot editor's handle is, and the point a move of the handle steers.
 */
export function segmentMiddle(rope: Rope3, k: number): Vector3 {
    const [a, b] = pointsOf(rope, k);
    const c = (a + b) / 2;
    const i = Math.floor(c);
    return i === c ? rope.points[i] : rope.points[i].lerp(rope.points[i + 1], c - i);
}

/** Segment `k`'s length along the rope. */
export function segmentLength(rope: Rope3, k: number): number {
    const [start, end] = segmentSpan(rope, k);
    return end - start;
}

/**
 * Each point's segment, counting from 1 at the start: a new segment every `every` along the rope (metres), the last
 * one taking whatever's left.
 */
export function segmentsOf(points: readonly Vector3[], every: number): number[] {
    const arc = arcLengths(points);
    const total = arc.at(-1)!;
    const count = Math.max(1, Math.round(total / every));
    return evenly(arc, count);
}

/** Points at arc lengths `arc` shared between `count` segments, each the same length along the rope. */
function evenly(arc: readonly number[], count: number): number[] {
    const total = arc.at(-1)!;
    const seg = arc.map((s) => Math.min(count, 1 + Math.floor((s / total) * count)));
    return withEveryNumber(seg, count);
}

/**
 * `seg` with every number from 1 to `count` given at least one point, where there are enough points: a number with
 * none takes a point from its neighbour. Segments stay in order.
 */
function withEveryNumber(seg: number[], count: number): number[] {
    if (seg.length < count) return seg;
    const counts = Array.from({ length: count }, (_, k) => seg.filter((s) => s === k + 1).length);
    // Take from the fullest neighbouring segments until every one has a point.
    for (let k = 0; k < count; k++) {
        while (counts[k] === 0) {
            let from = -1;
            for (let j = 0; j < count; j++)
                if (counts[j] > 1 && (from < 0 || Math.abs(j - k) < Math.abs(from - k))) from = j;
            if (from < 0) break;
            const step = from > k ? -1 : 1;
            // Moving a point from `from` towards `k` passes one along each segment between them.
            for (let j = from; j !== k; j += step) {
                counts[j]--;
                counts[j + step]++;
            }
        }
    }
    return segFromCounts(counts);
}

/** The rope with every segment boundary laid out evenly along it as it is now. Numbers stay in order. */
export function redistribute(rope: Rope3): Rope3 {
    return { points: rope.points, seg: evenly(arcLengths(rope.points), segmentCount(rope)) };
}

/**
 * The rope with the boundary after segment `k` slid `by` points along it (towards the rope's end when positive), each
 * segment either side keeping at least one point.
 */
export function slideBoundary(rope: Rope3, k: number, by: number): Rope3 {
    const counts = countsOf(rope.seg);
    if (k < 1 || k >= counts.length) return rope;
    const moved = Math.max(-(counts[k - 1] - 1), Math.min(counts[k] - 1, by));
    counts[k - 1] += moved;
    counts[k] -= moved;
    return { points: rope.points, seg: segFromCounts(counts) };
}

/**
 * A run of points (each in its segment) laid out again `spacing` apart from its first point to its last, which stay
 * where they are. Each segment keeps its share of the run: the boundaries between them stay the same fraction of the way
 * along it. At least as many pieces as it takes for every segment to keep a point.
 */
export function respaceRun(
    points: readonly Vector3[],
    seg: readonly number[],
    spacing: number,
): Rope3 {
    const arc = arcLengths(points);
    const total = arc.at(-1)!;
    const first = seg[0];
    const last = seg.at(-1)!;
    const count = Math.max(1, Math.round(total / spacing), last - first + 2);
    const out: Vector3[] = [];
    for (let k = 0; k <= count; k++) out.push(pointAt(points, arc, (total * k) / count));
    // The boundaries' places along the run, as fractions, and the new points shared out between them.
    const starts = new Map<number, number>();
    for (let i = 1; i < seg.length; i++)
        if (seg[i] !== seg[i - 1]) starts.set(seg[i], (arc[i - 1] + arc[i]) / 2 / (total || 1));
    const outSeg = out.map((_, k) => {
        const u = k / count;
        let s = first;
        for (let n = first + 1; n <= last; n++) if ((starts.get(n) ?? 1) <= u) s = n;
        return s;
    });
    // The run's ends keep their own segments.
    outSeg[0] = first;
    outSeg[count] = last;
    return { points: out, seg: shareOut(outSeg, first, last) };
}

/** `seg` (numbers `first` to `last`, in order) with each number given at least one point, where there are enough. */
function shareOut(seg: number[], first: number, last: number): number[] {
    const shifted = withEveryNumber(
        seg.map((s) => s - first + 1),
        last - first + 1,
    );
    return shifted.map((s) => s + first - 1);
}

/**
 * The rope with each run of points that isn't `kept` laid out again `spacing` apart (`respaceRun`), between the kept
 * points either side of it (or the rope's end), which stay exactly where they are.
 */
export function respaceFree(rope: Rope3, kept: readonly boolean[], spacing: number): Rope3 {
    const points: Vector3[] = [];
    const seg: number[] = [];
    const n = rope.points.length;
    let i = 0;
    while (i < n) {
        if (kept[i]) {
            points.push(rope.points[i]);
            seg.push(rope.seg[i]);
            i++;
            continue;
        }
        // A free run from i to j - 1, laid out from the kept point before it to the kept one after (or the rope's ends).
        let j = i;
        while (j < n && !kept[j]) j++;
        const from = i > 0 ? i - 1 : i;
        const to = j < n ? j : n - 1;
        const run = respaceRun(
            rope.points.slice(from, to + 1),
            rope.seg.slice(from, to + 1),
            spacing,
        );
        // Its ends are the kept points (pushed on their own) or the rope's own ends.
        const start = i > 0 ? 1 : 0;
        const end = j < n ? run.points.length - 1 : run.points.length;
        points.push(...run.points.slice(start, end));
        seg.push(...run.seg.slice(start, end));
        i = j < n ? j : n;
    }
    return { points, seg };
}

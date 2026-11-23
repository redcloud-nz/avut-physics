import { vec3, type Vector3 } from "@/lib/vector3";

import { tightenKnot } from "./knot-tighten";

/**
 * Changes made by hand to a tightened knot, a few segments at a time: the segments named are in play and move, and
 * everything else stays where it is, in their way. Each point of the rope keeps the number of the segment it's in, so
 * the numbers stay put as rope's added.
 */

/** A knot as it's saved: its rope's points (metres), each point's segment, and the bar it's tied round. */
export type KnotState = {
    bar: { at: { x: number; y: number; z: number }; r: number };
    pts: [number, number, number][];
    seg?: number[];
};

/** Each point's segment, counting from 1 at the start: a new segment every `every` along the rope (metres). */
export function segmentsOf(points: Vector3[], every: number): number[] {
    const seg: number[] = [];
    let [along, n] = [0, 1];
    for (let i = 0; i < points.length; i++) {
        if (i > 0) along += points[i].distanceTo(points[i - 1]);
        if (along >= every && i < points.length - 1) [along, n] = [0, n + 1];
        seg.push(n);
    }
    return seg;
}

/** How far along a run of points each one is. */
const distances = (points: Vector3[]) => {
    const out = [0];
    for (let i = 1; i < points.length; i++)
        out.push(out[i - 1] + points[i].distanceTo(points[i - 1]));
    return out;
};

/**
 * `state` with the segments `play` in play: segment `target`'s centre moved `by` (metres), the move easing off to
 * nothing at the centres of the segments in play either side of it, the stretch in play given as much more rope as
 * that takes (at the rope's spacing), then let settle among everything else, which stays put.
 */
export function moveSegment(
    state: KnotState,
    {
        play,
        target,
        by,
        diameter,
        every = 0.02,
    }: {
        play: number[];
        target: number;
        by: Vector3;
        diameter: number;
        every?: number;
    },
): KnotState {
    const points = state.pts.map(([x, y, z]) => vec3(x, y, z));
    const seg = state.seg ?? segmentsOf(points, every);
    const inPlay = (i: number) => play.includes(seg[i]);
    const a = seg.findIndex((s) => play.includes(s));
    const b = seg.findLastIndex((s) => play.includes(s));
    const along = distances(points);
    // Each segment's centre, halfway along it.
    const centre = (k: number) => {
        const [i0, i1] = [seg.indexOf(k), seg.lastIndexOf(k)];
        return (along[i0] + along[i1]) / 2;
    };
    const mid = centre(target);
    const before = play.filter((k) => k < target);
    const after = play.filter((k) => k > target);
    const from = before.length ? centre(Math.max(...before)) : along[a];
    const to = after.length ? centre(Math.min(...after)) : along[b];
    const ease = (t: number) => t * t * (3 - 2 * t);
    const weight = (s: number) =>
        s <= from || s >= to
            ? 0
            : s < mid
              ? ease((s - from) / (mid - from))
              : ease((to - s) / (to - mid));
    const moved = points.map((p, i) => (inPlay(i) ? p.add(by.scale(weight(along[i]))) : p));

    // The stretch in play, from the fixed point before it to the one after, laid out again at the rope's spacing.
    const spacing = along.at(-1)! / (points.length - 1);
    const [lo, hi] = [Math.max(0, a - 1), Math.min(points.length - 1, b + 1)];
    const stretch = moved.slice(lo, hi + 1);
    const ds = distances(stretch);
    const count = Math.max(2, Math.round(ds.at(-1)! / spacing));
    const fresh: Vector3[] = [];
    const freshSeg: number[] = [];
    for (let k = 1; k < count; k++) {
        const s = (ds.at(-1)! * k) / count;
        let j = 1;
        while (j < ds.length - 1 && ds[j] < s) j++;
        const t = (s - ds[j - 1]) / (ds[j] - ds[j - 1] || 1);
        fresh.push(stretch[j - 1].lerp(stretch[j], t));
        freshSeg.push(seg[lo + (t < 0.5 ? j - 1 : j)]);
    }
    const nextPoints = [...moved.slice(0, lo + 1), ...fresh, ...moved.slice(hi)];
    const nextSeg = [...seg.slice(0, lo + 1), ...freshSeg, ...seg.slice(hi)];
    const fixed = nextSeg.map(
        (s, i) => !(play.includes(s) && i > lo && i < nextPoints.length - (points.length - hi)),
    );
    const bar = { at: vec3(state.bar.at.x, state.bar.at.y, state.bar.at.z), r: state.bar.r };
    const settled = tightenKnot(nextPoints, { diameter, bar, fixed, steps: 300 });
    return { bar: state.bar, pts: settled.map((p) => [p.x, p.y, p.z]), seg: nextSeg };
}

/** A stretch of rope laid out again `spacing` apart, from its first point to its last, each new point in the segment of
 * the old one it's nearest along it. */
function respaced(
    points: Vector3[],
    seg: number[],
    spacing: number,
): { points: Vector3[]; seg: number[] } {
    const ds = distances(points);
    const count = Math.max(1, Math.round(ds.at(-1)! / spacing));
    const out: Vector3[] = [];
    const outSeg: number[] = [];
    for (let k = 0; k <= count; k++) {
        const s = (ds.at(-1)! * k) / count;
        let j = 1;
        while (j < ds.length - 1 && ds[j] < s) j++;
        const t = (s - ds[j - 1]) / (ds[j] - ds[j - 1] || 1);
        out.push(points[j - 1].lerp(points[j], t));
        outSeg.push(seg[t < 0.5 ? j - 1 : j]);
    }
    return { points: out, seg: outSeg };
}

/**
 * `state` with the segments `play` free and the rope in `tighten` (some of them) drawn up: shortened a little at a
 * time while it's kept off itself, the bar and everything fixed, until it's jammed and gets no shorter; then the
 * stretch in play laid out again at the rope's spacing.
 */
export function tightenSegments(
    state: KnotState,
    {
        play,
        tighten,
        diameter,
        every = 0.02,
    }: {
        play: number[];
        tighten: number[];
        diameter: number;
        every?: number;
    },
): KnotState {
    const points = state.pts.map(([x, y, z]) => vec3(x, y, z));
    const seg = state.seg ?? segmentsOf(points, every);
    const spacing = distances(points).at(-1)! / (points.length - 1);
    const fixed = seg.map((s) => !play.includes(s));
    const shrinking = points
        .slice(1)
        .map((_, i) => tighten.includes(seg[i]) && tighten.includes(seg[i + 1]));
    const stretchLength = (ps: Vector3[]) =>
        ps.slice(1).reduce((sum, p, i) => (shrinking[i] ? sum + p.distanceTo(ps[i]) : sum), 0);
    let last = stretchLength(points);
    const bar = { at: vec3(state.bar.at.x, state.bar.at.y, state.bar.at.z), r: state.bar.r };
    const tight = tightenKnot(points, {
        diameter,
        bar,
        fixed,
        shrink: 2e-3,
        shrinking,
        steps: 3000,
        stop: (ps) => {
            const now = stretchLength(ps);
            const done = last - now < 2e-4;
            last = now;
            return done;
        },
    });
    // The stretch in play, from the fixed point before it to the one after, at the rope's spacing again.
    const a = seg.findIndex((s) => play.includes(s));
    const b = seg.findLastIndex((s) => play.includes(s));
    const [lo, hi] = [Math.max(0, a - 1), Math.min(points.length - 1, b + 1)];
    const again = respaced(tight.slice(lo, hi + 1), seg.slice(lo, hi + 1), spacing);
    const nextPoints = [...tight.slice(0, lo), ...again.points, ...tight.slice(hi + 1)];
    const nextSeg = [...seg.slice(0, lo), ...again.seg, ...seg.slice(hi + 1)];
    return { bar: state.bar, pts: nextPoints.map((p) => [p.x, p.y, p.z]), seg: nextSeg };
}

/**
 * `state` with the segments `play` let settle as a stiffer rope (`stiffness`, 0 to 1), so sharp bends there ease out,
 * kept off everything else, which stays put. No rope's taken up or given.
 */
export function smoothSegments(
    state: KnotState,
    {
        play,
        diameter,
        stiffness = 0.2,
        every = 0.02,
    }: {
        play: number[];
        diameter: number;
        stiffness?: number;
        every?: number;
    },
): KnotState {
    const points = state.pts.map(([x, y, z]) => vec3(x, y, z));
    const seg = state.seg ?? segmentsOf(points, every);
    const fixed = seg.map((s) => !play.includes(s));
    const bar = { at: vec3(state.bar.at.x, state.bar.at.y, state.bar.at.z), r: state.bar.r };
    const settled = tightenKnot(points, { diameter, bar, fixed, stiffness, steps: 400 });
    return { bar: state.bar, pts: settled.map((p) => [p.x, p.y, p.z]), seg };
}

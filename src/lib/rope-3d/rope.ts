import type { Vector3 } from "@/lib/vector3";

/** A rope in 3D as points (metres) along its centreline, the bars it's round, and how far along it each point is. */

/** A straight bar the rope can't pass through: its axis through `at` along `along` (a unit vector), `r` in radius. */
export type Bar = { at: Vector3; along: Vector3; r: number };

/**
 * A curved bar the rope can't pass through, closed round on itself, as a carabiner is: its middle line through `points`
 * (the last point back at the first) and `r` in radius. Being closed, a rope through it can't slip off its end.
 */
export type Loop = { points: Vector3[]; r: number };

/** What the rope's made of and what it's round: lengths in metres. */
export type RopeSetup = {
    diameter: number;
    /** The tightest it bends: the radius of its centreline round the bend. */
    minBend: number;
    /** How much it straightens each step, 0 to 1. */
    stiffness: number;
    bars: Bar[];
    /** Closed bars it's round, if any. */
    loops?: Loop[];
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

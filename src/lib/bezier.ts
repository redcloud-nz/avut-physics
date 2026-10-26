/**
 * Cubic Bézier curves on `Vector2`: points and derivatives along them, splitting, length, curvature, bounding boxes
 * and where two of them cross. Like `Vector2`, a `Cubic` is immutable, and every operation returns a new one.
 */

import { segmentIntersection } from "./geometry";
import { clamp } from "./math";
import { goldenSection } from "./numeric/minimise";
import { bisect, rootsInUnit } from "./numeric/roots";
import { Vector2 } from "./vector2";

/** An axis-aligned box: its least and greatest corners. */
export type Box = { min: Vector2; max: Vector2 };

/** Whether two boxes overlap, or come within `margin` of each other. */
export const boxesOverlap = (a: Box, b: Box, margin = 0) =>
    a.min.x <= b.max.x + margin &&
    b.min.x <= a.max.x + margin &&
    a.min.y <= b.max.y + margin &&
    b.min.y <= a.max.y + margin;

/** Where two cubics cross: how far along each (t on the first, u on the second) and the point. */
export type CubicCrossing = { t: number; u: number; at: Vector2 };

/** Eight-point Gauss–Legendre nodes on [-1, 1] and their weights. */
const GAUSS_NODES = [
    -0.9602898564975363, -0.7966664774136267, -0.525532409916329, -0.1834346424956498,
    0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363,
];
const GAUSS_WEIGHTS = [
    0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.362683783378362,
    0.362683783378362, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763,
];

/** How many pieces a length is split into, each integrated with the eight Gauss–Legendre points. */
const LENGTH_PIECES = 4;

/** How many places curvature is sampled at before the tightest is refined. */
const CURVATURE_SAMPLES = 32;

/** How far past each end (along it, 0 to 1) a polyline's piece is looked along for crossings. */
export const POLYLINE_TOLERANCE = 1e-9;

/** A cubic Bézier curve from `p0` to `p3`, with control points `p1` and `p2`. */
export class Cubic {
    constructor(
        readonly p0: Vector2,
        readonly p1: Vector2,
        readonly p2: Vector2,
        readonly p3: Vector2,
    ) {}

    /** The straight line from a to b as a cubic, its control points a third of the way along from each end. */
    static line(a: Vector2, b: Vector2): Cubic {
        const third = b.sub(a).scale(1 / 3);
        return new Cubic(a, a.add(third), b.sub(third), b);
    }

    /** The point at t (0 to 1). */
    pointAt(t: number): Vector2 {
        const u = 1 - t;
        return this.p0
            .scale(u * u * u)
            .add(this.p1.scale(3 * u * u * t))
            .add(this.p2.scale(3 * u * t * t))
            .add(this.p3.scale(t * t * t));
    }

    /** The first derivative at t: the curve's velocity, along it. */
    derivativeAt(t: number): Vector2 {
        const u = 1 - t;
        return this.p1
            .sub(this.p0)
            .scale(3 * u * u)
            .add(this.p2.sub(this.p1).scale(6 * u * t))
            .add(this.p3.sub(this.p2).scale(3 * t * t));
    }

    /** The second derivative at t. */
    secondDerivativeAt(t: number): Vector2 {
        const a = this.p2.sub(this.p1.scale(2)).add(this.p0);
        const b = this.p3.sub(this.p2.scale(2)).add(this.p1);
        return a.scale(6 * (1 - t)).add(b.scale(6 * t));
    }

    /** The unit vector along the curve at t, or `fallback` where it has no speed. */
    tangentAt(t: number, fallback = new Vector2(1, 0)): Vector2 {
        return this.derivativeAt(t).safeUnit(fallback);
    }

    /** The curve split at t (de Casteljau): the part before and the part after, meeting at the point at t. */
    split(t: number): [Cubic, Cubic] {
        const [a, b, c] = [
            this.p0.lerp(this.p1, t),
            this.p1.lerp(this.p2, t),
            this.p2.lerp(this.p3, t),
        ];
        const [d, e] = [a.lerp(b, t), b.lerp(c, t)];
        const f = d.lerp(e, t);
        return [new Cubic(this.p0, a, d, f), new Cubic(f, e, c, this.p3)];
    }

    /** The part of the curve from t0 to t1. */
    between(t0: number, t1: number): Cubic {
        const after = t0 > 0 ? this.split(t0)[1] : this;
        if (t1 >= 1) return after;
        return after.split((t1 - t0) / (1 - t0))[0];
    }

    /** The length from the start to t, by Gauss–Legendre quadrature of the speed in a few pieces. */
    lengthTo(t: number): number {
        let sum = 0;
        const h = t / LENGTH_PIECES;
        for (let k = 0; k < LENGTH_PIECES; k++) {
            const mid = h * (k + 0.5);
            for (let i = 0; i < GAUSS_NODES.length; i++)
                sum += GAUSS_WEIGHTS[i] * this.derivativeAt(mid + (h / 2) * GAUSS_NODES[i]).len();
        }
        return (sum * h) / 2;
    }

    /** The whole curve's length. */
    length(): number {
        return this.lengthTo(1);
    }

    /**
     * The t at `distance` along the curve from its start (clamped to the curve): Newton's method on the length,
     * kept within a bracket that bisects when a step would leave it.
     */
    tAtLength(distance: number, total = this.length()): number {
        if (distance <= 0) return 0;
        if (distance >= total) return 1;
        let [lo, hi] = [0, 1];
        let t = distance / total;
        for (let k = 0; k < 30; k++) {
            const miss = this.lengthTo(t) - distance;
            if (Math.abs(miss) < 1e-10) break;
            if (miss > 0) hi = t;
            else lo = t;
            const next = t - miss / this.derivativeAt(t).len();
            t = next > lo && next < hi ? next : (lo + hi) / 2;
        }
        return t;
    }

    /**
     * The signed curvature at t: positive where the curve turns from x towards y. 0 where it has no speed, as at a
     * straight segment's ends.
     */
    curvatureAt(t: number): number {
        const d1 = this.derivativeAt(t);
        const speed = d1.len();
        if (speed < 1e-12) return 0;
        return d1.cross(this.secondDerivativeAt(t)) / speed ** 3;
    }

    /** The tightest bend along the curve: the least radius of curvature and where it is. Infinite for a line. */
    tightest(): { radius: number; t: number } {
        const bend = (t: number) => Math.abs(this.curvatureAt(t));
        let best = 0;
        for (let k = 1; k <= CURVATURE_SAMPLES; k++)
            if (bend(k / CURVATURE_SAMPLES) > bend(best / CURVATURE_SAMPLES)) best = k;
        const [lo, hi] = goldenSection(
            (t) => -bend(t),
            Math.max(0, (best - 1) / CURVATURE_SAMPLES),
            Math.min(1, (best + 1) / CURVATURE_SAMPLES),
            40,
        );
        const t = (lo + hi) / 2;
        const sharpest = Math.max(bend(t), bend(best / CURVATURE_SAMPLES));
        return { radius: sharpest > 0 ? 1 / sharpest : Infinity, t };
    }

    /**
     * The stretches of the curve bending tighter than `radius`, as ranges of t: sampled, with each end found by
     * bisection.
     */
    tighterThan(radius: number): [number, number][] {
        const tight = (t: number) => Math.abs(this.curvatureAt(t)) * radius > 1;
        const n = CURVATURE_SAMPLES * 2;
        const ranges: [number, number][] = [];
        let start: number | null = tight(0) ? 0 : null;
        for (let k = 1; k <= n; k++) {
            const [a, b] = [(k - 1) / n, k / n];
            const now = tight(b);
            if (now && start === null) start = bisect((t) => !tight(t), a, b, 30)[1];
            if (!now && start !== null) {
                ranges.push([start, bisect(tight, a, b, 30)[0]]);
                start = null;
            }
        }
        if (start !== null) ranges.push([start, 1]);
        return ranges;
    }

    /** The smallest box holding the whole curve, from its ends and wherever x or y turns back. */
    bounds(): Box {
        const ts = [0, 1];
        for (const axis of ["x", "y"] as const) {
            const [a, b, c, d] = [this.p0[axis], this.p1[axis], this.p2[axis], this.p3[axis]];
            // The derivative over 3: (-a + 3b - 3c + d) t² + 2 (a - 2b + c) t + (b - a).
            ts.push(...rootsInUnit(-a + 3 * b - 3 * c + d, 2 * (a - 2 * b + c), b - a));
        }
        const points = ts.map((t) => this.pointAt(t));
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        return {
            min: new Vector2(Math.min(...xs), Math.min(...ys)),
            max: new Vector2(Math.max(...xs), Math.max(...ys)),
        };
    }

    /** `count` + 1 points along the curve, evenly spaced in t, from its start to its end. */
    points(count: number): Vector2[] {
        return Array.from({ length: count + 1 }, (_, k) =>
            k === count ? this.p3 : k === 0 ? this.p0 : this.pointAt(k / count),
        );
    }

    /** The place on the curve nearest a point: the nearest of its samples, then golden-section search round it. */
    nearest(point: Vector2): { t: number; distance: number } {
        const n = this.pieces();
        const samples = this.points(n);
        let best = 0;
        samples.forEach((p, k) => {
            if (p.distanceTo(point) < samples[best].distanceTo(point)) best = k;
        });
        const [lo, hi] = goldenSection(
            (t) => this.pointAt(t).distanceTo(point),
            Math.max(0, (best - 1) / n),
            Math.min(1, (best + 1) / n),
            40,
        );
        const t = (lo + hi) / 2;
        return { t, distance: this.pointAt(t).distanceTo(point) };
    }

    /** How many pieces to sample the curve in for finding crossings: about `spacing` long each, at least 8. */
    pieces(spacing = 0.25): number {
        const rough =
            this.p0.distanceTo(this.p1) + this.p1.distanceTo(this.p2) + this.p2.distanceTo(this.p3);
        return Math.max(8, Math.ceil(rough / spacing));
    }

    /**
     * Where this curve and `other` cross. Each is sampled as a polyline (or given its samples, evenly spaced in t,
     * from `points`), the polylines' crossings found with `segmentIntersection`, and each refined to t and u by
     * Newton's method on the two curves meeting. A crossing at this curve's end, or at `other`'s end, isn't found.
     * The polylines' crossings are looked for with a little tolerance, so one at a shared point isn't lost to rounding.
     */
    crossings(
        other: Cubic,
        mine: Vector2[] = this.points(this.pieces()),
        theirs: Vector2[] = other.points(other.pieces()),
    ): CubicCrossing[] {
        const found: CubicCrossing[] = [];
        const [m, n] = [mine.length - 1, theirs.length - 1];
        for (let i = 0; i < m; i++)
            for (let j = 0; j < n; j++) {
                const hit = segmentIntersection(
                    mine[i],
                    mine[i + 1],
                    theirs[j],
                    theirs[j + 1],
                    POLYLINE_TOLERANCE,
                );
                if (!hit) continue;
                const refined = this.refineCrossing(
                    other,
                    clamp((i + hit.t) / m, 0, 1),
                    clamp((j + hit.u) / n, 0, 1),
                );
                if (!refined) continue;
                if (found.some((f) => Math.abs(f.t - refined.t) + Math.abs(f.u - refined.u) < 1e-7))
                    continue;
                found.push(refined);
            }
        return found.sort((a, b) => a.t - b.t);
    }

    /** Newton's method for where this curve and `other` meet, from t and u near there. Null if it wanders off. */
    private refineCrossing(other: Cubic, t: number, u: number): CubicCrossing | null {
        const start = { t, u };
        for (let k = 0; k < 12; k++) {
            const miss = this.pointAt(t).sub(other.pointAt(u));
            if (miss.len() < 1e-12) break;
            const [a, b] = [this.derivativeAt(t), other.derivativeAt(u).neg()];
            const det = a.cross(b);
            if (Math.abs(det) < 1e-14) break;
            // Solve a dt + b du = -miss.
            t -= miss.cross(b) / det;
            u -= a.cross(miss) / det;
        }
        // A step out of the curves, or far from where the polylines crossed, is kept where they crossed.
        if (
            !(t >= 0 && t <= 1 && u >= 0 && u <= 1) ||
            Math.abs(t - start.t) + Math.abs(u - start.u) > 0.2
        )
            ({ t, u } = start);
        if (t >= 1 || u >= 1) return null;
        return { t, u, at: this.pointAt(t) };
    }
}

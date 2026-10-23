/** Polylines: smooth curves through points, and measuring and resampling along them. */

import { Vector2 } from "./vector2";

/**
 * A natural cubic spline through `points`, as a polyline with `perSpan` segments between each pair (so point i
 * is at index i·perSpan). It's parametrised by the distance between points. Its curvature changes smoothly
 * through every point, and of all curves through them it bends least, the way a loose rope or a draughtsman's
 * spline lies. The ends are straight (no curvature there).
 */
export function cubicSpline(points: Vector2[], perSpan = 16): Vector2[] {
    const n = points.length;
    if (n < 3) return points;
    const h = points.slice(1).map((p, i) => p.distanceTo(points[i]));
    const slope = (i: number) => points[i + 1].sub(points[i]).scale(1 / h[i]);
    // Second derivatives at each point, from the tridiagonal system that makes the curvature continuous,
    // solved by the Thomas algorithm. They're zero at the ends.
    const zero = new Vector2(0, 0);
    const c: number[] = [0];
    const d: Vector2[] = [zero];
    for (let i = 1; i < n - 1; i++) {
        const diag = 2 * (h[i - 1] + h[i]) - h[i - 1] * c[i - 1];
        const rhs = slope(i)
            .sub(slope(i - 1))
            .scale(6);
        c.push(h[i] / diag);
        d.push(rhs.sub(d[i - 1].scale(h[i - 1])).scale(1 / diag));
    }
    const m: Vector2[] = new Array(n).fill(zero);
    for (let i = n - 2; i >= 1; i--) m[i] = d[i].sub(m[i + 1].scale(c[i]));

    const out = [points[0]];
    for (let i = 0; i < n - 1; i++) {
        for (let k = 1; k <= perSpan; k++) {
            const b = k / perSpan;
            const a = 1 - b;
            const bend = m[i]
                .scale(a ** 3 - a)
                .add(m[i + 1].scale(b ** 3 - b))
                .scale((h[i] * h[i]) / 6);
            out.push(
                points[i]
                    .scale(a)
                    .add(points[i + 1].scale(b))
                    .add(bend),
            );
        }
    }
    return out;
}

/** The distance along the polyline to each of its points, starting at 0. */
export function arcLengths<P extends { distanceTo(b: P): number }>(points: P[]): number[] {
    const s = [0];
    for (let i = 1; i < points.length; i++) s.push(s[i - 1] + points[i].distanceTo(points[i - 1]));
    return s;
}

/** The polyline again with its points evenly spaced along it, as close to `spacing` apart as divides it evenly. */
export function resample(points: Vector2[], spacing: number): Vector2[] {
    const s = arcLengths(points);
    const total = s[s.length - 1];
    const count = Math.max(1, Math.round(total / spacing));
    const out: Vector2[] = [];
    let j = 0;
    for (let k = 0; k <= count; k++) {
        const target = (total * k) / count;
        while (j < points.length - 2 && s[j + 1] < target) j++;
        const f = (target - s[j]) / (s[j + 1] - s[j] || 1);
        out.push(points[j].add(points[j + 1].sub(points[j]).scale(f)));
    }
    return out;
}

/**
 * The smoothest curve from `a` to `b` leaving `a` in direction `da` and arriving at `b` in direction `db` (unit
 * vectors): a cubic Hermite curve with its end tangents as long as the chord, as a polyline of `n` segments.
 */
export function hermite(a: Vector2, da: Vector2, b: Vector2, db: Vector2, n = 64): Vector2[] {
    const chord = a.distanceTo(b);
    const [ta, tb] = [da.scale(chord), db.scale(chord)];
    return Array.from({ length: n + 1 }, (_, k) => {
        const t = k / n;
        const [t2, t3] = [t * t, t * t * t];
        return a
            .scale(2 * t3 - 3 * t2 + 1)
            .add(ta.scale(t3 - 2 * t2 + t))
            .add(b.scale(3 * t2 - 2 * t3))
            .add(tb.scale(t3 - t2));
    });
}

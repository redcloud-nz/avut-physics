import type { Vector3 } from "./vector3";

/** Curves in 3D as runs of points: a cubic Bézier, a smooth path through given points, and a run thinned out. */

/** `n` + 1 points along the cubic Bézier from `a` to `b` with control points `c1` and `c2`, both ends included. */
export function cubicPoints(
    a: Vector3,
    c1: Vector3,
    c2: Vector3,
    b: Vector3,
    n: number,
): Vector3[] {
    return Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        const s = 1 - t;
        return a
            .scale(s * s * s)
            .add(c1.scale(3 * s * s * t))
            .add(c2.scale(3 * s * t * t))
            .add(b.scale(t * t * t));
    });
}

/** A smooth path through `pts`, `n` points between each pair (Catmull–Rom), ending on the last. */
export function catmullRom(pts: readonly Vector3[], n: number): Vector3[] {
    const out: Vector3[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
        const [p0, p1, p2, p3] = [
            pts[Math.max(0, i - 1)],
            pts[i],
            pts[i + 1],
            pts[Math.min(pts.length - 1, i + 2)],
        ];
        for (let k = 0; k < n; k++) {
            const t = k / n;
            const t2 = t * t;
            const t3 = t2 * t;
            out.push(
                p0
                    .scale(-0.5 * t3 + t2 - 0.5 * t)
                    .add(p1.scale(1.5 * t3 - 2.5 * t2 + 1))
                    .add(p2.scale(-1.5 * t3 + 2 * t2 + 0.5 * t))
                    .add(p3.scale(0.5 * t3 - 0.5 * t2)),
            );
        }
    }
    out.push(pts.at(-1)!);
    return out;
}

/**
 * `points` with those left out that the line through the rest passes within `tolerance` of (Ramer–Douglas–Peucker): a
 * nearly straight run comes down to its ends, a bend keeps enough to follow it. The first and last are always kept, so
 * a closed loop stays closed.
 */
export function thinned(points: Vector3[], tolerance: number): Vector3[] {
    if (points.length < 3 || tolerance <= 0) return points;
    const keep = points.map((_, i) => i === 0 || i === points.length - 1);
    const spans: [number, number][] = [[0, points.length - 1]];
    while (spans.length) {
        const [a, b] = spans.pop()!;
        const ab = points[b].sub(points[a]);
        const length = ab.len();
        let [far, most] = [-1, tolerance];
        for (let i = a + 1; i < b; i++) {
            const ap = points[i].sub(points[a]);
            // How far it is off the line from a to b (or from a, where a and b meet, as round a loop).
            const off = length < 1e-12 ? ap.len() : ap.cross(ab).len() / length;
            if (off > most) [far, most] = [i, off];
        }
        if (far < 0) continue;
        keep[far] = true;
        spans.push([a, far], [far, b]);
    }
    return points.filter((_, i) => keep[i]);
}

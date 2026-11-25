import type { Vector3 } from "./vector3";

/** Curves in 3D as runs of points: a cubic Bézier, and a smooth path through given points. */

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

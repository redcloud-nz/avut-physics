import { clamp } from "./math";
import { vec3, type Vector3 } from "./vector3";

/**
 * Runs of points in 3D (a rope's or a bar's centreline) and how they lie against each other: the nearest points
 * between two runs, and where a run passes through the inside of a flat closed loop.
 */

/** Where two runs come nearest: the points on each, the segments they're on (from their points' indices), the gap. */
export type Nearest = { a: Vector3; b: Vector3; ia: number; ib: number; distance: number };

/**
 * The nearest points on the segments `p0`–`p1` and `q0`–`q1`, as the fractions along each (0 at the start, 1 at the
 * end). Parallel segments give one of the nearest pairs.
 */
export function segmentsNearest(
    p0: Vector3,
    p1: Vector3,
    q0: Vector3,
    q1: Vector3,
): { s: number; t: number } {
    const d1 = p1.sub(p0);
    const d2 = q1.sub(q0);
    const r = p0.sub(q0);
    const a = d1.dot(d1);
    const e = d2.dot(d2);
    const f = d2.dot(r);
    const eps = 1e-18;
    if (a <= eps && e <= eps) return { s: 0, t: 0 };
    if (a <= eps) return { s: 0, t: clamp(f / e, 0, 1) };
    const c = d1.dot(r);
    if (e <= eps) return { s: clamp(-c / a, 0, 1), t: 0 };
    const b = d1.dot(d2);
    const denom = a * e - b * b;
    let s = denom > eps ? clamp((b * f - c * e) / denom, 0, 1) : 0;
    let t = (b * s + f) / e;
    if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
    } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
    }
    return { s, t };
}

/** Where the runs `a` and `b` come nearest each other, segment against segment. */
export function nearestBetween(a: readonly Vector3[], b: readonly Vector3[]): Nearest {
    let best: Nearest = { a: a[0], b: b[0], ia: 0, ib: 0, distance: Infinity };
    for (let i = 0; i < a.length - 1; i++)
        for (let j = 0; j < b.length - 1; j++) {
            const { s, t } = segmentsNearest(a[i], a[i + 1], b[j], b[j + 1]);
            const pa = a[i].lerp(a[i + 1], s);
            const pb = b[j].lerp(b[j + 1], t);
            const distance = pa.distanceTo(pb);
            if (distance < best.distance) best = { a: pa, b: pb, ia: i, ib: j, distance };
        }
    return best;
}

/** The nearest point to `p` on the run `pts`, the segment it's on, and how far it is. */
export function nearestOnRun(
    p: Vector3,
    pts: readonly Vector3[],
): { at: Vector3; index: number; distance: number } {
    return (({ b, ib, distance }) => ({ at: b, index: ib, distance }))(nearestBetween([p, p], pts));
}

/** The way a closed loop faces (Newell's method): square to it, its length twice the area it encloses. */
export function loopNormal(loop: readonly Vector3[]): Vector3 {
    let [x, y, z] = [0, 0, 0];
    for (let i = 0; i < loop.length; i++) {
        const p = loop[i];
        const q = loop[(i + 1) % loop.length];
        x += (p.y - q.y) * (p.z + q.z);
        y += (p.z - q.z) * (p.x + q.x);
        z += (p.x - q.x) * (p.y + q.y);
    }
    return vec3(x, y, z);
}

/**
 * Where the run `path` passes through the inside of the closed loop `loop`, which lies flat (in a plane): the points
 * it crosses the loop's plane at inside the loop, and the segments of `path` they're on.
 */
export function piercings(
    loop: readonly Vector3[],
    path: readonly Vector3[],
): { at: Vector3; index: number }[] {
    const n = loopNormal(loop).unit();
    const origin = loop[0];
    // Axes in the loop's plane.
    const u = loop
        .reduce((far, p) => (p.distanceTo(origin) > far.distanceTo(origin) ? p : far))
        .sub(origin);
    const e1 = u.sub(n.scale(u.dot(n))).unit();
    const e2 = n.cross(e1);
    const flat = loop.map((p) => [p.sub(origin).dot(e1), p.sub(origin).dot(e2)] as const);
    const inside = (x: number, y: number) => {
        let odd = false;
        for (let i = 0, j = flat.length - 1; i < flat.length; j = i++) {
            const [xi, yi] = flat[i];
            const [xj, yj] = flat[j];
            if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
        }
        return odd;
    };
    const side = (p: Vector3) => p.sub(origin).dot(n);
    const out: { at: Vector3; index: number }[] = [];
    for (let i = 0; i < path.length - 1; i++) {
        const [h0, h1] = [side(path[i]), side(path[i + 1])];
        // On its plane counts as below it, so a point on the plane is crossed at once, not twice.
        if (h0 > 0 === h1 > 0) continue;
        const at = path[i].lerp(path[i + 1], h0 / (h0 - h1));
        const d = at.sub(origin);
        if (inside(d.dot(e1), d.dot(e2))) out.push({ at, index: i });
    }
    return out;
}

import { vec2, type Vector2 } from "./vector2";

/**
 * The convex hull of `points`, anticlockwise from the lowest-x point (the lowest y of those), by Andrew's monotone
 * chain. Points on its edges are left out.
 */
export function convexHull(points: readonly Vector2[]): Vector2[] {
    const sorted = [...points].sort((p, q) => p.x - q.x || p.y - q.y);
    if (sorted.length < 3) return sorted;
    const half = (run: Vector2[]) => {
        const out: Vector2[] = [];
        for (const p of run) {
            while (
                out.length >= 2 &&
                p.sub(out[out.length - 2]).cross(out[out.length - 1].sub(out[out.length - 2])) >= 0
            )
                out.pop();
            out.push(p);
        }
        out.pop();
        return out;
    };
    return [...half(sorted), ...half(sorted.slice().reverse())];
}

/**
 * The smallest circle round `points` (incremental, as Welzl's: each point outside the circle so far must be on the new
 * one). Run on their convex hull first when there are many, so it has few to go through.
 */
export function smallestCircle(points: readonly Vector2[]): { centre: Vector2; r: number } {
    if (!points.length) return { centre: vec2(0, 0), r: 0 };
    const inside = (c: { centre: Vector2; r: number }, p: Vector2) =>
        p.distanceTo(c.centre) <= c.r * (1 + 1e-12) + 1e-12;
    const two = (a: Vector2, b: Vector2) => ({ centre: a.lerp(b, 0.5), r: a.distanceTo(b) / 2 });
    const three = (a: Vector2, b: Vector2, c: Vector2) => {
        const [bx, by, cx, cy] = [b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y];
        const d = 2 * (bx * cy - by * cx);
        // In a line: the circle on the two furthest apart.
        if (Math.abs(d) < 1e-18)
            return [two(a, b), two(a, c), two(b, c)].reduce((m, x) => (x.r > m.r ? x : m));
        const [b2, c2] = [bx * bx + by * by, cx * cx + cy * cy];
        const centre = vec2(a.x + (cy * b2 - by * c2) / d, a.y + (bx * c2 - cx * b2) / d);
        return { centre, r: centre.distanceTo(a) };
    };
    let circle = { centre: points[0], r: 0 };
    for (let i = 1; i < points.length; i++) {
        if (inside(circle, points[i])) continue;
        circle = { centre: points[i], r: 0 };
        for (let j = 0; j < i; j++) {
            if (inside(circle, points[j])) continue;
            circle = two(points[i], points[j]);
            for (let k = 0; k < j; k++)
                if (!inside(circle, points[k])) circle = three(points[i], points[j], points[k]);
        }
    }
    return circle;
}

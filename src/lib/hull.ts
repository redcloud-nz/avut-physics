import type { Vector2 } from "./vector2";

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

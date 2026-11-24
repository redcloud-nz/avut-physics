import { describe, expect, it } from "vitest";

import { convexHull } from "./hull";
import { Vector2 } from "./vector2";

const v = (x: number, y: number) => new Vector2(x, y);

describe("convexHull", () => {
    it("keeps a square's corners, anticlockwise, and drops what's inside or on an edge", () => {
        const hull = convexHull([v(0, 0), v(1, 1), v(0.5, 0.5), v(1, 0), v(0, 1), v(0.5, 0)]);
        expect(hull.map((p) => [p.x, p.y])).toEqual([
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
        ]);
    });

    it("turns anticlockwise at every corner", () => {
        const points = Array.from({ length: 50 }, (_, i) =>
            v(Math.cos(i * 2.4) * (i % 7), Math.sin(i * 1.3) * (i % 5)),
        );
        const hull = convexHull(points);
        hull.forEach((p, i) => {
            const [q, r] = [hull[(i + 1) % hull.length], hull[(i + 2) % hull.length]];
            expect(q.sub(p).cross(r.sub(q))).toBeGreaterThan(0);
        });
        for (const p of points)
            hull.forEach((a, i) => {
                const b = hull[(i + 1) % hull.length];
                expect(b.sub(a).cross(p.sub(a))).toBeGreaterThanOrEqual(-1e-12);
            });
    });
});

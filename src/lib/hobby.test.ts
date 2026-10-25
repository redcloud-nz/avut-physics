import { describe, expect, it } from "vitest";

import { Cubic } from "./bezier";
import { hobbyControls, hobbyDirections, hobbyTensions } from "./hobby";
import { deg } from "./math";
import { vec2, Vector2 } from "./vector2";

/** The angle between two directions, in degrees. */
const degreesApart = (a: Vector2, b: Vector2) => Math.abs(deg(Math.atan2(a.cross(b), a.dot(b))));

/** Points on the circle of radius r about the origin, at these angles (radians). */
const onCircle = (angles: number[], r = 5) => angles.map((a) => Vector2.fromAngle(a, r));
/** The circle's tangent at angle a, heading anticlockwise. */
const tangent = (a: number) => Vector2.fromAngle(a + Math.PI / 2);

describe("hobbyDirections", () => {
    const angles = [0, 0.5, 0.9, 1.5, 2.1, 2.4, 3];

    it("comes out tangent to a circle through points on it, held at both ends", () => {
        const dirs = hobbyDirections(
            onCircle(angles),
            { direction: tangent(angles[0]) },
            { direction: tangent(angles.at(-1)!) },
        );
        dirs.forEach((d, k) => expect(degreesApart(d, tangent(angles[k]))).toBeLessThan(1));
    });

    it("comes out tangent to a circle with its ends free", () => {
        const dirs = hobbyDirections(onCircle(angles), { curl: 1 }, { curl: 1 });
        dirs.forEach((d, k) => expect(degreesApart(d, tangent(angles[k]))).toBeLessThan(1));
    });

    it("runs along a line through points on it", () => {
        const points = [0, 1, 3, 3.5, 7].map((s) => vec2(1 + 2 * s, -1 + s));
        const along = vec2(2, 1).unit();
        for (const dirs of [
            hobbyDirections(points, { curl: 1 }, { curl: 1 }),
            hobbyDirections(points, { direction: along }, { curl: 1 }),
            hobbyDirections(points, { curl: 1 }, { direction: along }),
        ])
            dirs.forEach((d) => expect(degreesApart(d, along)).toBeLessThan(1e-9));
    });

    it("keeps the directions it's given at the ends", () => {
        const points = [vec2(0, 0), vec2(2, 1), vec2(4, 0)];
        const [start, end] = [vec2(0, 1), vec2(1, -1).unit()];
        const dirs = hobbyDirections(points, { direction: start }, { direction: end });
        expect(degreesApart(dirs[0], start)).toBeLessThan(1e-9);
        expect(degreesApart(dirs[2], end)).toBeLessThan(1e-9);
    });

    it("draws two free points as a straight line", () => {
        const dirs = hobbyDirections([vec2(0, 0), vec2(3, 4)], { curl: 1 }, { curl: 1 });
        for (const d of dirs) expect(degreesApart(d, vec2(3, 4))).toBeLessThan(1e-9);
    });

    it("bows a free end as a circle through three points", () => {
        // With curl 1 at a free end, the end segment bends as evenly as a circular arc would.
        const points = onCircle([0, 1, 2]);
        const dirs = hobbyDirections(points, { curl: 1 }, { curl: 1 });
        dirs.forEach((d, k) => expect(degreesApart(d, tangent(k))).toBeLessThan(1e-6));
    });
});

describe("hobbyControls", () => {
    it("puts a straight segment's control points a third of the way along", () => {
        const [a, b] = [vec2(0, 0), vec2(6, 0)];
        const [c1, c2] = hobbyControls(a, b, vec2(1, 0), vec2(1, 0), [1, 1]);
        expect(c1.x).toBeCloseTo(2, 12);
        expect(c2.x).toBeCloseTo(4, 12);
    });

    it("draws a quarter circle as the usual cubic", () => {
        const [c1, c2] = hobbyControls(vec2(1, 0), vec2(0, 1), vec2(0, 1), vec2(-1, 0), [1, 1]);
        const k = (4 / 3) * Math.tan(Math.PI / 8);
        expect(c1.y).toBeCloseTo(k, 3);
        expect(c2.x).toBeCloseTo(k, 3);
    });

    it("pulls the curve in as tension rises", () => {
        const [a, b] = [vec2(0, 0), vec2(4, 0)];
        const curve = (t: number) =>
            new Cubic(a, ...hobbyControls(a, b, vec2(1, 1).unit(), vec2(1, -1).unit(), [t, t]), b);
        expect(curve(2).length()).toBeLessThan(curve(1).length());
        expect(curve(1).length()).toBeLessThan(curve(0.75).length());
    });

    it("gives back its tensions from its control points", () => {
        const [a, b] = [vec2(1, 2), vec2(5, -1)];
        const [leaving, arriving] = [vec2(1, 2).unit(), vec2(0.3, -1).unit()];
        for (const tensions of [
            [1, 1],
            [0.75, 4],
            [2.5, 1.3],
        ] as [number, number][]) {
            const [c1, c2] = hobbyControls(a, b, leaving, arriving, tensions);
            const back = hobbyTensions(a, c1, c2, b);
            expect(back[0]).toBeCloseTo(tensions[0], 10);
            expect(back[1]).toBeCloseTo(tensions[1], 10);
        }
    });
});

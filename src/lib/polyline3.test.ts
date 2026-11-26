import { describe, expect, it } from "vitest";

import { loopNormal, nearestBetween, nearestOnRun, piercings, segmentsNearest } from "./polyline3";
import { vec3 } from "./vector3";

/** A circle `r` round `c` in the x–y plane. */
const circle = (r: number, c = vec3(0, 0, 0), n = 64) =>
    Array.from({ length: n + 1 }, (_, i) => {
        const a = (2 * Math.PI * i) / n;
        return c.add(vec3(r * Math.cos(a), r * Math.sin(a), 0));
    });

describe("segmentsNearest", () => {
    it("finds where crossing segments come nearest", () => {
        const { s, t } = segmentsNearest(
            vec3(-1, 0, 0),
            vec3(1, 0, 0),
            vec3(0, -1, 1),
            vec3(0, 1, 1),
        );
        expect(s).toBeCloseTo(0.5);
        expect(t).toBeCloseTo(0.5);
    });

    it("keeps to the segments' ends", () => {
        const { s, t } = segmentsNearest(
            vec3(0, 0, 0),
            vec3(1, 0, 0),
            vec3(2, 1, 0),
            vec3(3, 1, 0),
        );
        expect(s).toBe(1);
        expect(t).toBe(0);
    });

    it("handles parallel segments", () => {
        const { s, t } = segmentsNearest(
            vec3(0, 0, 0),
            vec3(1, 0, 0),
            vec3(0, 1, 0),
            vec3(1, 1, 0),
        );
        const a = vec3(s, 0, 0);
        const b = vec3(t, 1, 0);
        expect(a.distanceTo(b)).toBeCloseTo(1);
    });
});

describe("nearestBetween and nearestOnRun", () => {
    it("measures the gap between two runs", () => {
        const near = nearestBetween(circle(1), [vec3(0, 0, 0.5), vec3(3, 0, 0.5)]);
        expect(near.distance).toBeCloseTo(0.5, 3);
        expect(near.a.x).toBeCloseTo(1, 3);
    });

    it("finds a point's nearest on a run", () => {
        const { at, distance } = nearestOnRun(vec3(0.5, 2, 0), [vec3(0, 0, 0), vec3(1, 0, 0)]);
        expect(at.x).toBeCloseTo(0.5);
        expect(distance).toBeCloseTo(2);
    });
});

describe("loopNormal", () => {
    it("is square to a flat loop, twice its area long", () => {
        const n = loopNormal(circle(1).slice(0, -1));
        expect(n.x).toBeCloseTo(0);
        expect(n.y).toBeCloseTo(0);
        expect(n.z).toBeCloseTo(2 * Math.PI, 1);
    });
});

describe("piercings", () => {
    const ring = circle(1);

    it("finds a line through the ring's inside", () => {
        const through = piercings(ring, [vec3(0.5, 0, -1), vec3(0.5, 0, 1)]);
        expect(through).toHaveLength(1);
        expect(through[0].at.x).toBeCloseTo(0.5);
        expect(through[0].index).toBe(0);
    });

    it("leaves out a line passing outside it", () => {
        expect(piercings(ring, [vec3(1.5, 0, -1), vec3(1.5, 0, 1)])).toHaveLength(0);
    });

    it("counts a loop linked through it once, and one beside it not at all", () => {
        // A ring in the x–z plane round the first ring's bar at x = 1.
        const linked = Array.from({ length: 33 }, (_, i) => {
            const a = (2 * Math.PI * i) / 32;
            return vec3(1 + 0.3 * Math.cos(a), 0, 0.3 * Math.sin(a));
        });
        expect(piercings(ring, linked)).toHaveLength(1);
        const beside = linked.map((p) => p.add(vec3(0.5, 0, 0)));
        expect(piercings(ring, beside)).toHaveLength(0);
    });
});

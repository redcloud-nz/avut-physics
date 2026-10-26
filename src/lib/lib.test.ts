import { describe, expect, it } from "vitest";

import { arcLengths } from "./curve";
import { nearestOnSegment, segmentDistance, segmentGap, segmentIntersection } from "./geometry";
import { clamp, linearScale } from "./math";
import { pathPoints } from "./svg-path";
import { vec2 } from "./vector2";
import { vec3 } from "./vector3";

describe("Vector2", () => {
    it("does arithmetic without changing its operands", () => {
        const a = vec2(3, 4);
        expect(a.add(vec2(1, 1))).toEqual(vec2(4, 5));
        expect(a.sub(vec2(1, 1))).toEqual(vec2(2, 3));
        expect(a.scale(2)).toEqual(vec2(6, 8));
        expect(a).toEqual(vec2(3, 4));
        expect(a.len()).toBe(5);
        expect(a.dot(vec2(1, 2))).toBe(11);
        expect(vec2(1, 0).cross(vec2(0, 1))).toBe(1);
        expect(vec2(1, 0).perp()).toEqual(vec2(-0, 1));
    });

    it("keeps a direction only when it has one", () => {
        expect(vec2(0, 2).unit()).toEqual(vec2(0, 1));
        expect(vec2(0, 0).safeUnit(vec2(1, 0))).toEqual(vec2(1, 0));
        expect(vec2(6, 8).clampLen(5)).toEqual(vec2(3, 4));
        expect(vec2(3, 4).clampLen(10)).toEqual(vec2(3, 4));
    });
});

describe("Vector3", () => {
    it("crosses, measures angles and projects", () => {
        expect(vec3(1, 0, 0).cross(vec3(0, 1, 0))).toEqual(vec3(0, 0, 1));
        expect(vec3(1, 0, 0).angleTo(vec3(0, 2, 0))).toBeCloseTo(Math.PI / 2);
        expect(vec3(1, 1, 0).angleTo(vec3(2, 2, 0))).toBeCloseTo(0, 6);
        expect(vec3(1, 2, 3).mirrorZ()).toEqual(vec3(1, 2, -3));
        expect(vec3(1, 2, 3).xy()).toEqual(vec2(1, 2));
    });
});

describe("geometry", () => {
    it("finds the nearest point on a segment, clamped to its ends", () => {
        expect(nearestOnSegment(vec2(1, 1), vec2(0, 0), vec2(2, 0))).toEqual({
            point: vec2(1, 0),
            t: 0.5,
        });
        expect(nearestOnSegment(vec2(5, 1), vec2(0, 0), vec2(2, 0)).t).toBe(1);
        expect(segmentDistance(vec2(-3, 4), vec2(0, 0), vec2(2, 0))).toBe(5);
    });

    it("measures the gap between segments, zero where they cross", () => {
        expect(segmentGap(vec2(0, 0), vec2(2, 2), vec2(0, 2), vec2(2, 0))).toBe(0);
        expect(segmentGap(vec2(0, 0), vec2(2, 0), vec2(0, 1), vec2(2, 1))).toBe(1);
    });
});

describe("math", () => {
    it("clamps and scales", () => {
        expect(clamp(5, 0, 1)).toBe(1);
        expect(clamp(-5, 0, 1)).toBe(0);
        expect(linearScale([0, 10], [100, 0])(2.5)).toBe(75);
    });
});

describe("segmentIntersection", () => {
    it("says how far along each segment they cross", () => {
        const hit = segmentIntersection(vec2(0, 0), vec2(4, 0), vec2(1, -1), vec2(1, 3));
        expect(hit?.t).toBeCloseTo(0.25);
        expect(hit?.u).toBeCloseTo(0.25);
    });

    it("finds nothing for parallel or separate segments", () => {
        expect(segmentIntersection(vec2(0, 0), vec2(1, 0), vec2(0, 1), vec2(1, 1))).toBeNull();
        expect(segmentIntersection(vec2(0, 0), vec2(1, 0), vec2(2, -1), vec2(2, 1))).toBeNull();
    });
});

describe("curves", () => {
    it("measures along a polyline", () => {
        expect(arcLengths([vec2(0, 0), vec2(3, 4), vec2(3, 5)])).toEqual([0, 5, 6]);
    });
});

describe("pathPoints", () => {
    const end = (d: string) => pathPoints(d).at(-1)!;

    it("follows lines, curves and arcs to where they end", () => {
        expect(end("M 1 2 L 4 6 H 0 V -1")).toEqual(vec2(0, -1));
        expect(end("M 0 0 C 0 1, 2 1, 2 0").distanceTo(vec2(2, 0))).toBeLessThan(1e-12);
        expect(arcLengths(pathPoints("M 0 0 L 3 4")).at(-1)).toBeCloseTo(5);
    });

    it("reads numbers written with an exponent", () => {
        expect(end("M 0 0 L 2e-16 1E+1 -1.5e-3 4")).toEqual(vec2(-0.0015, 4));
        expect(pathPoints("M 0 0 L 2e-16 1E+1")).toContainEqual(vec2(2e-16, 10));
    });

    it("draws an arc as part of a circle, the way the flags say", () => {
        // A half circle of radius 1 from (1, 0) to (-1, 0): sweep 0 goes through y = -1, sweep 1 through y = 1.
        const up = pathPoints("M 1 0 A 1 1 0 0 0 -1 0");
        const down = pathPoints("M 1 0 A 1 1 0 0 1 -1 0");
        for (const p of up) expect(p.len()).toBeCloseTo(1, 9);
        expect(Math.min(...up.map((p) => p.y))).toBeCloseTo(-1, 3);
        expect(Math.max(...down.map((p) => p.y))).toBeCloseTo(1, 3);
        expect(arcLengths(up).at(-1)).toBeCloseTo(Math.PI, 3);
        // The large-arc flag picks the long way round.
        const long = pathPoints("M 1 0 A 1 1 0 1 0 0 1");
        expect(arcLengths(long).at(-1)).toBeCloseTo((3 * Math.PI) / 2, 3);
    });

    it("carries on from a given point", () => {
        expect(pathPoints("L 1 0", vec2(0, 0))[0]).toEqual(vec2(0, 0));
        expect(() => pathPoints("L 1 0")).toThrow(/start with M/);
        expect(() => pathPoints("M 0 0 Q 1 1 2 2")).toThrow(/Unsupported/);
    });
});

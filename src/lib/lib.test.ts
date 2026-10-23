import { describe, expect, it } from "vitest";

import { arcLengths, cubicSpline, resample } from "./curve";
import { nearestOnSegment, segmentDistance, segmentGap, segmentIntersection } from "./geometry";
import { clamp, linearScale } from "./math";
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
    const points = [vec2(0, 0), vec2(1, 2), vec2(3, 2), vec2(4, 0)];

    it("passes through every point it was given", () => {
        const curve = cubicSpline(points, 8);
        expect(curve).toHaveLength(1 + 3 * 8);
        points.forEach((p, i) => {
            expect(curve[i * 8].x).toBeCloseTo(p.x);
            expect(curve[i * 8].y).toBeCloseTo(p.y);
        });
    });

    it("measures and evenly respaces a polyline", () => {
        expect(arcLengths([vec2(0, 0), vec2(3, 4), vec2(3, 5)])).toEqual([0, 5, 6]);
        const even = resample(cubicSpline(points), 0.1);
        const gaps = arcLengths(even).map((s, i, all) => (i ? s - all[i - 1] : 0.1));
        expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.002);
        expect(even[even.length - 1].distanceTo(vec2(4, 0))).toBeLessThan(1e-9);
    });
});

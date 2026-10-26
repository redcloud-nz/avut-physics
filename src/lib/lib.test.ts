import { describe, expect, it } from "vitest";

import { clamp, linearScale, roundTo, wrapDegrees } from "./math";
import { arcLengths, lengthOf } from "./polyline";
import { Segment } from "./segment";
import { pathPoints, polylinePath, svgPoint, svgPoints } from "./svg-path";
import { vec2, Vector2 } from "./vector2";
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

describe("Vector2 between points", () => {
    it("goes part way, halfway and adds up", () => {
        expect(vec2(0, 0).lerp(vec2(4, 8), 0.25)).toEqual(vec2(1, 2));
        expect(vec2(1, 1).mid(vec2(3, 5))).toEqual(vec2(2, 3));
        expect(Vector2.sum([vec2(1, 2), vec2(3, 4), vec2(-1, 0)])).toEqual(vec2(3, 6));
        expect(Vector2.sum([])).toEqual(Vector2.ZERO);
    });
});

describe("Vector3", () => {
    it("crosses, measures angles and projects", () => {
        expect(vec3(1, 0, 0).cross(vec3(0, 1, 0))).toEqual(vec3(0, 0, 1));
        expect(vec3(1, 0, 0).angleTo(vec3(0, 2, 0))).toBeCloseTo(Math.PI / 2);
        expect(vec3(1, 1, 0).angleTo(vec3(2, 2, 0))).toBeCloseTo(0, 6);
        expect(vec3(1, 2, 3).mirrorZ()).toEqual(vec3(1, 2, -3));
        expect(vec3(1, 2, 3).xy()).toEqual(vec2(1, 2));
        expect(vec3(3, 100, 4).horizontalLen()).toBe(5);
        expect(vec3(0, 0, 0).lerp(vec3(2, 4, 6), 0.5)).toEqual(vec3(1, 2, 3));
    });
});

describe("geometry", () => {
    const ab = new Segment(vec2(0, 0), vec2(2, 0));

    it("finds the nearest point on a segment, clamped to its ends", () => {
        expect(ab.nearest(vec2(1, 1))).toEqual({
            point: vec2(1, 0),
            t: 0.5,
        });
        expect(ab.nearest(vec2(5, 1)).t).toBe(1);
        expect(ab.distanceTo(vec2(-3, 4))).toBe(5);
    });

    it("measures the gap between segments, zero where they cross", () => {
        expect(new Segment(vec2(0, 0), vec2(2, 2)).gap(new Segment(vec2(0, 2), vec2(2, 0)))).toBe(
            0,
        );
        expect(ab.gap(new Segment(vec2(0, 1), vec2(2, 1)))).toBe(1);
    });
});

describe("Segment", () => {
    const bar = new Segment(vec2(0, 0), vec2(4, 0));
    const post = new Segment(vec2(2, -1), vec2(2, 3));

    it("measures itself and points along it", () => {
        expect(bar.vector()).toEqual(vec2(4, 0));
        expect(bar.length()).toBe(4);
        expect(bar.direction()).toEqual(vec2(1, 0));
        expect(bar.mid()).toEqual(vec2(2, 0));
        expect(bar.at(0.25)).toEqual(vec2(1, 0));
    });

    it("finds the nearest point and the distance, as the functions do", () => {
        expect(bar.nearest(vec2(1, 2))).toEqual({ point: vec2(1, 0), t: 0.25 });
        expect(bar.distanceTo(vec2(7, 4))).toBe(5);
    });

    it("crosses, gaps and intersects another segment", () => {
        expect(bar.crosses(post)).toBe(true);
        expect(bar.gap(post)).toBe(0);
        expect(bar.intersection(post)).toEqual({ t: 0.5, u: 0.25 });
        const above = new Segment(vec2(0, 1), vec2(4, 1));
        expect(bar.crosses(above)).toBe(false);
        expect(bar.gap(above)).toBe(1);
        expect(bar.intersection(above)).toBeNull();
    });

    it("splits a polyline into its pieces", () => {
        const pieces = Segment.along([vec2(0, 0), vec2(1, 0), vec2(1, 1)]);
        expect(pieces).toEqual([
            new Segment(vec2(0, 0), vec2(1, 0)),
            new Segment(vec2(1, 0), vec2(1, 1)),
        ]);
        expect(Segment.along([vec2(0, 0)])).toEqual([]);
    });
});

describe("math", () => {
    it("clamps and scales", () => {
        expect(clamp(5, 0, 1)).toBe(1);
        expect(clamp(-5, 0, 1)).toBe(0);
        expect(linearScale([0, 10], [100, 0])(2.5)).toBe(75);
    });
});

describe("wrapDegrees and roundTo", () => {
    it("brings angles into (−180, 180]", () => {
        expect(wrapDegrees(190)).toBe(-170);
        expect(wrapDegrees(-180)).toBe(180);
        expect(wrapDegrees(180)).toBe(180);
        expect(wrapDegrees(720 + 45)).toBe(45);
    });

    it("rounds to decimal places as the number reads, without −0", () => {
        expect(roundTo(0.1 + 0.2, 1)).toBe(0.3);
        expect(roundTo(1.23456, 2)).toBe(1.23);
        expect(Object.is(roundTo(-0.00001, 2), 0)).toBe(true);
        expect(svgPoint(vec2(1.000049, -2.5))).toBe("1 -2.5");
    });
});

describe("Segment.intersection", () => {
    it("says how far along each segment they cross", () => {
        const hit = new Segment(vec2(0, 0), vec2(4, 0)).intersection(
            new Segment(vec2(1, -1), vec2(1, 3)),
        );
        expect(hit?.t).toBeCloseTo(0.25);
        expect(hit?.u).toBeCloseTo(0.25);
    });

    it("finds nothing for parallel or separate segments", () => {
        expect(
            new Segment(vec2(0, 0), vec2(1, 0)).intersection(new Segment(vec2(0, 1), vec2(1, 1))),
        ).toBeNull();
        expect(
            new Segment(vec2(0, 0), vec2(1, 0)).intersection(new Segment(vec2(2, -1), vec2(2, 1))),
        ).toBeNull();
    });
});

describe("curves", () => {
    it("measures along a polyline", () => {
        expect(arcLengths([vec2(0, 0), vec2(3, 4), vec2(3, 5)])).toEqual([0, 5, 6]);
    });
});

describe("writing polylines for SVG", () => {
    const line = [vec2(0, 0), vec2(1.00004, 2), vec2(3, -1.5)];

    it("writes points attributes and path data, rounded", () => {
        expect(svgPoints(line)).toBe("0,0 1,2 3,-1.5");
        expect(polylinePath(line)).toBe("M 0 0 L 1 2 L 3 -1.5");
        expect(polylinePath(line, true)).toBe("M 0 0 L 1 2 L 3 -1.5 Z");
    });

    it("measures a polyline as arcLengths does", () => {
        const zigzag = [vec2(0, 0), vec2(3, 4), vec2(3, 5)];
        expect(lengthOf(zigzag)).toBe(arcLengths(zigzag).at(-1));
        expect(lengthOf([vec2(1, 1)])).toBe(0);
    });
});

describe("pathPoints", () => {
    const end = (d: string) => pathPoints(d).at(-1)!;

    it("follows lines, curves and arcs to where they end", () => {
        expect(end("M 1 2 L 4 6 H 0 V -1")).toEqual(vec2(0, -1));
        expect(end("M 0 0 C 0 1, 2 1, 2 0").distanceTo(vec2(2, 0))).toBeLessThan(1e-12);
        expect(lengthOf(pathPoints("M 0 0 L 3 4"))).toBeCloseTo(5);
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
        expect(lengthOf(up)).toBeCloseTo(Math.PI, 3);
        // The large-arc flag picks the long way round.
        const long = pathPoints("M 1 0 A 1 1 0 1 0 0 1");
        expect(lengthOf(long)).toBeCloseTo((3 * Math.PI) / 2, 3);
    });

    it("carries on from a given point", () => {
        expect(pathPoints("L 1 0", vec2(0, 0))[0]).toEqual(vec2(0, 0));
        expect(() => pathPoints("L 1 0")).toThrow(/start with M/);
        expect(() => pathPoints("M 0 0 Q 1 1 2 2")).toThrow(/Unsupported/);
    });
});

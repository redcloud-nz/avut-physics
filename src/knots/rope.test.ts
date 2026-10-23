import { describe, expect, it } from "vitest";

import { arcLengths } from "@/lib/curve";
import { vec2 } from "@/lib/vector2";
import type { Vector3 } from "@/lib/vector3";

import { looseFigureEight } from "./figure-eight";
import { knotDeterminant, type Pass } from "./invariants";
import { findCrossings, layRope, over, under, type Rope } from "./rope";

/** The closest two points of the rope come, ignoring points less than `skip` apart along it. */
function closestApproach(points: Vector3[], skip: number): number {
    let min = Infinity;
    for (let i = 0; i < points.length; i++)
        for (let j = i + skip; j < points.length; j++)
            min = Math.min(min, points[i].distanceTo(points[j]));
    return min;
}

/**
 * The tightest the rope bends on the page: the smallest radius of a circle through three points of its centreline
 * a diameter apart along it.
 */
function tightestBend(rope: Rope): number {
    const flat = rope.points.map((p) => p.xy());
    const k = Math.round(rope.diameter / flat[1].distanceTo(flat[0]));
    let min = Infinity;
    for (let i = k; i < flat.length - k; i++) {
        const [a, b, c] = [flat[i - k], flat[i], flat[i + k]];
        const twiceArea = Math.abs(b.sub(a).cross(c.sub(a)));
        min = Math.min(
            min,
            (a.distanceTo(b) * b.distanceTo(c) * c.distanceTo(a)) / (2 * twiceArea),
        );
    }
    return min;
}

/**
 * The rope's passes read off its shape alone, not from how it was laid: where its centreline crosses itself on
 * the page, and which strand is higher there.
 */
function passesOf(rope: Rope): Pass[] {
    const flat = rope.points.map((p) => p.xy());
    const s = arcLengths(flat);
    const zAt = (at: number) => rope.points[s.findIndex((x) => x >= at)].z;
    return findCrossings(flat)
        .flatMap((c, crossing) =>
            c.s.map((at, k) => ({
                s: at,
                crossing,
                layer: zAt(at) > zAt(c.s[1 - k]) ? ("over" as const) : ("under" as const),
            })),
        )
        .sort((a, b) => a.s - b.s);
}

describe("findCrossings", () => {
    it("finds where a loop crosses itself", () => {
        const loop = [vec2(0, 0), vec2(2, 2), vec2(2, 0), vec2(0, 2)];
        const [c, ...rest] = findCrossings(loop);
        expect(rest).toEqual([]);
        expect(c.at.x).toBeCloseTo(1);
        expect(c.at.y).toBeCloseTo(1);
    });
});

describe("knotDeterminant", () => {
    const alternate = (crossings: number[]): Pass[] =>
        crossings.map((crossing, k) => ({ crossing, layer: k % 2 === 0 ? "over" : "under" }));

    it("tells an overhand from a figure-8 from no knot", () => {
        expect(knotDeterminant([])).toBe(1);
        expect(knotDeterminant(alternate([0, 1, 2, 0, 1, 2]))).toBe(3);
        expect(knotDeterminant(alternate([0, 1, 2, 3, 1, 0, 3, 2]))).toBe(5);
    });

    it("sees no knot when one strand only ever goes over", () => {
        const passes: Pass[] = [0, 1, 2, 0, 1, 2].map((crossing, k) => ({
            crossing,
            layer: k < 3 ? "over" : "under",
        }));
        expect(knotDeterminant(passes)).toBe(1);
    });
});

describe("layRope", () => {
    // A single loop: in along the bottom, round, and out across its own start.
    const d = 0.01;
    const loop = (first: "over" | "under", second: "over" | "under", where = vec2(0, 0)) =>
        layRope({
            diameter: d,
            crossings: { x: where },
            path: [
                vec2(-0.2, -0.2),
                first === "over" ? over("x") : under("x"),
                vec2(0.2, 0.2),
                vec2(0, 0.35),
                vec2(-0.2, 0.2),
                second === "over" ? over("x") : under("x"),
                vec2(0.2, -0.2),
            ],
        });

    it("lifts the strand going over and drops the one going under", () => {
        const { rope, crossings } = loop("under", "over");
        const s = arcLengths(rope.points);
        const zAt = (at: number) => rope.points[s.findIndex((x) => x >= at - 1e-9)].z;
        expect(zAt(crossings[0].over)).toBeCloseTo(d / 2, 4);
        expect(zAt(crossings[0].under)).toBeCloseTo(-d / 2, 4);
        expect(rope.points[0].z).toBe(0);
        expect(rope.points[rope.points.length - 1].z).toBe(0);
    });

    it("needs each crossing passed once over and once under", () => {
        expect(() => loop("over", "over")).toThrow(/once over and once under/);
    });

    it("rejects crossings that aren't named", () => {
        expect(() =>
            layRope({
                diameter: d,
                crossings: {},
                path: [vec2(0, 0), vec2(0.2, 0.2), vec2(0.2, 0), vec2(0, 0.2)],
            }),
        ).toThrow(/isn't a named crossing/);
    });
});

describe("looseFigureEight", () => {
    const { rope } = looseFigureEight();

    it("is a figure-8, read off its shape", () => {
        const passes = passesOf(rope);
        expect(passes).toHaveLength(8);
        expect(passes.map((p) => p.layer)).toEqual([
            "over",
            "under",
            "over",
            "under",
            "over",
            "under",
            "over",
            "under",
        ]);
        expect(knotDeterminant(passes)).toBe(5);
    });

    it("bends smoothly, with no corners", () => {
        // Corners show up as bends tighter than about one and a half diameters.
        expect(tightestBend(rope)).toBeGreaterThan(1.75 * rope.diameter);
    });

    it("never passes through itself", () => {
        // Points less than two diameters apart along the rope are neighbours, not separate strands.
        const spacing = rope.points[1].distanceTo(rope.points[0]);
        const skip = Math.ceil((2 * rope.diameter) / spacing);
        expect(closestApproach(rope.points, skip)).toBeGreaterThan(rope.diameter * 0.95);
    });
});

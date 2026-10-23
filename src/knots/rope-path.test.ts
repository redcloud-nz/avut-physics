import { describe, expect, it } from "vitest";

import { arcLengths } from "@/lib/curve";
import type { Vector2 } from "@/lib/vector2";

import { FIGURE_EIGHT } from "./figure-eight";
import { knotDeterminant, type Pass } from "./invariants";
import { centreline, crossings, over, plain, type RopePath } from "./rope-path";

/** The rope's passes in order along it, read off where its centreline crosses itself and which strand is marked over. */
function passesOf(path: RopePath): Pass[] {
    return crossings(path)
        .flatMap((c, crossing) =>
            c.s.map((s, k) => ({
                s,
                crossing,
                layer: c.over === k ? ("over" as const) : ("under" as const),
            })),
        )
        .sort((a, b) => a.s - b.s);
}

/**
 * The tightest the rope bends: the smallest radius of a circle through three points of its centreline a
 * diameter apart along it.
 */
function tightestBend(points: Vector2[]): number {
    const s = arcLengths(points);
    let min = Infinity;
    for (let i = 0, j = 0, k = 0; i < points.length; i++) {
        while (j < points.length - 1 && s[j] < s[i] + 1) j++;
        while (k < points.length - 1 && s[k] < s[j] + 1) k++;
        if (s[k] - s[j] < 1 || s[j] - s[i] < 1) break;
        const [a, b, c] = [points[i], points[j], points[k]];
        const twiceArea = Math.abs(b.sub(a).cross(c.sub(a)));
        min = Math.min(
            min,
            (a.distanceTo(b) * b.distanceTo(c) * c.distanceTo(a)) / (2 * twiceArea),
        );
    }
    return min;
}

describe("crossings", () => {
    // A loop: up, round and back across its own start.
    const loop = (first: "plain" | "over", second: "plain" | "over"): RopePath => [
        plain("M -2 2 L -1 1"),
        (first === "over" ? over : plain)("L 1 -1"),
        plain("L 2 -2 C 2 -4, -2 -4, -2 -2 L -1 -1"),
        (second === "over" ? over : plain)("L 1 1"),
        plain("L 2 2"),
    ];

    it("sees which strand goes over", () => {
        const [c, ...rest] = crossings(loop("plain", "over"));
        expect(rest).toEqual([]);
        expect(c.at.x).toBeCloseTo(0);
        expect(c.at.y).toBeCloseTo(0);
        expect(c.over).toBe(1);
        expect(crossings(loop("over", "plain"))[0].over).toBe(0);
    });

    it("flags a crossing where neither strand, or both, go over", () => {
        expect(crossings(loop("plain", "plain"))[0].over).toBeNull();
        expect(crossings(loop("over", "over"))[0].over).toBeNull();
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

describe("FIGURE_EIGHT", () => {
    const { points, over: isOver } = centreline(FIGURE_EIGHT);
    const s = arcLengths(points);
    const found = crossings(FIGURE_EIGHT);

    it("is a figure-8, read off its shape", () => {
        expect(found).toHaveLength(4);
        for (const c of found) expect(c.over).not.toBeNull();
        const passes = passesOf(FIGURE_EIGHT);
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

    it("marks the strand going over for a diameter either side of each crossing", () => {
        // Less, and the end of the stretch drawn on top would cut across the strand underneath.
        for (const c of found) {
            const at = c.s[c.over!];
            points.forEach((_, i) => {
                if (Math.abs(s[i] - at) <= 1) expect(isOver[i]).toBe(true);
            });
        }
    });

    it("bends smoothly, with no corners", () => {
        expect(tightestBend(points)).toBeGreaterThan(1.75);
    });

    it("keeps its strands apart except where they cross", () => {
        const nearCrossing = (i: number) =>
            found.some((c) => c.s.some((at) => Math.abs(s[i] - at) < 1.5));
        for (let i = 0; i < points.length; i++)
            for (let j = i; j < points.length; j++)
                if (s[j] - s[i] > 3 && !nearCrossing(i) && !nearCrossing(j))
                    expect(points[i].distanceTo(points[j])).toBeGreaterThan(1);
    });
});

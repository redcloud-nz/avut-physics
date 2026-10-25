import { describe, expect, it } from "vitest";

import { arcLengths } from "@/lib/curve";
import { segmentIntersection } from "@/lib/geometry";
import type { Vector2 } from "@/lib/vector2";

import { FIGURE_EIGHT } from "./figure-eight";
import {
    FIGURE_EIGHT_JOINED,
    FIGURE_EIGHT_ON_A_BIGHT,
    FIGURE_EIGHT_ON_A_BIGHT_TYING,
    FIGURE_EIGHT_RETHREADED,
    FIGURE_EIGHT_RETHREADED_TYING,
} from "./figure-eight-doubled";
import { FIGURE_EIGHT_TYING } from "./figure-eight-tying";
import { knotDeterminant, type Pass } from "./invariants";
import { solveRope } from "./pinned-rope";
import {
    centreline,
    crossings,
    firstPart,
    over,
    plain,
    ropeLength,
    type RopePath,
} from "./rope-path";

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

describe("firstPart", () => {
    const length = ropeLength(FIGURE_EIGHT);

    it("is as long as asked, and follows the whole rope's path", () => {
        const whole = centreline(FIGURE_EIGHT).points;
        for (const k of [0.5, 3, 9.2, 20, length / 2, length - 0.01]) {
            const part = firstPart(FIGURE_EIGHT, k);
            expect(ropeLength(part)).toBeCloseTo(k, 6);
            const end = centreline(part).points.at(-1)!;
            expect(Math.min(...whole.map((p) => p.distanceTo(end)))).toBeLessThan(0.05);
        }
        expect(firstPart(FIGURE_EIGHT, length + 1)).toEqual(FIGURE_EIGHT);
    });

    it("has one strand over at every crossing, all the way through tying", () => {
        for (let k = 1; k <= length; k += 0.25)
            for (const c of crossings(firstPart(FIGURE_EIGHT, k))) expect(c.over).not.toBeNull();
    });
});

describe("FIGURE_EIGHT_TYING", () => {
    it("solves every step, meeting all its pins", () => {
        for (const step of FIGURE_EIGHT_TYING) expect(solveRope(step.rope!).converged).toBe(true);
    });

    it("adds crossings as it goes, each with one strand over", () => {
        const found = FIGURE_EIGHT_TYING.map((step) => crossings(step.path));
        // Steps in between, showing the next move with arrows, can repeat a count but never lose a crossing.
        const counts = found.map((c) => c.length);
        expect(counts[0]).toBe(0);
        expect(counts.at(-1)).toBe(4);
        counts.slice(1).forEach((n, i) => expect(n).toBeGreaterThanOrEqual(counts[i]));
        for (const c of found.flat()) expect(c.over).not.toBeNull();
    });

    it("bends smoothly at every step", () => {
        for (const step of FIGURE_EIGHT_TYING)
            expect(tightestBend(centreline(step.path).points)).toBeGreaterThan(1.75);
    });
});

describe("FIGURE_EIGHT_ON_A_BIGHT", () => {
    const { points, over: isOver } = centreline(FIGURE_EIGHT_ON_A_BIGHT);
    const s = arcLengths(points);
    const found = crossings(FIGURE_EIGHT_ON_A_BIGHT);

    it("crosses itself four times at each of the figure-8's crossings, one pair always over", () => {
        expect(found).toHaveLength(16);
        for (const c of found) expect(c.over).not.toBeNull();
    });

    it("marks the strand going over for a diameter either side of each crossing", () => {
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
});

describe("FIGURE_EIGHT_ON_A_BIGHT_TYING", () => {
    it("crosses itself four times at each of the single figure-8's crossings, one pair always over", () => {
        FIGURE_EIGHT_ON_A_BIGHT_TYING.forEach((step, i) => {
            const found = crossings(step.path);
            // In step 4 the fold sits below the 8, crossing nothing the single figure-8's end does there.
            const single = crossings(FIGURE_EIGHT_TYING[i].path).length - (i === 5 ? 1 : 0);
            // The last step is the knot finished, its loop opened out.
            if (i < FIGURE_EIGHT_ON_A_BIGHT_TYING.length - 1)
                expect(found).toHaveLength(4 * single);
            for (const c of found) expect(c.over).not.toBeNull();
        });
    });

    it("bends smoothly at every step, round the fold too", () => {
        for (const step of FIGURE_EIGHT_ON_A_BIGHT_TYING)
            expect(tightestBend(centreline(step.path).points)).toBeGreaterThan(1.75);
    });
});

describe("FIGURE_EIGHT_RETHREADED", () => {
    it("crosses itself as the figure-8 on a bight does, and bends smoothly round its longer loop", () => {
        const found = crossings(FIGURE_EIGHT_RETHREADED);
        expect(found).toHaveLength(16);
        for (const c of found) expect(c.over).not.toBeNull();
        expect(tightestBend(centreline(FIGURE_EIGHT_RETHREADED).points)).toBeGreaterThan(1.75);
    });
});

describe("FIGURE_EIGHT_RETHREADED_TYING", () => {
    it("keeps a figure-8 in the rope and adds crossings as the end follows it back, each with one strand over", () => {
        const found = FIGURE_EIGHT_RETHREADED_TYING.map((step) => crossings(step.path));
        expect(knotDeterminant(passesOf(FIGURE_EIGHT_RETHREADED_TYING[1].path))).toBe(5);
        expect(found.at(-1)).toHaveLength(16);
        for (const c of found.flat()) expect(c.over).not.toBeNull();
    });

    it("bends smoothly at every step, the end pulled out to the side too", () => {
        for (const step of FIGURE_EIGHT_RETHREADED_TYING)
            expect(tightestBend(centreline(step.path).points)).toBeGreaterThan(1.75);
    });
});

describe("FIGURE_EIGHT_JOINED", () => {
    const ropes = FIGURE_EIGHT_JOINED.map((path) => {
        const { points, over: isOver } = centreline(path);
        return { points, isOver, s: arcLengths(points) };
    });

    /** Where a strand of one rope crosses a strand of the other, how far along each, and whether each is marked over. */
    const between = () => {
        const [a, b] = ropes;
        const found: { s: [number, number]; over: [boolean, boolean] }[] = [];
        for (let i = 0; i < a.points.length - 1; i++)
            for (let j = 0; j < b.points.length - 1; j++) {
                const hit = segmentIntersection(
                    a.points[i],
                    a.points[i + 1],
                    b.points[j],
                    b.points[j + 1],
                );
                if (!hit) continue;
                found.push({
                    s: [
                        a.s[i] + (a.s[i + 1] - a.s[i]) * hit.t,
                        b.s[j] + (b.s[j + 1] - b.s[j]) * hit.u,
                    ],
                    over: [a.isOver[i] && a.isOver[i + 1], b.isOver[j] && b.isOver[j + 1]],
                });
            }
        return found;
    };

    it("is a figure-8 in each rope, crossing the other at each of its crossings, one pair always over", () => {
        for (const path of FIGURE_EIGHT_JOINED) {
            const found = crossings(path);
            expect(found).toHaveLength(4);
            for (const c of found) expect(c.over).not.toBeNull();
            expect(knotDeterminant(passesOf(path))).toBe(5);
        }
        // Each of the figure-8's four crossings, a strand of each rope crossing one of the other's both ways.
        const found = between();
        expect(found).toHaveLength(8);
        for (const c of found) expect(c.over[0]).not.toBe(c.over[1]);
    });

    it("bends smoothly, with no corners", () => {
        for (const { points } of ropes) expect(tightestBend(points)).toBeGreaterThan(1.75);
    });
});

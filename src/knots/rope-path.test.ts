import { describe, expect, it } from "vitest";

import { crossings, over, plain, type RopePath } from "./rope-path";

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

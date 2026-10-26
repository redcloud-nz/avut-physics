import { describe, expect, it } from "vitest";

import { bisect, rootsInUnit } from "./roots";

describe("bisect", () => {
    it("brackets where the condition stops holding", () => {
        const [a, b] = bisect((x) => x * x < 2, 0, 2, 50);
        expect(a).toBeLessThanOrEqual(Math.SQRT2);
        expect(b).toBeGreaterThanOrEqual(Math.SQRT2);
        expect(b - a).toBeLessThan(1e-12);
    });
});

describe("rootsInUnit", () => {
    it("keeps only the roots strictly between 0 and 1", () => {
        // (t − 0.25)(t − 2) and (t − 0.25)(t − 0.75).
        expect(rootsInUnit(1, -2.25, 0.5)).toEqual([0.25]);
        expect(rootsInUnit(1, -1, 0.1875)).toEqual([0.25, 0.75]);
        expect(rootsInUnit(1, 0, 1)).toEqual([]);
    });

    it("solves the linear case when a is zero", () => {
        expect(rootsInUnit(0, 2, -1)).toEqual([0.5]);
        expect(rootsInUnit(0, 0, 1)).toEqual([]);
    });
});

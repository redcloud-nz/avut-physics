import { describe, expect, it } from "vitest";

import { seededPicker } from "../random";

import { centralDifferences } from "./differences";

describe("centralDifferences", () => {
    it("matches the exact Jacobian of a nonlinear function with more outputs than inputs", () => {
        const f = ([x, y]: number[]) => [Math.sin(x) * y, Math.exp(x - y), x * x * y * y * y];
        const exact = ([x, y]: number[]) => [
            [Math.cos(x) * y, Math.sin(x)],
            [Math.exp(x - y), -Math.exp(x - y)],
            [2 * x * y ** 3, 3 * x * x * y * y],
        ];
        const pick = seededPicker(15);
        for (let k = 0; k < 20; k++) {
            const at = [pick(-2, 2, 0.01), pick(-2, 2, 0.01)];
            const J = centralDifferences(f, at, [1e-5, 1e-5])!;
            expect(J).toHaveLength(3);
            J.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(exact(at)[i][j], 7)));
        }
    });

    it("is exact for quadratics, up to rounding, even with large steps", () => {
        const J = centralDifferences(([x, y]) => [x * x + 3 * x * y], [2, 5], [0.5, 0.5])!;
        expect(J[0][0]).toBeCloseTo(2 * 2 + 3 * 5, 12);
        expect(J[0][1]).toBeCloseTo(3 * 2, 12);
    });

    it("steps each input by its own amount", () => {
        const calls: number[][] = [];
        centralDifferences((x) => (calls.push(x), [0]), [10, 20], [0.1, 2]);
        expect(calls).toEqual([
            [10.1, 20],
            [9.9, 20],
            [10, 22],
            [10, 18],
        ]);
    });

    it("returns null if the function fails at any of the points it tries", () => {
        // Fails only just past y = 3, which only the step up in y reaches.
        expect(
            centralDifferences(([x, y]) => (y > 3 ? null : [x + y]), [0, 3], [1e-6, 1e-6]),
        ).toBeNull();
        expect(
            centralDifferences(([x, y]) => (y > 3.1 ? null : [x + y]), [0, 3], [1e-6, 1e-6]),
        ).not.toBeNull();
    });
});

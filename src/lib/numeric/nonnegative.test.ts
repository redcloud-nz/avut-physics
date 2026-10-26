import { describe, expect, it } from "vitest";

import { leastSquares, type Matrix } from "./linear";
import { nonNegativeLeastSquares } from "./nonnegative";

describe("nonNegativeLeastSquares", () => {
    const multiply = (A: Matrix, x: number[]) =>
        A.map((row) => row.reduce((s, v, j) => s + v * x[j], 0));

    it("matches the ordinary solution when that's already non-negative", () => {
        const A = [
            [2, 1],
            [1, 3],
            [0, 1],
        ];
        const b = [5, 10, 3];
        const x = nonNegativeLeastSquares(A, b);
        const free = leastSquares(A, b, 0)!;
        x.forEach((v, i) => expect(v).toBeCloseTo(free[i], 10));
    });

    it("holds at zero what the ordinary solution would make negative", () => {
        // Unconstrained, x = (2, −1); kept non-negative, x₂ = 0 and x₁ fits b alone.
        const A = [
            [1, 0],
            [0, 1],
            [1, 1],
        ];
        const x = nonNegativeLeastSquares(A, [2, -1, 1]);
        expect(x[1]).toBe(0);
        expect(x[0]).toBeCloseTo(1.5, 12);
    });

    it("meets b exactly when it can, choosing the shortest x with damping", () => {
        // Two equal columns: any split of 4 between them meets b; the shortest is even.
        const A = [
            [1, 1],
            [1, 1],
        ];
        const x = nonNegativeLeastSquares(A, [4, 4], 1e-9);
        expect(x[0]).toBeCloseTo(2, 6);
        expect(x[1]).toBeCloseTo(2, 6);
        for (const v of multiply(A, x)) expect(v).toBeCloseTo(4, 6);
    });

    it("is zero when every column points away from b", () => {
        expect(nonNegativeLeastSquares([[1], [1]], [-1, -2])).toEqual([0]);
    });
});

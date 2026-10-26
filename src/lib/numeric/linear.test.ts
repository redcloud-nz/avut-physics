import { describe, expect, it } from "vitest";

import { seededPicker } from "../random";

import { leastSquares, maxAbs, solveLinear, transpose, withColumns, type Matrix } from "./linear";

/** Ax, for checking a solution by putting it back in. */
const times = (A: Matrix, x: number[]) =>
    A.map((row) => row.reduce((sum, v, j) => sum + v * x[j], 0));

/** A random n×n matrix whose diagonal outweighs the rest of its row, so it's never singular. */
function dominantMatrix(pick: ReturnType<typeof seededPicker>, n: number): Matrix {
    return Array.from({ length: n }, (_, i) => {
        const row = Array.from({ length: n }, () => pick(-10, 10, 0.01));
        row[i] = (row.reduce((sum, v) => sum + Math.abs(v), 0) + 1) * (pick(0, 1, 1) ? 1 : -1);
        return row;
    });
}

describe("solveLinear", () => {
    it("solves random well-posed systems from 1×1 to 6×6", () => {
        const pick = seededPicker(11);
        for (let n = 1; n <= 6; n++) {
            for (let k = 0; k < 20; k++) {
                const A = dominantMatrix(pick, n);
                const b = Array.from({ length: n }, () => pick(-100, 100, 0.01));
                const x = solveLinear(A, b)!;
                expect(x).toHaveLength(n);
                expect(maxAbs(times(A, x).map((v, i) => v - b[i]))).toBeLessThan(1e-9);
            }
        }
    });

    it("swaps rows when a diagonal entry is zero", () => {
        expect(
            solveLinear(
                [
                    [0, 1],
                    [1, 0],
                ],
                [2, 3],
            ),
        ).toEqual([3, 2]);
        expect(
            solveLinear(
                [
                    [0, 0, 1],
                    [0, 1, 0],
                    [1, 0, 0],
                ],
                [1, 2, 3],
            ),
        ).toEqual([3, 2, 1]);
    });

    it("pivots on the largest entry, so a tiny one doesn't swamp the answer", () => {
        // Eliminating with the 1e-20 as pivot loses the second equation entirely.
        const [x, y] = solveLinear(
            [
                [1e-20, 1],
                [1, 1],
            ],
            [1, 2],
        )!;
        expect(x).toBeCloseTo(1, 12);
        expect(y).toBeCloseTo(1, 12);
    });

    it("returns null for singular systems", () => {
        expect(
            solveLinear(
                [
                    [1, 2],
                    [2, 4],
                ],
                [1, 2],
            ),
        ).toBeNull();
        expect(
            solveLinear(
                [
                    [1, 2, 3],
                    [4, 5, 6],
                    [5, 7, 9],
                ],
                [1, 2, 3],
            ),
        ).toBeNull();
        expect(solveLinear([[0]], [1])).toBeNull();
    });

    it("treats pivots under 1e-12 as zero, however the system is scaled", () => {
        // An absolute cutoff: the solvers' systems are in newtons and metres, well above it.
        expect(
            solveLinear(
                [
                    [1e-13, 0],
                    [0, 1e-13],
                ],
                [1, 1],
            ),
        ).toBeNull();
        expect(
            solveLinear(
                [
                    [1e-11, 0],
                    [0, 1e-11],
                ],
                [1, 1],
            ),
        ).toEqual([1e11, 1e11]);
    });

    it("leaves its inputs unchanged", () => {
        const A = [
            [0, 1],
            [1, 0],
        ];
        const b = [2, 3];
        solveLinear(A, b);
        expect(A).toEqual([
            [0, 1],
            [1, 0],
        ]);
        expect(b).toEqual([2, 3]);
    });
});

describe("leastSquares", () => {
    it("agrees with solveLinear on random square systems", () => {
        const pick = seededPicker(12);
        for (let k = 0; k < 30; k++) {
            const n = 1 + (k % 5);
            const A = dominantMatrix(pick, n);
            const b = Array.from({ length: n }, () => pick(-100, 100, 0.01));
            const expected = solveLinear(A, b)!;
            leastSquares(A, b, 0)!.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 8));
        }
    });

    it("fits a line exactly through points on it", () => {
        const xs = [0, 1, 2, 3, 4];
        const [c, m] = leastSquares(
            xs.map((x) => [1, x]),
            xs.map((x) => 3 * x - 2),
            0,
        )!;
        expect(c).toBeCloseTo(-2, 10);
        expect(m).toBeCloseTo(3, 10);
    });

    it("fits a line through scattered points as the textbook formulas do", () => {
        const pick = seededPicker(13);
        const xs = Array.from({ length: 30 }, () => pick(-5, 5, 0.01));
        const ys = xs.map((x) => 2 * x + 1 + pick(-0.5, 0.5, 0.01));
        const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
        const [mx, my] = [mean(xs), mean(ys)];
        const slope =
            xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) /
            xs.reduce((s, x) => s + (x - mx) ** 2, 0);
        const [c, m] = leastSquares(
            xs.map((x) => [1, x]),
            ys,
            0,
        )!;
        expect(m).toBeCloseTo(slope, 10);
        expect(c).toBeCloseTo(my - slope * mx, 10);
    });

    it("leaves the residual at right angles to every column", () => {
        const pick = seededPicker(14);
        const A = Array.from({ length: 8 }, () =>
            Array.from({ length: 3 }, () => pick(-5, 5, 0.01)),
        );
        const b = Array.from({ length: 8 }, () => pick(-5, 5, 0.01));
        const x = leastSquares(A, b, 0)!;
        const r = times(A, x).map((v, i) => v - b[i]);
        expect(maxAbs(times(transpose(A), r))).toBeLessThan(1e-9);
    });

    it("shrinks the answer towards zero as the damping grows", () => {
        // One unknown: x = ab / (a² + damping).
        expect(leastSquares([[2]], [6], 0)![0]).toBeCloseTo(3, 12);
        expect(leastSquares([[2]], [6], 4)![0]).toBeCloseTo(1.5, 12);
        expect(leastSquares([[2]], [6], 1e9)![0]).toBeLessThan(1e-7);
    });

    it("needs damping to pick an answer when there are more unknowns than equations", () => {
        expect(leastSquares([[1, 1]], [2], 0)).toBeNull();
        // A touch of damping picks the smallest of the answers: x = y = 1.
        const [x, y] = leastSquares([[1, 1]], [2], 1e-9)!;
        expect(x).toBeCloseTo(1, 6);
        expect(y).toBeCloseTo(1, 6);
    });
});

describe("transpose and withColumns", () => {
    it("transposes back to where it started", () => {
        const A = [
            [1, 2, 3],
            [4, 5, 6],
        ];
        expect(transpose(A)).toEqual([
            [1, 4],
            [2, 5],
            [3, 6],
        ]);
        expect(transpose(transpose(A))).toEqual(A);
        expect(transpose([])).toEqual([]);
    });

    it("appends columns, padding short ones with zeros", () => {
        expect(
            withColumns(
                [[1], [2], [3]],
                [
                    [7, 8],
                    [9, 9, 9],
                ],
            ),
        ).toEqual([
            [1, 7, 9],
            [2, 8, 9],
            [3, 0, 9],
        ]);
        expect(withColumns([[1], [2]], [])).toEqual([[1], [2]]);
    });
});

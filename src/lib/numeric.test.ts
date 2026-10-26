import { describe, expect, it } from "vitest";

import {
    centralDifferences,
    gridMinima,
    leastSquares,
    nelderMead,
    nonNegativeLeastSquares,
    solveLinear,
    transpose,
    withColumns,
    type Matrix,
} from "./numeric";
import { seededPicker } from "./random";

/** Ax, for checking a solution by putting it back in. */
const times = (A: Matrix, x: number[]) =>
    A.map((row) => row.reduce((sum, v, j) => sum + v * x[j], 0));
const maxAbs = (v: number[]) => Math.max(...v.map(Math.abs));

/** A random n×n matrix whose diagonal outweighs the rest of its row, so it's never singular. */
function dominantMatrix(pick: ReturnType<typeof seededPicker>, n: number): Matrix {
    return Array.from({ length: n }, (_, i) => {
        const row = Array.from({ length: n }, () => pick(-10, 10, 0.01));
        row[i] = (row.reduce((sum, v) => sum + Math.abs(v), 0) + 1) * (pick(0, 1, 1) ? 1 : -1);
        return row;
    });
}

describe("nelderMead", () => {
    it("follows the Rosenbrock function's curved valley to its minimum", () => {
        const rosenbrock = ([x, y]: number[]) => (1 - x) ** 2 + 100 * (y - x * x) ** 2;
        const [x, y] = nelderMead(rosenbrock, [-1.2, 1], 0.1);
        expect(x).toBeCloseTo(1, 5);
        expect(y).toBeCloseTo(1, 5);
    });

    it("minimises in one dimension", () => {
        const [x] = nelderMead(([x]) => Math.cos(x), [3], 0.1);
        expect(x).toBeCloseTo(Math.PI, 6);
    });

    it("minimises a badly scaled, rotated quadratic in four dimensions", () => {
        const target = [1, -2, 3, -4];
        const f = (x: number[]) => {
            const d = x.map((v, i) => v - target[i]);
            return (
                1000 * (d[0] + d[1]) ** 2 +
                (d[0] - d[1]) ** 2 +
                10 * d[2] ** 2 +
                0.1 * (d[3] + d[2]) ** 2
            );
        };
        const x = nelderMead(f, [0, 0, 0, 0], 0.5);
        x.forEach((v, i) => expect(v).toBeCloseTo(target[i], 4));
    });

    it("walks far beyond its first step to reach a distant minimum", () => {
        const [x] = nelderMead(([x]) => (x - 50) ** 2, [0], 0.1);
        expect(x).toBeCloseTo(50, 6);
    });

    it("settles on the corner of a function that isn't smooth there", () => {
        const [x, y] = nelderMead(([x, y]) => Math.abs(x - 1) + 2 * Math.abs(y + 1), [3, 3], 0.5);
        expect(x).toBeCloseTo(1, 6);
        expect(y).toBeCloseTo(-1, 6);
    });

    it("stays inside a region walled off by infinite values, up against the wall", () => {
        // As the solvers' penalised energies do where a placement is impossible.
        const [x] = nelderMead(([x]) => (x < 1 ? (x - 2) ** 2 : Infinity), [0], 0.1);
        expect(x).toBeLessThan(1);
        expect(x).toBeCloseTo(1, 6);
    });

    it("gets to the bottom of a bowl with fine bumps on it, which strand the simplex without its shrinks and restarts", () => {
        // The bumps are a square wave ±0.01, so the lowest the function goes is just under −0.01, next to (1, 1).
        for (const freq of [1e4, 1e5]) {
            const f = ([x, y]: number[]) =>
                (x - 1) ** 2 +
                (y - 1) ** 2 +
                0.01 * Math.sign(Math.sin(freq * x) * Math.sin(freq * y));
            for (const start of [
                [0, 0],
                [-2, 3],
                [4, -1],
            ]) {
                expect(f(nelderMead(f, start, 1)) + 0.01).toBeLessThan(1e-8);
            }
        }
    });

    it("stays put when it starts at the minimum", () => {
        expect(nelderMead(([x, y]) => x * x + y * y, [0, 0], 1)).toEqual([0, 0]);
    });

    it("leaves its starting point unchanged", () => {
        const start = [5, 5];
        nelderMead(([x, y]) => x * x + y * y, start, 1);
        expect(start).toEqual([5, 5]);
    });
});

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

describe("gridMinima", () => {
    it("finds every local minimum of random grids, lowest first", () => {
        const pick = seededPicker(16);
        const offsets = [-1, 0, 1]
            .flatMap((di) => [-1, 0, 1].map((dj) => [di, dj]))
            .filter(([di, dj]) => di || dj);
        for (let k = 0; k < 20; k++) {
            const [ni, nj] = [3 + (k % 4), 3 + (k % 5)];
            const grid = Array.from({ length: ni }, () =>
                Array.from({ length: nj }, () => pick(0, 100, 0.01)),
            );
            const wrapped = (i: number, j: number) => grid[(i + ni) % ni][(j + nj) % nj];
            const expected = grid
                .flatMap((row, i) => row.map((e, j) => ({ i, j, e })))
                .filter(({ i, j, e }) => offsets.every(([di, dj]) => wrapped(i + di, j + dj) >= e));
            const found = gridMinima(grid);
            expect(found.map(({ e }) => e)).toEqual(
                [...found.map(({ e }) => e)].sort((a, b) => a - b),
            );
            expect(new Set(found.map(({ i, j }) => `${i},${j}`))).toEqual(
                new Set(expected.map(({ i, j }) => `${i},${j}`)),
            );
        }
    });

    it("wraps round the edges, so a corner's neighbours include the opposite corner", () => {
        const grid = [
            [1, 5, 5, 5],
            [5, 5, 5, 5],
            [5, 5, 4, 5],
            [5, 5, 5, 0],
        ];
        // (0, 0) is lowest of the cells beside it in the grid, but (3, 3) is diagonally beside it across both edges.
        expect(gridMinima(grid).map(({ i, j }) => [i, j])).toEqual([[3, 3]]);
    });

    it("counts every cell of a flat stretch, since none has a lower neighbour", () => {
        expect(
            gridMinima([
                [2, 2, 2],
                [2, 2, 2],
                [2, 2, 2],
            ]),
        ).toHaveLength(9);
    });

    it("skips impossible (infinite) and undefined (NaN) cells, without letting them block their neighbours", () => {
        const grid = [
            [9, 9, 9],
            [9, 1, NaN],
            [9, 9, Infinity],
        ];
        expect(gridMinima(grid).map(({ i, j }) => [i, j])).toEqual([[1, 1]]);
    });

    it("handles an empty grid", () => {
        expect(gridMinima([])).toEqual([]);
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

import { describe, expect, it } from "vitest";

import { seededPicker } from "../random";

import { gridMinima, nelderMead } from "./minimise";

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

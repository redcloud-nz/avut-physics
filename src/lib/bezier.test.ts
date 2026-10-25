import { describe, expect, it } from "vitest";

import { Cubic } from "./bezier";
import { arcLengths } from "./curve";
import { vec2, type Vector2 } from "./vector2";

/** The usual cubic for a quarter of the unit circle, from (1, 0) round to (0, 1), its handles k long. */
const K = (4 / 3) * Math.tan(Math.PI / 8);
const QUARTER = new Cubic(vec2(1, 0), vec2(1, K), vec2(K, 1), vec2(0, 1));

/** An S-shaped cubic, curving both ways. */
const S = new Cubic(vec2(0, 0), vec2(4, 3), vec2(-1, 5), vec2(3, 8));

const close = (a: Vector2, b: Vector2, digits = 9) => {
    expect(a.x).toBeCloseTo(b.x, digits);
    expect(a.y).toBeCloseTo(b.y, digits);
};

/** The length of a polyline through `n` + 1 points along the curve. */
const polylineLength = (c: Cubic, n: number) => arcLengths(c.points(n)).at(-1)!;

describe("Cubic", () => {
    it("starts and ends at its end points, heading at its control points", () => {
        close(S.pointAt(0), S.p0);
        close(S.pointAt(1), S.p3);
        close(S.derivativeAt(0), S.p1.sub(S.p0).scale(3));
        close(S.derivativeAt(1), S.p3.sub(S.p2).scale(3));
    });

    it("has derivatives matching its points' differences", () => {
        const h = 1e-5;
        for (const t of [0.1, 0.4, 0.75]) {
            close(
                S.derivativeAt(t),
                S.pointAt(t + h)
                    .sub(S.pointAt(t - h))
                    .scale(1 / (2 * h)),
                5,
            );
            close(
                S.secondDerivativeAt(t),
                S.derivativeAt(t + h)
                    .sub(S.derivativeAt(t - h))
                    .scale(1 / (2 * h)),
                5,
            );
        }
    });

    it("splits into two halves that meet, and follow the whole", () => {
        const [a, b] = S.split(0.3);
        close(a.p3, b.p0);
        close(a.p3, S.pointAt(0.3));
        for (const k of [0, 0.25, 0.5, 0.9, 1]) {
            close(a.pointAt(k), S.pointAt(0.3 * k));
            close(b.pointAt(k), S.pointAt(0.3 + 0.7 * k));
        }
        expect(a.length() + b.length()).toBeCloseTo(S.length(), 9);
    });

    it("takes out the part between two places", () => {
        const part = S.between(0.2, 0.7);
        close(part.pointAt(0), S.pointAt(0.2));
        close(part.pointAt(1), S.pointAt(0.7));
        close(part.pointAt(0.5), S.pointAt(0.45));
    });

    it("measures a straight line", () => {
        const line = Cubic.line(vec2(1, 2), vec2(4, 6));
        expect(line.length()).toBeCloseTo(5, 12);
        expect(line.lengthTo(0.5)).toBeCloseTo(2.5, 12);
        // Bunched-up control points move along the line unevenly, but its length is the same.
        const uneven = new Cubic(vec2(0, 0), vec2(0.1, 0), vec2(0.2, 0), vec2(5, 0));
        expect(uneven.length()).toBeCloseTo(5, 9);
    });

    it("measures the quarter-circle cubic as nearly π/2", () => {
        expect(QUARTER.length()).toBeCloseTo(Math.PI / 2, 3);
        expect(Math.abs(QUARTER.length() - polylineLength(QUARTER, 100_000))).toBeLessThan(1e-6);
    });

    it("measures a curve that bends both ways as its fine polyline does", () => {
        expect(Math.abs(S.length() - polylineLength(S, 100_000))).toBeLessThan(1e-6);
        for (const t of [0.2, 0.5, 0.8]) {
            const [before] = S.split(t);
            expect(Math.abs(S.lengthTo(t) - polylineLength(before, 100_000))).toBeLessThan(1e-6);
        }
    });

    it("finds where along it a length is", () => {
        for (const t of [0, 0.13, 0.5, 0.92, 1])
            expect(S.tAtLength(S.lengthTo(t))).toBeCloseTo(t, 9);
        expect(S.tAtLength(-1)).toBe(0);
        expect(S.tAtLength(S.length() + 1)).toBe(1);
    });

    it("bends with the circle's radius along the quarter-circle cubic", () => {
        // The cubic is close to the circle, not on it: its radius strays a few percent from 1.
        for (const t of [0, 0.3, 0.5, 1])
            expect(Math.abs(1 / QUARTER.curvatureAt(t) - 1)).toBeLessThan(0.03);
        const { radius } = QUARTER.tightest();
        expect(radius).toBeGreaterThan(0.97);
        expect(radius).toBeLessThan(1);
        // The same curve twice the size bends half as tightly.
        const big = new Cubic(
            QUARTER.p0.scale(2),
            QUARTER.p1.scale(2),
            QUARTER.p2.scale(2),
            QUARTER.p3.scale(2),
        );
        expect(big.tightest().radius).toBeCloseTo(2 * radius, 9);
    });

    it("finds its tightest bend between samples", () => {
        // A lopsided hairpin, its tightest bend away from any of the samples.
        const hairpin = new Cubic(vec2(0, 0), vec2(10, 0), vec2(7, 1), vec2(0, 1.3));
        const { radius, t } = hairpin.tightest();
        const fine = Math.min(
            ...Array.from(
                { length: 100_001 },
                (_, k) => 1 / Math.abs(hairpin.curvatureAt(k / 1e5)),
            ),
        );
        expect(radius).toBeCloseTo(1 / Math.abs(hairpin.curvatureAt(t)), 9);
        expect(radius).toBeLessThanOrEqual(fine + 1e-9);
        expect(radius).toBeGreaterThan(fine - 1e-6);
        expect(Cubic.line(vec2(0, 0), vec2(1, 1)).tightest().radius).toBe(Infinity);
    });

    it("finds the stretches bending tighter than a radius", () => {
        const hairpin = new Cubic(vec2(0, 0), vec2(10, 0), vec2(10, 1), vec2(0, 1));
        const [range, ...rest] = hairpin.tighterThan(1.75);
        expect(rest).toEqual([]);
        expect(range[0]).toBeLessThan(0.5);
        expect(range[1]).toBeGreaterThan(0.5);
        expect(1 / Math.abs(hairpin.curvatureAt(range[0]))).toBeCloseTo(1.75, 6);
        expect(1 / Math.abs(hairpin.curvatureAt(range[1]))).toBeCloseTo(1.75, 6);
        expect(QUARTER.tighterThan(0.9)).toEqual([]);
        expect(QUARTER.tighterThan(1.1)).toEqual([[0, 1]]);
    });

    it("bounds itself, including where it bulges past its ends", () => {
        const { min, max } = S.bounds();
        const points = S.points(10_000);
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        expect(min.x).toBeCloseTo(Math.min(...xs), 6);
        expect(max.x).toBeCloseTo(Math.max(...xs), 6);
        expect(min.y).toBeCloseTo(Math.min(...ys), 6);
        expect(max.y).toBeCloseTo(Math.max(...ys), 6);
        const arch = new Cubic(vec2(-2, 0), vec2(-2, 3), vec2(2, 3), vec2(2, 0));
        expect(arch.bounds().max.y).toBeCloseTo(2.25, 12);
    });

    it("samples points from its start to its end", () => {
        const points = S.points(4);
        expect(points).toHaveLength(5);
        expect(points[0]).toBe(S.p0);
        expect(points[4]).toBe(S.p3);
        close(points[2], S.pointAt(0.5));
    });
});

describe("Cubic crossings", () => {
    it("finds a single crossing, to the point", () => {
        const a = new Cubic(vec2(-2, 0), vec2(-1, 1), vec2(1, -1), vec2(2, 0));
        const b = new Cubic(vec2(0.3, -2), vec2(0.5, -1), vec2(0, 1), vec2(0.2, 2));
        const [hit, ...rest] = a.crossings(b);
        expect(rest).toEqual([]);
        close(a.pointAt(hit.t), b.pointAt(hit.u), 10);
        close(hit.at, a.pointAt(hit.t));
    });

    it("finds two crossings, in order along the first", () => {
        const arch = new Cubic(vec2(-2, 0), vec2(-2, 3), vec2(2, 3), vec2(2, 0));
        const line = Cubic.line(vec2(-3, 1), vec2(3, 1));
        const hits = arch.crossings(line);
        expect(hits).toHaveLength(2);
        expect(hits[0].t).toBeLessThan(hits[1].t);
        for (const h of hits) {
            expect(h.at.y).toBeCloseTo(1, 10);
            close(line.pointAt(h.u), h.at, 10);
        }
        expect(hits[0].at.x).toBeCloseTo(-hits[1].at.x, 10);
    });

    it("finds none between curves that miss", () => {
        const arch = new Cubic(vec2(-2, 0), vec2(-2, 3), vec2(2, 3), vec2(2, 0));
        expect(arch.crossings(Cubic.line(vec2(-3, 3), vec2(3, 3)))).toEqual([]);
        expect(arch.crossings(Cubic.line(vec2(-1, 0), vec2(1, 0)))).toEqual([]);
    });

    it("doesn't find two curves meeting end to start", () => {
        const a = new Cubic(vec2(0, 0), vec2(1, 1), vec2(2, 1), vec2(3, 0));
        const b = new Cubic(vec2(3, 0), vec2(4, -1), vec2(5, -1), vec2(6, 0));
        expect(a.crossings(b)).toEqual([]);
    });
});

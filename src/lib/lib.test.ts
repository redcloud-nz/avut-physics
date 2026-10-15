import { describe, expect, it } from "vitest";
import { nearestOnSegment, segmentDistance, segmentGap } from "./geometry";
import { clamp, linearScale } from "./math";
import { centralDifferences, gridMinima, leastSquares, nelderMead, solveLinear } from "./numeric";
import { vec2 } from "./vector2";
import { vec3 } from "./vector3";

describe("Vector2", () => {
  it("does arithmetic without changing its operands", () => {
    const a = vec2(3, 4);
    expect(a.add(vec2(1, 1))).toEqual(vec2(4, 5));
    expect(a.sub(vec2(1, 1))).toEqual(vec2(2, 3));
    expect(a.scale(2)).toEqual(vec2(6, 8));
    expect(a).toEqual(vec2(3, 4));
    expect(a.len()).toBe(5);
    expect(a.dot(vec2(1, 2))).toBe(11);
    expect(vec2(1, 0).cross(vec2(0, 1))).toBe(1);
    expect(vec2(1, 0).perp()).toEqual(vec2(-0, 1));
  });

  it("keeps a direction only when it has one", () => {
    expect(vec2(0, 2).unit()).toEqual(vec2(0, 1));
    expect(vec2(0, 0).safeUnit(vec2(1, 0))).toEqual(vec2(1, 0));
    expect(vec2(6, 8).clampLen(5)).toEqual(vec2(3, 4));
    expect(vec2(3, 4).clampLen(10)).toEqual(vec2(3, 4));
  });
});

describe("Vector3", () => {
  it("crosses, measures angles and projects", () => {
    expect(vec3(1, 0, 0).cross(vec3(0, 1, 0))).toEqual(vec3(0, 0, 1));
    expect(vec3(1, 0, 0).angleTo(vec3(0, 2, 0))).toBeCloseTo(Math.PI / 2);
    expect(vec3(1, 1, 0).angleTo(vec3(2, 2, 0))).toBeCloseTo(0, 6);
    expect(vec3(1, 2, 3).mirrorZ()).toEqual(vec3(1, 2, -3));
    expect(vec3(1, 2, 3).xy()).toEqual(vec2(1, 2));
  });
});

describe("geometry", () => {
  it("finds the nearest point on a segment, clamped to its ends", () => {
    expect(nearestOnSegment(vec2(1, 1), vec2(0, 0), vec2(2, 0))).toEqual({ point: vec2(1, 0), t: 0.5 });
    expect(nearestOnSegment(vec2(5, 1), vec2(0, 0), vec2(2, 0)).t).toBe(1);
    expect(segmentDistance(vec2(-3, 4), vec2(0, 0), vec2(2, 0))).toBe(5);
  });

  it("measures the gap between segments, zero where they cross", () => {
    expect(segmentGap(vec2(0, 0), vec2(2, 2), vec2(0, 2), vec2(2, 0))).toBe(0);
    expect(segmentGap(vec2(0, 0), vec2(2, 0), vec2(0, 1), vec2(2, 1))).toBe(1);
  });
});

describe("math", () => {
  it("clamps and scales", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(linearScale([0, 10], [100, 0])(2.5)).toBe(75);
  });
});

describe("numeric", () => {
  it("minimises", () => {
    const [x, y] = nelderMead(([x, y]) => (x - 1) ** 2 + (y + 2) ** 2, [0, 0], 0.5);
    expect(x).toBeCloseTo(1, 6);
    expect(y).toBeCloseTo(-2, 6);
  });

  it("solves linear systems, and least squares on overdetermined ones", () => {
    const [x, y] = solveLinear([[2, 1], [1, 3]], [3, 5])!;
    expect(x).toBeCloseTo(0.8);
    expect(y).toBeCloseTo(1.4);
    expect(solveLinear([[1, 2], [2, 4]], [1, 2])).toBeNull();
    // The best fit of y = c through 1, 2 and 3 is their mean.
    expect(leastSquares([[1], [1], [1]], [1, 2, 3], 0)![0]).toBeCloseTo(2);
  });

  it("differentiates numerically", () => {
    const J = centralDifferences(([x, y]) => [x * y, x + 2 * y], [2, 3], [1e-6, 1e-6])!;
    expect(J[0][0]).toBeCloseTo(3);
    expect(J[0][1]).toBeCloseTo(2);
    expect(J[1][0]).toBeCloseTo(1);
    expect(J[1][1]).toBeCloseTo(2);
    expect(centralDifferences(() => null, [0], [1])).toBeNull();
  });

  it("finds a wrapped grid's local minima, lowest first", () => {
    const grid = [
      [9, 8, 7, 6],
      [8, 1, 8, 5],
      [7, 8, 9, 0],
      [6, 7, 8, Infinity],
    ];
    expect(gridMinima(grid).map(({ i, j }) => [i, j])).toEqual([[2, 3], [1, 1]]);
  });
});

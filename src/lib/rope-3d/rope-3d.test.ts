import { describe, expect, it } from "vitest";

import { vec3, type Vector3 } from "@/lib/vector3";

import { curveThrough } from "./curve";
import {
    moveHandle,
    runToEnd,
    smoothInPlay,
    stretchOf,
    tightenInPlay,
    tightenWholeKnot,
} from "./operations";
import {
    arcLengths,
    countsOf,
    redistribute,
    respaceFree,
    segmentCentre,
    segmentCount,
    segmentMiddle,
    segmentsOf,
    slideBoundary,
    type Rope3,
    type RopeSetup,
} from "./rope";

const D = 0.011;
const SETUP: RopeSetup = { diameter: D, minBend: D, stiffness: 0.05, bars: [] };

/** A rope along `path` (corner points), its points a quarter of a diameter apart, in segments 20 mm long. */
function ropeAlong(path: Vector3[]): Rope3 {
    const points: Vector3[] = [path[0]];
    for (let k = 1; k < path.length; k++) {
        const [a, b] = [path[k - 1], path[k]];
        const n = Math.max(1, Math.round(a.distanceTo(b) / (D / 4)));
        for (let i = 1; i <= n; i++) points.push(a.lerp(b, i / n));
    }
    return { points, seg: segmentsOf(points, 0.02) };
}

const length = (rope: Rope3) => arcLengths(rope.points).at(-1)!;

/** Segments are numbered 1 to `count` in order, each with a point. */
function expectSegments(rope: Rope3, count: number) {
    expect(rope.seg.length).toBe(rope.points.length);
    expect(rope.seg[0]).toBe(1);
    expect(rope.seg.at(-1)).toBe(count);
    for (let i = 1; i < rope.seg.length; i++)
        expect(rope.seg[i] - rope.seg[i - 1]).toBeGreaterThanOrEqual(0);
    expect(countsOf(rope.seg).every((c) => c >= 1)).toBe(true);
    expect(countsOf(rope.seg).length).toBe(count);
}

/** The nearest any two points come that are further apart along the rope than a tight bend can bring them. */
function closestApart(rope: Rope3): number {
    const arc = arcLengths(rope.points);
    let least = Infinity;
    for (let i = 0; i < rope.points.length; i++)
        for (let j = i + 1; j < rope.points.length; j++)
            if (arc[j] - arc[i] > Math.PI * D)
                least = Math.min(least, rope.points[i].distanceTo(rope.points[j]));
    return least;
}

describe("segments", () => {
    const rope = ropeAlong([vec3(0, 0, 0), vec3(0.2, 0, 0)]);

    it("splits a rope into even segments", () => {
        expectSegments(rope, 10);
        expect(segmentCentre(rope, 1).x).toBeCloseTo(0.01, 2);
    });

    it("redistributes boundaries evenly, keeping the count", () => {
        const uneven = slideBoundary(rope, 3, 4);
        const even = redistribute(uneven);
        expect(countsOf(even.seg)).toEqual(countsOf(rope.seg));
    });

    it("slides a boundary, never emptying a segment", () => {
        const slid = slideBoundary(rope, 3, 100);
        expectSegments(slid, 10);
        expect(countsOf(slid.seg)[3]).toBe(1);
    });

    it("respaces free runs and leaves kept points exactly", () => {
        const kept = rope.seg.map((s) => s <= 2 || s >= 9);
        const out = respaceFree(rope, kept, D / 2);
        expectSegments(out, 10);
        expect(out.points.slice(0, 10)).toEqual(rope.points.slice(0, 10));
        expect(out.points.at(-1)).toEqual(rope.points.at(-1));
    });
});

describe("the curve through the handle", () => {
    it("leaves and joins along the locked ends' directions and passes through the handle", () => {
        const start = { at: vec3(0, 0, 0), dir: vec3(1, 0, 0) };
        const end = { at: vec3(0.1, 0, 0), dir: vec3(1, 0, 0) };
        const handle = vec3(0.05, 0.03, 0);
        const { before, after } = curveThrough(start, handle, end);
        expect(before.points[0]).toEqual(start.at);
        expect(before.points.at(-1)!.distanceTo(handle)).toBeLessThan(1e-12);
        expect(after.points.at(-1)!.distanceTo(end.at)).toBeLessThan(1e-12);
        const leaving = before.points[1].sub(before.points[0]).unit();
        expect(leaving.dot(start.dir)).toBeGreaterThan(0.99);
        const joining = after.points.at(-1)!.sub(after.points.at(-2)!).unit();
        expect(joining.dot(end.dir)).toBeGreaterThan(0.99);
    });
});

describe("moving the handle", () => {
    const rope = ropeAlong([vec3(0, 0, 0), vec3(0.3, 0, 0)]);
    const play = { from: 6, to: 10, handle: 8 };

    it("brings the handle to the goal, growing the rope in play, and leaves fixed rope exactly", () => {
        const goal = segmentMiddle(rope, 8).add(vec3(0, 0.04, 0));
        const moved = moveHandle(rope, SETUP, play, goal);
        expect(segmentMiddle(moved, 8).distanceTo(goal)).toBeLessThan(5e-4);
        expect(length(moved)).toBeGreaterThan(length(rope) + 0.02);
        expectSegments(moved, segmentCount(rope));
        const { a } = stretchOf(rope, play);
        expect(moved.points.slice(0, a)).toEqual(rope.points.slice(0, a));
        const after = rope.seg.filter((s) => s > 10).length;
        expect(moved.points.slice(-after)).toEqual(rope.points.slice(-after));
    });

    it("stops against a bar rather than passing through it", () => {
        const bar = { at: vec3(0.15, 0.025, 0), along: vec3(0, 0, 1), r: 0.005 };
        const setup = { ...SETUP, bars: [bar] };
        const moved = moveHandle(rope, setup, play, segmentCentre(rope, 8).add(vec3(0, 0.06, 0)));
        const want = bar.r + D / 2;
        for (const p of moved.points)
            expect(Math.hypot(p.x - bar.at.x, p.y - bar.at.y)).toBeGreaterThan(want * 0.97);
        expect(segmentCentre(moved, 8).y).toBeLessThan(bar.at.y);
    });

    it("stops against fixed rope rather than passing through it", () => {
        // A U: two legs 40 mm apart, joined round a bend; one leg's middle pushed towards the other.
        const u = ropeAlong([
            vec3(0, 0, 0),
            vec3(0.2, 0, 0),
            vec3(0.22, 0.02, 0),
            vec3(0.2, 0.04, 0),
            vec3(0, 0.04, 0),
        ]);
        const count = segmentCount(u);
        const legPlay = { from: count - 7, to: count - 3, handle: count - 5 };
        const goal = segmentCentre(u, legPlay.handle).add(vec3(0, -0.08, 0));
        const moved = moveHandle(u, SETUP, legPlay, goal);
        expect(closestApart(moved)).toBeGreaterThan(D * 0.95);
        expectSegments(moved, count);
    });
});

describe("tightening and smoothing", () => {
    // A slack loop sagging between two straight runs, with a bar across under the sag for it to draw up against.
    const loop = ropeAlong([
        vec3(0, 0, 0),
        vec3(0.1, 0, 0),
        vec3(0.12, -0.04, 0),
        vec3(0.16, -0.04, 0),
        vec3(0.18, 0, 0),
        vec3(0.28, 0, 0),
    ]);
    const count = segmentCount(loop);

    it("draws the rope in play up until it's jammed, keeping the rest exactly", () => {
        const setup = {
            ...SETUP,
            bars: [{ at: vec3(0.14, -0.012, 0), along: vec3(0, 0, 1), r: 0.005 }],
        };
        const play = { from: 5, to: 10 };
        const stepper = tightenInPlay(loop, setup, play);
        let steps = 0;
        while (!stepper.step()) steps++;
        expect(steps).toBeLessThan(2999);
        const tight = stepper.result();
        expect(length(tight)).toBeLessThan(length(loop) - 0.02);
        expectSegments(tight, count);
        const before = loop.seg.filter((s) => s < 5).length;
        expect(tight.points.slice(0, before)).toEqual(loop.points.slice(0, before));
        for (const p of tight.points)
            expect(Math.hypot(p.x - 0.14, p.y + 0.012)).toBeGreaterThan((0.005 + D / 2) * 0.97);
    });

    it("tightens the knot's segments while held segments stay put", () => {
        const held = [1, count];
        const tight = runToEnd(tightenWholeKnot(loop, SETUP, held, [6, 7, 8, 9]));
        expectSegments(tight, count);
        expect(tight.points[0]).toEqual(loop.points[0]);
        expect(tight.points.at(-1)).toEqual(loop.points.at(-1));
        expect(length(tight)).toBeLessThan(length(loop));
    });

    it("smooths without taking up or giving rope", () => {
        const smooth = runToEnd(smoothInPlay(loop, SETUP, { from: 4, to: 11 }));
        expect(length(smooth)).toBeCloseTo(length(loop), 3);
        expect(smooth.seg).toEqual(loop.seg);
    });
});

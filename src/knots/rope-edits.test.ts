import { describe, expect, it } from "vitest";

import { solveRope, type PinnedRope } from "./pinned-rope";
import { addPin, flipCrossing, removePin, setAngle, setLengthAfter } from "./rope-edits";

const ROPE: PinnedRope = {
    pins: [
        { x: 0, y: 0, angle: -90 },
        { x: 0, y: -10 },
    ],
    lengths: [10],
    tail: 4,
    over: [],
};

const total = (r: PinnedRope) => r.lengths.reduce((a, b) => a + b, 0) + r.tail;

describe("rope edits", () => {
    it("pins the rope partway along a stretch, splitting it, without moving it", () => {
        const shape = solveRope(ROPE);
        const { rope, index } = addPin(ROPE, shape, 8);
        expect(index).toBe(1);
        expect(rope.pins[1]).toEqual({ x: 0, y: -4 });
        expect(rope.lengths).toEqual([4, 6]);
        expect(total(rope)).toBe(total(ROPE));
    });

    it("pins the tail, taking from it", () => {
        const shape = solveRope(ROPE);
        const { rope, index } = addPin(ROPE, shape, shape.points.length - 1);
        expect(index).toBe(2);
        expect(rope.lengths).toEqual([10, 4]);
        expect(rope.tail).toBe(0);
    });

    it("takes a pin out again, joining the rope either side", () => {
        const { rope } = addPin(ROPE, solveRope(ROPE), 8);
        expect(removePin(rope, 1)).toEqual(ROPE);
        expect(removePin(ROPE, 1)).toMatchObject({ pins: [ROPE.pins[0]], lengths: [], tail: 14 });
        expect(removePin(ROPE, 0)).toBe(ROPE);
    });

    it("holds and lets go of a direction, and sets lengths", () => {
        expect(setAngle(ROPE, 1, 270).pins[1]).toEqual({ x: 0, y: -10, angle: -90 });
        expect(setAngle(ROPE, 0, undefined).pins[0]).toEqual({ x: 0, y: 0 });
        expect(setLengthAfter(ROPE, 0, 12).lengths).toEqual([12]);
        expect(setLengthAfter(ROPE, 1, 6).tail).toBe(6);
    });

    it("swaps which strand is on top at a crossing", () => {
        const crossing = { s: [5, 20] as [number, number], over: null };
        const once = flipCrossing(ROPE, crossing);
        expect(once.over).toEqual([5]);
        const twice = flipCrossing(once, { ...crossing, over: 0 });
        expect(twice.over).toEqual([20]);
    });
});

import { describe, expect, it } from "vitest";

import { linkPins } from "./edits";
import type { Picture } from "./format";
import { pictureGeometry } from "./geometry";
import { moved, moveStep, nextLine, nextPin, turned } from "./keyboard";
import type { Selection } from "./state";
import { free, testPicture, testStrand } from "./test-pictures";
import { scaleOf } from "./zoom";

const rope = (y: number) =>
    testStrand("rope", [
        { x: 0.4, y },
        { x: 20, y, angle: 0 },
        { x: 40, y },
    ]);
const two = testPicture([rope(0), rope(30)]);
const pins = (...refs: [number, number][]): Selection => ({
    kind: "parts",
    pins: refs,
    segments: [],
});
const at = (p: Picture, i: number, k: number) => {
    const pin = free(p.strands[i].pins[k]);
    return [pin.x, pin.y];
};
const right = { x: 1, y: 0 } as const;
const up = { x: 0, y: -1 } as const;

describe("moving from the keyboard", () => {
    const g = pictureGeometry(two);

    it("moves the selected pins by the step, with snap off", () => {
        const p = moved(two, g, pins([0, 0], [1, 2]), right, 1, false);
        expect(at(p, 0, 0)).toEqual([1.4, 0]);
        expect(at(p, 1, 2)).toEqual([41, 30]);
        expect(at(p, 0, 1)).toEqual([20, 0]);
    });

    it("takes the first pin to the next line with snap on, and the rest with it", () => {
        const p = moved(two, g, pins([0, 0], [1, 2]), right, 5, true);
        expect(at(p, 0, 0)).toEqual([5, 0]);
        expect(at(p, 1, 2)).toEqual([44.6, 30]);
        // Up from y = 0, on a line already: the next one up.
        expect(at(moved(two, g, pins([0, 1]), up, 5, true), 0, 1)).toEqual([20, -5]);
    });

    it("moves a whole strand, a segment's two pins, or a prop", () => {
        const strand = moved(two, g, { kind: "strand", strand: 1 }, up, 1, false);
        expect(strand.strands[1].pins.map((pin) => free(pin).y)).toEqual([29, 29, 29]);
        expect(strand.strands[0]).toBe(two.strands[0]);
        const segment = moved(
            two,
            g,
            { kind: "parts", pins: [], segments: [[0, 1]] },
            up,
            1,
            false,
        );
        expect(segment.strands[0].pins.map((pin) => free(pin).y)).toEqual([0, -1, -1]);
    });

    it("moves a linked pin's chain head instead", () => {
        const linked = linkPins(two, g, [0, 1], [1, 1]);
        const p = moved(linked, pictureGeometry(linked), pins([1, 1]), right, 1, false);
        expect(at(p, 0, 1)).toEqual([21, 0]);
    });

    it("steps by the snap lines, or the level above with Shift", () => {
        expect(moveStep(scaleOf(100), false, false)).toBe(1);
        expect(moveStep(scaleOf(100), false, true)).toBe(10);
        expect(moveStep(scaleOf(100), true, false)).toBe(20);
        expect(moveStep(scaleOf(100), true, true)).toBe(100);
        expect(moveStep(scaleOf(200), true, false)).toBe(5);
        expect(moveStep(scaleOf(200), true, true)).toBe(20);
    });

    it("finds the next line either way", () => {
        expect(nextLine(3.2, 5, 1)).toBe(5);
        expect(nextLine(5, 5, 1)).toBe(10);
        expect(nextLine(3.2, 5, -1)).toBe(0);
        expect(nextLine(0, 5, -1)).toBe(-5);
    });
});

describe("turning from the keyboard", () => {
    const g = pictureGeometry(two);

    it("turns a pin by the step, clockwise on the screen or back", () => {
        expect(free(turned(two, g, pins([0, 1]), 1, 5, false).strands[0].pins[1]).angle).toBe(5);
        expect(free(turned(two, g, pins([0, 1]), -1, 5, false).strands[0].pins[1]).angle).toBe(-5);
    });

    it("starts a pin with no angle from the way its curve runs", () => {
        const p = turned(two, g, pins([0, 0]), 1, 15, true);
        expect(free(p.strands[0].pins[0]).angle).toBe(15);
    });
});

describe("stepping from pin to pin", () => {
    it("goes along the strand, on to the next, and round", () => {
        expect(nextPin(two, pins([0, 1]), 1)).toEqual([0, 2]);
        expect(nextPin(two, pins([0, 2]), 1)).toEqual([1, 0]);
        expect(nextPin(two, pins([1, 2]), 1)).toEqual([0, 0]);
        expect(nextPin(two, pins([0, 0]), -1)).toEqual([1, 2]);
    });

    it("starts at the first pin, or the last going back, with nothing selected", () => {
        expect(nextPin(two, pins(), 1)).toEqual([0, 0]);
        expect(nextPin(two, pins(), -1)).toEqual([1, 2]);
        expect(nextPin(two, { kind: "strand", strand: 1 }, 1)).toEqual([1, 0]);
    });
});

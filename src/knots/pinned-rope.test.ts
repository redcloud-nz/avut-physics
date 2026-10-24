import { describe, expect, it } from "vitest";

import { arcLengths } from "@/lib/curve";
import { vec2 } from "@/lib/vector2";

import { solveRope, type PinnedRope } from "./pinned-rope";

const rope = (r: Partial<PinnedRope>): PinnedRope => ({
    pins: [],
    lengths: [],
    tail: 0,
    over: [],
    ...r,
});

/** The rope's points meet each pin, and the rope between them is the length it should be. */
function expectPinsMet(r: PinnedRope) {
    const shape = solveRope(r);
    expect(shape.converged).toBe(true);
    r.pins.forEach((pin, k) =>
        expect(shape.points[shape.pinNodes[k]].distanceTo(vec2(pin.x, pin.y))).toBeLessThan(1e-6),
    );
    const s = arcLengths(shape.points);
    r.lengths.forEach((length, k) =>
        expect(s[shape.pinNodes[k + 1]] - s[shape.pinNodes[k]]).toBeCloseTo(length, 9),
    );
    return shape;
}

describe("solveRope", () => {
    it("lies straight between pins as far apart as the rope is long", () => {
        const shape = expectPinsMet(
            rope({
                pins: [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                ],
                lengths: [10],
            }),
        );
        for (const p of shape.points) expect(Math.abs(p.y)).toBeLessThan(1e-6);
    });

    it("bows into a smooth curve where there's slack, the way the pins' angles say", () => {
        const pins = [
            { x: 0, y: 0, angle: -90 },
            { x: 6, y: 0, angle: 90 },
        ];
        const shape = expectPinsMet(rope({ pins, lengths: [12] }));
        // Leaving upwards and coming back down: it bows up the page (y negative).
        expect(Math.min(...shape.points.map((p) => p.y))).toBeLessThan(-2);
        expect(shape.theta[0]).toBeCloseTo(-Math.PI / 2, 6);
    });

    it("carries on straight past the last pin", () => {
        const shape = expectPinsMet(
            rope({
                pins: [
                    { x: 0, y: 0 },
                    { x: 0, y: -5, angle: -90 },
                ],
                lengths: [5],
                tail: 3,
            }),
        );
        expect(shape.points.at(-1)!.distanceTo(vec2(0, -8))).toBeLessThan(1e-6);
    });

    it("meets pins and angles through several stretches", () => {
        expectPinsMet(
            rope({
                pins: [
                    { x: 0, y: 10, angle: -90 },
                    { x: 0, y: 4 },
                    { x: 3, y: -4, angle: -90 },
                    { x: -3, y: -4, angle: 90 },
                ],
                lengths: [6, 10, 12],
                tail: 4,
            }),
        );
    });

    it("says so when the pins are further apart than the rope between them", () => {
        const shape = solveRope(
            rope({
                pins: [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                ],
                lengths: [8],
            }),
        );
        expect(shape.converged).toBe(false);
    });
});

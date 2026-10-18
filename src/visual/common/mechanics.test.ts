import { describe, expect, it } from "vitest";

import { rad } from "@/lib/math";

import {
    fallSpeed,
    g,
    leverPush,
    ropeCatch,
    slopeParts,
    slopePull,
    stoppingForce,
} from "./mechanics";

describe("mechanics", () => {
    it("splits a weight on a slope into parts that add back up to it", () => {
        for (const deg of [0, 20, 45, 70, 90]) {
            const { along, into } = slopeParts(rad(deg));
            expect(Math.hypot(along, into)).toBeCloseTo(1, 12);
        }
        expect(slopeParts(rad(30)).along).toBeCloseTo(0.5, 12);
    });

    it("needs friction's grip added hauling and taken off lowering", () => {
        const a = rad(30);
        expect(slopePull(a, 0, true)).toBeCloseTo(slopePull(a, 0, false), 12);
        expect(slopePull(a, 0.2, true) - slopePull(a, 0.2, false)).toBeCloseTo(
            2 * 0.2 * Math.cos(a),
            12,
        );
        // Steeper than the surface can grip, the load slides; shallower, it holds itself.
        expect(slopePull(rad(20), Math.tan(rad(25)), false)).toBe(0);
        expect(slopePull(rad(30), Math.tan(rad(25)), false)).toBeGreaterThan(0);
    });

    it("balances a lever's turning both ways", () => {
        expect(leverPush(0.5, 1.5) * 1.5).toBeCloseTo(1 * 0.5, 12);
    });

    it("stops a fall with as much work as gravity did", () => {
        const [w, h, d] = [1, 2, 0.25];
        expect(stoppingForce(w, h, d) * d).toBeCloseTo(w * (h + d), 12);
        // The speed at the catch, taken away over d, needs the same force less the weight.
        const v = fallSpeed(h);
        const decel = (v * v) / (2 * d);
        expect(stoppingForce(w, h, d) - w).toBeCloseTo((w / g) * decel, 12);
    });

    it("catches a fall on a rope with its stretch taking up the work", () => {
        const [w, h, l, s] = [1, 1, 2, 0.03];
        const { force, stretched } = ropeCatch(w, h, l, s);
        expect(0.5 * force * stretched).toBeCloseTo(w * (h + stretched), 9);
        expect(stretched).toBeCloseTo(force * s * l, 12);
        // No fall still stretches it to twice its hanging stretch, dropped from slack-free.
        expect(ropeCatch(w, 0, l, s).force).toBeCloseTo(2 * w, 12);
        // A stretchier rope catches more softly.
        expect(ropeCatch(w, h, l, 0.08).force).toBeLessThan(force);
        // The same fall factor on more rope gives the same force.
        expect(ropeCatch(w, 2 * h, 2 * l, s).force).toBeCloseTo(force, 12);
    });
});

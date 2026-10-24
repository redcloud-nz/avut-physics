import { describe, expect, it } from "vitest";

import { rad } from "@/lib/math";
import { seededPicker } from "@/lib/random";

import { solveIncline, type Setup } from "./incline-solver";

const BASE: Setup = { angle: rad(25), mass: 5, muS: 0.5, muK: 0.3, g: 9.81 };

describe("block on an incline", () => {
    it("obeys Newton's second law along the slope and balances square to it", () => {
        const pick = seededPicker(5);
        for (let n = 0; n < 300; n++) {
            const s = {
                angle: rad(pick(0, 89, 1)),
                mass: pick(0.5, 50, 0.5),
                muS: pick(0, 1.5, 0.05),
                muK: pick(0, 1.5, 0.05),
                g: pick(1, 20, 0.01),
            };
            const r = solveIncline(s);
            if (r.kind === "none") throw new Error(r.reason);
            const { f } = r;
            const weight = s.mass * s.g;
            // Square to the slope: the slope's push matches the weight's part into it.
            expect(f.normal).toBeCloseTo(weight * Math.cos(s.angle), 9);
            // Along it: the weight's part down it, less friction, gives the acceleration.
            expect(weight * Math.sin(s.angle) - f.friction).toBeCloseTo(s.mass * f.accel, 9);
            // Friction can't exceed what the surfaces give.
            expect(f.friction).toBeLessThanOrEqual(s.muS * f.normal + 1e-9);
            if (r.kind === "held") expect(f.accel).toBeCloseTo(0, 12);
            else {
                expect(f.friction).toBeCloseTo(Math.min(s.muK, s.muS) * f.normal, 9);
                expect(f.accel).toBeGreaterThan(0);
            }
        }
    });

    it("slips once the slope is steeper than the angle whose tangent is μs", () => {
        const at = (deg: number) => solveIncline({ ...BASE, angle: rad(deg) }).kind;
        // tan⁻¹(0.5) is about 26.57°.
        expect(at(26.5)).toBe("held");
        expect(at(26.7)).toBe("sliding");
    });

    it("needs no friction on the flat", () => {
        const r = solveIncline({ ...BASE, angle: 0 });
        if (r.kind !== "held") throw new Error(r.kind);
        expect(r.f.friction).toBe(0);
        expect(r.f.normal).toBeCloseTo(5 * 9.81, 12);
    });

    it("slides with g sin θ − μk g cos θ", () => {
        const r = solveIncline({ ...BASE, angle: rad(40) });
        if (r.kind !== "sliding") throw new Error(r.kind);
        expect(r.f.accel).toBeCloseTo(9.81 * (Math.sin(rad(40)) - 0.3 * Math.cos(rad(40))), 9);
    });

    it("caps μk at μs", () => {
        const r = solveIncline({ ...BASE, angle: rad(40), muK: 0.9 });
        if (r.kind !== "sliding") throw new Error(r.kind);
        expect(r.f.kinetic).toBe(0.5);
    });

    it("has no answer without mass", () => {
        expect(solveIncline({ ...BASE, mass: 0 }).kind).toBe("none");
    });
});

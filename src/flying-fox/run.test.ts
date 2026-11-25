import { describe, expect, it } from "vitest";

import { DISMOUNT, RIDER, STATIC_X } from "./fox";
import { HIT_X, RUN, simulateRun } from "./run";

describe("a rider's run", () => {
    it("stops the heaviest rider (120 kg) just short of the static brakes, the chain weight tuned for it", () => {
        const run = simulateRun({ ...RUN, mass: RIDER.mass });
        expect(run.reachedStatic).toBe(false);
        expect(run.shortOfStatic).toBeGreaterThan(0);
        expect(run.shortOfStatic).toBeLessThan(0.5);
    });

    for (const mass of [30, 60, 90, 120]) {
        const run = simulateRun({ ...RUN, mass });

        it(`brings a ${mass} kg rider to rest in the dismount zone, short of the static brakes`, () => {
            expect(run.reachedStatic).toBe(false);
            expect(run.pushed).toBeGreaterThan(0);
            expect(HIT_X + run.pushed).toBeLessThan(STATIC_X);
            expect(run.rest).toBeGreaterThan(DISMOUNT.from);
            expect(run.rest).toBeLessThan(DISMOUNT.to);
        });

        it(`never goes faster than falling from the launch to the lowest point would make it (${mass} kg)`, () => {
            const ys = run.samples.map((s) => s.y);
            const drop = ys[0] - Math.min(...ys);
            expect(run.top.speed).toBeLessThan(Math.sqrt(2 * 9.81 * drop));
            expect(run.top.speed).toBeGreaterThan(5);
        });
    }
});

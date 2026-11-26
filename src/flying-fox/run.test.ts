import { describe, expect, it } from "vitest";

import { chainWeightMass } from "./chain-weight";
import { HIT_X, RUN, simulateRun, simulateSession, TIMELINE } from "./run";
import { DISMOUNT, RIDER, STATIC_X, TROLLEY_X } from "./site";

describe("a rider's run", () => {
    it("stops the heaviest rider (120 kg) short of the static brakes with the book's chain weight", () => {
        const run = simulateRun({ ...RUN, mass: RIDER.mass });
        expect(run.reachedStatic).toBe(false);
        expect(run.shortOfStatic).toBeGreaterThan(0);
        // At least 50 kg of chain (section 5.4.3), all of it lifted clear of the pile by the furthest push.
        expect(chainWeightMass()).toBeGreaterThanOrEqual(50);
        // Pulling no more than 0.8 kN (AS 2316.2.1, as section 5.4.3 gives it): the chain hanging, and the pull of
        // snatching more of it off the pile at the speed it's lifted.
        for (const s of run.samples) {
            if (s.pushed <= 0) continue;
            const { mass, perMetre } = RUN.chain(s.pushed);
            expect(mass * 9.81 + perMetre * s.speed * s.speed).toBeLessThanOrEqual(800);
        }
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

describe("both riders' runs, joined by the return line", () => {
    const session = simulateSession(RUN);
    const at = (t: number) => session.samples[Math.round(t * session.rate)];

    it("starts with trolley A at the launch and B parked where riders are caught, the line slack", () => {
        expect(at(0).a.x).toBeCloseTo(TROLLEY_X.a, 6);
        expect(at(0).b.x).toBeCloseTo(session.run.rest, 6);
        expect(at(0).b.x).toBeGreaterThan(DISMOUNT.from);
        expect(at(0).slack).toBeGreaterThan(0);
    });

    it("lets the heaviest rider reach their furthest into the brake without the return line pulling tight", () => {
        const heaviest = simulateRun({ ...RUN, mass: RIDER.mass });
        expect(session.line).toBeGreaterThan(0);
        expect(heaviest.reachedStatic).toBe(false);
    });

    it("hauls the empty trolley up to the platform after the rider meets the brake", () => {
        const hit = session.samples.find((s) => s.a.x >= HIT_X)!;
        const home = session.samples.find((s) => s.b.x <= TROLLEY_X.a + 1e-9)!;
        expect(home.t).toBeGreaterThan(hit.t);
        expect(home.t).toBeLessThan(TIMELINE.unloadA);
    });

    it("catches each rider in the dismount zone and holds them there until they unclip, ending swapped round", () => {
        const caught = at(TIMELINE.unloadA - 1).a;
        expect(caught.x).toBeGreaterThan(DISMOUNT.from);
        expect(caught.x).toBeLessThan(DISMOUNT.to);
        expect(caught.speed).toBeLessThan(0.01);
        const end = session.samples[session.samples.length - 1];
        expect(end.b.x).toBeCloseTo(at(0).b.x, 1);
        expect(end.a.x).toBeCloseTo(TROLLEY_X.a, 6);
    });
});

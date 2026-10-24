import { describe, expect, it } from "vitest";

import { seededPicker } from "@/lib/random";

import { checksFor, solveLoads, type LoadResult, type Setup } from "./ute-load-solver";

/**
 * What any answer must satisfy, checked against the physics directly: the axles carry everything, and the
 * moments balance about the rear axle (the solver takes them about the front).
 */
function violations(s: Setup, r: LoadResult): string[] {
    if (r.kind === "none") return [`no solution: ${r.reason}`];
    const { l } = r;
    const out: string[] = [];
    const ball = s.trailer * s.ballShare;
    const added = s.loads.reduce((sum, x) => sum + x.mass, 0);
    const tol = 1e-9 * (s.unladen + added + s.trailer);
    if (Math.abs(l.front + l.rear - (s.unladen + added + ball)) > tol)
        out.push("axles don't carry everything");
    // Moments about the rear axle, positive tending to press the front axle down.
    const moment =
        s.unladen * s.unladenFrontShare * s.wheelbase +
        s.loads.reduce((sum, x) => sum + x.mass * (s.wheelbase - x.x), 0) -
        ball * s.ballBehindRearAxle;
    if (Math.abs(l.front * s.wheelbase - moment) > tol * s.wheelbase)
        out.push("moments don't balance about the rear axle");
    if (l.front <= 0 || l.rear <= 0) out.push("an axle pulls the ground");
    if (Math.abs(l.combined - (s.unladen + added + s.trailer)) > tol)
        out.push("combined mass isn't ute plus trailer");
    return out;
}

const BASE: Setup = {
    wheelbase: 3.1,
    unladen: 2100,
    unladenFrontShare: 0.58,
    loads: [],
    trailer: 0,
    ballShare: 0.1,
    ballBehindRearAxle: 1.4,
};

describe("ute axle loads", () => {
    const solved = (s: Setup) => {
        const r = solveLoads(s);
        expect(violations(s, r)).toEqual([]);
        if (r.kind !== "loaded") throw new Error(r.reason);
        return r.l;
    };

    it("splits the empty ute as weighed", () => {
        const l = solved(BASE);
        expect(l.front).toBeCloseTo(1218, 6);
        expect(l.rear).toBeCloseTo(882, 6);
    });

    it("puts a load over an axle all on that axle", () => {
        const empty = solved(BASE);
        const front = solved({ ...BASE, loads: [{ label: "a", mass: 100, x: 0 }] });
        expect(front.front - empty.front).toBeCloseTo(100, 9);
        const rear = solved({ ...BASE, loads: [{ label: "a", mass: 100, x: 3.1 }] });
        expect(rear.rear - empty.rear).toBeCloseTo(100, 9);
        expect(rear.front).toBeCloseTo(empty.front, 9);
    });

    it("loads the rear axle with more than the tow ball carries, lifting the difference off the front", () => {
        const empty = solved(BASE);
        const l = solved({ ...BASE, trailer: 2000 });
        expect(l.ball).toBe(200);
        expect(l.ballOnRear).toBeCloseTo((200 * 4.5) / 3.1, 9);
        expect(l.rear - empty.rear).toBeCloseTo(l.ballOnRear, 9);
        expect(empty.front - l.front).toBeCloseTo(l.ballOffFront, 9);
        expect(l.gross).toBeCloseTo(2300, 9);
        expect(l.combined).toBeCloseTo(4100, 9);
    });

    it("reports the front wheels lifting when the ball outweighs the front", () => {
        const r = solveLoads({ ...BASE, trailer: 20000, ballShare: 0.5 });
        expect(r.kind === "none" && r.reason).toMatch(/front wheels/);
    });

    it("reports the rear wheels lifting when a load ahead of the front axle outweighs the rear", () => {
        // 882 kg on the rear axle empty; 3000 kg 1 m ahead of the front axle takes about 968 kg off it.
        const r = solveLoads({ ...BASE, loads: [{ label: "a", mass: 3000, x: -1 }] });
        expect(r.kind === "none" && r.reason).toMatch(/rear wheels/);
    });

    it("refuses shares outside 0 to 1 and masses below zero", () => {
        for (const s of [
            { ...BASE, unladenFrontShare: 1.2 },
            { ...BASE, unladenFrontShare: -0.1 },
            { ...BASE, ballShare: 2 },
            { ...BASE, unladen: -1 },
            { ...BASE, trailer: -1 },
            { ...BASE, loads: [{ label: "a", mass: -5, x: 1 }] },
        ])
            expect(solveLoads(s).kind).toBe("none");
    });

    it("checks each rating against what it limits", () => {
        const s = { ...BASE, trailer: 2000 };
        const l = solved(s);
        const ratings = {
            gvm: 3150,
            gcm: 6000,
            frontAxle: 1400,
            rearAxle: 1900,
            towing: 3500,
            towBall: 350,
        };
        expect(Object.fromEntries(checksFor(s, l, ratings).map((c) => [c.key, c.value]))).toEqual({
            gvm: l.gross,
            frontAxle: l.front,
            rearAxle: l.rear,
            gcm: l.combined,
            towing: 2000,
            towBall: 200,
        });
    });

    it("balances for random setups", () => {
        const pick = seededPicker(7);
        const failures = Array.from({ length: 500 }, () => {
            const s: Setup = {
                wheelbase: pick(2.8, 3.6, 0.01),
                unladen: pick(1800, 2600, 1),
                unladenFrontShare: pick(0.5, 0.65, 0.01),
                loads: Array.from({ length: 6 }, (_, i) => ({
                    label: `l${i}`,
                    mass: pick(0, 300, 1),
                    x: pick(-1, 4.5, 0.01),
                })),
                trailer: pick(0, 3500, 10),
                ballShare: pick(0, 0.15, 0.01),
                ballBehindRearAxle: pick(1, 1.6, 0.01),
            };
            return { s, problems: violations(s, solveLoads(s)) };
        }).filter((f) => f.problems.length > 0);
        expect(failures).toEqual([]);
    });
});

import { describe, expect, it } from "vitest";

import { rad } from "@/lib/math";
import { solveAnchor } from "@/visualisations/multi-point-anchor-solver";

import {
    legShare,
    preEqualised,
    redirectShare,
    swungDown,
    tiedAt,
    type Swung,
    type TwoAnchors,
} from "./gentle-introduction";

/** The article's rig: legs 1 m long and 60° apart. */
const RIG: TwoAnchors = { gap: 1, leg: 1 };
const SWINGS = Array.from({ length: 25 }, (_, i) => rad(-60 + 5 * i));

/** How far the master point is from balancing, per unit of load: the load's pull plus each taut leg's. */
const imbalance = (s: Swung, swing: number) =>
    s.anchors
        .reduce(
            (sum, a, i) =>
                s.shares[i] > 0 ? sum.add(a.sub(s.master).unit().scale(s.shares[i])) : sum,
            swungDown(swing),
        )
        .len();

describe("gentle introduction", () => {
    it.each([
        [0, 0.5],
        [60, 1 / Math.sqrt(3)],
        [90, 1 / Math.sqrt(2)],
        [120, 1],
    ])("two legs %i° apart each take %f of the load", (angle, share) => {
        expect(legShare(rad(angle))).toBeCloseTo(share, 12);
    });

    it.each([
        [0, 2],
        [90, Math.sqrt(2)],
        [120, 1],
        [180, 0],
    ])("a redirect with the rope bent through %i° takes %f of its tension", (angle, share) => {
        expect(redirectShare(rad(angle))).toBeCloseTo(share, 12);
    });

    it("pre-equalised: the master point balances, and the legs keep their lengths", () => {
        for (const swing of SWINGS) {
            const s = preEqualised(RIG, swing);
            expect(imbalance(s, swing)).toBeLessThan(1e-12);
            expect(Math.min(...s.shares)).toBeGreaterThanOrEqual(0);
            s.anchors.forEach((a, i) =>
                s.shares[i] > 0
                    ? expect(a.distanceTo(s.master)).toBeCloseTo(RIG.leg, 12)
                    : expect(a.distanceTo(s.master)).toBeLessThanOrEqual(RIG.leg + 1e-12),
            );
        }
    });

    it("pre-equalised: the far leg goes slack once the load swings past the near one", () => {
        expect(preEqualised(RIG, rad(29)).shares[1]).toBeGreaterThan(0);
        expect(preEqualised(RIG, rad(31)).shares).toEqual([1, 0]);
        expect(preEqualised(RIG, rad(-31)).shares).toEqual([0, 1]);
    });

    it("pre-equalised: the main line 20° off, as the article quotes, loads the far anchor 88% and the near 20%", () => {
        const [left, right] = preEqualised(RIG, rad(20)).shares;
        expect(Math.round(left * 100)).toBe(88);
        expect(Math.round(right * 100)).toBe(20);
    });

    it("agrees with the multi-point anchor's solver, whose slings stretch a little", () => {
        for (const swing of [0, rad(15), rad(-40)]) {
            const r = solveAnchor({
                anchors: preEqualised(RIG, 0).anchors,
                tiedAt: tiedAt(RIG),
                load: 2000,
                direction: swing,
                rig: "pre-equalised",
            });
            if (r.kind !== "settled") throw new Error(r.reason);
            const solved = r.s.legs.map((leg) => leg.force.len() / 2000);
            preEqualised(RIG, swing).shares.forEach((share, i) =>
                expect(Math.abs(solved[i] - share)).toBeLessThan(0.02),
            );
            expect(r.s.master.distanceTo(preEqualised(RIG, swing).master)).toBeLessThan(0.05);
        }
    });
});

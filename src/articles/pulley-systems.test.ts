import { describe, expect, it } from "vitest";

import {
    FIVE_TO_ONE,
    hauled,
    loadPerMetre,
    partsOnTheLoad,
    pullsOf,
    REDIRECT,
    SIX_TO_ONE,
    TWO_TO_ONE,
    TWO_TO_ONE_REDIRECTED,
    Z_RIG,
    type PulleySystem,
} from "./pulley-systems";

const SYSTEMS: [string, PulleySystem, number][] = [
    ["a pulley on the anchor", REDIRECT, 1],
    ["a 2:1", TWO_TO_ONE, 2],
    ["a 2:1 redirected at the anchor", TWO_TO_ONE_REDIRECTED, 2],
    ["the Z-rig", Z_RIG, 3],
    ["a 5:1", FIVE_TO_ONE, 5],
    ["a 2:1 on the Z-rig", SIX_TO_ONE, 6],
];

/** The length of each rope, from where its bodies are. */
const lengths = (sys: PulleySystem, pulled: number) => {
    const at = hauled(sys, pulled);
    return sys.ropes.map((rope) =>
        rope.path.slice(1).reduce((sum, id, i) => sum + Math.abs(at[id] - at[rope.path[i]]), 0),
    );
};

describe("pulley systems", () => {
    it.each(SYSTEMS.slice(0, 5))(
        "counting rope parts on the load gets %s right",
        (_, sys, advantage) => {
            expect(partsOnTheLoad(sys)).toHaveLength(advantage);
        },
    );

    it("counting rope parts on the load gets the 2:1 on the Z-rig wrong", () => {
        expect(partsOnTheLoad(SIX_TO_ONE)).toHaveLength(3);
    });

    it.each(SYSTEMS)("%s keeps its ropes' lengths as the team hauls", (_, sys) => {
        const start = lengths(sys, 0);
        lengths(sys, 0.8).forEach((l, i) => expect(l).toBeCloseTo(start[i], 12));
    });

    it.each(SYSTEMS)("%s moves the load 1/%i as far as the rope pulled", (_, sys, advantage) => {
        expect(loadPerMetre(sys)).toBeCloseTo(1 / advantage, 12);
    });

    it.each(SYSTEMS)(
        "%s pulls the load %i times as hard as the team, as the work done says it must",
        (_, sys, advantage) => {
            // Without friction, the work the team puts in comes out at the load: pull × distance on each side.
            expect(pullsOf(sys).advantage).toBeCloseTo(advantage, 12);
            expect(pullsOf(sys).advantage * loadPerMetre(sys)).toBeCloseTo(1, 12);
        },
    );

    it.each(SYSTEMS)(
        "%s balances overall: the anchor and team together hold the load",
        (_, sys) => {
            for (const efficiency of [1, 0.9, 0.5]) {
                const p = pullsOf(sys, efficiency);
                const away = Math.sign(hauled(sys, 1).haul - hauled(sys, 0).haul);
                // The load pulls + by its advantage, the team pulls the haul end its way by 1, and the anchor holds back
                // against the ropes' pull on it.
                expect(p.advantage + away - p.pull.anchor).toBeCloseTo(0, 12);
            }
        },
    );

    it.each(SYSTEMS)("%s with friction gets out less work than the team puts in", (_, sys) => {
        for (const efficiency of [0.95, 0.9, 0.5]) {
            const out = pullsOf(sys, efficiency).advantage * loadPerMetre(sys);
            expect(out).toBeLessThan(1);
            expect(out).toBeGreaterThan(0);
        }
    });

    it("the Z-rig with friction gets 1 + e + e² from pulleys passing on e", () => {
        for (const e of [1, 0.9, 0.7, 0.5]) {
            expect(pullsOf(Z_RIG, e).advantage).toBeCloseTo(1 + e + e * e, 12);
            expect(pullsOf(Z_RIG, e).tensions[0]).toEqual(
                [e * e, e, 1].map((t) => expect.closeTo(t, 12)),
            );
        }
    });

    it("compounds multiply, friction included", () => {
        for (const e of [1, 0.9, 0.5]) {
            expect(pullsOf(SIX_TO_ONE, e).advantage).toBeCloseTo(
                pullsOf(TWO_TO_ONE, e).advantage * pullsOf(Z_RIG, e).advantage,
                12,
            );
        }
    });

    it("the Z-rig's pulleys pull on their slings with the sum of their two parts", () => {
        const p = pullsOf(Z_RIG);
        // The anchor pulley is pulled towards the load, the travelling pulley towards the anchor.
        expect(p.pull.p1).toBeCloseTo(2, 12);
        expect(p.pull.p2).toBeCloseTo(-2, 12);
        expect(p.pull.anchor).toBeCloseTo(2, 12);
    });
});

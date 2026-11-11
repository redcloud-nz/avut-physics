import { describe, expect, it } from "vitest";

import { crossings, layOut, type Rig } from "./pulley-layout";
import {
    COMPLEX_FIVE_TO_ONE,
    FIVE_TO_ONE,
    FIVE_TO_ONE_DOUBLES,
    NINE_TO_ONE,
    REDIRECT,
    SIX_TO_ONE,
    TWO_TO_ONE,
    TWO_TO_ONE_REDIRECTED,
    Z_RIG,
    type PulleySystem,
} from "./pulley-systems";

const SYSTEMS: [string, PulleySystem][] = [
    ["a pulley on the anchor", REDIRECT],
    ["a 2:1", TWO_TO_ONE],
    ["a 2:1 redirected at the anchor", TWO_TO_ONE_REDIRECTED],
    ["the Z-rig", Z_RIG],
    ["a 5:1", FIVE_TO_ONE],
    ["a 2:1 on the Z-rig", SIX_TO_ONE],
    ["a 5:1 on double pulleys", FIVE_TO_ONE_DOUBLES],
    ["a 3:1 on the Z-rig", NINE_TO_ONE],
    ["a complex 5:1", COMPLEX_FIVE_TO_ONE],
];

/** A hand-laid-out system as a rig: its lanes dropped, and its grabs on the rope parts whose lanes they sit on. */
function rigOf(sys: PulleySystem): Rig {
    const partAt = (y: number) => {
        for (const [r, rope] of sys.ropes.entries()) {
            const i = rope.lanes.indexOf(y);
            if (i >= 0) return `${r}.${i}`;
        }
        throw new Error(`No rope part on lane ${y}`);
    };
    return {
        bodies: Object.fromEntries(
            Object.entries(sys.bodies).map(([id, b]) => [
                id,
                b.kind === "grab"
                    ? { kind: "grab", x: b.x, rides: partAt(b.y), ...(b.on && { on: b.on }) }
                    : b,
            ]),
        ),
        ropes: sys.ropes.map((rope) => ({ path: rope.path })),
    };
}

describe("pulley layout", () => {
    it.each(SYSTEMS)("lays out %s as it was laid out by hand", (_, sys) => {
        expect(layOut(rigOf(sys))).toEqual(sys);
    });

    it("draws the complex 5:1's second rope first, as in the order written it crosses itself more", () => {
        const { bodies, ropes } = COMPLEX_FIVE_TO_ONE;
        const asWritten: PulleySystem = {
            bodies: { ...bodies, g1: { kind: "grab", x: 3.9, y: 40, on: "load" } },
            ropes: [
                { path: ropes[0].path, lanes: [40, 68, 96] },
                { path: ropes[1].path, lanes: [124, 152] },
            ],
        };
        expect(crossings(asWritten)).toBeGreaterThan(crossings(COMPLEX_FIVE_TO_ONE));
    });

    it("says when a grab rides on a rope part that isn't there", () => {
        const rig = rigOf(Z_RIG);
        rig.bodies.g1 = { kind: "grab", x: 3.35, rides: "0.5", on: "load" };
        expect(() => layOut(rig)).toThrow(/isn't a rope part/);
    });
});

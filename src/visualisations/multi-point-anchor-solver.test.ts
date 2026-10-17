import { describe, expect, it } from "vitest";

import { G } from "@/lib/constants";
import { rad } from "@/lib/math";
import { seededPicker } from "@/lib/random";
import { vec2, Vector2 } from "@/lib/vector2";

import {
    layoutFor,
    SLING_STIFFNESS,
    solveAnchor,
    type AnchorResult,
    type Rig,
    type Setup,
} from "./multi-point-anchor-solver";

/** The page's inputs, in its units (mass in kg, angles in degrees). */
type Inputs = {
    count: 2 | 3;
    rig: Rig;
    gaps: number[];
    heights: number[];
    drop: number;
    tieDirection: number;
    loadMass: number;
    direction: number;
};

const DEFAULTS: Inputs = {
    count: 2,
    rig: "pre-equalised",
    gaps: [1.2, 1.2],
    heights: [0, 0],
    drop: 0.6,
    tieDirection: 0,
    loadMass: 200,
    direction: 0,
};

function setupFor(inputs: Partial<Inputs>): Setup {
    const i = { ...DEFAULTS, ...inputs };
    return {
        ...layoutFor({ ...i, tieDirection: rad(i.tieDirection) }),
        load: i.loadMass * G,
        direction: rad(i.direction),
        rig: i.rig,
    };
}

/** A seeded stream of random inputs across the page's slider ranges. */
function randomInputs(count: number, seed = 1): Inputs[] {
    const pick = seededPicker(seed);
    return Array.from({ length: count }, () => ({
        count: pick(0, 1, 1) ? 3 : 2,
        rig: pick(0, 1, 1) ? "sliding" : "pre-equalised",
        gaps: [pick(0.3, 3, 0.05), pick(0.3, 3, 0.05)],
        heights: [pick(-1, 1, 0.05), pick(-1, 1, 0.05)],
        drop: pick(0.1, 2, 0.05),
        tieDirection: pick(-45, 45, 1),
        loadMass: pick(10, 400, 5),
        direction: pick(-75, 75, 1),
    }));
}

const settled = (r: AnchorResult) => {
    if (r.kind !== "settled") throw new Error(r.reason);
    return r.s;
};

/**
 * What's wrong with a result, checked against the physics directly: the master point balances, slings only pull,
 * and each sling is stretched by just its tension, from the length it was tied at.
 */
function violations(s: Setup, r: AnchorResult): string[] {
    if (r.kind === "none") return [`none: ${r.reason}`];
    const { master, legs } = r.s;
    const out: string[] = [];
    const fTol = 1e-6 * s.load;
    const lTol = 1e-9;
    const F = vec2(Math.sin(s.direction), -Math.cos(s.direction)).scale(s.load);
    if (r.s.load.distanceTo(F) > fTol) out.push("load isn't the setup's");

    // Each leg pulls its anchor towards the master point, with all its strands.
    for (const leg of legs) {
        if (leg.tension < 0) out.push("a sling pushes");
        const towards = master.sub(leg.anchor).unit();
        if (leg.force.distanceTo(towards.scale(leg.strands * leg.tension)) > fTol)
            out.push("a leg's pull isn't along it");
    }

    // The master point balances: the load against the legs' pulls on it.
    const net = legs.reduce((sum, leg) => sum.sub(leg.force), F);
    if (net.len() > fTol) out.push(`master point doesn't balance by ${net.len().toFixed(3)} N`);

    // Each sling is stretched by its tension, or slack and no longer than it was tied.
    const check = (length: number, tied: number, tension: number) => {
        if (tension > fTol) {
            if (Math.abs(length - tied * (1 + tension / SLING_STIFFNESS)) > lTol)
                out.push("a sling's stretch doesn't match its tension");
        } else if (length > tied * (1 + fTol / SLING_STIFFNESS) + lTol) {
            out.push("a slack sling is longer than it was tied");
        }
    };
    if (s.rig === "pre-equalised") {
        for (const leg of legs)
            check(leg.anchor.distanceTo(master), leg.anchor.distanceTo(s.tiedAt), leg.tension);
    } else {
        const T = legs[0].tension;
        if (legs.some((leg) => Math.abs(leg.tension - T) > fTol))
            out.push("a sliding rig's strands differ in tension");
        const lengthTo = (p: Vector2) =>
            legs.reduce((sum, leg) => sum + leg.strands * leg.anchor.distanceTo(p), 0);
        check(lengthTo(master), lengthTo(s.tiedAt), T);
    }
    return out;
}

describe("multi-point anchor: physics rules", () => {
    it("hold for random setups across the sliders' ranges", () => {
        const failures = randomInputs(500)
            .map((i) => ({
                inputs: i,
                problems: violations(setupFor(i), solveAnchor(setupFor(i))),
            }))
            .filter((f) => f.problems.length > 0);
        expect(failures).toEqual([]);
    });
});

describe("multi-point anchor", () => {
    /** Each anchor's pull as a share of the load. */
    const shares = (inputs: Partial<Inputs>) => {
        const s = setupFor(inputs);
        return settled(solveAnchor(s)).legs.map((leg) => leg.force.len() / s.load);
    };
    /** The drop that puts the legs of two level anchors `angle` degrees apart. */
    const dropFor = (angle: number) => DEFAULTS.gaps[0] / 2 / Math.tan(rad(angle / 2));

    it.each([
        ["pre-equalised", 120],
        ["sliding", 120],
        ["pre-equalised", 90],
        ["sliding", 90],
        ["pre-equalised", 30],
    ] as const)(
        "%s, two anchors tied %i° apart: each takes 1 / (2 cos(half the angle))",
        (rig, angle) => {
            const s = setupFor({ rig, drop: dropFor(angle) });
            const r = settled(solveAnchor(s));
            const [a, b] = r.legs.map((leg) => leg.anchor.sub(r.master));
            const settledAngle = Math.acos(a.dot(b) / (a.len() * b.len()));
            // The slings stretch a little under the load, closing the angle a few degrees from how it was tied.
            expect(Math.abs(settledAngle - rad(angle))).toBeLessThan(rad(4));
            for (const leg of r.legs)
                expect(leg.force.len() / s.load).toBeCloseTo(
                    1 / (2 * Math.cos(settledAngle / 2)),
                    9,
                );
        },
    );

    it("pre-equalised: swinging the load past a leg leaves the other slack", () => {
        // Legs 90° apart, so each is 45° off straight down: swung 50° to the right, the load hangs off the left
        // leg alone and the right one goes slack.
        const [left, right] = shares({ drop: dropFor(90), direction: 50 });
        expect(left).toBeCloseTo(1, 6);
        expect(right).toBe(0);
    });

    it("sliding: swinging the load keeps the strands equal and moves the master point", () => {
        const s = setupFor({ rig: "sliding", direction: 30 });
        const r = settled(solveAnchor(s));
        expect(r.legs[0].tension).toBeCloseTo(r.legs[1].tension, 6);
        expect(r.master.x).toBeGreaterThan(0.2);
    });

    it("sliding, three anchors: the middle one takes twice what each outer one does", () => {
        const [a, b, c] = shares({ count: 3, rig: "sliding" });
        expect(b).toBeCloseTo(2 * a, 6);
        expect(c).toBeCloseTo(a, 6);
    });

    it("pre-equalised, three anchors: the shorter middle leg takes the most", () => {
        const [a, b, c] = shares({ count: 3 });
        expect(b).toBeGreaterThan(a);
        expect(a).toBeCloseTo(c, 6);
    });

    it("pre-equalised: swinging the load away from an anchor loads it more", () => {
        const left = (direction: number) => shares({ direction })[0];
        expect(left(20)).toBeGreaterThan(left(10));
        expect(left(10)).toBeGreaterThan(left(0));
    });

    it("explains why there's no answer with no load", () => {
        expect(solveAnchor(setupFor({ loadMass: 0 })).kind).toBe("none");
    });
});

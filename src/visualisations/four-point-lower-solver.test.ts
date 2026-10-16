import { describe, expect, it } from "vitest";

import { G } from "@/lib/constants";
import { seededPicker } from "@/lib/random";
import { vec3, type Vector3 } from "@/lib/vector3";

import {
    maxRope,
    minRope,
    solveLower,
    type LowerResult,
    type Setup,
} from "./four-point-lower-solver";

/** The page's inputs, in its units (masses in kg). */
type Inputs = {
    slotDepth: number;
    slotWidth: number;
    anchorUp: number;
    anchorBack: number;
    belaySpacing: number;
    stretcherMass: number;
    /** Clamped to the rope lengths the page allows, as the page does. */
    rope: number;
};

const DEFAULTS: Inputs = {
    slotDepth: 3,
    slotWidth: 1.2,
    anchorUp: 0.5,
    anchorBack: 2,
    belaySpacing: 3,
    stretcherMass: 80,
    rope: 4,
};

function setupFor(inputs: Partial<Inputs>): Setup {
    const i = { ...DEFAULTS, ...inputs };
    const s: Setup = {
        slotDepth: i.slotDepth,
        slotWidth: i.slotWidth,
        anchorUp: i.anchorUp,
        anchorBack: i.anchorBack,
        belaySpacing: i.belaySpacing,
        rope: 0,
        barLength: 2,
        barWidth: 0.6,
        barWeight: i.stretcherMass * G,
    };
    s.rope = Math.min(
        Math.max(i.rope, Math.ceil(minRope(s) * 100) / 100),
        Math.ceil(maxRope(s) * 100) / 100,
    );
    return s;
}

/** A seeded stream of random inputs across the page's slider ranges, the rope anywhere in its range. */
function randomInputs(count: number, seed = 1): Inputs[] {
    const pick = seededPicker(seed);
    return Array.from({ length: count }, () => ({
        slotDepth: pick(2, 6, 0.1),
        slotWidth: pick(0.8, 3, 0.05),
        anchorUp: pick(0.1, 2, 0.05),
        anchorBack: pick(0.5, 5, 0.05),
        belaySpacing: pick(2, 6, 0.05),
        stretcherMass: pick(1, 200, 1),
        rope: pick(0, 14, 0.05),
    }));
}

/** Everything wrong with a result, checked against the physics directly rather than how the solver works. */
function violations(s: Setup, r: LowerResult): string[] {
    if (r.kind === "none") return [`no solution: ${r.reason}`];
    const l = r.l;
    const W = s.barWeight;
    const tol = 1e-6;
    const fTol = 1e-6 * W;
    const out: string[] = [];
    const h = s.slotDepth;

    // The stretcher fits between the slot's walls, and doesn't go through its bottom or out above the floor.
    if (Math.abs(l.corner.x - s.barWidth / 2) > tol)
        out.push("corner isn't at the stretcher's side");
    if (Math.abs(l.corner.z - s.barLength / 2) > tol)
        out.push("corner isn't at the stretcher's end");
    if (l.corner.y < -tol) out.push("stretcher below the slot's bottom");
    if (l.corner.y > h + tol) out.push("stretcher above the floor");
    const anchor = vec3(s.slotWidth / 2 + s.anchorBack, h + s.anchorUp, s.belaySpacing / 2);
    if (l.anchor.distanceTo(anchor) > tol) out.push("rope from the wrong belay");

    // The rope runs over the edge when it would otherwise cut through the floor, and is its length when taut.
    const path = [l.anchor, ...(l.edgeCrossing ? [l.edgeCrossing] : []), l.corner];
    const length = path.slice(1).reduce((sum, p, i) => sum + p.distanceTo(path[i]), 0);
    if (length > s.rope + tol) out.push(`rope stretched by ${(length - s.rope).toFixed(6)} m`);
    if (l.ropeTaut && length < s.rope - tol) out.push("rope pulls while slack");
    if (!l.ropeTaut && l.corner.y > tol) out.push("slack ropes with the stretcher in mid-air");
    const edgeX = s.slotWidth / 2;
    // Where the straight line from belay to corner crosses the slot's wall, it must be above the floor.
    const straightAtEdge =
        l.anchor.y + ((l.corner.y - l.anchor.y) * (l.anchor.x - edgeX)) / (l.anchor.x - l.corner.x);
    if (!l.edgeCrossing && straightAtEdge < h - tol) out.push("rope cuts through the floor");
    if (l.edgeCrossing) {
        const e = l.edgeCrossing;
        if (Math.abs(e.x - edgeX) > tol || Math.abs(e.y - h) > tol)
            out.push("rope crosses off the edge");
        // The shortest path over a straight edge makes equal angles with it either side.
        const edgeDir = vec3(0, 0, 1);
        const a = l.anchor.sub(e).unit().dot(edgeDir);
        const b = l.corner.sub(e).unit().dot(edgeDir);
        if (Math.abs(a + b) > 1e-6) out.push("rope isn't its shortest over the edge");
        // The rope's tension pulls both ways round the edge.
        const push = l.anchor.sub(e).unit().add(l.corner.sub(e).unit()).scale(l.tension);
        if (push.distanceTo(l.onEdge) > fTol) out.push("rope's push on the edge is wrong");
    }

    // The rope pulls the corner towards the next point along it.
    if (
        l.ropeTaut &&
        l.pull.sub(path[path.length - 2].sub(l.corner).unit().scale(l.tension)).len() > fTol
    )
        out.push("rope pulls the wrong way");

    // The stretcher balances: four mirrored pulls at its corners, its weight and the slot's bottom.
    const mirrors = (v: Vector3) => [
        v,
        vec3(-v.x, v.y, v.z),
        vec3(v.x, v.y, -v.z),
        vec3(-v.x, v.y, -v.z),
    ];
    const centre = vec3(0, l.corner.y, 0);
    const forces = [
        ...mirrors(l.corner).map((at, i) => ({ at, f: mirrors(l.pull)[i] })),
        { at: centre, f: vec3(0, l.ground - W, 0) },
    ];
    const net = forces.reduce((sum, x) => sum.add(x.f), vec3(0, 0, 0));
    if (net.len() > fTol) out.push(`forces don't balance by ${net.len().toFixed(4)} N`);
    const torque = forces.reduce((sum, x) => sum.add(x.at.sub(centre).cross(x.f)), vec3(0, 0, 0));
    if (torque.len() > fTol) out.push(`torques don't balance by ${torque.len().toFixed(4)} N·m`);
    return out;
}

describe("four-point lower: physics rules", () => {
    it("hold for random setups across the sliders' ranges", () => {
        const failures = randomInputs(500)
            .map((i) => {
                const s = setupFor(i);
                return { inputs: i, problems: violations(s, solveLower(s)) };
            })
            .filter((f) => f.problems.length > 0);
        expect(failures).toEqual([]);
    });
});

describe("four-point lower", () => {
    const lowered = (inputs: Partial<Inputs>) => {
        const r = solveLower(setupFor(inputs));
        if (r.kind !== "lowered") throw new Error(r.reason);
        return r.l;
    };

    it("starts level with the floor, ropes straight from the belays", () => {
        const l = lowered({ rope: 0 });
        expect(l.corner.y).toBeCloseTo(3, 1);
        expect(l.edgeCrossing).toBeNull();
    });

    it("wraps the ropes over the slot's edges once it's well down", () => {
        expect(lowered({ rope: 5 }).edgeCrossing).not.toBeNull();
    });

    it("lands on the slot's bottom with the longest rope", () => {
        const l = lowered({ rope: 99 });
        expect(l.ropeTaut).toBe(false);
        expect(l.ground).toBeCloseTo(80 * G, 6);
    });

    it("needs each rope to hold close to a quarter of the weight when they hang near straight down", () => {
        // Just above the bottom of a deep, narrow slot, the ropes hang from the edges almost vertically.
        const s = setupFor({ slotDepth: 6, slotWidth: 0.8 });
        const r = solveLower({ ...s, rope: maxRope(s) - 0.01 });
        if (r.kind !== "lowered") throw new Error(r.reason);
        expect(r.l.ropeTaut).toBe(true);
        expect(r.l.tension / ((80 * G) / 4)).toBeLessThan(1.01);
    });

    it("loads the ropes more as the belays spread further apart than the stretcher", () => {
        const tension = (belaySpacing: number) => lowered({ belaySpacing, rope: 0 }).tension;
        expect(tension(4)).toBeGreaterThan(tension(3));
        expect(tension(3)).toBeGreaterThan(tension(2));
    });

    it("explains when the stretcher can't fit down the slot", () => {
        const r = solveLower({ ...setupFor({}), barWidth: 1.5 });
        expect(r.kind).toBe("none");
    });
});

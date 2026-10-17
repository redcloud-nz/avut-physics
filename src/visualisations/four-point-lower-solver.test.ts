import { describe, expect, it } from "vitest";

import { G } from "@/lib/constants";
import { deg } from "@/lib/math";
import { seededPicker } from "@/lib/random";
import { vec3, type Vector3 } from "@/lib/vector3";

import {
    BOX_EDGES,
    follow,
    payOutNeeded,
    planAt,
    ropeOutAt,
    ROPES,
    settle,
    SNUG,
    solveAt,
    STAGES,
    startOf,
    sweep,
    type Placed,
    type PlaceResult,
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
};

const DEFAULTS: Inputs = {
    slotDepth: 3,
    slotWidth: 1.2,
    anchorUp: 1,
    anchorBack: 2,
    belaySpacing: 3,
    stretcherMass: 80,
};

const setupFor = (inputs: Partial<Inputs>): Setup => {
    const i = { ...DEFAULTS, ...inputs };
    return {
        slotDepth: i.slotDepth,
        slotWidth: i.slotWidth,
        anchorUp: i.anchorUp,
        anchorBack: i.anchorBack,
        belaySpacing: i.belaySpacing,
        barLength: 2,
        barWidth: 0.6,
        barDepth: 0.2,
        barWeight: i.stretcherMass * G,
    };
};

/** A seeded stream of random inputs across the page's slider ranges. */
function randomInputs(count: number, seed = 1): Inputs[] {
    const pick = seededPicker(seed);
    return Array.from({ length: count }, () => ({
        slotDepth: pick(2, 6, 0.1),
        slotWidth: pick(0.8, 3, 0.05),
        anchorUp: pick(0.5, 2, 0.05),
        anchorBack: pick(1, 5, 0.05),
        belaySpacing: pick(2, 6, 0.05),
        stretcherMass: pick(1, 200, 1),
    }));
}

/** Everything wrong with a result, checked against the physics directly rather than how the solver works. */
function violations(s: Setup, r: PlaceResult): string[] {
    if (r.kind === "none") return [`no solution: ${r.reason}`];
    const p = r.p;
    const W = s.barWeight;
    const D = s.slotDepth;
    const edge = s.slotWidth / 2;
    // Positions to a tenth of a millimetre; forces to a ten-thousandth of the weight (the solver's fallback, where a
    // corner sits right on an edge, balances only that closely).
    const tol = 1e-4;
    const fTol = 1e-4 * W;
    const out: string[] = [];
    // The basket's corners: the top rail's (where the ropes tie), then the bottom's, each in the ropes' order.
    const box = p.box;
    const [c0, c1, c2] = box;
    if (p.corners.some((c, i) => c.distanceTo(box[i]) > 1e-12))
        out.push("ropes aren't tied at the top rail");

    // The basket keeps its shape: square corners, the right sizes. Its middle is its corners' middle.
    const across = c1.sub(c0);
    const along = c0.sub(c2);
    const down = box[4].sub(c0);
    const sizeOk = [
        [across.len(), s.barWidth],
        [along.len(), s.barLength],
        [down.len(), s.barDepth],
        [across.dot(along), 0],
        [across.dot(down), 0],
        [along.dot(down), 0],
    ].every(([a, b]) => Math.abs(a - b) < 1e-6);
    // Every corner where those three directions put it, and the bottom below the top.
    const placedOk = box.every((c, i) => {
        const r = ROPES[i % 4];
        const want = c2
            .add(across.scale(r.side > 0 ? 1 : 0))
            .add(along.scale(r.end > 0 ? 1 : 0))
            .add(down.scale(i >= 4 ? 1 : 0));
        return want.distanceTo(c) < 1e-6;
    });
    if (!sizeOk || !placedOk || across.cross(along).dot(down) <= 0)
        out.push("stretcher out of shape");
    const middle = box.reduce((sum, c) => sum.add(c), vec3(0, 0, 0)).scale(1 / 8);
    if (middle.distanceTo(p.centre) > 1e-6) out.push("centre isn't the corners' middle");

    // No part of it is in the floor either side, through a side of the slot or through its bottom.
    for (let i = 0; i <= 12; i++)
        for (let j = 0; j <= 20; j++)
            for (let k = 0; k <= 4; k++) {
                const q = c2
                    .add(across.scale(i / 12))
                    .add(along.scale(j / 20))
                    .add(down.scale(k / 4));
                const inFloor = Math.abs(q.x) > edge + tol && q.y < D - tol;
                if (inFloor || q.y < -tol) {
                    out.push(`stretcher inside the ${inFloor ? "floor" : "bottom"}`);
                    i = j = k = 99;
                }
            }

    const loads: { at: Vector3; f: Vector3 }[] = [{ at: middle, f: vec3(0, -W, 0) }];
    ROPES.forEach((rope, i) => {
        const l = p.ropes[i];
        const name = rope.name.toLowerCase();
        const anchor = vec3(
            rope.side * (edge + s.anchorBack),
            D + s.anchorUp,
            (rope.end * s.belaySpacing) / 2,
        );
        if (l.anchor.distanceTo(anchor) > 1e-9) out.push(`${name}: from the wrong belay`);
        if (l.corner.distanceTo(p.corners[i]) > 1e-9) out.push(`${name}: not at its corner`);
        const path = [l.anchor, ...(l.edgeCrossing ? [l.edgeCrossing] : []), l.corner];
        const length = path.slice(1).reduce((sum, q, k) => sum + q.distanceTo(path[k]), 0);
        if (Math.abs(length - l.length) > 1e-6) out.push(`${name}: length doesn't match its path`);
        if (length > l.out + tol)
            out.push(`${name}: stretched by ${(length - l.out).toFixed(5)} m`);
        // The belayer always keeps a light pull on; any more and the rope is taut.
        if (l.tension < SNUG * W - fTol) out.push(`${name}: slacker than the belayer's light pull`);
        if (l.tension > SNUG * W + fTol && length < l.out - tol)
            out.push(`${name}: pulls harder than the light pull while slack`);
        // No run of the rope passes through the floor.
        for (let k = 1; k < path.length; k++)
            for (let t = 0.01; t < 1; t += 0.01) {
                const q = path[k - 1].add(path[k].sub(path[k - 1]).scale(t));
                if (Math.abs(q.x) > edge + tol && q.y < D - tol) {
                    out.push(`${name}: runs through the floor`);
                    t = k = 99;
                }
            }
        if (l.edgeCrossing) {
            const e = l.edgeCrossing;
            if (Math.abs(e.x - rope.side * edge) > 1e-9 || Math.abs(e.y - D) > 1e-9)
                out.push(`${name}: crosses off its side's edge`);
            // The shortest path over a straight edge makes equal angles with it either side.
            const a = l.anchor.sub(e).unit().z;
            const b = l.corner.sub(e).unit().z;
            if (Math.abs(a + b) > 1e-6) out.push(`${name}: isn't its shortest over the edge`);
        }
        // It pulls its corner towards the next point along it.
        const toward = path[path.length - 2].sub(l.corner).unit();
        if (l.pull.sub(toward.scale(l.tension)).len() > fTol)
            out.push(`${name}: pulls the wrong way`);
        loads.push({ at: l.corner, f: l.pull });
    });

    // Each contact is on its surface and on the stretcher's outline, and pushes the way that surface can.
    const sides = BOX_EDGES.map(([a, b]) => [box[a], box[b]]);
    for (const c of p.contacts) {
        const { at, force: f } = c;
        const side = Math.sign(at.x);
        const onSurface =
            c.surface === "floor"
                ? Math.abs(at.y - D) < tol && Math.abs(at.x) > edge - tol
                : c.surface === "wall"
                  ? Math.abs(Math.abs(at.x) - edge) < tol && at.y < D + tol
                  : c.surface === "edge"
                    ? Math.abs(Math.abs(at.x) - edge) < tol && Math.abs(at.y - D) < tol
                    : Math.abs(at.y) < tol;
        if (!onSurface) out.push(`${c.surface} contact off its surface`);
        const onSide = sides.find(([a, b]) => {
            const d = b.sub(a);
            const t = Math.min(1, Math.max(0, at.sub(a).dot(d) / d.dot(d)));
            return a.add(d.scale(t)).distanceTo(at) < tol;
        });
        if (!onSide) out.push(`${c.surface} contact off the stretcher`);
        const n = f.unit();
        const pushes =
            c.surface === "floor" || c.surface === "bottom"
                ? n.sub(vec3(0, 1, 0)).len() < 1e-6
                : c.surface === "wall"
                  ? n.sub(vec3(-side, 0, 0)).len() < 1e-6
                  : // Over the edge: across it, up or into the slot, and square to the stretcher's side there.
                    Math.abs(n.z) < 1e-6 &&
                    n.y > -1e-6 &&
                    -side * n.x > -1e-6 &&
                    (!onSide || Math.abs(n.dot(onSide[1].sub(onSide[0]).unit())) < 1e-6);
        if (!pushes) out.push(`${c.surface} contact pushes the wrong way`);
        loads.push({ at, f });
    }

    // The stretcher balances.
    const net = loads.reduce((sum, l) => sum.add(l.f), vec3(0, 0, 0));
    if (net.len() > fTol) out.push(`forces don't balance by ${net.len().toFixed(5)} N`);
    const turning = loads.reduce((sum, l) => sum.add(l.at.sub(middle).cross(l.f)), vec3(0, 0, 0));
    if (turning.len() > fTol * s.barLength)
        out.push(`turning doesn't balance by ${turning.len().toFixed(5)} N·m`);
    return out;
}

const placed = (r: PlaceResult): Placed => {
    if (r.kind !== "placed") throw new Error(r.reason);
    return r.p;
};

describe("four-point lower: physics rules", () => {
    it("hold through the whole lower at the defaults", () => {
        const s = setupFor({});
        const failures = sweep(s, 20)
            .map(({ progress, result }) => ({ progress, problems: violations(s, result) }))
            .filter((f) => f.problems.length > 0);
        expect(failures).toEqual([]);
    });

    it("hold through the whole lower for random setups across the sliders' ranges", () => {
        const failures = randomInputs(10).flatMap((inputs) => {
            const s = setupFor(inputs);
            return sweep(s, 8)
                .map(({ progress, result }) => ({
                    inputs,
                    progress,
                    problems: violations(s, result),
                }))
                .filter((f) => f.problems.length > 0);
        });
        expect(failures).toEqual([]);
    }, 60_000);
});

describe("four-point lower", () => {
    const W = 80 * G;
    const steps = sweep(setupFor({}), 20);
    const at = (progress: number) => placed(steps.find((x) => x.progress === progress)!.result);
    const level = (p: Placed) => Math.max(Math.abs(p.roll), Math.abs(p.pitch));

    it("starts lying on the floor, with every rope just snug", () => {
        const p = at(0);
        expect(p.contacts.every((c) => c.surface === "floor")).toBe(true);
        expect(level(p)).toBeLessThan(1e-6);
        for (const r of p.ropes) expect(r.tension / (SNUG * W)).toBeLessThan(1.2);
    });

    it("slides out along the floor with the ropes staying light", () => {
        for (const progress of [0.25, 0.5, 0.75, 1]) {
            const p = at(progress);
            expect(p.centre.x).toBeCloseTo(planAt(setupFor({}), progress).x, 3);
            expect(p.contacts.some((c) => c.surface === "floor")).toBe(true);
            for (const r of p.ropes) expect(r.tension).toBeLessThan(0.2 * W);
        }
    });

    it("swings its feet out over the slot first, its head end staying back from the edge", () => {
        const p = at(2);
        const edge = -setupFor({}).slotWidth / 2;
        const [headNear, , footNear] = p.corners;
        expect(footNear.x).toBeGreaterThan(edge);
        expect(headNear.x).toBeLessThan(edge);
        expect(footNear.z).toBeLessThan(headNear.z);
    });

    it("is off the edge and on the ropes once its head is over", () => {
        const p = at(3);
        expect(p.contacts).toEqual([]);
        const lift = p.ropes.reduce((sum, r) => sum + r.pull.y, 0);
        expect(lift / W).toBeCloseTo(1, 4);
    });

    it("never tips more than 10° on the way", () => {
        for (const { result } of steps) expect(Math.abs(deg(placed(result).roll))).toBeLessThan(10);
        for (const { result } of steps)
            expect(Math.abs(deg(placed(result).pitch))).toBeLessThan(10);
    });

    it("keeps each rope's pull under the stretcher's weight with the belays at waist height", () => {
        for (const { result } of steps)
            for (const r of placed(result).ropes) expect(r.tension).toBeLessThan(W);
    });

    it("needs much harder pulls with the belays low", () => {
        const peak = (anchorUp: number) =>
            Math.max(
                ...sweep(setupFor({ anchorUp }), 10).flatMap(({ result }) =>
                    placed(result).ropes.map((r) => r.tension),
                ),
            );
        expect(peak(0.5)).toBeGreaterThan(1.5 * peak(1));
    }, 30_000);

    it("hangs level and centred on four equal ropes once it's lowered", () => {
        const p = at(4.5);
        expect(level(p)).toBeLessThan(1e-6);
        expect(Math.abs(p.centre.x)).toBeLessThan(1e-6);
        const t = p.ropes.map((r) => r.tension);
        for (const x of t) expect(x).toBeCloseTo(t[0], 3);
        expect(t[0]).toBeGreaterThan(W / 4);
        expect(t[0]).toBeLessThan(W / 2);
    });

    it("lands on the slot's bottom, the ropes back to just snug", () => {
        const p = at(STAGES.length);
        expect(p.contacts.every((c) => c.surface === "bottom")).toBe(true);
        for (const r of p.ropes) expect(r.tension).toBeCloseTo(SNUG * W, 6);
    });

    it("loads the ropes more as the belays spread further along the slot", () => {
        const tension = (belaySpacing: number) =>
            placed(solveAt(setupFor({ belaySpacing }), 4.5)).ropes[0].tension;
        expect(tension(4)).toBeGreaterThan(tension(3));
        expect(tension(3)).toBeGreaterThan(tension(2));
    });

    it("explains when the stretcher can't fit down the slot", () => {
        expect(solveAt({ ...setupFor({}), barWidth: 1.5 }, 0).kind).toBe("none");
    });
});

describe("four-point lower, rope by rope", () => {
    const s = setupFor({});
    const start = startOf(s);
    const atStart = placed(settle(s, start.out, start.q));
    const payOut = (amounts: number[]) =>
        follow(
            s,
            atStart,
            start.out.map((l, i) => l + amounts[i]),
        );

    it("starts lying still on the floor where it was put", () => {
        expect(atStart.q.map((v, i) => v - start.q[i]).every((v) => Math.abs(v) < 1e-6)).toBe(true);
        expect(violations(s, { kind: "placed", p: atStart })).toEqual([]);
    });

    it("pays out a couple of centimetres at a time", () => {
        expect(payOut([0.3, 0, 0.3, 0])).toHaveLength(15);
    });

    it("slides towards the slot as the near side pays out, the far side's light pulls drawing it across", () => {
        const steps = payOut([0.3, 0, 0.3, 0]);
        for (const r of steps) expect(violations(s, r)).toEqual([]);
        const p = placed(steps[steps.length - 1]);
        expect(p.centre.x - atStart.centre.x).toBeGreaterThan(0.25);
        expect(p.contacts.some((c) => c.surface === "floor")).toBe(true);
        // The near side's ropes taut; the far side's slack, held by just the belayers' light pulls.
        for (const i of [0, 2]) expect(p.ropes[i].length).toBeCloseTo(p.ropes[i].out, 4);
        for (const i of [1, 3]) expect(p.ropes[i].length).toBeLessThan(p.ropes[i].out - 0.2);
    });

    it("stays put on the floor while the far side pays out", () => {
        const p = placed(payOut([0, 0.3, 0, 0.3]).pop()!);
        expect(Math.abs(p.centre.x - atStart.centre.x)).toBeLessThan(1e-3);
        expect(p.ropes[1].length).toBeLessThan(p.ropes[1].out - 0.2);
    });

    it("follows a whole lower move by move, the far side taking in as the near side pays out", () => {
        // Each stage of the scripted lower's rope out, reached in a straight line from the stage before.
        let p = atStart;
        for (let stage = 1; stage <= STAGES.length; stage++) {
            for (const r of follow(s, p, ropeOutAt(s, stage))) {
                expect(violations(s, r)).toEqual([]);
                p = placed(r);
            }
        }
        expect(p.contacts.every((c) => c.surface === "bottom")).toBe(true);
    }, 30_000);

    it("needs a pay-out about the slot's depth to reach its bottom", () => {
        expect(payOutNeeded(s)).toBeGreaterThan(s.slotDepth);
        expect(payOutNeeded(s)).toBeLessThan(s.slotDepth + 2);
    });
});

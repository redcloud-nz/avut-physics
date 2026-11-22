import { describe, expect, it } from "vitest";

import { G } from "@/lib/constants";
import { Vector2 } from "@/lib/vector2";

import { hang, lengthForSag, sagAt, WIRE_EA, WIRE_WEIGHT, type Hawser } from "./hawser";

const from = new Vector2(0, 6.6);
const to = new Vector2(80, 0);
const rig = { from, to, weight: WIRE_WEIGHT, ea: WIRE_EA };
const chord = to.sub(from).len();

/** The hawser's tension at each sampled point, worked out from the end pull and the weight hanging before it. */
function tensions(hw: Hawser, shape: ReturnType<typeof hang>, loadAt: number, load: number) {
    return shape.s.map((s) => {
        const v = shape.pull.from.y + hw.weight * s + (s > loadAt ? load : 0);
        return Math.hypot(shape.horizontal, v);
    });
}

describe("a hawser hanging between its supports", () => {
    for (const load of [undefined, { x: 20, weight: 120 * G }, { x: 40, weight: 150 * G }]) {
        const hw = { ...rig, length: chord + 0.3 };
        const shape = hang(hw, load);
        const label = load ? `with ${load.weight / G} kg at ${load.x} m` : "unloaded";

        it(`ends on both supports (${label})`, () => {
            expect(shape.points[0].distanceTo(from)).toBeLessThan(1e-8);
            expect(shape.points[shape.points.length - 1].distanceTo(to)).toBeLessThan(1e-8);
            if (load) expect(shape.load!.x).toBeCloseTo(load.x, 8);
        });

        it(`balances turning about the top support (${label})`, () => {
            // Each short piece's weight acts at its middle; the load at its point; the far support's pull at its end.
            const p = shape.points;
            let moment = to.sub(from).cross(shape.pull.to.neg());
            for (let i = 1; i < p.length; i++) {
                const ds = shape.s[i] - shape.s[i - 1];
                moment += p[i - 1]
                    .mid(p[i])
                    .sub(from)
                    .cross(new Vector2(0, -hw.weight * ds));
            }
            if (load) moment += shape.load!.sub(from).cross(new Vector2(0, -load.weight));
            const scale = (hw.weight * hw.length + (load?.weight ?? 0)) * chord;
            expect(Math.abs(moment) / scale).toBeLessThan(1e-5);
        });

        it(`stretches by its tension over its stiffness (${label})`, () => {
            const p = shape.points;
            const T = tensions(hw, shape, shape.loadS ?? Infinity, load?.weight ?? 0);
            let stretched = 0;
            let expected = 0;
            for (let i = 1; i < p.length; i++) {
                const ds = shape.s[i] - shape.s[i - 1];
                stretched += p[i].distanceTo(p[i - 1]);
                expected += ds * (1 + (T[i] + T[i - 1]) / 2 / hw.ea);
            }
            expect(stretched).toBeCloseTo(expected, 4);
        });
    }

    it("hangs as a parabola when light and nearly taut, H = w L² / 8 d", () => {
        const level = {
            from: new Vector2(0, 0),
            to: new Vector2(80, 0),
            weight: WIRE_WEIGHT,
            ea: 1e12,
        };
        const shape = hang({ ...level, length: 80.05 });
        const sag = sagAt(shape, level.from, level.to, 40);
        expect(shape.horizontal).toBeCloseTo((WIRE_WEIGHT * 80 * 80) / (8 * sag), -1);
    });

    it("matches the book's Table 12: 120 kg on a 40 m span sagging 2 m pulls about 0.60 t", () => {
        const level = { from: new Vector2(0, 0), to: new Vector2(40, 0), weight: 0.001, ea: 1e12 };
        const length = lengthForSag(level, 120 * G, 2);
        const shape = hang({ ...level, length }, { x: 20, weight: 120 * G });
        const tension = shape.pull.from.len() / G / 1000;
        expect(tension).toBeCloseTo(0.6, 2);
    });

    it("sags the asked-for amount under the test load once tensioned for it", () => {
        const length = lengthForSag(rig, 150 * G, 4);
        const shape = hang({ ...rig, length }, { x: 40, weight: 150 * G });
        expect(sagAt(shape, from, to, 40)).toBeCloseTo(4, 6);
        const unloaded = hang({ ...rig, length });
        expect(sagAt(unloaded, from, to, 40)).toBeLessThan(4);
    });
});

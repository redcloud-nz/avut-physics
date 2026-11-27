import { describe, expect, it } from "vitest";

import { vec3 } from "@/lib/vector3";

import { arcLengths, type RopeSetup } from "./rope";
import { RopeSim } from "./sim";

const D = 0.011;
const SETUP: RopeSetup = { diameter: D, minBend: D, stiffness: 0.05, bars: [] };

describe("settling a rope", () => {
    it("keeps its length, and holds its held points exactly", () => {
        // A zigzag, its ends held.
        const rope = Array.from({ length: 41 }, (_, i) => vec3(i * 0.0025, i % 2 ? 0.001 : 0, 0));
        const fixed = rope.map((_, i) => i === 0 || i === 40);
        const sim = new RopeSim(rope, SETUP, fixed);
        for (let s = 0; s < 50; s++) sim.step();
        const after = sim.points();
        expect(arcLengths(after).at(-1)!).toBeCloseTo(arcLengths(rope).at(-1)!, 4);
        expect(after[0]).toEqual(rope[0]);
        expect(after[40]).toEqual(rope[40]);
    });
});

describe("a closed bar", () => {
    it("pushes the rope out of its rod, all the way round", () => {
        const ring = Array.from({ length: 65 }, (_, i) => {
            const a = (2 * Math.PI * i) / 64;
            return vec3(0.03 * Math.cos(a), 0.03 * Math.sin(a), 0);
        });
        // A rope through the ring's rod at its side, along z.
        const rope = Array.from({ length: 21 }, (_, i) => vec3(0.031, 0, -0.05 + i * 0.005));
        const sim = new RopeSim(rope, { ...SETUP, loops: [{ points: ring, r: 0.005 }] });
        sim.relax(40);
        for (const p of sim.points()) {
            const gap = Math.min(...ring.map((q) => q.distanceTo(p)));
            expect(gap).toBeGreaterThan(0.005 + D / 2 - 5e-4);
        }
    });
});

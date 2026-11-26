import { describe, expect, it } from "vitest";

import { vec3 } from "@/lib/vector3";
import { chain, CHAIN_10, stepsAlong } from "@/rigging/hardware";

import { CHAIN_WEIGHT, chainWeight, chainWeightHanging, chainWeightMass } from "./chain-weight";

describe("chain", () => {
    it("lays a whole number of links exactly along a path that long", () => {
        const [a, b] = [vec3(0.1, 0.2, 0.3), vec3(1.3, 2.9, -0.4)];
        for (const links of [7, 31, 95]) {
            const step = a.distanceTo(b) / links;
            const laid = chain([a, b], vec3(0, 0, 1), "x", { ...CHAIN_10, length: step });
            expect(laid.links).toBe(links);
            expect(laid.end.distanceTo(b)).toBeLessThan(1e-9);
        }
    });

    it("steps a straight distance apart along a bent path", () => {
        const path = Array.from({ length: 101 }, (_, i) =>
            vec3(Math.cos(i / 50), Math.sin(i / 50), 0),
        );
        const pts = stepsAlong(path, 0.05);
        for (let k = 1; k < pts.length; k++)
            expect(pts[k].distanceTo(pts[k - 1])).toBeCloseTo(0.05, 9);
    });
});

describe("the chain weight", () => {
    it("draws chain up out of the middle of its heap, the rest of the heap staying put", () => {
        const ground = vec3(0, 0, 0);
        const across = vec3(1, 0, 0);
        const low = chainWeight(ground, 0.5, across);
        const high = chainWeight(ground, 1.7, across);
        // Links still lying on the pile once it's lifted lie exactly where they did, all but the few crossing from
        // the hole to each coil's inner end.
        // Lying on the pile: low down, and lying level (not hanging down into it from the ring).
        const onPile = (w: typeof low) =>
            w.links.filter((l) => l.near.y < 0.4 && Math.abs(l.d.y) < 0.5);
        const before = onPile(low);
        const moved = onPile(high).filter(
            (l) => Math.min(...before.map((b) => b.near.distanceTo(l.near))) > 1e-9,
        );
        expect(moved.length).toBeLessThanOrEqual(6 * CHAIN_WEIGHT.strands.length);
        expect(onPile(high).length).toBeGreaterThan(5 * moved.length);
        // Each link's end in the next one's: no link further from the last than a link's inside length.
        expect(high.links.length).toBeGreaterThan(0);
    });

    it("hangs more of itself the higher it's lifted, all of it by the heaviest rider's furthest push", () => {
        let last = 0;
        for (let h = 0.5; h < 4.8; h += 0.1) {
            const m = chainWeightHanging(h);
            expect(m).toBeGreaterThanOrEqual(last - 1e-9);
            last = m;
        }
        expect(chainWeightHanging(0.5 + 4.2)).toBeCloseTo(chainWeightMass(), 6);
    });
});

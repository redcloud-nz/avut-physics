import { describe, expect, it } from "vitest";

import { vec3 } from "@/lib/vector3";

import { chain, CHAIN_10, stepsAlong } from "./hardware";

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

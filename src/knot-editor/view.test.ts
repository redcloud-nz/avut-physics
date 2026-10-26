import { describe, expect, it } from "vitest";

import { Vector2 } from "@/lib/vector2";

import type { Frame } from "./format";
import { bounded, fitted, leastScale } from "./view";
import { MOST_SCALE } from "./zoom";

const frame: Frame = { x: -150, y: -100, w: 300, h: 200 };
const size = { w: 900, h: 750 };
/** The frame alone, and with a rope reaching out past its right edge to x = 400. */
const alone = { min: new Vector2(-150, -100), max: new Vector2(150, 100) };
const reaching = { min: new Vector2(-150, -100), max: new Vector2(400, 100) };

describe("the view", () => {
    it("zooms out until the frame fills half the view, across or down", () => {
        // Half of 900 px across 300 mm is 1.5 px/mm; half of 750 px down 200 mm, 1.875: across comes first.
        expect(leastScale(alone, frame, size)).toBeCloseTo(1.5, 9);
        expect(bounded({ cx: 0, cy: 0, scale: 0.2 }, alone, frame, size).scale).toBeCloseTo(1.5, 9);
        expect(bounded({ cx: 0, cy: 0, scale: 3 }, alone, frame, size).scale).toBe(3);
        expect(bounded({ cx: 0, cy: 0, scale: 900 }, alone, frame, size).scale).toBe(MOST_SCALE);
    });

    it("zooms out further where what's drawn reaches past the frame, far enough to fit it", () => {
        const least = leastScale(reaching, frame, size);
        expect(least).toBeLessThan(1.5);
        expect(fitted(reaching, frame, size).scale).toBeCloseTo(least, 9);
    });

    it("pans only as far as the frame's edges, or what's drawn past them, in the middle", () => {
        const far = bounded({ cx: 1000, cy: -1000, scale: 3 }, alone, frame, size);
        expect([far.cx, far.cy]).toEqual([150, -100]);
        const out = bounded({ cx: 1000, cy: 50, scale: 3 }, reaching, frame, size);
        expect([out.cx, out.cy]).toEqual([400, 50]);
        const inside = bounded({ cx: 20, cy: -30, scale: 3 }, alone, frame, size);
        expect([inside.cx, inside.cy]).toEqual([20, -30]);
    });
});

import { describe, expect, it } from "vitest";

import {
    BASE_SCALE,
    LEAST_SCALE,
    MOST_SCALE,
    nextLevel,
    percentOf,
    scaleAtSlider,
    SLIDER_STEPS,
    sliderOf,
} from "./zoom";

describe("zoom", () => {
    it("shows the base scale as 100%, in the slider's middle", () => {
        expect(percentOf(BASE_SCALE)).toBe(100);
        expect(sliderOf(BASE_SCALE)).toBe(SLIDER_STEPS / 2);
        expect(scaleAtSlider(SLIDER_STEPS / 2)).toBeCloseTo(BASE_SCALE, 10);
    });

    it("runs the slider from the least zoom to the most, and back", () => {
        expect([sliderOf(LEAST_SCALE), sliderOf(MOST_SCALE)]).toEqual([0, SLIDER_STEPS]);
        expect([sliderOf(0.01), sliderOf(9000)]).toEqual([0, SLIDER_STEPS]);
        for (const scale of [1, 3.7, 20, 64, 400].map((s) => s / 11))
            expect(scaleAtSlider(sliderOf(scale)) / scale).toBeCloseTo(1, 2);
    });

    it("steps to the next round level, from on one or between two, stopping at the ends", () => {
        const at = (percent: number) => (percent / 100) * BASE_SCALE;
        expect(percentOf(nextLevel(at(100), 1))).toBe(125);
        expect(percentOf(nextLevel(at(100), -1))).toBe(75);
        expect(percentOf(nextLevel(at(137), 1))).toBe(150);
        expect(percentOf(nextLevel(at(137), -1))).toBe(125);
        // Rounding from a typed or fitted zoom doesn't count as off the level.
        expect(percentOf(nextLevel(at(100.00001), 1))).toBe(125);
        expect(percentOf(nextLevel(at(2000), 1))).toBe(2000);
        expect(percentOf(nextLevel(at(5), -1))).toBe(5);
    });
});

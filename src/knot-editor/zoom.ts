/**
 * The zoom, as the canvas holds it (pixels per millimetre) and as the status bar shows it (a percentage, 100% being
 * `BASE_SCALE`). The status bar's slider runs on a log scale, so 100% is in its middle and each step along it zooms by
 * the same factor; its − and + go to the next round level down or up.
 */

import { clamp } from "@/lib/math";

/** Pixels per millimetre at 100%: an 11 mm rope is 20 pixels across. */
export const BASE_SCALE = 20 / 11;
/** How far the view zooms each way (pixels per millimetre): 5% to 2000%. */
export const [LEAST_SCALE, MOST_SCALE] = [1 / 11, 400 / 11];

export const withinZoom = (scale: number) => clamp(scale, LEAST_SCALE, MOST_SCALE);

export const percentOf = (scale: number) => (scale / BASE_SCALE) * 100;
export const scaleOf = (percent: number) => withinZoom((percent / 100) * BASE_SCALE);

/** How many steps the slider has from one end to the other. */
export const SLIDER_STEPS = 1000;

/** Where a zoom sits along the slider, 0 to `SLIDER_STEPS`. */
export const sliderOf = (scale: number) =>
    Math.round(
        (Math.log(withinZoom(scale) / LEAST_SCALE) / Math.log(MOST_SCALE / LEAST_SCALE)) *
            SLIDER_STEPS,
    );

export const scaleAtSlider = (position: number) =>
    withinZoom(LEAST_SCALE * (MOST_SCALE / LEAST_SCALE) ** (position / SLIDER_STEPS));

/** The round levels − and + step between (percent). */
export const LEVELS = [5, 10, 25, 50, 75, 100, 125, 150, 200, 300, 400, 600, 800, 1000, 1500, 2000];

/** The next round level up (1) or down (−1) from a zoom, past it by more than rounding; the end one at either end. */
export function nextLevel(scale: number, way: 1 | -1): number {
    const percent = percentOf(scale);
    const level =
        way > 0
            ? LEVELS.find((l) => l > percent * 1.001)
            : [...LEVELS].reverse().find((l) => l < percent / 1.001);
    return scaleOf(level ?? (way > 0 ? LEVELS[LEVELS.length - 1] : LEVELS[0]));
}

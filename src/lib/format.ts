import { G } from "./constants";
import { deg, roundTo } from "./math";

/*
 * Numbers for display, in two styles. `readout` is for the visualisations' live readouts, which show enough digits to
 * see a value move as a slider does. `teaching` is for the articles and the visual introduction, which round more, so
 * a number reads as a figure to remember. Each page uses one style throughout.
 *
 * Each style sets how many decimal places a number gets; a page can ask for more or fewer with `places` where its
 * numbers need it (shares of a load that should still add up, say).
 *
 * Neither shows a minus sign: where a value can point either way, the page gives its size and says which way in
 * words ("left", "down"). Where there's no value to show, the page shows `NONE` (from the diagram controls) instead.
 */

/** x rounded half up to `places` (as `Math.round` rounds), written with exactly that many. */
const fixed = (x: number, places: number) => roundTo(x, places).toFixed(places);

/** A ratio, such as a mechanical advantage, from its number before the colon. */
const ratioOf = (text: (x: number) => string, spaced: boolean) => (x: number) =>
    `${Number.isFinite(x) ? text(x) : "∞"}${spaced ? " : " : ":"}1`;

/** The live readouts' style: whole newtons, angles to 0.1°, lengths to the centimetre. */
export const readout = {
    /** A force in newtons, to the newton. */
    force: (newtons: number, places = 0) => `${newtons.toFixed(places)} N`,
    /** Two parts of a force (across and up, say), in newtons. */
    forceParts: (a: number, b: number, places = 0) =>
        `${a.toFixed(places)}, ${b.toFixed(places)} N`,
    /** A mass in kilograms, to the kilogram. */
    mass: (kg: number, places = 0) => `${fixed(kg, places)} kg`,
    /** An angle in radians, in degrees to 0.1°. */
    angle: (radians: number, places = 1) => `${deg(radians).toFixed(places)}°`,
    /** A length in metres, to the centimetre. */
    length: (metres: number, places = 2) => `${metres.toFixed(places)} m`,
    /** A unitless factor (a grip, a friction, a safety factor), to 0.01. */
    factor: (x: number, places = 2) => x.toFixed(places),
    /** A ratio to 0.01, as "2.35 : 1". */
    ratio: (x: number, places = 2) => ratioOf((v) => v.toFixed(places), true)(x),
    /** A share of a whole (1 is all of it), as a whole percentage. */
    percent: (share: number, places = 0) => `${(100 * share).toFixed(places)}%`,
};

/** The articles' and the visual introduction's style: rounder numbers, to read and remember. */
export const teaching = {
    /** A force in newtons, to the nearest 10. */
    force: (newtons: number) => `${Math.round(newtons / 10) * 10} N`,
    /** A force in kilonewtons, to 0.1 kN. */
    kN: (kilonewtons: number, places = 1) => `${kilonewtons.toFixed(places)} kN`,
    /** A mass in kilograms, to the kilogram. */
    mass: (kg: number, places = 0) => `${fixed(kg, places)} kg`,
    /** A force in newtons as the mass it would hold up, to the kilogram. */
    massHeldBy: (newtons: number, places = 0) => `${fixed(newtons / G, places)} kg`,
    /** An angle in radians, in whole degrees. */
    angle: (radians: number, places = 0) => `${fixed(deg(radians), places)}°`,
    /** A length in metres, to 0.1 m. */
    length: (metres: number, places = 1) => `${metres.toFixed(places)} m`,
    /** A speed in metres a second, to 0.1 m/s. */
    speed: (metresPerSecond: number, places = 1) => `${metresPerSecond.toFixed(places)} m/s`,
    /** A unitless factor (a grip, a friction, a safety factor), to 0.01. */
    factor: (x: number, places = 2) => x.toFixed(places),
    /** A ratio to 0.1, as "2.7:1", or "3:1" when that's a whole number. */
    ratio: (x: number, places = 1) => ratioOf((v) => String(roundTo(v, places)), false)(x),
    /** A share of a whole (1 is all of it), as a whole percentage. */
    percent: (share: number, places = 0) => `${fixed(share * 100, places)}%`,
};

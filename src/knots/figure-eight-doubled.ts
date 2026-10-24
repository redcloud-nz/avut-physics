/**
 * The figure-8 with two strands through it (see `doubled.ts`), drawn from the finished figure-8 of the tying steps so
 * they all match:
 *
 * - on a bight: tied in the rope doubled, leaving a loop at the top and both ends out of the bottom. Rethreaded, its end
 *   followed back through a figure-8 tied in a single strand, it comes out the same, but tied round something: a bar
 *   through its loop, which reaches a little further to go round it.
 * - joining two ropes: the first rope's end out of the top beside the second's standing part, and the second's end out
 *   of the bottom beside the first's.
 */

import type { Bar } from "./bar";
import { joined, onTheBight } from "./doubled";
import { FIGURE_EIGHT_TYING } from "./figure-eight-tying";
import { centreline } from "./rope-path";

const SINGLE = FIGURE_EIGHT_TYING[FIGURE_EIGHT_TYING.length - 1].path;

export const FIGURE_EIGHT_ON_A_BIGHT = onTheBight(SINGLE, {
    scale: 1,
    spacing: 1.1,
    part: 4,
    reach: 5,
    tail: 13,
});

export const FIGURE_EIGHT_JOINED = joined(SINGLE, { scale: 1, spacing: 1.1, tail: 6, extend: 12 });

// Its tail is short, so the running end (taped) shows below the knot, beside the standing part running on out of view.
export const FIGURE_EIGHT_RETHREADED = onTheBight(SINGLE, {
    scale: 1,
    spacing: 1.1,
    part: 4,
    reach: 7,
    tail: 6,
});

/** The radius of the bar the rethreaded figure-8 is tied round (diameters). */
const BAR = 3;

/** The bar through the loop of the figure-8 rethreaded, against the inside of the loop's top. */
export const FIGURE_EIGHT_BAR: Bar = (() => {
    const top = centreline(FIGURE_EIGHT_RETHREADED).points.reduce((a, b) => (b.y < a.y ? b : a));
    return { x: top.x, y: top.y + 0.5 + BAR, r: BAR };
})();

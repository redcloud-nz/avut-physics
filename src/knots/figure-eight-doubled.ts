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
import { folded, joined, onTheBight } from "./doubled";
import { FIGURE_EIGHT_TYING, TYING_DATA, tyingStep, type TyingStep } from "./figure-eight-tying";
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

/**
 * What to do at each step of tying the figure-8 on a bight, a step of the single figure-8's tying each: the same moves,
 * made with the fold of the doubled rope in place of the end.
 */
const BIGHT_CAPTIONS = [
    "Fold the rope in two and hold the strands together as one. Take them up and over, so the fold comes back down on the right.",
    "Take the fold round behind the standing part and up the other side.",
    "Bring the fold round behind the standing part, making a loop.",
    "Twist the top of the loop half a turn, so it crosses itself and makes an 8.",
    "The top of the loop now crosses itself, making an 8.",
    "Bring the fold round and up in front of the 8, over the top loop, and pass it up through the loop.",
    "Pull the fold through: a loose figure-8 on a bight, the fold its loop.",
];

/**
 * Step 4 for the figure-8 on a bight. There isn't room to show the fold passing over the 8 and up through the top loop,
 * as the single figure-8's step 4 shows its end, so the fold sits below the 8, on the left, and an arrow shows the way
 * it goes: over the 8 into the top loop, then up under the loop's top. It's the single figure-8's step 4 with the end
 * pinned so the fold's tip sits a little short of where the arrow starts.
 */
const BIGHT_STEP_4 = (() => {
    const { pins, over, ...step } = TYING_DATA[5];
    return tyingStep(
        {
            ...step,
            pins: [...pins.slice(0, -1), { x: -6.04, y: 4.07, angle: -52.1 }],
            // Its end no longer crosses the 8.
            over: over.slice(0, 2),
            arrows: [
                {
                    points: [
                        // In front of the rope: one curve, from the way the fold points round to straight up.
                        { x: -4.2, y: 1.7 },
                        { x: -2.36, y: -0.83 },
                        { x: -1.05, y: -2.95 },
                        { x: -0.26, y: -4.67 },
                        { x: 0, y: -6 },
                        { x: 0, y: -8.5 },
                        { x: 0, y: -11.5 },
                    ],
                    frontTo: 4,
                },
            ],
        },
        FIGURE_EIGHT_TYING[5].label,
    );
})();

/**
 * How far left the fold sits in step 2 (cont.) and both parts of step 3, from where the single figure-8 has its end
 * (diameters): there, the fold is wider than the end, so it would come too close to the knot.
 */
const FOLD_LEFT = 1.5;

/** The single figure-8's step `i` with its end pinned `FOLD_LEFT` further left. */
function foldMovedLeft(i: number): TyingStep {
    const { pins, ...step } = TYING_DATA[i];
    const end = pins[pins.length - 1];
    return tyingStep(
        { ...step, pins: [...pins.slice(0, -1), { ...end, x: end.x - FOLD_LEFT }] },
        FIGURE_EIGHT_TYING[i].label,
    );
}

/**
 * Tying the figure-8 on a bight: the single figure-8's steps, with the rope doubled (`folded`) and the fold's tip where
 * the end was, so the arrows from the end start at the fold. In step 2 (cont.) and step 3 the fold sits a little
 * further left, step 4 has the fold placed for it (`BIGHT_STEP_4`), and the last step is the knot finished.
 */
export const FIGURE_EIGHT_ON_A_BIGHT_TYING: TyingStep[] = FIGURE_EIGHT_TYING.map(
    (single, i, all) => {
        const step = i === 5 ? BIGHT_STEP_4 : i >= 2 && i <= 4 ? foldMovedLeft(i) : single;
        return {
            ...step,
            caption: BIGHT_CAPTIONS[i],
            path:
                i === all.length - 1
                    ? FIGURE_EIGHT_ON_A_BIGHT
                    : folded(step.path, { scale: 1, spacing: 1.1, part: 3.5, radius: 1.8 }),
        };
    },
);

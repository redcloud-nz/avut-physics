/**
 * Tying a figure-8 by twisting a loop: form a bight, bring the end round behind the standing part to make a
 * loop, twist the top of the loop into an 8, then poke the end into the top loop and pull it through. Each step
 * is the rope as it lies once that step is done, written like `FIGURE_EIGHT` (rope diameters, y down) and
 * finishing at it with longer ends. The end is longish at every step, but not the same length throughout.
 */

import { findRoot } from "@/lib/numeric";

import { FIGURE_EIGHT } from "./figure-eight";
import { crossings, firstPart, over, plain, ropeEnd, ropeLength, type RopePath } from "./rope-path";

export type TyingStep = { caption: string; path: RopePath };

/** The standing part, coming up from well below the knot, to where `FIGURE_EIGHT`'s goes over. */
const STANDING = plain("M 0 20 L 0 9");

/** The 8 before the end goes anywhere: from the standing part round to the bottom of the lower loop. */
const EIGHT = [STANDING, ...FIGURE_EIGHT.slice(1, 9)];

/** Up the left, over the top and down the right: the bight, before the end goes round. */
const BIGHT = [
    STANDING,
    over("L 0 6"),
    plain("C 0 2.7, -3.5 -0.7, -3.5 -4"),
    plain("A 3.5 3.5 0 0 1 3.5 -4"),
    plain("L 3.5 4"),
];

/**
 * The end, come round behind the standing part from the right and lying loose up the left of the loop. It
 * leaves the bottom of the loop partway up (at 45° from the bottom), so it doesn't bend back on itself.
 */
const FREE_END = [
    plain("A 3.5 3.5 0 0 1 -2.475 6.475"),
    plain("C -5.3 3.6, -8 1, -8 -3"),
    plain("L -8 -10"),
];

/** The 8 made, with the end come round under the standing part and lying loose up the left. */
const TWISTED = [...EIGHT.slice(0, -1), ...FREE_END];

/**
 * Where the rope's held for the next step: a diameter on from where the long diagonal crosses over the standing
 * part, in the middle of the 8. Everything from there to the end is free to move.
 */
const PIN = crossings(TWISTED).find((c) => c.at.y > 0 && c.at.y < 5)!.s[1] + 1;
const TO_PIN = firstPart(TWISTED, PIN);
const END_LENGTH = ropeLength(TWISTED) - PIN;

/**
 * The end, from the pin, brought round under the standing part again and up in front of the 8: out to the left
 * `width` from the middle, then back in across the upper loop's lower left side, its tip pointing straight up
 * over the middle of the loop.
 */
const overTheLoop = (width: number): RopePath => {
    const { at, heading } = ropeEnd(TO_PIN);
    const c = at.add(heading.scale(3.5));
    return [
        ...TO_PIN,
        plain(`C ${c.x} ${c.y}, 2.5 7.6, -1 7.6`),
        plain(`C ${-1 - 0.55 * (width - 1)} 7.6, ${-width} 5.5, ${-width} 2`),
        over(`C ${-width} -0.8, 0 -1.5, 0 -4.5`),
    ];
};

/** As far out to the left as uses up the end's length. */
const WIDTH = findRoot((w) => ropeLength(overTheLoop(w)) - PIN - END_LENGTH, 2, 20);

export const FIGURE_EIGHT_TYING: TyingStep[] = [
    {
        caption:
            "Form a bight: take the rope up and over, so the end comes back down on the right.",
        path: [...BIGHT, plain("C 3.5 7, 4.5 9, 6 12")],
    },
    {
        caption: "Bring the end round behind the standing part, making a loop.",
        path: [...BIGHT, ...FREE_END],
    },
    {
        caption: "Twist the top of the loop half a turn, so it crosses itself and makes an 8.",
        path: TWISTED,
    },
    {
        caption: "Bring the end round and up in front of the 8, so it lies over the top loop.",
        path: overTheLoop(WIDTH),
    },
    {
        caption: "Pull the end through.",
        path: [...EIGHT, FIGURE_EIGHT[9], plain("L 0 -15")],
    },
];

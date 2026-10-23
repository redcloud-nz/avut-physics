/**
 * Tying a figure-8 by twisting a loop: make a loop, flip its top half over so it crosses itself as an 8, then
 * take the end up in front and through the top of the 8. Each step is the rope as it lies once that step is
 * done, written like `FIGURE_EIGHT` (rope diameters, y down) and finishing at it.
 */

import { FIGURE_EIGHT } from "./figure-eight";
import { over, plain, type RopePath } from "./rope-path";

export type TyingStep = { caption: string; path: RopePath };

/** The end, hanging free to the left of the loop, as it does until it's taken through. */
const FREE_END = [plain("C -3.5 0, -8 -2, -8 -7"), plain("L -8 -11")];

export const FIGURE_EIGHT_TYING: TyingStep[] = [
    {
        caption: "A length of rope, the standing part at the bottom and the end at the top.",
        path: [plain("M 0 11 L 0 -11")],
    },
    {
        caption: "Make a loop: bring the end round and back across behind the standing part.",
        path: [
            plain("M 0 11 L 0 9"),
            over("L 0 6"),
            // Up the left, over the top and down the right: the loop untwisted.
            plain("C 0 2.7, -3.5 -0.7, -3.5 -4"),
            plain("A 3.5 3.5 0 0 1 3.5 -4"),
            plain("L 3.5 4"),
            // Across the bottom, behind the standing part.
            plain("A 3.5 3.5 0 0 1 -3.5 4"),
            ...FREE_END,
        ],
    },
    {
        caption: "Give the top of the loop half a turn, so it crosses itself and makes an 8.",
        path: [...FIGURE_EIGHT.slice(0, 9), ...FREE_END],
    },
    {
        caption: "Bring the end up in front of the 8, over its middle.",
        path: [...FIGURE_EIGHT.slice(0, 9), over("C -3.5 1, -1 -1.5, -1 -3.5")],
    },
    {
        caption: "Push the end through the top loop, from front to back, and out.",
        path: FIGURE_EIGHT,
    },
];

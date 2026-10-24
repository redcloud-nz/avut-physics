import { FIGURE_EIGHT_TYING, type TyingStep } from "./figure-eight-tying";

/*
 * The knots, in the order they're listed. Each has its own page at /knots/<slug>, stepping through how it's tied.
 */

export const KNOTS_TITLE = "Knots";

/** What the knots pages are, in a sentence, for the list and for links to it. */
export const KNOTS_DESCRIPTION = "How to tie the knots used in rope rescue, a step at a time.";

export type Knot = {
    slug: string;
    /** A word or two, for the list of knots and the page's headline. */
    name: string;
    /** What it's for, in a sentence, under the name on its page. */
    description: string;
    /** More on how it's used, in a paragraph or two, under the finished knot on its page. */
    about: string[];
    /** Tying it, a figure at a time: the last is the finished knot. */
    steps: TyingStep[];
    /** Lie the knot on its side in the list of knots, where a long, upright knot would be too small to see. */
    turned?: boolean;
};

export const KNOTS: Knot[] = [
    {
        slug: "figure-8",
        name: "Figure-8",
        description: "Tied by twisting a loop into an 8 and passing the end through it.",
        about: ["More on how the figure-8 is used goes here."],
        steps: FIGURE_EIGHT_TYING,
        turned: true,
    },
];

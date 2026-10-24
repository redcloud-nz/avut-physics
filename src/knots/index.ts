import type { Bar } from "./bar";
import {
    FIGURE_EIGHT_BAR,
    FIGURE_EIGHT_JOINED,
    FIGURE_EIGHT_ON_A_BIGHT,
    FIGURE_EIGHT_RETHREADED,
} from "./figure-eight-doubled";
import { FIGURE_EIGHT_TYING, type TyingStep } from "./figure-eight-tying";
import type { RopePath } from "./rope-path";

/*
 * The knots, in the order they're listed. Each has its own page at /knots/<slug>, showing it finished and, for knots
 * that have them, the steps to tie it.
 */

export const KNOTS_TITLE = "Knots";

/** What the knots pages are, in a sentence, for the list and for links to it. */
export const KNOTS_DESCRIPTION = "How to tie the knots used in rope rescue, a step at a time.";

export type Knot = {
    slug: string;
    /** A word or two, for the list of knots and the page's headline. For a variant, the knot it's a variant of. */
    name: string;
    /** Which variant of the knot it is, where it is one, shown smaller under its name ("on a bight"). */
    variant?: string;
    /** What it's for, in a sentence, under the name on its page. */
    description: string;
    /** More on how it's used, in a paragraph or two, under the finished knot on its page. */
    about: string[];
    /** The knot finished: its rope, or for a knot joining two ropes, both. */
    drawing: RopePath[];
    /** Something it's tied round, drawn as a bar through it, seen end on. */
    bar?: Bar;
    /** Tying it, a figure at a time, where it has steps. */
    steps?: TyingStep[];
    /** Lie the knot on its side in the list of knots, where a long, upright knot would be too small to see. */
    turned?: boolean;
};

/** The knot's whole name, its variant and all ("Figure-8 on a bight"), for the page's title and labels. */
export const fullName = (knot: Knot) => (knot.variant ? `${knot.name} ${knot.variant}` : knot.name);

export const KNOTS: Knot[] = [
    {
        slug: "figure-8",
        name: "Figure-8",
        description: "Tied by twisting a loop into an 8 and passing the end through it.",
        about: ["More on how the figure-8 is used goes here."],
        drawing: [FIGURE_EIGHT_TYING[FIGURE_EIGHT_TYING.length - 1].path],
        steps: FIGURE_EIGHT_TYING,
        turned: true,
    },
    {
        slug: "figure-8-on-a-bight",
        name: "Figure-8",
        variant: "on a bight",
        description: "A figure-8 tied in the rope doubled, leaving a loop.",
        about: ["More on how the figure-8 on a bight is used goes here."],
        drawing: [FIGURE_EIGHT_ON_A_BIGHT],
        turned: true,
    },
    {
        slug: "figure-8-rethreaded",
        name: "Figure-8",
        variant: "rethreaded",
        description:
            "A figure-8 tied in a single strand, with the end followed back through it to leave a loop.",
        about: ["More on how the figure-8 rethreaded is used goes here."],
        // Finished, it's the same knot as the figure-8 on a bight, but tied round something.
        drawing: [FIGURE_EIGHT_RETHREADED],
        bar: FIGURE_EIGHT_BAR,
        turned: true,
    },
    {
        slug: "joining-8",
        name: "Joining-8",
        description:
            "Two ropes joined by a figure-8 tied in one, with the other's end followed back through it.",
        about: ["More on how the joining-8 is used goes here."],
        drawing: FIGURE_EIGHT_JOINED,
        turned: true,
    },
];

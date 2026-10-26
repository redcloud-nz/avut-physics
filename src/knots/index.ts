import { readKnotJson, type KnotFile } from "../knot-editor/knot-file";
import type { JsonValue } from "../knot-editor/versions";

import FIGURE_8_ON_A_BIGHT from "./files/figure-8-on-a-bight.json";
import FIGURE_8_RETHREADED from "./files/figure-8-rethreaded.json";
import FIGURE_8 from "./files/figure-8.json";
import JOINING_8 from "./files/joining-8.json";
import ROUND_TURN from "./files/round-turn-and-two-half-hitches.json";

/*
 * The knots, in the order they're listed. Each has its own page at /knots/<slug>, showing it finished and, for knots
 * that have them, the steps to tie it. Each is a knot file in `files/`, made and edited in the knot editor
 * (/knot-editor), which holds its description, its details, the knot finished and its steps.
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
    /** Lie the knot on its side in the list of knots, where a long, upright knot would be too small to see. */
    turned?: boolean;
    file: KnotFile;
};

/** The knot's whole name, its variant and all ("Figure-8 on a bight"), for the page's title and labels. */
export const fullName = (knot: Pick<Knot, "name" | "variant">) =>
    knot.variant ? `${knot.name} ${knot.variant}` : knot.name;

/** A knot file as it's imported, read and checked, failing the build where it isn't a knot file. */
function knotFile(slug: string, json: unknown): KnotFile {
    const read = readKnotJson(json as JsonValue);
    if (read.kind === "error") throw new Error(`files/${slug}.json: ${read.reason}`);
    return read.file;
}

const knot = (slug: string, json: unknown, rest: Omit<Knot, "slug" | "file">): Knot => ({
    slug,
    ...rest,
    file: knotFile(slug, json),
});

export const KNOTS: Knot[] = [
    knot("figure-8", FIGURE_8, { name: "Figure-8", turned: true }),
    knot("figure-8-on-a-bight", FIGURE_8_ON_A_BIGHT, {
        name: "Figure-8",
        variant: "on a bight",
        turned: true,
    }),
    knot("figure-8-rethreaded", FIGURE_8_RETHREADED, {
        name: "Figure-8",
        variant: "rethreaded",
        turned: true,
    }),
    knot("joining-8", JOINING_8, { name: "Joining-8", turned: true }),
    knot("round-turn-and-two-half-hitches", ROUND_TURN, {
        name: "Round turn",
        variant: "and two half hitches",
        turned: true,
    }),
];

/** The knot's details, a paragraph for each run of text between blank lines. */
export const aboutParagraphs = (file: KnotFile) =>
    (file.about ?? "")
        .split(/\n\s*\n/)
        .map((text) => text.trim())
        .filter(Boolean);

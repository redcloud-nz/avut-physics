/**
 * The ropes' colours, as tokens in `globals.css` (`--knot-orange`, `--knot-orange-weave` and so on), and which a new
 * rope gets.
 */

import type { RopeColors } from "@/knots/rope-drawing";

import { ROPE_COLOURS, type Picture, type RopeColour } from "./knot-file";

const OUTLINE = "var(--knot-outline)";

const tokens = (name: string): RopeColors => ({
    body: `var(--knot-${name})`,
    weave: `var(--knot-${name}-weave)`,
    highlight: `var(--knot-${name}-highlight)`,
    outline: OUTLINE,
});

/** Each rope colour's body, weave, highlight and outline. */
export const ROPE_TOKENS = Object.fromEntries(
    ROPE_COLOURS.map((colour) => [colour, tokens(colour)]),
) as Record<RopeColour, RopeColors>;

/** The tape round a rope's end. */
export const TAPE_TOKENS = tokens("tape");

/** An arrow's shaft and head, and their outline. */
export const ARROW_TOKENS = { fill: "var(--knot-arrow)", outline: OUTLINE };

/**
 * The colour for a rope added to the picture: the first not already used, so the first rope is orange and the
 * second green. Once every colour is used, the one used least (the first of those).
 */
export function firstUnusedColour(picture: Picture): RopeColour {
    const uses = (colour: RopeColour) =>
        picture.strands.filter((s) => s.kind === "rope" && s.colour === colour).length;
    const least = Math.min(...ROPE_COLOURS.map(uses));
    return ROPE_COLOURS.find((colour) => uses(colour) === least)!;
}

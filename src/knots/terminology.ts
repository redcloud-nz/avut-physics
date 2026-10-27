import type { KnotFile } from "../knot-editor/knot-file";

import { knotFile } from ".";
import ROUND_TURN from "./files/terms/round-turn.json";
import TURN from "./files/terms/turn.json";

/*
 * The words used about knots, for the terminology page at /rescue-knots/terminology: the parts of a rope, the shapes it's
 * made into, then the kinds of knot.
 */

export const TERMINOLOGY_TITLE = "Terminology";

/** What the terminology page is, in a sentence. */
export const TERMINOLOGY_DESCRIPTION =
    "The words used for the parts of a rope and the knots tied in it.";

export type Term = {
    term: string;
    /** Other names for the same thing. */
    also?: string[];
    /** What it means, in a sentence or two. */
    meaning: string;
    /** A knot that shows it, by its slug. */
    example?: string;
    /**
     * A picture of it: from a knot, by its slug, and the picture by its place among the knot's steps, counting from 0
     * (each step's continued picture counted too), or the knot finished where there's no step; or a knot file of its
     * own, in `files/terms/`, drawn finished.
     */
    picture?: { knot: string; step?: number } | { file: KnotFile };
};

export const TERMS: Term[] = [
    {
        term: "Standing end",
        also: ["standing part"],
        meaning:
            "The long part of the rope that isn't being tied with. It's left where it is while the knot is tied, and takes the load once the knot is finished.",
    },
    {
        term: "Running end",
        also: ["working end"],
        meaning: "The end of the rope that's moved round and through to tie the knot.",
    },
    {
        term: "Tail",
        meaning:
            "The length of running end left sticking out of a finished knot. It needs to be long enough that the knot can't work loose.",
    },
    {
        term: "Bight",
        meaning:
            "The rope folded back on itself into a U, without crossing over. A knot tied “on a bight” is tied in the rope folded like this, so it's doubled all the way through.",
        example: "figure-8-on-a-bight",
        picture: { knot: "figure-8", step: 0 },
    },
    {
        term: "Loop",
        meaning:
            "A bight whose sides cross over each other, closing it into a ring. A knot that leaves a fixed loop to clip into is also called a loop.",
        example: "figure-8-on-a-bight",
        picture: { knot: "figure-8", step: 2 },
    },
    {
        term: "Turn",
        meaning: "The rope taken once round something, such as a bar, a ring or another rope.",
        picture: { file: knotFile("terms/turn", TURN) },
    },
    {
        term: "Round turn",
        meaning:
            "The rope taken right round something and back alongside itself, so it wraps it completely. It grips better than a single turn, and holds some load while the rest of the knot is tied.",
        example: "round-turn-and-two-half-hitches",
        picture: { file: knotFile("terms/round-turn", ROUND_TURN) },
    },
    {
        term: "Stopper",
        meaning:
            "A knot tied in the end of a rope so the end can't pull through something, such as a device or a hand.",
        example: "figure-8",
        picture: { knot: "figure-8" },
    },
    {
        term: "Bend",
        meaning: "A knot that joins two ropes, end to end.",
        example: "joining-8",
        picture: { knot: "joining-8" },
    },
    {
        term: "Hitch",
        meaning:
            "A knot that ties a rope to something, such as a bar, a ring or a tree, by gripping it.",
        example: "round-turn-and-two-half-hitches",
        picture: { knot: "round-turn-and-two-half-hitches" },
    },
];

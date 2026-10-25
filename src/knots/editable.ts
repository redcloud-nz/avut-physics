/**
 * The knots the rope editor at /knots/edit works on, each kept in its own file of steps, which the editor reads and
 * saves into (see `figure-eight-tying.ts`).
 */

import type { Bar } from "./bar";
import { TYING_FILE, type TyingFile } from "./figure-eight-tying";
import { ROUND_TURN_BAR, ROUND_TURN_FILE } from "./round-turn";

export type EditableKnot = {
    slug: string;
    name: string;
    /** Its steps' file, from the project's root, which the editor saves into. */
    path: string;
    file: TyingFile;
    /** Something it's tied round. */
    bar?: Bar;
    /** The editor's working area: room round the knot, down to where the standing part starts (diameters). */
    view: { x: number; y: number; w: number; h: number };
};

export const EDITABLE: EditableKnot[] = [
    {
        slug: "figure-8",
        name: "Figure-8 tying steps",
        path: "src/knots/figure-eight-tying.json",
        file: TYING_FILE,
        view: { x: -16, y: -19, w: 32, h: 41 },
    },
    {
        slug: "round-turn",
        name: "Round turn and two half hitches",
        path: "src/knots/round-turn.json",
        file: ROUND_TURN_FILE,
        bar: ROUND_TURN_BAR,
        view: { x: -16, y: -8, w: 32, h: 41 },
    },
];

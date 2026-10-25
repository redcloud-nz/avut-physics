/**
 * A round turn and two half hitches, tied round a bar seen side on, running across the drawing with its centre at
 * (0, 0). The standing part hangs from the front of the bar, the load below. It goes up over the bar and round it one
 * and a half times (the round turn), so the tail hangs down behind, then the tail goes twice round the standing part
 * below the bar, each time passing its end through the turn it's just made (the half hitches).
 *
 * Seen side on, the turns round the bar are a wave: up the front, over the top, down the back, under the bottom. The
 * passes up its front are listed `front`, so they're marked over and drawn in front of it, and those down its back
 * aren't, so it hides them.
 * Each half hitch goes down beside the standing part, round it in an oval, in front of it along the bottom and behind
 * it along the top, then out over its own way down and on down outside it.
 *
 * It's a pinned rope (see `pinned-rope.ts`) in `round-turn.json`, which the rope editor at /knots/edit reads and
 * writes. In rope diameters, y down.
 */

import type { Bar } from "./bar";
import { tyingStep, type TyingFile } from "./figure-eight-tying";
import type { RopePath } from "./rope-path";
import data from "./round-turn.json";

/** The bar, seen side on, with the standing part hanging from the middle of it. */
export const ROUND_TURN_BAR: Bar = { x: 0, y: 0, r: 3, length: 15 };

/** The finished knot, as laid out in the rope editor (see `editable.ts`). */
export const ROUND_TURN_FILE: TyingFile = data;

export const ROUND_TURN: RopePath = tyingStep(ROUND_TURN_FILE.steps[0], "", ROUND_TURN_BAR).path;

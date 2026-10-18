import { vec2, type Vector2 } from "@/lib/vector2";

/*
 * The rig on this page, in metres with y up: anchors 2 m apart, and the master point tied off 1.2 m below them. The
 * figure starts on the worked example in the details: tied off 0.2 m right of the middle, with the load pulling 15°
 * right of straight down.
 */

export const ANCHORS: [Vector2, Vector2] = [vec2(-1, 0), vec2(1, 0)];
export const DEPTH = 1.2;
export const OFFSET = 0.2;
/** Degrees. */
export const SWING = 15;

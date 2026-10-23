/**
 * A figure-8 knot, tied but not yet tightened, laid flat and upright as it's usually shown: both ends run up
 * the middle, the standing part from the bottom and the tail out of the top, with the two loops stacked between
 * them. The top of the upper loop and the bottom of the lower loop are half circles of radius 3.5 about (0, ∓4),
 * and the strands through the middle are S-curves leaving and arriving straight up or down. It looks the same
 * turned upside down, apart from which strand is on top at each crossing.
 *
 * In rope diameters, y down.
 */

import { over, plain, type RopePath } from "./rope-path";

/** 11 mm static rescue rope. */
export const ROPE_DIAMETER = 0.011;

export const FIGURE_EIGHT: RopePath = [
    // The standing part, up the middle, over the bottom of the lower loop.
    plain("M 0 11 L 0 9"),
    over("L 0 6"),
    // Up under the long diagonal to the upper loop's right side.
    plain("C 0 2.7, 3.5 -0.7, 3.5 -4"),
    // Round the top of the upper loop, over the tail.
    plain("A 3.5 3.5 0 0 0 1.75 -7.03"),
    over("A 3.5 3.5 0 0 0 -1.75 -7.03"),
    plain("A 3.5 3.5 0 0 0 -3.5 -4"),
    // The long diagonal down through the middle: under the tail, then over the standing part.
    plain("C -3.5 -2.4, -1.75 -1.2, 0 0"),
    over("C 1.75 1.2, 3.5 2.4, 3.5 4"),
    // Round the bottom of the lower loop, under the standing part.
    plain("A 3.5 3.5 0 0 1 -3.5 4"),
    // The tail, up over the long diagonal, then under the top of the upper loop and out.
    over("C -3.5 0.7, 0 -2.7, 0 -6"),
    plain("L 0 -11"),
];

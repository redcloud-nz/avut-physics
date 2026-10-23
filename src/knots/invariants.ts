/**
 * Checks on which knot a drawing is, from its crossings alone. Two drawings of the same knot always give the
 * same values, so a value that's wrong for the knot means the drawing is of some other knot.
 */

import { determinant } from "@/lib/numeric";

/** Which strand goes on top where the rope crosses itself. */
export type Layer = "over" | "under";

/** One time the rope passes a crossing: which crossing (numbered from 0), and whether it goes over or under. */
export type Pass = { crossing: number; layer: Layer };

/**
 * The knot's determinant, from its passes in order along the rope (with the ends joined round the outside):
 * 1 for no knot, 3 for an overhand (trefoil), 5 for a figure-8.
 *
 * It's worked out from the colouring matrix. Cutting the rope at every under-pass leaves as many arcs as there
 * are crossings, and each crossing gives a row: 2 for the arc going over, −1 for each of the two arcs ending
 * under it. The determinant is that of the matrix with one row and one column struck out.
 */
export function knotDeterminant(passes: Pass[]): number {
    const n = passes.length / 2;
    if (n <= 1) return 1;
    const M = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    // Arc k runs on from the k-th under-pass; with the ends joined, the stretch before the first under-pass is
    // the end of the last arc.
    let k = 0;
    for (const p of passes) {
        if (p.layer === "over") M[p.crossing][k % n] += 2;
        else {
            M[p.crossing][k % n] -= 1;
            M[p.crossing][(k + 1) % n] -= 1;
            k++;
        }
    }
    const minor = M.slice(1).map((row) => row.slice(1));
    return Math.round(Math.abs(determinant(minor)));
}

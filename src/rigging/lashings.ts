import { catmullRom } from "@/lib/curve3";
import type { Vector3 } from "@/lib/vector3";
import type { Piece } from "@/scene/pieces";

import { line } from "./rope";

/** Lashings: a square lashing where a spar crosses a pole. */

/** The lashings' rope: 12 mm natural fibre. */
export const LASHING_R = 0.007;

/**
 * A square lashing where a spar lies across a pole, touching it: turns of rope over the spar either side of the pole and
 * round the back of the pole above and below the spar, each turn outside the last. `pole` and `spar` are their middles
 * where they cross, `up` the pole's direction and `along` the spar's; the spar lies on the side `pole` to `spar` points.
 * The rope's `LASHING_R` thick, in `color`.
 */
export function squareLashing(
    pole: Vector3,
    poleR: number,
    spar: Vector3,
    sparR: number,
    up: Vector3,
    along: Vector3,
    color: string,
    turns = 4,
): Piece[] {
    const u = up.unit();
    const a = along.unit();
    const n = spar
        .sub(pole)
        .sub(u.scale(spar.sub(pole).dot(u)))
        .unit();
    const pieces: Piece[] = [];
    const rope = 2 * LASHING_R;
    for (let k = 0; k < turns; k++) {
        // Over the spar beside the pole, and round the pole clear of the spar.
        const w = poleR + LASHING_R + k * rope;
        const h = sparR + LASHING_R + k * rope;
        const over = sparR + LASHING_R;
        const round = poleR + LASHING_R;
        const at = (q: Vector3, side: number, lift: number) =>
            q.add(a.scale(side)).add(u.scale(lift));
        const loop = [
            spar.add(a.scale(-w)).add(n.scale(over)),
            at(spar, -w, over),
            at(pole, -round, h),
            pole.add(u.scale(h)).add(n.scale(-round)),
            at(pole, round, h),
            at(spar, w, over),
            spar.add(a.scale(w)).add(n.scale(over)),
            at(spar, w, -over),
            at(pole, round, -h),
            pole.add(u.scale(-h)).add(n.scale(-round)),
            at(pole, -round, -h),
            at(spar, -w, -over),
            spar.add(a.scale(-w)).add(n.scale(over)),
        ];
        pieces.push(...line(catmullRom(loop, 4), LASHING_R, color, "rail"));
    }
    return pieces;
}

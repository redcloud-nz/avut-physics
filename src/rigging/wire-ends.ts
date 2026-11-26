import type { Vector3 } from "@/lib/vector3";
import type { Piece } from "@/scene/pieces";

import { baseClamp, baseClampWire, thimble } from "./hardware";
import { bar, line } from "./rope";

/** Wire rope's ends: made off round a thimble with clamps, or a swaged eye. */

/** The colours of wire and its fittings: the thimble's, clamps' and ferrule's steel, and the wire's. */
export type WireColors = { steel: string; wire: string };

/**
 * A hawser's end made off round a thimble: the thimble's crown hooked on at `near`, its point along `along`, lying
 * square to `m`; the hawser's eye round it, its live part on to `live`, and its dead end back beside the live part
 * through double base clamps `clamps` along from the thimble's tip and on through `tail` (given the dead end's last
 * point and the way across from the live part to the dead). The wire's `wireR` thick; `colors` the thimble's and
 * clamps' steel and the wire's.
 */
export function madeOff(
    near: Vector3,
    along: Vector3,
    m: Vector3,
    live: Vector3,
    tail: (end: Vector3, side: Vector3) => Vector3[],
    wireR: number,
    clamps: number[],
    colors: WireColors,
): Piece[] {
    const d = along.unit();
    const th = thimble(near, d, m, wireR, colors.steel, baseClampWire(wireR));
    const [first, last] = [th.wire[0], th.wire.at(-1)!];
    const tip = first.lerp(last, 0.5);
    const pieces: Piece[] = [...th.pieces];
    for (const k of clamps)
        pieces.push(...baseClamp(tip.add(d.scale(k)), d, th.side, wireR, colors.steel));
    const deadEnd = last.add(d.scale(clamps.at(-1)! + 0.1));
    const path = [
        ...tail(deadEnd, th.side).reverse(),
        deadEnd,
        last,
        ...th.wire.slice(1, -1).reverse(),
        first,
        live,
    ];
    pieces.push(...line(path, wireR, colors.wire, "steel"));
    return pieces;
}

/**
 * A swaged eye in a wire of radius `wireR` (a lizard's ends, the Tirfor cable's hook end): a thimble with its crown's
 * inside at `near`, pointing `d` along the wire, square to `m`, the wire's tail pressed into a ferrule ten times the
 * wire's radius long, in `colors`. Returns its pieces and the end of the ferrule, where the wire runs on.
 */
export function swagedEye(
    near: Vector3,
    d: Vector3,
    m: Vector3,
    wireR: number,
    colors: WireColors,
): { pieces: Piece[]; end: Vector3 } {
    const th = thimble(near, d, m, wireR, colors.steel);
    const tips = th.wire[0].lerp(th.wire.at(-1)!, 0.5);
    const ferrule = [tips.add(d.scale(3.75 * wireR)), tips.add(d.scale(13.75 * wireR))];
    return {
        pieces: [
            ...th.pieces,
            ...bar(ferrule[0], ferrule[1], wireR * 2.2, colors.steel),
            ...line([ferrule[0], ...th.wire, ferrule[0]], wireR, colors.wire, "steel"),
        ],
        end: ferrule[1],
    };
}

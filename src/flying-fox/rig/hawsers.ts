import { C } from "@/flying-fox/colors";
import { BAR_X, CRADLE_Y, HAWSER_R, HAWSER_Z, onGround, onHawser, SPAR_X } from "@/flying-fox/site";
import { cubicPoints } from "@/lib/curve3";
import { vec3, type Vector3 } from "@/lib/vector3";
import { baseClamp, baseClampWire, shackle, thimble, turnbuckle } from "@/rigging/hardware";
import { line } from "@/rigging/rope";
import { type Piece } from "@/scene/pieces";

import { ANCHOR_SHACKLE } from "./log-anchor";
import { linkPlanes } from "./shared";
import { SADDLE, SLING_Z } from "./shear-leg";
import { TREE_SHACKLE } from "./tree";

/** The hawsers over the span, their made-off feet and turnbuckles, and the lizards and Tirfor they're tensioned with. */

/** Where a made-off eye's three double base clamps are, from the thimble's point along the hawser (Figure 66). */
export const EYE_CLAMPS = [0.1, 0.25, 0.4];

/**
 * The in-line hardware at hawser `s`'s foot (Figure 66), from the sling: a 19 mm bow shackle, the 24 mm turnbuckle and
 * three 19 mm D shackles, each link a quarter turn from the last (the turnbuckle's frame turned flat, to show from
 * above).
 */
export function footLinks(s: number) {
    const a = ANCHOR_SHACKLE(s * SLING_Z);
    const along = SADDLE(s).sub(a).unit();
    const { flat, upright } = linkPlanes(along);
    const bow = shackle("bow", a, along, flat, C.steel, C.pin);
    // Its frame turned flat, so it shows from above.
    const tb = turnbuckle(bow.far, along, upright, C.steel, { turned: true });
    const d1 = shackle("d", tb.far, along, flat, C.steel, C.pin);
    const d2 = shackle("d", d1.far, along, upright, C.steel, C.pin);
    const d3 = shackle("d", d2.far, along, flat, C.steel, C.pin);
    return { along, flat, upright, bow, tb, d1, d2, d3 };
}

function hawserFoot(s: number): Piece[] {
    const pieces: Piece[] = [];
    const saddle = SADDLE(s);
    const { along, upright, bow, tb, d1, d2, d3 } = footLinks(s);
    pieces.push(...bow.pieces, ...tb.pieces, ...d1.pieces, ...d2.pieces, ...d3.pieces);
    pieces.push(
        ...madeOff(d3.far, along, upright, saddle, (end) => {
            // The stiff wire carries on up the hawser's line, bends over in one long curve to the ground, and lies
            // there curving gently out to the hawser's own side.
            const out = vec3(-1, 0, s * 0.2).unit();
            const land = onGround(end.x - 2.0, HAWSER_R, end.z + s * 0.25);
            const rest = onGround(land.x - 1.0, HAWSER_R, land.z + s * 0.35);
            const drop = cubicPoints(
                end,
                end.add(along.scale(0.4)),
                land.sub(out.scale(0.9)),
                land,
                24,
            );
            const lie = cubicPoints(
                land,
                land.add(out.scale(0.4)),
                rest.sub(vec3(-0.35, 0, s * 0.2)),
                rest,
                16,
            );
            return [...drop.slice(1), ...lie.slice(1)];
        }),
    );
    return pieces;
}

/** Where the turnbuckle is on hawser `s`'s in-line hardware, for its label: a little out from the anchor. */
export const TURNBUCKLE_AT = (s: number) => {
    const a = ANCHOR_SHACKLE(s * SLING_Z);
    return a.add(SADDLE(s).sub(a).unit().scale(0.35));
};

/** Each hawser from its tree shackle over the tower's cradle and down the span to the shear leg's saddle. */
export function hawsers(run = false): Piece[] {
    const pieces: Piece[] = [];
    for (const s of [-1, 1]) {
        const shackleAt = TREE_SHACKLE(s);
        const cradle = vec3(BAR_X, CRADLE_Y, s * HAWSER_Z);
        // The eye at the tree: a bow shackle on the sling, the hawser's eye round its thimble on the pin, the dead end
        // back beside it through three clamps.
        const back = cradle.sub(shackleAt).unit();
        const { flat, upright } = linkPlanes(back);
        const bow = shackle("bow", shackleAt, back, flat, C.steel, C.pin);
        pieces.push(...bow.pieces);
        pieces.push(
            ...madeOff(bow.far, back, upright, cradle, (end) => [end.add(back.scale(0.12))]),
        );
        const span = Array.from({ length: 61 }, (_, i) =>
            onHawser(BAR_X + ((SPAR_X - BAR_X) * i) / 60, s),
        );
        if (!run) pieces.push(...line(span, HAWSER_R, C.hawser, "steel"));
        pieces.push(...hawserFoot(s));
    }
    return pieces;
}

/**
 * A hawser's end made off round a thimble: the thimble's crown hooked on at `near`, its point along `along`, lying
 * square to `m`; the hawser's eye round it, its live part on to `live`, and its dead end back beside the live part
 * through three double base clamps and on through `tail` (given the dead end's last point and the way across from the
 * live part to the dead).
 */
export function madeOff(
    near: Vector3,
    along: Vector3,
    m: Vector3,
    live: Vector3,
    tail: (end: Vector3, side: Vector3) => Vector3[],
): Piece[] {
    const d = along.unit();
    const th = thimble(near, d, m, HAWSER_R, C.steel, baseClampWire(HAWSER_R));
    const [first, last] = [th.wire[0], th.wire.at(-1)!];
    const tip = first.lerp(last, 0.5);
    const pieces: Piece[] = [...th.pieces];
    for (const k of EYE_CLAMPS)
        pieces.push(...baseClamp(tip.add(d.scale(k)), d, th.side, HAWSER_R, C.steel));
    const deadEnd = last.add(d.scale(EYE_CLAMPS.at(-1)! + 0.1));
    const path = [
        ...tail(deadEnd, th.side).reverse(),
        deadEnd,
        last,
        ...th.wire.slice(1, -1).reverse(),
        first,
        live,
    ];
    pieces.push(...line(path, HAWSER_R, C.hawser, "steel"));
    return pieces;
}

/**
 * A hawser's bottom end: from the saddle down to the anchor through its in-line hardware (Figure 66), from the sling a
 * 19 mm bow shackle, the 24 mm turnbuckle, three 19 mm D shackles, then the hawser's eye made off round its thimble,
 * its tail lying on the ground. Each link lies a quarter turn from the last.
 */

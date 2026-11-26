import { vec3, type Vector3 } from "@/lib/vector3";
import type { Piece } from "@/scene/pieces";

import { figure8, type Prism } from "./knots";
import { bar, hanging, line } from "./rope";

/** Guys: star pickets, and guy ropes tied to them with a figure 8 on a bight, its big loop over a post. */

const UP = vec3(0, 1, 0);

/** A picket's colours: its steel and its safety cap. */
export type PicketColors = { picket: string; cap: string };

/** A picket: its pieces, its top, and where a rope's tied to it. */
export type Picket = { pieces: Piece[]; top: Vector3; tie: Vector3 };

/**
 * A star picket driven into the ground at `base`, leaning back from the pull (a level direction) by 25°, so a rope
 * pulling at that angle is square to it, 0.6 m of it out of the ground, with a safety cap on its top (`colors`).
 * Returns its pieces, its top and where a rope's tied to it.
 */
export function picket(base: Vector3, away: Vector3, colors: PicketColors): Picket {
    const lean = 25 * (Math.PI / 180);
    const dir = away
        .unit()
        .scale(Math.sin(lean))
        .add(UP.scale(Math.cos(lean)));
    const top = base.add(dir.scale(0.6));
    return {
        pieces: [
            ...bar(base.sub(dir.scale(0.05)), top, 0.016, colors.picket),
            ...bar(top.sub(dir.scale(0.02)), top.add(dir.scale(0.05)), 0.026, colors.cap),
        ],
        top,
        // Ropes are tied low on a picket, just above the ground.
        tie: base.add(dir.scale(0.1)),
    };
}

/** How far out from a post or bar the knot of a big loop over it sits (from the post's middle). */
export const BIG_LOOP = 0.3;

/**
 * A guy from `from` (the middle of what its loop goes round, `around`) to picket `p`: tied with a figure 8 on a bight, its big loop round a post dropped over it, square to `axis` as near as it
 * can be (upright by default). Dropped onto `settle`, the loop rests where it's dropped or as little above as clears
 * what's under it (`clear` says whether a point of the rope's middle line is clear) and the loops already on the post
 * (`others`, which it joins).
 */
export function guy(
    from: Vector3,
    p: Picket,
    r: number,
    color: string,
    around: Prism[],
    {
        axis = UP,
        settle,
    }: { axis?: Vector3; settle?: { clear: (p: Vector3) => boolean; others: Vector3[][] } } = {},
): Piece[] {
    const knot = figure8(from, axis, 0, p.tie, r, BIG_LOOP, around);
    let rope = knot.rope;
    let end = knot.end;
    if (settle) {
        const near = settle.others.flat().filter((q) => q.distanceTo(from) < 0.5);
        const mine = rope.filter((q) => q.distanceTo(from) < 0.5);
        const fits = (lift: number) =>
            mine.every((q) => {
                const up = q.add(UP.scale(lift));
                return settle.clear(up) && near.every((o) => o.distanceTo(up) >= 2 * r);
            });
        // Raised a quarter of the rope's thickness at a time until it fits.
        let lift = 0;
        while (!fits(lift) && lift < 0.3) lift += r / 4;
        rope = rope.map((q) => q.add(UP.scale(lift)));
        end = end.add(UP.scale(lift));
        settle.others.push(rope);
    }
    return [
        ...p.pieces,
        ...line([...rope, ...hanging(end, p.tie, 0.05, 12)], r, color, "rope", { a: true }),
    ];
}

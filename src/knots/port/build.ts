/** Fitted ropes as knot editor strands: ids for everything, free pins where they are, linked pins by their leaders. */

import type { Id, Pin, Strand } from "../../knot-editor/format";

import type { FittedRope } from "./pairs";

/** What a fitted rope is drawn as: a rope of a colour and diameter, or an arrow. */
export type StrandLook =
    | { kind: "rope"; colour: "orange" | "green"; diameter: number }
    | { kind: "arrow" };

/** The strands, each pin and segment given the next id. */
export function strandsOf(fitted: FittedRope[], looks: StrandLook[], ids: () => Id): Strand[] {
    const strandIds = fitted.map(() => ids());
    const pinIds = fitted.map((rope) => rope.fit.pins.map(() => ids()));
    return fitted.map((rope, r) => {
        const pins = rope.fit.pins.map((pin, k): Pin => {
            const link = rope.links.get(k);
            if (link)
                return {
                    id: pinIds[r][k],
                    link: {
                        pin: pinIds[link.rope][link.pin],
                        side: link.side,
                        ...(link.reverse && { reverse: true as const }),
                    },
                };
            return {
                id: pinIds[r][k],
                x: pin.x,
                y: pin.y,
                ...(pin.angle !== undefined && { angle: pin.angle }),
            };
        });
        const segments = rope.fit.tensions.map((tension) => ({ id: ids(), tension }));
        return { id: strandIds[r], ...looks[r], pins, segments };
    });
}

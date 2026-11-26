import type { Knot } from "@/knots";
import { segmentCount, segmentsOf } from "@/lib/rope-3d/rope";
import { vec3 } from "@/lib/vector3";
import { liftKnot } from "@/rigging/knot-3d";

import type { BarProp, Knot3dFile } from "./knot-file";

/** How long a new knot's segments are (metres). */
export const SEGMENT_LENGTH = 0.02;

/**
 * A new 3D knot from a knot drawing: its first rope lifted into 3D as it's drawn (`liftKnot`: loose, nearly flat,
 * rising and sinking at the crossings), in segments 20 mm long, with the drawing's bars (seen end on, they run through
 * the drawing; seen side on, across it). Its ends are held, ready to choose the knot's segments and tighten it. Other
 * props (carabiners) and further ropes aren't brought in.
 */
export function fromDrawing(knot: Knot): Knot3dFile {
    const picture = knot.file.knot;
    const [rope] = liftKnot(picture);
    const seg = segmentsOf(rope.points, SEGMENT_LENGTH);
    const props: BarProp[] = picture.props.flatMap((prop, i) =>
        prop.kind === "bar"
            ? [
                  {
                      id: i + 1,
                      kind: "bar" as const,
                      at: vec3(prop.x / 1000, -prop.y / 1000, 0),
                      along: prop.length === undefined ? vec3(0, 0, 1) : vec3(1, 0, 0),
                      r: prop.r / 1000,
                  },
              ]
            : [],
    );
    const count = segmentCount({ points: rope.points, seg });
    return {
        name: knot.variant ? `${knot.name} ${knot.variant}` : knot.name,
        from: knot.slug,
        diameter: rope.diameter,
        minBend: rope.diameter,
        stiffness: 0.05,
        props,
        rope: { points: rope.points, seg },
        held: count > 1 ? [1, count] : [1],
        knot: [],
    };
}

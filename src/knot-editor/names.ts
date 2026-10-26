/** What the editor calls a strand or a prop, in the panel and the objects list. */

import type { Strand } from "./knot-file";
import { kindOf, type Prop } from "./props";

/** A rope's name, or "Rope 2", "Arrow 3" by its place in the picture. */
export const strandName = (strand: Strand, i: number) =>
    strand.kind === "rope" ? (strand.name ?? `Rope ${i + 1}`) : `Arrow ${i + 1}`;

/** "Bar 1", by its kind and place in the picture. */
export const propName = (prop: Prop, p: number) => `${kindOf(prop).label} ${p + 1}`;

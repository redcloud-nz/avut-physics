/**
 * The kinds of prop a picture can hold. Each kind is kept in its own file here, with its type, how it's read from a
 * file and written to one, its passes, its drawing, and how it's added, moved and edited in the panel; adding a kind
 * means adding its file and listing it below, and nothing else.
 */

import type { ReactNode } from "react";

import type { Box, Cubic } from "@/lib/bezier";
import type { Vector2 } from "@/lib/vector2";

import type { JsonObject, JsonValue } from "../versions";

import { BAR, type BarProp } from "./bar";
import type { PassEntry } from "./passes";

export type { PassEntry, PassSide } from "./passes";
export { PASS_SIDES } from "./passes";

/** A prop of any kind. */
export type Prop = BarProp;
export type PropKindName = Prop["kind"];

/** A field of a prop in the panel: a number typed in, or a choice. `set` gives back the prop itself if it's refused. */
export type PropField<P> = { label: string } & (
    | { kind: "number"; value: number; set(prop: P, value: number): P }
    | {
          kind: "choice";
          value: string;
          options: { value: string; label: string }[];
          set(prop: P, value: string): P;
      }
);

/** What every kind of prop gives the editor. */
export type PropKind<P extends Prop> = {
    kind: P["kind"];
    /** Its name in Insert > Prop and the panel, and the letter that inserts one (the key, on a QWERTY keyboard). */
    label: string;
    key: string;
    /** A new one, centred here. */
    create(at: Vector2): P;
    /** It moved by this much (diameters). */
    moved(prop: P, by: Vector2): P;
    /** Its outline, as path data: where it's picked up to drag, and drawn round when it's selected. */
    outline(prop: P): string;
    /** Its fields in the panel, in order. */
    fields(prop: P): PropField<P>[];
    /** The prop read from a file (its `kind` already known to be this one), throwing a `FileError` if it's wrong. */
    read(value: JsonValue, at: string): P;
    /** The prop as it's written to a file: its fields in order, defaults left out. */
    write(prop: P): JsonObject;
    /** Its passes, for a kind strands pass in front of and behind; none for one always drawn behind them. */
    passes(prop: P): PassEntry[];
    /** The prop with these passes instead (renumbered by an edit); only called on a kind that has passes. */
    withPasses(prop: P, passes: PassEntry[]): P;
    /** Where a segment's curve passes across it (t along the segment, in order), given points along the curve. */
    passesAcross(prop: P, cubic: Cubic, samples: Vector2[]): number[];
    /** Whether a strand passing in front must be drawn over at this point, to cover the prop. */
    covers(prop: P, point: Vector2): boolean;
    /**
     * Whether strands pass both in front of it and behind it, so it's drawn over the strands' whole length but under
     * their over stretches; otherwise it's drawn behind every strand.
     */
    between(prop: P): boolean;
    /** Its drawing, in diameters. */
    draw(prop: P): ReactNode;
    /** The box it's drawn in, for fitting the view to the picture. */
    bounds(prop: P): Box;
};

/** Every kind, by name. */
export const PROP_KINDS: { [K in PropKindName]: PropKind<Extract<Prop, { kind: K }>> } = {
    bar: BAR,
};

export const PROP_KIND_NAMES = Object.keys(PROP_KINDS) as PropKindName[];

/** The kind of a prop, typed loosely enough to call with the prop. */
export const kindOf = (prop: Prop) => PROP_KINDS[prop.kind] as PropKind<Prop>;

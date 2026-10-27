/**
 * The carabiner: a pear-shaped (HMS) carabiner seen face on, as `Carabiner` in `src/knots/carabiner.tsx`, for a hitch
 * tied round its wide bottom end. Strands pass in front of and behind it anywhere round that end; the rest of it is
 * drawn over the strands and takes no passes.
 */

import { carabinerBounds, CarabinerDrawing, carabinerOutline, wideEnd } from "@/knots/carabiner";
import { POLYLINE_TOLERANCE, type Box, type Cubic } from "@/lib/bezier";
import { Segment } from "@/lib/segment";
import { Vector2 } from "@/lib/vector2";

import {
    onlyFields,
    readBoolean,
    readId,
    readNumber,
    readObject,
    readPositive,
} from "../read-json";
import type { JsonObject, JsonValue } from "../versions";

import { PASS_MARGIN } from "./bar";
import type { PropField } from "./index";
import { readPasses, type PassEntry } from "./passes";

export type CarabinerProp = {
    id: number;
    kind: "carabiner";
    /** Where its bottom end's centre is (millimetres, y down). */
    x: number;
    y: number;
    /** Its rod's radius (millimetres). */
    r: number;
    /** How wide and tall it is, to the rod's middle line (millimetres). */
    width: number;
    height: number;
    /** Whether its gate is open, swung in about its hinge (closed if left out). */
    open?: boolean;
    /** Every pass across its bottom end. */
    passes: PassEntry[];
};

/** A new carabiner's rod radius, width and height (millimetres). */
const [RADIUS, WIDTH, HEIGHT] = [6, 72, 115];

/** Its lines are drawn as thick as beside an 11 mm rope, whatever passes it. */
const LINE_UNIT = 11;

export const CARABINER = {
    kind: "carabiner" as const,
    label: "Carabiner",

    create: (at: Vector2, id: number): CarabinerProp => ({
        id,
        kind: "carabiner",
        x: at.x,
        y: at.y,
        r: RADIUS,
        width: WIDTH,
        height: HEIGHT,
        passes: [],
    }),

    moved: (c: CarabinerProp, by: Vector2): CarabinerProp => ({
        ...c,
        x: c.x + by.x,
        y: c.y + by.y,
    }),

    outline: (c: CarabinerProp): string => carabinerOutline(c),

    fields(c: CarabinerProp): PropField<CarabinerProp>[] {
        const positive =
            (change: (v: number) => Partial<CarabinerProp>) => (p: CarabinerProp, v: number) =>
                v > 0 ? { ...p, ...change(v) } : p;
        return [
            { kind: "number", label: "x", unit: "mm", value: c.x, set: (p, x) => ({ ...p, x }) },
            { kind: "number", label: "y", unit: "mm", value: c.y, set: (p, y) => ({ ...p, y }) },
            {
                kind: "number",
                label: "Radius",
                unit: "mm",
                value: c.r,
                set: positive((r) => ({ r })),
            },
            {
                kind: "number",
                label: "Width",
                unit: "mm",
                value: c.width,
                set: positive((width) => ({ width })),
            },
            {
                kind: "number",
                label: "Height",
                unit: "mm",
                value: c.height,
                set: positive((height) => ({ height })),
            },
            {
                kind: "choice",
                label: "Gate",
                value: c.open ? "open" : "closed",
                options: [
                    { value: "closed", label: "Closed" },
                    { value: "open", label: "Open" },
                ],
                set(p, gate) {
                    if (gate === "open") return { ...p, open: true };
                    const closed = { ...p };
                    delete closed.open;
                    return closed;
                },
            },
        ];
    },

    read(value: JsonValue, at: string): CarabinerProp {
        const json = readObject(value, at);
        onlyFields(json, at, ["id", "kind", "x", "y", "r", "width", "height", "open", "passes"]);
        const carabiner: CarabinerProp = {
            id: readId(json.id, `${at}.id`),
            kind: "carabiner",
            x: readNumber(json.x, `${at}.x`),
            y: readNumber(json.y, `${at}.y`),
            r: readPositive(json.r, `${at}.r`),
            width: readPositive(json.width, `${at}.width`),
            height: readPositive(json.height, `${at}.height`),
            passes: json.passes === undefined ? [] : readPasses(json.passes, `${at}.passes`),
        };
        if (json.open !== undefined && readBoolean(json.open, `${at}.open`)) carabiner.open = true;
        return carabiner;
    },

    write: (c: CarabinerProp): JsonObject => ({
        id: c.id,
        kind: "carabiner",
        x: c.x,
        y: c.y,
        r: c.r,
        width: c.width,
        height: c.height,
        ...(c.open && { open: true }),
        ...(c.passes.length > 0 && { passes: c.passes }),
    }),

    passes: (c: CarabinerProp): PassEntry[] => c.passes,

    withPasses: (c: CarabinerProp, passes: PassEntry[]): CarabinerProp => ({ ...c, passes }),

    /**
     * Where a segment passes across the wide end: where the polyline through its samples crosses the wide end's middle
     * line (t along the segment, in order).
     */
    passesAcross(c: CarabinerProp, _cubic: Cubic, samples: Vector2[]): number[] {
        const rod = Segment.along(wideEnd(c));
        const pieces = Segment.along(samples);
        const n = pieces.length;
        const found: number[] = [];
        pieces.forEach((piece, i) =>
            rod.forEach((part) => {
                const hit = piece.intersection(part, POLYLINE_TOLERANCE);
                const t = hit && (i + hit.t) / n;
                if (t !== null && t < 1 && !found.some((f) => Math.abs(f - t) < 1e-9))
                    found.push(t);
            }),
        );
        return found.sort((p, q) => p - q);
    },

    /** Whether a pass in front must be over at this point of the strand: within the rod's radius and a margin. */
    covers: (c: CarabinerProp, point: Vector2, size: number) =>
        Segment.along(wideEnd(c)).some((part) => part.distanceTo(point) < c.r + PASS_MARGIN * size),

    /** Strands pass across the wide end mostly up and down. */
    across: () => new Vector2(0, 1),

    /** Strands pass in front of it and behind it. */
    between: () => true,

    draw: (c: CarabinerProp) => <CarabinerDrawing carabiner={c} unit={LINE_UNIT} />,

    bounds: (c: CarabinerProp): Box => carabinerBounds(c),
};

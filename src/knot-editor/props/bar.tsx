/**
 * The bar: a round metal tube for a knot to be tied round, as `Bar` in `src/knots/bar.tsx`. Seen end on it's a disc
 * the strands lie across, drawn behind them, with no passes. Seen side on, running across, it has a `length`, and
 * strands pass in front of it and behind it.
 */

import { BarDrawing } from "@/knots/bar";
import { POLYLINE_TOLERANCE, type Box, type Cubic } from "@/lib/bezier";
import { segmentIntersection } from "@/lib/geometry";
import { clamp } from "@/lib/math";
import { svgNumber } from "@/lib/svg-path";
import { Vector2 } from "@/lib/vector2";

import { FileError, onlyFields, readId, readNumber, readObject, readPositive } from "../read-json";
import type { JsonObject, JsonValue } from "../versions";

import type { PropField } from "./index";
import { readPasses, type PassEntry } from "./passes";

export type BarProp = {
    id: number;
    kind: "bar";
    /** Where its centre is (millimetres, y down). */
    x: number;
    y: number;
    /** Its radius (millimetres). */
    r: number;
    /** How long it is, seen side on; none when seen end on. */
    length?: number;
    /** Every pass across it, seen side on; none when seen end on. */
    passes: PassEntry[];
};

/** A new bar's radius, and its length seen side on (millimetres), as in the sample knot. */
const [RADIUS, LENGTH] = [17.6, 220];

/** The bar's lines are drawn as thick as beside an 11 mm rope, whatever passes it. */
const LINE_UNIT = 11;

export const BAR = {
    kind: "bar" as const,
    label: "Bar",

    create: (at: Vector2, id: number): BarProp => ({
        id,
        kind: "bar",
        x: at.x,
        y: at.y,
        r: RADIUS,
        length: LENGTH,
        passes: [],
    }),

    moved: (bar: BarProp, by: Vector2): BarProp => ({ ...bar, x: bar.x + by.x, y: bar.y + by.y }),

    outline({ x, y, r, length }: BarProp): string {
        if (length)
            return `M ${svgNumber(x - length / 2)} ${svgNumber(y - r)} h ${svgNumber(length)} v ${svgNumber(2 * r)} h ${svgNumber(-length)} Z`;
        return `M ${svgNumber(x - r)} ${svgNumber(y)} a ${svgNumber(r)} ${svgNumber(r)} 0 1 0 ${svgNumber(2 * r)} 0 a ${svgNumber(r)} ${svgNumber(r)} 0 1 0 ${svgNumber(-2 * r)} 0 Z`;
    },

    /** Where it is and how big; whether it's seen end on or side on, and side on, how long. End on, it has no passes. */
    fields(bar: BarProp): PropField<BarProp>[] {
        const positive = (change: (v: number) => Partial<BarProp>) => (b: BarProp, v: number) =>
            v > 0 ? { ...b, ...change(v) } : b;
        const fields: PropField<BarProp>[] = [
            { kind: "number", label: "x", unit: "mm", value: bar.x, set: (b, x) => ({ ...b, x }) },
            { kind: "number", label: "y", unit: "mm", value: bar.y, set: (b, y) => ({ ...b, y }) },
            {
                kind: "number",
                label: "Radius",
                unit: "mm",
                value: bar.r,
                set: positive((r) => ({ r })),
            },
            {
                kind: "choice",
                label: "Seen",
                value: bar.length === undefined ? "end" : "side",
                options: [
                    { value: "side", label: "Side on" },
                    { value: "end", label: "End on" },
                ],
                set(b, seen) {
                    if (seen === "side")
                        return b.length === undefined ? { ...b, length: LENGTH } : b;
                    if (b.length === undefined) return b;
                    return { id: b.id, kind: "bar", x: b.x, y: b.y, r: b.r, passes: [] };
                },
            },
        ];
        if (bar.length !== undefined)
            fields.push({
                kind: "number",
                label: "Length",
                unit: "mm",
                value: bar.length,
                set: positive((length) => ({ length })),
            });
        return fields;
    },

    read(value: JsonValue, at: string): BarProp {
        const json = readObject(value, at);
        onlyFields(json, at, ["id", "kind", "x", "y", "r", "length", "passes"]);
        const bar: BarProp = {
            id: readId(json.id, `${at}.id`),
            kind: "bar",
            x: readNumber(json.x, `${at}.x`),
            y: readNumber(json.y, `${at}.y`),
            r: readPositive(json.r, `${at}.r`),
            passes: json.passes === undefined ? [] : readPasses(json.passes, `${at}.passes`),
        };
        if (json.length !== undefined) bar.length = readPositive(json.length, `${at}.length`);
        else if (bar.passes.length)
            throw new FileError(at, "a bar seen end on (with no length) has no passes");
        return bar;
    },

    write(bar: BarProp): JsonObject {
        return {
            id: bar.id,
            kind: "bar",
            x: bar.x,
            y: bar.y,
            r: bar.r,
            ...(bar.length !== undefined && { length: bar.length }),
            ...(bar.passes.length > 0 && { passes: bar.passes }),
        };
    },

    passes: (bar: BarProp): PassEntry[] => bar.passes,

    withPasses: (bar: BarProp, passes: PassEntry[]): BarProp => ({ ...bar, passes }),

    /**
     * Where a segment passes across the bar seen side on: where its curve crosses the bar's middle line within the
     * bar's length. None seen end on.
     */
    passesAcross(bar: BarProp, cubic: Cubic, samples: Vector2[]): number[] {
        if (!bar.length) return [];
        const [a, b] = [
            new Vector2(bar.x - bar.length / 2, bar.y),
            new Vector2(bar.x + bar.length / 2, bar.y),
        ];
        const n = samples.length - 1;
        const found: number[] = [];
        for (let i = 0; i < n; i++) {
            const hit = segmentIntersection(samples[i], samples[i + 1], a, b, POLYLINE_TOLERANCE);
            if (!hit) continue;
            // Newton's method on the curve's height, from where the polyline crossed.
            const from = clamp((i + hit.t) / n, 0, 1);
            let t = from;
            for (let k = 0; k < 8; k++) {
                const dy = cubic.derivativeAt(t).y;
                if (Math.abs(dy) < 1e-12) break;
                t -= (cubic.pointAt(t).y - bar.y) / dy;
            }
            if (!(t >= 0 && t < 1) || Math.abs(t - from) > 1 / n) t = from;
            if (t < 1 && !found.some((f) => Math.abs(f - t) < 1e-9)) found.push(t);
        }
        return found.sort((p, q) => p - q);
    },

    /**
     * Whether a pass in front must be over at this point of the strand: within the bar's radius of its middle line,
     * and a margin more (in the passing strand's sizes) so its edges clear it.
     */
    covers: (bar: BarProp, point: Vector2, size: number) =>
        Math.abs(point.y - bar.y) < bar.r + PASS_MARGIN * size,

    /** Seen side on, running across, strands pass across it up and down. */
    across: () => new Vector2(0, 1),

    /** Seen side on, strands pass in front of it and behind it; seen end on, they lie across it. */
    between: (bar: BarProp) => bar.length !== undefined,

    draw: (bar: BarProp) => <BarDrawing bar={bar} unit={LINE_UNIT} />,

    bounds(bar: BarProp): Box {
        const half = bar.length ? bar.length / 2 : bar.r;
        return {
            min: new Vector2(bar.x - half, bar.y - bar.r),
            max: new Vector2(bar.x + half, bar.y + bar.r),
        };
    },
};

/** How far past the bar's edge (the passing strand's sizes, across it) a pass in front is drawn over. */
const PASS_MARGIN = 0.6;

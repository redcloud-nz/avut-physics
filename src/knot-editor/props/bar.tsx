/**
 * The bar: a round metal tube for a knot to be tied round, as `Bar` in `src/knots/bar.tsx`. Seen end on it's a disc
 * the strands lie across, drawn behind them, with no passes. Seen side on, running across, it has a `length`, and
 * strands pass in front of it and behind it.
 */

import { BarDrawing } from "@/knots/bar";
import type { Box, Cubic } from "@/lib/bezier";
import { segmentIntersection } from "@/lib/geometry";
import { Vector2 } from "@/lib/vector2";

import { FileError, onlyFields, readNumber, readObject, readPositive } from "../read-json";
import type { JsonObject, JsonValue } from "../versions";

import { readPasses, type PassEntry } from "./passes";

export type BarProp = {
    kind: "bar";
    /** Where its centre is (diameters, y down). */
    x: number;
    y: number;
    /** Its radius (diameters). */
    r: number;
    /** How long it is, seen side on; none when seen end on. */
    length?: number;
    /** Every pass across it, seen side on; none when seen end on. */
    passes: PassEntry[];
};

export const BAR = {
    kind: "bar" as const,

    read(value: JsonValue, at: string): BarProp {
        const json = readObject(value, at);
        onlyFields(json, at, ["kind", "x", "y", "r", "length", "passes"]);
        const bar: BarProp = {
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
            const hit = segmentIntersection(samples[i], samples[i + 1], a, b);
            if (!hit) continue;
            // Newton's method on the curve's height, from where the polyline crossed.
            let t = (i + hit.t) / n;
            for (let k = 0; k < 8; k++) {
                const dy = cubic.derivativeAt(t).y;
                if (Math.abs(dy) < 1e-12) break;
                t -= (cubic.pointAt(t).y - bar.y) / dy;
            }
            if (!(t >= 0 && t < 1) || Math.abs(t - (i + hit.t) / n) > 1 / n) t = (i + hit.t) / n;
            if (!found.some((f) => Math.abs(f - t) < 1e-9)) found.push(t);
        }
        return found.sort((p, q) => p - q);
    },

    /**
     * Whether a pass in front must be over at this point of the strand: within the bar's radius of its middle line,
     * and a margin more so the rope's edges clear it.
     */
    covers: (bar: BarProp, point: Vector2) => Math.abs(point.y - bar.y) < bar.r + PASS_MARGIN,

    /** Seen side on, strands pass in front of it and behind it; seen end on, they lie across it. */
    between: (bar: BarProp) => bar.length !== undefined,

    draw: (bar: BarProp) => <BarDrawing bar={bar} />,

    bounds(bar: BarProp): Box {
        const half = bar.length ? bar.length / 2 : bar.r;
        return {
            min: new Vector2(bar.x - half, bar.y - bar.r),
            max: new Vector2(bar.x + half, bar.y + bar.r),
        };
    },
};

/** How far past the bar's edge (diameters, across it) a pass in front is drawn over. */
const PASS_MARGIN = 0.6;

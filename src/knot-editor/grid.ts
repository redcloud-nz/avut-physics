/**
 * The canvas's grid: lines every `GRID` millimetres, every fifth one stronger, and snapping to them. Zoomed in, fine
 * lines split each square into a 5 mm grid, and further in, millimetre lines split those. The grid is fixed: zoomed out, the lines too close together on screen are
 * left out rather than spaced further apart. Drags snap to the finest lines the zoom shows.
 */

import { Vector2 } from "@/lib/vector2";

import type { FrameSides } from "./edits";
import type { Frame } from "./format";
import { percentOf } from "./zoom";

/** How far apart the grid's lines are (millimetres). */
export const GRID = 20;

/** Every this many lines, one is stronger (and numbered). */
export const STRONG_EVERY = 5;

/** The fine lines' spacing, zoomed in (millimetres): four to each grid square. */
export const FINE_GRID = 5;

/** Lines closer together than this on screen (pixels) aren't drawn. */
export const CLOSEST_LINES = 8;

/** The millimetre lines' spacing, zoomed further in (millimetres): five to each fine square. */
export const MM_GRID = 1;

/** The zoom (percent) the fine lines come in at. */
export const FINE_FROM = 150;

/**
 * The zoom (percent) the millimetre lines come in at: where the fine lines are as far apart as the grid lines are
 * when the fine lines come in (600%).
 */
export const MM_FROM = (FINE_FROM * GRID) / FINE_GRID;

/** The zoom (percent) from which every grid line is numbered, not just the strong ones. */
export const NUMBERED_FROM = 200;

/** Whether a zoom is at a level or above it, allowing for rounding in a zoom stepped or typed to it. */
const atLeast = (scale: number, percent: number) => percentOf(scale) * 1.001 >= percent;

/**
 * The zoom (percent) from which every fine line is numbered too: where they're as far apart as the grid lines are when
 * those are first numbered (800%).
 */
export const FINE_NUMBERED_FROM = (NUMBERED_FROM * GRID) / FINE_GRID;

/** Whether every grid line is numbered at this zoom (pixels per millimetre). */
export const everyLineNumbered = (scale: number) => atLeast(scale, NUMBERED_FROM);

/** Whether every fine line is numbered at this zoom (pixels per millimetre). */
export const everyFineLineNumbered = (scale: number) => atLeast(scale, FINE_NUMBERED_FROM);

/**
 * How far apart the finest lines drawn at this zoom (pixels per millimetre) are: the millimetre lines' spacing from
 * `MM_FROM`, the fine lines' from `FINE_FROM`, then the grid's, then the strong lines' where the others would be too close together, or none where even
 * those would.
 */
export function finestStep(scale: number): number | undefined {
    if (atLeast(scale, MM_FROM)) return MM_GRID;
    if (atLeast(scale, FINE_FROM)) return FINE_GRID;
    if (GRID * scale >= CLOSEST_LINES) return GRID;
    if (GRID * STRONG_EVERY * scale >= CLOSEST_LINES) return GRID * STRONG_EVERY;
    return undefined;
}

/** How far apart the lines drags snap to are at this zoom: the finest drawn, or the strong lines' with none drawn. */
export const snapStep = (scale: number) => finestStep(scale) ?? GRID * STRONG_EVERY;

/** A value on the nearest line `step` apart. */
export const snapped = (value: number, step: number) => Math.round(value / step) * step || 0;

/** The move that takes `anchor`, moved by `by`, onto the nearest point of the lines `step` apart instead. */
export const snappedMove = (anchor: Vector2, by: Vector2, step: number) =>
    new Vector2(
        snapped(anchor.x + by.x, step) - anchor.x,
        snapped(anchor.y + by.y, step) - anchor.y,
    );

/**
 * The frame with the edges `sides` names on their nearest lines `step` apart. An edge stays where it was if snapping
 * it would bring it to or past the opposite edge.
 */
export function snappedFrame(frame: Frame, [across, down]: FrameSides, step: number): Frame {
    const on = (value: number) => snapped(value, step);
    let [x0, x1, y0, y1] = [frame.x, frame.x + frame.w, frame.y, frame.y + frame.h];
    if (across < 0 && on(x0) < x1) x0 = on(x0);
    if (across > 0 && on(x1) > x0) x1 = on(x1);
    if (down < 0 && on(y0) < y1) y0 = on(y0);
    if (down > 0 && on(y1) > y0) y1 = on(y1);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A line's weight, from the faintest: a millimetre line, a fine line, a grid line, or a strong one. */
export type GridWeight = "mm" | "fine" | "grid" | "strong";
export type GridLine = { at: number; weight: GridWeight };

/** The lines to draw from `from` to `to` (millimetres, along one axis) at a zoom of `scale` pixels per millimetre. */
export function gridLines(from: number, to: number, scale: number): GridLine[] {
    const step = finestStep(scale);
    if (step === undefined) return [];
    const lines: GridLine[] = [];
    for (let k = Math.ceil(from / step); k * step <= to; k++) {
        const at = k * step || 0;
        const mms = Math.round(at / MM_GRID);
        const weight =
            mms % (GRID * STRONG_EVERY) === 0
                ? "strong"
                : mms % GRID === 0
                  ? "grid"
                  : mms % FINE_GRID === 0
                    ? "fine"
                    : "mm";
        lines.push({ at, weight });
    }
    return lines;
}

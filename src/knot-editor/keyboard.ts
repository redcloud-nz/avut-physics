/**
 * Moving and turning what's selected from the keyboard, and stepping the selection from pin to pin. Moves go as a
 * drag does: a linked pin moves the free pin heading its chain, and turning it turns that pin. With snap on, a move
 * takes the first pin (or the prop) to the next line of the grid that way, and a turn to the next multiple of its
 * step; with it off, they go by their step.
 */

import { deg, roundTo } from "@/lib/math";
import { Vector2 } from "@/lib/vector2";

import { changeProp, movePin, setPinAngle } from "./edits";
import type { PictureGeometry } from "./geometry";
import { FINE_GRID, GRID, MM_GRID, snapStep, STRONG_EVERY } from "./grid";
import { headOf, pinPlaces } from "./ids";
import type { Picture, PinRef } from "./knot-file";
import { kindOf } from "./props";
import type { Selection } from "./state";

/** How far a move goes with snap off (millimetres), and with Shift. */
export const MOVE_STEP = 1;
export const FAR_MOVE_STEP = 10;

/** How far a turn goes (degrees), and with Shift. */
export const TURN_STEP = 5;
export const FAR_TURN_STEP = 15;

/** The grid's spacings, finest first. */
const LEVELS = [MM_GRID, FINE_GRID, GRID, GRID * STRONG_EVERY];

/**
 * How far a move goes: with snap on, the spacing of the lines drags snap to at this zoom (pixels per millimetre), or
 * with Shift, of the level above them.
 */
export function moveStep(scale: number, snap: boolean, far: boolean): number {
    if (!snap) return far ? FAR_MOVE_STEP : MOVE_STEP;
    const step = snapStep(scale);
    if (!far) return step;
    return LEVELS.find((level) => level > step + 1e-9) ?? step * STRONG_EVERY;
}

/** A value rounded to a tenth, written as it reads: 0.3, not 0.30000000000000004. */
const tenths = (v: number) => roundTo(v, 1);

/** The next value past `value` that's a multiple of `step`, going up (`sign` 1) or down (−1). */
export function nextLine(value: number, step: number, sign: 1 | -1): number {
    const k = value / step;
    const next = sign > 0 ? Math.floor(k + 1e-9) + 1 : Math.ceil(k - 1e-9) - 1;
    return next * step || 0;
}

/** The free pins a selection moves: its pins, its segments' ends, or its strand's pins, each chain's head once. */
function pinsMoved(picture: Picture, selection: Selection): PinRef[] {
    const refs: PinRef[] =
        selection.kind === "strand"
            ? (picture.strands[selection.strand]?.pins.map(
                  (_, k): PinRef => [selection.strand, k],
              ) ?? [])
            : selection.kind === "parts"
              ? [
                    ...selection.pins,
                    ...selection.segments.flatMap(([i, k]): PinRef[] => [
                        [i, k],
                        [i, k + 1],
                    ]),
                ]
              : [];
    const places = pinPlaces(picture);
    const heads: PinRef[] = [];
    for (const ref of refs) {
        const head = headOf(picture, ref, places);
        if (!heads.some((h) => h[0] === head[0] && h[1] === head[1])) heads.push(head);
    }
    return heads;
}

/**
 * The picture with what's selected moved one step along `direction` (a unit step along x or y, y down). With `snap`,
 * the first pin moved (or the prop's centre) goes to the next line `step` apart that way, and the rest go with it.
 */
export function moved(
    picture: Picture,
    geometry: PictureGeometry,
    selection: Selection,
    direction: { x: -1 | 0 | 1; y: -1 | 0 | 1 },
    step: number,
    snap: boolean,
): Picture {
    /** The move for something at `at`. */
    const by = (at: Vector2) => {
        const along = (value: number, sign: -1 | 0 | 1) =>
            sign === 0 ? 0 : snap ? nextLine(value, step, sign) - value : sign * step;
        return new Vector2(along(at.x, direction.x), along(at.y, direction.y));
    };
    if (selection.kind === "prop") {
        const prop = picture.props[selection.prop];
        if (!prop) return picture;
        const box = kindOf(prop).bounds(prop);
        const d = by(box.min.mid(box.max));
        const shift = new Vector2(tenths(d.x), tenths(d.y));
        return changeProp(picture, selection.prop, (p) => kindOf(p).moved(p, shift));
    }
    const pins = pinsMoved(picture, selection);
    if (!pins.length) return picture;
    const place = ([i, k]: PinRef) => geometry.strands[i].pins[k];
    const first = place(pins[0]);
    const d = by(new Vector2(first.x, first.y));
    return pins.reduce((q, ref) => {
        const at = place(ref);
        return movePin(q, ref, tenths(at.x + d.x), tenths(at.y + d.y));
    }, picture);
}

/**
 * The picture with each selected pin turned one step, clockwise on the screen (`sign` 1) or anticlockwise (−1). A pin
 * holding no angle starts from the way its curve runs. With `snap`, each goes to the next multiple of `step` that way.
 */
export function turned(
    picture: Picture,
    geometry: PictureGeometry,
    selection: Selection,
    sign: 1 | -1,
    step: number,
    snap: boolean,
): Picture {
    if (selection.kind !== "parts") return picture;
    const places = pinPlaces(picture);
    const heads: PinRef[] = [];
    for (const ref of selection.pins) {
        const head = headOf(picture, ref, places);
        if (!heads.some((h) => h[0] === head[0] && h[1] === head[1])) heads.push(head);
    }
    return heads.reduce((q, [i, k]) => {
        const shape = geometry.strands[i];
        const now = shape.pins[k].angle ?? deg(shape.directions[k].angle());
        const angle = snap ? nextLine(now, step, sign) : now + sign * step;
        return setPinAngle(q, [i, k], tenths(angle));
    }, picture);
}

/**
 * The pin after the one selected (`sign` 1) or before it (−1), along its strand and on into the next strand, round
 * to the start after the last. With nothing or several selected, it starts from the first or last pin selected; with
 * a segment, from its first pin; with a whole strand, from its first pin.
 */
export function nextPin(picture: Picture, selection: Selection, sign: 1 | -1): PinRef | undefined {
    const all = picture.strands.flatMap((s, i) => s.pins.map((_, k): PinRef => [i, k]));
    if (!all.length) return undefined;
    const indexOf = ([i, k]: PinRef) => all.findIndex((r) => r[0] === i && r[1] === k);
    const from: PinRef | undefined =
        selection.kind === "strand"
            ? [selection.strand, 0]
            : selection.kind === "parts"
              ? selection.pins.length
                  ? selection.pins[sign > 0 ? selection.pins.length - 1 : 0]
                  : selection.segments[0]
              : undefined;
    if (!from) return all[sign > 0 ? 0 : all.length - 1];
    if (selection.kind === "strand" || (selection.kind === "parts" && !selection.pins.length))
        return from;
    const at = indexOf(from);
    return all[(at + sign + all.length) % all.length];
}

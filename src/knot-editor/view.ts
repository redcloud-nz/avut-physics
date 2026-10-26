/**
 * The canvas's view: where it's centred (millimetres) and how big a millimetre is drawn (pixels). The view is kept
 * on the knot: it zooms out only until the frame fills half of it, and pans only as far as having the frame's edge, or
 * the edge of whatever's drawn outside the frame, in its middle.
 */

import type { Box } from "@/lib/bezier";
import { clamp } from "@/lib/math";
import { Vector2 } from "@/lib/vector2";

import type { PictureGeometry } from "./geometry";
import type { Frame, Picture } from "./knot-file";
import { kindOf } from "./props";
import { MOST_SCALE, withinZoom } from "./zoom";

/** Where the view is centred (millimetres) and how big a millimetre is drawn (pixels). */
export type View = { cx: number; cy: number; scale: number };
/** The canvas's size (pixels). */
export type Size = { w: number; h: number };

/** How far round the picture the fitted view leaves (millimetres: 3 diameters of an 11 mm rope). */
const MARGIN = 33;

/** The box holding the frame and every strand and prop. */
export function pictureBox(picture: Picture, geometry: PictureGeometry, frame: Frame): Box {
    const boxes = [
        {
            min: new Vector2(frame.x, frame.y),
            max: new Vector2(frame.x + frame.w, frame.y + frame.h),
        },
        ...geometry.strands.flatMap((strand) => strand.segments.map((seg) => seg.box)),
        ...picture.props.map((prop) => kindOf(prop).bounds(prop)),
    ];
    return {
        min: new Vector2(
            Math.min(...boxes.map((b) => b.min.x)),
            Math.min(...boxes.map((b) => b.min.y)),
        ),
        max: new Vector2(
            Math.max(...boxes.map((b) => b.max.x)),
            Math.max(...boxes.map((b) => b.max.y)),
        ),
    };
}

/** The zoom that takes in the whole box, with a margin round it. */
const fittingScale = (box: Box, size: Size) =>
    Math.min(
        size.w / (box.max.x - box.min.x + 2 * MARGIN),
        size.h / (box.max.y - box.min.y + 2 * MARGIN),
    );

/** The view taking in the whole box (the frame and everything drawn), with a margin round it. */
export const fitted = (box: Box, frame: Frame, size: Size): View =>
    bounded(
        {
            cx: (box.min.x + box.max.x) / 2,
            cy: (box.min.y + box.max.y) / 2,
            scale: fittingScale(box, size),
        },
        box,
        frame,
        size,
    );

/**
 * The least zoom: where the frame fills half the view across or down, whichever it fills first. Where what's drawn
 * reaches further, it zooms out far enough to fit it all.
 */
export function leastScale(box: Box, frame: Frame, size: Size): number {
    const half = Math.min(size.w / (2 * frame.w), size.h / (2 * frame.h));
    return withinZoom(Math.min(half, fittingScale(box, size)));
}

/**
 * The view kept on the knot: zoomed in no closer than the editor allows and out no further than `leastScale`, and
 * centred within the box (the frame, and whatever's drawn outside it).
 */
export function bounded(view: View, box: Box, frame: Frame, size: Size): View {
    return {
        cx: clamp(view.cx, box.min.x, box.max.x),
        cy: clamp(view.cy, box.min.y, box.max.y),
        scale: clamp(view.scale, leastScale(box, frame, size), MOST_SCALE),
    };
}

/**
 * The knot's frame on the canvas: what its page will show of every picture. Drawn as a dashed rectangle, with
 * everything outside it dimmed, and dragged by its edges and corners. Sizes are in screen pixels, turned into
 * millimetres by `px`.
 */

import { memo } from "react";

import { svgNumber } from "@/lib/svg-path";

import type { FrameSides } from "./edits";
import type { Frame } from "./format";

/** How wide the frame's edges and corners are to pick up (pixels). */
const EDGE = 8;

/** A rectangle as path data, clockwise from its top left. */
const rectangle = (x: number, y: number, w: number, h: number) =>
    `M ${svgNumber(x)} ${svgNumber(y)} h ${svgNumber(w)} v ${svgNumber(h)} h ${svgNumber(-w)} Z`;

/**
 * The frame's outline, and the dimming outside it: one path from the edges of `view` (the visible area, in
 * millimetres) to the frame, filled even-odd so the frame's inside is left clear.
 */
export function FrameDrawing(props: {
    frame: Frame;
    view: { x: number; y: number; w: number; h: number };
    px: number;
}) {
    const { frame, view, px } = props;
    // Out past the view, so the edge of the dimming is never seen.
    const [x0, y0] = [Math.min(view.x, frame.x) - 1, Math.min(view.y, frame.y) - 1];
    const [x1, y1] = [
        Math.max(view.x + view.w, frame.x + frame.w) + 1,
        Math.max(view.y + view.h, frame.y + frame.h) + 1,
    ];
    const inside = rectangle(frame.x, frame.y, frame.w, frame.h);
    return (
        <g pointerEvents="none">
            <path
                d={`${rectangle(x0, y0, x1 - x0, y1 - y0)} ${inside}`}
                fillRule="evenodd"
                fill="var(--background)"
                fillOpacity={0.6}
            />
            <path
                d={inside}
                fill="none"
                stroke="var(--line)"
                strokeWidth={1.5 * px}
                strokeDasharray={`${6 * px} ${4 * px}`}
            />
        </g>
    );
}

const CURSORS: Record<string, string> = {
    "-1,0": "cursor-ew-resize",
    "1,0": "cursor-ew-resize",
    "0,-1": "cursor-ns-resize",
    "0,1": "cursor-ns-resize",
    "-1,-1": "cursor-nwse-resize",
    "1,1": "cursor-nwse-resize",
    "1,-1": "cursor-nesw-resize",
    "-1,1": "cursor-nesw-resize",
};

/** The frame's hit areas: along each edge, and a square at each corner, over the edges. */
export const FrameHandles = memo(function FrameHandles(props: { frame: Frame; px: number }) {
    const { frame, px } = props;
    const half = (EDGE / 2) * px;
    const [x0, x1, y0, y1] = [frame.x, frame.x + frame.w, frame.y, frame.y + frame.h];
    const area = (sides: FrameSides, x: number, y: number, w: number, h: number) => (
        <rect
            key={sides.join(",")}
            data-hit="frame"
            data-ref={sides.join(",")}
            className={CURSORS[sides.join(",")]}
            x={x}
            y={y}
            width={w}
            height={h}
            fill="transparent"
        />
    );
    return (
        <g>
            {area([-1, 0], x0 - half, y0, 2 * half, frame.h)}
            {area([1, 0], x1 - half, y0, 2 * half, frame.h)}
            {area([0, -1], x0, y0 - half, frame.w, 2 * half)}
            {area([0, 1], x0, y1 - half, frame.w, 2 * half)}
            {area([-1, -1], x0 - half, y0 - half, 2 * half, 2 * half)}
            {area([1, -1], x1 - half, y0 - half, 2 * half, 2 * half)}
            {area([-1, 1], x0 - half, y1 - half, 2 * half, 2 * half)}
            {area([1, 1], x1 - half, y1 - half, 2 * half, 2 * half)}
        </g>
    );
});

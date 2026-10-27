/**
 * A picture from a knot file, drawn for the knots' pages with the knot editor's own drawing, so a knot looks on its page
 * as it does in the editor. It's worked out where the page renders, on the server, and only the drawing reaches the
 * browser: working the curves out again there could come out different in the last digits.
 */

import { useId } from "react";

import {
    pictureCrossings,
    strandPaths,
    type PictureCrossings,
} from "@/knot-editor/crossing-geometry";
import { pictureGeometry, type PictureGeometry } from "@/knot-editor/geometry";
import type { Frame, Picture } from "@/knot-editor/knot-file";
import { PictureDrawing } from "@/knot-editor/picture-drawing";
import { kindOf } from "@/knot-editor/props";
import { roundTo } from "@/lib/math";
import type { Vector2 } from "@/lib/vector2";

/** The knots' ropes' diameter (millimetres), which their pages' sizes are in. */
const DIAMETER = 11;

/** How big a knot is drawn on its page (pixels per millimetre): 11 pixels across an 11 mm rope. */
export const PAGE_SCALE = 11 / DIAMETER;

/** A picture worked out: its geometry, crossings, and each strand's path, marked over where it's on top. */
export type WorkedPicture = {
    picture: Picture;
    geometry: PictureGeometry;
    crossings: PictureCrossings;
    paths: ReturnType<typeof strandPaths>["paths"];
};

export function workedPicture(picture: Picture): WorkedPicture {
    const geometry = pictureGeometry(picture);
    const crossings = pictureCrossings(picture, geometry);
    return { picture, geometry, crossings, paths: strandPaths(picture, geometry, crossings).paths };
}

/**
 * How far below a finished knot's lowest crossing (or pass across a prop) its view reaches, showing its ends leaving it
 * (millimetres).
 */
const ENDS = 8 * DIAMETER;

/** How far round the knot its view leaves (millimetres). */
const MARGIN = 1.5 * DIAMETER;

/**
 * Which way a knot's rope runs on out of it: out of the bottom of its drawing (`down`), out of the top as well
 * (`both`, as in a bend), or out of both sides (`across`, as in a knot tied in the middle of a rope drawn lying across).
 */
export type KnotEnds = "down" | "both" | "across";

/**
 * The view fitted to a knot finished: across the knot with a margin each side, from the top of the rope to a little
 * way below the knot, where its ends run on out of the bottom. Where its ends run out of the top too, it stops as far
 * above the knot as below; where they run out of the sides, it's around the rope from top to bottom, and stops as far
 * either side of the knot as it would below. It takes in any prop the knot's tied round. Drawn at a fixed size per
 * millimetre, every knot's rope is as thick as every other's, and a bigger knot takes more room.
 */
export function knotView(worked: WorkedPicture, ends: KnotEnds = "down"): Frame {
    const { picture, geometry, crossings } = worked;
    const ropes = picture.strands.flatMap((strand, i) => (strand.kind === "rope" ? [i] : []));
    const points: Vector2[] = ropes.flatMap((i) =>
        geometry.strands[i].segments.flatMap((seg) => seg.cubic.points(16)),
    );
    for (const prop of picture.props) {
        const box = kindOf(prop).bounds(prop);
        points.push(box.min, box.max);
    }
    /** Where the rope crosses itself and passes across props. */
    const knotted = [
        ...crossings.crossings
            .filter((c) => c.pair.every(([i]) => ropes.includes(i)))
            .map((c) => c.at),
        ...crossings.passes.filter((p) => ropes.includes(p.strand)).map((p) => p.at),
    ];
    const [xs, ys] = [points.map((p) => p.x), points.map((p) => p.y)];
    if (ends === "across") {
        const at = knotted.map((p) => p.x);
        const [left, right] = [Math.min(...at) - ENDS, Math.max(...at) + ENDS];
        const [top, bottom] = [Math.min(...ys) - MARGIN, Math.max(...ys) + MARGIN];
        return { x: left, y: top, w: right - left, h: bottom - top };
    }
    const at = knotted.map((p) => p.y);
    const [left, right] = [Math.min(...xs) - MARGIN, Math.max(...xs) + MARGIN];
    const top = ends === "both" ? Math.min(...at) - ENDS : Math.min(...ys) - MARGIN;
    const bottom = at.length ? Math.max(...at) + ENDS : Math.max(...ys);
    return { x: left, y: top, w: right - left, h: bottom - top };
}

/** How far in from the view's edge a rope running off it fades out over (millimetres). */
const FADE = 3 * DIAMETER;

type Side = "left" | "right" | "top" | "bottom";

/** The sides of the view a rope runs off, its centreline going on past them. */
function sidesRunOff(worked: WorkedPicture, view: Frame): Side[] {
    const points = worked.picture.strands.flatMap((strand, i) =>
        strand.kind === "rope"
            ? worked.geometry.strands[i].segments.flatMap((seg) => seg.cubic.points(16))
            : [],
    );
    const past: Record<Side, (p: Vector2) => boolean> = {
        left: (p) => p.x < view.x,
        right: (p) => p.x > view.x + view.w,
        top: (p) => p.y < view.y,
        bottom: (p) => p.y > view.y + view.h,
    };
    return (Object.keys(past) as Side[]).filter((side) => points.some(past[side]));
}

/**
 * A mask fading the drawing out towards each of the `sides` given, over the last `FADE` of the view: a hint that the
 * rope goes on past the edge rather than stopping there. Each side's fade darkens the mask over the rest, so where two
 * meet in a corner they multiply.
 */
function FadeMask(props: { id: string; view: Frame; sides: Side[] }) {
    const { x, y, w, h } = props.view;
    // Each side's gradient, from its edge inwards.
    const from: Record<Side, [number, number, number, number]> = {
        left: [x, 0, x + FADE, 0],
        right: [x + w, 0, x + w - FADE, 0],
        top: [0, y, 0, y + FADE],
        bottom: [0, y + h, 0, y + h - FADE],
    };
    return (
        <mask id={props.id} maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}>
            <rect x={x} y={y} width={w} height={h} fill="white" />
            {props.sides.map((side) => {
                const [x1, y1, x2, y2] = from[side];
                return (
                    <g key={side}>
                        <linearGradient
                            id={`${props.id}-${side}`}
                            gradientUnits="userSpaceOnUse"
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                        >
                            <stop offset={0} stopColor="black" />
                            <stop offset={1} stopColor="black" stopOpacity={0} />
                        </linearGradient>
                        <rect x={x} y={y} width={w} height={h} fill={`url(#${props.id}-${side})`} />
                    </g>
                );
            })}
        </mask>
    );
}

/**
 * The picture in the view, in an SVG. `turned` lays it on its side, a quarter turn clockwise, so the end that was at
 * the top is on the right. Given a `scale` (pixels per millimetre) it's drawn that size, shrinking only to fit the
 * width it has (and the height, where its box has one); otherwise it fills whatever box its class gives it. Where a
 * rope runs off an edge, the drawing fades out towards it. It's hidden from screen readers when its label is null
 * (where it's only decoration).
 */
export function KnotDrawing(props: {
    worked: WorkedPicture;
    view: Frame;
    turned?: boolean;
    label: string | null;
    scale?: number;
    className?: string;
}) {
    const { worked, view, turned, label, scale } = props;
    const mask = `knot-fade-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
    const sides = sidesRunOff(worked, view);
    // Turning maps (x, y) to (-y, x), so the view's x span becomes its y span, and its y span its x span the other way.
    const box = turned
        ? [-(view.y + view.h), view.x, view.h, view.w]
        : [view.x, view.y, view.w, view.h];
    return (
        <svg
            viewBox={box.map((v) => roundTo(v, 2)).join(" ")}
            className={props.className}
            {...(scale && {
                width: roundTo(box[2] * scale, 2),
                height: roundTo(box[3] * scale, 2),
                style: { maxWidth: "100%", maxHeight: "100%", height: "auto" },
            })}
            {...(label === null ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
        >
            {sides.length > 0 && <FadeMask id={mask} view={view} sides={sides} />}
            <g transform={turned ? "rotate(90)" : undefined}>
                <g mask={sides.length > 0 ? `url(#${mask})` : undefined}>
                    <PictureDrawing
                        picture={worked.picture}
                        geometry={worked.geometry}
                        paths={worked.paths}
                    />
                </g>
            </g>
        </svg>
    );
}

/**
 * Each step's label, from the numbers: "Step 2", or "Step 2 (cont.)" for a step showing the same number again (a step
 * shown in two pictures).
 */
export function stepLabels(numbers: number[]): string[] {
    return numbers.map((n, k) =>
        k > 0 && numbers[k - 1] === n ? `Step ${n} (cont.)` : `Step ${n}`,
    );
}

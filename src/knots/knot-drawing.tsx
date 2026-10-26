/**
 * A picture from a knot file, drawn for the knots' pages with the knot editor's own drawing, so a knot looks on its page
 * as it does in the editor. It's worked out where the page renders, on the server, and only the drawing reaches the
 * browser: working the curves out again there could come out different in the last digits.
 */

import {
    pictureCrossings,
    strandPaths,
    type PictureCrossings,
} from "@/knot-editor/crossing-geometry";
import type { Frame, Picture } from "@/knot-editor/format";
import { pictureGeometry, type PictureGeometry } from "@/knot-editor/geometry";
import { PictureDrawing } from "@/knot-editor/picture-drawing";
import { kindOf } from "@/knot-editor/props";
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

/** How far below a finished knot's lowest crossing its view reaches, showing its ends leaving it (millimetres). */
const ENDS = 8 * DIAMETER;

/** How far round the knot its view leaves (millimetres). */
const MARGIN = 1.5 * DIAMETER;

/**
 * The view fitted to a knot finished: across the knot with a margin each side, from the top of the rope to a little
 * way below the knot, where its ends run on out of the bottom. Where its ends run out of the top too (`bothWays`, as
 * in a bend), it stops as far above the knot as below. It takes in any prop the knot's tied round. Drawn at a fixed
 * size per millimetre, every knot's rope is as thick as every other's, and a bigger knot takes more room.
 */
export function knotView(worked: WorkedPicture, bothWays = false): Frame {
    const { picture, geometry, crossings } = worked;
    const ropes = picture.strands.flatMap((strand, i) => (strand.kind === "rope" ? [i] : []));
    const points: Vector2[] = ropes.flatMap((i) =>
        geometry.strands[i].segments.flatMap((seg) => seg.cubic.points(16)),
    );
    for (const prop of picture.props) {
        const box = kindOf(prop).bounds(prop);
        points.push(box.min, box.max);
    }
    const ys = crossings.crossings
        .filter((c) => c.pair.every(([i]) => ropes.includes(i)))
        .map((c) => c.at.y);
    const xs = points.map((p) => p.x);
    const [left, right] = [Math.min(...xs) - MARGIN, Math.max(...xs) + MARGIN];
    const top = bothWays ? Math.min(...ys) - ENDS : Math.min(...points.map((p) => p.y)) - MARGIN;
    const bottom = ys.length ? Math.max(...ys) + ENDS : Math.max(...points.map((p) => p.y));
    return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * The picture in the view, in an SVG. `turned` lays it on its side, a quarter turn clockwise, so the end that was at
 * the top is on the right. Given a `scale` (pixels per millimetre) it's drawn that size, shrinking only to fit the
 * width it has (and the height, where its box has one); otherwise it fills whatever box its class gives it. It's
 * hidden from screen readers when its label is null (where it's only decoration).
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
    // Turning maps (x, y) to (-y, x), so the view's x span becomes its y span, and its y span its x span the other way.
    const box = turned
        ? [-(view.y + view.h), view.x, view.h, view.w]
        : [view.x, view.y, view.w, view.h];
    return (
        <svg
            viewBox={box.map((v) => Math.round(v * 100) / 100).join(" ")}
            className={props.className}
            {...(scale && {
                width: Math.round(box[2] * scale * 100) / 100,
                height: Math.round(box[3] * scale * 100) / 100,
                style: { maxWidth: "100%", maxHeight: "100%", height: "auto" },
            })}
            {...(label === null ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
        >
            <g transform={turned ? "rotate(90)" : undefined}>
                <PictureDrawing
                    picture={worked.picture}
                    geometry={worked.geometry}
                    paths={worked.paths}
                />
            </g>
        </svg>
    );
}

/**
 * Each step's label, from the numbers: "Step 2 of 5", or "Step 2 (cont.)" for a step showing the same number again
 * (a step shown in two pictures).
 */
export function stepLabels(numbers: number[]): string[] {
    const most = Math.max(0, ...numbers);
    return numbers.map((n, k) =>
        k > 0 && numbers[k - 1] === n ? `Step ${n} (cont.)` : `Step ${n} of ${most}`,
    );
}

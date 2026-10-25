import { Vector2 } from "@/lib/vector2";

import { BarDrawing, type Bar } from "./bar";
import { tyingView, type TyingStep } from "./figure-eight-tying";
import { RopeDrawing } from "./rope-drawing";
import { centreline, crossings, type RopePath } from "./rope-path";
import { TyingArrow, type Arrow } from "./tying-arrow";

type View = { x: number; y: number; w: number; h: number };

/** The view every step of a knot's tying shares, so the rope stays put as the steps change. It takes in any bar. */
export function stepsView(steps: TyingStep[], bar?: Bar): View {
    return tyingView([
        ...steps.flatMap((step) => [
            centreline(step.path).points,
            ...(step.first ? [centreline(step.first).points] : []),
            ...step.arrows.map((arrow) => arrow.points),
        ]),
        bar ? barEdges(bar) : [],
    ]);
}

/** The bar's edges as far as they reach each way. */
const barEdges = (bar: Bar) =>
    [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ].map(([dx, dy]) => new Vector2(bar.x + dx * bar.r, bar.y + dy * bar.r));

/** How far below a finished knot's lowest crossing its view reaches, showing its ends leaving it (diameters). */
const ENDS = 8;

/**
 * The view fitted to a knot finished: centred across the knot, from the top of the rope to a little way below the
 * knot, where its ends run on out of the bottom. Where its ends run out of the top too (`bothWays`, as in a bend), it
 * stops as far above the knot as below. It takes in any bar the knot's tied round. Drawn at a fixed size per diameter, every knot's rope is then as thick as every
 * other's, and a bigger knot takes more room.
 */
export function ropeView(ropes: RopePath[], bothWays = false, bar?: Bar, margin = 1.5): View {
    const points = ropes.flatMap((path) => centreline(path).points);
    if (bar) points.push(...barEdges(bar));
    const ys = ropes.flatMap((path) => crossings(path).map((c) => c.at.y));
    const lowest = Math.max(...ys);
    const x = Math.max(...points.map((p) => Math.abs(p.x))) + margin;
    const top = bothWays ? Math.min(...ys) - ENDS : Math.min(...points.map((p) => p.y)) - margin;
    const bottom = Number.isFinite(lowest) ? lowest + ENDS : Math.max(...points.map((p) => p.y));
    return { x: -x, y: top, w: 2 * x, h: bottom - top };
}

/** How big a finished knot is drawn on its page (pixels per rope diameter). */
export const PAGE_SCALE = 11;

/**
 * One step of tying a knot: the rope (or a knot finished, two ropes where it joins them), with arrows where the step shows the next move. `turned` lays it on its side, a
 * quarter turn clockwise, so the end that was at the top is on the right. Given a `scale` (pixels per diameter) it's
 * drawn that size, shrinking only to fit the width it has (and the height, where its box has one); otherwise it fills
 * whatever box its class gives it. It's
 * hidden from screen readers when its label is null (where it's only decoration).
 */
export function TyingDrawing(props: {
    step:
        | { path: RopePath; first?: RopePath; arrows?: Arrow[] }
        | { ropes: RopePath[]; arrows?: Arrow[] };
    view: View;
    turned?: boolean;
    label: string | null;
    /** Something the knot's tied round, drawn as a bar seen end on, under the rope. */
    bar?: Bar;
    scale?: number;
    className?: string;
}) {
    const { view, turned, label, scale } = props;
    const { arrows = [] } = props.step;
    const ropes =
        "ropes" in props.step
            ? props.step.ropes
            : [...(props.step.first ? [props.step.first] : []), props.step.path];
    // Turning maps (x, y) to (-y, x), so the view's x span becomes its y span, and its y span its x span the other way.
    const box = turned
        ? [-(view.y + view.h), view.x, view.h, view.w]
        : [view.x, view.y, view.w, view.h];
    return (
        <svg
            viewBox={box.join(" ")}
            className={props.className}
            {...(scale && {
                width: box[2] * scale,
                height: box[3] * scale,
                style: { maxWidth: "100%", maxHeight: "100%", height: "auto" },
            })}
            {...(label === null ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
        >
            <g transform={turned ? "rotate(90)" : undefined}>
                {/* Arrows go behind the rope unless they're marked in front, so one passing through a loop shows going
                    under it. */}
                {arrows.map(
                    (arrow, i) => !arrow.front && <TyingArrow key={i} points={arrow.points} />,
                )}
                {props.bar && <BarDrawing bar={props.bar} />}
                <RopeDrawing ropes={ropes} />
                {arrows.map(
                    (arrow, i) => arrow.front && <TyingArrow key={i} points={arrow.points} />,
                )}
                {/* Arrows that go over the rope and then under it: in front as far as their `frontTo` point. */}
                {arrows.map(
                    (arrow, i) =>
                        !arrow.front &&
                        arrow.frontTo !== undefined && (
                            <TyingArrow key={i} points={arrow.points} upTo={arrow.frontTo} />
                        ),
                )}
            </g>
        </svg>
    );
}

/**
 * The grid on the canvas (see `grid.ts`), drawn over the visible view only, under everything: its lines in
 * `--line-faint`, the fine and millimetre ones fainter still, and the strong ones wider, in `--line`. Its numbers
 * (millimetres) run along the view's top and left edges: at the strong lines, every few of them zoomed out, then at
 * every grid line and, further in, every fine line. They're drawn over the picture and the frame's dimming, outlined
 * so they read over anything. Sizes are in screen pixels, turned into millimetres by `px`.
 */

import {
    everyFineLineNumbered,
    everyLineNumbered,
    GRID,
    gridLines,
    STRONG_EVERY,
    type GridLine,
    type GridWeight,
} from "./grid";

/** The visible view (millimetres). */
type ViewBox = { x: number; y: number; w: number; h: number };

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

/** How wide the strong lines are drawn (pixels); the others are 1. */
const STRONG_WIDTH = 1.5;

/** How much of the grid lines' colour the fine lines have, and the millimetre lines. */
const [FINE_OPACITY, MM_OPACITY] = [0.5, 0.25];

export function GridDrawing(props: { view: ViewBox; px: number }) {
    const { view, px } = props;
    const [across, down] = [
        gridLines(view.x, view.x + view.w, 1 / px),
        gridLines(view.y, view.y + view.h, 1 / px),
    ];
    const path = (weight: GridWeight) =>
        [
            ...across
                .filter((l) => l.weight === weight)
                .map((l) => `M ${r4(l.at)} ${r4(view.y)} V ${r4(view.y + view.h)}`),
            ...down
                .filter((l) => l.weight === weight)
                .map((l) => `M ${r4(view.x)} ${r4(l.at)} H ${r4(view.x + view.w)}`),
        ].join(" ");
    return (
        <g pointerEvents="none" fill="none">
            <path
                d={path("mm")}
                stroke="var(--line-faint)"
                strokeOpacity={MM_OPACITY}
                strokeWidth={px}
            />
            <path
                d={path("fine")}
                stroke="var(--line-faint)"
                strokeOpacity={FINE_OPACITY}
                strokeWidth={px}
            />
            <path d={path("grid")} stroke="var(--line-faint)" strokeWidth={px} />
            <path d={path("strong")} stroke="var(--line)" strokeWidth={STRONG_WIDTH * px} />
        </g>
    );
}

/** How far in from the view's edges the numbers sit (pixels), and how big they are. */
const [INSET, SIZE] = [4, 10];

/** How close together numbers may be (pixels): closer, only every second, fifth or tenth strong line has one. */
const NUMBER_SPACING = 48;

/** Whether a strong line has a number, zoomed to `scale`: every one, or every few when they'd be too close. */
function numbered(at: number, scale: number) {
    const strong = GRID * STRONG_EVERY;
    const every = [1, 2, 5, 10].find((n) => n * strong * scale >= NUMBER_SPACING) ?? 10;
    return Math.round(at / strong) % every === 0;
}

export function GridNumbers(props: { view: ViewBox; px: number }) {
    const { view, px } = props;
    // Clear of the corner, where the two rows of numbers would meet.
    const [left, top] = [view.x + 40 * px, view.y + 24 * px];
    // And clear of the far edges, where they'd be cut off.
    const [right, bottom] = [view.x + view.w - 20 * px, view.y + view.h - 10 * px];
    // Zoomed in, every grid line has a number, then every fine line too; otherwise the strong ones, or every few.
    const [grid, fine] = [everyLineNumbered(1 / px), everyFineLineNumbered(1 / px)];
    const hasNumber = (l: GridLine) =>
        l.weight === "strong"
            ? grid || numbered(l.at, 1 / px)
            : l.weight === "grid"
              ? grid
              : l.weight === "fine" && fine;
    const shown = (l: GridLine, from: number, to: number) =>
        l.at > from && l.at < to && hasNumber(l);
    const across = gridLines(view.x, view.x + view.w, 1 / px).filter((l) => shown(l, left, right));
    const down = gridLines(view.y, view.y + view.h, 1 / px).filter((l) => shown(l, top, bottom));
    return (
        // Outlined in the background's colour, so they read over ropes and props too.
        <g
            pointerEvents="none"
            fill="var(--ink-muted)"
            stroke="var(--background)"
            strokeWidth={3 * px}
            strokeLinejoin="round"
            paintOrder="stroke"
            fontSize={SIZE * px}
        >
            {across.map((l) => (
                <text
                    key={`x${l.at}`}
                    x={l.at}
                    y={view.y + (INSET + SIZE) * px}
                    textAnchor="middle"
                >
                    {l.at}
                </text>
            ))}
            {down.map((l) => (
                <text key={`y${l.at}`} x={view.x + INSET * px} y={l.at} dominantBaseline="middle">
                    {l.at}
                </text>
            ))}
        </g>
    );
}

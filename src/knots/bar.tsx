import { useId } from "react";

/**
 * A metal bar for a knot to be tied round: a round tube the rope wraps round. Seen end on, the rope lies across the
 * bar's end rather than over or under it, so it's drawn before the rope. Seen side on, running across, it's in front
 * of the rope going round its back and behind the rope coming round its front, so it's drawn over the rope and under
 * the stretches marked over.
 *
 * Coordinates are rope diameters, as for the rope.
 */

/** Where the bar's centre is and its radius (diameters), and where it's seen side on, running across, how long it is. */
export type Bar = { x: number; y: number; r: number; length?: number };

const COLORS = {
    body: "var(--knot-bar)",
    shade: "var(--knot-bar-shade)",
    highlight: "var(--knot-bar-highlight)",
    outline: "var(--knot-outline)",
};

/** The bar's shading side on, from its top: a bright highlight near it, its own colour, then shade. */
const SIDE: [number, string][] = [
    [0, COLORS.body],
    [0.12, COLORS.highlight],
    [0.28, COLORS.highlight],
    [0.5, COLORS.body],
    [0.8, COLORS.shade],
    [1, COLORS.shade],
];

/** Its end's shading, out from the highlight on its upper left. */
const END: [number, string][] = [
    [0, COLORS.highlight],
    [0.3, COLORS.body],
    [0.85, COLORS.shade],
    [1, COLORS.shade],
];

const stops = (shading: [number, string][]) =>
    shading.map(([offset, color]) => (
        <stop key={offset} offset={offset} style={{ stopColor: color }} />
    ));

/**
 * The bar's end: a disc, lit from its upper left, shading off round to its lower right. Seen side on, a band lit along
 * its top and shaded along its bottom, cut off square at its ends. Its outline is sized for a rope `unit` across (1 by
 * default, for coordinates in rope diameters).
 */
export function BarDrawing(props: { bar: Bar; unit?: number }) {
    const { x, y, r, length } = props.bar;
    const { unit = 1 } = props;
    const id = `bar-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
    const outline = { stroke: COLORS.outline, strokeWidth: 0.25 * unit };
    if (length) {
        return (
            <g>
                <linearGradient id={id} x1={0} y1={0} x2={0} y2={1}>
                    {stops(SIDE)}
                </linearGradient>
                <rect
                    x={x - length / 2}
                    y={y - r}
                    width={length}
                    height={2 * r}
                    fill={`url(#${id})`}
                    {...outline}
                />
            </g>
        );
    }
    return (
        <g>
            <radialGradient id={id} cx={0.5} cy={0.5} r={0.5} fx={0.3} fy={0.3}>
                {stops(END)}
            </radialGradient>
            <circle cx={x} cy={y} r={r} fill={`url(#${id})`} {...outline} />
        </g>
    );
}

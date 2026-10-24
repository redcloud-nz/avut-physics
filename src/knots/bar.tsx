/**
 * A metal bar for a knot to be tied round, seen end on: a round tube the rope's loop wraps round. Seen that way the
 * rope lies across the bar's end rather than over or under it, so it's drawn before the rope.
 *
 * Coordinates are rope diameters, as for the rope.
 */

/** Where the bar's centre is and its radius (diameters). */
export type Bar = { x: number; y: number; r: number };

const COLORS = { body: "#94a3b8", shade: "#475569", highlight: "#f1f5f9", outline: "#0f172a" };

/** The bar's end: a disc, shaded round its edge, with a highlight on its upper left. */
export function BarDrawing(props: { bar: Bar }) {
    const { x, y, r } = props.bar;
    const glint = (a: number) => `${x + 0.65 * r * Math.cos(a)} ${y + 0.65 * r * Math.sin(a)}`;
    return (
        <g>
            <circle
                cx={x}
                cy={y}
                r={r}
                fill={COLORS.shade}
                stroke={COLORS.outline}
                strokeWidth={0.25}
            />
            <circle cx={x} cy={y} r={r * 0.8} fill={COLORS.body} />
            <path
                d={`M ${glint(Math.PI * 0.95)} A ${0.65 * r} ${0.65 * r} 0 0 1 ${glint(Math.PI * 1.45)}`}
                fill="none"
                stroke={COLORS.highlight}
                strokeOpacity={0.8}
                strokeWidth={0.25}
                strokeLinecap="round"
            />
        </g>
    );
}

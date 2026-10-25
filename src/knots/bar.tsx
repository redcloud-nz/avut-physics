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

const COLORS = { body: "#94a3b8", shade: "#475569", highlight: "#f1f5f9", outline: "#0f172a" };

/**
 * The bar's end: a disc, shaded round its edge, with a highlight on its upper left. Seen side on, a band, shaded along
 * its bottom, with a highlight along its top, and cut off square at its ends. Its lines are sized for a rope `unit`
 * across (1 by default, for coordinates in rope diameters).
 */
export function BarDrawing(props: { bar: Bar; unit?: number }) {
    const { x, y, r, length } = props.bar;
    const { unit = 1 } = props;
    if (length) {
        const left = x - length / 2;
        return (
            <g>
                <rect x={left} y={y - r} width={length} height={2 * r} fill={COLORS.shade} />
                <rect x={left} y={y - r} width={length} height={1.6 * r} fill={COLORS.body} />
                <path
                    d={`M ${left + 0.4 * unit} ${y - 0.55 * r} h ${length - 0.8 * unit}`}
                    stroke={COLORS.highlight}
                    strokeOpacity={0.8}
                    strokeWidth={0.25 * unit}
                    strokeLinecap="round"
                />
                <rect
                    x={left}
                    y={y - r}
                    width={length}
                    height={2 * r}
                    fill="none"
                    stroke={COLORS.outline}
                    strokeWidth={0.25 * unit}
                />
            </g>
        );
    }
    const glint = (a: number) => `${x + 0.65 * r * Math.cos(a)} ${y + 0.65 * r * Math.sin(a)}`;
    return (
        <g>
            <circle
                cx={x}
                cy={y}
                r={r}
                fill={COLORS.shade}
                stroke={COLORS.outline}
                strokeWidth={0.25 * unit}
            />
            <circle cx={x} cy={y} r={r * 0.8} fill={COLORS.body} />
            <path
                d={`M ${glint(Math.PI * 0.95)} A ${0.65 * r} ${0.65 * r} 0 0 1 ${glint(Math.PI * 1.45)}`}
                fill="none"
                stroke={COLORS.highlight}
                strokeOpacity={0.8}
                strokeWidth={0.25 * unit}
                strokeLinecap="round"
            />
        </g>
    );
}

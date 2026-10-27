/**
 * A carabiner for a knot to be tied round, seen face on: a pear-shaped (HMS) carabiner, upside down, with its wide end
 * at the bottom where the rope sits. The gate runs nearly straight up the right from the wide end to the round narrow end
 * above it, with a locking sleeve over most of it, and the spine runs up the left and diagonally across to the narrow
 * end. The rope wraps
 * the wide end, passing in front of it or behind it anywhere round it, so the carabiner is drawn over the rope and under
 * the stretches marked over.
 *
 * Coordinates are millimetres, y down. The shape is given in shares of the width and height, from the bottom end's
 * centre.
 */

import { Cubic } from "@/lib/bezier";
import { svgNumber } from "@/lib/svg-path";
import { Vector2 } from "@/lib/vector2";

/** Where its bottom end's centre is, its rod's radius, and how wide and tall it is (to the rod's middle line). */
export type Carabiner = { x: number; y: number; r: number; width: number; height: number };

const COLORS = {
    body: "var(--knot-bar)",
    shade: "var(--knot-bar-shade)",
    highlight: "var(--knot-bar-highlight)",
    outline: "var(--knot-outline)",
};

/** Where the bottom end runs flat, under the rope (shares of the width, from its centre). */
const FLAT: [number, number] = [-0.15, 0.12];

/** The gate's ends at the rod's middle line: its nose at the wide end, and its hinge under the narrow end. */
const [NOSE, HINGE]: [number, number][] = [
    [0.45, -0.3],
    [0.4, -0.8],
];

/** The gate's direction, for the curves either side of it to meet it smoothly. */
const GATE: [number, number] = [HINGE[0] - NOSE[0], HINGE[1] - NOSE[1]];

/**
 * The rod's middle line as curves, round from the bottom (shares of the width and height, from the bottom end's
 * centre): the flat, the right corner into the gate, up the gate, round the narrow end above it, down the spine
 * (diagonally, then straight down the left) and round the left corner. Each curve leaves its end the way the next
 * arrives, so it has no corners. The first two and the last are the wide end, which the rope wraps.
 */
const CURVES: [number, number][][] = [
    [
        [FLAT[0], 0],
        [FLAT[1], 0],
    ],
    [[FLAT[1], 0], [0.4, 0], [NOSE[0] - 0.3 * GATE[0], NOSE[1] - 0.3 * GATE[1]], NOSE],
    [NOSE, HINGE],
    [HINGE, [HINGE[0] + 0.25 * GATE[0], HINGE[1] + 0.25 * GATE[1]], [0.34, -1], [0.22, -1]],
    [
        [0.22, -1],
        [0.12, -1],
        [0.06, -0.96],
        [0, -0.9],
    ],
    [
        [0, -0.9],
        [-0.2, -0.7],
        [-0.46, -0.5],
        [-0.5, -0.3],
    ],
    [
        [-0.5, -0.3],
        [-0.53, -0.15],
        [-0.4, 0],
        [FLAT[0], 0],
    ],
];

/** Which of the curves are the wide end, where the rope can pass in front of the carabiner or behind it. */
const WIDE_END = [6, 0, 1];

/** The curves in millimetres. */
function curves({ x, y, width, height }: Carabiner): Cubic[] {
    const at = ([u, v]: [number, number]) => new Vector2(x + u * width, y + v * height);
    return CURVES.map((points) =>
        points.length === 2
            ? Cubic.line(at(points[0]), at(points[1]))
            : new Cubic(at(points[0]), at(points[1]), at(points[2]), at(points[3])),
    );
}

/** The wide end's middle line, from the spine round the bottom to the gate's nose, as points close together. */
export function wideEnd(c: Carabiner): Vector2[] {
    const all = curves(c);
    return WIDE_END.flatMap((k, j) => all[k].points(24).slice(j > 0 ? 1 : 0));
}

/** The rod's middle line, as SVG path data. */
export function carabinerPath(c: Carabiner): string {
    const all = curves(c);
    const point = (p: Vector2) => `${svgNumber(p.x)} ${svgNumber(p.y)}`;
    return [
        `M ${point(all[0].p0)}`,
        ...all.map((cubic) => `C ${point(cubic.p1)} ${point(cubic.p2)} ${point(cubic.p3)}`),
        "Z",
    ].join(" ");
}

/**
 * The rod, outlined and shaded along both edges, with a groove along its middle and a highlight beside it; the gate's
 * hinge rivet and the line where it closes on the nose; and the locking sleeve over most of the gate, from the nose up,
 * with ridges round it for grip. Its outline is sized for a rope `unit` across, as the rope's is; its finer lines for
 * its own rod.
 */
export function CarabinerDrawing(props: { carabiner: Carabiner; unit: number }) {
    const { carabiner, unit } = props;
    const { x, y, r, width, height } = carabiner;
    const d = carabinerPath(carabiner);
    const line = 0.25 * unit;
    // Along the gate from its nose (0) to its hinge (1), and across it (a unit vector times the rod's radius).
    const along = (share: number): [number, number] => [
        x + (NOSE[0] + (HINGE[0] - NOSE[0]) * share) * width,
        y + (NOSE[1] + (HINGE[1] - NOSE[1]) * share) * height,
    ];
    const [nx, ny] = along(0);
    const [hx, hy] = along(1);
    const length = Math.hypot(hx - nx, hy - ny);
    const [ax, ay] = [(-(hy - ny) / length) * r, ((hx - nx) / length) * r];
    const across = (share: number, scale: number) => {
        const [px, py] = along(share);
        return `M ${svgNumber(px - ax * scale)} ${svgNumber(py - ay * scale)} L ${svgNumber(px + ax * scale)} ${svgNumber(py + ay * scale)}`;
    };
    const sleeve = `M ${along(0.08).map(svgNumber).join(" ")} L ${along(0.78).map(svgNumber).join(" ")}`;
    const [rx, ry] = along(0.93);
    const fine = 0.15 * r;
    return (
        <g fill="none">
            <path d={d} stroke={COLORS.outline} strokeWidth={2 * r + 2 * line} />
            <path d={d} stroke={COLORS.shade} strokeWidth={2 * r} />
            <path d={d} stroke={COLORS.body} strokeWidth={1.5 * r} />
            <path d={d} stroke={COLORS.shade} strokeWidth={0.35 * r} strokeOpacity={0.7} />
            <path
                d={d}
                stroke={COLORS.highlight}
                strokeOpacity={0.8}
                strokeWidth={line}
                transform={`translate(${svgNumber(-0.25 * r)} ${svgNumber(-0.45 * r)})`}
            />
            <path d={across(0.02, 1)} stroke={COLORS.outline} strokeWidth={fine} />
            <circle
                cx={rx}
                cy={ry}
                r={0.4 * r}
                fill={COLORS.highlight}
                stroke={COLORS.outline}
                strokeWidth={fine}
            />
            <path
                d={sleeve}
                stroke={COLORS.outline}
                strokeWidth={2.4 * r + 2 * line}
                strokeLinecap="round"
            />
            <path d={sleeve} stroke={COLORS.body} strokeWidth={2.4 * r} strokeLinecap="round" />
            {[0.3, 0.38, 0.46, 0.54].map((share) => (
                <path key={share} d={across(share, 1.2)} stroke={COLORS.shade} strokeWidth={fine} />
            ))}
        </g>
    );
}

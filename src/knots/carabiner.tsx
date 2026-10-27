/**
 * A carabiner for a knot to be tied round, seen face on: a pear-shaped (HMS) carabiner with a screw-lock gate, drawn
 * from a photo of a real one turned upside down, with its wide end at the bottom where the rope sits. It's built from
 * filled parts, each outlined and shaded on its own:
 *
 * - the body: one rod from the gate's hinge, round the small, round narrow end at the top, down the spine on the left
 *   (straight, then curving out into the wide end), round the wide end and up into the keylock nose at the bottom
 *   right. A channel runs along its face, with a label plate in it on the spine, and the nose has a pocket cut in its
 *   inner side, where the gate's end sits;
 * - the gate: a bar from a rivet under the narrow end down to the nose, which swings inwards about the rivet to open;
 * - the locking sleeve over most of the gate, knurled between its two ends, leaving the bar showing below it;
 * - the rivet, seen through a window in the sleeve's top end.
 *
 * The rope wraps the wide end, passing in front of it or behind it anywhere round it, so the carabiner is drawn over the
 * rope and under the stretches marked over.
 *
 * Coordinates are millimetres, y down. The shape is given in shares of the width and height, from the bottom end's
 * centre, and the parts' thicknesses in the rod's radius.
 */

import type { ReactNode } from "react";

import { Cubic, type Box } from "@/lib/bezier";
import { rad } from "@/lib/math";
import { polylinePath, svgNumber } from "@/lib/svg-path";
import { Vector2 } from "@/lib/vector2";

/**
 * Where its bottom end's centre is, its rod's radius, how wide and tall it is (to the rod's middle line), and whether
 * its gate is open (closed if left out).
 */
export type Carabiner = {
    x: number;
    y: number;
    r: number;
    width: number;
    height: number;
    open?: boolean;
};

const COLORS = {
    body: "var(--knot-carabiner)",
    bodyShade: "var(--knot-carabiner-shade)",
    bodyHighlight: "var(--knot-carabiner-highlight)",
    gate: "var(--knot-bar)",
    gateShade: "var(--knot-bar-shade)",
    gateHighlight: "var(--knot-bar-highlight)",
    sleeve: "var(--knot-sleeve)",
    sleeveShade: "var(--knot-sleeve-shade)",
    sleeveHighlight: "var(--knot-sleeve-highlight)",
    outline: "var(--knot-outline)",
};

/** A point as shares of the width and height, from the bottom end's centre. */
type Share = readonly [number, number];

/** The gate's line: through its hinge rivet, under the narrow end, and its end, at the bottom of the nose's pocket. */
const HINGE: Share = [0.38, -0.755];
const END: Share = [0.449, -0.29];
const AXIS: Share = [END[0] - HINGE[0], END[1] - HINGE[1]];

/** The point `k` gate lengths along the gate's line from `p`. */
const along = (p: Share, k: number): Share => [p[0] + AXIS[0] * k, p[1] + AXIS[1] * k];

/** The point on the gate's line at height `v`, moved `shift` across. */
const onGate = (v: number, shift = 0): Share => {
    const [u] = along(HINGE, (v - HINGE[1]) / AXIS[1]);
    return [u + shift, v];
};

/**
 * The nose runs parallel to the gate, a little outside it, so the gate's end sits in a pocket on its inner side with a
 * wall of the nose outside it: from where the wide end turns up into it, to its top.
 */
const NOSE_SHIFT = 0.04;
const NOSE_BASE = onGate(-0.25, NOSE_SHIFT);
const NOSE_TOP = onGate(-0.39, NOSE_SHIFT);

/** Where the spine runs straight, from under the narrow end to where it curves out into the wide end. */
const SPINE: [Share, Share] = [
    [-0.27, -0.79],
    [-0.44, -0.39],
];
const SPINE_DIR: Share = [SPINE[1][0] - SPINE[0][0], SPINE[1][1] - SPINE[0][1]];

/**
 * The body's middle line as curves (shares of the width and height, from the bottom end's centre): up from the hinge
 * round the narrow end, down the spine, round the wide end's left side and bottom, and up the nose. Each curve leaves
 * its end the way the next arrives, so it has no corners. Traced from the photo's rod, halfway between its edges.
 */
const CURVES: Share[][] = [
    [HINGE, along(HINGE, -0.35), [0.2, -0.997], [0.04, -0.997]],
    [
        [0.04, -0.997],
        [-0.1, -0.997],
        [SPINE[0][0] - 0.4 * SPINE_DIR[0], SPINE[0][1] - 0.4 * SPINE_DIR[1]],
        SPINE[0],
    ],
    SPINE,
    [
        SPINE[1],
        [SPINE[1][0] + 0.15 * SPINE_DIR[0], SPINE[1][1] + 0.15 * SPINE_DIR[1]],
        [-0.493, -0.29],
        [-0.493, -0.22],
    ],
    [
        [-0.493, -0.22],
        [-0.493, -0.1],
        [-0.3, 0],
        [-0.13, 0],
    ],
    [[-0.13, 0], [0.15, 0], along(NOSE_BASE, 0.32), NOSE_BASE],
    [NOSE_BASE, NOSE_TOP],
];

/** Which of the curves are the wide end, where the rope can pass in front of the carabiner or behind it. */
const WIDE_END = [3, 4, 5];

/** The spine's curve, where the label plate is. */
const SPINE_CURVE = 2;

/** How far round the body the channel runs: from just past the hinge to just short of the nose (curve and t). */
const CHANNEL: [number, number] = [0.25, 5.8];

/** How far the gate swings in when it's open (degrees). */
const OPEN_ANGLE = 33;

/** Samples along each curve, for the body's shapes. */
const SAMPLES = 24;

/** Where the light comes from (up and to the left), for the highlights and shading along each part. */
const LIGHT = new Vector2(-0.6, -0.8);

/** A point in millimetres. */
function at({ x, y, width, height }: Carabiner, [u, v]: Share): Vector2 {
    return new Vector2(x + u * width, y + v * height);
}

/** The curves in millimetres. */
function curves(c: Carabiner): Cubic[] {
    return CURVES.map((points) => {
        const [p0, p1, p2, p3] = points.map((p) => at(c, p));
        return points.length === 2 ? Cubic.line(p0, p1) : new Cubic(p0, p1, p2, p3);
    });
}

/** The wide end's middle line, from the spine round the bottom to the nose, as points close together. */
export function wideEnd(c: Carabiner): Vector2[] {
    const all = curves(c);
    return WIDE_END.flatMap((k, j) => all[k].points(SAMPLES).slice(j > 0 ? 1 : 0));
}

/**
 * A point along the body's middle line: where it is, the unit normal there (a quarter turn anticlockwise from the way
 * it runs), and how far round the body it is (the curve's index plus t along it).
 */
type Station = { point: Vector2; normal: Vector2; place: number };

/** Points along the body's middle line, from the hinge to the nose's top. */
function stations(c: Carabiner): Station[] {
    return curves(c).flatMap((cubic, k) =>
        cubic
            .points(SAMPLES)
            .map((point, i) => ({
                point,
                normal: cubic.tangentAt(i / SAMPLES).perp(),
                place: k + i / SAMPLES,
            }))
            .slice(k > 0 ? 1 : 0),
    );
}

/**
 * A strip along the body, between two offsets from its middle line (in rod radii, along the normal), which can vary
 * with how the normal faces the light: a polygon down one side and back up the other, cut square at its ends.
 */
function strip(
    along: Station[],
    r: number,
    from: (lit: number) => number,
    to: (lit: number) => number,
): Vector2[] {
    const side = (offset: (lit: number) => number) =>
        along.map(({ point, normal }) => point.add(normal.scale(offset(normal.dot(LIGHT)) * r)));
    return [...side(to), ...side(from).reverse()];
}

/**
 * The gate's frame: its hinge (millimetres), the way it runs from there to its end and the way across it outwards
 * (unit vectors, turned in if it's open), its length, and the angle it's turned to from straight down (degrees, as
 * SVG's `rotate` takes it).
 */
function gateFrame(c: Carabiner) {
    const hinge = at(c, HINGE);
    const closed = at(c, END).sub(hinge);
    const angle = Math.atan2(-closed.x, closed.y) * (180 / Math.PI) + (c.open ? OPEN_ANGLE : 0);
    const down = new Vector2(-Math.sin(rad(angle)), Math.cos(rad(angle)));
    return { hinge, down, out: down.perp().neg(), length: closed.len(), angle };
}

/**
 * The gate's parts, in its own frame (millimetres: x across it, outwards, and y along it from the hinge): the bar, and
 * the sleeve's two ends and its knurled grip between them. Each is a rectangle: across from `-half` to `half`, and along
 * from `top` to `bottom`.
 */
function gateParts({ r }: Carabiner, length: number) {
    const top = -1.1 * r;
    const bottom = 0.72 * length;
    return {
        bar: { half: 0.8 * r, top: -0.8 * r, bottom: length },
        upper: { half: 1.2 * r, top, bottom: top + 2 * r },
        lower: { half: 1.2 * r, top: bottom - 1.5 * r, bottom },
        grip: { half: 1.35 * r, top: top + 1.9 * r, bottom: bottom - 1.4 * r },
    };
}

type Part = { half: number; top: number; bottom: number };

/**
 * The nose's pocket in the gate's closed frame (millimetres across and along): from the nose's inner edge out to just
 * past the bar's outer side, leaving the nose's outer wall, and from the nose's top down to the gate's end.
 */
function pocket(c: Carabiner): { inner: number; outer: number; top: number; bottom: number } {
    const hinge = at(c, HINGE);
    const down = at(c, END).sub(hinge).unit();
    const out = down.perp().neg();
    const nose = at(c, NOSE_TOP).sub(hinge);
    const middle = nose.dot(out);
    return {
        inner: middle - c.r,
        outer: 0.9 * c.r,
        top: nose.dot(down),
        bottom: at(c, END).sub(hinge).dot(down),
    };
}

/** The body's outline and the gate's (without its rounded corners), as path data: where the editor picks it up. */
export function carabinerOutline(c: Carabiner): string {
    const body = strip(
        stations(c),
        c.r,
        () => -1,
        () => 1,
    );
    const { hinge, down, out, length } = gateFrame(c);
    const corners = ({ half, top, bottom }: Part) =>
        [
            [-half, top],
            [half, top],
            [half, bottom],
            [-half, bottom],
        ].map(([a, b]) => hinge.add(out.scale(a)).add(down.scale(b)));
    const { bar, upper, lower, grip } = gateParts(c, length);
    return [body, ...[bar, upper, lower, grip].map(corners)]
        .map((p) => polylinePath(p, true))
        .join(" ");
}

/** The box it's drawn in: round the body and the sleeve, open or closed. */
export function carabinerBounds(c: Carabiner): Box {
    const body = strip(
        stations(c),
        c.r,
        () => -1,
        () => 1,
    );
    const { hinge, down, out, length } = gateFrame(c);
    const { grip, bar } = gateParts(c, length);
    const gate = [grip.top, grip.bottom, bar.bottom].flatMap((b) =>
        [-grip.half, grip.half].map((a) => hinge.add(out.scale(a)).add(down.scale(b))),
    );
    const all = [...body, ...gate];
    const xs = all.map((p) => p.x);
    const ys = all.map((p) => p.y);
    return {
        min: new Vector2(Math.min(...xs), Math.min(...ys)),
        max: new Vector2(Math.max(...xs), Math.max(...ys)),
    };
}

/** A shape with an outline as thick as the rope's: stroked twice as thick, under its fill, so half of it shows. */
const outlined = (line: number) => ({
    stroke: COLORS.outline,
    strokeWidth: 2 * line,
    strokeLinejoin: "round" as const,
    paintOrder: "stroke",
});

/**
 * The body: the rod, its shade along the side away from the light and a highlight along the side towards it; the
 * channel along its face (the I-beam's, its rims catching the light) and the label plate in it on the spine, bare
 * metal; and the nose's pocket.
 */
function Body(props: { carabiner: Carabiner; line: number }) {
    const { carabiner: c, line } = props;
    const { r } = c;
    const all = stations(c);
    const between = (from: number, to: number) =>
        all.filter((s) => s.place >= from && s.place <= to);
    const path = (points: Vector2[]) => polylinePath(points, true);
    const channel = between(...CHANNEL);
    const plate = between(SPINE_CURVE + 0.08, SPINE_CURVE + 0.92);
    const fine = 0.15 * r;
    const hole = pocket(c);
    const hinge = at(c, HINGE);
    const down = at(c, END).sub(hinge).unit();
    const out = down.perp().neg();
    const inPocket = (a: number, b: number) => hinge.add(out.scale(a)).add(down.scale(b));
    // The pocket's floor and its outer wall, cut a little into the body's outline at the nose's top and inner side.
    const pocketShape = [
        inPocket(hole.inner + 0.05 * r, hole.top + 0.05 * r),
        inPocket(hole.outer, hole.top + 0.05 * r),
        inPocket(hole.outer, hole.bottom),
        inPocket(hole.inner + 0.05 * r, hole.bottom),
    ];
    const pocketEdges = [
        inPocket(hole.outer, hole.top + 0.2 * r),
        inPocket(hole.outer, hole.bottom),
        inPocket(hole.inner + 0.2 * r, hole.bottom),
    ];
    return (
        <g>
            <path
                d={path(
                    strip(
                        all,
                        r,
                        () => -1,
                        () => 1,
                    ),
                )}
                fill={COLORS.bodyShade}
                {...outlined(line)}
            />
            <path
                d={path(
                    strip(
                        all,
                        r,
                        (lit) => -0.72 + 0.28 * lit,
                        (lit) => 0.72 + 0.28 * lit,
                    ),
                )}
                fill={COLORS.body}
            />
            <path
                d={path(
                    strip(
                        channel,
                        r,
                        () => -0.42,
                        () => 0.42,
                    ),
                )}
                fill={COLORS.bodyShade}
                fillOpacity={0.55}
            />
            <path
                d={path(
                    strip(
                        between(0.1, 6),
                        r,
                        (lit) => 0.55 * lit - 0.11,
                        (lit) => 0.55 * lit + 0.11,
                    ),
                )}
                fill={COLORS.bodyHighlight}
                fillOpacity={0.7}
            />
            <path
                d={path(
                    strip(
                        plate,
                        r,
                        () => -0.34,
                        () => 0.34,
                    ),
                )}
                fill={COLORS.gate}
                stroke={COLORS.bodyShade}
                strokeWidth={fine}
                strokeLinejoin="round"
            />
            <path d={polylinePath(pocketShape, true)} fill={COLORS.bodyShade} />
            <path
                d={polylinePath(pocketEdges)}
                fill="none"
                stroke={COLORS.outline}
                strokeWidth={fine}
                strokeLinejoin="round"
            />
        </g>
    );
}

/** A rounded rectangle for a part of the gate, in its frame. */
const box = ({ half, top, bottom }: Part, corner: number) => ({
    x: -half,
    y: top,
    width: 2 * half,
    height: bottom - top,
    rx: corner,
});

/**
 * One round part of the gate, as a tube seen side on: outlined and dark along its outer side, lighter over most of it,
 * and with a highlight along its inner side, towards the light.
 */
function Tube(props: {
    part: Part;
    colors: { body: string; shade: string; highlight: string };
    line: number;
    corner: number;
    children?: ReactNode;
}) {
    const { part, colors, line, corner, children } = props;
    const { half, top, bottom } = part;
    return (
        <g>
            <rect {...box(part, corner)} fill={colors.shade} {...outlined(line)} />
            <rect
                {...box({ half: 0.8 * half, top, bottom }, corner)}
                x={-0.85 * half}
                fill={colors.body}
            />
            {children}
            <rect
                x={-0.6 * half}
                y={top + 0.25 * half}
                width={0.22 * half}
                height={Math.max(bottom - top - 0.5 * half, 0)}
                rx={0.11 * half}
                fill={colors.highlight}
                fillOpacity={0.75}
            />
        </g>
    );
}

/** Crossed lines over a rectangle, inset from its edges: the knurling on the sleeve's grip. */
function knurling({ half, top, bottom }: Part, spacing: number, inset: number): string {
    const [x0, x1, y0, y1] = [-half + inset, half - inset, top + inset, bottom - inset];
    const lines: string[] = [];
    for (const slope of [1, -1]) {
        // Each line is y = slope · x + c, for c spaced evenly, clipped to the rectangle.
        for (let c = y0 - (x1 - x0); c <= y1 + (x1 - x0); c += spacing) {
            const [a, b] = [(y0 - c) / slope, (y1 - c) / slope];
            const [from, to] = [Math.max(x0, Math.min(a, b)), Math.min(x1, Math.max(a, b))];
            if (to - from < 1e-6) continue;
            const y = (x: number) => slope * x + c;
            lines.push(
                `M ${svgNumber(from)} ${svgNumber(y(from))} L ${svgNumber(to)} ${svgNumber(y(to))}`,
            );
        }
    }
    return lines.join(" ");
}

/** The gate: its bar, the locking sleeve over it and the rivet it turns on, drawn in its own frame. */
function Gate(props: { carabiner: Carabiner; line: number }) {
    const { carabiner: c, line } = props;
    const { r } = c;
    const { hinge, length, angle } = gateFrame(c);
    const { bar, upper, lower, grip } = gateParts(c, length);
    const fine = 0.15 * r;
    const metal = { body: COLORS.gate, shade: COLORS.gateShade, highlight: COLORS.gateHighlight };
    const sleeve = {
        body: COLORS.sleeve,
        shade: COLORS.sleeveShade,
        highlight: COLORS.sleeveHighlight,
    };
    return (
        <g
            transform={`translate(${svgNumber(hinge.x)} ${svgNumber(hinge.y)}) rotate(${svgNumber(angle)})`}
        >
            <Tube part={bar} colors={metal} line={line} corner={0.3 * r} />
            <Tube part={upper} colors={sleeve} line={line} corner={0.35 * r} />
            <Tube part={lower} colors={sleeve} line={line} corner={0.35 * r} />
            <Tube part={grip} colors={sleeve} line={line} corner={0.2 * r}>
                <path
                    d={knurling(grip, 0.42 * r, 0.25 * r)}
                    stroke={COLORS.sleeveShade}
                    strokeWidth={0.08 * r}
                    strokeOpacity={0.8}
                    fill="none"
                />
            </Tube>
            <rect
                x={-0.55 * r}
                y={-0.6 * r}
                width={1.1 * r}
                height={1.2 * r}
                rx={0.3 * r}
                fill={COLORS.sleeveShade}
                stroke={COLORS.outline}
                strokeWidth={fine}
            />
            <circle r={0.4 * r} fill={COLORS.gate} stroke={COLORS.outline} strokeWidth={fine} />
            <circle cx={-0.12 * r} cy={-0.12 * r} r={0.14 * r} fill={COLORS.gateHighlight} />
        </g>
    );
}

/**
 * The carabiner: its body, then its gate over it, closed in the nose's pocket or swung in about its rivet. Its outlines
 * are sized for a rope `unit` across, as the rope's are; its finer lines for its own rod.
 */
export function CarabinerDrawing(props: { carabiner: Carabiner; unit: number }) {
    const { carabiner, unit } = props;
    const line = 0.25 * unit;
    return (
        <g>
            <Body carabiner={carabiner} line={line} />
            <Gate carabiner={carabiner} line={line} />
        </g>
    );
}

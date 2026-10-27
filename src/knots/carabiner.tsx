/**
 * A carabiner for a knot to be tied round, seen face on: a pear-shaped (HMS) carabiner with a screw-lock gate, drawn
 * from photos of a real one (a Beal HMS screwgate) turned upside down, with its wide end at the bottom where the rope
 * sits. It's built from filled parts, each outlined and shaded on its own:
 *
 * - the body: one round rod from the gate's hinge, round the small, round narrow end at the top, down the spine on the
 *   left (straight, then curving out into the wide end) and round the wide end, ending in the keylock nose at the
 *   bottom right. A channel runs along its face, with a label plate on the spine. The nose is a flat hook: a block
 *   narrower than the rod with a slot cut in its inner side under a jaw, which the gate's end closes over;
 * - the gate: a bar from a rivet under the narrow end down over the nose, which swings inwards about the rivet to open;
 * - the locking sleeve over most of the gate: a knurled grip between two smooth ends. Its top end has a window the
 *   rivet shows through, and its bottom end a rounded slot the bar shows through, with the tab on its inner side longer
 *   than the outer one, leaving the bar's end bare below it;
 * - the rivet.
 *
 * The rope wraps the wide end, passing in front of it or behind it anywhere round it, so the carabiner is drawn over the
 * rope and under the stretches marked over.
 *
 * Coordinates are millimetres, y down. Its width and height are its outside size, to the rod's outer edges, as a real
 * carabiner's are given. The rod's middle line is given in shares of the box it runs in (the outside box, in by the
 * rod's radius all round), from that box's bottom centre; the gate's parts along it in shares of its length; and the
 * parts' thicknesses in the rod's radius.
 */

import { useId } from "react";

import { Cubic, type Box } from "@/lib/bezier";
import { rad } from "@/lib/math";
import { polylinePath, svgNumber } from "@/lib/svg-path";
import { Vector2 } from "@/lib/vector2";

/**
 * Where its bottom end's centre is (on its outside edge), its rod's radius, how wide and tall it is outside (to the
 * rod's outer edges), and whether its gate is open (closed if left out).
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
    plate: "var(--knot-carabiner-plate)",
    gate: "var(--knot-bar)",
    gateShade: "var(--knot-bar-shade)",
    gateHighlight: "var(--knot-bar-highlight)",
    sleeve: "var(--knot-sleeve)",
    sleeveShade: "var(--knot-sleeve-shade)",
    sleeveHighlight: "var(--knot-sleeve-highlight)",
    outline: "var(--knot-outline)",
};

/** A point as shares of the width and height of the box the rod's middle line runs in, from its bottom centre. */
type Share = readonly [number, number];

/** The gate's line: through its hinge rivet, under the narrow end, and its end, closed over the nose. */
const HINGE: Share = [0.369, -0.758];
const END: Share = [0.471, -0.249];

/**
 * The body's middle line as curves: up from the hinge round the narrow end, down the spine, round the wide end's left
 * side and bottom, and up to the nose's foot. Each curve leaves its end the way the next arrives, so it has no corners.
 * Traced from the photo's rod, halfway between its edges: the narrow end is nearly a half circle, the spine a straight
 * line, and the wide end a quarter circle at its left and a tighter bend at its right, into the nose.
 */
const CURVES: Share[][] = [
    [HINGE, [0.34, -0.9], [0.233, -1.001], [0.051, -1.001]],
    [
        [0.051, -1.001],
        [-0.084, -1.001],
        [-0.202, -0.947],
        [-0.235, -0.87],
    ],
    [
        [-0.235, -0.87],
        [-0.45, -0.365],
    ],
    [
        [-0.45, -0.365],
        [-0.469, -0.322],
        [-0.502, -0.254],
        [-0.502, -0.209],
    ],
    [
        [-0.502, -0.209],
        [-0.502, -0.093],
        [-0.316, 0],
        [-0.119, 0],
    ],
    [
        [-0.119, 0],
        [0.115, 0],
        [0.502, -0.142],
        [0.501, -0.226],
    ],
];

/** Which of the curves are the wide end, where the rope can pass in front of the carabiner or behind it. */
const WIDE_END = [3, 4, 5];

/** The spine's curve, where the label plate is. */
const SPINE_CURVE = 2;

/** How far round the body the channel runs: from just past the hinge to just short of the nose (curve and t). */
const CHANNEL: [number, number] = [0.25, 5.75];

/**
 * The nose, in the closed gate's frame (across it in rod radii, outwards; along it in shares of its length from the
 * hinge): its block, rising from the rod's end and narrowing, with a rounded top; and the slot cut into its inner side
 * under the top jaw, open to the inside and as deep as about half the block.
 */
const NOSE = {
    top: 0.767,
    inner: -0.42,
    outer: 1.17,
    waist: 0.99,
    slot: { from: 0.858, to: 0.984, depth: 0.48 },
};

/** How far the gate swings in when it's open (degrees): measured off the photo of it open. */
const OPEN_ANGLE = 46;

/** Samples along each curve, for the body's shapes. */
const SAMPLES = 24;

/** Where the light comes from (up and to the left), for the highlights and shading along each part. */
const LIGHT = new Vector2(-0.6, -0.8);

/** The rod's middle line's box: its bottom centre, width and height (millimetres). */
function middleBox({ x, y, r, width, height }: Carabiner) {
    return { x, y: y - r, width: Math.max(width - 2 * r, 0), height: Math.max(height - 2 * r, 0) };
}

/** A point in millimetres. */
function at(c: Carabiner, [u, v]: Share): Vector2 {
    const box = middleBox(c);
    return new Vector2(box.x + u * box.width, box.y + v * box.height);
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

/** Points along the body's middle line, from the hinge to the nose's foot. */
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

/** The whole rod, from edge to edge. */
const rod = (c: Carabiner) =>
    strip(
        stations(c),
        c.r,
        () => -1,
        () => 1,
    );

/** The rod's end at the hinge, rounded round the rivet: a circle as wide as the rod. */
const hingeEnd = (c: Carabiner) =>
    Array.from({ length: 32 }, (_, k) =>
        at(c, HINGE).add(Vector2.fromAngle((k * Math.PI) / 16, c.r)),
    );

/**
 * A polygon with its corners rounded: each corner is a point and the radius of the arc it's rounded with (none for a
 * sharp one), the arc sampled finely enough to draw it smooth.
 */
function rounded(corners: readonly (readonly [Vector2, number])[]): Vector2[] {
    const n = corners.length;
    return corners.flatMap(([p, radius], i) => {
        if (radius <= 0) return [p];
        const toPrev = corners[(i + n - 1) % n][0].sub(p);
        const toNext = corners[(i + 1) % n][0].sub(p);
        const [a, b] = [toPrev.unit(), toNext.unit()];
        const half = Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) / 2;
        if (half < 1e-6 || half > Math.PI / 2 - 1e-6) return [p];
        // The arc can take at most half of either edge.
        const reach = Math.min(radius / Math.tan(half), toPrev.len() / 2, toNext.len() / 2);
        const fit = reach * Math.tan(half);
        const centre = p.add(
            a
                .add(b)
                .unit()
                .scale(fit / Math.sin(half)),
        );
        const [start, end] = [p.add(a.scale(reach)), p.add(b.scale(reach))];
        const [from, to] = [start.sub(centre).angle(), end.sub(centre).angle()];
        let sweep = to - from;
        if (sweep > Math.PI) sweep -= 2 * Math.PI;
        if (sweep < -Math.PI) sweep += 2 * Math.PI;
        const steps = 8;
        return Array.from({ length: steps + 1 }, (_, k) =>
            centre.add(Vector2.fromAngle(from + (sweep * k) / steps, fit)),
        );
    });
}

/**
 * The gate's frame: its hinge (millimetres), the way it runs from there to its end and the way across it outwards
 * (unit vectors, turned in if it's open), its length, and the angle it's turned to from straight down (degrees, as
 * SVG's `rotate` takes it).
 */
function gateFrame(c: Carabiner, open = c.open) {
    const hinge = at(c, HINGE);
    const closed = at(c, END).sub(hinge);
    const angle = Math.atan2(-closed.x, closed.y) * (180 / Math.PI) + (open ? OPEN_ANGLE : 0);
    const down = new Vector2(-Math.sin(rad(angle)), Math.cos(rad(angle)));
    return { hinge, down, out: down.perp().neg(), length: closed.len(), angle };
}

/** A point in a gate's frame (across and along, millimetres) in millimetres. */
const inFrame =
    ({ hinge, down, out }: { hinge: Vector2; down: Vector2; out: Vector2 }) =>
    (p: Vector2) =>
        hinge.add(out.scale(p.x)).add(down.scale(p.y));

/**
 * The gate's parts, in its own frame (millimetres: x across it, outwards, and y along it from the hinge), as rounded
 * polygons: the bar; the sleeve's top end, with its window and a step down at its outer side; its knurled grip; and its
 * bottom end, with its slot and two tabs, the inner one longer. The sleeve's ends are given with their window and slot
 * and without, as shells (for its outline round the whole). Sizes measured off the photo.
 */
function gateParts({ r }: Carabiner, length: number) {
    const p = (x: number, y: number, radius = 0) => [new Vector2(x * r, y), radius * r] as const;
    const L = length;
    const grip = { half: 1.4, top: 1.15 * r, bottom: 0.59 * L };
    const upper = { half: 1.33, top: -0.68 * r, raised: -0.9 * r, step: -0.34 * r };
    const window = { inner: -0.66, outer: 0.3, bottom: 1.05 * r };
    const lower = { half: 1.3, top: grip.bottom - 0.2 * r };
    const slot = { half: 0.59, top: 0.63 * L };
    const tabs = { inner: 0.823 * L, outer: 0.784 * L };
    const round = (window.outer - window.inner) / 2;
    const upperShell = (cut: (readonly [Vector2, number])[]) =>
        rounded([
            p(-upper.half, grip.top + 0.2 * r),
            p(-upper.half, upper.top, 0.25),
            ...cut,
            p(window.outer, upper.raised, 0.12),
            p(1.1, upper.raised, 0.12),
            p(1.1, upper.step, 0.05),
            p(upper.half, upper.step, 0.15),
            p(upper.half, grip.top + 0.2 * r),
        ]);
    const lowerShell = (cut: (readonly [Vector2, number])[]) =>
        rounded([
            p(-lower.half, lower.top),
            p(lower.half, lower.top),
            p(lower.half, tabs.outer, 0.25),
            ...cut,
            p(-lower.half, tabs.inner, 0.3),
        ]);
    return {
        bar: rounded([
            p(-0.95, -0.85 * r, 0.4),
            p(0.95, -0.85 * r, 0.4),
            p(0.95, L, 0.4),
            p(-0.95, L, 0.4),
        ]),
        upper: upperShell([
            p(window.inner, upper.top, 0.08),
            p(window.inner, window.bottom, round),
            p(window.outer, window.bottom, round),
        ]),
        upperShell: upperShell([p(window.outer, upper.top)]),
        grip: rounded([
            p(-grip.half, grip.top, 0.15),
            p(grip.half, grip.top, 0.15),
            p(grip.half, grip.bottom, 0.15),
            p(-grip.half, grip.bottom, 0.15),
        ]),
        lower: lowerShell([
            p(slot.half, tabs.outer, 0.12),
            p(slot.half, slot.top, slot.half),
            p(-slot.half, slot.top, slot.half),
            p(-slot.half, tabs.inner, 0.12),
        ]),
        lowerShell: lowerShell([p(0, tabs.outer), p(0, tabs.inner)]),
        knurl: { half: grip.half * r, top: grip.top, bottom: grip.bottom },
        tab: tabs.outer,
    };
}

/** The nose's block and its slot, in millimetres: the block rising from the rod's end, and the slot within it. */
function noseShapes(c: Carabiner) {
    const { r } = c;
    const frame = gateFrame(c, false);
    const to = inFrame(frame);
    const L = frame.length;
    const p = (x: number, y: number, radius = 0) =>
        [to(new Vector2(x * r, y * L)), radius * r] as const;
    // The rod's end, where the block rises from: its corners, inner and outer.
    const last = stations(c).at(-1)!;
    const corner = (side: number) => last.point.add(last.normal.scale(side * r));
    const [a, b] = [corner(1), corner(-1)];
    const outward = (q: Vector2) => q.sub(frame.hinge).dot(frame.out);
    const [rodInner, rodOuter] = outward(a) < outward(b) ? [a, b] : [b, a];
    const block = rounded([
        [rodInner, 0],
        p(NOSE.inner, NOSE.waist, 0.45),
        p(NOSE.inner, NOSE.top, 0.3),
        p(NOSE.outer, NOSE.top, 0.35),
        p(NOSE.outer, NOSE.waist, 0.6),
        [rodOuter, 0],
    ]);
    const { from, to: bottom, depth } = NOSE.slot;
    const slot = rounded([
        p(NOSE.inner - 0.05, from),
        p(depth, from, 0.15),
        p(depth, bottom, 0.15),
        p(NOSE.inner - 0.05, bottom),
    ]);
    // The slot's back, in shadow under its roof and along its far end; and the lit lip of the jaw under it.
    const roof = [p(NOSE.inner, from)[0], p(depth, from)[0], p(depth, bottom)[0]];
    const lip = [p(NOSE.inner + 0.1, bottom)[0], p(depth - 0.1, bottom)[0]];
    return { block, slot, roof, lip };
}

/** The gate's parts' polygons in millimetres, open or closed. */
function gatePolygons(c: Carabiner): Vector2[][] {
    const frame = gateFrame(c);
    const { bar, upperShell, grip, lowerShell } = gateParts(c, frame.length);
    return [bar, upperShell, grip, lowerShell].map((polygon) => polygon.map(inFrame(frame)));
}

/** The body's outline and the gate's, as path data: where the editor picks it up. */
export function carabinerOutline(c: Carabiner): string {
    return [rod(c), hingeEnd(c), noseShapes(c).block, ...gatePolygons(c)]
        .map((p) => polylinePath(p, true))
        .join(" ");
}

/** The box it's drawn in: round the body and the gate, open or closed. */
export function carabinerBounds(c: Carabiner): Box {
    const all = [rod(c), hingeEnd(c), noseShapes(c).block, ...gatePolygons(c)].flat();
    const xs = all.map((p) => p.x);
    const ys = all.map((p) => p.y);
    return {
        min: new Vector2(Math.min(...xs), Math.min(...ys)),
        max: new Vector2(Math.max(...xs), Math.max(...ys)),
    };
}

/** A shape's outline, as thick as the rope's: stroked twice as thick, under its fill, so half of it shows. */
const outlined = (line: number) => ({
    stroke: COLORS.outline,
    strokeWidth: 2 * line,
    strokeLinejoin: "round" as const,
    paintOrder: "stroke",
});

/** Ids for one drawing's gradients, clip and blurs, unique on the page. */
function useIds() {
    const base = `carabiner-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
    return {
        clip: `${base}-clip`,
        soft: `${base}-soft`,
        sharp: `${base}-sharp`,
        bar: `${base}-bar`,
        sleeve: `${base}-sleeve`,
        nose: `${base}-nose`,
    };
}

type Ids = ReturnType<typeof useIds>;

/**
 * A gradient across a round part seen side on, from its inner side (towards the light) to its outer: a little light
 * reflected at its edge, a bright highlight near it, the part's own colour, then shade.
 */
function TubeGradient(props: { id: string; body: string; shade: string; highlight: string }) {
    const { id, body, shade, highlight } = props;
    const stops: [number, string][] = [
        [0, body],
        [0.1, highlight],
        [0.24, highlight],
        [0.42, body],
        [0.7, body],
        [0.9, shade],
        [1, shade],
    ];
    return (
        <linearGradient id={id} x1={0} x2={1} y1={0} y2={0}>
            {stops.map(([offset, color]) => (
                <stop key={offset} offset={offset} style={{ stopColor: color }} />
            ))}
        </linearGradient>
    );
}

/** The drawing's shared definitions: the body's clip and blurs, and the gate's and the nose's gradients. */
function Defs(props: { carabiner: Carabiner; ids: Ids; nose: Vector2[] }) {
    const { carabiner: c, ids, nose } = props;
    return (
        <defs>
            <clipPath id={ids.clip}>
                <path d={polylinePath(rod(c), true)} />
                <path d={polylinePath(hingeEnd(c), true)} />
                <path d={polylinePath(nose, true)} />
            </clipPath>
            <filter id={ids.soft} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation={0.22 * c.r} />
            </filter>
            <filter id={ids.sharp} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation={0.07 * c.r} />
            </filter>
            <TubeGradient
                id={ids.bar}
                body={COLORS.gate}
                shade={COLORS.gateShade}
                highlight={COLORS.gateHighlight}
            />
            <TubeGradient
                id={ids.sleeve}
                body={COLORS.sleeve}
                shade={COLORS.sleeveShade}
                highlight={COLORS.sleeveHighlight}
            />
            <linearGradient id={ids.nose} x1={0} x2={1} y1={0} y2={0.3}>
                <stop offset={0} style={{ stopColor: COLORS.bodyHighlight }} />
                <stop offset={0.25} style={{ stopColor: COLORS.body }} />
                <stop offset={1} style={{ stopColor: COLORS.bodyShade }} />
            </linearGradient>
        </defs>
    );
}

/**
 * The body: its outline round the rod, its rounded end at the hinge and the nose together, so they join without a seam;
 * the rod, shaded as a round bar (dark, its own colour across most of it, a broad sheen towards the light and
 * a bright highlight in it, all blurred together); the channel along its face and the label plate on the spine, bare
 * metal; and the nose, flat, with its slot.
 */
function Body(props: { carabiner: Carabiner; line: number; ids: Ids }) {
    const { carabiner: c, line, ids } = props;
    const { r } = c;
    const all = stations(c);
    const between = (from: number, to: number) =>
        all.filter((s) => s.place >= from && s.place <= to);
    const path = (points: Vector2[]) => polylinePath(points, true);
    const band = (from: (lit: number) => number, to: (lit: number) => number, on = all) =>
        path(strip(on, r, from, to));
    const fine = 0.12 * r;
    const nose = noseShapes(c);
    // The label plate: a rounded rectangle along the spine's straight middle.
    const [spineFrom, spineTo] = [at(c, CURVES[SPINE_CURVE][0]), at(c, CURVES[SPINE_CURVE][1])];
    const along = spineTo.sub(spineFrom).unit();
    const across = along.perp();
    const plateAt = (t: number, side: number) =>
        spineFrom.lerp(spineTo, t).add(across.scale(side * 0.62 * r));
    const plate = rounded([
        [plateAt(0.06, -1), 0.55 * r],
        [plateAt(0.94, -1), 0.55 * r],
        [plateAt(0.94, 1), 0.55 * r],
        [plateAt(0.06, 1), 0.55 * r],
    ]);
    return (
        <g>
            {[rod(c), hingeEnd(c), nose.block].map((part, k) => (
                <path key={k} d={path(part)} fill={COLORS.outline} {...outlined(line)} />
            ))}
            <g clipPath={`url(#${ids.clip})`}>
                <path d={path(rod(c))} fill={COLORS.bodyShade} />
                <path d={path(hingeEnd(c))} fill={COLORS.body} />
                <g filter={`url(#${ids.soft})`}>
                    <path
                        d={band(
                            (lit) => -0.7 + 0.2 * lit,
                            (lit) => 0.8 + 0.2 * lit,
                        )}
                        fill={COLORS.body}
                    />
                    <path
                        d={band(
                            (lit) => 0.5 * lit - 0.38,
                            (lit) => 0.5 * lit + 0.38,
                        )}
                        fill={COLORS.bodyHighlight}
                        fillOpacity={0.4}
                    />
                    <path
                        d={band(
                            () => -0.25,
                            () => 0.25,
                            between(...CHANNEL),
                        )}
                        fill={COLORS.bodyShade}
                        fillOpacity={0.4}
                    />
                </g>
                <path
                    d={band(
                        (lit) => 0.55 * lit - 0.09,
                        (lit) => 0.55 * lit + 0.09,
                        between(0.1, 6),
                    )}
                    fill={COLORS.bodyHighlight}
                    fillOpacity={0.85}
                    filter={`url(#${ids.sharp})`}
                />
                <path
                    d={path(nose.block)}
                    fill={`url(#${ids.nose})`}
                    stroke={COLORS.bodyShade}
                    strokeWidth={fine}
                />
                <path d={path(nose.slot)} fill={COLORS.bodyShade} />
                <path
                    d={polylinePath(nose.roof)}
                    fill="none"
                    stroke={COLORS.outline}
                    strokeWidth={1.5 * fine}
                    strokeLinejoin="round"
                />
                <path
                    d={polylinePath(nose.lip)}
                    fill="none"
                    stroke={COLORS.bodyHighlight}
                    strokeWidth={fine}
                    strokeLinecap="round"
                    strokeOpacity={0.8}
                />
            </g>
            <path
                d={path(plate)}
                fill={COLORS.plate}
                stroke={COLORS.bodyShade}
                strokeWidth={fine}
                strokeLinejoin="round"
            />
            <path
                d={path(
                    rounded([
                        [plateAt(0.1, -0.75), 0.2 * r],
                        [plateAt(0.9, -0.75), 0.2 * r],
                        [plateAt(0.9, -0.45), 0.2 * r],
                        [plateAt(0.1, -0.45), 0.2 * r],
                    ]),
                )}
                fill={COLORS.bodyHighlight}
                fillOpacity={0.5}
                filter={`url(#${ids.sharp})`}
            />
        </g>
    );
}

/** Crossed lines over a rectangle, inset from its edges: the knurling on the sleeve's grip. */
function knurling(
    { half, top, bottom }: { half: number; top: number; bottom: number },
    spacing: number,
    inset: number,
): string {
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

/**
 * The gate: its bar, the locking sleeve over it and the rivet it turns on, drawn in its own frame, each part shaded
 * across as a round one. The outline goes round the whole gate first, so the sleeve's parts meet without a seam. Closed,
 * the nose's outer edge shows between the bar and its outline, where the bar's end is over the nose.
 */
function Gate(props: { carabiner: Carabiner; line: number; ids: Ids }) {
    const { carabiner: c, line, ids } = props;
    const { r } = c;
    const { hinge, length, angle } = gateFrame(c);
    const { bar, upper, upperShell, grip, lower, lowerShell, knurl, tab } = gateParts(c, length);
    const fine = 0.12 * r;
    const path = (points: Vector2[]) => polylinePath(points, true);
    const sleeve = `url(#${ids.sleeve})`;
    const edge = {
        stroke: COLORS.sleeveShade,
        strokeWidth: fine,
        strokeLinejoin: "round" as const,
    };
    return (
        <g
            transform={`translate(${svgNumber(hinge.x)} ${svgNumber(hinge.y)}) rotate(${svgNumber(angle)})`}
        >
            {[bar, upperShell, grip, lowerShell].map((part, k) => (
                <path key={k} d={path(part)} fill={COLORS.outline} {...outlined(line)} />
            ))}
            {!c.open && <NosePeek carabiner={c} ids={ids} from={tab + 2 * fine} />}
            <path
                d={path(bar)}
                fill={`url(#${ids.bar})`}
                stroke={COLORS.gateShade}
                strokeWidth={fine}
            />
            <path
                d={`M ${svgNumber(-0.4 * r)} ${svgNumber(length - 0.3 * r)} h ${svgNumber(0.8 * r)}`}
                stroke={COLORS.gateShade}
                strokeWidth={fine}
                strokeLinecap="round"
                strokeOpacity={0.6}
            />
            <path d={path(lower)} fill={sleeve} {...edge} />
            <path d={path(upper)} fill={sleeve} {...edge} />
            <circle r={0.3 * r} fill={COLORS.gate} stroke={COLORS.gateShade} strokeWidth={fine} />
            <circle cx={-0.1 * r} cy={-0.1 * r} r={0.11 * r} fill={COLORS.gateHighlight} />
            <path d={path(grip)} fill={sleeve} {...edge} />
            <path
                d={knurling(knurl, 0.24 * r, 0.12 * r)}
                stroke={COLORS.sleeveShade}
                strokeWidth={0.05 * r}
                strokeOpacity={0.75}
                fill="none"
            />
        </g>
    );
}

/**
 * The strip of the nose that shows beside the closed gate's bar, from where the sleeve ends to the bar's end: drawn in
 * the gate's frame over the gate's outline.
 */
function NosePeek(props: { carabiner: Carabiner; ids: Ids; from: number }) {
    const { carabiner: c, ids, from } = props;
    const { hinge, down, out, length } = gateFrame(c, false);
    // The nose's block, brought into the gate's frame.
    const block = noseShapes(c).block.map((q) => {
        const d = q.sub(hinge);
        return new Vector2(d.dot(out), d.dot(down));
    });
    const clip = `${ids.clip}-peek`;
    return (
        <g>
            <clipPath id={clip}>
                <rect x={0} y={from} width={3 * c.r} height={Math.max(length - from, 0)} />
            </clipPath>
            <path
                d={polylinePath(block, true)}
                fill={COLORS.body}
                stroke={COLORS.bodyShade}
                strokeWidth={0.12 * c.r}
                clipPath={`url(#${clip})`}
            />
        </g>
    );
}

/**
 * The carabiner: its body, then its gate over it, closed over the nose or swung in about its rivet. Its outlines are
 * sized for a rope `unit` across, as the rope's are; its finer lines for its own rod.
 */
export function CarabinerDrawing(props: { carabiner: Carabiner; unit: number }) {
    const { carabiner, unit } = props;
    const ids = useIds();
    const line = 0.125 * unit;
    return (
        <g>
            <Defs carabiner={carabiner} ids={ids} nose={noseShapes(carabiner).block} />
            <Body carabiner={carabiner} line={line} ids={ids} />
            <Gate carabiner={carabiner} line={line} ids={ids} />
        </g>
    );
}

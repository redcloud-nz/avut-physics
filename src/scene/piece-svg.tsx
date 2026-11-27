"use client";

import { clamp, deg } from "@/lib/math";
import { svgNumber, svgPoints } from "@/lib/svg-path";
import { vec2, type Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import { placeLabel, type Box, type ObstacleGrid } from "./callout-layout";
import {
    JOINT_GAP,
    MATERIAL_COLOR,
    plankLines,
    tapeLayers,
    type Face,
    type Material,
    type Piece,
    type RigLabel,
    type Rod,
} from "./pieces";

/**
 * Pieces drawn flat in SVG, for the flat views of the 3D scenes: rods as shaded cylinders, faces as shaded polygons,
 * strands as lines (tape as layered bands), with the labels written on them or called out beside them, and the
 * legend's swatches. Each is drawn through a `toSvg` projection the view gives.
 */

/** The narrowest some things are drawn (SVG units), however thin they are, so a rope never vanishes. */
const MIN_WIDTH: Partial<Record<Material, number>> = { sling: 4.5, rope: 3.5, steel: 1.6 };
const shade = (color: string, percent: number) =>
    `color-mix(in oklab, ${color} ${Math.round(percent)}%, black)`;

/** Where the light comes from: high in the north, as the sun is here. */
const LIGHT = vec3(0.3, 0.8, 0.5).unit();

/** How a face's colour is shaded: lit faces brighter, those edge on to the light darker. */
function faceShade(f: Face): number {
    const [p0, p1, , p3] = f.points;
    const n = f.normal ?? p1.sub(p0).cross(p3.sub(p0)).unit();
    return 55 + 45 * Math.abs(n.dot(LIGHT));
}

/** The middle of a piece, which the back-to-front sort goes by. */
export function centreOf(piece: Piece): Vector3 {
    if (piece.kind === "rod") return piece.a.lerp(piece.b, 0.5);
    // A strand by its middle along its length would do better, but its points' average is near enough.
    return piece.points.reduce((s, p) => s.add(p), vec3(0, 0, 0)).scale(1 / piece.points.length);
}

/**
 * How near a piece comes to the eye looking along `toward` (the larger, the nearer), for drawing back to front: its
 * middle, and for a rod, the side of it facing the eye, so a thin rod inside a thick one (an axle in its wheel) is
 * drawn before it.
 */
export function nearness(piece: Piece, toward: Vector3): number {
    const middle = centreOf(piece).dot(toward);
    if (piece.kind !== "rod") return middle;
    const along = piece.b.sub(piece.a);
    const len = along.len();
    const across = len > 0 ? Math.sqrt(Math.max(0, 1 - (along.dot(toward) / len) ** 2)) : 1;
    return middle + piece.r * across;
}

/**
 * How near the eye a piece is drawn in a flat view looking `toward` the eye, to draw back to front: by its middle, or
 * in a group by the group's middle (the nearest of its `across` too), those `ahead` facing the eye first, then `over`
 * pieces, then by `order`, then by their own middles. Pieces on the shell come before or after everything inside it,
 * by which way the side they're on faces (see `Shell`), except looking straight down (`plan`), where every side is
 * edge on and height alone sets the order.
 */
export function flatDepth(p: Piece, toward: Vector3, plan = false): number {
    const at = (q: Vector3) => q.dot(toward);
    const own = at(centreOf(p));
    const depth = p.group
        ? Math.max(...[p.group.at, ...(p.group.across ?? [])].map(at)) +
          (p.group.ahead ? Math.sign(p.group.ahead.dot(toward)) * 0.01 : 0) +
          (p.group.over ? 0.02 : 0) +
          (p.group.order ?? 0) * 1e-3 +
          own * 1e-4
        : own;
    if (!p.shell || plan) return depth;
    return depth + (p.shell.out.dot(toward) > 0 ? 1 : -1) * p.shell.layer * 100;
}

const MONO = "var(--font-geist-mono), monospace";

/** A legend's short length of tape or rope: a flat band for tape, a thinner cord for rope. */
export function StrandSwatch({ color, look }: { color: string; look: "tape" | "rope" }) {
    const [w, h] = [64, 9];
    const thick = look === "tape" ? 6 : 3.5;
    const line = { x1: thick / 2 + 1, x2: w - thick / 2 - 1, y1: h / 2, y2: h / 2 };
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="block">
            {/* A faint light edge, so a dark rope still shows on the dark card. */}
            <line
                {...line}
                stroke="var(--line)"
                strokeWidth={thick + 3}
                strokeLinecap={look === "tape" ? "butt" : "round"}
            />
            <line
                {...line}
                stroke={`color-mix(in oklab, ${color} 40%, black)`}
                strokeWidth={thick + 1.5}
                strokeLinecap={look === "tape" ? "butt" : "round"}
            />
            <line
                {...line}
                stroke={color}
                strokeWidth={thick}
                strokeLinecap={look === "tape" ? "butt" : "round"}
            />
        </svg>
    );
}

/** A legend's cylinder: a short pill in its colours (split along its length if two), its label on it. */
/** A legend's person: their pale disc with its letter. */
export function PersonSwatch({ letter, color }: { letter: string; color: string }) {
    const d = 20;
    return (
        <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} aria-hidden className="shrink-0">
            <circle cx={d / 2} cy={d / 2} r={d / 2 - 1} fill={color} />
            <text
                x={d / 2}
                y={d / 2}
                fill="var(--rig-on-rope)"
                fontSize={11}
                fontWeight={600}
                fontFamily={MONO}
                textAnchor="middle"
                dominantBaseline="central"
            >
                {letter}
            </text>
        </svg>
    );
}

export function CylinderSwatch({
    text,
    colors,
    light,
}: {
    text: string;
    colors: string[];
    light: boolean;
}) {
    const [w, h] = [64, 20];
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
            <defs>
                <clipPath id={`pill-${text}`}>
                    <rect x={1} y={1} width={w - 2} height={h - 2} rx={(h - 2) / 2} />
                </clipPath>
            </defs>
            <g clipPath={`url(#pill-${text})`}>
                {colors.map((c, i) => (
                    <rect
                        key={i}
                        x={(i * w) / colors.length}
                        y={0}
                        width={w / colors.length}
                        height={h}
                        fill={c}
                    />
                ))}
            </g>
            <rect
                x={1}
                y={1}
                width={w - 2}
                height={h - 2}
                rx={(h - 2) / 2}
                fill="none"
                stroke="var(--rig-on-rope)"
                strokeOpacity={0.5}
            />
            <text
                x={w / 2}
                y={h / 2 + 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10.5}
                fontWeight={600}
                fontFamily={MONO}
                fill={light ? "var(--ink-bright)" : "var(--rig-on-rope)"}
                {...(light && {
                    paintOrder: "stroke",
                    stroke: "var(--rig-on-rope)",
                    strokeWidth: 2.5,
                    strokeLinejoin: "round",
                })}
            >
                {text}
            </text>
        </svg>
    );
}
/** A monospaced character's width, as a fraction of the font size. */
const MONO_WIDTH = 0.6;

/**
 * A rig label. One on a cylinder is written along it, reading left to right: on it, sized to fit, where the cylinder's
 * drawn big enough to hold it legibly, and just beside it otherwise.
 */
export function RigLabelDrawing({
    label,
    toSvg,
    ppm,
}: {
    label: RigLabel;
    toSvg: (p: Vector3) => Vector2;
    ppm: number;
}) {
    const at = toSvg(label.at);
    const halo = { paintOrder: "stroke", stroke: "var(--halo)", strokeWidth: 4 } as const;
    const { on } = label;
    const ends = on && [-0.5, 0.5].map((t) => toSvg(label.at.add(on.along.scale(t * on.length))));
    const span = ends && ends[1].sub(ends[0]);
    // Seen end on, the cylinder has no direction on the page to write along, so it's written beside it, but only once
    // it's drawn big enough to pick out.
    if (on && span && span.len() < 12 && 2 * on.r * ppm < 8) return null;
    if (!on || !span || span.len() < 12)
        return (
            <text
                x={at.x + 10}
                y={at.y + 12}
                fill="var(--ink-strong)"
                fontSize={13}
                fontFamily={MONO}
                dominantBaseline="hanging"
                {...halo}
            >
                {label.text}
            </text>
        );
    const turn = Math.atan2(span.y, span.x);
    // Turned to read left to right, never upside down.
    const upright = Math.abs(turn) > Math.PI / 2 ? turn + Math.PI : turn;
    const rotate = `rotate(${svgNumber(deg(upright))} ${svgNumber(at.x)} ${svgNumber(at.y)})`;
    const thick = 2 * on.r * ppm;
    const fits = Math.min(0.7 * thick, (0.72 * span.len()) / (label.text.length * MONO_WIDTH));
    if (fits >= 8)
        return (
            <text
                x={at.x}
                y={at.y}
                transform={rotate}
                fill={label.light ? "var(--ink-bright)" : "var(--rig-on-rope)"}
                {...(label.light && {
                    paintOrder: "stroke",
                    stroke: "var(--rig-on-rope)",
                    strokeWidth: fits * 0.25,
                    strokeLinejoin: "round",
                })}
                fontSize={fits}
                fontFamily={MONO}
                fontWeight={600}
                textAnchor="middle"
                dominantBaseline="central"
            >
                {label.text}
            </text>
        );
    // Too small to read, it's still written on, tiny, so every knot's named: zoom in to read it.
    return (
        <text
            x={at.x}
            y={at.y}
            transform={rotate}
            fill={label.light ? "var(--ink-bright)" : "var(--rig-on-rope)"}
            fontSize={Math.max(fits, 2)}
            fontFamily={MONO}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="central"
        >
            {label.text}
        </text>
    );
}

/** The elevations' labels: their size (SVG units), and the gap between a label and its knot. */
const CALLOUT = { font: 11, gap: 14, line: 14 };

/**
 * The elevations' labels, written level on the background beside what they name, with a short leader to it from its
 * middle. Each goes
 * out to the side of the tower its knot is on (`middle` is where the tower's middle is drawn, so panning never moves a
 * label across), unless its knot says otherwise, and moves down past any already written there.
 */
/** A label written beside its knot, to its right or left, with its leader to the label's near end. */
const beside = (label: RigLabel, at: Vector2, x: number, y: number, right: boolean) => ({
    label,
    at,
    x,
    y,
    anchor: right ? ("start" as const) : ("end" as const),
    lead: { x: right ? x - 2 : x + 2, y },
});

export function Callouts({
    labels,
    toSvg,
    ppm,
    middle,
    avoid,
    lookingDown = false,
}: {
    labels: RigLabel[];
    toSvg: (p: Vector3) => Vector2;
    ppm: number;
    middle: number;
    /** What's drawn, for the labels to keep off too, searching round their knots for a clear place. */
    avoid?: ObstacleGrid;
    /** Looking down: a label that says which (`plan`) is written above or below its knot, centred on it. */
    lookingDown?: boolean;
}) {
    const placed: Box[] = [];
    const overlaps = (b: Box) =>
        placed.some((p) => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0);
    const items = labels
        .map((label) => ({ label, at: toSvg(label.at) }))
        .sort((a, b) => a.at.y - b.at.y)
        .map(({ label, at }) => {
            const right = label.side ? label.side === "right" : at.x >= middle;
            const width = label.text.length * MONO_WIDTH * CALLOUT.font + 4;
            // Clear of the knot's side as it's drawn, however close the view.
            const gap = CALLOUT.gap + (label.on ? label.on.r * ppm : 0);
            if (lookingDown && label.plan) {
                // Straight above or below its knot, moving further out past any already written there.
                const out = label.plan === "above" ? -1 : 1;
                const half = CALLOUT.font / 2 + 1;
                const box = (y: number): Box => ({
                    x0: at.x - width / 2,
                    x1: at.x + width / 2,
                    y0: y - half,
                    y1: y + half,
                });
                let y = at.y + out * (gap + CALLOUT.font / 2);
                for (let tries = 0; tries < 40 && overlaps(box(y)); tries++)
                    y += (out * CALLOUT.line) / 2;
                placed.push(box(y));
                return {
                    label,
                    at,
                    x: at.x,
                    y,
                    anchor: "middle" as const,
                    lead: { x: at.x, y: y - out * half },
                };
            }
            const x = right ? at.x + gap : at.x - gap;
            const box = (y: number): Box => ({
                x0: right ? x - 2 : x - width,
                x1: right ? x + width : x + 2,
                y0: y - CALLOUT.font / 2 - 1,
                y1: y + CALLOUT.font / 2 + 1,
            });
            if (avoid) {
                const spot = placeLabel(at, width, CALLOUT.font, right, gap, placed, avoid);
                placed.push(spot.box);
                return beside(label, at, spot.x, spot.y, spot.right);
            }
            let y = at.y;
            for (let tries = 0; tries < 40 && overlaps(box(y)); tries++) y += CALLOUT.line / 2;
            placed.push(box(y));
            return beside(label, at, x, y, right);
        });
    return (
        <g>
            {items.map(({ at, lead }, i) => (
                <line
                    key={`l${i}`}
                    x1={at.x}
                    y1={at.y}
                    x2={lead.x}
                    y2={lead.y}
                    stroke="var(--ink-muted)"
                    strokeWidth={1}
                />
            ))}
            {items.map(({ label, x, y, anchor }, i) => (
                <text
                    key={`t${i}`}
                    x={x}
                    y={y}
                    fill="var(--ink-strong)"
                    fontSize={CALLOUT.font}
                    fontFamily={MONO}
                    fontWeight={600}
                    textAnchor={anchor}
                    dominantBaseline="central"
                    paintOrder="stroke"
                    stroke="var(--halo)"
                    strokeWidth={3}
                    strokeLinejoin="round"
                >
                    {label.text}
                </text>
            ))}
        </g>
    );
}

/** Where a point on the screen is in the drawing's SVG units. */

export function PieceDrawing({
    piece,
    toSvg,
    ppm,
    dim = 1,
    minWidth = MIN_WIDTH,
    thinEdges = false,
    depth,
}: {
    piece: Piece;
    toSvg: (p: Vector3) => Vector2;
    ppm: number;
    /** How near a point is to the eye (the larger, the nearer), for a true-size rod to show its nearer end. */
    depth?: (p: Vector3) => number;
    /** How bright it's drawn, darker for what's below the level looked down on. */
    dim?: number;
    /** The narrowest each material's drawn (SVG units), if not the tower's. */
    minWidth?: Partial<Record<Material, number>>;
    /**
     * Rope's and wire's dark edges in proportion to how wide they're drawn, so a line drawn its true width, however
     * thin, stays that wide: by default the edges are a unit each side.
     */
    thinEdges?: boolean;
}) {
    const own = piece.color || MATERIAL_COLOR[piece.material];
    const color = dim < 1 ? shade(own, dim * 100) : own;
    if (piece.kind === "face") {
        const fill = shade(color, faceShade(piece));
        return (
            <g>
                {piece.holes?.length ? (
                    // Its holes cut out: each loop a subpath, filled even-odd.
                    <path
                        d={[piece.points, ...piece.holes]
                            .map((loop) => `M${svgPoints(loop.map(toSvg))}Z`)
                            .join("")}
                        fill={fill}
                        fillRule="evenodd"
                        stroke={piece.normal ? shade(color, 40) : fill}
                        strokeWidth={piece.normal ? 0.7 : 0.8}
                        strokeLinejoin="round"
                    />
                ) : (
                    <polygon
                        points={svgPoints(piece.points.map(toSvg))}
                        fill={fill}
                        stroke={piece.normal ? shade(color, 40) : fill}
                        strokeWidth={piece.normal ? 0.7 : 0.8}
                        strokeLinejoin="round"
                    />
                )}
                {piece.planks &&
                    plankLines(piece, piece.planks).map(([a, b], i) => {
                        const [p, q] = [toSvg(a), toSvg(b)];
                        return (
                            <line
                                key={i}
                                x1={p.x}
                                y1={p.y}
                                x2={q.x}
                                y2={q.y}
                                stroke={shade(color, 30)}
                                strokeWidth={Math.max(1, JOINT_GAP * ppm)}
                            />
                        );
                    })}
                {piece.text &&
                    (() => {
                        // Dark on the pale face, sized to a person's disc.
                        const at = toSvg(centreOf(piece));
                        return (
                            <text
                                x={at.x}
                                y={at.y}
                                fill="var(--rig-on-rope)"
                                fontSize={clamp(0.5 * ppm * 0.55, 9, 40)}
                                fontWeight={600}
                                fontFamily={MONO}
                                textAnchor="middle"
                                dominantBaseline="central"
                            >
                                {piece.text}
                            </text>
                        );
                    })()}
            </g>
        );
    }
    if (piece.kind === "strand" && piece.tape) {
        // Tape is drawn as its flat layers, each a ribbon between its two edges, so it's narrower the more it's turned
        // edge on to the eye.
        const { tape } = piece;
        return (
            <g>
                {tapeLayers(piece).map((layer, k) => (
                    <TapeRibbon
                        key={k}
                        edges={layer.map((q, i) => {
                            const at = tape.profile?.[i];
                            const half = (at?.across ?? tape.across)
                                .unit()
                                .scale((at?.width ?? tape.width) / 2);
                            return [toSvg(q.add(half)), toSvg(q.sub(half))] as const;
                        })}
                        color={color}
                        capA={piece.capA}
                        capB={piece.capB}
                    />
                ))}
            </g>
        );
    }
    if (piece.kind === "strand") {
        // Rope and wire are drawn as round as they are.
        const w = Math.max(2 * piece.r * ppm, minWidth[piece.material] ?? 0);
        // Thin edges lie inside its width, so it's drawn no wider than it is.
        const edge = thinEdges ? Math.min(1, 0.15 * w) : 1;
        return (
            <g>
                {tapeLayers(piece).map((layer, k) => (
                    <StrandLine
                        key={k}
                        pts={layer.map(toSvg)}
                        w={thinEdges ? w - 2 * edge : w}
                        edge={edge}
                        color={color}
                        capA={piece.capA}
                        capB={piece.capB}
                    />
                ))}
            </g>
        );
    }
    const a = toSvg(piece.a);
    const b = toSvg(piece.b);
    if (piece.toScale)
        return (
            <Cylinder
                piece={piece}
                a={a}
                b={b}
                r={Math.max(piece.r * ppm, (minWidth[piece.material] ?? 0) / 2)}
                ppm={ppm}
                color={color}
                depth={depth}
            />
        );
    const w = Math.max(2 * piece.r * ppm, minWidth[piece.material] ?? 0);
    const outline = w > 3;
    // A round end only where the rod really ends: between its lengths the joins must not show.
    const ends = (cap: boolean, p: Vector2) =>
        cap && (
            <circle
                cx={p.x}
                cy={p.y}
                r={w / 2 + (outline ? 1 : 0)}
                fill={outline ? shade(color, 45) : color}
            />
        );
    const endFills = (cap: boolean, p: Vector2) =>
        cap && outline && <circle cx={p.x} cy={p.y} r={w / 2 - 0.5} fill={color} />;
    // The outline is two lines along the rod's sides, so a length's outline never crosses the one before it. The fill
    // runs a little past each join so no hairline shows there.
    const along = b.sub(a).safeUnit(vec2(1, 0));
    const side = along.perp().scale(w / 2 + 0.25);
    const past = along.scale(0.6);
    const fa = piece.capA ? a : a.sub(past);
    const fb = piece.capB ? b : b.add(past);
    const edge = (s: number) => {
        const [p, q] = [a.add(side.scale(s)), b.add(side.scale(s))];
        return (
            <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={shade(color, 45)} strokeWidth={1.5} />
        );
    };
    return (
        <g>
            {ends(piece.capA, a)}
            {ends(piece.capB, b)}
            {endFills(piece.capA, a)}
            {endFills(piece.capB, b)}
            <line
                x1={fa.x}
                y1={fa.y}
                x2={fb.x}
                y2={fb.y}
                stroke={color}
                strokeWidth={outline ? w - 0.5 : w}
            />
            {outline && edge(1)}
            {outline && edge(-1)}
        </g>
    );
}

/**
 * A true-size rod (a part of some hardware) as the solid it is: a cylinder with flat ends, each end an ellipse as it's
 * seen at an angle, the nearer one drawn over its side.
 */
function Cylinder({
    piece,
    a,
    b,
    r,
    ppm,
    color,
    depth,
}: {
    piece: Rod;
    a: Vector2;
    b: Vector2;
    /** Its radius as drawn (SVG units). */
    r: number;
    ppm: number;
    color: string;
    depth?: (p: Vector3) => number;
}) {
    const length = piece.a.distanceTo(piece.b) * ppm;
    const shown = a.distanceTo(b);
    // How round its ends look: the sine of the angle between the rod and the page.
    const open = Math.sqrt(Math.max(0, 1 - (shown / Math.max(length, 1e-9)) ** 2));
    const along = b.sub(a).safeUnit(vec2(1, 0));
    const across = along.perp().scale(r);
    const edge = shade(color, 45);
    const end = (p: Vector2, key: string) => (
        <ellipse
            key={key}
            cx={p.x}
            cy={p.y}
            rx={Math.max(r * open, 0.01)}
            ry={r}
            transform={`rotate(${svgNumber(deg(Math.atan2(along.y, along.x)))} ${svgNumber(p.x)} ${svgNumber(p.y)})`}
            fill={shade(color, 85)}
            stroke={edge}
            strokeWidth={r > 1.5 ? 0.7 : 0}
        />
    );
    const nearB = depth ? depth(piece.b) > depth(piece.a) : true;
    const [far, near] = nearB ? [a, b] : [b, a];
    return (
        <g>
            {end(far, "far")}
            <polygon
                points={svgPoints([a.add(across), b.add(across), b.sub(across), a.sub(across)])}
                fill={color}
            />
            {r > 1.5 &&
                [1, -1].map((s) => {
                    const [p, q] = [a.add(across.scale(s)), b.add(across.scale(s))];
                    return (
                        <line
                            key={s}
                            x1={p.x}
                            y1={p.y}
                            x2={q.x}
                            y2={q.y}
                            stroke={edge}
                            strokeWidth={0.7}
                        />
                    );
                })}
            {end(near, "near")}
        </g>
    );
}

/**
 * One layer of tape as a ribbon between its two edges (`edges`, a pair at each point, SVG units), with a dark line
 * along each edge and across its real ends.
 */
function TapeRibbon({
    edges,
    color,
    capA,
    capB,
}: {
    edges: (readonly [Vector2, Vector2])[];
    color: string;
    capA: boolean;
    capB: boolean;
}) {
    const left = edges.map(([l]) => l);
    const right = edges.map(([, r]) => r);
    const outline = shade(color, 40);
    const n = edges.length - 1;
    return (
        <g>
            <polygon points={svgPoints([...left, ...right.reverse()])} fill={color} />
            <polyline
                points={svgPoints(edges.map(([l]) => l))}
                fill="none"
                stroke={outline}
                strokeWidth={1}
            />
            <polyline
                points={svgPoints(edges.map(([, r]) => r))}
                fill="none"
                stroke={outline}
                strokeWidth={1}
            />
            {capA && (
                <line
                    x1={edges[0][0].x}
                    y1={edges[0][0].y}
                    x2={edges[0][1].x}
                    y2={edges[0][1].y}
                    stroke={outline}
                    strokeWidth={1}
                />
            )}
            {capB && (
                <line
                    x1={edges[n][0].x}
                    y1={edges[n][0].y}
                    x2={edges[n][1].x}
                    y2={edges[n][1].y}
                    stroke={outline}
                    strokeWidth={1}
                />
            )}
        </g>
    );
}

/**
 * One line of rope or tape through `pts` (SVG units), `w` wide with a dark edge. Where it joins another strand its ends
 * are cut square, with the fill running a little past so no line shows across the join; real ends are rounded.
 */
function StrandLine({
    pts,
    w,
    edge = 1,
    color,
    capA,
    capB,
}: {
    pts: Vector2[];
    w: number;
    /** How wide its dark edge is each side. */
    edge?: number;
    color: string;
    capA: boolean;
    capB: boolean;
}) {
    const n = pts.length - 1;
    const past = (end: Vector2, next: Vector2) =>
        end.add(end.sub(next).safeUnit(vec2(0, 0)).scale(0.8));
    const fillPts = [
        capA ? pts[0] : past(pts[0], pts[1]),
        ...pts.slice(1, n),
        capB ? pts[n] : past(pts[n], pts[n - 1]),
    ];
    const cut = {
        fill: "none",
        strokeLinecap: "butt",
        strokeLinejoin: "round",
    } as const;
    const caps = [capA && pts[0], capB && pts[n]].filter((p): p is Vector2 => !!p);
    // A closed loop (a ring, a carabiner) is drawn as one, so it joins round where it starts and ends.
    if (!capA && !capB && n > 2 && pts[0].distanceTo(pts[n]) < 1e-3) {
        const d = `M${svgPoints(pts.slice(0, n))}Z`;
        return (
            <g>
                <path {...cut} d={d} stroke={shade(color, 40)} strokeWidth={w + 2 * edge} />
                <path {...cut} d={d} stroke={color} strokeWidth={w} />
            </g>
        );
    }
    return (
        <g>
            <polyline
                {...cut}
                points={svgPoints(pts)}
                stroke={shade(color, 40)}
                strokeWidth={w + 2 * edge}
            />
            {caps.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={w / 2 + edge} fill={shade(color, 40)} />
            ))}
            <polyline {...cut} points={svgPoints(fillPts)} stroke={color} strokeWidth={w} />
            {caps.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={w / 2} fill={color} />
            ))}
        </g>
    );
}

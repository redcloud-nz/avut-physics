"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Choice, Slider, VisualisationLayout } from "@/components/diagram/controls";
import { Label } from "@/components/diagram/svg";
import { clamp, deg, rad } from "@/lib/math";
import { OrbitCamera } from "@/lib/orbit-camera";
import { svgNumber, svgPoints } from "@/lib/svg-path";
import { vec2, type Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import { layoutRig, legend, RIGS, type RigLabel } from "./rig";
import {
    groundAt,
    groundCorners,
    LEVELS,
    OVERHEAD,
    overheadSpace,
    SIDE,
    towerPieces,
    type Face,
    type Material,
    type Piece,
} from "./tower";

const W = 800;
const H = 1000;
/** SVG units per metre unzoomed: the same in every view, so the tower doesn't grow and shrink as it turns. */
const PPM = 60;
/** The point the camera turns about to start with, and where that point sits in the drawing. */
const CENTRE = vec3(SIDE / 2, 5.4, SIDE / 2);
const ORIGIN = vec2(W / 2, H / 2 + 10);
const MAX_ZOOM = 8;

/** How close the view is, and the point it's centred on (which it turns about). */
type Frame = { zoom: number; target: Vector3 };
const WHOLE: Frame = { zoom: 1, target: CENTRE };

/**
 * The frame that keeps the scene point that was under `from` (in `start`) under `to`, at `zoom`: zooming about a point,
 * panning, or both at once as in a pinch.
 */
function reframe(cam: OrbitCamera, start: Frame, from: Vector2, to: Vector2, zoom: number): Frame {
    const z = clamp(zoom, 1, MAX_ZOOM);
    const inView = (s: Vector2, ppm: number) =>
        vec2((s.x - ORIGIN.x) / ppm, (ORIGIN.y - s.y) / ppm);
    const [u, v] = [inView(from, PPM * start.zoom), inView(to, PPM * z)];
    const shift = cam.right.scale(u.x - v.x).add(cam.up.scale(u.y - v.y));
    return { zoom: z, target: start.target.add(shift) };
}

const COLOR: Record<Material, string> = {
    log: "var(--tower-log)",
    rail: "var(--tower-rail)",
    board: "var(--tower-board)",
    deck: "var(--tower-deck)",
    steel: "var(--tower-steel)",
    door: "var(--tower-door)",
    sling: "var(--knot-yellow)",
    rope: "var(--knot-blue)",
    bucket: "var(--rig-black)",
};
/** The narrowest some things are drawn (SVG units), however thin they are, so a rope never vanishes. */
const MIN_WIDTH: Partial<Record<Material, number>> = { sling: 4.5, rope: 3.5, steel: 1.6 };
const shade = (color: string, percent: number) =>
    `color-mix(in oklab, ${color} ${Math.round(percent)}%, black)`;

/** Where the light comes from: high in the north, as the sun is here. */
const LIGHT = vec3(0.3, 0.8, 0.5).unit();

/** The preset views: the compass bearing from the tower to the eye, and how far above level it looks down. */
type ViewName = "sw" | "se" | "ne" | "nw" | "above";
const VIEWS: Record<ViewName, { label: string; azimuth: number; elevation: number }> = {
    sw: { label: "SW", azimuth: 225, elevation: 25 },
    se: { label: "SE", azimuth: 135, elevation: 25 },
    ne: { label: "NE", azimuth: 45, elevation: 25 },
    nw: { label: "NW", azimuth: 315, elevation: 25 },
    above: { label: "Above", azimuth: 180, elevation: 89 },
};

const LEVEL_NAMES = ["G", "Level 1", "Level 2", "Level 3", "Level 4"];

/** How a face's colour is shaded: lit faces brighter, those edge on to the light darker. */
function faceShade(f: Face): number {
    const [p0, p1, , p3] = f.points;
    const n = f.normal ?? p1.sub(p0).cross(p3.sub(p0)).unit();
    return 55 + 45 * Math.abs(n.dot(LIGHT));
}

/** Where level board joints `spacing` apart cross a convex face, as pairs of points. */
function plankLines(f: Face, spacing: number): [Vector3, Vector3][] {
    const ys = f.points.map((p) => p.y);
    const lines: [Vector3, Vector3][] = [];
    for (
        let h = Math.ceil(Math.min(...ys) / spacing + 1e-9) * spacing;
        h < Math.max(...ys) - 1e-9;
        h += spacing
    ) {
        const hits: Vector3[] = [];
        f.points.forEach((a, i) => {
            const b = f.points[(i + 1) % f.points.length];
            if ((a.y - h) * (b.y - h) < 0) hits.push(a.lerp(b, (h - a.y) / (b.y - a.y)));
        });
        if (hits.length === 2) lines.push([hits[0], hits[1]]);
    }
    return lines;
}

export default function TowerView() {
    const [azimuth, setAzimuth] = useState(VIEWS.se.azimuth);
    const [elevation, setElevation] = useState(VIEWS.se.elevation);
    const rig = RIGS[0];
    const laid = useMemo(() => layoutRig(rig), [rig]);
    const pieces = useMemo(() => [...towerPieces(), ...laid.pieces], [laid]);
    const [frame, setFrame] = useState<Frame>(WHOLE);
    const svgRef = useRef<SVGSVGElement>(null);
    /** The pointers down on the drawing, where each is now (SVG units). */
    const pointers = useRef(new Map<number, Vector2>());
    /** What a drag or pinch started from: turning, panning, or a pinch (two touches). */
    const gesture = useRef<
        | { kind: "turn"; x: number; y: number; azimuth: number; elevation: number }
        | { kind: "pan"; at: Vector2; frame: Frame }
        | { kind: "pinch"; mid: Vector2; spread: number; frame: Frame }
        | null
    >(null);

    const cam = new OrbitCamera(rad(azimuth), rad(elevation));
    const ppm = PPM * frame.zoom;
    const toSvg = (p: Vector3): Vector2 => {
        const v = cam.project(p.sub(frame.target));
        return vec2(ORIGIN.x + v.x * ppm, ORIGIN.y - v.y * ppm);
    };

    // A trackpad pinch, or the wheel with Ctrl or ⌘ held, zooms about the pointer. A plain wheel still scrolls the page.
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            const at = toDrawing(svg, e.clientX, e.clientY);
            setFrame((f) =>
                reframe(
                    new OrbitCamera(rad(azimuth), rad(elevation)),
                    f,
                    at,
                    at,
                    f.zoom * Math.exp(-e.deltaY * 0.004),
                ),
            );
        };
        svg.addEventListener("wheel", onWheel, { passive: false });
        return () => svg.removeEventListener("wheel", onWheel);
    }, [azimuth, elevation]);

    // Back to front, by each piece's middle, except that the tower's shell comes first: what's on a side facing the eye
    // is drawn after everything inside it, and what's on a side facing away before (see `Shell`). A timber's sides
    // facing away are left out, being behind its others.
    const shown = (p: Piece) => p.kind !== "face" || !p.normal || p.normal.dot(cam.toward) > 0;
    const sortKey = (p: Piece) => {
        const depth = cam.depth(centreOf(p));
        if (!p.shell) return depth;
        return depth + (p.shell.out.dot(cam.toward) > 0 ? 1 : -1) * p.shell.layer * 100;
    };
    const sorted = pieces
        .filter(shown)
        .map((piece) => ({ piece, key: sortKey(piece) }))
        .sort((a, b) => a.key - b.key)
        .map((d) => d.piece);

    const view = (Object.keys(VIEWS) as ViewName[]).find(
        (k) => VIEWS[k].azimuth === azimuth && VIEWS[k].elevation === elevation,
    );

    const startPinch = () => {
        const [a, b] = [...pointers.current.values()];
        gesture.current = { kind: "pinch", mid: a.mid(b), spread: a.distanceTo(b), frame };
    };
    const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const at = toDrawing(e.currentTarget, e.clientX, e.clientY);
        pointers.current.set(e.pointerId, at);
        if (pointers.current.size === 2) startPinch();
        else if (pointers.current.size > 2) return;
        // Shift, or the right or middle button, pans; otherwise a drag turns the tower.
        else if (e.shiftKey || e.button === 1 || e.button === 2)
            gesture.current = { kind: "pan", at, frame };
        else gesture.current = { kind: "turn", x: e.clientX, y: e.clientY, azimuth, elevation };
    };
    const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        if (!pointers.current.has(e.pointerId)) return;
        const at = toDrawing(e.currentTarget, e.clientX, e.clientY);
        pointers.current.set(e.pointerId, at);
        const d = gesture.current;
        if (!d) return;
        if (d.kind === "pinch") {
            if (pointers.current.size !== 2) return;
            const [a, b] = [...pointers.current.values()];
            const zoom = d.frame.zoom * (a.distanceTo(b) / Math.max(d.spread, 1));
            setFrame(reframe(cam, d.frame, d.mid, a.mid(b), zoom));
            return;
        }
        if (d.kind === "pan") {
            setFrame(reframe(cam, d.frame, d.at, at, d.frame.zoom));
            return;
        }
        // A drag across the whole drawing turns the tower about once.
        const perPixel = 360 / e.currentTarget.getBoundingClientRect().width;
        setAzimuth(
            ((Math.round(d.azimuth + (e.clientX - d.x) * perPixel * 0.6) % 360) + 360) % 360,
        );
        // On a touch screen an up-and-down drag scrolls the page instead, so only a mouse or pen tilts.
        if (e.pointerType !== "touch")
            setElevation(
                Math.round(clamp(d.elevation + (e.clientY - d.y) * perPixel * 0.4, 0, 89)),
            );
    };
    const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
        pointers.current.delete(e.pointerId);
        // Lifting one finger of a pinch carries on as a turn with the other, from where it is.
        const [rest] = [...pointers.current.entries()];
        gesture.current = null;
        if (pointers.current.size === 2) startPinch();
        else if (rest && e.pointerType === "touch") {
            const r = svgRef.current?.getScreenCTM();
            const client = r ? new DOMPoint(rest[1].x, rest[1].y).matrixTransform(r) : rest[1];
            gesture.current = { kind: "turn", x: client.x, y: client.y, azimuth, elevation };
        }
    };

    // The levels' names beside whichever corner is leftmost in the view.
    const corners = [vec3(0, 0, 0), vec3(SIDE, 0, 0), vec3(SIDE, 0, SIDE), vec3(0, 0, SIDE)];
    const leftmost = corners.reduce((a, b) => (toSvg(b).x < toSvg(a).x ? b : a));
    const compass: [string, Vector3][] = [
        ["N", vec3(SIDE / 2, groundAt(SIDE / 2), SIDE + 1.8)],
        ["S", vec3(SIDE / 2, groundAt(SIDE / 2), -1.8)],
        ["E", vec3(SIDE + 1.8, groundAt(SIDE + 1.8), SIDE / 2)],
        ["W", vec3(-2.2, groundAt(-2.2), SIDE / 2)],
    ];

    const diagram = (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className={`block h-auto max-h-[85vh] w-full cursor-grab select-none active:cursor-grabbing ${
                // Zoomed in, every touch gesture is the drawing's; zoomed out, an up-and-down drag scrolls the page.
                frame.zoom > 1 ? "touch-none" : "touch-pan-y"
            }`}
            role="img"
            aria-label="The Cracroft abseil tower in 3D. Drag to turn it, pinch to zoom, and shift-drag or drag with two fingers to move it."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(e) => e.preventDefault()}
        >
            <polygon points={svgPoints(groundCorners().map(toSvg))} fill="var(--tower-ground)" />
            {compass.map(([name, p]) => (
                <Label key={name} at={toSvg(p)} color="var(--ink-muted)">
                    {name}
                </Label>
            ))}
            {sorted.map((piece, i) => (
                <PieceDrawing key={i} piece={piece} toSvg={toSvg} ppm={ppm} />
            ))}
            {laid.labels.map((l, i) => (
                <RigLabelDrawing key={i} label={l} toSvg={toSvg} ppm={ppm} />
            ))}
            {/* The spaces' numbers, unless the beam's seen end on and they'd fall on one another. */}
            {Math.abs(cam.right.z) > 0.4 &&
                [1, 2, 3, 4, 5].map((n) => {
                    const { z0, z1 } = overheadSpace(n);
                    const at = vec3(OVERHEAD.x, OVERHEAD.upperY + OVERHEAD.r + 0.2, (z0 + z1) / 2);
                    return (
                        <Label key={n} at={toSvg(at)} color="var(--ink-muted)">
                            {n}
                        </Label>
                    );
                })}
            {LEVELS.slice(1).map((y, i) => {
                const at = toSvg(vec3(leftmost.x, y, leftmost.z));
                return (
                    <text
                        key={i}
                        x={at.x - 26}
                        y={at.y}
                        fill="var(--ink-soft)"
                        fontSize={14}
                        fontFamily="var(--font-geist-mono), monospace"
                        textAnchor="end"
                        dominantBaseline="middle"
                        paintOrder="stroke"
                        stroke="var(--halo)"
                        strokeWidth={4}
                    >
                        {LEVEL_NAMES[i + 1]}
                    </text>
                );
            })}
        </svg>
    );

    const controls = (
        <>
            <Choice
                label="View from"
                value={view ?? ("" as ViewName)}
                options={(Object.keys(VIEWS) as ViewName[]).map((k) => ({
                    value: k,
                    label: VIEWS[k].label,
                }))}
                onChange={(k) => {
                    setAzimuth(VIEWS[k].azimuth);
                    setElevation(VIEWS[k].elevation);
                }}
            />
            <Slider
                label="Turn (bearing to the eye)"
                value={azimuth}
                min={0}
                max={359}
                step={1}
                unit="°"
                digits={0}
                onChange={setAzimuth}
            />
            <Slider
                label="Look down"
                value={elevation}
                min={0}
                max={89}
                step={1}
                unit="°"
                digits={0}
                onChange={setElevation}
            />
            <Slider
                label="Zoom"
                value={frame.zoom}
                min={1}
                max={MAX_ZOOM}
                step={0.1}
                unit="×"
                digits={1}
                onChange={(z) => setFrame((f) => reframe(cam, f, ORIGIN, ORIGIN, z))}
            />
            <button
                type="button"
                onClick={() => setFrame(WHOLE)}
                disabled={frame === WHOLE}
                className="self-start rounded-md bg-surface-raised px-3 py-1 text-sm text-ink-soft transition-colors hover:bg-line-faint disabled:opacity-50"
            >
                Show the whole tower
            </button>
            <p className="text-xs text-ink-muted">
                Pinch, or Ctrl/⌘ and scroll, to zoom about a point. Shift-drag, right-drag or drag
                with two fingers to move the view.
            </p>
        </>
    );

    const key = legend(rig);
    const readouts = (
        <>
            <h2 className="text-sm font-medium text-ink-strong">{rig.name}</h2>
            <ul className="flex flex-col gap-2 text-sm text-ink-soft">
                {key.cylinders.map((c) => (
                    <li key={c.text} className="flex items-center gap-3">
                        <CylinderSwatch text={c.text} colors={c.colors} />
                        <span>{c.name}</span>
                    </li>
                ))}
            </ul>
            <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
                {key.lines.map((l) => (
                    <li key={l.name} className="flex items-center gap-3">
                        <span className="flex w-16 shrink-0 flex-col gap-1">
                            {l.colors.map((c) => (
                                <StrandSwatch key={c} color={c} look={l.look} />
                            ))}
                        </span>
                        {l.name}
                    </li>
                ))}
            </ul>
            <p className="text-xs text-ink-muted">
                The overhead beam&rsquo;s spaces are numbered 1 to 5 from the south, between its
                steel rods.
            </p>
        </>
    );

    return <VisualisationLayout diagram={diagram} controls={controls} readouts={readouts} />;
}

function centreOf(piece: Piece): Vector3 {
    if (piece.kind === "rod") return piece.a.lerp(piece.b, 0.5);
    // A strand by its middle along its length would do better, but its points' average is near enough.
    return piece.points.reduce((s, p) => s.add(p), vec3(0, 0, 0)).scale(1 / piece.points.length);
}

const MONO = "var(--font-geist-mono), monospace";

/** A legend's short length of tape or rope: a flat band for tape, a thinner cord for rope. */
function StrandSwatch({ color, look }: { color: string; look: "tape" | "rope" }) {
    const [w, h] = [64, 8];
    const thick = look === "tape" ? 6 : 3.5;
    const line = { x1: thick / 2 + 1, x2: w - thick / 2 - 1, y1: h / 2, y2: h / 2 };
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="block">
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
function CylinderSwatch({ text, colors }: { text: string; colors: string[] }) {
    const [w, h] = [64, 20];
    const light = colors.length > 1;
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
function RigLabelDrawing({
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
    // Seen end on, the cylinder has no direction on the page to write along.
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
    // Beside it, on whichever side is up the page.
    const size = 12;
    const side = vec2(-Math.sin(upright), Math.cos(upright));
    const away = side.y < 0 ? side : side.neg();
    const beside = at.add(away.scale(thick / 2 + size * 0.75));
    return (
        <text
            x={beside.x}
            y={beside.y}
            transform={`rotate(${svgNumber(deg(upright))} ${svgNumber(beside.x)} ${svgNumber(beside.y)})`}
            fill="var(--ink-strong)"
            fontSize={size}
            fontFamily={MONO}
            textAnchor="middle"
            dominantBaseline="central"
            {...halo}
        >
            {label.text}
        </text>
    );
}

/** Where a point on the screen is in the drawing's SVG units. */
function toDrawing(svg: SVGSVGElement, clientX: number, clientY: number): Vector2 {
    const m = svg.getScreenCTM();
    if (!m) return vec2(clientX, clientY);
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return vec2(p.x, p.y);
}

function PieceDrawing({
    piece,
    toSvg,
    ppm,
}: {
    piece: Piece;
    toSvg: (p: Vector3) => Vector2;
    ppm: number;
}) {
    const color = piece.color || COLOR[piece.material];
    if (piece.kind === "face") {
        const fill = shade(color, faceShade(piece));
        return (
            <g>
                <polygon
                    points={svgPoints(piece.points.map(toSvg))}
                    fill={fill}
                    stroke={piece.normal ? shade(color, 40) : fill}
                    strokeWidth={piece.normal ? 0.7 : 0.8}
                    strokeLinejoin="round"
                />
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
                                stroke={shade(color, 40)}
                                strokeWidth={1}
                            />
                        );
                    })}
            </g>
        );
    }
    if (piece.kind === "strand") {
        const w = Math.max(2 * piece.r * ppm, MIN_WIDTH[piece.material] ?? 0);
        const pts = piece.points.map(toSvg);
        const n = pts.length - 1;
        // Where it joins another strand the ends are cut square, with the fill running a little past so no line shows
        // across the join; real ends are rounded.
        const past = (end: Vector2, next: Vector2) =>
            end.add(end.sub(next).safeUnit(vec2(0, 0)).scale(0.8));
        const fillPts = [
            piece.capA ? pts[0] : past(pts[0], pts[1]),
            ...pts.slice(1, n),
            piece.capB ? pts[n] : past(pts[n], pts[n - 1]),
        ];
        const line = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
        const cut = { ...line, strokeLinecap: "butt" } as const;
        const caps = [piece.capA && pts[0], piece.capB && pts[n]].filter((p): p is Vector2 => !!p);
        return (
            <g>
                <polyline
                    {...cut}
                    points={svgPoints(pts)}
                    stroke={shade(color, 40)}
                    strokeWidth={w + 2}
                />
                {caps.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={w / 2 + 1} fill={shade(color, 40)} />
                ))}
                <polyline {...cut} points={svgPoints(fillPts)} stroke={color} strokeWidth={w} />
                {caps.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={w / 2} fill={color} />
                ))}
            </g>
        );
    }
    const a = toSvg(piece.a);
    const b = toSvg(piece.b);
    const w = Math.max(2 * piece.r * ppm, MIN_WIDTH[piece.material] ?? 0);
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

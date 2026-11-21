"use client";

import { useMemo, useRef, useState } from "react";

import { Choice, Slider, VisualisationLayout } from "@/components/diagram/controls";
import { Label } from "@/components/diagram/svg";
import { clamp, rad } from "@/lib/math";
import { OrbitCamera } from "@/lib/orbit-camera";
import { svgPoints } from "@/lib/svg-path";
import { vec2, type Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import {
    groundAt,
    groundCorners,
    LEVELS,
    SIDE,
    towerPieces,
    type Face,
    type Material,
    type Piece,
} from "./tower";

const W = 800;
const H = 1000;
/** SVG units per metre: the same in every view, so the tower doesn't grow and shrink as it turns. */
const PPM = 60;
/** The point the camera turns about, and where it sits in the drawing. */
const CENTRE = vec3(SIDE / 2, 5.4, SIDE / 2);
const ORIGIN = vec2(W / 2, H / 2 + 10);

const COLOR: Record<Material, string> = {
    log: "var(--tower-log)",
    rail: "var(--tower-rail)",
    board: "var(--tower-board)",
    deck: "var(--tower-deck)",
    steel: "var(--tower-steel)",
    door: "var(--tower-door)",
};
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
    const [azimuth, setAzimuth] = useState(VIEWS.sw.azimuth);
    const [elevation, setElevation] = useState(VIEWS.sw.elevation);
    const pieces = useMemo(() => towerPieces(), []);
    const drag = useRef<{ x: number; y: number; azimuth: number; elevation: number } | null>(null);

    const cam = new OrbitCamera(rad(azimuth), rad(elevation));
    const toSvg = (p: Vector3): Vector2 => {
        const v = cam.project(p.sub(CENTRE));
        return vec2(ORIGIN.x + v.x * PPM, ORIGIN.y - v.y * PPM);
    };

    // Back to front, by each piece's middle. That goes wrong between a big flat wall and what's just behind it, so the
    // outside walls (the boarding and the door) go first when they face away and last when they face the eye.
    const byDepth = (list: Piece[]) =>
        list
            .map((piece) => ({ piece, depth: cam.depth(centreOf(piece)) }))
            .sort((a, b) => a.depth - b.depth)
            .map((d) => d.piece);
    const facing = (f: Face) => outward(f).dot(cam.toward) > 0;
    const walls = pieces.filter((p): p is Face => p.kind === "face" && isWall(p));
    // A timber's sides facing away are behind its others.
    const shown = (p: Piece) => p.kind === "rod" || !p.normal || p.normal.dot(cam.toward) > 0;
    const sorted = [
        ...byDepth(walls.filter((w) => !facing(w))),
        ...byDepth(pieces.filter((p) => shown(p) && !(p.kind === "face" && isWall(p)))),
        ...byDepth(walls.filter(facing)),
    ];

    const view = (Object.keys(VIEWS) as ViewName[]).find(
        (k) => VIEWS[k].azimuth === azimuth && VIEWS[k].elevation === elevation,
    );

    const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, azimuth, elevation };
    };
    const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        const d = drag.current;
        if (!d) return;
        // A drag across the whole drawing turns the tower about once.
        const perPixel = 360 / e.currentTarget.getBoundingClientRect().width;
        setAzimuth(
            ((Math.round(d.azimuth - (e.clientX - d.x) * perPixel * 0.6) % 360) + 360) % 360,
        );
        // On a touch screen an up-and-down drag scrolls the page instead, so only a mouse or pen tilts.
        if (e.pointerType !== "touch")
            setElevation(
                Math.round(clamp(d.elevation + (e.clientY - d.y) * perPixel * 0.4, 0, 89)),
            );
    };
    const onPointerUp = () => (drag.current = null);

    // The levels' names beside whichever corner is leftmost in the view.
    const corners = [vec3(0, 0, 0), vec3(SIDE, 0, 0), vec3(SIDE, 0, SIDE), vec3(0, 0, SIDE)];
    const leftmost = corners.reduce((a, b) => (toSvg(b).x < toSvg(a).x ? b : a));
    const compass: [string, Vector3][] = [
        ["N", vec3(SIDE / 2, groundAt(SIDE + 2), SIDE + 2)],
        ["S", vec3(SIDE / 2, groundAt(-1.8), -1.8)],
        ["E", vec3(SIDE + 1.8, groundAt(SIDE / 2), SIDE / 2)],
        ["W", vec3(-1.8, groundAt(SIDE / 2), SIDE / 2)],
    ];

    const diagram = (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block h-auto max-h-[85vh] w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
            role="img"
            aria-label="The abseil tower in 3D. Drag to turn it."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <polygon points={svgPoints(groundCorners().map(toSvg))} fill="var(--tower-ground)" />
            {compass.map(([name, p]) => (
                <Label key={name} at={toSvg(p)} color="var(--ink-muted)">
                    {name}
                </Label>
            ))}
            {sorted.map((piece, i) => (
                <PieceDrawing key={i} piece={piece} toSvg={toSvg} />
            ))}
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
        </>
    );

    return <VisualisationLayout diagram={diagram} controls={controls} />;
}

/** The outside walls: the boarding and the door, which are all on the tower's outside. */
const isWall = (f: Face) => f.material === "board" || f.material === "door";

/** A flat piece's normal, turned to point away from the tower's middle. */
function outward(f: Face): Vector3 {
    const [p0, p1, , p3] = f.points;
    const n = p1.sub(p0).cross(p3.sub(p0)).unit();
    const away = centreOf(f).sub(vec3(SIDE / 2, 0, SIDE / 2));
    return n.dot(vec3(away.x, 0, away.z)) < 0 ? n.neg() : n;
}

function centreOf(piece: Piece): Vector3 {
    if (piece.kind === "rod") return piece.a.lerp(piece.b, 0.5);
    return piece.points.reduce((s, p) => s.add(p), vec3(0, 0, 0)).scale(1 / piece.points.length);
}

function PieceDrawing({ piece, toSvg }: { piece: Piece; toSvg: (p: Vector3) => Vector2 }) {
    const color = COLOR[piece.material];
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
    const a = toSvg(piece.a);
    const b = toSvg(piece.b);
    const w = 2 * piece.r * PPM;
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

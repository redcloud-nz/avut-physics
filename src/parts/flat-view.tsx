"use client";

import { useEffect, useRef, useState } from "react";

import { useInBrowser } from "@/components/use-in-browser";
import { rad } from "@/lib/math";
import { OrbitCamera } from "@/lib/orbit-camera";
import { svgNumber } from "@/lib/svg-path";
import { vec2, type Vector2 } from "@/lib/vector2";
import type { Vector3 } from "@/lib/vector3";
import { DETAILS, type Detail } from "@/scene/detail";
import { flatDepth, nearness, PieceDrawing } from "@/scene/piece-svg";
import { piecePoints, type Piece, type RigLabel } from "@/scene/pieces";

import type { PartFlat } from "./catalogue";

/** A flat view: square on from a bearing and a height (degrees). */
export type FlatLook = { label: string; azimuth: number; elevation: number };

/** The flat views beside a 3D one: square on from the front, the side and above. */
export const FLATS: FlatLook[] = [
    { label: "Front", azimuth: 180, elevation: 0 },
    { label: "Side", azimuth: 90, elevation: 0 },
    { label: "Top", azimuth: 180, elevation: 90 },
];

/** Every point a piece is drawn through. */

/** A scale bar's length (metres): a round 1, 2 or 5 times a power of ten, about `about` long. */
function roundLength(about: number): number {
    const p = 10 ** Math.floor(Math.log10(about));
    const k = about / p;
    return (k >= 5 ? 5 : k >= 2 ? 2 : 1) * p;
}
const lengthText = (m: number) =>
    m >= 1 ? `${m} m` : m >= 0.01 ? `${Math.round(m * 100)} cm` : `${Math.round(m * 1000)} mm`;

/**
 * One flat view of some pieces, fitted to them, with a scale bar: the pieces seen square on, or the part's own pieces for
 * the view drawn as its visualisation draws them (`flat`).
 */
export function FlatView({
    name,
    pieces: seen,
    labels,
    view,
    detail,
    flat,
}: {
    /** What's drawn, for a screen reader. */
    name: string;
    pieces: Piece[];
    labels: RigLabel[];
    view: FlatLook;
    detail: Detail;
    flat?: PartFlat;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState(vec2(300, 200));
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) setSize(vec2(width, height));
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    const inBrowser = useInBrowser();
    const cam = new OrbitCamera(rad(view.azimuth), rad(view.elevation));
    const pieces = flat ? flat.pieces(cam.toward) : seen;
    // Fitted to what this view sees of the part, rods and ropes their full thickness, with room round it.
    const projected = pieces.flatMap((piece) => {
        const r = piece.kind === "face" ? 0 : piece.r;
        return piecePoints(piece).map((p) => ({ at: cam.project(p), r }));
    });
    const [x0, x1] = [
        Math.min(...projected.map((p) => p.at.x - p.r)),
        Math.max(...projected.map((p) => p.at.x + p.r)),
    ];
    const [y0, y1] = [
        Math.min(...projected.map((p) => p.at.y - p.r)),
        Math.max(...projected.map((p) => p.at.y + p.r)),
    ];
    const room = 28;
    // A part's own flat view is drawn smaller, with space round it, as it would sit among the rest of its rig.
    const ppm =
        Math.min(
            (size.x - 2 * room) / Math.max(x1 - x0, 1e-3),
            (size.y - 2 * room) / Math.max(y1 - y0, 1e-3),
        ) * (flat ? 0.6 : 1);
    const mid = vec2((x0 + x1) / 2, (y0 + y1) / 2);
    const toSvg = (p: Vector3): Vector2 => {
        const v = cam.project(p);
        return vec2(size.x / 2 + (v.x - mid.x) * ppm, size.y / 2 - (v.y - mid.y) * ppm);
    };
    const sorted = pieces
        .filter((p) => p.fine === undefined || p.fine * ppm >= DETAILS[detail].finePx)
        .filter((p) => p.kind !== "face" || !p.normal || p.normal.dot(cam.toward) > 0)
        .map((piece) => ({
            piece,
            key: flat
                ? flatDepth(piece, cam.toward, view.elevation === 90)
                : nearness(piece, cam.toward),
        }))
        .sort((a, b) => a.key - b.key);
    const bar = roundLength((size.x * 0.25) / ppm);
    return (
        <div
            ref={ref}
            className="relative min-h-0 min-w-0 flex-1 border-border not-first:border-l lg:not-first:border-t lg:not-first:border-l-0"
        >
            <svg
                viewBox={`0 0 ${svgNumber(size.x)} ${svgNumber(size.y)}`}
                className="absolute inset-0 block h-full w-full"
                role="img"
                aria-label={`${name}, from the ${view.label.toLowerCase()}`}
            >
                {inBrowser &&
                    sorted.map((d, i) => (
                        <PieceDrawing
                            key={i}
                            piece={d.piece}
                            toSvg={toSvg}
                            ppm={ppm}
                            minWidth={flat?.minWidth ?? {}}
                            thinEdges={flat?.thinEdges}
                            depth={(p) => cam.depth(p)}
                        />
                    ))}
                {/* What's written on the part, level at where it is, nearest last. */}
                {inBrowser &&
                    [...labels]
                        .sort((a, b) => cam.depth(b.at) - cam.depth(a.at))
                        .map((l, i) => {
                            const at = toSvg(l.at);
                            return (
                                <text
                                    key={i}
                                    x={svgNumber(at.x)}
                                    y={svgNumber(at.y)}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fontSize={7}
                                    className="fill-ink-muted stroke-surface"
                                    strokeWidth={2}
                                    paintOrder="stroke"
                                >
                                    {l.text}
                                </text>
                            );
                        })}
                {/* The scale bar, like the drawing, once in the browser: its length is worked out from the part. */}
                {inBrowser && (
                    <g
                        transform={`translate(${svgNumber(size.x - 12 - bar * ppm)} ${svgNumber(size.y - 12)})`}
                    >
                        <line
                            x1={0}
                            x2={bar * ppm}
                            y1={0}
                            y2={0}
                            stroke="var(--ink-muted)"
                            strokeWidth={1.5}
                        />
                        {[0, bar * ppm].map((x) => (
                            <line
                                key={x}
                                x1={x}
                                x2={x}
                                y1={-4}
                                y2={0}
                                stroke="var(--ink-muted)"
                                strokeWidth={1.5}
                            />
                        ))}
                        <text
                            x={(bar * ppm) / 2}
                            y={-6}
                            textAnchor="middle"
                            fontSize={11}
                            fill="var(--ink-muted)"
                        >
                            {lengthText(bar)}
                        </text>
                    </g>
                )}
            </svg>
            <span className="absolute top-1.5 left-2 text-xs text-ink-muted">{view.label}</span>
        </div>
    );
}

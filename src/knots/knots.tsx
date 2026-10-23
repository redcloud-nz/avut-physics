"use client";

import { useState } from "react";

import { Toggle, VisualisationLayout } from "@/components/diagram/controls";
import { vec2 } from "@/lib/vector2";

import { looseFigureEight } from "./figure-eight";
import { RopeDrawing } from "./rope-drawing";

/** The drawing's width in SVG units; its height follows the knot's shape. */
const W = 600;
/** Room round the knot (SVG units). */
const MARGIN = 30;

const { rope: ROPE, crossings: CROSSINGS } = looseFigureEight();

/** A figure-8 knot, tied but loose, drawn from its centreline. */
export default function Knots() {
    const [showCentreline, setShowCentreline] = useState(false);
    const rope = ROPE;

    const xs = rope.points.map((p) => p.x);
    const ys = rope.points.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const scale = (W - 2 * MARGIN) / (x1 - x0);
    const H = (y1 - y0) * scale + 2 * MARGIN;
    const toSvg = (p: { x: number; y: number }) =>
        vec2(MARGIN + (p.x - x0) * scale, MARGIN + (y1 - p.y) * scale);

    return (
        <VisualisationLayout
            diagram={
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="mx-auto block h-auto max-h-[70vh] w-full max-w-xl"
                >
                    <RopeDrawing rope={rope} toSvg={toSvg} scale={scale} />
                    {showCentreline && (
                        <g>
                            <polyline
                                points={rope.points
                                    .map(toSvg)
                                    .map((p) => `${p.x},${p.y}`)
                                    .join(" ")}
                                fill="none"
                                stroke="#38bdf8"
                                strokeWidth={1}
                            />
                            {CROSSINGS.map((c) => {
                                const at = toSvg(c.at);
                                return (
                                    <g key={c.name}>
                                        <circle cx={at.x} cy={at.y} r={4} fill="#38bdf8" />
                                        <text
                                            x={at.x + 8}
                                            y={at.y - 8}
                                            fill="#e2e8f0"
                                            fontSize={12}
                                            fontFamily="var(--font-geist-mono), monospace"
                                        >
                                            {c.name}
                                        </text>
                                    </g>
                                );
                            })}
                        </g>
                    )}
                </svg>
            }
            controls={
                <Toggle
                    label="Show centreline and crossings"
                    checked={showCentreline}
                    onChange={setShowCentreline}
                />
            }
        />
    );
}

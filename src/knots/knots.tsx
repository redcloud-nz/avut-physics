"use client";

import { useState } from "react";

import { Toggle, VisualisationLayout } from "@/components/diagram/controls";

import { FIGURE_EIGHT } from "./figure-eight";
import { RopeDrawing } from "./rope-drawing";
import { centreline, crossings } from "./rope-path";

/** Room round the knot (rope diameters). */
const MARGIN = 1.5;

const POINTS = centreline(FIGURE_EIGHT).points;
const CROSSINGS = crossings(FIGURE_EIGHT);

/** A figure-8 knot, tied but loose. */
export default function Knots() {
    const [showCentreline, setShowCentreline] = useState(false);

    const xs = POINTS.map((p) => p.x);
    const ys = POINTS.map((p) => p.y);
    const [x0, y0] = [Math.min(...xs) - MARGIN, Math.min(...ys) - MARGIN];
    const [w, h] = [Math.max(...xs) + MARGIN - x0, Math.max(...ys) + MARGIN - y0];

    return (
        <VisualisationLayout
            diagram={
                <svg
                    viewBox={`${x0} ${y0} ${w} ${h}`}
                    className="mx-auto block h-auto max-h-[70vh] w-full max-w-xl"
                >
                    <RopeDrawing path={FIGURE_EIGHT} />
                    {showCentreline && (
                        <g>
                            <polyline
                                points={POINTS.map((p) => `${p.x},${p.y}`).join(" ")}
                                fill="none"
                                stroke="#38bdf8"
                                strokeWidth={0.06}
                            />
                            {CROSSINGS.map((c, i) => (
                                <circle
                                    key={i}
                                    cx={c.at.x}
                                    cy={c.at.y}
                                    r={0.2}
                                    fill={c.over === null ? "#ef4444" : "#38bdf8"}
                                />
                            ))}
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

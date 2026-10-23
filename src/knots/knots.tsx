"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Toggle, VisualisationLayout } from "@/components/diagram/controls";
import { Button } from "@/components/ui/button";

import { FIGURE_EIGHT_TYING } from "./figure-eight-tying";
import { RopeDrawing } from "./rope-drawing";
import { centreline, crossings } from "./rope-path";

/** Room round the knot (rope diameters). */
const MARGIN = 1.5;

const STEPS = FIGURE_EIGHT_TYING.map((step) => ({
    ...step,
    points: centreline(step.path).points,
    crossings: crossings(step.path),
}));

/** The same view for every step: room for all of them. */
const ALL = STEPS.flatMap((step) => step.points);
const [X0, Y0] = [
    Math.min(...ALL.map((p) => p.x)) - MARGIN,
    Math.min(...ALL.map((p) => p.y)) - MARGIN,
];
const [W, H] = [
    Math.max(...ALL.map((p) => p.x)) + MARGIN - X0,
    Math.max(...ALL.map((p) => p.y)) + MARGIN - Y0,
];

/** Tying a figure-8, a step at a time, ending loose. */
export default function Knots() {
    const [showCentreline, setShowCentreline] = useState(false);
    const [k, setK] = useState(STEPS.length - 1);
    const step = STEPS[k];

    return (
        <VisualisationLayout
            diagram={
                <svg
                    viewBox={`${X0} ${Y0} ${W} ${H}`}
                    className="mx-auto block h-auto max-h-[70vh] w-full max-w-xl"
                >
                    <RopeDrawing path={step.path} />
                    {showCentreline && (
                        <g>
                            <polyline
                                points={step.points.map((p) => `${p.x},${p.y}`).join(" ")}
                                fill="none"
                                stroke="#38bdf8"
                                strokeWidth={0.06}
                            />
                            {step.crossings.map((c, i) => (
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
                <>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setK(k - 1)}
                            disabled={k === 0}
                            aria-label="Previous step"
                        >
                            <ChevronLeft />
                        </Button>
                        <span className="flex-1 text-center text-sm text-slate-300">
                            Step {k + 1} of {STEPS.length}
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setK(k + 1)}
                            disabled={k === STEPS.length - 1}
                            aria-label="Next step"
                        >
                            <ChevronRight />
                        </Button>
                    </div>
                    <p className="min-h-[3lh] text-sm text-slate-300">{step.caption}</p>
                    <Toggle
                        label="Show centreline and crossings"
                        checked={showCentreline}
                        onChange={setShowCentreline}
                    />
                </>
            }
        />
    );
}

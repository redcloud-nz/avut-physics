"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { VisualisationLayout } from "@/components/diagram/controls";
import { Button } from "@/components/ui/button";

import { FIGURE_EIGHT_TYING, tyingView } from "./figure-eight-tying";
import { RopeDrawing } from "./rope-drawing";
import { centreline } from "./rope-path";
import { TyingArrow } from "./tying-arrow";

const STEPS = FIGURE_EIGHT_TYING.map((step) => ({
    ...step,
    points: centreline(step.path).points,
}));

const {
    x: X0,
    y: Y0,
    w: W,
    h: H,
} = tyingView(STEPS.flatMap((step) => [step.points, ...step.arrows.map((arrow) => arrow.points)]));

/** Tying a figure-8, a step at a time, ending loose, with arrows where a step shows the next move. */
export default function Knots() {
    const [k, setK] = useState(STEPS.length - 1);
    const step = STEPS[k];

    return (
        <VisualisationLayout
            diagram={
                <svg
                    viewBox={`${X0} ${Y0} ${W} ${H}`}
                    className="mx-auto block h-auto max-h-[70vh] w-full max-w-xl"
                >
                    {/* Arrows go behind the rope unless they're marked in front, so one passing through a loop
                        shows going under it. */}
                    {step.arrows.map(
                        (arrow, i) => !arrow.front && <TyingArrow key={i} points={arrow.points} />,
                    )}
                    <RopeDrawing path={step.path} />
                    {step.arrows.map(
                        (arrow, i) => arrow.front && <TyingArrow key={i} points={arrow.points} />,
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
                            {step.label}
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
                </>
            }
        />
    );
}

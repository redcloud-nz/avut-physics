"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { SystemDrawing, T } from "@/articles/pulley-figures";
import { loadPerMetre, pullsOf, type PulleySystem } from "@/articles/pulley-systems";
import { Slider } from "@/components/diagram/controls";
import { teaching } from "@/lib/format";
import { fraction, Layout, Readout, SVG } from "@/visual/frame";

/*
 * Pulley systems drawn upright, for the pages on pulleys: hauled with a slider, or worked through with the T method
 * one step at a time.
 */

/** A pulley system standing upright, with a slider for rope pulled in. */
export function Haul(props: {
    sys: PulleySystem;
    max: number;
    sling?: (id: string) => boolean;
    /** How much to stretch the drawing along the ropes. */
    stretch?: number;
}) {
    const [pulled, setPulled] = useState(0);
    const advantage = pullsOf(props.sys).advantage;
    return (
        <Layout
            drawing={
                <SystemDrawing
                    sys={props.sys}
                    pulled={pulled}
                    upright
                    haulLabel="Pull"
                    stretch={props.stretch}
                    className={SVG}
                    labels={{
                        part: (_, t) => fraction(t / advantage),
                        sling: (id, pull) =>
                            (props.sling?.(id) ?? true) ? fraction(pull / advantage) : null,
                    }}
                />
            }
            slider={
                <Slider
                    label="Rope pulled in"
                    value={pulled}
                    min={0}
                    max={props.max}
                    step={0.1}
                    unit="m"
                    digits={1}
                    onChange={setPulled}
                />
            }
            readouts={
                <>
                    <Readout
                        label="you pull, of the load"
                        value={fraction(1 / advantage)}
                        color={COLORS.pull}
                    />
                    <Readout
                        label="load has moved"
                        value={teaching.length(pulled * loadPerMetre(props.sys))}
                        color={COLORS.load}
                    />
                </>
            }
        />
    );
}

/** The T method, one step at a time; each step's labels in amber as they appear. */
export function TSteps(props: { sys: PulleySystem; steps: { text: string; show: string[] }[] }) {
    const [step, setStep] = useState(1);
    const shown = new Set(props.steps.slice(0, step).flatMap((s) => s.show));
    const latest = new Set(props.steps[step - 1].show);
    const label = (key: string, t: number) => (shown.has(key) ? <T t={t} /> : null);
    return (
        <Layout
            drawing={
                <SystemDrawing
                    sys={props.sys}
                    pulled={0}
                    upright
                    haulLabel="Pull"
                    className={SVG}
                    labels={{
                        part: label,
                        sling: label,
                        color: (key) => (latest.has(key) ? COLORS.load : COLORS.pull),
                    }}
                />
            }
            slider={<Stepper step={step} steps={props.steps.length} onChange={setStep} />}
            readouts={
                <p className="min-h-12 flex-1 text-center text-sm text-ink">
                    {props.steps[step - 1].text}
                </p>
            }
        />
    );
}

/** Buttons to go back and forward a step, with a dot for each step between them. */
function Stepper(props: { step: number; steps: number; onChange: (step: number) => void }) {
    const button =
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-ink-strong hover:bg-line-faint disabled:opacity-30 disabled:hover:bg-surface-raised";
    return (
        <div className="flex items-center gap-3">
            <button
                className={button}
                onClick={() => props.onChange(props.step - 1)}
                disabled={props.step <= 1}
                aria-label="Previous step"
            >
                <ChevronLeft className="size-6" aria-hidden />
            </button>
            <div className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-sm text-ink-soft" aria-live="polite">
                    Step {props.step} of {props.steps}
                </span>
                <div className="flex gap-1.5" aria-hidden>
                    {Array.from({ length: props.steps }, (_, i) => (
                        <button
                            key={i}
                            tabIndex={-1}
                            onClick={() => props.onChange(i + 1)}
                            className={`size-2 rounded-full ${i < props.step ? "bg-step" : "bg-line-faint"}`}
                        />
                    ))}
                </div>
            </div>
            <button
                className={button}
                onClick={() => props.onChange(props.step + 1)}
                disabled={props.step >= props.steps}
                aria-label="Next step"
            >
                <ChevronRight className="size-6" aria-hidden />
            </button>
        </div>
    );
}

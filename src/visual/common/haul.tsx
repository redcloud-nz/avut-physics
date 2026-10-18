import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { SystemDrawing, T } from "@/articles/pulley-figures";
import { loadPerMetre, pullsOf, type PulleySystem } from "@/articles/pulley-systems";
import { Slider } from "@/components/diagram/controls";
import { Layout, LOAD_KG, Readout, SVG } from "@/visual/frame";

/*
 * Pulley systems drawn upright, for the pages on pulleys: hauled with a slider, or worked through with the T method
 * one step at a time.
 */

/** A pulley system standing upright, with a slider for rope pulled in. */
export function Haul(props: { sys: PulleySystem; max: number; sling?: (id: string) => boolean }) {
    const [pulled, setPulled] = useState(0);
    const advantage = pullsOf(props.sys).advantage;
    const kg = (share: number) => `${Math.round(share * LOAD_KG)} kg`;
    return (
        <Layout
            drawing={
                <SystemDrawing
                    sys={props.sys}
                    pulled={pulled}
                    upright
                    className={SVG}
                    labels={{
                        part: (_, t) => kg(t / advantage),
                        sling: (id, pull) =>
                            (props.sling?.(id) ?? true) ? kg(pull / advantage) : null,
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
                        label={`team pulls, for ${LOAD_KG} kg`}
                        value={kg(1 / advantage)}
                        color={COLORS.pull}
                    />
                    <Readout
                        label="load has moved"
                        value={`${(pulled * loadPerMetre(props.sys)).toFixed(1)} m`}
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
                    className={SVG}
                    labels={{
                        part: label,
                        sling: label,
                        color: (key) => (latest.has(key) ? COLORS.load : COLORS.pull),
                    }}
                />
            }
            slider={
                <Slider
                    label="Step"
                    value={step}
                    min={1}
                    max={props.steps.length}
                    step={1}
                    digits={0}
                    onChange={setStep}
                />
            }
            readouts={
                <p className="min-h-12 flex-1 text-center text-sm text-slate-200">
                    {props.steps[step - 1].text}
                </p>
            }
        />
    );
}

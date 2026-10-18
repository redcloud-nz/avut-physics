"use client";

import { useState } from "react";

import { Layout } from "@/visual/frame";

/** One rung of a ladder of units: the unit, what it is in the one below, and something that size. */
type Rung = { unit: string; name: string; is?: string; like: string };

/** Each quantity's units, biggest first, a thousand times apart. */
const LADDERS: { name: string; rungs: Rung[] }[] = [
    {
        name: "Length",
        rungs: [
            { unit: "km", name: "kilometre", is: "1000 m", like: "a walk in to a site" },
            { unit: "m", name: "metre", is: "1000 mm", like: "a stride; ropes come in 50 m" },
            { unit: "mm", name: "millimetre", like: "rope is about 11 mm thick" },
        ],
    },
    {
        name: "Mass",
        rungs: [
            { unit: "t", name: "tonne", is: "1000 kg", like: "a ute is about 2 t" },
            { unit: "kg", name: "kilogram", is: "1000 g", like: "a rescuer is about 80 kg" },
            { unit: "g", name: "gram", like: "a karabiner is about 60 g" },
        ],
    },
    {
        name: "Force",
        rungs: [
            { unit: "kN", name: "kilonewton", is: "1000 N", like: "100 kg weighs about 1 kN" },
            { unit: "N", name: "newton", like: "1 kg weighs about 10 N" },
        ],
    },
];

/** A quantity's units as a ladder, each rung a thousand times the one below. */
export function UnitsFigure() {
    const [chosen, setChosen] = useState(0);
    const { rungs } = LADDERS[chosen];
    return (
        <Layout
            drawing={
                <ol className="flex w-full flex-col items-stretch">
                    {rungs.map((rung, i) => (
                        <li key={rung.unit} className="flex flex-col items-center">
                            {i > 0 && (
                                <span className="py-1 text-xs text-slate-500" aria-hidden>
                                    ↑ × 1000
                                </span>
                            )}
                            <div className="flex w-full items-center gap-3 rounded-lg bg-slate-900/60 px-3 py-2.5">
                                <span className="w-12 shrink-0 text-center text-2xl font-semibold text-sky-300">
                                    {rung.unit}
                                </span>
                                <div className="flex min-w-0 flex-col">
                                    <span className="font-medium text-slate-100">
                                        {rung.name}
                                        {rung.is && (
                                            <span className="font-normal text-slate-400">
                                                {" "}
                                                = {rung.is}
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-sm text-slate-400">{rung.like}</span>
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>
            }
            slider={
                <div className="grid grid-cols-3 gap-1.5">
                    {LADDERS.map((l, i) => (
                        <button
                            key={l.name}
                            type="button"
                            aria-pressed={chosen === i}
                            onClick={() => setChosen(i)}
                            className={`rounded-lg border py-1.5 text-sm ${
                                chosen === i
                                    ? "border-sky-500 bg-sky-500/15 text-slate-100"
                                    : "border-slate-700 text-slate-400"
                            }`}
                        >
                            {l.name}
                        </button>
                    ))}
                </div>
            }
            readouts={null}
        />
    );
}

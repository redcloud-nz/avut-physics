"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { SystemDrawing } from "@/articles/pulley-figures";
import {
    FIVE_TO_ONE,
    partsOnTheLoad,
    pullsOf,
    REDIRECT,
    TWO_TO_ONE,
    TWO_TO_ONE_REDIRECTED,
    Z_RIG,
    type PulleySystem,
} from "@/articles/pulley-systems";
import { Choice, Slider } from "@/components/diagram/controls";
import { Layout, Readout, SVG } from "@/visual/frame";

/** Each system, and how much rope there is to pull in before something reaches a pulley. */
const SYSTEMS: Record<string, { sys: PulleySystem; max: number }> = {
    "1:1": { sys: REDIRECT, max: 2.4 },
    "2:1": { sys: TWO_TO_ONE, max: 6 },
    "2:1 ↓": { sys: TWO_TO_ONE_REDIRECTED, max: 5 },
    "3:1": { sys: Z_RIG, max: 5 },
    "5:1": { sys: FIVE_TO_ONE, max: 5 },
};

/**
 * A simple pulley system with the rope parts that get shorter as the load comes up numbered, as you'd count them.
 * Your hands stay put and the rope runs through them, as the drawing's haul end does.
 */
export function CountingFigure() {
    const [name, setName] = useState("3:1");
    const [pulled, setPulled] = useState(0);
    const { sys, max } = SYSTEMS[name];
    const counted = partsOnTheLoad(sys);
    const advantage = Math.round(pullsOf(sys).advantage);
    return (
        <Layout
            drawing={
                <SystemDrawing
                    sys={sys}
                    pulled={pulled}
                    upright
                    haulLabel="Pull"
                    className={SVG}
                    labels={{
                        part: (key) => {
                            const n = counted.indexOf(key);
                            return n < 0 ? null : <tspan fontSize={18}>{n + 1}</tspan>;
                        },
                        color: () => COLORS.load,
                    }}
                />
            }
            slider={
                <div className="flex flex-col gap-2">
                    <Choice
                        label="System"
                        value={name}
                        options={Object.keys(SYSTEMS).map((value) => ({ value, label: value }))}
                        onChange={(v) => {
                            setName(v);
                            setPulled(0);
                        }}
                    />
                    <Slider
                        label="Rope pulled in"
                        value={pulled}
                        min={0}
                        max={max}
                        step={0.1}
                        unit="m"
                        digits={1}
                        onChange={setPulled}
                    />
                </div>
            }
            readouts={
                <>
                    <Readout
                        label="parts getting shorter"
                        value={counted.length}
                        color={COLORS.load}
                    />
                    <Readout label="advantage" value={`${advantage}:1`} color={COLORS.pull} />
                </>
            }
        />
    );
}

"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { SystemDrawing, T } from "@/articles/pulley-figures";
import {
    COMPLEX_FIVE_TO_ONE,
    FIVE_TO_ONE,
    FIVE_TO_ONE_DOUBLES,
    loadPerMetre,
    NINE_TO_ONE,
    pullsOf,
    SIX_TO_ONE,
    Z_RIG,
    type PulleySystem,
} from "@/articles/pulley-systems";
import { Readout, Select, Slider, VisualisationLayout } from "@/components/diagram/controls";
import { readout } from "@/lib/format";

/*
 * A prototype towards pulley systems people build themselves. For now the systems are fixed, picked from a list; the
 * page tries out drawing them (double pulleys, beckets, compound and complex systems) and how they read with friction.
 */

type Entry = { label: string; sys: PulleySystem; max: number; stretch: number };

const SYSTEMS = {
    "z-rig": { label: "Z-rig, 3:1", sys: Z_RIG, max: 5, stretch: 1 },
    "five-singles": { label: "5:1, four single pulleys", sys: FIVE_TO_ONE, max: 5, stretch: 1.3 },
    "five-doubles": {
        label: "5:1, two double pulleys",
        sys: FIVE_TO_ONE_DOUBLES,
        max: 5,
        stretch: 1.3,
    },
    six: { label: "6:1, a 2:1 on a 3:1", sys: SIX_TO_ONE, max: 3.6, stretch: 1.6 },
    nine: { label: "9:1, a 3:1 on a 3:1", sys: NINE_TO_ONE, max: 4, stretch: 1.6 },
    complex: { label: "Complex 5:1", sys: COMPLEX_FIVE_TO_ONE, max: 2.4, stretch: 1.6 },
} satisfies Record<string, Entry>;

type Key = keyof typeof SYSTEMS;

export default function PulleyLab() {
    const [key, setKey] = useState<Key>("five-doubles");
    const [pulled, setPulled] = useState(0);
    const [efficiency, setEfficiency] = useState(1);
    const entry: Entry = SYSTEMS[key];
    const ideal = pullsOf(entry.sys).advantage;
    const actual = pullsOf(entry.sys, efficiency).advantage;
    const hauled = Math.min(pulled, entry.max);

    return (
        <VisualisationLayout
            diagram={
                <div className="flex p-2 lg:h-[calc(100dvh-12rem)] lg:min-h-105">
                    <SystemDrawing
                        key={key}
                        sys={entry.sys}
                        pulled={hauled}
                        efficiency={efficiency}
                        upright
                        haulLabel="Pull"
                        stretch={entry.stretch}
                        className="h-auto w-full text-ink-muted lg:h-full"
                        labels={{
                            part: (_, t) => <T t={t} />,
                            sling: (_, pull) => <T t={pull} />,
                        }}
                    />
                </div>
            }
            controls={
                <>
                    <Select
                        label="System"
                        value={key}
                        groups={[
                            {
                                options: (Object.keys(SYSTEMS) as Key[]).map((k) => ({
                                    value: k,
                                    label: SYSTEMS[k].label,
                                })),
                            },
                        ]}
                        onChange={(k) => {
                            setKey(k);
                            setPulled(0);
                        }}
                    />
                    <Slider
                        label="Rope pulled in"
                        value={hauled}
                        min={0}
                        max={entry.max}
                        step={0.1}
                        unit="m"
                        digits={1}
                        onChange={setPulled}
                    />
                    <Slider
                        label="Pulley efficiency"
                        value={efficiency * 100}
                        min={50}
                        max={100}
                        step={1}
                        unit="%"
                        digits={0}
                        onChange={(v) => setEfficiency(v / 100)}
                    />
                </>
            }
            readouts={
                <>
                    <Readout label="Ideal advantage" value={readout.ratio(ideal)} />
                    <Readout
                        label="With friction"
                        value={readout.ratio(actual)}
                        color={COLORS.pull}
                    />
                    <Readout
                        label="Load has moved"
                        value={readout.length(hauled * loadPerMetre(entry.sys))}
                        color={COLORS.load}
                    />
                </>
            }
        />
    );
}

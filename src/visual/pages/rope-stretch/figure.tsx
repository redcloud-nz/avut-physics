"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Slider } from "@/components/diagram/controls";
import { FallDrawing } from "@/visual/common/fall";
import { ropeCatch } from "@/visual/common/mechanics";
import { kN, Layout, Readout } from "@/visual/frame";

/** A 100 kg load, weighing 1 kN, on 2 m of rope. */
const WEIGHT = 1;
const LENGTH = 2;

/**
 * A load falls onto a rope that stretches as it catches, with the fall and the rope's elongation on sliders. The
 * elongation is as rope makers give it for static rope: how much longer the rope gets, as a share of its length, as
 * the load on it goes from 50 kg to 150 kg. That's 1 kN more, so it's the stretch for each kilonewton.
 */
export function RopeStretchFigure() {
    const [fall, setFall] = useState(1);
    const [stretch, setStretch] = useState(3);
    const { force, stretched } = ropeCatch(WEIGHT, fall, LENGTH, stretch / 100);
    return (
        <Layout
            drawing={
                <FallDrawing
                    start={LENGTH - fall}
                    fall={fall}
                    stop={stretched}
                    force={force}
                    stopName="stretch"
                />
            }
            slider={
                <div className="flex flex-col gap-2">
                    <Slider
                        label="Fall before 2 m of rope comes tight"
                        value={fall}
                        min={0}
                        max={2}
                        step={0.1}
                        unit="m"
                        digits={1}
                        onChange={setFall}
                    />
                    <Slider
                        label="Elongation, 50 to 150 kg"
                        value={stretch}
                        min={1}
                        max={10}
                        step={0.5}
                        unit="%"
                        digits={1}
                        onChange={setStretch}
                    />
                </div>
            }
            readouts={
                <>
                    <Readout label="rope stretches" value={`${Math.round(stretched * 100)} cm`} />
                    <Readout
                        label={
                            force > 6
                                ? "rope pulls, on 100 kg: enough to injure"
                                : "rope pulls, on 100 kg"
                        }
                        value={kN(Math.round(force * 10) / 10)}
                        color={force > 6 ? "var(--overload)" : COLORS.pull}
                    />
                </>
            }
        />
    );
}

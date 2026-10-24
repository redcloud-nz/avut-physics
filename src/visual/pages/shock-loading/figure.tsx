"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Slider } from "@/components/diagram/controls";
import { FallDrawing } from "@/visual/common/fall";
import { fallSpeed, stoppingForce } from "@/visual/common/mechanics";
import { kN, Layout, Readout } from "@/visual/frame";

/** A 100 kg load, weighing 1 kN. */
const WEIGHT = 1;
/** Where the load starts, below the anchor. */
const START = 0.3;

/** A load falls, then stops over a distance, with both on sliders. */
export function ShockLoadingFigure() {
    const [fall, setFall] = useState(1);
    const [stop, setStop] = useState(20);
    const d = stop / 100;
    const force = stoppingForce(WEIGHT, fall, d);
    return (
        <Layout
            drawing={
                <FallDrawing start={START} fall={fall} stop={d} force={force} stopName="stop" />
            }
            slider={
                <div className="flex flex-col gap-2">
                    <Slider
                        label="Fall"
                        value={fall}
                        min={0}
                        max={2.5}
                        step={0.1}
                        unit="m"
                        digits={1}
                        onChange={setFall}
                    />
                    <Slider
                        label="Distance to stop"
                        value={stop}
                        min={5}
                        max={100}
                        step={5}
                        unit="cm"
                        digits={0}
                        onChange={setStop}
                    />
                </div>
            }
            readouts={
                <>
                    <Readout
                        label="speed when the stop starts"
                        value={`${fallSpeed(fall).toFixed(1)} m/s`}
                    />
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

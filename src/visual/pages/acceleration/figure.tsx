"use client";

import { useState } from "react";

import { Slider } from "@/components/diagram/controls";
import { Track, VELOCITY } from "@/visual/common/track";
import { Layout, Readout } from "@/visual/frame";

/** A box speeding up from rest by 2 m/s every second. */
export function AccelerationFigure() {
    const [time, setTime] = useState(3);
    const accel = 2;
    return (
        <Layout
            drawing={
                <Track
                    time={time}
                    length={25}
                    position={(t) => 0.5 * accel * t * t}
                    velocity={(t) => accel * t}
                    arrow={5}
                    label="A box speeding up along a measured track"
                />
            }
            slider={
                <Slider
                    label="Time"
                    value={time}
                    min={0}
                    max={5}
                    step={0.1}
                    unit="s"
                    onChange={setTime}
                />
            }
            readouts={
                <>
                    <Readout label="gone" value={`${(0.5 * accel * time * time).toFixed(1)} m`} />
                    <Readout
                        label="velocity"
                        value={`${(accel * time).toFixed(1)} m/s`}
                        color={VELOCITY}
                    />
                </>
            }
        />
    );
}

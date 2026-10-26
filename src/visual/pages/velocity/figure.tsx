"use client";

import { useState } from "react";

import { Slider } from "@/components/diagram/controls";
import { teaching } from "@/lib/format";
import { Track, VELOCITY } from "@/visual/common/track";
import { Layout, Readout } from "@/visual/frame";

/** A box moving along the ground at a steady 2 m/s. */
export function VelocityFigure() {
    const [time, setTime] = useState(4);
    const speed = 2;
    return (
        <Layout
            drawing={
                <Track
                    time={time}
                    length={20}
                    position={(t) => speed * t}
                    velocity={() => speed}
                    arrow={20}
                    label="A box moving along a measured track at a steady speed"
                />
            }
            slider={
                <Slider
                    label="Time"
                    value={time}
                    min={0}
                    max={10}
                    step={0.1}
                    unit="s"
                    onChange={setTime}
                />
            }
            readouts={
                <>
                    <Readout label="gone" value={teaching.length(speed * time)} />
                    <Readout label="velocity" value={`${speed} m/s`} color={VELOCITY} />
                </>
            }
        />
    );
}

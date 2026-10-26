"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Slider } from "@/components/diagram/controls";
import { teaching } from "@/lib/format";
import { rad } from "@/lib/math";
import { slopeParts } from "@/visual/common/mechanics";
import { SlopeDrawing } from "@/visual/common/slope";
import { Layout, Readout } from "@/visual/frame";

/** A load on a slope, held by a rope up it, with the slope's angle on the slider. */
export function InclinesFigure() {
    const [angle, setAngle] = useState(30);
    const { along, into } = slopeParts(rad(angle));
    return (
        <Layout
            drawing={<SlopeDrawing angle={rad(angle)} pull={along} />}
            slider={
                <Slider
                    label="Slope"
                    value={angle}
                    min={0}
                    max={90}
                    step={1}
                    unit="°"
                    digits={0}
                    onChange={setAngle}
                />
            }
            readouts={
                <>
                    <Readout
                        label="rope holds"
                        value={teaching.percent(along)}
                        color={COLORS.pull}
                    />
                    <Readout
                        label="presses into ground"
                        value={teaching.percent(into)}
                        color={COLORS.redirect}
                    />
                </>
            }
        />
    );
}

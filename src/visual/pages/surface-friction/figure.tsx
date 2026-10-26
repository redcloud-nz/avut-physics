"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Slider } from "@/components/diagram/controls";
import { teaching } from "@/lib/format";
import { rad } from "@/lib/math";
import { slopeParts, slopePull } from "@/visual/common/mechanics";
import { FRICTION, SlopeDrawing } from "@/visual/common/slope";
import { Layout, Readout } from "@/visual/frame";

/** A load hauled up a slope, the surface's grip against it, with the slope and the grip on sliders. */
export function SurfaceFrictionFigure() {
    const [angle, setAngle] = useState(30);
    const [grip, setGrip] = useState(0.4);
    const a = rad(angle);
    const hauling = slopePull(a, grip, true);
    const lowering = slopePull(a, grip, false);
    return (
        <Layout
            drawing={<SlopeDrawing angle={a} pull={hauling} friction={grip * slopeParts(a).into} />}
            slider={
                <div className="flex flex-col gap-2">
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
                    <Slider
                        label="Grip, of how hard it presses in"
                        value={grip * 100}
                        min={0}
                        max={100}
                        step={5}
                        unit="%"
                        digits={0}
                        onChange={(v) => setGrip(v / 100)}
                    />
                </div>
            }
            readouts={
                <>
                    <Readout
                        label="to haul it up"
                        value={teaching.percent(hauling)}
                        color={COLORS.pull}
                    />
                    <Readout
                        label="to lower it"
                        value={lowering > 0 ? teaching.percent(lowering) : "holds itself"}
                        color={FRICTION}
                    />
                </>
            }
        />
    );
}

"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { SystemDrawing, T } from "@/articles/pulley-figures";
import { pullsOf, Z_RIG } from "@/articles/pulley-systems";
import { Slider } from "@/components/diagram/controls";
import { kN, Layout, LOAD_KN, Readout, SVG } from "@/visual/frame";

export function FrictionFigure() {
    const [efficiency, setEfficiency] = useState(90);
    const e = efficiency / 100;
    const advantage = pullsOf(Z_RIG, e).advantage;
    return (
        <Layout
            drawing={
                <SystemDrawing
                    sys={Z_RIG}
                    pulled={0}
                    efficiency={e}
                    upright
                    haulLabel="Pull"
                    className={SVG}
                    labels={{ part: (_, t) => <T t={t} />, sling: (_, t) => <T t={t} /> }}
                />
            }
            slider={
                <Slider
                    label="Pulley efficiency"
                    value={efficiency}
                    min={40}
                    max={100}
                    step={1}
                    unit="%"
                    digits={0}
                    onChange={setEfficiency}
                />
            }
            readouts={
                <>
                    <Readout
                        label="advantage"
                        value={`${advantage.toFixed(1)}:1`}
                        color={COLORS.load}
                    />
                    <Readout
                        label={`you pull, for a ${LOAD_KN} kN load`}
                        value={kN(LOAD_KN / advantage)}
                        color={COLORS.pull}
                    />
                </>
            }
        />
    );
}

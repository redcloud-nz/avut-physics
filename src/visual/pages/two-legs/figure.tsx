"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { legShare } from "@/articles/gentle-introduction";
import { Anchor, Rock, Rope } from "@/articles/gentle-introduction-figures";
import { Slider } from "@/components/diagram/controls";
import { AngleArc, Arrow } from "@/components/diagram/svg";
import { rad } from "@/lib/math";
import { vec2 } from "@/lib/vector2";
import { Layout, LOAD_KG, percent, Readout, SVG } from "@/visual/frame";

/** Two legs from two anchors to a master point, with the angle between them on the slider. */
export function TwoLegsFigure() {
    const [angle, setAngle] = useState(60);
    const share = legShare(rad(angle));
    const LEG = 140;
    const W = 64;
    const top = 40;
    const half = rad(angle / 2);
    const master = vec2(150, top + LEG * Math.cos(half));
    const anchors = [-1, 1].map((s) => vec2(150 + s * LEG * Math.sin(half), top));
    const over = share > 1.0001;
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 0 300 260"
                    className={SVG}
                    fontSize={16}
                    role="img"
                    aria-label="Two anchor legs sharing a load"
                >
                    <Rock y={top} width={300} />
                    {anchors.map((a, i) => (
                        <g key={i}>
                            <Rope from={a} to={master} />
                            <Anchor at={a} />
                            <Arrow
                                from={a}
                                v={master
                                    .sub(a)
                                    .unit()
                                    .scale(share * W)}
                                color={COLORS.pull}
                            />
                        </g>
                    ))}
                    {angle > 0 && (
                        <AngleArc
                            center={master}
                            radius={Math.min(24, (master.y - top) * 0.6)}
                            startDeg={-90 - angle / 2}
                            sweepDeg={angle}
                        />
                    )}
                    <Arrow from={master} v={vec2(0, W)} color={COLORS.load} />
                    <circle cx={master.x} cy={master.y} r={4} fill="currentColor" />
                </svg>
            }
            slider={
                <Slider
                    label="Angle between the legs"
                    value={angle}
                    min={0}
                    max={160}
                    step={1}
                    unit="°"
                    digits={0}
                    onChange={setAngle}
                />
            }
            readouts={
                <>
                    <Readout
                        label="each leg holds, of the load"
                        value={percent(share)}
                        color={over ? "#fda4af" : COLORS.pull}
                    />
                    <Readout
                        label={`each leg, on a ${LOAD_KG} kg load`}
                        value={`${Math.round(share * LOAD_KG)} kg`}
                    />
                </>
            }
        />
    );
}

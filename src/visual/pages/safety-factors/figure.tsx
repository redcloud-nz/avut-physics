"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Slider } from "@/components/diagram/controls";
import { vec2 } from "@/lib/vector2";
import { kN, Layout, Note, Readout, SVG } from "@/visual/frame";

/** What the gear is rated to hold, in kilonewtons: a basic karabiner, which only just clears ten times a two-person load. */
const RATED = 22;
/** The safety factor rescue systems commonly aim for. */
const FACTOR = 10;

const LEFT = 20;
const PER_KN = 7;
const MAX = 40;

/** A load against gear rated at 22 kN, and the ten-to-one the system should aim for, with the load on the slider. */
export function SafetyFactorsFigure() {
    const [load, setLoad] = useState(2);
    const factor = RATED / load;
    const bars = [
        { name: "load", value: load, color: COLORS.load, y: 60 },
        { name: `${FACTOR} × load`, value: FACTOR * load, color: COLORS.redirect, y: 130 },
        { name: "gear rated", value: RATED, color: "#cbd5e1", y: 200 },
    ];
    const ticks = [0, 10, 20, 30, 40];
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 20 320 256"
                    className={SVG}
                    fontSize={15}
                    role="img"
                    aria-label={`A load of ${load} kN, ten times it, ${FACTOR * load} kN, and gear rated at ${RATED} kN, as bars.`}
                >
                    {ticks.map((t) => (
                        <g key={t}>
                            <line
                                x1={LEFT + t * PER_KN}
                                y1={40}
                                x2={LEFT + t * PER_KN}
                                y2={232}
                                stroke="#64748b"
                                strokeDasharray="2 4"
                            />
                            <Note at={vec2(LEFT + t * PER_KN, 246)}>{`${t}`}</Note>
                        </g>
                    ))}
                    {bars.map((b) => (
                        <g key={b.name}>
                            <rect
                                x={LEFT}
                                y={b.y}
                                width={Math.min(b.value, MAX) * PER_KN}
                                height={26}
                                rx={3}
                                fill={b.color}
                                opacity={0.85}
                            />
                            <Note at={vec2(LEFT, b.y - 10)} anchor="start">
                                {`${b.name}: ${kN(b.value)}`}
                            </Note>
                        </g>
                    ))}
                    <Note at={vec2(LEFT + 20 * PER_KN, 264)}>kN</Note>
                </svg>
            }
            slider={
                <Slider
                    label="Load"
                    value={load}
                    min={0.5}
                    max={4}
                    step={0.1}
                    unit="kN"
                    digits={1}
                    onChange={setLoad}
                />
            }
            readouts={
                <>
                    <Readout
                        label="safety factor"
                        value={`${factor < 10 ? factor.toFixed(1) : Math.round(factor)}:1`}
                        color={factor < FACTOR ? "#fda4af" : COLORS.pull}
                    />
                    <Readout
                        label="mass, at 10 N/kg"
                        value={`${Math.round(load * 100)} kg`}
                        color={COLORS.load}
                    />
                </>
            }
        />
    );
}

"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Tag } from "@/articles/gentle-introduction-figures";
import { Slider } from "@/components/diagram/controls";
import { Arrow } from "@/components/diagram/svg";
import { vec2 } from "@/lib/vector2";
import { GHOST, Layout, Note, Readout, SVG } from "@/visual/frame";

/** A 100 kg load on smooth ice, pushed, with where it will be after each second. */
export function ForceFigure() {
    const [force, setForce] = useState(100);
    const mass = 100;
    const accel = force / mass;
    const ice = 110;
    const side = 30;
    const start = 105;
    const PX = 20;
    const at = (t: number) => start + 0.5 * accel * t * t * PX;
    let lastLabel = -Infinity;
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 0 320 150"
                    className={SVG}
                    fontSize={14}
                    role="img"
                    aria-label="A load pushed across ice, speeding up"
                >
                    <rect x={0} y={ice} width={320} height={10} fill="var(--ice)" opacity={0.25} />
                    <line x1={0} y1={ice} x2={320} y2={ice} stroke="var(--ice)" />
                    {[1, 2, 3].map((t) => {
                        const x = at(t);
                        const label = x - lastLabel >= 24;
                        if (label) lastLabel = x;
                        return (
                            <g key={t}>
                                <rect
                                    x={x - side / 2}
                                    y={ice - side}
                                    width={side}
                                    height={side}
                                    fill="none"
                                    stroke={GHOST}
                                    strokeDasharray="3 3"
                                />
                                {label && <Note at={vec2(x, ice + 22)}>{t} s</Note>}
                            </g>
                        );
                    })}
                    <rect
                        x={start - side / 2}
                        y={ice - side}
                        width={side}
                        height={side}
                        rx={3}
                        fill="currentColor"
                    />
                    <Arrow
                        from={vec2(start - side / 2 - force * 0.4, ice - side / 2)}
                        v={vec2(force * 0.4, 0)}
                        color={COLORS.pull}
                        width={3}
                    />
                    {force > 0 && (
                        <Tag
                            at={vec2(start - side / 2 - Math.max(force * 0.2, 20), ice - side - 14)}
                            color={COLORS.pull}
                        >
                            {force} N
                        </Tag>
                    )}
                </svg>
            }
            slider={
                <Slider
                    label="Push"
                    value={force}
                    min={0}
                    max={200}
                    step={10}
                    unit="N"
                    digits={0}
                    onChange={setForce}
                />
            }
            readouts={
                <>
                    <Readout label="push" value={`${force} N`} color={COLORS.pull} />
                    <Readout label="faster every second" value={`${accel.toFixed(1)} m/s`} />
                </>
            }
        />
    );
}

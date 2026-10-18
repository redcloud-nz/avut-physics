"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Anchor, Rock, Rope, Tag } from "@/articles/gentle-introduction-figures";
import { Slider } from "@/components/diagram/controls";
import { Arrow } from "@/components/diagram/svg";
import { vec2 } from "@/lib/vector2";
import { Layout, Readout, SVG } from "@/visual/frame";

/** Gravity, rounded to 10 m/s² as on the page. */
const g = 10;

/** A load hanging on a rope, its weight drawn to scale. */
export function WeightFigure() {
    const [mass, setMass] = useState(100);
    const side = 18 + Math.sqrt(mass) * 3;
    const top = 40;
    const box = vec2(150, 110);
    const arrow = mass * 0.55;
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 0 300 330"
                    className={SVG}
                    fontSize={16}
                    role="img"
                    aria-label="A load hanging on a rope, with its weight as an arrow"
                >
                    <Rock y={top} width={300} />
                    <Rope from={vec2(box.x, top)} to={box} />
                    <Anchor at={vec2(box.x, top)} />
                    <rect
                        x={box.x - side / 2}
                        y={box.y}
                        width={side}
                        height={side}
                        rx={3}
                        fill="currentColor"
                    />
                    <Arrow
                        from={box.add(vec2(0, side / 2))}
                        v={vec2(0, side / 2 + arrow)}
                        color={COLORS.load}
                    />
                    <Tag
                        at={box.add(vec2(side / 2 + 10, side / 2 + arrow / 2 + 10))}
                        color={COLORS.load}
                        anchor="start"
                    >
                        Weight
                    </Tag>
                </svg>
            }
            slider={
                <Slider
                    label="Mass"
                    value={mass}
                    min={10}
                    max={300}
                    step={5}
                    unit="kg"
                    digits={0}
                    onChange={setMass}
                />
            }
            readouts={
                <>
                    <Readout label="mass" value={`${mass} kg`} />
                    <Readout label="weight" value={`${mass * g} N`} color={COLORS.load} />
                </>
            }
        />
    );
}

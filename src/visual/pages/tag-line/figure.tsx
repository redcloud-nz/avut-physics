"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Anchor, Rock, Rope, Tag } from "@/articles/gentle-introduction-figures";
import { Slider } from "@/components/diagram/controls";
import { AngleArc, Arrow } from "@/components/diagram/svg";
import { rad } from "@/lib/math";
import { vec2 } from "@/lib/vector2";
import { Layout, percent, Readout, SVG } from "@/visual/frame";

/** A load on a rope, pulled sideways by a level tag line until the rope leans. */
export function TagLineFigure() {
    const [lean, setLean] = useState(30);
    const a = rad(lean);
    const W = 56;
    const anchor = vec2(80, 40);
    const load = anchor.add(vec2(Math.sin(a), Math.cos(a)).scale(150));
    const rope = 1 / Math.cos(a);
    const tag = Math.tan(a);
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 0 320 300"
                    className={SVG}
                    fontSize={16}
                    role="img"
                    aria-label="A load on a rope pulled sideways by a tag line"
                >
                    <Rock y={40} width={320} />
                    <Rope from={anchor} to={load} />
                    <Rope from={load} to={vec2(load.x + 90, load.y)} dashed />
                    <Anchor at={anchor} />
                    <rect x={load.x - 12} y={load.y} width={24} height={24} fill="currentColor" />
                    <Arrow from={load.add(vec2(0, 12))} v={vec2(0, W)} color={COLORS.load} />
                    <Arrow
                        from={load}
                        v={anchor
                            .sub(load)
                            .unit()
                            .scale(W * rope)}
                        color={COLORS.pull}
                    />
                    <Arrow
                        from={load.add(vec2(12, 12))}
                        v={vec2(W * tag, 0)}
                        color={COLORS.sideways}
                    />
                    <Tag at={load.add(vec2(-10, 12 + W))} color={COLORS.load} anchor="end">
                        Weight
                    </Tag>
                    {lean > 0 && (
                        <AngleArc
                            center={anchor}
                            radius={34}
                            startDeg={90 - lean}
                            sweepDeg={lean}
                        />
                    )}
                </svg>
            }
            slider={
                <Slider
                    label="Tag line pulls the rope over"
                    value={lean}
                    min={0}
                    max={60}
                    step={1}
                    unit="°"
                    digits={0}
                    onChange={setLean}
                />
            }
            readouts={
                <>
                    <Readout
                        label="rope, of the load’s weight"
                        value={percent(rope)}
                        color={COLORS.pull}
                    />
                    <Readout label="tag line" value={percent(tag)} color={COLORS.sideways} />
                </>
            }
        />
    );
}

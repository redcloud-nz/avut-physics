"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { preEqualised, swungDown, type TwoAnchors } from "@/articles/gentle-introduction";
import { Anchor, Rock, Rope } from "@/articles/gentle-introduction-figures";
import { Slider } from "@/components/diagram/controls";
import { Arrow } from "@/components/diagram/svg";
import { rad } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";
import { Layout, percent, Readout, SVG } from "@/visual/frame";

/** The article's rig for a main line pulling off to one side: legs 1 m long, 60° apart. */
const RIG: TwoAnchors = { gap: 1, leg: 1 };

/** A pre-equalised anchor with the main line pulled off to the right. */
export function SideLoadFigure() {
    const [swing, setSwing] = useState(20);
    const s = preEqualised(RIG, rad(swing));
    const PER_METRE = 190;
    const W = 64;
    const at = (p: Vector2) => vec2(150 + p.x * PER_METRE, 40 - p.y * PER_METRE);
    const master = at(s.master);
    const d = swungDown(rad(swing));
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 0 300 290"
                    className={SVG}
                    fontSize={16}
                    role="img"
                    aria-label="A pre-equalised anchor with the main line pulled to one side"
                >
                    <Rock y={40} width={300} />
                    {s.anchors.map((a, i) => (
                        <g key={i}>
                            <Rope from={at(a)} to={master} dashed={s.shares[i] === 0} />
                            <Anchor at={at(a)} />
                            {s.shares[i] > 0 && (
                                <Arrow
                                    from={at(a)}
                                    v={master
                                        .sub(at(a))
                                        .unit()
                                        .scale(s.shares[i] * W)}
                                    color={COLORS.pull}
                                />
                            )}
                        </g>
                    ))}
                    <Arrow from={master} v={vec2(d.x, -d.y).scale(W)} color={COLORS.load} />
                    <circle cx={master.x} cy={master.y} r={4} fill="currentColor" />
                </svg>
            }
            slider={
                <Slider
                    label="Main line pulls to the right"
                    value={swing}
                    min={0}
                    max={60}
                    step={1}
                    unit="°"
                    digits={0}
                    onChange={setSwing}
                />
            }
            readouts={
                <>
                    <Readout label="left anchor" value={percent(s.shares[0])} color={COLORS.pull} />
                    <Readout
                        label="right anchor"
                        value={s.shares[1] > 0 ? percent(s.shares[1]) : "slack"}
                        color={COLORS.pull}
                    />
                </>
            }
        />
    );
}

"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Anchor, Rock, Rope } from "@/articles/gentle-introduction-figures";
import { Slider } from "@/components/diagram/controls";
import { AngleArc, Arrow } from "@/components/diagram/svg";
import { deg } from "@/lib/math";
import { vec2 } from "@/lib/vector2";
import { Letter } from "@/visual/common/details";
import { kNText } from "@/visual/common/grid";
import { Layout, Readout, SVG } from "@/visual/frame";

/** The load's weight, in kilonewtons: about 240 kg. */
const WEIGHT = 2.4;
/** Drawing units to the kilonewton. */
const PER_KN = 36;
const ROPE = 140;

/**
 * A load on a rope, pulled sideways by a level tag line. The rope's pull on the load, T, is drawn with its parts tip to
 * tail: its sideways part x holds against the tag line, and its up part y holds up the weight.
 */
export function PullingSidewaysFigure() {
    const [tag, setTag] = useState(1.8);
    const rope = Math.hypot(tag, WEIGHT);
    const lean = Math.atan2(tag, WEIGHT);
    const anchor = vec2(70, 40);
    const load = anchor.add(vec2(Math.sin(lean), Math.cos(lean)).scale(ROPE));
    const corner = load.add(vec2(-tag * PER_KN, 0));
    const tip = corner.add(vec2(0, -WEIGHT * PER_KN));
    const side = 24;
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 25 320 270"
                    className={SVG}
                    fontSize={16}
                    role="img"
                    aria-label="A load on a rope pulled sideways by a tag line, with the rope's pull split into x and y"
                >
                    <Rock y={40} width={320} />
                    <Rope from={anchor} to={load} />
                    <Rope from={load} to={vec2(load.x + 110, load.y)} dashed />
                    <Anchor at={anchor} />
                    {tag > 0 && (
                        <line
                            x1={anchor.x}
                            y1={anchor.y}
                            x2={anchor.x}
                            y2={anchor.y + 46}
                            stroke="currentColor"
                            strokeDasharray="3 3"
                            opacity={0.7}
                        />
                    )}
                    {tag > 0 && (
                        <AngleArc
                            center={anchor}
                            radius={34}
                            startDeg={90 - deg(lean)}
                            sweepDeg={deg(lean)}
                        />
                    )}
                    <rect
                        x={load.x - side / 2}
                        y={load.y}
                        width={side}
                        height={side}
                        fill="currentColor"
                    />
                    <g opacity={0.6}>
                        <Arrow
                            from={load.add(vec2(0, side))}
                            v={vec2(0, WEIGHT * PER_KN)}
                            color={COLORS.load}
                        />
                        {tag > 0.05 && (
                            <Arrow
                                from={load.add(vec2(side / 2, side / 2))}
                                v={vec2(tag * PER_KN, 0)}
                                color={COLORS.sideways}
                            />
                        )}
                    </g>
                    {tag > 0.05 && (
                        <Arrow from={load} v={corner.sub(load)} color={COLORS.sideways} dashed />
                    )}
                    <Arrow from={corner} v={tip.sub(corner)} color={COLORS.redirect} dashed />
                    <Arrow from={load} v={tip.sub(load)} color={COLORS.pull} width={3} />
                    {tag >= 0.4 && (
                        <Letter
                            at={vec2((load.x + corner.x) / 2, load.y + 14)}
                            color={COLORS.sideways}
                        >
                            x
                        </Letter>
                    )}
                    <Letter
                        at={vec2(corner.x - 14, (corner.y + tip.y) / 2)}
                        color={COLORS.redirect}
                    >
                        y
                    </Letter>
                    <Letter
                        at={load.add(tip.sub(load).scale(0.5)).add(vec2(14, 4))}
                        color={COLORS.pull}
                    >
                        T
                    </Letter>
                </svg>
            }
            slider={
                <Slider
                    label="Tag line pulls sideways"
                    value={tag}
                    min={0}
                    max={2.4}
                    step={0.1}
                    unit="kN"
                    digits={1}
                    onChange={setTag}
                />
            }
            readouts={
                <>
                    <Readout label="x, tag line" value={kNText(tag)} color={COLORS.sideways} />
                    <Readout label="y, weight" value={kNText(WEIGHT)} color={COLORS.redirect} />
                    <Readout label="T, rope" value={kNText(rope)} color={COLORS.pull} />
                </>
            }
        />
    );
}

"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { legShare } from "@/articles/gentle-introduction";
import { Anchor, Rock, Rope } from "@/articles/gentle-introduction-figures";
import { Slider } from "@/components/diagram/controls";
import { AngleArc, Arrow } from "@/components/diagram/svg";
import { rad } from "@/lib/math";
import { vec2 } from "@/lib/vector2";
import { Letter } from "@/visual/common/details";
import { Layout, percent, Readout, SVG } from "@/visual/frame";

/** Drawing units for the whole load. */
const W = 110;
const LEG = 170;

/**
 * Two anchors, each with a rope to a master point, and the angle between the ropes on the slider. Each rope's pull
 * on the master point is drawn with its parts tip to tail: an up part of half the load, and a sideways part the
 * other rope's cancels.
 */
export function TwoAnchorsFigure() {
    const [angle, setAngle] = useState(90);
    const share = legShare(rad(angle));
    const top = 40;
    const half = rad(angle / 2);
    const master = vec2(150, top + LEG * Math.cos(half));
    const sideways = share * Math.sin(half);
    const legs = [-1, 1].map((s) => ({
        anchor: vec2(150 + s * LEG * Math.sin(half), top),
        corner: master.add(vec2(s * sideways * W, 0)),
        tip: master.add(vec2(s * sideways * W, -W / 2)),
    }));
    const right = legs[1];
    return (
        <Layout
            drawing={
                <svg
                    viewBox="-10 25 320 300"
                    className={SVG}
                    fontSize={16}
                    role="img"
                    aria-label="Two anchors sharing a load, each rope's pull split into an up part and a sideways part"
                >
                    <g transform="translate(-10 0)">
                        <Rock y={top} width={320} />
                    </g>
                    {legs.map((l, i) => (
                        <g key={i}>
                            <Rope from={l.anchor} to={master} />
                            <Anchor at={l.anchor} />
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
                    {legs.map((l, i) => (
                        <g key={i}>
                            {sideways > 0.02 && (
                                <Arrow
                                    from={master}
                                    v={l.corner.sub(master)}
                                    color={COLORS.sideways}
                                    dashed
                                />
                            )}
                            <Arrow
                                from={l.corner}
                                v={l.tip.sub(l.corner)}
                                color={COLORS.redirect}
                                dashed
                            />
                            <Arrow
                                from={master}
                                v={l.tip.sub(master)}
                                color={COLORS.pull}
                                width={3}
                            />
                        </g>
                    ))}
                    {sideways >= 0.3 && (
                        <Letter
                            at={vec2((master.x + right.corner.x) / 2, master.y + 14)}
                            color={COLORS.sideways}
                        >
                            x
                        </Letter>
                    )}
                    <Letter
                        at={vec2(right.corner.x + 14, (right.corner.y + right.tip.y) / 2)}
                        color={COLORS.redirect}
                    >
                        y
                    </Letter>
                    <Arrow from={master} v={vec2(0, W)} color={COLORS.load} />
                    <circle cx={master.x} cy={master.y} r={4} fill="currentColor" />
                </svg>
            }
            slider={
                <Slider
                    label="Angle between the ropes"
                    value={angle}
                    min={0}
                    max={140}
                    step={1}
                    unit="°"
                    digits={0}
                    onChange={setAngle}
                />
            }
            readouts={
                <>
                    <Readout label="y, each anchor" value="50%" color={COLORS.redirect} />
                    <Readout
                        label="x, each anchor"
                        value={percent(sideways)}
                        color={COLORS.sideways}
                    />
                    <Readout
                        label="each anchor holds"
                        value={percent(share)}
                        color={share > 1.0001 ? "var(--overload)" : COLORS.pull}
                    />
                </>
            }
        />
    );
}

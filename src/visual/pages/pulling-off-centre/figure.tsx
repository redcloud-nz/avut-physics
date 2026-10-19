"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { swungDown, tiedOff } from "@/articles/gentle-introduction";
import { Anchor, Rock, Rope } from "@/articles/gentle-introduction-figures";
import { Slider } from "@/components/diagram/controls";
import { Arrow } from "@/components/diagram/svg";
import { rad } from "@/lib/math";
import { vec2, type Vector2 } from "@/lib/vector2";
import { GHOST, Layout, percent, Readout, SVG } from "@/visual/frame";

import { ANCHORS, DEPTH, OFFSET, SWING } from "./rig";

/** Drawing units to the metre, and for the whole load. */
const PER_M = 110;
const W = 110;
const TOP = 50;

/** From the rig's metres, y up, to the drawing's units, y down. */
const draw = (p: Vector2) => vec2(160 + p.x * PER_M, TOP - p.y * PER_M);

/** A slack rope, sagging a little below the straight line between its ends. */
function Slack(props: { from: Vector2; to: Vector2 }) {
    const mid = props.from.add(props.to).scale(0.5).add(vec2(0, 18));
    return (
        <path
            d={`M ${props.from.x} ${props.from.y} Q ${mid.x} ${mid.y} ${props.to.x} ${props.to.y}`}
            fill="none"
            stroke={GHOST}
            strokeWidth={2}
            strokeDasharray="4 4"
        />
    );
}

/**
 * Two anchors with their ropes tied off at a master point, which a slider moves from side to side. A second slider
 * swings the load's pull off straight down. Each rope's pull on the master point is drawn along it, sized to its
 * share of the load.
 */
export function PullingOffCentreFigure() {
    const [offset, setOffset] = useState(OFFSET);
    const [swing, setSwing] = useState(SWING);
    const tied = vec2(offset, -DEPTH);
    const s = tiedOff(ANCHORS, tied, rad(swing));
    const master = draw(s.master);
    const down = swungDown(rad(swing));
    const pull = vec2(down.x, -down.y);
    return (
        <Layout
            drawing={
                <svg
                    viewBox="20 20 280 280"
                    className={SVG}
                    fontSize={16}
                    role="img"
                    aria-label="Two anchors with ropes to a master point that can sit off centre, and a load pulling on it at an angle; each rope's pull is drawn to scale"
                >
                    <Rock y={TOP} width={320} />
                    {s.anchors.map((a, i) =>
                        s.shares[i] > 0 ? (
                            <Rope key={i} from={draw(a)} to={master} />
                        ) : (
                            <Slack key={i} from={draw(a)} to={master} />
                        ),
                    )}
                    {s.anchors.map((a, i) => (
                        <Anchor key={i} at={draw(a)} />
                    ))}
                    <Rope from={master} to={master.add(pull.scale(150))} />
                    {s.anchors.map(
                        (a, i) =>
                            s.shares[i] > 0 && (
                                <Arrow
                                    key={i}
                                    from={master}
                                    v={draw(a)
                                        .sub(master)
                                        .unit()
                                        .scale(s.shares[i] * W)}
                                    color={COLORS.pull}
                                    width={3}
                                />
                            ),
                    )}
                    <Arrow from={master} v={pull.scale(W)} color={COLORS.load} />
                    <circle cx={master.x} cy={master.y} r={4} fill="currentColor" />
                </svg>
            }
            slider={
                <div className="flex flex-col gap-2">
                    <Slider
                        label="Master point, right of the middle"
                        value={offset}
                        min={-0.8}
                        max={0.8}
                        step={0.05}
                        unit="m"
                        digits={2}
                        onChange={setOffset}
                    />
                    <Slider
                        label="Pull, right of straight down"
                        value={swing}
                        min={-60}
                        max={60}
                        step={1}
                        unit="°"
                        digits={0}
                        onChange={setSwing}
                    />
                </div>
            }
            readouts={
                <>
                    {(["left", "right"] as const).map((side, i) => (
                        <Readout
                            key={side}
                            label={`${side} anchor`}
                            value={percent(s.shares[i])}
                            color={s.shares[i] > 1.0001 ? "var(--overload)" : COLORS.pull}
                        />
                    ))}
                </>
            }
        />
    );
}

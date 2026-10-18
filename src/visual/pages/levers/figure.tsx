"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Slider } from "@/components/diagram/controls";
import { Arrow } from "@/components/diagram/svg";
import { vec2 } from "@/lib/vector2";
import { Letter } from "@/visual/common/details";
import { leverPush } from "@/visual/common/mechanics";
import { kN, Layout, Note, Readout, SVG } from "@/visual/frame";

/** The bar's length in metres, and drawing units to the metre and to the kilonewton. */
const BAR = 2;
const PER_M = 130;
const PER_KN = 60;
const LONGEST = 150;
const LEFT = 30;
const Y = 170;

/** A 2 m bar on a pivot, 100 kg (1 kN) on one end and your push on the other, with the pivot on the slider. */
export function LeversFigure() {
    const [pivot, setPivot] = useState(0.5);
    const a = pivot;
    const b = BAR - pivot;
    const push = leverPush(a, b);
    const x = (m: number) => LEFT + m * PER_M;
    const p = vec2(x(pivot), Y);
    const right = vec2(x(BAR), Y);
    const left = vec2(LEFT, Y);
    const arrow = Math.min(push * PER_KN, LONGEST);
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 20 320 260"
                    className={SVG}
                    fontSize={15}
                    role="img"
                    aria-label={`A lever: a 2 m bar on a pivot ${a.toFixed(2)} m from a 100 kg load, with your push on the far end.`}
                >
                    <line
                        x1={0}
                        y1={Y + 34}
                        x2={320}
                        y2={Y + 34}
                        stroke="currentColor"
                        strokeWidth={1}
                        opacity={0.3}
                    />
                    <polygon
                        points={`${p.x},${Y + 4} ${p.x - 16},${Y + 34} ${p.x + 16},${Y + 34}`}
                        fill="currentColor"
                        opacity={0.6}
                    />
                    <line
                        x1={left.x}
                        y1={Y}
                        x2={right.x}
                        y2={Y}
                        stroke="currentColor"
                        strokeWidth={6}
                        strokeLinecap="round"
                    />
                    <rect x={left.x - 4} y={Y - 33} width={34} height={30} fill="currentColor" />
                    <Arrow
                        from={left.add(vec2(13, -37 - PER_KN))}
                        v={vec2(0, PER_KN)}
                        color={COLORS.load}
                    />
                    <Letter at={left.add(vec2(30, -37 - PER_KN / 2))} color={COLORS.load}>
                        W
                    </Letter>
                    <Arrow
                        from={right.add(vec2(0, -arrow - 4))}
                        v={vec2(0, arrow)}
                        color={COLORS.pull}
                        width={3}
                    />
                    <Letter at={right.add(vec2(-14, -arrow / 2 - 4))} color={COLORS.pull}>
                        F
                    </Letter>
                    {[
                        [left.x, p.x, "a"],
                        [p.x, right.x, "b"],
                    ].map(([from, to, name]) => (
                        <g key={name}>
                            <line
                                x1={Number(from)}
                                y1={Y + 50}
                                x2={Number(to)}
                                y2={Y + 50}
                                stroke="#64748b"
                                strokeWidth={1.5}
                            />
                            <Note at={vec2((Number(from) + Number(to)) / 2, Y + 64)}>
                                {`${name} = ${(name === "a" ? a : b).toFixed(2)} m`}
                            </Note>
                        </g>
                    ))}
                </svg>
            }
            slider={
                <Slider
                    label="Pivot, from the load’s end"
                    value={pivot}
                    min={0.2}
                    max={1.8}
                    step={0.05}
                    unit="m"
                    digits={2}
                    onChange={setPivot}
                />
            }
            readouts={
                <>
                    <Readout label="you push, for 100 kg" value={kN(push)} color={COLORS.pull} />
                    <Readout label="pivot holds" value={kN(1 + push)} />
                </>
            }
        />
    );
}

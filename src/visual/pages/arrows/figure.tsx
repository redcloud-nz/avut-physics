"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { AngleArc, Arrow } from "@/components/diagram/svg";
import { teaching } from "@/lib/format";
import { deg } from "@/lib/math";
import { vec2 } from "@/lib/vector2";
import { DragGrid, dragHint, KN, kn, ORIGIN } from "@/visual/common/grid";
import { Layout, Readout } from "@/visual/frame";

/** One force on a bolt as an arrow: how big, and which way. */
export function ArrowsFigure() {
    const [tips, setTips] = useState([vec2(3, -2).scale(KN).add(ORIGIN)]);
    const f = kn(tips[0]);
    // Anticlockwise from pointing right, all the way round: 0° to 359°.
    const angle = Math.round((deg(f.angle()) + 360) % 360) % 360;
    return (
        <Layout
            drawing={
                <DragGrid
                    tips={tips}
                    onChange={setTips}
                    label="An arrow for a force on a bolt, on a grid of 1 kN squares"
                >
                    <line
                        x1={ORIGIN.x}
                        y1={ORIGIN.y}
                        x2={ORIGIN.x + 60}
                        y2={ORIGIN.y}
                        stroke="currentColor"
                        strokeDasharray="4 3"
                    />
                    {f.len() > 0.2 && angle > 0 && (
                        <AngleArc center={ORIGIN} radius={30} startDeg={0} sweepDeg={-angle} />
                    )}
                    <Arrow from={ORIGIN} v={tips[0].sub(ORIGIN)} color={COLORS.pull} width={3} />
                </DragGrid>
            }
            slider={dragHint()}
            readouts={
                <>
                    <Readout label="how big" value={teaching.kN(f.len())} color={COLORS.pull} />
                    <Readout label="round from pointing right" value={`${angle}°`} />
                </>
            }
        />
    );
}

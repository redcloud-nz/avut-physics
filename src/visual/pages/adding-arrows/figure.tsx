"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Arrow } from "@/components/diagram/svg";
import { vec2 } from "@/lib/vector2";
import { DragGrid, KN, kNText, onGrid, ORIGIN } from "@/visual/common/grid";
import { Layout, Readout } from "@/visual/frame";

const TOGETHER = "#f1f5f9";

/** Two forces on one bolt, and the one force they make together: each drawn again from the other's tip, either order. */
export function AddingFigure() {
    const [tips, setTips] = useState([
        vec2(3, -1).scale(KN).add(ORIGIN),
        vec2(-1, -3).scale(KN).add(ORIGIN),
    ]);
    const [a, b] = tips.map((t) => t.sub(ORIGIN));
    const sum = a.add(b);
    return (
        <Layout
            drawing={
                <DragGrid
                    tips={tips}
                    onChange={setTips}
                    label="Two forces on a bolt, added tip to tail"
                    fits={([p, q]) => onGrid(p.add(q).sub(ORIGIN))}
                >
                    <g opacity={0.7}>
                        <Arrow from={ORIGIN.add(a)} v={b} color={COLORS.redirect} dashed />
                        <Arrow from={ORIGIN.add(b)} v={a} color={COLORS.pull} dashed />
                    </g>
                    <Arrow from={ORIGIN} v={sum} color={TOGETHER} width={3} />
                    <Arrow from={ORIGIN} v={a} color={COLORS.pull} width={3} />
                    <Arrow from={ORIGIN} v={b} color={COLORS.redirect} width={3} />
                </DragGrid>
            }
            slider={<p className="text-center text-sm text-slate-400">Drag either arrow’s tip.</p>}
            readouts={
                <>
                    <Readout label="one" value={kNText(a.len() / KN)} color={COLORS.pull} />
                    <Readout label="other" value={kNText(b.len() / KN)} color={COLORS.redirect} />
                    <Readout label="together" value={kNText(sum.len() / KN)} color={TOGETHER} />
                </>
            }
        />
    );
}

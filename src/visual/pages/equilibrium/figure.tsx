"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Arrow } from "@/components/diagram/svg";
import { vec2 } from "@/lib/vector2";
import { DragGrid, KN, kNText, onGrid, ORIGIN } from "@/visual/common/grid";
import { Layout, Readout } from "@/visual/frame";

/**
 * Three ropes on a ring that stays put: two that can be dragged, and the third that balances them. Tip to
 * tail, the three close up into a triangle back where they started.
 */
export function EquilibriumFigure() {
    const [tips, setTips] = useState([
        vec2(3, -1).scale(KN).add(ORIGIN),
        vec2(-1, -2).scale(KN).add(ORIGIN),
    ]);
    const [a, b] = tips.map((t) => t.sub(ORIGIN));
    const holds = a.add(b).neg();
    return (
        <Layout
            drawing={
                <DragGrid
                    tips={tips}
                    onChange={setTips}
                    label="Three ropes pulling on a ring that stays still, closing up tip to tail"
                    fits={([p, q]) => {
                        const sum = p.add(q).sub(ORIGIN.scale(2));
                        return onGrid(ORIGIN.add(sum)) && onGrid(ORIGIN.sub(sum));
                    }}
                >
                    <g opacity={0.7}>
                        <Arrow from={ORIGIN.add(a)} v={b} color={COLORS.redirect} dashed />
                        <Arrow from={ORIGIN.add(a).add(b)} v={holds} color={COLORS.load} dashed />
                    </g>
                    <Arrow from={ORIGIN} v={holds} color={COLORS.load} width={3} />
                    <Arrow from={ORIGIN} v={a} color={COLORS.pull} width={3} />
                    <Arrow from={ORIGIN} v={b} color={COLORS.redirect} width={3} />
                </DragGrid>
            }
            slider={<p className="text-center text-sm text-ink-muted">Drag either arrow’s tip.</p>}
            readouts={
                <>
                    <Readout label="one" value={kNText(a.len() / KN)} color={COLORS.pull} />
                    <Readout label="other" value={kNText(b.len() / KN)} color={COLORS.redirect} />
                    <Readout
                        label="holds it still"
                        value={kNText(holds.len() / KN)}
                        color={COLORS.load}
                    />
                </>
            }
        />
    );
}

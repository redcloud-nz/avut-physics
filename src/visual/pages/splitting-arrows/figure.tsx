"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Arrow } from "@/components/diagram/svg";
import { vec2 } from "@/lib/vector2";
import { DRAG_HINT, DragGrid, KN, kn, kNText, ORIGIN } from "@/visual/common/grid";
import { Layout, Readout } from "@/visual/frame";

/** One pull, and its sideways and up-or-down parts drawn tip to tail. */
export function SplitFigure() {
    const [tips, setTips] = useState([vec2(2.4, -1.8).scale(KN).add(ORIGIN)]);
    const tip = tips[0];
    const f = kn(tip);
    const corner = vec2(tip.x, ORIGIN.y);
    const left = f.x < 0;
    return (
        <Layout
            drawing={
                <DragGrid
                    tips={tips}
                    onChange={setTips}
                    label="A pull on a bolt, split into sideways and up-or-down parts"
                >
                    <Arrow from={ORIGIN} v={corner.sub(ORIGIN)} color={COLORS.sideways} />
                    <Arrow from={corner} v={tip.sub(corner)} color={COLORS.redirect} />
                    <g opacity={0.7}>
                        <Arrow from={ORIGIN} v={tip.sub(ORIGIN)} color={COLORS.pull} width={3} />
                    </g>
                </DragGrid>
            }
            slider={DRAG_HINT}
            readouts={
                <>
                    <Readout
                        label={left ? "x, to the left" : "x, to the right"}
                        value={kNText(Math.abs(f.x))}
                        color={COLORS.sideways}
                    />
                    <Readout
                        label={f.y < 0 ? "y, down" : "y, up"}
                        value={kNText(Math.abs(f.y))}
                        color={COLORS.redirect}
                    />
                </>
            }
        />
    );
}

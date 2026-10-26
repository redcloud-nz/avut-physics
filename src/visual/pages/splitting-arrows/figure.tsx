"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Arrow } from "@/components/diagram/svg";
import { teaching } from "@/lib/format";
import { vec2 } from "@/lib/vector2";
import { Letter } from "@/visual/common/details";
import { DragGrid, dragHint, KN, kn, ORIGIN } from "@/visual/common/grid";
import { Layout, Readout } from "@/visual/frame";

/** How big a part has to be, in kilonewtons, to have room for its letter. */
const NAMED = 0.4;

/** One force, and its sideways and up-or-down parts drawn tip to tail. */
export function SplitFigure() {
    const [tips, setTips] = useState([vec2(1.8, -2.4).scale(KN).add(ORIGIN)]);
    const tip = tips[0];
    const f = kn(tip);
    const corner = vec2(tip.x, ORIGIN.y);
    const left = f.x < 0;
    // Each letter sits outside the triangle: x on the far side from the tip, y on the far side from the bolt.
    const xAt = vec2((ORIGIN.x + corner.x) / 2, ORIGIN.y + (f.y < 0 ? -16 : 16));
    const yAt = vec2(corner.x + (left ? -16 : 16), (corner.y + tip.y) / 2);
    return (
        <Layout
            drawing={
                <DragGrid
                    tips={tips}
                    onChange={setTips}
                    label="A force on a bolt, split into sideways and up-or-down parts, x and y"
                >
                    <Arrow from={ORIGIN} v={corner.sub(ORIGIN)} color={COLORS.sideways} dashed />
                    <Arrow from={corner} v={tip.sub(corner)} color={COLORS.redirect} dashed />
                    <g opacity={0.7}>
                        <Arrow from={ORIGIN} v={tip.sub(ORIGIN)} color={COLORS.pull} width={3} />
                    </g>
                    {Math.abs(f.x) >= NAMED && (
                        <Letter at={xAt} color={COLORS.sideways}>
                            x
                        </Letter>
                    )}
                    {Math.abs(f.y) >= NAMED && (
                        <Letter at={yAt} color={COLORS.redirect}>
                            y
                        </Letter>
                    )}
                </DragGrid>
            }
            slider={dragHint()}
            readouts={
                <>
                    <Readout
                        label={left ? "x, to the left" : "x, to the right"}
                        value={teaching.kN(Math.abs(f.x))}
                        color={COLORS.sideways}
                    />
                    <Readout
                        label={f.y < 0 ? "y, down" : "y, up"}
                        value={teaching.kN(Math.abs(f.y))}
                        color={COLORS.redirect}
                    />
                </>
            }
        />
    );
}

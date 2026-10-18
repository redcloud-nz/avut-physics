"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { redirectShare } from "@/articles/gentle-introduction";
import { Anchor, Rope } from "@/articles/gentle-introduction-figures";
import { Slider } from "@/components/diagram/controls";
import { Arrow } from "@/components/diagram/svg";
import { rad } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";
import { Layout, percent, Readout, SVG } from "@/visual/frame";

/** A rope turning round a redirect, running freely. */
export function RedirectFigure() {
    const [angle, setAngle] = useState(90);
    const share = redirectShare(rad(angle));
    const T_ = 56;
    const k = vec2(140, 120);
    const toLoad = vec2(0, 1);
    const toTeam = vec2(Math.sin(rad(angle)), Math.cos(rad(angle)));
    const pull = toLoad.add(toTeam);
    const back = pull.len() > 1e-9 ? pull.unit().neg() : vec2(-1, 0);
    const anchor = k.add(back.scale(70));
    // Doubled back, the two parts sit side by side rather than on top of each other.
    const gap = (e: Vector2, other: Vector2, doubled: number) => {
        const p = e.perp();
        const lean = p.dot(other);
        return p.scale(lean > 1e-9 ? -5 : lean < -1e-9 ? 5 : doubled);
    };
    const loadStart = k.add(gap(toLoad, toTeam, 5));
    const teamStart = k.add(gap(toTeam, toLoad, -5));
    return (
        <Layout
            drawing={
                <svg
                    viewBox="20 10 280 270"
                    className={SVG}
                    fontSize={16}
                    role="img"
                    aria-label="A rope turning round a redirect"
                >
                    <Rope from={anchor} to={k} />
                    <Anchor at={anchor} />
                    <Rope from={loadStart} to={vec2(loadStart.x, 240)} />
                    <Rope from={teamStart} to={teamStart.add(toTeam.scale(110))} />
                    <rect x={loadStart.x - 14} y={240} width={28} height={28} fill="currentColor" />
                    <circle
                        cx={k.x}
                        cy={k.y}
                        r={7}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                    />
                    <Arrow from={k} v={toLoad.scale(T_)} color={COLORS.pull} />
                    <Arrow from={k} v={toTeam.scale(T_)} color={COLORS.pull} />
                    {share > 0.05 && (
                        <Arrow from={k} v={pull.scale(T_)} color={COLORS.redirect} dashed />
                    )}
                </svg>
            }
            slider={
                <Slider
                    label="Angle between the rope’s two parts"
                    value={angle}
                    min={0}
                    max={170}
                    step={1}
                    unit="°"
                    digits={0}
                    onChange={setAngle}
                />
            }
            readouts={
                <>
                    <Readout
                        label="redirect holds, of the rope’s pull"
                        value={percent(share)}
                        color={COLORS.redirect}
                    />
                </>
            }
        />
    );
}

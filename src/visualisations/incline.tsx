"use client";

import { useState } from "react";

import { Readout, Slider, Toggle, VisualisationLayout } from "@/components/diagram/controls";
import { AngleArc, Arrow } from "@/components/diagram/svg";
import { G } from "@/lib/constants";
import { deg, rad } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";

const COLORS = {
    weight: "var(--weight)",
    normal: "var(--normal)",
    friction: "var(--incline-friction)",
    net: "var(--net)",
    component: "var(--ink-muted)",
};

const W = 640;
const H = 420;

/** Block resting (or sliding) on an inclined plane, with its free-body diagram. */
export default function Incline() {
    const [angle, setAngle] = useState(25);
    const [mass, setMass] = useState(5);
    const [muS, setMuS] = useState(0.5);
    const [muK, setMuK] = useState(0.3);
    const [g, setG] = useState(G);
    const [showComponents, setShowComponents] = useState(true);

    // --- Physics (SI units) ---
    const th = rad(angle);
    const weight = mass * g;
    const normal = weight * Math.cos(th);
    const along = weight * Math.sin(th); // gravity component down the slope
    const kinetic = Math.min(muK, muS);
    const sliding = along > muS * normal;
    const friction = sliding ? kinetic * normal : along;
    const net = along - friction;
    const accel = net / mass;
    const criticalAngle = deg(Math.atan(muS));

    // --- Geometry (SVG units, y down). Slope descends to the right. ---
    const L = 460;
    const corner = vec2(W - 70, H - 50); // bottom-right, where the angle is
    const top = corner.add(vec2(-L * Math.cos(th), -L * Math.sin(th)));
    const bottomLeft = vec2(top.x, corner.y);
    const down = Vector2.fromAngle(th); // unit vector down the slope
    const outward = vec2(Math.sin(th), -Math.cos(th)); // unit normal out of the surface

    const blockW = 70;
    const blockH = 44;
    const contact = top.add(down.scale(L * 0.5));
    const centre = contact.add(outward.scale(blockH / 2));

    const k = 130 / weight; // px per newton: weight is always drawn 130px long

    return (
        <VisualisationLayout
            diagram={
                <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
                    <polygon
                        points={`${bottomLeft.x},${bottomLeft.y} ${top.x},${top.y} ${corner.x},${corner.y}`}
                        fill="var(--surface-raised)"
                        stroke="var(--line)"
                        strokeWidth={1.5}
                    />
                    <line
                        x1={20}
                        y1={corner.y}
                        x2={W - 20}
                        y2={corner.y}
                        stroke="var(--line)"
                        strokeWidth={1.5}
                    />
                    <AngleArc
                        center={corner}
                        radius={56}
                        startDeg={180}
                        sweepDeg={angle}
                        label={`θ = ${angle}°`}
                    />

                    <rect
                        x={centre.x - blockW / 2}
                        y={centre.y - blockH / 2}
                        width={blockW}
                        height={blockH}
                        rx={4}
                        fill="var(--line-faint)"
                        stroke="var(--ghost)"
                        transform={`rotate(${angle} ${centre.x} ${centre.y})`}
                    />

                    {showComponents && (
                        <>
                            <Arrow
                                from={centre}
                                v={down.scale(along * k)}
                                color={COLORS.component}
                                dashed
                                width={1.5}
                                label="mg sinθ"
                            />
                            <Arrow
                                from={centre}
                                v={outward.scale(-normal * k)}
                                color={COLORS.component}
                                dashed
                                width={1.5}
                                label="mg cosθ"
                            />
                        </>
                    )}
                    <Arrow from={centre} v={vec2(0, weight * k)} color={COLORS.weight} label="W" />
                    <Arrow
                        from={centre}
                        v={outward.scale(normal * k)}
                        color={COLORS.normal}
                        label="N"
                    />
                    <Arrow
                        from={contact}
                        v={down.scale(-friction * k)}
                        color={COLORS.friction}
                        label="f"
                    />
                    {sliding && (
                        <Arrow
                            from={centre.add(outward.scale(blockH))}
                            v={down.scale(net * k)}
                            color={COLORS.net}
                            label="F net"
                        />
                    )}
                </svg>
            }
            controls={
                <>
                    <Slider
                        label="Angle θ"
                        value={angle}
                        min={0}
                        max={60}
                        step={1}
                        unit="°"
                        digits={0}
                        onChange={setAngle}
                    />
                    <Slider
                        label="Mass m"
                        value={mass}
                        min={0.5}
                        max={20}
                        step={0.5}
                        unit="kg"
                        onChange={setMass}
                    />
                    <Slider
                        label="Static friction μs"
                        value={muS}
                        min={0}
                        max={1.2}
                        step={0.01}
                        digits={2}
                        onChange={setMuS}
                    />
                    <Slider
                        label="Kinetic friction μk"
                        value={muK}
                        min={0}
                        max={1.2}
                        step={0.01}
                        digits={2}
                        onChange={setMuK}
                    />
                    <Slider
                        label="Gravity g"
                        value={g}
                        min={1}
                        max={25}
                        step={0.01}
                        unit="m/s²"
                        digits={2}
                        onChange={setG}
                    />
                    <Toggle
                        label="Show weight components"
                        checked={showComponents}
                        onChange={setShowComponents}
                    />
                </>
            }
            readouts={
                <>
                    <Readout
                        label="Weight W = mg"
                        value={`${weight.toFixed(1)} N`}
                        color={COLORS.weight}
                    />
                    <Readout
                        label="Normal N"
                        value={`${normal.toFixed(1)} N`}
                        color={COLORS.normal}
                    />
                    <Readout
                        label={sliding ? "Friction f = μk·N" : "Friction f (static)"}
                        value={`${friction.toFixed(1)} N`}
                        color={COLORS.friction}
                    />
                    <Readout label="Net force" value={`${net.toFixed(1)} N`} color={COLORS.net} />
                    <Readout label="Acceleration" value={`${accel.toFixed(2)} m/s²`} />
                    <Readout label="Slips above" value={`${criticalAngle.toFixed(1)}°`} />
                    <p
                        className={`mt-1 text-sm font-medium ${sliding ? "text-sliding" : "text-ink-soft"}`}
                    >
                        {sliding
                            ? "Block is sliding down the slope."
                            : "Block is held in place by static friction."}
                    </p>
                    {muK > muS && <p className="text-xs text-warning">μk is capped at μs.</p>}
                </>
            }
        />
    );
}

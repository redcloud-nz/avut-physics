"use client";

import { useState } from "react";

import { COLORS } from "@/articles/colors";
import { Rock, Tag } from "@/articles/gentle-introduction-figures";
import { Arrow } from "@/components/diagram/svg";
import { G } from "@/lib/constants";
import { vec2 } from "@/lib/vector2";
import { Layout, Readout, SVG } from "@/visual/frame";

/** Where the load is, and how hard gravity pulls there, in m/s every second. */
const PLACES = [
    { name: "Earth", gravity: G },
    { name: "Moon", gravity: 1.62 },
    { name: "Deep space", gravity: 0 },
];

/** The same 100 kg load on Earth, on the Moon and floating far out in space: its mass stays put, its weight doesn't. */
export function MassFigure() {
    const [place, setPlace] = useState(0);
    const { gravity } = PLACES[place];
    const heavy = gravity / G;
    const top = 40;
    const side = 64;
    // Floating, the load drifts up and its rope goes slack.
    const box = vec2(150, gravity > 0 ? 170 : 140);
    const tie = vec2(box.x, box.y - side / 2);
    const arrow = 120 * heavy;
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 0 300 330"
                    className={SVG}
                    fontSize={14}
                    role="img"
                    aria-label={`A 100 kg load hanging on a rope, in ${PLACES[place].name}`}
                >
                    <Rock y={top} width={300} />
                    {gravity > 0 ? (
                        <line
                            x1={box.x}
                            y1={top}
                            x2={tie.x}
                            y2={tie.y}
                            stroke="currentColor"
                            strokeWidth={2}
                        />
                    ) : (
                        <path
                            d={`M ${box.x} ${top} C ${box.x + 50} ${top + 30}, ${box.x - 50} ${tie.y - 20}, ${tie.x} ${tie.y}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                        />
                    )}
                    <rect
                        x={box.x - side / 2}
                        y={box.y - side / 2}
                        width={side}
                        height={side}
                        rx={4}
                        fill="currentColor"
                    />
                    <text
                        x={box.x}
                        y={box.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-slate-950"
                        fontSize={16}
                        fontWeight={600}
                    >
                        100 kg
                    </text>
                    {arrow > 0 && (
                        <>
                            <Arrow
                                from={box.add(vec2(0, side / 2))}
                                v={vec2(0, arrow)}
                                color={COLORS.load}
                                width={3}
                            />
                            <Tag
                                at={box.add(vec2(14, side / 2 + arrow / 2))}
                                color={COLORS.load}
                                anchor="start"
                            >
                                Weight
                            </Tag>
                        </>
                    )}
                    {arrow === 0 && (
                        <Tag at={box.add(vec2(0, side / 2 + 30))} color={COLORS.load}>
                            No weight
                        </Tag>
                    )}
                </svg>
            }
            slider={
                <div className="grid grid-cols-3 gap-1.5">
                    {PLACES.map((p, i) => (
                        <button
                            key={p.name}
                            type="button"
                            aria-pressed={place === i}
                            onClick={() => setPlace(i)}
                            className={`rounded-lg border py-1.5 text-sm ${
                                place === i
                                    ? "border-sky-500 bg-sky-500/15 text-slate-100"
                                    : "border-slate-700 text-slate-400"
                            }`}
                        >
                            {p.name}
                        </button>
                    ))}
                </div>
            }
            readouts={
                <>
                    <Readout label="mass" value="100 kg" />
                    <Readout
                        label="weight, against Earth"
                        value={`${Math.round(heavy * 100)}%`}
                        color={COLORS.load}
                    />
                </>
            }
        />
    );
}

"use client";

import { useState } from "react";

import {
    Carabiner,
    doubleEnds,
    DoublePulley,
    doubleSheaves,
    ropePieces,
    Tab,
} from "@/articles/pulley-blocks";
import { Slider } from "@/components/diagram/controls";
import { svgNumber } from "@/lib/svg-path";
import { vec2, type Vector2 } from "@/lib/vector2";

/** The rope's thickness. */
const ROPE = 4;
/**
 * The rope's surface, as two lanes along it, either side of its middle; the second's pattern is a little behind the
 * first's, so its tracers' stripes slant across it.
 */
const ROPE_LANES = [
    { offset: -ROPE / 4, shift: 0 },
    { offset: ROPE / 4, shift: -1.2 },
];
/** The black tracers: a stripe of two short dashes, then plain rope, about two and a half thicknesses along. */
const TRACER = "1.2 0.6 1.2 7";

/**
 * Two doubles rigged as a 5:1, the top one on the anchor and the bottom one on the load, with a slider for the rope
 * pulled in: the bottom pulley and the load rise a fifth as far, the rope's marks run along it and the sheaves turn.
 */
export default function Sketch() {
    const [pulled, setPulled] = useState(0);
    const top = vec2(160, 125);
    // The load rises a fifth of the rope pulled in: a metre of rope is 100 units.
    const bottom = vec2(160, 335 - (pulled * 100) / 5);
    // The anchor's face, and the hanger on it; the load's top, and the tab on it.
    const face = 20;
    const hanger = vec2(160, 36);
    const loadTop = bottom.y + 99;
    const tab = bottom.add(vec2(0, 89));
    const topEnds = doubleEnds(top, "down");
    const bottomEnds = doubleEnds(bottom, "up");
    // A carabiner from the anchor's hanger to the top pulley's eye, and one from the bottom pulley's eye to the load's tab.
    const clips: [Vector2, Vector2][] = [
        [hanger, topEnds.clip],
        [bottomEnds.clip, tab],
    ];
    const [t, b] = [doubleSheaves(top), doubleSheaves(bottom)];
    // A 5:1: tied to the bottom pulley's becket, round each sheave in turn, and up past the top pulley to the team.
    const { pieces: rope, spins } = ropePieces([
        { c: bottomEnds.becket, r: 0 },
        { ...t.small, into: -1, out: 1 },
        { ...b.small, into: 1, out: -1 },
        { ...t.large, into: -1, out: 1 },
        { ...b.large, into: 1, out: -1 },
        { c: vec2(112, 12), r: 0 },
    ]);
    return (
        <div className="flex flex-col gap-4">
            <svg
                viewBox="0 0 320 480"
                className="w-full text-ink-muted"
                role="img"
                aria-label="Two double pulleys"
            >
                {/* The anchor, with its hanger. */}
                <line x1={125} y1={face} x2={195} y2={face} stroke="currentColor" strokeWidth={2} />
                {Array.from({ length: 9 }, (_, i) => (
                    <line
                        key={i}
                        x1={125 + i * 8}
                        y1={face}
                        x2={131 + i * 8}
                        y2={face - 8}
                        stroke="currentColor"
                        strokeWidth={1}
                    />
                ))}
                <Tab hole={hanger} base={face} />
                {/* Each part of both pulleys in turn from the back, with the rope on each sheave behind it. */}
                {(["plate", "large", "small"] as const).map((part, i) => (
                    <g key={part}>
                        {i > 0 &&
                            rope
                                .filter((piece) => piece.layer === i - 1)
                                .map((piece, j) => (
                                    <g key={j} className="text-ink">
                                        <path
                                            d={piece.d}
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={ROPE}
                                            strokeLinecap="round"
                                        />
                                        {/* Its braid, and the black tracers spiralling round it, fixed to it so it shows running. */}
                                        {ROPE_LANES.map((lane, k) => (
                                            <g key={k}>
                                                <path
                                                    d={piece.lane(lane.offset)}
                                                    pathLength={svgNumber(piece.length)}
                                                    fill="none"
                                                    className="stroke-background"
                                                    strokeOpacity={0.15}
                                                    strokeWidth={ROPE / 2}
                                                    strokeDasharray="0.8 0.7"
                                                    strokeDashoffset={svgNumber(
                                                        piece.start + lane.shift / 2,
                                                    )}
                                                />
                                                <path
                                                    d={piece.lane(lane.offset)}
                                                    pathLength={svgNumber(piece.length)}
                                                    fill="none"
                                                    className="stroke-background"
                                                    strokeOpacity={0.85}
                                                    strokeWidth={ROPE / 2}
                                                    strokeDasharray={TRACER}
                                                    strokeDashoffset={svgNumber(
                                                        piece.start + lane.shift,
                                                    )}
                                                />
                                            </g>
                                        ))}
                                    </g>
                                ))}
                        <DoublePulley
                            at={top}
                            becket="down"
                            part={part}
                            spins={{ large: spins[3], small: spins[1] }}
                        />
                        <DoublePulley
                            at={bottom}
                            becket="up"
                            part={part}
                            spins={{ large: spins[4], small: spins[2] }}
                        />
                    </g>
                ))}
                {/* The load, with its tab. */}
                <Tab hole={tab} base={loadTop} />
                <rect x={120} y={loadTop} width={80} height={30} fill="currentColor" />
                {/* The carabiners, over the plates they clip through. */}
                {clips.map((ends, i) => (
                    <Carabiner key={i} ends={ends} />
                ))}
            </svg>
            <Slider
                label="Rope pulled in"
                value={pulled}
                min={0}
                max={4.5}
                step={0.01}
                unit="m"
                digits={2}
                onChange={setPulled}
            />
        </div>
    );
}

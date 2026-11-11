import type { Metadata } from "next";

import {
    Carabiner,
    doubleEnds,
    DoublePulley,
    doubleSheaves,
    ropePieces,
    Tab,
} from "@/articles/pulley-blocks";
import { vec2, type Vector2 } from "@/lib/vector2";

export const metadata: Metadata = { title: "Pulley sketch", robots: { index: false } };

/** A scratch page for drawing pulleys face on: two doubles, the top one on the anchor, the bottom one on the load. */
export default function Page() {
    const top = vec2(160, 125);
    const bottom = vec2(160, 335);
    // The anchor's face, and the hanger on it; the load's top, and the tab on it.
    const face = 20;
    const hanger = vec2(160, 36);
    const loadTop = 434;
    const tab = vec2(160, 424);
    const topEnds = doubleEnds(top, "down");
    const bottomEnds = doubleEnds(bottom, "up");
    // A carabiner from the anchor's hanger to the top pulley's eye, and one from the bottom pulley's eye to the load's tab.
    const clips: [Vector2, Vector2][] = [
        [hanger, topEnds.clip],
        [bottomEnds.clip, tab],
    ];
    const [t, b] = [doubleSheaves(top), doubleSheaves(bottom)];
    // A 5:1: tied to the bottom pulley's becket, round each sheave in turn, and up past the top pulley to the team.
    const rope = ropePieces([
        { c: bottomEnds.becket, r: 0 },
        { ...t.small, into: -1, out: 1 },
        { ...b.small, into: 1, out: -1 },
        { ...t.large, into: -1, out: 1 },
        { ...b.large, into: 1, out: -1 },
        { c: vec2(112, 12), r: 0 },
    ]);
    return (
        <div className="mx-auto w-full max-w-xl px-4 py-8">
            <h1 className="mb-4 text-2xl font-semibold">Pulley sketch</h1>
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
                                    <path
                                        key={j}
                                        d={piece.d}
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={4}
                                        strokeLinecap="round"
                                        className="text-ink"
                                    />
                                ))}
                        <DoublePulley at={top} becket="down" part={part} />
                        <DoublePulley at={bottom} becket="up" part={part} />
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
        </div>
    );
}

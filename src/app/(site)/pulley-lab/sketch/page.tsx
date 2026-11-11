import type { Metadata } from "next";

import { doubleEnds, DoublePulley } from "@/articles/pulley-blocks";
import { vec2 } from "@/lib/vector2";

export const metadata: Metadata = { title: "Pulley sketch", robots: { index: false } };

/** A scratch page for drawing pulleys face on: two doubles, the top one on the anchor, the bottom one on the load. */
export default function Page() {
    const top = vec2(160, 120);
    const bottom = vec2(160, 330);
    const topEnds = doubleEnds(top, "down");
    const bottomEnds = doubleEnds(bottom, "up");
    return (
        <div className="mx-auto w-full max-w-xl px-4 py-8">
            <h1 className="mb-4 text-2xl font-semibold">Pulley sketch</h1>
            <svg
                viewBox="0 0 320 450"
                className="w-full text-ink-muted"
                role="img"
                aria-label="Two double pulleys"
            >
                {/* The anchor, and the top pulley's sling to it. */}
                <line x1={100} y1={30} x2={220} y2={30} stroke="currentColor" strokeWidth={4} />
                <line
                    x1={topEnds.eye.x}
                    y1={30}
                    x2={topEnds.eye.x}
                    y2={topEnds.eye.y}
                    stroke="currentColor"
                    strokeWidth={3}
                    opacity={0.5}
                />
                <DoublePulley at={top} becket="down" />
                <DoublePulley at={bottom} becket="up" />
                {/* The load, on the bottom pulley's eye. */}
                <line
                    x1={bottomEnds.eye.x}
                    y1={bottomEnds.eye.y}
                    x2={bottomEnds.eye.x}
                    y2={410}
                    stroke="currentColor"
                    strokeWidth={3}
                    opacity={0.5}
                />
                <rect x={120} y={410} width={80} height={28} fill="currentColor" />
            </svg>
        </div>
    );
}

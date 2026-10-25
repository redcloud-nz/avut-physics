/**
 * An arrow strand: a thin shaft along its curves with a head at its last pin, outlined so it reads over the ropes.
 * Its over stretches are the shaft again, drawn in the top layer. Coordinates are rope diameters.
 */

import { memo } from "react";

import { laySegments, type RopePath } from "@/knots/rope-path";
import type { Vector2 } from "@/lib/vector2";

import { ARROW_TOKENS } from "./colours";
import { pathBetween } from "./crossing-geometry";
import type { StrandGeometry } from "./geometry";

/** How long the head is, and how wide the shaft and its outline (diameters), as the knot pages' arrows. */
const HEAD = 1.1;
const SHAFT = 0.28;
const OUTLINE = SHAFT + 0.2;

/**
 * An arrow as drawn: its shaft's path data (stopping where the head starts), its head's corners, its over stretches,
 * and whether it's on top at its head too.
 */
export type ArrowShape = { shaft: string; head: string; over: string[]; headOver: boolean };

const corner = (p: Vector2) => `${Math.round(p.x * 1e4) / 1e4},${Math.round(p.y * 1e4) / 1e4}`;

/** The arrow's shaft, head and over stretches, from its geometry and its path (whose stretches marked over are kept). */
export function arrowShape(strand: StrandGeometry, path: RopePath): ArrowShape {
    const last = strand.segments[strand.segments.length - 1].cubic;
    const tip = last.p3;
    const heading = last.tangentAt(1);
    const head = Math.min(HEAD, strand.length);
    const base = tip.sub(heading.scale(head));
    const side = heading.perp().scale(HEAD / 2);
    const shaftEnd = strand.length - head;
    const laid = laySegments(path);
    return {
        shaft: pathBetween(strand, 0, shaftEnd),
        head: [tip, base.add(side), base.sub(side)].map(corner).join(" "),
        // Each over stretch, stopping where the head starts, so the shaft doesn't show past its point.
        over: laid
            .filter((seg) => seg.over && seg.start < shaftEnd)
            .map((seg) =>
                pathBetween(strand, seg.start, Math.min(seg.start + seg.length, shaftEnd)),
            ),
        headOver: !!laid[laid.length - 1]?.over,
    };
}

/** The head: its outline, then its fill. */
function Head(props: { head: string }) {
    return (
        <>
            <polygon
                points={props.head}
                fill={ARROW_TOKENS.outline}
                stroke={ARROW_TOKENS.outline}
                strokeWidth={0.2}
                strokeLinejoin="round"
            />
            <polygon points={props.head} fill={ARROW_TOKENS.fill} />
        </>
    );
}

/** The whole arrow, for the strands' layer. */
export const ArrowDrawing = memo(function ArrowDrawing(props: { shaft: string; head: string }) {
    const { shaft, head } = props;
    return (
        <g strokeLinecap="round" strokeLinejoin="round">
            <path d={shaft} fill="none" stroke={ARROW_TOKENS.outline} strokeWidth={OUTLINE} />
            <path d={shaft} fill="none" stroke={ARROW_TOKENS.fill} strokeWidth={SHAFT} />
            <Head head={head} />
        </g>
    );
});

/**
 * The arrow's over stretches, for the top layer: the shaft and its outline again, with square ends so they join the
 * shaft underneath without a seam.
 */
export const ArrowOverDrawing = memo(
    function ArrowOverDrawing(props: { over: string[]; head: string; headOver: boolean }) {
        return (
            <g strokeLinecap="butt" strokeLinejoin="round" fill="none">
                {props.over.map((d, k) => (
                    <g key={k}>
                        <path d={d} stroke={ARROW_TOKENS.outline} strokeWidth={OUTLINE} />
                        <path d={d} stroke={ARROW_TOKENS.fill} strokeWidth={SHAFT} />
                    </g>
                ))}
                {props.headOver && <Head head={props.head} />}
            </g>
        );
    },
    (a, b) =>
        a.headOver === b.headOver &&
        a.head === b.head &&
        a.over.length === b.over.length &&
        a.over.every((d, k) => d === b.over[k]),
);

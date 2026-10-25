/**
 * Draws a rope written as SVG path data (see `rope-path.ts`) as a tube with an outline, its sheath's weave and a
 * highlight along the top. The whole rope is drawn once, then each segment marked `over` again on top of it. Two ropes
 * (a bend joining them) are each drawn whole before either's `over` segments, so each goes over the other where it's
 * marked to.
 * The segments have square ends, pick up the weave where the rope underneath has it, and stop their outlines
 * just short of their ends, so they join it without a seam. The end is taped, so it's plain which end it is.
 *
 * Coordinates are rope diameters, so place it in an SVG whose viewBox is in diameters too.
 */

import type { ReactNode } from "react";

import { laySegments, ropeEnd, type RopePath } from "./rope-path";

export type RopeColors = { body: string; weave: string; highlight: string; outline: string };

export const ROPE_COLORS: RopeColors = {
    body: "#f97316",
    weave: "#9a3412",
    highlight: "#fed7aa",
    outline: "#0f172a",
};

/** The second rope, where a knot joins two, in another colour so they're told apart. */
export const SECOND_ROPE_COLORS: RopeColors = {
    body: "#16a34a",
    weave: "#14532d",
    highlight: "#bbf7d0",
    outline: "#0f172a",
};

/** Tape round the rope's end, so it's plain which end that is. */
export const TAPE_COLORS: RopeColors = {
    body: "#2563eb",
    weave: "#1e3a8a",
    highlight: "#bfdbfe",
    outline: "#0f172a",
};

/** How long the tape round the end is (diameters). */
const TAPE_LENGTH = 1.2;

/** How far short of a redrawn segment's ends its outline stops (diameters). */
const TRIM = 0.1;

/**
 * A length or coordinate rounded for drawing: worked out along arcs, its last digits can differ between the server and
 * the browser, and the page wouldn't then match as it hydrates.
 */
const rounded = (value: number) => Math.round(value * 1e4) / 1e4;

/**
 * One stretch of rope along path data `d`: outline, body, weave and highlight, the weave `offset` along. Given
 * its `length`, the outline stops a little short of each end: the rope underneath already has it there, and a
 * square end's anti-aliased edge would otherwise leave a faint dark line across the rope.
 */
function Stretch(props: { d: string; offset: number; length?: number; colors: RopeColors }) {
    const { d, colors } = props;
    const [offset, length] = [rounded(props.offset), props.length && rounded(props.length)];
    const common = {
        d,
        fill: "none",
        strokeLinejoin: "round" as const,
        strokeLinecap: "butt" as const,
    };
    return (
        <>
            <path
                {...common}
                stroke={colors.outline}
                strokeWidth={1.25}
                strokeDasharray={length ? `${length - 2 * TRIM} ${length}` : undefined}
                strokeDashoffset={length ? -TRIM : undefined}
            />
            <path {...common} stroke={colors.body} strokeWidth={1} />
            <path
                {...common}
                stroke={colors.weave}
                strokeOpacity={0.3}
                strokeWidth={0.8}
                strokeDasharray="0.15 0.2"
                strokeDashoffset={offset}
            />
            <path {...common} stroke={colors.highlight} strokeOpacity={0.55} strokeWidth={0.22} />
        </>
    );
}

/** The ropes, with anything `between` drawn over their whole length but under their stretches marked over. */
export function RopeDrawing(props: { ropes: RopePath[]; between?: ReactNode }) {
    const ropes = props.ropes.map((path, r) => ({
        path,
        laid: laySegments(path),
        colors: r === 0 ? ROPE_COLORS : SECOND_ROPE_COLORS,
    }));
    return (
        <g>
            {ropes.map(({ path, colors }, r) => (
                <Stretch key={r} d={path.map((s) => s.d).join(" ")} offset={0} colors={colors} />
            ))}
            {props.between}
            {ropes.map(({ laid, colors }, r) =>
                laid.map(
                    (seg, k) =>
                        seg.over && (
                            <Stretch
                                key={`${r}-${k}`}
                                d={`M ${rounded(seg.from.x)} ${rounded(seg.from.y)} ${seg.d}`}
                                offset={seg.start}
                                length={seg.length}
                                colors={colors}
                            />
                        ),
                ),
            )}
            {ropes.map(({ path }, r) => {
                const end = ropeEnd(path);
                const tapeFrom = end.at.sub(end.heading.scale(TAPE_LENGTH));
                return (
                    <Stretch
                        key={r}
                        d={`M ${rounded(tapeFrom.x)} ${rounded(tapeFrom.y)} L ${end.at.x} ${end.at.y}`}
                        offset={0}
                        length={TAPE_LENGTH}
                        colors={TAPE_COLORS}
                    />
                );
            })}
        </g>
    );
}

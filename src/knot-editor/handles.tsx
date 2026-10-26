/**
 * What's drawn over the picture to edit it: each segment's hit area along its curve, each pin, and for a selected
 * pin its angle ring and tension handles. Sizes are in screen pixels, turned into millimetres by `px` (millimetres per
 * pixel), so they stay the same size as the view zooms.
 *
 * Each piece is memoised on plain values, so a drag re-renders only the pins and segments that moved. They carry
 * `data-hit` and `data-ref` for the canvas, which handles every pointer event itself.
 */

import { memo } from "react";

import type { FrameSides } from "./edits";

const PIN = 5;
const HIT = 12;
const RING = 28;
const KNOB = 5;
const TENSION = 4.5;

/** Where a pointer event landed, read from the `data-hit` and `data-ref` it's within. */
export type Hit =
    | { kind: "pin"; ref: [number, number] }
    | { kind: "segment"; ref: [number, number] }
    | { kind: "ring"; ref: [number, number] }
    | { kind: "tension"; ref: [number, number]; end: 0 | 1 }
    /** A crossing or pass, by its place in `pictureCrossings`' list. */
    | { kind: "crossing" | "pass"; index: number }
    | { kind: "prop"; index: number }
    /** The frame's edge or corner: which edges it moves, across and down. */
    | { kind: "frame"; sides: FrameSides }
    | { kind: "background" };

export function hitAt(target: EventTarget | null): Hit {
    const el = target instanceof Element ? target.closest("[data-hit]") : null;
    if (!el) return { kind: "background" };
    const [a, b, c] = (el.getAttribute("data-ref") ?? "").split(",").map(Number);
    const kind = el.getAttribute("data-hit");
    if (kind === "tension") return { kind, ref: [a, b], end: c === 1 ? 1 : 0 };
    if (kind === "pin" || kind === "segment" || kind === "ring") return { kind, ref: [a, b] };
    if (kind === "crossing" || kind === "pass" || kind === "prop") return { kind, index: a };
    if (kind === "frame") return { kind, sides: [Math.sign(a), Math.sign(b)] as FrameSides };
    return { kind: "background" };
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

/** A segment's hit area: a wide invisible stroke along its curve, with a line along it when it's selected. */
export const SegmentHandle = memo(function SegmentHandle(props: {
    strand: number;
    segment: number;
    d: string;
    selected: boolean;
    px: number;
}) {
    const { d, px } = props;
    return (
        <g data-hit="segment" data-ref={`${props.strand},${props.segment}`}>
            <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={HIT * px}
                pointerEvents="stroke"
            />
            {props.selected && (
                <path
                    d={d}
                    fill="none"
                    stroke="var(--highlight)"
                    strokeWidth={2 * px}
                    strokeDasharray={`${6 * px} ${4 * px}`}
                    pointerEvents="none"
                />
            )}
        </g>
    );
});

/**
 * A pin: a dot, with a tick across it along its angle when it holds one, and its number (from 1) when shown. A linked
 * pin is a ring rather than a dot, with a thin line to its leader.
 */
export const PinHandle = memo(function PinHandle(props: {
    strand: number;
    pin: number;
    x: number;
    y: number;
    /** The angle it holds or runs at (degrees), if any. */
    angle?: number;
    selected: boolean;
    number?: number;
    /** Where its leader is, for a linked pin. */
    leaderX?: number;
    leaderY?: number;
    px: number;
}) {
    const { x, y, angle, selected, number, leaderX, leaderY, px } = props;
    const linked = leaderX !== undefined && leaderY !== undefined;
    const colour = selected ? "var(--highlight)" : "var(--ink)";
    const tick =
        angle !== undefined &&
        [-1, 1].map((s) => {
            const a = (angle * Math.PI) / 180;
            return `${r4(x + s * 9 * px * Math.cos(a))} ${r4(y + s * 9 * px * Math.sin(a))}`;
        });
    return (
        <g data-hit="pin" data-ref={`${props.strand},${props.pin}`} className="cursor-move">
            {linked && (
                <path
                    d={`M ${r4(x)} ${r4(y)} L ${r4(leaderX)} ${r4(leaderY)}`}
                    stroke={colour}
                    strokeWidth={px}
                    strokeOpacity={0.7}
                    pointerEvents="none"
                />
            )}
            {tick && (
                <path
                    d={`M ${tick[0]} L ${tick[1]}`}
                    stroke="var(--knot-outline)"
                    strokeWidth={4 * px}
                    strokeLinecap="round"
                />
            )}
            {tick && (
                <path
                    d={`M ${tick[0]} L ${tick[1]}`}
                    stroke="var(--ink)"
                    strokeWidth={2 * px}
                    strokeLinecap="round"
                />
            )}
            {linked ? (
                <>
                    <circle
                        cx={x}
                        cy={y}
                        r={PIN * px}
                        fill="transparent"
                        stroke="var(--knot-outline)"
                        strokeWidth={4 * px}
                    />
                    <circle
                        cx={x}
                        cy={y}
                        r={PIN * px}
                        fill="none"
                        stroke={colour}
                        strokeWidth={2 * px}
                    />
                </>
            ) : (
                <circle
                    cx={x}
                    cy={y}
                    r={PIN * px}
                    fill={colour}
                    stroke="var(--knot-outline)"
                    strokeWidth={1.5 * px}
                />
            )}
            {number !== undefined && (
                <text
                    x={x + 7 * px}
                    y={y - 7 * px}
                    fontSize={11 * px}
                    fill="var(--ink)"
                    stroke="var(--halo)"
                    strokeWidth={3 * px}
                    paintOrder="stroke"
                    pointerEvents="none"
                >
                    {number}
                </text>
            )}
        </g>
    );
});

/** A tension handle: where a segment's control point is, on a line from its pin. Locked, it's only shown. */
type TensionHandle = { x: number; y: number; segment: number; end: 0 | 1; locked: boolean };

/**
 * A selected pin's tools: its angle ring, with a knob at its direction (filled when it holds an angle), and the
 * tension handles of the segments either side.
 */
export const PinTools = memo(
    function PinTools(props: {
        strand: number;
        pin: number;
        x: number;
        y: number;
        /** Its direction (degrees), held or worked out. */
        direction: number;
        held: boolean;
        tensions: TensionHandle[];
        px: number;
    }) {
        const { strand, x, y, direction, held, tensions, px } = props;
        const a = (direction * Math.PI) / 180;
        const knob = { x: x + RING * px * Math.cos(a), y: y + RING * px * Math.sin(a) };
        return (
            <g>
                {tensions.map((h) => (
                    <g
                        key={`${h.segment}-${h.end}`}
                        {...(!h.locked && {
                            "data-hit": "tension",
                            "data-ref": `${strand},${h.segment},${h.end}`,
                            className: "cursor-pointer",
                        })}
                    >
                        <path
                            d={`M ${r4(x)} ${r4(y)} L ${r4(h.x)} ${r4(h.y)}`}
                            stroke="var(--ink-muted)"
                            strokeWidth={1 * px}
                            pointerEvents="none"
                        />
                        <rect
                            x={h.x - TENSION * px}
                            y={h.y - TENSION * px}
                            width={2 * TENSION * px}
                            height={2 * TENSION * px}
                            fill={h.locked ? "var(--surface)" : "var(--ink-soft)"}
                            stroke="var(--knot-outline)"
                            strokeWidth={1 * px}
                        />
                    </g>
                ))}
                <circle
                    cx={x}
                    cy={y}
                    r={RING * px}
                    fill="none"
                    stroke="var(--line)"
                    strokeWidth={1 * px}
                    pointerEvents="none"
                />
                <circle
                    data-hit="ring"
                    data-ref={`${strand},${props.pin}`}
                    className="cursor-pointer"
                    cx={knob.x}
                    cy={knob.y}
                    r={KNOB * px}
                    fill={held ? "var(--highlight)" : "var(--surface)"}
                    stroke="var(--highlight)"
                    strokeWidth={1.5 * px}
                />
            </g>
        );
    },
    (a, b) =>
        a.strand === b.strand &&
        a.pin === b.pin &&
        a.x === b.x &&
        a.y === b.y &&
        a.direction === b.direction &&
        a.held === b.held &&
        a.px === b.px &&
        a.tensions.length === b.tensions.length &&
        a.tensions.every((h, k) => {
            const o = b.tensions[k];
            return (
                h.x === o.x &&
                h.y === o.y &&
                h.segment === o.segment &&
                h.end === o.end &&
                h.locked === o.locked
            );
        }),
);

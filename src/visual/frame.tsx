"use client";

import type { Vector2 } from "@/lib/vector2";

/*
 * The frame every figure in the visual introduction shares: a drawing that grows to the space it has, its slider, and
 * a big number or two that change as the slider moves.
 */

/** A number to read at a glance, with what it is under it. */
export function Readout(props: { label: string; value: React.ReactNode; color?: string }) {
    return (
        <div className="flex min-w-0 flex-1 flex-col items-center rounded-lg bg-surface/60 px-2 py-1.5">
            <span
                className="text-2xl font-semibold tabular-nums"
                style={{ color: props.color ?? "var(--ink-strong)" }}
            >
                {props.value}
            </span>
            <span className="text-center text-xs text-ink-muted">{props.label}</span>
        </div>
    );
}

/** A figure's parts: the drawing, filling what room there is, then its slider and readouts. */
export function Layout(props: {
    drawing: React.ReactNode;
    /** The slider, or a hint for a drawing that's dragged instead. */
    slider: React.ReactNode;
    readouts: React.ReactNode;
}) {
    return (
        <div className="flex flex-1 flex-col gap-3">
            {/* Sized by the room it's given, not by its drawing, so a short screen squeezes it no smaller than its minimum. */}
            <div className="relative flex min-h-36 flex-1 items-center justify-center contain-size [@media(min-height:640px)]:min-h-48">
                {props.drawing}
            </div>
            {props.slider}
            {/* Read out as they change, so moving a slider by keyboard says what it did. */}
            <div className="flex gap-2" aria-live="polite">
                {props.readouts}
            </div>
        </div>
    );
}

/** A figure's drawing, filling the box Layout gives it whatever that box's size. */
export const SVG = "absolute inset-0 h-full w-full text-ink-muted";

/** Grey for what's faint in a drawing: where something was, and notes. */
export const GHOST = "var(--ghost)";

/** Small grey text in a drawing: a time, a distance, a scale. */
export function Note(props: {
    at: Vector2;
    anchor?: "start" | "middle" | "end";
    children: React.ReactNode;
}) {
    return (
        <text
            x={props.at.x}
            y={props.at.y}
            fontSize={13}
            fill={GHOST}
            textAnchor={props.anchor ?? "middle"}
            dominantBaseline="middle"
        >
            {props.children}
        </text>
    );
}

/**
 * The load the pulley pages share out, in kilonewtons: about 120 kg, one person and their gear. It divides evenly by
 * 1, 2, 3 and 6, so every pulley system's pulls come out as round numbers.
 */
export const LOAD_KN = 1.2;

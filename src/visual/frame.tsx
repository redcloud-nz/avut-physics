"use client";

import { Details } from "./details";

/*
 * The frame every figure in the visual introduction shares: a drawing that grows to the space it has, its slider, and
 * a big number or two that change as the slider moves, and on some pages the maths behind them, in the page's
 * details.
 */

/** A number to read at a glance, with what it is under it. */
export function Readout(props: { label: string; value: React.ReactNode; color?: string }) {
    return (
        <div className="flex min-w-0 flex-1 flex-col items-center rounded-lg bg-slate-900/60 px-2 py-1.5">
            <span
                className="text-2xl font-semibold tabular-nums"
                style={{ color: props.color ?? "#f1f5f9" }}
            >
                {props.value}
            </span>
            <span className="text-center text-xs text-slate-400">{props.label}</span>
        </div>
    );
}

/** A figure's parts: the drawing, filling what room there is, then its slider and readouts, and any maths. */
export function Layout(props: {
    drawing: React.ReactNode;
    /** The slider, or a hint for a drawing that's dragged instead. */
    slider: React.ReactNode;
    readouts: React.ReactNode;
    /** How the readouts are worked out, in the page's details. */
    maths?: React.ReactNode;
}) {
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex min-h-48 flex-1 items-center justify-center">{props.drawing}</div>
            {props.slider}
            <div className="flex gap-2">{props.readouts}</div>
            {props.maths && (
                <Details>
                    <section className="flex flex-col gap-2 pt-3 pb-2">
                        <h2 className="font-semibold text-slate-100">The maths</h2>
                        <div className="flex flex-col gap-1 text-slate-300 tabular-nums">
                            {props.maths}
                        </div>
                    </section>
                </Details>
            )}
        </div>
    );
}

export const SVG = "h-full max-h-full w-full text-slate-400";

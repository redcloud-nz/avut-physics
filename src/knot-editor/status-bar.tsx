"use client";

/**
 * The status bar along the bottom: where the pointer is in the picture, how many warnings there are, whether the file's
 * saved, and the zoom, with a slider and − and + to change it (as in Excel). The pointer and zoom come from a small
 * store the canvas writes to, each read on its own, so a plain pointer move re-renders the pointer's readout and
 * nothing else.
 */
import { useSyncExternalStore } from "react";

import type { Vector2 } from "@/lib/vector2";

import { BASE_SCALE, nextLevel, percentOf, scaleAtSlider, SLIDER_STEPS, sliderOf } from "./zoom";

export type Readouts = { pointer?: Vector2; scale?: number };

/** The pointer's position and the zoom, as the canvas last set them. */
export function createReadouts() {
    let snapshot: Readouts = {};
    const listeners = new Set<() => void>();
    return {
        get: () => snapshot,
        set(change: Readouts) {
            snapshot = { ...snapshot, ...change };
            listeners.forEach((listener) => listener());
        },
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

export type ReadoutStore = ReturnType<typeof createReadouts>;

function Pointer(props: { readouts: ReadoutStore }) {
    const { readouts } = props;
    const pointer = useSyncExternalStore(
        readouts.subscribe,
        () => readouts.get().pointer,
        () => undefined,
    );
    return (
        <span className="w-44">
            {pointer ? `x ${pointer.x.toFixed(1)}  y ${pointer.y.toFixed(1)} mm` : ""}
        </span>
    );
}

const STEP = "px-1 text-sm leading-none text-ink-muted hover:text-ink";

/** A thin line with a small round thumb, drawn the same in Chrome and Firefox. */
const SLIDER = [
    "relative h-3 w-full cursor-pointer appearance-none bg-transparent outline-none",
    "[&::-webkit-slider-runnable-track]:h-px [&::-webkit-slider-runnable-track]:bg-line",
    "[&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none",
    "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink-soft",
    "hover:[&::-webkit-slider-thumb]:bg-ink focus-visible:[&::-webkit-slider-thumb]:bg-highlight",
    "[&::-moz-range-track]:h-px [&::-moz-range-track]:bg-line",
    "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0",
    "[&::-moz-range-thumb]:bg-ink-soft",
].join(" ");

/** − and + to the next round level, a slider between, and the percentage, which goes back to 100% when clicked. */
function Zoom(props: { readouts: ReadoutStore; onZoom: (scale: number) => void }) {
    const { readouts, onZoom } = props;
    const scale = useSyncExternalStore(
        readouts.subscribe,
        () => readouts.get().scale,
        () => undefined,
    );
    if (scale === undefined) return null;
    return (
        <div className="flex items-center gap-1" title={`${scale.toFixed(1)} px per millimetre`}>
            <button
                type="button"
                className={STEP}
                aria-label="Zoom out"
                onClick={() => onZoom(nextLevel(scale, -1))}
            >
                −
            </button>
            <div className="relative flex w-28 items-center">
                {/* The tick at 100%, which is the slider's middle. */}
                <span className="absolute left-1/2 h-2 w-px -translate-x-1/2 bg-ink-muted" />
                <input
                    type="range"
                    className={SLIDER}
                    aria-label="Zoom"
                    min={0}
                    max={SLIDER_STEPS}
                    value={sliderOf(scale)}
                    onChange={(e) => onZoom(scaleAtSlider(Number(e.currentTarget.value)))}
                />
            </div>
            <button
                type="button"
                className={STEP}
                aria-label="Zoom in"
                onClick={() => onZoom(nextLevel(scale, 1))}
            >
                +
            </button>
            <button
                type="button"
                className="w-12 text-right hover:text-ink"
                aria-label="Zoom to 100%"
                onClick={() => onZoom(BASE_SCALE)}
            >
                {Math.round(percentOf(scale))}%
            </button>
        </div>
    );
}

/** What's worth a look: bends too tight, locked lengths not met, crossings to check. Each counted, if any. */
export type Warnings = { count: number; one: string; many: string }[];

export function StatusBar(props: {
    readouts: ReadoutStore;
    warnings: Warnings;
    saved: boolean;
    /** Zooms the view to this scale (pixels per millimetre). */
    onZoom: (scale: number) => void;
}) {
    const warnings = props.warnings.filter((w) => w.count > 0);
    return (
        <footer className="flex h-7 items-center gap-6 border-t border-line-faint px-3 font-mono text-xs whitespace-pre text-ink-muted">
            <Pointer readouts={props.readouts} />
            <span className={warnings.length ? "text-warning" : undefined}>
                {warnings.length
                    ? warnings.map((w) => `${w.count} ${w.count === 1 ? w.one : w.many}`).join(", ")
                    : "No warnings"}
            </span>
            <span className="ml-auto">{props.saved ? "Saved" : "Not saved"}</span>
            <Zoom readouts={props.readouts} onZoom={props.onZoom} />
        </footer>
    );
}

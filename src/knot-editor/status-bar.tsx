"use client";

/**
 * The status bar along the bottom: where the pointer is in the picture, the zoom, how many warnings there are, and
 * whether the file's saved. The pointer and zoom come from a small store the canvas writes to, read only by the
 * status bar, so a plain pointer move re-renders the status bar and nothing else.
 */
import { useSyncExternalStore } from "react";

import type { Vector2 } from "@/lib/vector2";

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

const EMPTY: Readouts = {};

function PointerAndZoom(props: { readouts: ReadoutStore }) {
    const { readouts } = props;
    const { pointer, scale } = useSyncExternalStore(readouts.subscribe, readouts.get, () => EMPTY);
    return (
        <>
            <span className="w-36">
                {pointer ? `x ${pointer.x.toFixed(2)}  y ${pointer.y.toFixed(2)}` : ""}
            </span>
            <span>{scale ? `${Math.round(scale)} px per diameter` : ""}</span>
        </>
    );
}

/** What's worth a look: bends too tight, locked lengths not met, crossings to check. Each counted, if any. */
export type Warnings = { count: number; one: string; many: string }[];

export function StatusBar(props: { readouts: ReadoutStore; warnings: Warnings; saved: boolean }) {
    const warnings = props.warnings.filter((w) => w.count > 0);
    return (
        <footer className="flex h-7 items-center gap-6 border-t border-line-faint px-3 font-mono text-xs whitespace-pre text-ink-muted">
            <PointerAndZoom readouts={props.readouts} />
            <span className={warnings.length ? "text-warning" : undefined}>
                {warnings.length
                    ? warnings.map((w) => `${w.count} ${w.count === 1 ? w.one : w.many}`).join(", ")
                    : "No warnings"}
            </span>
            <span className="ml-auto">{props.saved ? "Saved" : "Not saved"}</span>
        </footer>
    );
}

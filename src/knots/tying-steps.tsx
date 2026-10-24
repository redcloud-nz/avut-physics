"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useRef, useState } from "react";

import { ARROW_KEYED, swipe } from "@/visual/card";

import type { TyingStep } from "./figure-eight-tying";
import { stepsView, TyingDrawing } from "./tying-drawing";

export const BACK =
    "flex items-center justify-center gap-1 rounded-xl border border-line-faint py-2 text-sm font-medium text-ink hover:border-action disabled:opacity-40 disabled:hover:border-line-faint";
export const NEXT =
    "flex items-center justify-center gap-1 rounded-xl bg-action py-2 text-sm font-medium text-primary-foreground hover:bg-action-hover disabled:opacity-40 disabled:hover:bg-action";

/**
 * Tying a knot a figure at a time, laid out like a page of the visual introduction: where it is in the tying, what to
 * do in this step, and the rope. Back and Next (or swiping sideways, or the arrow keys) move a step at a time, and
 * stop at the first step and the last. It's shown in a dialog, and starts at the first step each time it opens.
 */
export function TyingSteps(props: { name: string; steps: TyingStep[]; onClose: () => void }) {
    const { steps } = props;
    const touch = useRef<{ x: number; y: number } | null>(null);
    const [k, setK] = useState(0);
    const [view] = useState(() => stepsView(steps));
    const step = steps[k];
    const first = k === 0;
    const last = k === steps.length - 1;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // As on the visual introduction's pages: keys with a modifier are the browser's, and controls that use
            // the arrow keys keep them.
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
            if (e.target instanceof Element && e.target.closest(ARROW_KEYED)) return;
            if (e.key === "ArrowLeft" && !first) setK(k - 1);
            if (e.key === "ArrowRight" && !last) setK(k + 1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [k, first, last]);

    return (
        <div
            className="mx-auto flex h-full w-full max-w-md flex-col gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)]"
            onTouchStart={(e) => {
                touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }}
            onTouchEnd={(e) => {
                const start = touch.current;
                touch.current = null;
                if (!start) return;
                const way = swipe(start, e.changedTouches[0]);
                if (way === "left" && !last) setK(k + 1);
                if (way === "right" && !first) setK(k - 1);
            }}
        >
            <header className="flex items-center gap-3 text-xs text-ink-muted">
                <span className="tabular-nums">{step.label}</span>
                <button
                    type="button"
                    onClick={props.onClose}
                    aria-label="Close"
                    className="-mr-1 ml-auto rounded-md p-1 hover:text-highlight"
                >
                    <X className="size-5" aria-hidden />
                </button>
            </header>
            <div className="flex gap-1" aria-hidden>
                {steps.map((_, i) => (
                    <span
                        key={i}
                        className={`h-1 flex-1 rounded-full ${i <= k ? "bg-indicator" : "bg-surface-raised"}`}
                    />
                ))}
            </div>
            <DialogPrimitive.Title className="text-xl leading-tight font-semibold text-ink-bright">
                Tying a {props.name.toLowerCase()}
            </DialogPrimitive.Title>
            {/* Room for three lines, so the rope doesn't jump as captions of different lengths come and go. */}
            <p className="min-h-[3lh] text-ink-soft" aria-live="polite">
                {step.caption}
            </p>

            {/* Sized by the room it's given, not by its drawing, so a short screen squeezes it no smaller than its
                minimum. */}
            <div className="relative flex min-h-48 flex-1 items-center justify-center contain-size">
                <TyingDrawing step={step} view={view} className="absolute inset-0 h-full w-full" />
            </div>

            <nav className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setK(k - 1)} disabled={first} className={BACK}>
                    <ChevronLeft className="size-5" aria-hidden />
                    Back
                </button>
                <button type="button" onClick={() => setK(k + 1)} disabled={last} className={NEXT}>
                    Next
                    <ChevronRight className="size-5" aria-hidden />
                </button>
            </nav>
        </div>
    );
}

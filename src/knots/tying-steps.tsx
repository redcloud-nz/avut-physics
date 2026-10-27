"use client";

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ARROW_KEYED, swipe } from "@/visual/card";

/** A button that moves through the steps: to either end, or a step at a time. */
const MOVE =
    "flex size-11 items-center justify-center rounded-full border border-line-faint text-ink hover:border-action disabled:opacity-40 disabled:hover:border-line-faint";

/** How long playing the steps stays on each before moving to the next (milliseconds). */
const PAUSE = 3000;

/** A step drawn on the server: its label ("Step 2", or "Step 2 (cont.)"), what to do, and its drawing. */
export type DrawnStep = { label: string; caption: string; drawing: ReactNode };

/**
 * Tying a knot a figure at a time, laid out like a page of the visual introduction: what to do in this step, the rope,
 * and where it is in the tying, each step's piece of the progress bar going to it. Buttons at the foot go to the first
 * step, back a step, play or pause, on a step, and to the last step. Playing moves on a step every few seconds, filling
 * the step's piece of the progress bar as it waits, and stops at the last step; playing from there starts again from the first. Moving by hand while playing keeps
 * playing, waiting the full time on the step moved to. Swiping sideways or the arrow keys move a step at a time too,
 * Home and End go to either end, and Space plays and pauses. It's shown in a dialog, and starts at the first step,
 * paused, each time it opens.
 */
export function TyingSteps(props: {
    name: string;
    /** Which variant of the knot it is, where it is one, put in brackets after its name ("on a bight"). */
    variant?: string;
    steps: DrawnStep[];
    onClose: () => void;
}) {
    const { steps } = props;
    const touch = useRef<{ x: number; y: number } | null>(null);
    const [k, setK] = useState(0);
    const [playing, setPlaying] = useState(false);
    const step = steps[k];
    const first = k === 0;
    const last = k === steps.length - 1;

    /** Shows step `i`, stopping playing on the last step, by hand or not. */
    const go = (i: number) => {
        setK(i);
        if (i === steps.length - 1) setPlaying(false);
    };

    // Playing waits on each step in turn, starting the wait again whenever the step changes.
    useEffect(() => {
        // (A knot of one step has nowhere to go.)
        if (!playing || last) return;
        const timer = setTimeout(() => go(k + 1), PAUSE);
        return () => clearTimeout(timer);
    });

    const play = () => {
        if (playing) return setPlaying(false);
        if (last) setK(0);
        setPlaying(true);
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // As on the visual introduction's pages: keys with a modifier are the browser's, and controls that use
            // the arrow keys keep them.
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
            if (e.target instanceof Element && e.target.closest(ARROW_KEYED)) return;
            if (e.key === "ArrowLeft" && !first) go(k - 1);
            if (e.key === "ArrowRight" && !last) go(k + 1);
            if (e.key === "Home") go(0);
            if (e.key === "End") go(steps.length - 1);
            // Space on a focused button presses it, so it plays and pauses only from elsewhere.
            if (e.key === " " && !(e.target instanceof Element && e.target.closest("button"))) {
                e.preventDefault();
                play();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    return (
        <div
            // From `md`, the rope fills a column on the right and the rest stacks on the left, its caption taking up
            // the slack, with the progress bar and the buttons at the foot, centred under both.
            className="mx-auto flex h-full w-full max-w-md flex-col gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)] md:grid md:max-w-none md:grid-cols-[18rem_minmax(0,1fr)] md:grid-rows-[auto_1fr_auto_auto] md:gap-x-6 md:py-4"
            onTouchStart={(e) => {
                touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }}
            onTouchEnd={(e) => {
                const start = touch.current;
                touch.current = null;
                if (!start) return;
                const way = swipe(start, e.changedTouches[0]);
                if (way === "left" && !last) go(k + 1);
                if (way === "right" && !first) go(k - 1);
            }}
        >
            <header className="flex items-center gap-3 md:col-start-1">
                <DialogPrimitive.Title className="text-xl leading-tight font-semibold text-ink-bright">
                    Tying a {props.name.toLowerCase()}
                    {props.variant && ` (${props.variant})`}
                </DialogPrimitive.Title>
                {/* From `md`, in the dialog's corner, over the rope's column. */}
                <button
                    type="button"
                    onClick={props.onClose}
                    aria-label="Close"
                    className="-mr-1 ml-auto shrink-0 rounded-md p-1 text-ink-muted hover:text-highlight md:absolute md:top-3 md:right-4 md:z-10"
                >
                    <X className="size-5" aria-hidden />
                </button>
            </header>
            {/* The step's name and what to do: on a phone the name starts the caption, and from `md` it's a heading over
                it, set apart from the knot's name. Room for three lines of caption, so the rope doesn't jump as
                captions of different lengths come and go. */}
            <div className="flex flex-col gap-1 md:col-start-1 md:mt-4" aria-live="polite">
                <h3 className="hidden text-sm font-semibold text-ink-strong md:block">
                    {step.label}
                </h3>
                <p className="min-h-[3lh] text-ink-soft">
                    <span className="font-semibold text-ink-strong md:hidden">{`${step.label}: `}</span>
                    {step.caption}
                </p>
            </div>

            {/* Sized by the room it's given, not by its drawing, so a short screen squeezes it no smaller than its
                minimum. The rope is drawn as thick as on the knots' pages, shrinking only where it doesn't fit. */}
            <div className="relative min-h-48 flex-1 contain-size md:col-start-2 md:row-span-2 md:row-start-1">
                <div className="absolute inset-0 flex items-center justify-center">
                    {step.drawing}
                </div>
            </div>

            {/* Each step's piece of the bar goes to it, the bar drawn thin in a taller button that's easier to hit. */}
            <div className="-my-2 flex gap-1 md:col-span-2 md:w-72 md:justify-self-center">
                {steps.map((s, i) => (
                    <button
                        key={i}
                        type="button"
                        onClick={() => go(i)}
                        aria-label={s.label}
                        aria-current={i === k ? "step" : undefined}
                        className="group flex-1 py-2"
                    >
                        {/* While playing, the step being shown fills as it waits for the next. */}
                        {i === k && playing ? (
                            <span className="block h-1 overflow-hidden rounded-full bg-surface-raised">
                                <span
                                    key={k}
                                    className="block h-full origin-left bg-indicator"
                                    style={{ animation: `fill-across ${PAUSE}ms linear` }}
                                />
                            </span>
                        ) : (
                            <span
                                className={`block h-1 rounded-full ${i <= k ? "bg-indicator" : "bg-surface-raised group-hover:bg-ghost"}`}
                            />
                        )}
                    </button>
                ))}
            </div>

            <nav className="flex items-center justify-center gap-3 md:col-span-2">
                <button
                    type="button"
                    onClick={() => go(0)}
                    disabled={first}
                    aria-label="First step"
                    className={MOVE}
                >
                    <ChevronFirst className="size-5" aria-hidden />
                </button>
                <button
                    type="button"
                    onClick={() => go(k - 1)}
                    disabled={first}
                    aria-label="Back a step"
                    className={MOVE}
                >
                    <ChevronLeft className="size-5" aria-hidden />
                </button>
                <button
                    type="button"
                    onClick={play}
                    aria-label={playing ? "Pause" : "Play"}
                    className="flex size-13 items-center justify-center rounded-full bg-action text-primary-foreground hover:bg-action-hover"
                >
                    {playing ? (
                        <Pause className="size-6 fill-current" aria-hidden />
                    ) : (
                        <Play className="size-6 translate-x-px fill-current" aria-hidden />
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => go(k + 1)}
                    disabled={last}
                    aria-label="Next step"
                    className={MOVE}
                >
                    <ChevronRight className="size-5" aria-hidden />
                </button>
                <button
                    type="button"
                    onClick={() => go(steps.length - 1)}
                    disabled={last}
                    aria-label="Last step"
                    className={MOVE}
                >
                    <ChevronLast className="size-5" aria-hidden />
                </button>
            </nav>
        </div>
    );
}

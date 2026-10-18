"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DetailsContext } from "./details";
import { SERIES } from "./pages";

/** How far a swipe has to go before it counts, in pixels. */
const SWIPE = 60;

/**
 * One page of the visual introduction, filling the screen: where it is in the series, its headline and text, its
 * figure, and buttons to the pages either side. Swiping sideways or the arrow keys move between pages too.
 *
 * Under the buttons is a pill. When the page has details, swiping up (or tapping the pill) slides the buttons up
 * under the headline and shows the details below them, in place of the text and figure; swiping down puts it back.
 */
export function Card(props: {
    index: number;
    total: number;
    title: string;
    text: React.ReactNode;
    prev: string;
    next: string;
    children: React.ReactNode;
}) {
    const router = useRouter();
    const touch = useRef<{ x: number; y: number; scrolled: boolean } | null>(null);
    const [panel, setPanel] = useState<HTMLDivElement | null>(null);
    const [details, setDetails] = useState(0);
    const [open, setOpen] = useState(false);
    const { prev, next } = props;
    const hasDetails = details > 0;

    const count = useCallback((change: number) => setDetails((n) => n + change), []);
    const context = useMemo(() => ({ target: panel, count }), [panel, count]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Arrow keys on a focused slider move the slider, not the page.
            if (e.target instanceof HTMLInputElement) return;
            if (e.key === "ArrowLeft") router.push(prev);
            if (e.key === "ArrowRight") router.push(next);
            if (e.key === "ArrowUp" && hasDetails) setOpen(true);
            if (e.key === "ArrowDown" || e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [router, prev, next, hasDetails]);

    return (
        <DetailsContext value={context}>
            <main
                className={`mx-auto grid h-full w-full max-w-md shrink-0 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] transition-[grid-template-rows] duration-300 ease-out ${
                    open ? "grid-rows-[auto_0fr_auto_1fr]" : "grid-rows-[auto_1fr_auto_0fr]"
                }`}
                onTouchStart={(e) => {
                    // A drag on a slider, or on a drawing that's dragged, is its own.
                    const target = e.target as Element;
                    if (target instanceof HTMLInputElement || target.closest("[data-no-swipe]"))
                        return (touch.current = null);
                    touch.current = {
                        x: e.touches[0].clientX,
                        y: e.touches[0].clientY,
                        // A swipe down in details scrolled down a way scrolls them, rather than closing them.
                        scrolled: !!panel?.contains(target) && panel.scrollTop > 0,
                    };
                }}
                onTouchEnd={(e) => {
                    const start = touch.current;
                    touch.current = null;
                    if (!start) return;
                    const dx = e.changedTouches[0].clientX - start.x;
                    const dy = e.changedTouches[0].clientY - start.y;
                    if (Math.abs(dx) >= SWIPE && Math.abs(dx) >= 2 * Math.abs(dy)) {
                        router.push(dx < 0 ? next : prev);
                    } else if (Math.abs(dy) >= SWIPE && Math.abs(dy) >= 2 * Math.abs(dx)) {
                        if (dy < 0 && hasDetails) setOpen(true);
                        if (dy > 0 && !start.scrolled) setOpen(false);
                    }
                }}
            >
                <div className="flex flex-col gap-3 pb-3">
                    <header className="flex items-center gap-3 text-xs text-slate-400">
                        <Link href="/visual" className="truncate hover:text-sky-300">
                            {SERIES}
                        </Link>
                        <span className="ml-auto shrink-0 tabular-nums">
                            {props.index + 1} / {props.total}
                        </span>
                    </header>
                    <div className="flex gap-1" aria-hidden>
                        {Array.from({ length: props.total }, (_, i) => (
                            <span
                                key={i}
                                className={`h-1 flex-1 rounded-full ${i <= props.index ? "bg-sky-400" : "bg-slate-800"}`}
                            />
                        ))}
                    </div>
                    <h1 className="text-2xl leading-tight font-semibold text-slate-50">
                        {props.title}
                    </h1>
                </div>

                <div
                    className={`flex min-h-0 flex-col gap-3 overflow-hidden transition-opacity duration-300 ${open ? "opacity-0" : ""}`}
                    inert={open}
                >
                    <p className="text-slate-300">{props.text}</p>
                    {props.children}
                </div>

                <div className="flex flex-col items-center pt-3">
                    <nav className="grid w-full grid-cols-2 gap-3">
                        <Link
                            href={prev}
                            className="rounded-xl border border-slate-700 py-2 text-center text-sm font-medium text-slate-200 hover:border-sky-500"
                        >
                            ‹ Back
                        </Link>
                        <Link
                            href={next}
                            className="rounded-xl bg-sky-500 py-2 text-center text-sm font-medium text-slate-950 hover:bg-sky-400"
                        >
                            {props.index + 1 === props.total ? "Finish" : "Next ›"}
                        </Link>
                    </nav>
                    <button
                        type="button"
                        disabled={!hasDetails}
                        aria-expanded={open}
                        aria-label={
                            hasDetails
                                ? open
                                    ? "Hide the details"
                                    : "Show the details"
                                : "No details on this page"
                        }
                        onClick={() => setOpen(!open)}
                        className="group flex h-6 w-20 items-center justify-center"
                    >
                        <span
                            className={`h-1.5 w-10 rounded-full transition-colors ${
                                hasDetails ? "bg-slate-400 group-hover:bg-sky-400" : "bg-slate-800"
                            }`}
                        />
                    </button>
                </div>

                <div
                    ref={setPanel}
                    className="min-h-0 overflow-y-auto overscroll-contain"
                    inert={!open}
                    aria-hidden={!open}
                />
            </main>
        </DetailsContext>
    );
}

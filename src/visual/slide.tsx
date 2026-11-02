"use client";

import { ChevronLeft, ChevronRight, Maximize, Minimize, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { ARROW_KEYED } from "./card";
import { SERIES } from "./series";

/** Controls that Space presses, rather than the slides taking it. */
const SPACE_KEYED = "button, a, input, select, textarea, [contenteditable], [role=radio]";

function subscribeFullscreen(change: () => void) {
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
}

/** For what's read once in the browser and doesn't change. */
const noSubscribe = () => () => {};

function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
}

/**
 * One slide of the series presented, filling the window: a page's headline and text beside its figure, which works as
 * it does on the page, or a section's heading. Its progress through the series runs along the top.
 *
 * The arrow keys, Page Up and Page Down, and Space move between slides, so a presentation clicker works them. A
 * focused slider keeps the arrow keys for itself, but Page Up and Page Down always change the slide: clickers send
 * those, and a slider left focused after it's dragged mustn't swallow them. Home and End go to the first and last
 * slides, F fills the screen, and Escape goes back to the page being presented.
 */
export function Slide(props: {
    /** The slide's place in the series, from 0. */
    index: number;
    total: number;
    /** What runs along the top beside the series' name: the section the slide is in. */
    section?: string;
    prev?: string;
    next?: string;
    first: string;
    last: string;
    /** Where Escape leaves the presentation for. */
    exit: string;
    children: React.ReactNode;
}) {
    const router = useRouter();
    const { prev, next, first, last, exit } = props;
    const fullscreen = useSyncExternalStore(
        subscribeFullscreen,
        () => !!document.fullscreenElement,
        () => false,
    );
    // The browser may not allow filling the screen (an iPhone doesn't), so the button only shows where it can.
    const canFill = useSyncExternalStore(
        noSubscribe,
        () => document.fullscreenEnabled,
        () => false,
    );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
            const target = e.target instanceof Element ? e.target : null;
            const go = (href: string | undefined) => {
                e.preventDefault();
                if (href) router.push(href);
            };
            if (e.key === "PageDown") return go(next);
            if (e.key === "PageUp") return go(prev);
            if (e.shiftKey) return;
            if (e.key === " " && !target?.closest(SPACE_KEYED)) return go(next);
            if (target?.closest(ARROW_KEYED)) return;
            if (e.key === "ArrowRight" || e.key === "ArrowDown") return go(next);
            if (e.key === "ArrowLeft" || e.key === "ArrowUp") return go(prev);
            if (e.key === "Home") return go(first);
            if (e.key === "End") return go(last);
            if (e.key === "Escape" && !document.fullscreenElement) return go(exit);
            if (e.key === "f" || e.key === "F") {
                e.preventDefault();
                toggleFullscreen();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [router, prev, next, first, last, exit]);

    const button =
        "flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-raised hover:text-highlight";

    return (
        <div className="presenting flex h-dvh flex-col gap-4 bg-background px-4 pt-3 pb-3 lg:px-10 lg:pt-5">
            <header className="flex items-center gap-4 text-sm text-ink-muted">
                <span className="min-w-0 truncate">
                    {SERIES}
                    {props.section && <span className="text-ghost"> · {props.section}</span>}
                </span>
                <div className="hidden flex-1 gap-1 sm:flex" aria-hidden>
                    {Array.from({ length: props.total }, (_, i) => (
                        <span
                            key={i}
                            className={`h-1 flex-1 rounded-full ${i <= props.index ? "bg-indicator" : "bg-surface-raised"}`}
                        />
                    ))}
                </div>
                <span className="ml-auto shrink-0 tabular-nums sm:ml-0">
                    {props.index + 1} / {props.total}
                </span>
            </header>

            <div className="flex min-h-0 flex-1 flex-col">{props.children}</div>

            {/* Kept faint, out of the way of what's being shown, for a presenter without a keyboard or clicker. The
                slides either side are prefetched whole, so moving to them doesn't wait. */}
            <nav className="flex items-center gap-1 text-ink-muted" aria-label="Slides">
                {prev ? (
                    <Link href={prev} prefetch aria-label="Previous slide" className={button}>
                        <ChevronLeft className="size-5" aria-hidden />
                    </Link>
                ) : (
                    <span className={`${button} opacity-30`} aria-hidden>
                        <ChevronLeft className="size-5" />
                    </span>
                )}
                {next ? (
                    <Link href={next} prefetch aria-label="Next slide" className={button}>
                        <ChevronRight className="size-5" aria-hidden />
                    </Link>
                ) : (
                    <span className={`${button} opacity-30`} aria-hidden>
                        <ChevronRight className="size-5" />
                    </span>
                )}
                <span className="ml-auto" />
                {canFill && (
                    <button
                        type="button"
                        onClick={toggleFullscreen}
                        aria-label={fullscreen ? "Leave full screen" : "Full screen"}
                        className={button}
                    >
                        {fullscreen ? (
                            <Minimize className="size-4" aria-hidden />
                        ) : (
                            <Maximize className="size-4" aria-hidden />
                        )}
                    </button>
                )}
                <Link href={exit} aria-label="Stop presenting" className={button}>
                    <X className="size-5" aria-hidden />
                </Link>
            </nav>
        </div>
    );
}

/** A page's slide: its headline and text, with its figure beside them on a wide screen, under them on a narrow one. */
export function PageSlide(props: {
    title: string;
    text: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <main className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-1 lg:gap-12">
            <div className="flex flex-col gap-4 lg:justify-center lg:pb-16">
                <h1 className="text-2xl leading-tight font-semibold text-ink-bright lg:text-4xl">
                    {props.title}
                </h1>
                <p className="text-lg text-ink-soft lg:text-2xl lg:leading-snug">{props.text}</p>
            </div>
            <div className="flex min-h-0 flex-col">{props.children}</div>
        </main>
    );
}

/** The slide that opens a section: its title, and the pages in it. */
export function SectionSlide(props: {
    title: string;
    /** Which section this is, from 1, of how many. */
    number: number;
    count: number;
    /** The titles of the pages in it. */
    pages: string[];
}) {
    return (
        <main className="flex min-h-0 flex-1 flex-col justify-center gap-6 overflow-y-auto lg:px-[8%]">
            <p className="text-sm font-medium tracking-wide text-ink-muted uppercase lg:text-base">
                Part {props.number} of {props.count}
            </p>
            <h1 className="text-4xl leading-tight font-semibold text-ink-bright lg:text-6xl">
                {props.title}
            </h1>
            <ol className="flex list-inside list-decimal flex-col gap-1 text-lg text-ink-soft marker:text-ghost lg:text-2xl">
                {props.pages.map((title) => (
                    <li key={title}>{title}</li>
                ))}
            </ol>
        </main>
    );
}

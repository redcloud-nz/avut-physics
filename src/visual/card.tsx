"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

import { SERIES } from "./series";

/** How far a swipe has to go before it counts, in pixels. */
const SWIPE = 60;

/** Which way a touch went, if far enough and clearly enough sideways to count as a swipe. */
function swipe(start: { x: number; y: number }, end: { clientX: number; clientY: number }) {
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.abs(dx) >= SWIPE && Math.abs(dx) >= 2 * Math.abs(dy)) return dx < 0 ? "left" : "right";
    return null;
}

/**
 * One page of the visual introduction, filling the screen: where it is in the series, its headline and text, its
 * figure, and buttons to the pages either side. Swiping sideways or the arrow keys move between pages too.
 *
 * Between the buttons is a pill. When the page has details, tapping the pill brings them up in a drawer over the page;
 * dragging it down puts it away. Tapping the series' name at the top brings its contents down from the top in the
 * same way. On a screen too short for the page, the page grows and scrolls rather than running under the buttons.
 */
export function Card(props: {
    index: number;
    /** Every page in the series, in order, for the contents. */
    contents: { name: string; href: string }[];
    title: string;
    text: React.ReactNode;
    prev: string;
    next: string;
    /** More for readers who want it, in the drawer. */
    details?: React.ReactNode;
    children: React.ReactNode;
}) {
    const router = useRouter();
    const touch = useRef<{ x: number; y: number } | null>(null);
    const [open, setOpen] = useState(false);
    const [contents, setContents] = useState(false);
    const { prev, next } = props;
    const total = props.contents.length;
    const hasDetails = !!props.details;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Arrow keys on a focused slider move the slider, not the page. The drawers handle their own keys.
            if (e.target instanceof HTMLInputElement || open || contents) return;
            if (e.key === "ArrowLeft") router.push(prev);
            if (e.key === "ArrowRight") router.push(next);
            if (e.key === "ArrowUp" && hasDetails) setOpen(true);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [router, prev, next, hasDetails, open, contents]);

    return (
        <>
            <main
                className="mx-auto flex min-h-full w-full max-w-md shrink-0 flex-col gap-3 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.5rem)]"
                onTouchStart={(e) => {
                    // A drag on a slider, or on a drawing that's dragged, is its own.
                    const target = e.target as Element;
                    if (target instanceof HTMLInputElement || target.closest("[data-no-swipe]"))
                        return (touch.current = null);
                    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }}
                onTouchEnd={(e) => {
                    const start = touch.current;
                    touch.current = null;
                    if (!start) return;
                    const way = swipe(start, e.changedTouches[0]);
                    if (way === "left") router.push(next);
                    if (way === "right") router.push(prev);
                }}
            >
                <header className="flex items-center gap-3 text-xs text-slate-400">
                    <button
                        type="button"
                        onClick={() => setContents(true)}
                        aria-label={`${SERIES}: contents`}
                        className="flex min-w-0 items-center gap-1 hover:text-sky-300"
                    >
                        <span className="truncate">{SERIES}</span>
                        <ChevronDown className="size-3.5 shrink-0" aria-hidden />
                    </button>
                    <span className="ml-auto shrink-0 tabular-nums">
                        {props.index + 1} / {total}
                    </span>
                </header>
                <div className="flex gap-1" aria-hidden>
                    {Array.from({ length: total }, (_, i) => (
                        <span
                            key={i}
                            className={`h-1 flex-1 rounded-full ${i <= props.index ? "bg-sky-400" : "bg-slate-800"}`}
                        />
                    ))}
                </div>
                <h1 className="text-xl leading-tight font-semibold text-slate-50">{props.title}</h1>
                <p className="text-slate-300">{props.text}</p>

                <div className="flex flex-1 flex-col">{props.children}</div>

                <nav className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <Link
                        href={prev}
                        className="flex items-center justify-center gap-1 rounded-xl border border-slate-700 py-2 text-sm font-medium text-slate-200 hover:border-sky-500"
                    >
                        <ChevronLeft className="size-5" aria-hidden />
                        Back
                    </Link>
                    <button
                        type="button"
                        disabled={!hasDetails}
                        aria-label={hasDetails ? "Show the details" : "No details on this page"}
                        onClick={() => setOpen(true)}
                        className="group flex h-10 w-16 items-center justify-center"
                    >
                        <Pill
                            className={
                                hasDetails ? "bg-slate-400 group-hover:bg-sky-400" : "bg-slate-800"
                            }
                        />
                    </button>
                    <Link
                        href={next}
                        className="flex items-center justify-center gap-1 rounded-xl bg-sky-500 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400"
                    >
                        {props.index + 1 === total ? (
                            "Finish"
                        ) : (
                            <>
                                Next
                                <ChevronRight className="size-5" aria-hidden />
                            </>
                        )}
                    </Link>
                </nav>
            </main>

            <Drawer open={open} onOpenChange={setOpen}>
                <DrawerContent
                    aria-describedby={undefined}
                    className="mx-auto max-h-[85dvh] max-w-md border-slate-700 bg-slate-900 text-base text-slate-300"
                >
                    <DrawerTitle className="sr-only">More on: {props.title}</DrawerTitle>
                    <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
                        {props.details}
                    </div>
                </DrawerContent>
            </Drawer>

            <Drawer open={contents} onOpenChange={setContents} direction="top">
                <DrawerContent
                    aria-describedby={undefined}
                    className="mx-auto max-h-[85dvh] max-w-md border-slate-700 bg-slate-900 pt-[env(safe-area-inset-top)] text-base text-slate-300"
                >
                    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pt-4 pb-2">
                        <DrawerTitle className="text-base font-semibold text-slate-100">
                            {SERIES}
                        </DrawerTitle>
                        <ol className="flex flex-col">
                            {props.contents.map((page, i) => (
                                <li key={page.href}>
                                    <Link
                                        href={page.href}
                                        aria-current={i === props.index ? "page" : undefined}
                                        // Next keeps the page being left, hidden, for coming back to: leave it
                                        // with its contents put away.
                                        onClick={() => setContents(false)}
                                        className={`flex gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-800 ${
                                            i === props.index ? "bg-slate-800 text-sky-300" : ""
                                        }`}
                                    >
                                        <span className="w-5 shrink-0 text-right text-slate-500 tabular-nums">
                                            {i + 1}
                                        </span>
                                        {page.name}
                                    </Link>
                                </li>
                            ))}
                        </ol>
                        <Link
                            href="/"
                            onClick={() => setContents(false)}
                            className="px-2 text-sm text-sky-400 hover:text-sky-300"
                        >
                            ← Physics Visualisations
                        </Link>
                    </div>
                    <button
                        type="button"
                        aria-label="Hide the contents"
                        onClick={() => setContents(false)}
                        className="group flex h-7 w-full shrink-0 items-center justify-center"
                    >
                        <Pill className="bg-slate-500 group-hover:bg-sky-400" />
                    </button>
                </DrawerContent>
            </Drawer>
        </>
    );
}

/** The grab handle drawn on the pill buttons. */
function Pill(props: { className: string }) {
    return <span className={`h-1.5 w-10 rounded-full transition-colors ${props.className}`} />;
}

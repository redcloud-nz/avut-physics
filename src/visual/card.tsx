"use client";

import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

import { ContentsList, pageCount, type Contents } from "./contents";
import { useDetailsPanel } from "./details-panel";
import { SERIES } from "./series";

/** Controls that use the arrow keys themselves. */
export const ARROW_KEYED =
    "input, select, textarea, [contenteditable], [role=radio], [role=slider], [data-arrow-keys]";

/** How far a swipe has to go before it counts, in pixels. */
const SWIPE = 60;

/** Wide enough for the details to have a column of their own, beside the page (Tailwind's `xl`). */
const WIDE = "(min-width: 80rem)";

function subscribeWide(change: () => void) {
    const query = window.matchMedia(WIDE);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
}

/** Which way a touch went, if far enough and clearly enough sideways to count as a swipe. */
export function swipe(start: { x: number; y: number }, end: { clientX: number; clientY: number }) {
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.abs(dx) >= SWIPE && Math.abs(dx) >= 2 * Math.abs(dy)) return dx < 0 ? "left" : "right";
    return null;
}

/**
 * One page of the visual introduction, filling the screen: where it is in the series, its headline and text, its
 * figure, and buttons to the pages either side. Swiping sideways or the arrow keys move between pages too.
 *
 * Between the buttons is a question mark. When the page has details, tapping it brings them up in a drawer over the
 * page; dragging it down puts it away. On a screen wide enough, the question mark is at the end of the progress bar
 * instead, and opens and closes a column to the right of the page, which stays open from page to page until closed. Tapping the series' name at the top brings its
 * contents down from the top like the details, except on a wide screen, where the contents are beside the page
 * already. On a screen too short for the page, the page grows and scrolls rather than running under the buttons.
 */
export function Card(props: {
    index: number;
    /** Every page in the series, in its sections, for the contents. */
    contents: Contents;
    title: string;
    text: React.ReactNode;
    prev: string;
    next: string;
    /** More for readers who want it, in the drawer or the column beside the page. */
    details?: React.ReactNode;
    children: React.ReactNode;
}) {
    const router = useRouter();
    const touch = useRef<{ x: number; y: number } | null>(null);
    const [open, setOpen] = useState(false);
    const [contents, setContents] = useState(false);
    const [panel, setPanel] = useDetailsPanel();
    const { prev, next } = props;
    const total = pageCount(props.contents);
    const hasDetails = !!props.details;
    // The server's page is drawn narrow; a wide screen puts the details beside the page once it's in the browser.
    const wide = useSyncExternalStore(
        subscribeWide,
        () => window.matchMedia(WIDE).matches,
        () => false,
    );
    // Widened with the drawer up, the drawer goes; the column stays shut until it's asked for.
    const drawer = open && !wide;
    const showDetails = wide ? () => setPanel(!panel) : () => setOpen(true);

    /** The question mark that brings up the details, drawn at the size and place `className` gives it. */
    const detailsButton = (className: string) => (
        <button
            type="button"
            disabled={!hasDetails}
            aria-label={
                !hasDetails
                    ? "No details on this page"
                    : wide && panel
                      ? "Hide the details"
                      : "Show the details"
            }
            aria-expanded={hasDetails ? (wide ? panel : drawer) : undefined}
            onClick={showDetails}
            className={`flex shrink-0 items-center justify-center rounded-full border font-semibold ${className} ${
                !hasDetails
                    ? "border-line-faint text-ghost opacity-40"
                    : wide && panel
                      ? "border-action text-highlight"
                      : "border-line-faint text-ink-muted hover:border-action hover:text-highlight"
            }`}
        >
            <span aria-hidden>?</span>
        </button>
    );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Arrow keys on a focused slider or choice move it, not the page, and with a modifier they're the
            // browser's (Alt+← is Back). The drawers handle their own keys.
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
            if (e.target instanceof Element && e.target.closest(ARROW_KEYED)) return;
            if (drawer || contents) return;
            if (e.key === "ArrowLeft") router.push(prev);
            if (e.key === "ArrowRight") router.push(next);
            if (e.key === "ArrowUp" && hasDetails) {
                if (wide) setPanel(!panel);
                else setOpen(true);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [router, prev, next, hasDetails, wide, panel, setPanel, drawer, contents]);

    return (
        <div className="flex min-h-full shrink-0">
            <main
                className="mx-auto flex min-h-full w-full max-w-md min-w-0 flex-col gap-3 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] lg:max-w-2xl"
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
                {/* On a phone, the series' name and the page's place in it, with the progress bar on a line of its own
                    under them. From the width the name goes (the contents are beside the page then), the bar moves up
                    alongside the place, and where the details open beside the page, the button to them joins it. */}
                <header className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                    <button
                        type="button"
                        onClick={() => setContents(true)}
                        aria-label={`${SERIES}: contents`}
                        className="flex min-w-0 items-center gap-1 hover:text-highlight lg:hidden"
                    >
                        <span className="truncate">{SERIES}</span>
                        <ChevronDown className="size-3.5 shrink-0" aria-hidden />
                    </button>
                    <span className="ml-auto shrink-0 tabular-nums">
                        {props.index + 1} / {total}
                    </span>
                    <div
                        className="flex basis-full gap-1 lg:order-first lg:basis-0 lg:flex-1"
                        aria-hidden
                    >
                        {Array.from({ length: total }, (_, i) => (
                            <span
                                key={i}
                                className={`h-1 flex-1 rounded-full ${i <= props.index ? "bg-indicator" : "bg-surface-raised"}`}
                            />
                        ))}
                    </div>
                    {detailsButton("hidden size-7 text-sm xl:flex")}
                </header>
                <h1 className="text-xl leading-tight font-semibold text-ink-bright">
                    {props.title}
                </h1>
                <p className="text-ink-soft">{props.text}</p>

                <div className="flex flex-1 flex-col">{props.children}</div>

                {/* The pages either side are prefetched whole, not only the route's shared shell, so moving to them
                    (by button or by swipe) doesn't wait on the server. */}
                <nav className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 xl:grid-cols-2">
                    <Link
                        href={prev}
                        prefetch
                        className="flex items-center justify-center gap-1 rounded-xl border border-line-faint py-2 text-sm font-medium text-ink hover:border-action"
                    >
                        <ChevronLeft className="size-5" aria-hidden />
                        Back
                    </Link>
                    {detailsButton("mx-2 size-10 text-lg xl:hidden")}
                    <Link
                        href={next}
                        prefetch
                        className="flex items-center justify-center gap-1 rounded-xl bg-action py-2 text-sm font-medium text-primary-foreground hover:bg-action-hover"
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

            {wide && panel && (
                // It takes the room either side of the page before the page is centred in what's left, up to the
                // page's own width; on a narrower screen, the page gives up room to it.
                <aside
                    aria-label="More on this page"
                    className="panel-scroll sticky top-0 flex h-dvh max-w-2xl min-w-104 flex-1 shrink-0 flex-col gap-5 overflow-y-auto overscroll-contain border-l border-line-faint px-4 pt-3 pb-4 text-base text-ink-soft"
                >
                    <header className="flex items-center justify-between text-xs text-ink-muted">
                        <h2>More on this page</h2>
                        <button
                            type="button"
                            aria-label="Close the details"
                            onClick={() => setPanel(false)}
                            className="-m-1 rounded p-1 hover:text-highlight"
                        >
                            <X className="size-4" aria-hidden />
                        </button>
                    </header>
                    {props.details ?? (
                        <p className="text-sm text-ghost">Nothing more on this page.</p>
                    )}
                </aside>
            )}

            {/* As wide as the page, and on a wide screen over the page's column: clear of the contents to its left (as
                wide as the sidebar) and of the page's scrollbar to its right (as wide as globals.css draws it). */}
            <Drawer open={drawer} onOpenChange={setOpen}>
                <DrawerContent
                    aria-describedby={undefined}
                    className="mx-auto max-h-[85dvh] max-w-md border-line-faint bg-surface text-base text-ink-soft lg:max-w-2xl data-[vaul-drawer-direction=bottom]:lg:right-3 data-[vaul-drawer-direction=bottom]:lg:left-72"
                >
                    <DrawerTitle className="sr-only">More on: {props.title}</DrawerTitle>
                    <div
                        // As with the contents, a link followed from the details leaves them put away.
                        onClickCapture={(e) => {
                            if ((e.target as Element).closest("a")) setOpen(false);
                        }}
                        className="panel-scroll flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]"
                    >
                        {props.details}
                    </div>
                </DrawerContent>
            </Drawer>

            <Drawer open={contents} onOpenChange={setContents} direction="top">
                <DrawerContent
                    aria-describedby={undefined}
                    className="mx-auto max-h-[85dvh] max-w-md border-line-faint bg-surface pt-[env(safe-area-inset-top)] text-base text-ink-soft"
                >
                    <div className="panel-scroll flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pt-4 pb-2">
                        <DrawerTitle className="text-base font-semibold text-ink-strong">
                            {SERIES}
                        </DrawerTitle>
                        {/* Next keeps the page being left, hidden, for coming back to: leave it with its contents put
                            away. */}
                        <ContentsList
                            contents={props.contents}
                            current={props.index}
                            onFollow={() => setContents(false)}
                        />
                        <Link
                            href="/"
                            onClick={() => setContents(false)}
                            className="px-2 text-sm text-link hover:text-highlight"
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
                        <Pill className="bg-ghost group-hover:bg-indicator" />
                    </button>
                </DrawerContent>
            </Drawer>
        </div>
    );
}

/** The grab handle drawn on the button that puts the contents away. */
function Pill(props: { className: string }) {
    return <span className={`h-1.5 w-10 rounded-full transition-colors ${props.className}`} />;
}

"use client";

import { ChevronLeft, ChevronRight, Gauge, Info, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { OVERLAY_CONTROL } from "@/components/overlay-control";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { DETAILS, type Detail, type DetailChoice } from "./detail";

/** The controls over a scene's drawing: its legend, detail, zoom, and stepping between targets. */

/**
 * The legend, or a button to show it. Until it's opened or closed, it's open on wide screens and closed on phones, where
 * it'd cover the drawing. Its parent places it (`className` sets its width).
 */
export function LegendPanel({
    className = "w-72",
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    const [open, setOpen] = useState<boolean | null>(null);
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Show the legend"
                title="Legend"
                className={`${OVERLAY_CONTROL} w-9 shrink-0 ${
                    open === null ? "flex sm:hidden" : open ? "hidden" : "flex"
                }`}
            >
                <Info />
            </button>
            <section
                className={`min-h-0 max-w-full overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface/90 p-3 shadow-lg backdrop-blur ${className} ${
                    open === null ? "hidden sm:block" : open ? "block" : "hidden"
                }`}
            >
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Hide the legend"
                    className="flex w-full items-center justify-between text-sm font-medium text-ink-strong"
                >
                    Legend
                    <X className="size-4 text-ink-soft" />
                </button>
                {children}
            </section>
        </>
    );
}

/**
 * A menu for how finely the scene's drawn. With `auto` (the level Auto's at now), it offers Auto too, which follows the
 * frame rate.
 */
export function DetailMenu({
    choice,
    onChoose,
    auto,
    side = "bottom",
    align = "end",
}: {
    choice: DetailChoice;
    onChoose: (c: DetailChoice) => void;
    auto?: Detail;
    side?: "top" | "bottom";
    align?: "start" | "end";
}) {
    const levels = Object.keys(DETAILS) as Detail[];
    const choices: DetailChoice[] = auto ? ["auto", ...levels] : levels;
    const now =
        choice === "auto" ? `Auto, ${DETAILS[auto ?? "medium"].label}` : DETAILS[choice].label;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={`Detail: ${now}`}
                    title="Detail"
                    className={`${OVERLAY_CONTROL} w-9 shrink-0`}
                >
                    <Gauge />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                side={side}
                align={align}
                className={auto ? "min-w-52" : "min-w-44"}
            >
                <DropdownMenuLabel>Detail</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                    value={choice}
                    onValueChange={(c) => onChoose(c as DetailChoice)}
                >
                    {choices.map((c) => (
                        <DropdownMenuRadioItem key={c} value={c}>
                            {c === "auto"
                                ? `Auto (now ${DETAILS[auto!].label.toLowerCase()})`
                                : DETAILS[c].label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                {auto && (
                    <p className="max-w-52 px-1.5 pt-1 pb-1.5 text-xs text-ink-muted">
                        Auto follows the frame rate: less detail if it stutters, more if
                        there&rsquo;s room.
                    </p>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Zoom in and out by `by`, and go back to the start, in a column over the drawing's bottom right. */
export function ZoomButtons({
    onZoom,
    onReset,
    nearest = false,
    furthest = false,
    resetLabel = "Show the whole view again",
    by = 1.4,
}: {
    onZoom: (factor: number) => void;
    onReset: () => void;
    /** Zoomed in, or out, as far as it goes: that button's off. */
    nearest?: boolean;
    furthest?: boolean;
    resetLabel?: string;
    by?: number;
}) {
    return (
        <div className="absolute right-2 bottom-2 flex flex-col overflow-hidden rounded-lg border border-border bg-surface/90 shadow-lg backdrop-blur">
            {[
                { label: "Zoom in", icon: <Plus />, onClick: () => onZoom(by), off: nearest },
                {
                    label: "Zoom out",
                    icon: <Minus />,
                    onClick: () => onZoom(1 / by),
                    off: furthest,
                },
                { label: resetLabel, icon: <RotateCcw />, onClick: onReset, off: false },
            ].map((b) => (
                <button
                    key={b.label}
                    type="button"
                    aria-label={b.label}
                    title={b.label}
                    onClick={b.onClick}
                    disabled={b.off}
                    className="flex size-9 items-center justify-center text-ink-soft transition-colors hover:bg-line-faint disabled:opacity-40 [&_svg]:size-4"
                >
                    {b.icon}
                </button>
            ))}
        </div>
    );
}

/** Back to the target before, or on to the next: big arrows at the drawing's left and right edges. */
export function StepButtons({ onStep }: { onStep: (by: number) => void }) {
    return [
        { by: -1, label: "Look at the one before", title: "Previous", icon: <ChevronLeft /> },
        { by: 1, label: "Look at the next one", title: "Next", icon: <ChevronRight /> },
    ].map((b) => (
        <button
            key={b.by}
            type="button"
            aria-label={b.label}
            title={b.title}
            onClick={() => onStep(b.by)}
            className={`absolute top-1/2 z-10 flex size-14 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft drop-shadow-[0_0_3px_var(--halo)] transition-colors hover:bg-surface/50 hover:text-ink-strong [&_svg]:size-11 ${
                b.by < 0 ? "left-1" : "right-1"
            }`}
        >
            {b.icon}
        </button>
    ));
}

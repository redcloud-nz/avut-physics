"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Fragment, useState } from "react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

export function Slider(props: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    digits?: number;
    disabled?: boolean;
    onChange: (v: number) => void;
}) {
    return (
        <label
            className={`flex flex-col gap-1 text-sm text-ink-soft ${props.disabled ? "opacity-40" : ""}`}
        >
            <span className="flex justify-between gap-2">
                {props.label}
                <span className="shrink-0 font-mono whitespace-nowrap text-ink-muted">
                    {props.value.toFixed(props.digits ?? 1)}
                    {props.unit && ` ${props.unit}`}
                </span>
            </span>
            <input
                type="range"
                min={props.min}
                max={props.max}
                step={props.step}
                value={props.value}
                disabled={props.disabled}
                onChange={(e) => props.onChange(Number(e.target.value))}
                className="accent-action"
            />
        </label>
    );
}

export function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
                type="checkbox"
                checked={props.checked}
                onChange={(e) => props.onChange(e.target.checked)}
                className="accent-action"
            />
            {props.label}
        </label>
    );
}

/**
 * A small segmented control for picking one of a few options. Like any radio group it's one stop for Tab, and the
 * arrow keys move between its options.
 */
export function Choice<T extends string>(props: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
}) {
    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const step =
            e.key === "ArrowRight" || e.key === "ArrowDown"
                ? 1
                : e.key === "ArrowLeft" || e.key === "ArrowUp"
                  ? -1
                  : 0;
        if (!step) return;
        e.preventDefault();
        const n = props.options.length;
        const at = props.options.findIndex((o) => o.value === props.value);
        const next = (at + step + n) % n;
        props.onChange(props.options[next].value);
        e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
    };
    return (
        <div className="flex flex-col gap-1 text-sm text-ink-soft">
            {props.label}
            <div
                className="flex rounded-lg bg-surface-raised p-0.5"
                role="radiogroup"
                aria-label={props.label}
                onKeyDown={onKeyDown}
            >
                {props.options.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={o.value === props.value}
                        tabIndex={o.value === props.value ? 0 : -1}
                        onClick={() => props.onChange(o.value)}
                        className={`flex-1 rounded-md px-2 py-1 text-sm transition-colors ${
                            o.value === props.value
                                ? "bg-action text-primary-foreground"
                                : "text-ink-soft hover:bg-line-faint"
                        }`}
                    >
                        {o.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

/** A dropdown for picking one of many options, optionally in groups. */
export function Select<T extends string>(props: {
    label: string;
    value: T;
    groups: { label?: string; options: { value: T; label: string }[] }[];
    onChange: (v: T) => void;
}) {
    const options = (g: (typeof props.groups)[number]) =>
        g.options.map((o) => (
            <option key={o.value} value={o.value}>
                {o.label}
            </option>
        ));
    return (
        <label className="flex flex-col gap-1 text-sm text-ink-soft">
            {props.label}
            <select
                value={props.value}
                onChange={(e) => props.onChange(e.target.value as T)}
                className="rounded-lg border border-line-faint bg-surface-raised px-2 py-1.5 text-sm text-ink focus:ring-2 focus:ring-action focus:outline-none"
            >
                {props.groups.map((g, i) =>
                    g.label ? (
                        <optgroup key={g.label} label={g.label}>
                            {options(g)}
                        </optgroup>
                    ) : (
                        <Fragment key={i}>{options(g)}</Fragment>
                    ),
                )}
            </select>
        </label>
    );
}

/** Shown in a readout in place of a value that doesn't apply. */
export const NONE = "—";

/** A labelled read-only value, e.g. a computed force. */
export function Readout(props: { label: string; value: string; color?: string }) {
    return (
        <div className="flex justify-between text-sm">
            <span className="whitespace-pre-wrap text-ink-muted">{props.label}</span>
            <span className="font-mono" style={{ color: props.color ?? "var(--ink)" }}>
                {props.value}
            </span>
        </div>
    );
}

/** Wraps the less-used controls: collapsed on desktop, so the readouts sit higher; shown as-is in the sheet. */
type More = (children: React.ReactNode) => React.ReactNode;

const collapsed: More = (children) => (
    <Collapsible className="flex flex-col gap-4">
        <CollapsibleTrigger asChild>
            <Button
                variant="ghost"
                size="sm"
                className="group h-auto justify-between px-0 text-sm font-normal text-ink-soft hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-ink-soft"
            >
                More settings
                <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
            </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4">{children}</CollapsibleContent>
    </Collapsible>
);
const expanded: More = (children) => children;

/**
 * Standard layout: diagram on the left, controls and readouts on the right. Below the `lg` breakpoint the
 * controls move into a sheet along the bottom, opened by a button in the diagram's corner: it covers at most
 * the lower part of the screen and doesn't dim the page, so the diagram stays in view as the sliders move.
 * `controls` can be a function that passes its less-used controls through `more`, which collapses them on
 * desktop.
 */
export function VisualisationLayout(props: {
    diagram: React.ReactNode;
    controls: React.ReactNode | ((more: More) => React.ReactNode);
    readouts?: React.ReactNode;
    footer?: React.ReactNode;
}) {
    const controls = (more: More) =>
        typeof props.controls === "function" ? props.controls(more) : props.controls;
    return (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="relative overflow-hidden rounded-xl border border-border bg-surface">
                {props.diagram}
                <Sheet modal={false}>
                    <SheetTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            className="absolute top-2 right-2 lg:hidden"
                            aria-label="Settings"
                        >
                            <SlidersHorizontal />
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        side="bottom"
                        className="max-h-[45dvh] gap-0 overflow-y-auto overscroll-contain"
                    >
                        <SheetHeader className="pb-2">
                            <SheetTitle>Settings</SheetTitle>
                            <SheetDescription className="sr-only">
                                Change the setup. The diagram follows as you go.
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex flex-col gap-4 px-4 pb-4">{controls(expanded)}</div>
                    </SheetContent>
                </Sheet>
            </div>
            <div className="flex flex-col gap-4">
                <section className="hidden flex-col gap-4 rounded-xl border border-border bg-surface/50 p-4 lg:flex">
                    {controls(collapsed)}
                </section>
                {props.readouts && (
                    <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface/50 p-4">
                        {props.readouts}
                    </section>
                )}
            </div>
            {props.footer && <div className="lg:col-span-2">{props.footer}</div>}
        </div>
    );
}

/** A card showing raw values as JSON, with a button to copy them. */
export function RawValues(props: { title: string; data: unknown }) {
    const [copied, setCopied] = useState(false);
    const text = JSON.stringify(
        props.data,
        (_, v) => (typeof v === "number" ? Number(v.toPrecision(6)) : v),
        2,
    );
    const copy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface/50 p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-ink-soft">{props.title}</h3>
                <button
                    onClick={copy}
                    className="rounded-md bg-surface-raised px-3 py-1 text-sm text-ink-soft transition-colors hover:bg-line-faint"
                >
                    {copied ? "Copied" : "Copy"}
                </button>
            </div>
            <pre className="max-h-80 overflow-auto rounded-lg bg-background p-3 font-mono text-xs text-ink-muted">
                {text}
            </pre>
        </section>
    );
}

/**
 * Why the drawing has no answer, or what stopped. Over the top of the drawing where there's room; above it on
 * narrow screens, where a long reason would cover a third of the drawing.
 */
export function Notice(props: { title: string; detail: string }) {
    return (
        <div
            role="status"
            className="px-10 text-center text-sm text-warning lg:absolute lg:inset-x-4 lg:top-6 lg:px-0"
        >
            <p className="font-medium">{props.title}</p>
            <p className="mx-auto mt-1 max-w-md text-warning/80">{props.detail}</p>
        </div>
    );
}

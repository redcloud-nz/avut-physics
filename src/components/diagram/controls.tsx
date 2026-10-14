"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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
    <label className={`flex flex-col gap-1 text-sm text-slate-300 ${props.disabled ? "opacity-40" : ""}`}>
      <span className="flex justify-between gap-2">
        {props.label}
        <span className="shrink-0 font-mono whitespace-nowrap text-slate-400">
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
        className="accent-sky-500"
      />
    </label>
  );
}

export function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="accent-sky-500"
      />
      {props.label}
    </label>
  );
}

/** A small segmented control for picking one of a few options. */
export function Choice<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm text-slate-300">
      {props.label}
      <div className="flex rounded-lg bg-slate-800 p-0.5" role="radiogroup" aria-label={props.label}>
        {props.options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={o.value === props.value}
            onClick={() => props.onChange(o.value)}
            className={`flex-1 rounded-md px-2 py-1 text-sm transition-colors ${
              o.value === props.value ? "bg-sky-500 text-slate-950" : "text-slate-300 hover:bg-slate-700"
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
    <label className="flex flex-col gap-1 text-sm text-slate-300">
      {props.label}
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
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

/** A labelled read-only value, e.g. a computed force. */
export function Readout(props: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{props.label}</span>
      <span className="font-mono" style={{ color: props.color ?? "#e2e8f0" }}>
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
        className="group h-auto justify-between px-0 text-sm font-normal text-slate-300 hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-slate-300"
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
 * controls move into a sheet, opened by a button in the diagram's corner. `controls` can be a function that
 * passes its less-used controls through `more`, which collapses them on desktop.
 */
export function VisualisationLayout(props: {
  diagram: React.ReactNode;
  controls: React.ReactNode | ((more: More) => React.ReactNode);
  readouts?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const controls = (more: More) => (typeof props.controls === "function" ? props.controls(more) : props.controls);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {props.diagram}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="absolute top-2 right-2 lg:hidden" aria-label="Settings">
              <SlidersHorizontal />
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Settings</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4 pb-4">{controls(expanded)}</div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="flex flex-col gap-4">
        <section className="hidden flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 lg:flex">
          {controls(collapsed)}
        </section>
        {props.readouts && (
          <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
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
  const text = JSON.stringify(props.data, (_, v) => (typeof v === "number" ? Number(v.toPrecision(6)) : v), 2);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">{props.title}</h3>
        <button
          onClick={copy}
          className="rounded-md bg-slate-800 px-3 py-1 text-sm text-slate-300 transition-colors hover:bg-slate-700"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-400">{text}</pre>
    </section>
  );
}

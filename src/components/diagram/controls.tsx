"use client";

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  digits?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-300">
      <span className="flex justify-between">
        {props.label}
        <span className="font-mono text-slate-400">
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

/** Standard layout: diagram on the left, controls and readouts on the right. */
export function VisualisationLayout(props: {
  diagram: React.ReactNode;
  controls: React.ReactNode;
  readouts?: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">{props.diagram}</div>
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          {props.controls}
        </section>
        {props.readouts && (
          <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            {props.readouts}
          </section>
        )}
      </div>
    </div>
  );
}

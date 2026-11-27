"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { Problem } from "@/lib/rope-3d/checks";
import type { Pin3, Segment3 } from "@/lib/rope-3d/pinned";
import type { Role, StageEnd } from "@/lib/rope-3d/stage";
import type { Vector3 } from "@/lib/vector3";

import type { Knot3dFile } from "./knot-file";
import { AXES, ROLE_COLORS, SEGMENT_COLORS } from "./rope-view";
import type { Mode } from "./state";

const ROW = "flex items-center gap-2 py-0.5";
const FIELD =
    "w-20 rounded border border-line-faint bg-surface px-1.5 py-0.5 text-right font-mono text-ink outline-none focus:border-highlight";

/** Millimetres for showing, from metres. */
const mm = (m: number, places = 1) => (m * 1000).toFixed(places);

/** Segment names as a list, runs along the rope shortened ("19, 20a–22"). */
export function namesText(segments: readonly Segment3[], ids: ReadonlySet<number>): string {
    const parts: string[] = [];
    for (let i = 0; i < segments.length; ) {
        if (!ids.has(segments[i].id)) {
            i++;
            continue;
        }
        let j = i;
        while (j + 1 < segments.length && ids.has(segments[j + 1].id)) j++;
        parts.push(i === j ? segments[i].name : `${segments[i].name}–${segments[j].name}`);
        i = j + 1;
    }
    return parts.join(", ") || "none";
}

/** A titled part of the panel. */
function Part({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="border-t border-line-faint pt-2 pb-3 first:border-t-0 first:pt-0">
            <h2 className="mb-1.5 text-ink-strong">{title}</h2>
            {children}
        </section>
    );
}

/** A number typed in, in millimetres (or as it is, without `unit`), set when it's entered or left. */
function NumberField({
    label,
    value,
    unit,
    places = 1,
    onSet,
    disabled,
}: {
    label: string;
    value: number;
    unit?: string;
    places?: number;
    onSet: (value: number) => void;
    disabled?: boolean;
}) {
    const shown = unit === "mm" ? mm(value, places) : value.toFixed(places);
    // What's typed, while it's being typed; the value as it is otherwise.
    const [draft, setDraft] = useState<string | null>(null);
    const text = draft ?? shown;
    const set = () => {
        setDraft(null);
        const n = Number(text);
        if (!Number.isFinite(n) || text.trim() === "") return;
        if ((unit === "mm" ? mm(n / 1000, places) : n.toFixed(places)) === shown) return;
        onSet(unit === "mm" ? n / 1000 : n);
    };
    return (
        <label className={ROW}>
            <span className="mr-auto">{label}</span>
            <input
                className={FIELD}
                value={text}
                disabled={disabled}
                inputMode="decimal"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={set}
                onKeyDown={(e) => {
                    if (e.key === "Enter") set();
                    if (e.key === "Escape") setDraft(null);
                }}
            />
            <span className="w-6 text-xs text-ink-muted">{unit}</span>
        </label>
    );
}

/** A small swatch of a colour. */
const Swatch = ({ color }: { color: string }) => (
    <span className="inline-block size-3 shrink-0 rounded-sm" style={{ background: color }} />
);

/** What a brush paints: a role, or sliding. */
export type Brush = Role | "slides";

const BRUSHES: { brush: Brush; label: string; about: string }[] = [
    { brush: "shorten", label: "Shorten", about: "draws up, a little each step" },
    { brush: "hold", label: "Hold", about: "stays where it is" },
    {
        brush: "straight",
        label: "Hold straight",
        about: "stays on its line, its far end held, sliding along it into the knot",
    },
    { brush: "slides", label: "Slides", about: "moves freely" },
];

const brushColor = (b: Brush) =>
    b === "slides"
        ? `color-mix(in oklab, ${SEGMENT_COLORS[0]} 45%, var(--surface))`
        : ROLE_COLORS[b];

/** A stage of tightening as it runs. */
export type StageStatus = {
    steps: number;
    shorter: number;
    running: boolean;
    ended: StageEnd | null;
    problem: string | null;
    /** Whether it's a settle (nothing shortened) rather than a stage of tightening. */
    settling: boolean;
};

export type Checks = {
    problems: readonly Problem[];
    /** How the crossings seen from the front differ from the drawing's, if they do. */
    crossings: string | null;
    /** What the last drag passed through, if anything. */
    passed: string | null;
};

export type PanelProps = {
    file: Knot3dFile;
    mode: Mode;
    busy: boolean;
    pin: { index: number; pin: Pin3; dir: Vector3 } | null;
    segment: { index: number; segment: Segment3; length: number } | null;
    painting: ReadonlyMap<number, Role>;
    brush: Brush;
    until: number;
    stage: StageStatus | null;
    checks: Checks;
    onMode: (mode: Mode) => void;
    onBrush: (brush: Brush) => void;
    onUntil: (until: number) => void;
    onNudge: (by: Vector3) => void;
    onPinAt: (at: Vector3) => void;
    onHoldDirection: (along: Vector3 | undefined) => void;
    onRemovePin: () => void;
    onSplit: () => void;
    onTension: (tension: [number, number]) => void;
    onSettle: () => void;
    onRun: () => void;
    onPause: () => void;
    onStep: () => void;
    onKeep: () => void;
    onDiscard: () => void;
    onEdit: (file: Knot3dFile) => void;
};

/** How to shape the rope and tighten it, and what's wrong with it, on the left of the view. */
export function Panel(props: PanelProps) {
    const { file, mode, busy, stage } = props;
    return (
        <div className="text-sm text-ink-soft">
            <div className="mb-3 grid grid-cols-2 gap-1.5">
                {(["shape", "tighten"] as const).map((m) => (
                    <Button
                        key={m}
                        size="xs"
                        variant={mode === m ? "default" : "secondary"}
                        disabled={busy}
                        onClick={() => props.onMode(m)}
                    >
                        {m === "shape" ? "Shape" : "Tighten"}
                    </Button>
                ))}
            </div>
            {mode === "shape" ? <ShapeParts {...props} /> : <TightenParts {...props} />}
            {stage && <StagePart {...props} stage={stage} />}
            <ChecksPart checks={props.checks} />
            <Part title="Rope">
                <NumberField
                    label="Diameter"
                    value={file.diameter}
                    unit="mm"
                    onSet={(v) => v > 0 && props.onEdit({ ...file, diameter: v })}
                    disabled={busy}
                />
                <NumberField
                    label="Least bend"
                    value={file.minBend}
                    unit="mm"
                    onSet={(v) => v > 0 && props.onEdit({ ...file, minBend: v })}
                    disabled={busy}
                />
                <NumberField
                    label="Stiffness"
                    value={file.stiffness}
                    places={3}
                    onSet={(v) => v >= 0 && v <= 1 && props.onEdit({ ...file, stiffness: v })}
                    disabled={busy}
                />
                <p className="mt-1 text-xs text-ink-muted">
                    {file.rope.pins.length} pins, {file.rope.segments.length} segments.
                    {file.props.map((p) =>
                        p.kind === "bar"
                            ? ` A bar ${mm(2 * p.r)} mm across.`
                            : ` A carabiner, its rod ${mm(2 * p.r)} mm across.`,
                    )}
                </p>
            </Part>
        </div>
    );
}

function ShapeParts(props: PanelProps) {
    const { pin, segment, busy } = props;
    const nudge = (dir: Vector3, sign: number) => (e: React.MouseEvent) =>
        props.onNudge(dir.scale((sign * (e.shiftKey ? 5 : 1)) / 1000));
    /** The pin's direction turned 5 degrees about an axis. */
    const turn = (axis: Vector3, sign: number) => () =>
        pin && props.onHoldDirection(pin.dir.turned(axis, (sign * 5 * Math.PI) / 180).unit());
    return (
        <>
            <Part title="Pin">
                {pin ? (
                    <>
                        <p>
                            Pin {pin.index + 1} of {props.file.rope.pins.length}
                        </p>
                        {AXES.map((axis) => (
                            <div key={axis.name} className={ROW}>
                                <span className="w-3 font-semibold" style={{ color: axis.color }}>
                                    {axis.name}
                                </span>
                                <Button
                                    size="icon-xs"
                                    variant="secondary"
                                    disabled={busy}
                                    title="1 mm, 5 with shift"
                                    onClick={nudge(axis.dir, -1)}
                                >
                                    −
                                </Button>
                                <Button
                                    size="icon-xs"
                                    variant="secondary"
                                    disabled={busy}
                                    title="1 mm, 5 with shift"
                                    onClick={nudge(axis.dir, 1)}
                                >
                                    +
                                </Button>
                                <div className="ml-auto">
                                    <NumberField
                                        label=""
                                        value={pin.pin.at.dot(axis.dir)}
                                        unit="mm"
                                        disabled={busy}
                                        onSet={(v) =>
                                            props.onPinAt(
                                                pin.pin.at.add(
                                                    axis.dir.scale(v - pin.pin.at.dot(axis.dir)),
                                                ),
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        ))}
                        <p className="mt-2">
                            Direction: {pin.pin.along ? "held" : "free (from the pins either side)"}
                        </p>
                        <div className="mt-1 grid grid-cols-2 gap-1.5">
                            <Button
                                size="xs"
                                variant="secondary"
                                disabled={busy || !!pin.pin.along}
                                onClick={() => props.onHoldDirection(pin.dir)}
                            >
                                Hold it
                            </Button>
                            <Button
                                size="xs"
                                variant="secondary"
                                disabled={busy || !pin.pin.along}
                                onClick={() => props.onHoldDirection(undefined)}
                            >
                                Free it
                            </Button>
                        </div>
                        {pin.pin.along && (
                            <div className="mt-1">
                                {AXES.map((axis) => (
                                    <div key={axis.name} className={ROW}>
                                        <span className="mr-auto">Turn about {axis.name}</span>
                                        <Button
                                            size="icon-xs"
                                            variant="secondary"
                                            disabled={busy}
                                            title="5°"
                                            onClick={turn(axis.dir, -1)}
                                        >
                                            ↺
                                        </Button>
                                        <Button
                                            size="icon-xs"
                                            variant="secondary"
                                            disabled={busy}
                                            title="5°"
                                            onClick={turn(axis.dir, 1)}
                                        >
                                            ↻
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Button
                            className="mt-2 w-full"
                            size="xs"
                            variant="secondary"
                            disabled={
                                busy ||
                                pin.index === 0 ||
                                pin.index === props.file.rope.pins.length - 1
                            }
                            onClick={props.onRemovePin}
                        >
                            Remove pin
                        </Button>
                    </>
                ) : (
                    <p className="text-ink-muted">
                        Click a pin to move it: drag its arrows, or W A S D R F (shift for 5 mm).
                    </p>
                )}
            </Part>
            <Part title="Segment">
                {segment ? (
                    <>
                        <p>
                            Segment {segment.segment.name}, {mm(segment.length)} mm
                        </p>
                        <NumberField
                            label="Tension at its start"
                            value={segment.segment.tension[0]}
                            places={2}
                            disabled={busy}
                            onSet={(v) => v > 0 && props.onTension([v, segment.segment.tension[1]])}
                        />
                        <NumberField
                            label="Tension at its end"
                            value={segment.segment.tension[1]}
                            places={2}
                            disabled={busy}
                            onSet={(v) => v > 0 && props.onTension([segment.segment.tension[0], v])}
                        />
                        <Button
                            className="mt-1 w-full"
                            size="xs"
                            variant="secondary"
                            disabled={busy}
                            onClick={props.onSplit}
                        >
                            Add a pin in its middle
                        </Button>
                    </>
                ) : (
                    <p className="text-ink-muted">Click the rope to pick a segment.</p>
                )}
            </Part>
            <Part title="Settle">
                <Button
                    className="w-full"
                    size="xs"
                    variant="secondary"
                    disabled={busy}
                    onClick={props.onSettle}
                >
                    Settle
                </Button>
                <p className="mt-1 text-xs text-ink-muted">
                    Lets the rope settle a while, nothing shortened and its end segments held, to
                    push apart rope pressed into rope or the carabiner.
                </p>
            </Part>
        </>
    );
}

function TightenParts(props: PanelProps) {
    const { file, painting, brush, busy, stage } = props;
    const ids = (role: Role) =>
        new Set([...painting].filter(([, r]) => r === role).map(([id]) => id));
    return (
        <Part title="Paint">
            <div className="flex flex-col gap-1">
                {BRUSHES.map((b) => (
                    <label key={b.brush} className="flex cursor-pointer items-start gap-2">
                        <input
                            type="radio"
                            name="brush"
                            className="mt-1"
                            checked={brush === b.brush}
                            onChange={() => props.onBrush(b.brush)}
                        />
                        <Swatch color={brushColor(b.brush)} />
                        <span>
                            <span className="text-ink">{b.label}</span>
                            <span className="text-xs text-ink-muted"> {b.about}</span>
                        </span>
                    </label>
                ))}
            </div>
            <p className="mt-2 text-xs text-ink-muted">
                Click a segment to paint it, shift-click to paint every segment from the last one
                painted.
            </p>
            <dl className="mt-2 text-xs">
                {(["shorten", "hold", "straight"] as const).map((role) => (
                    <div key={role} className="flex gap-1">
                        <dt className="w-20 shrink-0 text-ink-muted">
                            {BRUSHES.find((b) => b.brush === role)!.label}
                        </dt>
                        <dd>{namesText(file.rope.segments, ids(role))}</dd>
                    </div>
                ))}
            </dl>
            <NumberField
                label="Until it's this much shorter"
                value={props.until * 100}
                places={0}
                unit="%"
                disabled={busy && !!stage?.running}
                onSet={(v) => v > 0 && v < 100 && props.onUntil(v / 100)}
            />
            {!stage && (
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                    <Button size="xs" onClick={props.onRun}>
                        Run
                    </Button>
                    <Button size="xs" variant="secondary" onClick={props.onStep}>
                        Step
                    </Button>
                </div>
            )}
            {file.stages.length > 0 && (
                <>
                    <h3 className="mt-3 text-ink-strong">Stages run</h3>
                    <ol className="mt-1 list-decimal pl-5 text-xs">
                        {file.stages.map((s, i) => (
                            <li key={i}>
                                Shortened {namesText(file.rope.segments, new Set(s.shorten))} by{" "}
                                {(s.reached * 100).toFixed(0)}%
                                {s.until !== undefined && ` (to ${(s.until * 100).toFixed(0)}%)`},{" "}
                                {s.ended}.
                            </li>
                        ))}
                    </ol>
                </>
            )}
        </Part>
    );
}

function StagePart(props: PanelProps & { stage: StageStatus }) {
    const { stage } = props;
    return (
        <Part title={stage.settling ? "Settling" : "This stage"}>
            <p>
                Step {stage.steps}
                {!stage.settling && `, ${(stage.shorter * 100).toFixed(1)}% shorter`}
                {stage.ended && ` (${stage.ended})`}
            </p>
            {stage.problem && <p className="text-warning">Stopped: {stage.problem}.</p>}
            <div className="mt-1 grid grid-cols-2 gap-1.5">
                {stage.running ? (
                    <Button size="xs" variant="secondary" onClick={props.onPause}>
                        Pause
                    </Button>
                ) : (
                    <Button
                        size="xs"
                        variant="secondary"
                        disabled={!!stage.ended}
                        onClick={props.onRun}
                    >
                        Run
                    </Button>
                )}
                <Button
                    size="xs"
                    variant="secondary"
                    disabled={stage.running || !!stage.ended}
                    onClick={props.onStep}
                >
                    Step
                </Button>
                <Button
                    size="xs"
                    disabled={stage.running || stage.steps === 0}
                    onClick={props.onKeep}
                >
                    Keep
                </Button>
                <Button
                    size="xs"
                    variant="secondary"
                    disabled={stage.running}
                    onClick={props.onDiscard}
                >
                    Discard
                </Button>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
                Keep fits the rope back to pins and keeps it as one step to undo; Discard puts it
                back as it was.
            </p>
        </Part>
    );
}

function ChecksPart({ checks }: { checks: Checks }) {
    const count = (kind: Problem["kind"]) => checks.problems.filter((p) => p.kind === kind);
    const worst = (list: Problem[], tight = false) =>
        list.reduce(
            (w, p) => (tight ? Math.min(w, p.by) : Math.max(w, p.by)),
            tight ? Infinity : 0,
        );
    const lines: string[] = [];
    const rope = count("into rope");
    if (rope.length)
        lines.push(`Rope into rope in ${rope.length} places, up to ${mm(worst(rope))} mm.`);
    const bar = count("into a bar");
    if (bar.length)
        lines.push(
            `Rope into the carabiner or bar in ${bar.length} places, up to ${mm(worst(bar))} mm.`,
        );
    const tight = count("too tight");
    if (tight.length)
        lines.push(
            `${tight.length} bends tighter than the least bend, down to ${mm(worst(tight, true))} mm.`,
        );
    if (checks.crossings)
        lines.push(`Seen from the front, its crossings aren't the drawing's: ${checks.crossings}.`);
    if (checks.passed) lines.push(`In the last move, ${checks.passed}.`);
    return (
        <Part title="Checks">
            {lines.length ? (
                <ul className="flex flex-col gap-1 text-warning">
                    {lines.map((l) => (
                        <li key={l}>{l}</li>
                    ))}
                </ul>
            ) : (
                <p className="text-ink-muted">Nothing wrong.</p>
            )}
        </Part>
    );
}

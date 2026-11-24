"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { Play } from "@/lib/rope-3d/operations";
import { segmentLength, type Rope3 } from "@/lib/rope-3d/rope";
import type { Vector3 } from "@/lib/vector3";

import type { Knot3dFile } from "./knot-file";
import { AXES } from "./rope-view";

const ROW = "flex items-center gap-2 py-0.5";
const FIELD =
    "w-20 rounded border border-line-faint bg-surface px-1.5 py-0.5 text-right font-mono text-ink outline-none focus:border-highlight";

/** Millimetres for showing, from metres. */
const mm = (m: number, places = 1) => (m * 1000).toFixed(places);

/** Segment numbers as runs: "1, 7–23, 34–50". */
export function runsText(segs: readonly number[]): string {
    const sorted = [...segs].sort((a, b) => a - b);
    const parts: string[] = [];
    for (let i = 0; i < sorted.length; ) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
        parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
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

export type PanelProps = {
    file: Knot3dFile;
    rope: Rope3;
    play: Play | null;
    /** The handle's offset from where it was when it was chosen. */
    offset: Vector3 | null;
    choosing: boolean;
    /** What's running (a move, a tightening), if anything. */
    busy: string | null;
    onChoosing: (on: boolean) => void;
    onNudge: (by: Vector3) => void;
    onOffset: (offset: Vector3) => void;
    onTighten: () => void;
    onTightenKnot: () => void;
    onSmooth: () => void;
    onStop: () => void;
    onSlide: (boundaryAfter: number, by: number) => void;
    onEdit: (file: Knot3dFile) => void;
};

/** What's chosen and what can be done to it, on the left of the view. */
export function Panel(props: PanelProps) {
    const { file, rope, play, offset, busy } = props;
    const segs = play
        ? Array.from({ length: play.to - play.from + 1 }, (_, k) => play.from + k)
        : [];
    const lengthInPlay = segs.reduce((sum, k) => sum + segmentLength(rope, k), 0);
    const count = rope.seg.at(-1) ?? 0;
    const nudge = (dir: Vector3, sign: number) => (e: React.MouseEvent) =>
        props.onNudge(dir.scale((sign * (e.shiftKey ? 5 : 1)) / 1000));

    /** The file with the segments in play added to or taken from a list (`held` or `knot`). */
    const withList = (key: "held" | "knot", add: boolean) => {
        const set = new Set(file[key]);
        for (const k of segs)
            if (add) set.add(k);
            else set.delete(k);
        props.onEdit({ ...file, [key]: [...set].sort((a, b) => a - b) });
    };

    return (
        <div className="text-sm text-ink-soft">
            <Part title="In play">
                {play ? (
                    <>
                        <p>
                            Segments {play.from === play.to ? play.from : `${play.from}–${play.to}`}
                            , {mm(lengthInPlay)} mm
                        </p>
                        <p>Handle: segment {play.handle}</p>
                    </>
                ) : (
                    <p className="text-ink-muted">
                        Click a segment to make it the handle. ⌘- or Ctrl-click puts segments in
                        play or takes them out; with Shift, every segment from the last one chosen.
                    </p>
                )}
                <Button
                    size="sm"
                    variant={props.choosing ? "default" : "secondary"}
                    className="mt-2"
                    aria-pressed={props.choosing}
                    onClick={() => props.onChoosing(!props.choosing)}
                >
                    Choose in play (C)
                </Button>
                {props.choosing && (
                    <p className="mt-1 text-xs text-ink-muted">
                        A click puts a segment in play or takes it out.
                    </p>
                )}
            </Part>

            {play && offset && (
                <Part title="Handle">
                    {AXES.map((axis) => (
                        <div key={axis.name} className="flex items-center gap-1">
                            <NumberField
                                label={`${axis.name} offset`}
                                value={offset.dot(axis.dir)}
                                unit="mm"
                                disabled={busy !== null}
                                onSet={(v) =>
                                    props.onOffset(
                                        offset.add(axis.dir.scale(v - offset.dot(axis.dir))),
                                    )
                                }
                            />
                            <Button
                                size="icon-xs"
                                variant="secondary"
                                title={`${axis.name} − 1 mm (Shift: 5 mm)`}
                                onClick={nudge(axis.dir, -1)}
                            >
                                −
                            </Button>
                            <Button
                                size="icon-xs"
                                variant="secondary"
                                title={`${axis.name} + 1 mm (Shift: 5 mm)`}
                                onClick={nudge(axis.dir, 1)}
                            >
                                +
                            </Button>
                        </div>
                    ))}
                    <p className="mt-1 text-xs text-ink-muted">
                        Drag the arrows, nudge 1 mm (5 mm with Shift), or type an offset from where
                        the handle was chosen.
                    </p>
                </Part>
            )}

            <Part title="Draw up">
                <div className="flex flex-wrap gap-1.5">
                    <Button
                        size="sm"
                        variant="secondary"
                        disabled={!play || busy !== null}
                        onClick={props.onTighten}
                    >
                        Tighten in play
                    </Button>
                    <Button
                        size="sm"
                        variant="secondary"
                        disabled={!play || busy !== null}
                        onClick={props.onSmooth}
                    >
                        Smooth
                    </Button>
                    <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy !== null || file.knot.length === 0}
                        onClick={props.onTightenKnot}
                    >
                        Tighten the knot
                    </Button>
                    {busy && (
                        <Button size="sm" variant="destructive" onClick={props.onStop}>
                            Stop
                        </Button>
                    )}
                </div>
                {busy && <p className="mt-1 text-xs text-ink-muted">{busy}</p>}
            </Part>

            {play && (
                <Part title="Segments in play">
                    <ul className="font-mono text-xs">
                        {segs.map((k) => (
                            <li
                                key={k}
                                className={`flex gap-2 ${k === play.handle ? "text-ink-bright" : ""}`}
                            >
                                <span className="w-8 text-right">{k}</span>
                                <span className="w-16 text-right">
                                    {mm(segmentLength(rope, k))} mm
                                </span>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-2 text-xs text-ink-muted">
                        Slide the handle&apos;s boundaries a point (Shift: 5)
                    </div>
                    {[
                        { label: "Start", after: play.handle - 1 },
                        { label: "End", after: play.handle },
                    ]
                        .filter((b) => b.after >= 1 && b.after < count)
                        .map((b) => (
                            <div key={b.label} className={ROW}>
                                <span className="mr-auto">{b.label}</span>
                                <Button
                                    size="icon-xs"
                                    variant="secondary"
                                    disabled={busy !== null}
                                    title="Back along the rope"
                                    onClick={(e) => props.onSlide(b.after, e.shiftKey ? -5 : -1)}
                                >
                                    ◀
                                </Button>
                                <Button
                                    size="icon-xs"
                                    variant="secondary"
                                    disabled={busy !== null}
                                    title="On along the rope"
                                    onClick={(e) => props.onSlide(b.after, e.shiftKey ? 5 : 1)}
                                >
                                    ▶
                                </Button>
                            </div>
                        ))}
                </Part>
            )}

            <Part title="Tightening the knot">
                <p>Held: {runsText(file.held)}</p>
                <p>Knot: {runsText(file.knot)}</p>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <Button
                        size="xs"
                        variant="secondary"
                        disabled={!play}
                        onClick={() => withList("held", true)}
                    >
                        Hold in play
                    </Button>
                    <Button
                        size="xs"
                        variant="secondary"
                        disabled={!play}
                        onClick={() => withList("held", false)}
                    >
                        Let go
                    </Button>
                    <Button
                        size="xs"
                        variant="secondary"
                        disabled={!play}
                        onClick={() => withList("knot", true)}
                    >
                        Add to knot
                    </Button>
                    <Button
                        size="xs"
                        variant="secondary"
                        disabled={!play}
                        onClick={() => withList("knot", false)}
                    >
                        Take from knot
                    </Button>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                    Held segments stay put and the knot&apos;s segments draw up; the rest slides.
                    Hold the ends, or the knot draws them in.
                </p>
            </Part>

            <Part title="Rope">
                <NumberField
                    label="Diameter"
                    value={file.diameter}
                    unit="mm"
                    onSet={(v) => v > 0 && props.onEdit({ ...file, diameter: v })}
                    disabled={busy !== null}
                />
                <NumberField
                    label="Least bend"
                    value={file.minBend}
                    unit="mm"
                    onSet={(v) => v > 0 && props.onEdit({ ...file, minBend: v })}
                    disabled={busy !== null}
                />
                <NumberField
                    label="Stiffness"
                    value={file.stiffness}
                    places={3}
                    onSet={(v) => v >= 0 && v <= 1 && props.onEdit({ ...file, stiffness: v })}
                    disabled={busy !== null}
                />
                <p className="mt-1 text-xs text-ink-muted">
                    {count} segments, {rope.points.length} points, {mm(totalLength(rope), 0)} mm of
                    rope.
                    {file.props.map((bar) => ` A bar ${mm(2 * bar.r)} mm across.`)}
                </p>
            </Part>
        </div>
    );
}

const totalLength = (rope: Rope3) =>
    rope.points.slice(1).reduce((sum, p, i) => sum + p.distanceTo(rope.points[i]), 0);

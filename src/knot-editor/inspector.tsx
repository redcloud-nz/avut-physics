"use client";

/**
 * The panel on the right: the selected pin's or segment's values, to read and type. A typed value applies on Enter or
 * on leaving the field, as one history entry; Escape puts back what it was. Numbers are shown to three places.
 */
import { useState, type Dispatch } from "react";

import { Button } from "@/components/ui/button";

import {
    lockSegment,
    movePin,
    setPinAngle,
    setRopeColour,
    setRopeName,
    setSegmentLength,
    setTensions,
    shiftAt,
    unlockSegment,
} from "./edits";
import { ROPE_COLOURS, type Picture, type RopeColour, type Strand } from "./format";
import type { LockStatus, PictureGeometry } from "./geometry";
import type { EditorAction, Selection } from "./state";

const shown = (value: number) => String(Math.round(value * 1000) / 1000);

const FIELD =
    "w-24 rounded border border-line-faint bg-surface px-1.5 py-0.5 text-right font-mono text-ink outline-none focus:border-highlight";

/** A number typed in. Blank means none, where `blank` allows it; anything else that isn't a number is undone. */
function NumberField(props: {
    label: string;
    value: number | undefined;
    onChange: (value: number | undefined) => void;
    blank?: boolean;
}) {
    const text = props.value === undefined ? "" : shown(props.value);
    const commit = (input: HTMLInputElement) => {
        const typed = input.value.trim();
        if (typed === "" && props.blank) {
            if (props.value !== undefined) props.onChange(undefined);
            return;
        }
        const value = Number(typed);
        if (typed === "" || !Number.isFinite(value)) input.value = text;
        else if (shown(value) !== text) props.onChange(value);
    };
    return (
        <label className="flex items-center justify-between gap-2 py-0.5">
            <span>{props.label}</span>
            <input
                // A new key when the value changes elsewhere, so the field shows it.
                key={text}
                className={FIELD}
                defaultValue={text}
                inputMode="decimal"
                onBlur={(e) => commit(e.currentTarget)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") commit(e.currentTarget);
                    if (e.key === "Escape") {
                        e.currentTarget.value = text;
                        e.currentTarget.blur();
                    }
                }}
            />
        </label>
    );
}

/** A value shown, not typed: one that follows from others. */
function Shown(props: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-2 py-0.5">
            <span>{props.label}</span>
            <span className="w-24 px-1.5 text-right font-mono text-ink-muted">{props.value}</span>
        </div>
    );
}

const strandName = (strand: Strand, i: number) =>
    strand.kind === "rope" ? (strand.name ?? `Rope ${i + 1}`) : `Arrow ${i + 1}`;

/** Why a locked segment can't meet its length, and what would help. */
function lockProblem(lock: LockStatus): string | null {
    if (lock.kind === "ok") return null;
    const reach = `${shown(lock.reach[0])} to ${shown(lock.reach[1])}`;
    return lock.kind === "too-short"
        ? `Its length is ${shown(lock.by)} shorter than it can reach (${reach}). Move its pins closer together, or lengthen it.`
        : `Its length is ${shown(lock.by)} longer than it can reach (${reach}). Move its pins further apart, or shorten it.`;
}

/** A rope's colour and name. */
function RopeFields(props: {
    picture: Picture;
    strand: number;
    edit: (change: (picture: Picture) => Picture) => void;
}) {
    const { strand: i, edit } = props;
    const rope = props.picture.strands[i];
    if (rope.kind !== "rope") return null;
    // The edit runs later, in the reducer, so it takes the value rather than the event.
    const rename = (name: string) => edit((q) => setRopeName(q, i, name));
    return (
        <div className="mt-3 border-t border-line-faint pt-2">
            <label className="flex items-center justify-between gap-2 py-0.5">
                <span>Colour</span>
                <select
                    className={`${FIELD} text-left`}
                    value={rope.colour}
                    onChange={(e) => {
                        const colour = e.currentTarget.value as RopeColour;
                        edit((q) => setRopeColour(q, i, colour));
                    }}
                >
                    {ROPE_COLOURS.map((colour) => (
                        <option key={colour} value={colour}>
                            {colour[0].toUpperCase() + colour.slice(1)}
                        </option>
                    ))}
                </select>
            </label>
            <label className="flex items-center justify-between gap-2 py-0.5">
                <span>Name</span>
                <input
                    key={rope.name ?? ""}
                    className={`${FIELD} w-32 text-left font-sans`}
                    defaultValue={rope.name ?? ""}
                    placeholder={`Rope ${i + 1}`}
                    onBlur={(e) => rename(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") rename(e.currentTarget.value);
                    }}
                />
            </label>
        </div>
    );
}

export function Inspector(props: {
    picture: Picture;
    geometry: PictureGeometry;
    selection: Selection;
    dispatch: Dispatch<EditorAction>;
}) {
    const { picture, geometry, selection, dispatch } = props;
    const [shift, setShift] = useState(0.5);
    const edit = (change: (picture: Picture) => Picture) =>
        dispatch({ type: "edit", edit: change });

    const pins = selection.kind === "parts" ? selection.pins : [];
    const segments = selection.kind === "parts" ? selection.segments : [];
    const heading = (text: string) => <div className="mb-2 text-ink-strong">{text}</div>;

    if (pins.length === 1 && segments.length === 0) {
        const [i, k] = pins[0];
        const strand = picture.strands[i];
        const pin = strand?.pins[k];
        if (!pin) return null;
        const [before, after] = [strand.segments[k - 1], strand.segments[k]];
        const canShift = before?.length !== undefined && after?.length !== undefined;
        return (
            <div>
                {heading(`${strandName(strand, i)}, pin ${k + 1}`)}
                <NumberField
                    label="x"
                    value={pin.x}
                    onChange={(x) => edit((q) => movePin(q, [i, k], x!, pin.y))}
                />
                <NumberField
                    label="y"
                    value={pin.y}
                    onChange={(y) => edit((q) => movePin(q, [i, k], pin.x, y!))}
                />
                <NumberField
                    label="Angle (°)"
                    value={pin.angle}
                    blank
                    onChange={(angle) => edit((q) => setPinAngle(q, [i, k], angle))}
                />
                <div className="text-xs text-ink-muted">
                    Blank for none: the curve then sets it.
                </div>
                {canShift && (
                    <div className="mt-3 border-t border-line-faint pt-2">
                        <NumberField
                            label="Move rope through"
                            value={shift}
                            onChange={(v) => v !== undefined && v > 0 && setShift(v)}
                        />
                        <div className="mt-1 flex gap-2">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => edit((q) => shiftAt(q, [i, k], shift))}
                            >
                                Into segment {k}
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => edit((q) => shiftAt(q, [i, k], -shift))}
                            >
                                Into segment {k + 1}
                            </Button>
                        </div>
                    </div>
                )}
                <RopeFields picture={picture} strand={i} edit={edit} />
            </div>
        );
    }

    if (segments.length === 1 && pins.length === 0) {
        const [i, k] = segments[0];
        const strand = picture.strands[i];
        const segment = strand?.segments[k];
        const drawn = geometry.strands[i]?.segments[k];
        if (!segment || !drawn) return null;
        const locked = segment.length !== undefined;
        const problem = drawn.lock && lockProblem(drawn.lock);
        return (
            <div>
                {heading(`${strandName(strand, i)}, segment ${k + 1}`)}
                {locked ? (
                    <NumberField
                        label="Length"
                        value={segment.length}
                        onChange={(length) => edit((q) => setSegmentLength(q, [i, k], length!))}
                    />
                ) : (
                    <Shown label="Length" value={shown(drawn.length)} />
                )}
                <label className="flex items-center justify-between gap-2 py-0.5">
                    <span>Locked</span>
                    <input
                        type="checkbox"
                        className="accent-action"
                        checked={locked}
                        onChange={() =>
                            edit((q) =>
                                locked
                                    ? unlockSegment(q, geometry, [i, k])
                                    : lockSegment(q, geometry, [i, k]),
                            )
                        }
                    />
                </label>
                {locked ? (
                    <>
                        <Shown label="Tension at start" value={shown(drawn.tension[0])} />
                        <Shown label="Tension at end" value={shown(drawn.tension[1])} />
                        <div className="text-xs text-ink-muted">
                            Scaled together to meet the length.
                        </div>
                    </>
                ) : (
                    ([0, 1] as const).map((end) => (
                        <NumberField
                            key={end}
                            label={end === 0 ? "Tension at start" : "Tension at end"}
                            value={segment.tension[end]}
                            onChange={(t) => {
                                const tension: [number, number] = [...segment.tension];
                                tension[end] = t!;
                                edit((q) => setTensions(q, [i, k], tension));
                            }}
                        />
                    ))
                )}
                {problem && <p className="mt-2 text-danger">{problem}</p>}
                <RopeFields picture={picture} strand={i} edit={edit} />
            </div>
        );
    }

    if (pins.length || segments.length) {
        const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
        return (
            <div className="text-ink-muted">
                {[
                    pins.length && count(pins.length, "pin"),
                    segments.length && count(segments.length, "segment"),
                ]
                    .filter(Boolean)
                    .join(" and ")}{" "}
                selected. Select one to see its values.
            </div>
        );
    }

    return (
        <div className="text-ink-muted">
            Nothing selected. Click a pin or a segment to see its values; Help &gt; Shortcuts lists
            what else you can do.
        </div>
    );
}

"use client";

/**
 * The panel on the right: the selected pin's, segment's or strand's values, to read and type. A typed value applies on
 * Enter or on leaving the field, as one history entry; Escape puts back what it was. Numbers are shown to three
 * places. A selected prop shows its kind's fields. Below them, whatever the selection, are the crossings and passes needing
 * attention: entries that are lost, to delete, and those to check, to confirm.
 */
import { useState, type Dispatch } from "react";

import { Button } from "@/components/ui/button";
import { roundTo } from "@/lib/math";

import type { PictureCrossings } from "./crossing-geometry";
import { crossingLetter } from "./crossings";
import {
    changeProp,
    confirmCrossings,
    confirmPasses,
    deleteCrossing,
    deletePass,
    lockSegment,
    movePin,
    setLink,
    setPinAngle,
    setRopeColour,
    setRopeDiameter,
    setRopeName,
    setSegmentLength,
    setStepInstructions,
    setStepNumber,
    setTensions,
    shiftAt,
    unlinkPin,
    unlockSegment,
} from "./edits";
import type { LockStatus, PictureGeometry, PlacedPin } from "./geometry";
import {
    isLinked,
    ROPE_COLOURS,
    sameSegment,
    type KnotFile,
    type LinkSide,
    type Picture,
    type PinLink,
    type PinRef,
    type RopeColour,
    type SegmentRef,
    type Step,
} from "./knot-file";
import { propName, strandName } from "./names";
import { kindOf, type Prop } from "./props";
import type { EditorAction, Selection } from "./state";

const shown = (value: number) => String(roundTo(value, 3));

/** A row of the panel: its label, then its field and the field's unit at the right. */
const ROW = "flex items-center gap-2 py-0.5";

const FIELD =
    "w-24 rounded border border-line-faint bg-surface px-1.5 py-0.5 text-ink outline-none focus:border-highlight";

/** A field's unit, after it ("mm", "°"); a space kept for it where there's none, so fields line up. */
const Unit = (props: { unit?: string }) => (
    <span className="w-5 text-xs text-ink-muted">{props.unit}</span>
);

/** A number typed in. Blank means none, where `blank` allows it; anything else that isn't a number is undone. */
function NumberField(props: {
    label: string;
    value: number | undefined;
    onChange: (value: number | undefined) => void;
    blank?: boolean;
    unit?: string;
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
        <label className={ROW}>
            <span className="mr-auto">{props.label}</span>
            <input
                // A new key when the value changes elsewhere, so the field shows it.
                key={text}
                className={`${FIELD} text-right font-mono`}
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
            <Unit unit={props.unit} />
        </label>
    );
}

/** A value shown, not typed: one that follows from others. */
function Shown(props: { label: string; value: string; unit?: string }) {
    return (
        <div className="flex items-center gap-2 py-0.5">
            <span className="mr-auto">{props.label}</span>
            <span className="w-24 px-1.5 text-right font-mono text-ink-muted">{props.value}</span>
            <Unit unit={props.unit} />
        </div>
    );
}

const segmentName = (picture: Picture, [i, k]: SegmentRef) => {
    const strand = picture.strands[i];
    return strand
        ? `${strandName(strand, i)}, segment ${k + 1}`
        : `Strand ${i + 1}, segment ${k + 1}`;
};

/** Where on the drawing, by the crossings' letters. */
const atLetters = (letters: string[]) =>
    letters.length ? ` (at ${letters.join(letters.length === 2 ? " and " : ", ")})` : "";

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** Lost crossing entries and passes, each to delete, and pairs and segments to check, each to confirm. */
function CrossingProblems(props: {
    picture: Picture;
    geometry: PictureGeometry;
    crossings: PictureCrossings;
    edit: (change: (picture: Picture) => Picture) => void;
}) {
    const { picture, geometry, crossings, edit } = props;
    const { lostPasses, passesToCheck } = crossings;
    if (
        !crossings.lost.length &&
        !crossings.toCheck.length &&
        !lostPasses.length &&
        !passesToCheck.length
    )
        return null;
    const letters = (pair: [SegmentRef, SegmentRef]) =>
        crossings.crossings.flatMap((c, k) =>
            sameSegment(c.pair[0], pair[0]) && sameSegment(c.pair[1], pair[1])
                ? [crossingLetter(k)]
                : [],
        );
    const item = (key: string, text: string, action: string, run: () => void) => (
        <li key={key} className="py-1">
            <p>{text}</p>
            <Button size="sm" variant="secondary" className="mt-1" onClick={run}>
                {action}
            </Button>
        </li>
    );
    const prop = (p: number) => {
        const it = picture.props[p];
        return it ? propName(it, p) : `Prop ${p + 1}`;
    };
    return (
        <div className="mt-4 border-t border-line-faint pt-2">
            <div className="mb-1 text-ink-strong">Crossings and passes</div>
            <ul>
                {crossings.toCheck.map(({ pair, entries, found }) => {
                    const key = `check-${pair.flat().join(".")}`;
                    const confirm = () => edit((q) => confirmCrossings(q, geometry, pair));
                    if (sameSegment(pair[0], pair[1]))
                        return item(
                            key,
                            `${segmentName(picture, pair[0])} is listed as crossing itself, left by deleting a pin.`,
                            "Remove",
                            confirm,
                        );
                    const at = letters(pair);
                    return item(
                        key,
                        `${segmentName(picture, pair[0])} and ${segmentName(picture, pair[1])} have ${entries.length} ${
                            entries.length === 1 ? "entry" : "entries"
                        } but cross ${times(found)}${atLetters(at)}. Check how they're drawn, then confirm.`,
                        "Confirm",
                        confirm,
                    );
                })}
                {crossings.lost.map((entry) =>
                    item(
                        `lost-${entry.over.join(".")}-${entry.under.join(".")}-${entry.n}`,
                        `${segmentName(picture, entry.over)} over ${segmentName(picture, entry.under)} (their crossing ${entry.n}) is lost: they no longer cross there.`,
                        "Delete",
                        () => edit((q) => deleteCrossing(q, entry)),
                    ),
                )}
                {passesToCheck.map(({ prop: p, strand, segment, entries, found }) =>
                    item(
                        `pass-check-${p}-${strand}-${segment}`,
                        `${segmentName(picture, [strand, segment])} has ${entries.length} ${
                            entries.length === 1 ? "pass" : "passes"
                        } across ${prop(p)} entered but passes it ${times(found)}. Check how it's drawn, then confirm.`,
                        "Confirm",
                        () => edit((q) => confirmPasses(q, geometry, p, [strand, segment])),
                    ),
                )}
                {lostPasses.map(({ prop: p, entry }) =>
                    item(
                        `pass-lost-${p}-${entry.join("-")}`,
                        `${segmentName(picture, [entry[0], entry[1]])} passing ${
                            entry[3] === "front" ? "in front of" : "behind"
                        } ${prop(p)} (its pass ${entry[2]}) is lost: it no longer passes there.`,
                        "Delete",
                        () => edit((q) => deletePass(q, p, entry)),
                    ),
                )}
            </ul>
        </div>
    );
}

/** Why a locked segment can't meet its length, and what would help. */
function lockProblem(lock: LockStatus): string | null {
    if (lock.kind === "ok") return null;
    const reach = `${shown(lock.reach[0])} to ${shown(lock.reach[1])}`;
    return lock.kind === "too-short"
        ? `Its length is ${shown(lock.by)} shorter than it can reach (${reach}). Move its pins closer together, or lengthen it.`
        : `Its length is ${shown(lock.by)} longer than it can reach (${reach}). Move its pins further apart, or shorten it.`;
}

/** A rope's colour and name. */
/**
 * A linked pin's fields: where its leader puts it (shown, not typed), what it's linked to, and the link's side, gap
 * and direction, to set.
 */
function LinkFields(props: {
    picture: Picture;
    link: PinLink;
    placed: PlacedPin;
    pinRef: PinRef;
    edit: (change: (picture: Picture) => Picture) => void;
}) {
    const { picture, link, placed, pinRef, edit } = props;
    const leader = picture.strands.flatMap((strand, i) =>
        strand.pins.flatMap((pin, k) => (pin.id === link.pin ? [{ strand, i, k }] : [])),
    )[0];
    return (
        <>
            <Shown label="x" value={shown(placed.x)} unit="mm" />
            <Shown label="y" value={shown(placed.y)} unit="mm" />
            <Shown
                label="Angle"
                value={placed.angle === undefined ? "" : shown(placed.angle)}
                unit="°"
            />
            <div className="mt-3 border-t border-line-faint pt-2">
                <div className="py-0.5">
                    Linked to{" "}
                    {leader
                        ? `${strandName(leader.strand, leader.i)}, pin ${leader.k + 1}`
                        : "a pin that's gone"}
                </div>
                <label className={ROW}>
                    <span className="mr-auto">Side</span>
                    <select
                        className={FIELD}
                        value={link.side}
                        onChange={(e) => {
                            const side = e.currentTarget.value as LinkSide;
                            edit((q) => setLink(q, pinRef, { side }));
                        }}
                    >
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                    </select>
                    <Unit />
                </label>
                <NumberField
                    label="Gap"
                    unit="mm"
                    value={link.gap ?? 0}
                    onChange={(gap) =>
                        gap !== undefined && edit((q) => setLink(q, pinRef, { gap }))
                    }
                />
                <label className={ROW}>
                    <span className="mr-auto">Reversed</span>
                    <input
                        type="checkbox"
                        className="accent-action"
                        checked={!!link.reverse}
                        onChange={() => edit((q) => setLink(q, pinRef, { reverse: !link.reverse }))}
                    />
                    <Unit />
                </label>
                <div className="text-xs text-ink-muted">
                    Beside its leader, running the same way unless reversed. Dragging or turning it
                    moves its leader.
                </div>
                <Button
                    className="mt-2"
                    size="sm"
                    variant="secondary"
                    onClick={() => edit((q) => unlinkPin(q, pinRef))}
                >
                    Unlink
                </Button>
            </div>
        </>
    );
}

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
            <label className={ROW}>
                <span className="mr-auto">Colour</span>
                <select
                    className={FIELD}
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
                <Unit />
            </label>
            <NumberField
                label="Diameter"
                unit="mm"
                value={rope.diameter}
                onChange={(d) => d !== undefined && edit((q) => setRopeDiameter(q, i, d))}
            />
            <label className={ROW}>
                <span className="mr-auto">Name</span>
                <input
                    key={rope.name ?? ""}
                    className={`${FIELD} w-32`}
                    defaultValue={rope.name ?? ""}
                    placeholder={`Rope ${i + 1}`}
                    onBlur={(e) => rename(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") rename(e.currentTarget.value);
                    }}
                />
                <Unit />
            </label>
        </div>
    );
}

export function Inspector(props: {
    picture: Picture;
    geometry: PictureGeometry;
    crossings: PictureCrossings;
    selection: Selection;
    /** The step shown, if it's a step rather than the knot. */
    step?: { index: number; step: Step };
    dispatch: Dispatch<EditorAction>;
}) {
    const { dispatch } = props;
    const edit = (change: (picture: Picture) => Picture) =>
        dispatch({ type: "edit", edit: change });
    return (
        <>
            <SelectionPanel {...props} />
            <CrossingProblems
                picture={props.picture}
                geometry={props.geometry}
                crossings={props.crossings}
                edit={edit}
            />
        </>
    );
}

const heading = (text: string) => <div className="mb-2 text-ink-strong">{text}</div>;

/** A step's number and instructions, typed in; each applies on leaving its field (the number on Enter too). */
function StepFields(props: { index: number; step: Step; dispatch: Dispatch<EditorAction> }) {
    const { index, step, dispatch } = props;
    const editFile = (change: (file: KnotFile) => KnotFile) =>
        dispatch({ type: "edit-file", edit: change });
    return (
        <div>
            {heading(`Step ${step.number}`)}
            <NumberField
                label="Number"
                value={step.number}
                onChange={(n) => n !== undefined && editFile((f) => setStepNumber(f, index, n))}
            />
            <div className="text-xs text-ink-muted">
                Typed, never counted: two pictures of one step share a number.
            </div>
            <label className="mt-3 grid gap-1">
                <span>Instructions</span>
                <textarea
                    key={`${index}:${step.instructions}`}
                    className="min-h-32 w-full rounded border border-line-faint bg-surface px-1.5 py-1 text-ink outline-none focus:border-highlight"
                    defaultValue={step.instructions}
                    onBlur={(e) => {
                        const text = e.currentTarget.value;
                        editFile((f) => setStepInstructions(f, index, text));
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            e.currentTarget.value = step.instructions;
                            e.currentTarget.blur();
                        }
                    }}
                />
            </label>
        </div>
    );
}

/** The selected pin's, segment's or prop's values, or with nothing selected, the step's. */
function SelectionPanel(props: {
    picture: Picture;
    geometry: PictureGeometry;
    selection: Selection;
    step?: { index: number; step: Step };
    dispatch: Dispatch<EditorAction>;
}) {
    const { picture, geometry, selection, dispatch } = props;
    const [shift, setShift] = useState(5);
    const edit = (change: (picture: Picture) => Picture) =>
        dispatch({ type: "edit", edit: change });

    if (selection.kind === "prop") {
        const p = selection.prop;
        const prop = picture.props[p];
        if (!prop) return null;
        const editProp = (change: (prop: Prop) => Prop) => edit((q) => changeProp(q, p, change));
        return (
            <div>
                {heading(propName(prop, p))}
                {kindOf(prop)
                    .fields(prop)
                    .map((field) =>
                        field.kind === "number" ? (
                            <NumberField
                                key={field.label}
                                label={field.label}
                                unit={field.unit}
                                value={field.value}
                                onChange={(v) =>
                                    v !== undefined && editProp((q) => field.set(q, v))
                                }
                            />
                        ) : (
                            <label key={field.label} className={ROW}>
                                <span className="mr-auto">{field.label}</span>
                                <select
                                    className={FIELD}
                                    value={field.value}
                                    onChange={(e) => {
                                        const value = e.currentTarget.value;
                                        editProp((q) => field.set(q, value));
                                    }}
                                >
                                    {field.options.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                                <Unit />
                            </label>
                        ),
                    )}
                <div className="mt-2 text-xs text-ink-muted">
                    Drag it to move it.
                    {kindOf(prop).between(prop) &&
                        " Click where a strand passes across it to put the strand in front or behind."}
                </div>
            </div>
        );
    }

    if (selection.kind === "strand") {
        const i = selection.strand;
        const strand = picture.strands[i];
        const drawn = geometry.strands[i];
        if (!strand || !drawn) return null;
        const length = drawn.segments.reduce((sum, segment) => sum + segment.length, 0);
        return (
            <div>
                {heading(strandName(strand, i))}
                <Shown label="Pins" value={`${strand.pins.length}`} />
                <Shown label="Length" value={shown(length)} unit="mm" />
                <RopeFields picture={picture} strand={i} edit={edit} />
                <div className="mt-2 text-xs text-ink-muted">
                    Click one of its pins or segments to edit it.
                </div>
            </div>
        );
    }

    const pins = selection.kind === "parts" ? selection.pins : [];
    const segments = selection.kind === "parts" ? selection.segments : [];

    if (pins.length === 1 && segments.length === 0) {
        const [i, k] = pins[0];
        const strand = picture.strands[i];
        const pin = strand?.pins[k];
        const placed = geometry.strands[i]?.pins[k];
        if (!pin || !placed) return null;
        const [before, after] = [strand.segments[k - 1], strand.segments[k]];
        const canShift = before?.length !== undefined && after?.length !== undefined;
        return (
            <div>
                {heading(`${strandName(strand, i)}, pin ${k + 1}`)}
                {isLinked(pin) ? (
                    <LinkFields
                        picture={picture}
                        link={pin.link}
                        placed={placed}
                        pinRef={[i, k]}
                        edit={edit}
                    />
                ) : (
                    <>
                        <NumberField
                            label="x"
                            unit="mm"
                            value={pin.x}
                            onChange={(x) => edit((q) => movePin(q, [i, k], x!, pin.y))}
                        />
                        <NumberField
                            label="y"
                            unit="mm"
                            value={pin.y}
                            onChange={(y) => edit((q) => movePin(q, [i, k], pin.x, y!))}
                        />
                        <NumberField
                            label="Angle"
                            unit="°"
                            value={pin.angle}
                            blank
                            onChange={(angle) => edit((q) => setPinAngle(q, [i, k], angle))}
                        />
                        <div className="text-xs text-ink-muted">
                            Blank for none: the curve then sets it.
                        </div>
                    </>
                )}
                {canShift && (
                    <div className="mt-3 border-t border-line-faint pt-2">
                        <NumberField
                            label="Move rope through"
                            unit="mm"
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
                        unit="mm"
                        value={segment.length}
                        onChange={(length) => edit((q) => setSegmentLength(q, [i, k], length!))}
                    />
                ) : (
                    <Shown label="Length" value={shown(drawn.length)} unit="mm" />
                )}
                <label className={ROW}>
                    <span className="mr-auto">Locked</span>
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
                    <Unit />
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

    const hint = (
        <div className="text-ink-muted">
            Nothing selected. Click a pin or a segment to see its values; Help &gt; Shortcuts lists
            what else you can do.
        </div>
    );
    if (!props.step) return hint;
    return (
        <>
            <StepFields index={props.step.index} step={props.step.step} dispatch={dispatch} />
            <div className="mt-4 text-xs">{hint}</div>
        </>
    );
}

"use client";

/**
 * File > Knot Details…: the knot's name, its one-line description, its about text and its frame. Nothing changes until
 * OK, which applies them as one history entry; Cancel or Escape leaves them as they were. A name is needed, and a frame
 * with numbers throughout and a width and height above 0; blank description and about text are left out of the file.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import type { KnotDetails } from "./edits";
import type { Frame } from "./knot-file";

/** What OK gives: the details and the frame typed. */
export type DetailsDone = { details: KnotDetails; frame: Frame };

const FRAME_FIELDS = [
    ["x", "Left"],
    ["y", "Top"],
    ["w", "Width"],
    ["h", "Height"],
] as const;

const FIELD =
    "w-full rounded border border-line-faint bg-surface px-2 py-1 text-ink outline-none focus:border-highlight";

/** The fields, holding what's typed until OK. Mounted afresh each time the dialog opens. */
function DetailsForm(props: {
    details: KnotDetails;
    frame: Frame;
    onDone: (done: DetailsDone | null) => void;
}) {
    const [name, setName] = useState(props.details.name);
    const [description, setDescription] = useState(props.details.description ?? "");
    const [about, setAbout] = useState(props.details.about ?? "");
    const [frameText, setFrameText] = useState(() =>
        Object.fromEntries(FRAME_FIELDS.map(([key]) => [key, String(props.frame[key])])),
    );
    const frame = Object.fromEntries(
        FRAME_FIELDS.map(([key]) => [key, Number(frameText[key].trim() || NaN)]),
    ) as Frame;
    const frameOk = Object.values(frame).every(Number.isFinite) && frame.w > 0 && frame.h > 0;
    const blank = !name.trim();
    return (
        <form
            className="grid gap-3"
            onSubmit={(e) => {
                e.preventDefault();
                if (!blank && frameOk)
                    props.onDone({ details: { name, description, about }, frame });
            }}
        >
            <label className="grid gap-1">
                <span className="text-sm text-ink">Name</span>
                <input
                    className={FIELD}
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                    autoFocus
                />
            </label>
            <label className="grid gap-1">
                <span className="text-sm text-ink">Description</span>
                <span className="text-xs text-ink-muted">
                    One sentence on what the knot is for.
                </span>
                <input
                    className={FIELD}
                    value={description}
                    onChange={(e) => setDescription(e.currentTarget.value)}
                />
            </label>
            <label className="grid gap-1">
                <span className="text-sm text-ink">About</span>
                <span className="text-xs text-ink-muted">
                    More on the knot: where it&apos;s used, what to watch for.
                </span>
                <textarea
                    className={`${FIELD} min-h-32`}
                    value={about}
                    onChange={(e) => setAbout(e.currentTarget.value)}
                />
            </label>
            <fieldset className="grid gap-1">
                <legend className="text-sm text-ink">Frame</legend>
                <span className="text-xs text-ink-muted">
                    What the knot&apos;s page shows of every picture, in millimetres.
                </span>
                <div className="mt-1 grid grid-cols-4 gap-2">
                    {FRAME_FIELDS.map(([key, label]) => (
                        <label key={key} className="grid gap-1">
                            <span className="text-xs text-ink-muted">{label}</span>
                            <input
                                className={`${FIELD} text-right font-mono`}
                                inputMode="decimal"
                                value={frameText[key]}
                                onChange={(e) => {
                                    const text = e.currentTarget.value;
                                    setFrameText((t) => ({ ...t, [key]: text }));
                                }}
                            />
                        </label>
                    ))}
                </div>
                {!frameOk && (
                    <span className="text-xs text-danger">
                        The frame needs a number in each field, and a width and height above 0.
                    </span>
                )}
            </fieldset>
            <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => props.onDone(null)}>
                    Cancel
                </Button>
                <Button type="submit" disabled={blank || !frameOk}>
                    OK
                </Button>
            </DialogFooter>
        </form>
    );
}

export function DetailsDialog(props: {
    open: boolean;
    details: KnotDetails;
    frame: Frame;
    /** The details and frame typed, on OK, or null on Cancel. */
    onDone: (done: DetailsDone | null) => void;
}) {
    return (
        <Dialog open={props.open} onOpenChange={(open) => !open && props.onDone(null)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Knot details</DialogTitle>
                    <DialogDescription>
                        What the knot&apos;s page will say about it.
                    </DialogDescription>
                </DialogHeader>
                {props.open && (
                    <DetailsForm
                        details={props.details}
                        frame={props.frame}
                        onDone={props.onDone}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

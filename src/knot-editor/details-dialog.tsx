"use client";

/**
 * File > Knot Details…: the knot's name, its one-line description and its about text. Nothing changes until OK, which
 * applies them as one history entry; Cancel or Escape leaves them as they were. A name is needed; blank description
 * and about text are left out of the file.
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

const FIELD =
    "w-full rounded border border-line-faint bg-surface px-2 py-1 text-ink outline-none focus:border-highlight";

/** The fields, holding what's typed until OK. Mounted afresh each time the dialog opens. */
function DetailsForm(props: {
    details: KnotDetails;
    onDone: (details: KnotDetails | null) => void;
}) {
    const [name, setName] = useState(props.details.name);
    const [description, setDescription] = useState(props.details.description ?? "");
    const [about, setAbout] = useState(props.details.about ?? "");
    const blank = !name.trim();
    return (
        <form
            className="grid gap-3"
            onSubmit={(e) => {
                e.preventDefault();
                if (!blank) props.onDone({ name, description, about });
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
            <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => props.onDone(null)}>
                    Cancel
                </Button>
                <Button type="submit" disabled={blank}>
                    OK
                </Button>
            </DialogFooter>
        </form>
    );
}

export function DetailsDialog(props: {
    open: boolean;
    details: KnotDetails;
    /** The details typed, on OK, or null on Cancel. */
    onDone: (details: KnotDetails | null) => void;
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
                {props.open && <DetailsForm details={props.details} onDone={props.onDone} />}
            </DialogContent>
        </Dialog>
    );
}

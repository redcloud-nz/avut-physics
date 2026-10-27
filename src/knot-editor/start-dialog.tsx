"use client";

/**
 * Where to start: a new knot, a knot file opened from the computer, or a copy of one of the site's knots from the
 * library. Shown as the editor opens, and from File > Open from Library (with only the library). A knot from the
 * library is a copy with no file behind it, so saving it asks where to save it, never writing back to the library.
 */
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ALL_KNOTS, fullName } from "@/knots";

import type { KnotFile } from "./knot-file";

/** The site's knots, hidden ones too, to start from. */
export const LIBRARY = ALL_KNOTS.map((knot) => ({
    slug: knot.slug,
    name: fullName(knot),
    comingSoon: knot.comingSoon,
    file: knot.file,
}));

export function StartDialog(props: {
    open: boolean;
    /** As the editor opens, offering a new knot and opening a file as well as the library. */
    start: boolean;
    /** Whether this browser can open files. */
    canOpen: boolean;
    /** Whether it's known that this browser can't open or save files, so the dialog says so. */
    noFiles: boolean;
    onNew: () => void;
    onOpen: () => void;
    onLibrary: (file: KnotFile, fileName: string) => void;
    onClose: () => void;
}) {
    return (
        <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{props.start ? "Knot editor" : "Open from Library"}</DialogTitle>
                    <DialogDescription>
                        {props.start
                            ? "Start a new knot, open a knot file, or start from a copy of one of the site's knots."
                            : "Start from a copy of one of the site's knots. Saving it saves a new file."}
                    </DialogDescription>
                </DialogHeader>
                {props.noFiles && (
                    <p className="text-sm text-warning">
                        Opening and saving files needs Chrome or Edge. In this browser you can draw,
                        but not keep your work.
                    </p>
                )}
                {props.start && (
                    <div className="flex gap-2">
                        <Button className="flex-1" onClick={props.onNew}>
                            New knot
                        </Button>
                        <Button
                            className="flex-1"
                            variant="outline"
                            onClick={props.onOpen}
                            disabled={!props.canOpen}
                            title={
                                props.canOpen ? undefined : "Opening files needs Chrome or Edge."
                            }
                        >
                            Open…
                        </Button>
                    </div>
                )}
                <section aria-label="Library" className="flex min-h-0 flex-col gap-1">
                    {props.start && (
                        <h3 className="text-xs font-medium text-ink-muted">From the library</h3>
                    )}
                    <ul className="flex max-h-80 flex-col overflow-y-auto">
                        {LIBRARY.map((knot) => (
                            <li key={knot.slug}>
                                <button
                                    type="button"
                                    onClick={() =>
                                        props.onLibrary(
                                            structuredClone(knot.file),
                                            `${knot.slug}.json`,
                                        )
                                    }
                                    className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-surface-raised"
                                >
                                    {knot.name}
                                    {knot.comingSoon && (
                                        <span className="text-xs text-ink-muted">coming soon</span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            </DialogContent>
        </Dialog>
    );
}

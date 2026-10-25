"use client";

/**
 * The knot editor: the menu bar, the knot and its steps on the left, the drawing in the middle, what's selected on the
 * right, and the status bar along the bottom. It fills the window; it's a desktop tool, with no phone layout.
 */
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useInBrowser } from "@/components/use-in-browser";

import { canUseFiles, openKnotFile, saveKnotFile, saveKnotFileAs } from "./files";
import type { KnotFile } from "./format";
import { Menus, useShortcuts, type CommandId } from "./menus";
import { CURRENT_VERSION } from "./versions";

/** A new knot: one orange rope of two pins. */
export function untitledKnot(): KnotFile {
    return {
        name: "Untitled knot",
        knot: {
            strands: [
                {
                    kind: "rope",
                    colour: "orange",
                    pins: [
                        { x: 0, y: 0 },
                        { x: 10, y: 0 },
                    ],
                    segments: [{ tension: [1, 1] }],
                },
            ],
            crossings: [],
            props: [],
        },
        steps: [],
    };
}

/** The document being edited, and where it's saved. */
type Document = {
    file: KnotFile;
    /** The file it was opened from or last saved to; none until it's saved. */
    handle?: FileSystemFileHandle;
    /** The file's name, as shown in the title. */
    fileName: string;
    saved: boolean;
};

const UNTITLED: Document = { file: untitledKnot(), fileName: "untitled.json", saved: true };

/** A message shown in a dialog: what went wrong, or what happened opening a file. */
type Message = { title: string; text: string };

const DISCARD = "This knot has unsaved changes. Discard them?";

export default function KnotEditor() {
    const [doc, setDoc] = useState<Document>(UNTITLED);
    const [message, setMessage] = useState<Message | null>(null);
    // Whether this browser can open and save files: the File menu explains, until it's known and where it can't.
    const files = useInBrowser() && canUseFiles();

    const title = `${doc.fileName}${doc.saved ? "" : " •"}`;
    useEffect(() => {
        document.title = `${title} | Knot editor`;
    }, [title]);

    // Leaving the page with unsaved changes asks first.
    useEffect(() => {
        if (doc.saved) return;
        const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", onLeave);
        return () => window.removeEventListener("beforeunload", onLeave);
    }, [doc.saved]);

    const mayDiscard = () => doc.saved || window.confirm(DISCARD);

    async function open() {
        if (!mayDiscard()) return;
        const result = await openKnotFile();
        if (result.kind === "cancelled") return;
        if (result.kind === "error")
            return setMessage({ title: "Couldn't open the file", text: result.reason });
        const upgraded = result.upgradedFrom !== undefined;
        setDoc({
            file: result.file,
            handle: result.handle,
            fileName: result.handle.name,
            saved: !upgraded,
        });
        if (upgraded)
            setMessage({
                title: "Opened an older file",
                text: `Opened a version ${result.upgradedFrom} file; saving writes version ${CURRENT_VERSION}.`,
            });
    }

    async function save(as: boolean) {
        const result =
            doc.handle && !as
                ? await saveKnotFile(doc.handle, doc.file)
                : await saveKnotFileAs(doc.file, doc.fileName);
        if (result.kind === "cancelled") return;
        if (result.kind === "error")
            return setMessage({ title: "Couldn't save the file", text: result.reason });
        setDoc((d) => ({ ...d, handle: result.handle, fileName: result.handle.name, saved: true }));
    }

    const enabled: Partial<Record<CommandId, boolean>> = {
        new: true,
        open: files,
        save: files,
        saveAs: files,
    };
    const checked: Partial<Record<CommandId, boolean>> = {};
    const run = (id: CommandId) => {
        if (id === "new") {
            if (mayDiscard()) setDoc(UNTITLED);
        } else if (id === "open") void open();
        else if (id === "save") void save(false);
        else if (id === "saveAs") void save(true);
    };
    useShortcuts(enabled, run);
    const notes = files ? undefined : { File: "Opening and saving files needs Chrome or Edge." };

    return (
        <div className="flex h-full flex-col bg-background text-sm text-ink">
            <header className="flex items-center gap-4 border-b border-line-faint px-2 py-1">
                <Menus enabled={enabled} checked={checked} run={run} notes={notes} />
                <div className="ml-auto truncate pr-2 text-ink-muted">{title}</div>
            </header>
            <div className="flex min-h-0 flex-1">
                <aside className="w-48 shrink-0 overflow-y-auto border-r border-line-faint p-3">
                    <div className="text-ink-strong">Knot</div>
                    <div className="mt-3 text-xs tracking-wide text-ink-muted uppercase">Steps</div>
                </aside>
                <main className="min-w-0 flex-1 bg-surface" aria-label="Drawing" />
                <aside className="w-64 shrink-0 overflow-y-auto border-l border-line-faint p-3 text-ink-muted">
                    Nothing selected
                </aside>
            </div>
            <footer className="flex h-7 items-center gap-6 border-t border-line-faint px-3 font-mono text-xs text-ink-muted">
                <span className="ml-auto">{doc.saved ? "Saved" : "Not saved"}</span>
            </footer>
            <Dialog open={message !== null} onOpenChange={(open) => !open && setMessage(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{message?.title}</DialogTitle>
                        <DialogDescription className="wrap-break-word">
                            {message?.text}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={() => setMessage(null)}>OK</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

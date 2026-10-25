"use client";

/**
 * The knot editor: the menu bar, the knot and its steps on the left, the drawing in the middle, what's selected on the
 * right, and the status bar along the bottom. It fills the window; it's a desktop tool, with no phone layout.
 */
import { useEffect, useReducer, useRef, useState } from "react";

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
import { Vector2 } from "@/lib/vector2";

import { Canvas, useGeometry, type CanvasControls } from "./canvas";
import { addStrand, deletePins, insertPin } from "./edits";
import { canUseFiles, openKnotFile, saveKnotFile, saveKnotFileAs } from "./files";
import type { KnotFile, PinRef } from "./format";
import { Inspector } from "./inspector";
import { Menus, useShortcuts, type CommandId } from "./menus";
import { ShortcutsDialog } from "./shortcuts";
import { editorReducer, isSaved, loaded, NOTHING, pictureOf, type PictureId } from "./state";
import { createReadouts, StatusBar, type Warnings } from "./status-bar";
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

const UNTITLED = "untitled.json";

/** A message shown in a dialog: what went wrong, or what happened opening a file. */
type Message = { title: string; text: string };

const DISCARD = "This knot has unsaved changes. Discard them?";

export default function KnotEditor() {
    const [state, dispatch] = useReducer(editorReducer, undefined, () =>
        loaded(untitledKnot(), UNTITLED),
    );
    const saved = isSaved(state);
    const picture = pictureOf(state.file, state.picture);
    const geometry = useGeometry(picture);
    const { selection } = state;
    const parts = selection.kind === "parts" ? selection : NOTHING;
    const pins = parts.kind === "parts" ? parts.pins : [];
    const segments = parts.kind === "parts" ? parts.segments : [];
    const canvas = useRef<CanvasControls>(null);
    const [show, setShow] = useState({ pinNumbers: false, handles: true, bendWarnings: true });
    const [readouts] = useState(createReadouts);
    const [helpOpen, setHelpOpen] = useState(false);
    const [message, setMessage] = useState<Message | null>(null);
    // Whether this browser can open and save files: the File menu explains, until it's known and where it can't.
    const files = useInBrowser() && canUseFiles();

    const title = `${state.fileName}${saved ? "" : " •"}`;
    useEffect(() => {
        document.title = `${title} | Knot editor`;
    }, [title]);

    // Leaving the page with unsaved changes asks first.
    useEffect(() => {
        if (saved) return;
        const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", onLeave);
        return () => window.removeEventListener("beforeunload", onLeave);
    }, [saved]);

    const mayDiscard = () => saved || window.confirm(DISCARD);

    async function open() {
        if (!mayDiscard()) return;
        const result = await openKnotFile();
        if (result.kind === "cancelled") return;
        if (result.kind === "error")
            return setMessage({ title: "Couldn't open the file", text: result.reason });
        const upgraded = result.upgradedFrom !== undefined;
        dispatch({
            type: "load",
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
        const { file, handle, fileName } = state;
        const result =
            handle && !as ? await saveKnotFile(handle, file) : await saveKnotFileAs(file, fileName);
        if (result.kind === "cancelled") return;
        if (result.kind === "error")
            return setMessage({ title: "Couldn't save the file", text: result.reason });
        dispatch({ type: "saved", file, handle: result.handle, fileName: result.handle.name });
    }

    const enabled: Partial<Record<CommandId, boolean>> = {
        new: true,
        open: files,
        save: files,
        saveAs: files,
        undo: state.undo.length > 0,
        redo: state.redo.length > 0,
        delete: pins.length > 0,
        selectAll: picture.strands.length > 0,
        insertPin: segments.length > 0,
        insertRope: true,
        insertArrow: true,
        zoomIn: true,
        zoomOut: true,
        fit: true,
        pinNumbers: true,
        handles: true,
        bendWarnings: true,
        shortcuts: true,
    };
    const checked: Partial<Record<CommandId, boolean>> = show;

    const segmentsDrawn = geometry.strands.flatMap((strand) => strand.segments);
    const warnings: Warnings = [
        {
            count: segmentsDrawn.reduce((n, seg) => n + seg.bends.length, 0),
            one: "bend too tight",
            many: "bends too tight",
        },
        {
            count: segmentsDrawn.filter((seg) => seg.lock && seg.lock.kind !== "ok").length,
            one: "locked length not met",
            many: "locked lengths not met",
        },
    ];

    const selectPins = (refs: PinRef[]) =>
        dispatch({ type: "select", selection: { kind: "parts", pins: refs, segments: [] } });

    /** A short straight rope or arrow across the middle of the view, its pins selected. */
    function insertStrand(kind: "rope" | "arrow") {
        const centre = canvas.current?.centre();
        if (!centre) return;
        const offset = { x: 5, y: 0 } as const;
        const n = picture.strands.length;
        dispatch({
            type: "edit",
            edit: (q) =>
                addStrand(
                    q,
                    kind,
                    centre.sub(new Vector2(offset.x, offset.y)),
                    centre.add(new Vector2(offset.x, offset.y)),
                ),
        });
        selectPins([
            [n, 0],
            [n, 1],
        ]);
    }
    const run = (id: CommandId) => {
        if (id === "new") {
            if (mayDiscard())
                dispatch({ type: "load", file: untitledKnot(), fileName: UNTITLED, saved: true });
        } else if (id === "open") void open();
        else if (id === "save") void save(false);
        else if (id === "saveAs") void save(true);
        else if (id === "undo" || id === "redo") dispatch({ type: id });
        else if (id === "delete") dispatch({ type: "edit", edit: (q) => deletePins(q, pins) });
        else if (id === "selectAll")
            selectPins(picture.strands.flatMap((s, i) => s.pins.map((_, k): PinRef => [i, k])));
        else if (id === "insertPin") {
            // At the middle (by length) of the first segment selected.
            const [i, k] = segments[0];
            const seg = geometry.strands[i].segments[k];
            const t = seg.cubic.tAtLength(seg.length / 2, seg.length);
            dispatch({ type: "edit", edit: (q) => insertPin(q, geometry, [i, k], t) });
            selectPins([[i, k + 1]]);
        } else if (id === "insertRope") insertStrand("rope");
        else if (id === "insertArrow") insertStrand("arrow");
        else if (id === "zoomIn") canvas.current?.zoom(1.25);
        else if (id === "zoomOut") canvas.current?.zoom(0.8);
        else if (id === "fit") canvas.current?.fit();
        else if (id === "pinNumbers" || id === "handles" || id === "bendWarnings")
            setShow((s) => ({ ...s, [id]: !s[id] }));
        else if (id === "shortcuts") setHelpOpen(true);
    };
    useShortcuts(enabled, run);
    const notes = files ? undefined : { File: "Opening and saving files needs Chrome or Edge." };

    /** The knot or a step in the list on the left: the one shown is marked, and choosing another shows it. */
    const pictureButton = (id: PictureId, label: string) => (
        <button
            key={id}
            type="button"
            className={`block w-full rounded px-2 py-0.5 text-left ${
                state.picture === id
                    ? "bg-surface-raised text-highlight"
                    : "text-ink hover:bg-surface"
            }`}
            onClick={() => dispatch({ type: "show", picture: id })}
        >
            {label}
        </button>
    );

    return (
        <div className="flex h-full flex-col bg-background text-sm text-ink">
            <header className="flex items-center gap-4 border-b border-line-faint px-2 py-1">
                <Menus enabled={enabled} checked={checked} run={run} notes={notes} />
                <div className="ml-auto truncate pr-2 text-ink-muted">{title}</div>
            </header>
            <div className="flex min-h-0 flex-1">
                <aside className="w-48 shrink-0 overflow-y-auto border-r border-line-faint p-3">
                    {pictureButton("knot", "Knot")}
                    <div className="mt-3 mb-1 text-xs tracking-wide text-ink-muted uppercase">
                        Steps
                    </div>
                    {state.file.steps.map((step, k) => pictureButton(k, `Step ${step.number}`))}
                </aside>
                <main className="min-w-0 flex-1 bg-surface" aria-label="Drawing">
                    <Canvas
                        key={state.loads}
                        ref={canvas}
                        picture={picture}
                        geometry={geometry}
                        selection={selection}
                        dispatch={dispatch}
                        show={show}
                        readouts={readouts}
                    />
                </main>
                <aside className="w-64 shrink-0 overflow-y-auto border-l border-line-faint p-3">
                    <Inspector
                        picture={picture}
                        geometry={geometry}
                        selection={selection}
                        dispatch={dispatch}
                    />
                </aside>
            </div>
            <StatusBar readouts={readouts} warnings={warnings} saved={saved} />
            <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
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

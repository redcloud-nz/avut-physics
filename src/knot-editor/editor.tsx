"use client";

/**
 * The knot editor: the menu bar, the knot, its steps and the picture's objects on the left, the drawing in the middle,
 * what's selected on the right, and the status bar along the bottom. It fills the window; it's a desktop tool, with no
 * phone layout.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from "react";

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
import { pictureCrossings, strandPaths } from "./crossing-geometry";
import { DetailsDialog } from "./details-dialog";
import { DrawingMenu, type MenuTarget } from "./drawing-menu";
import {
    addProp,
    addStrand,
    deletePins,
    deleteProp,
    deleteStrand,
    insertPin,
    insertStep,
    linkPins,
    NEW_ROPE_DIAMETER,
    setDetails,
    setFrame,
    unlinkPin,
} from "./edits";
import { canUseFiles, openKnotFile, saveKnotFile, saveKnotFileAs } from "./files";
import { pictureGeometry } from "./geometry";
import { Inspector } from "./inspector";
import { FAR_TURN_STEP, moved, moveStep, nextPin, TURN_STEP, turned } from "./keyboard";
import { isLinked, type KnotFile, type PinRef } from "./knot-file";
import { Menus, propCommand, useShortcuts, type CommandId, type RunOptions } from "./menus";
import { ObjectsList } from "./objects-list";
import { PROP_KIND_NAMES, PROP_KINDS, type PropKindName } from "./props";
import { ShortcutsDialog } from "./shortcuts";
import { StartDialog } from "./start-dialog";
import { editorReducer, isSaved, loaded, NOTHING, pictureOf } from "./state";
import { createReadouts, StatusBar, type Warnings } from "./status-bar";
import { StepsList } from "./steps-list";
import { CURRENT_VERSION } from "./versions";

/** A new knot: one orange rope of two pins. */
export function untitledKnot(): KnotFile {
    return {
        name: "Untitled knot",
        frame: { x: -95, y: -100, w: 300, h: 200 },
        knot: {
            strands: [
                {
                    id: 1,
                    kind: "rope",
                    colour: "orange",
                    diameter: NEW_ROPE_DIAMETER,
                    pins: [
                        { id: 2, x: 0, y: 0 },
                        { id: 3, x: 110, y: 0 },
                    ],
                    segments: [{ id: 4, tension: [1, 1] }],
                },
            ],
            crossings: [],
            props: [],
        },
        steps: [],
    };
}

const UNTITLED = "untitled.json";

/** Which way each move goes, y down. */
const MOVE_DIRECTIONS = {
    moveUp: { x: 0, y: -1 },
    moveLeft: { x: -1, y: 0 },
    moveDown: { x: 0, y: 1 },
    moveRight: { x: 1, y: 0 },
} as const;
const MOVES = Object.keys(MOVE_DIRECTIONS) as (keyof typeof MOVE_DIRECTIONS)[];
const isMove = (id: CommandId): id is (typeof MOVES)[number] => id in MOVE_DIRECTIONS;

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
    const crossings = useMemo(() => pictureCrossings(picture, geometry), [picture, geometry]);
    const drawn = useMemo(
        () => strandPaths(picture, geometry, crossings),
        [picture, geometry, crossings],
    );
    const { selection } = state;
    const parts = selection.kind === "parts" ? selection : NOTHING;
    const pins = parts.kind === "parts" ? parts.pins : [];
    const segments = parts.kind === "parts" ? parts.segments : [];
    const canvas = useRef<CanvasControls>(null);
    const [show, setShow] = useState({
        pinNumbers: false,
        handles: true,
        crossings: false,
        bendWarnings: true,
        grid: true,
        snap: false,
    });
    const [readouts] = useState(createReadouts);
    const [helpOpen, setHelpOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [message, setMessage] = useState<Message | null>(null);
    // Where to start, as the editor opens (`start`), or the library alone, from the File menu.
    const [starting, setStarting] = useState<"start" | "library" | null>("start");
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

    /** A copy of a knot from the library, with no file behind it, so saving it asks where. */
    function openFromLibrary(file: KnotFile, fileName: string) {
        if (!mayDiscard()) return;
        setStarting(null);
        dispatch({ type: "load", file, fileName, saved: true });
    }

    async function open() {
        setStarting(null);
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

    // Pins, segments, a strand or a prop can be moved; only pins turn.
    const movable =
        pins.length > 0 ||
        segments.length > 0 ||
        selection.kind === "strand" ||
        selection.kind === "prop";
    const enabled: Partial<Record<CommandId, boolean>> = {
        new: true,
        open: files,
        library: true,
        save: files,
        saveAs: files,
        details: true,
        undo: state.undo.length > 0,
        redo: state.redo.length > 0,
        delete: pins.length > 0 || selection.kind === "prop" || selection.kind === "strand",
        selectAll: picture.strands.length > 0,
        selectNone: selection.kind !== "parts" || pins.length > 0 || segments.length > 0,
        nextPin: picture.strands.length > 0,
        previousPin: picture.strands.length > 0,
        ...Object.fromEntries(MOVES.map((id) => [id, movable])),
        turnAnticlockwise: pins.length > 0,
        turnClockwise: pins.length > 0,
        link: pins.length === 2,
        unlink: pins.some(([i, k]) => {
            const pin = picture.strands[i]?.pins[k];
            return !!pin && isLinked(pin);
        }),
        insertPin: segments.length > 0,
        insertRope: true,
        insertArrow: true,
        insertStep: true,
        ...Object.fromEntries(PROP_KIND_NAMES.map((kind) => [propCommand(kind), true])),
        zoomIn: true,
        zoomOut: true,
        fit: true,
        pinNumbers: true,
        handles: true,
        crossings: true,
        bendWarnings: true,
        grid: true,
        snap: true,
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
        {
            count: crossings.crossings.filter((c) => c.status === "unset").length,
            one: "crossing unset",
            many: "crossings unset",
        },
        {
            // A pair crossing nowhere (one segment listed as crossing itself) still has its entries to check.
            count: crossings.toCheck.reduce((n, pair) => n + Math.max(pair.found, 1), 0),
            one: "crossing to check",
            many: "crossings to check",
        },
        { count: crossings.lost.length, one: "crossing lost", many: "crossings lost" },
        {
            count: drawn.tooClose.length,
            one: "crossing too close",
            many: "crossings too close",
        },
        {
            count: crossings.passes.filter((p) => p.status === "unset").length,
            one: "pass unset",
            many: "passes unset",
        },
        {
            count: crossings.passesToCheck.reduce((n, segment) => n + segment.found, 0),
            one: "pass to check",
            many: "passes to check",
        },
        { count: crossings.lostPasses.length, one: "pass lost", many: "passes lost" },
        {
            count: drawn.tooClosePasses.length,
            one: "pass too close",
            many: "passes too close",
        },
    ];

    const selectPins = (refs: PinRef[]) =>
        dispatch({ type: "select", selection: { kind: "parts", pins: refs, segments: [] } });

    /** A short straight rope or arrow centred here (the middle of the view, unless it's given), its pins selected. */
    function insertStrand(kind: "rope" | "arrow", centre = canvas.current?.centre()) {
        if (!centre) return;
        const offset = { x: 55, y: 0 } as const;
        const n = picture.strands.length;
        dispatch({
            type: "edit",
            edit: (q, ids) =>
                addStrand(
                    q,
                    kind,
                    centre.sub(new Vector2(offset.x, offset.y)),
                    centre.add(new Vector2(offset.x, offset.y)),
                    ids,
                ),
        });
        selectPins([
            [n, 0],
            [n, 1],
        ]);
    }
    /** A prop of this kind centred here (the middle of the view, unless it's given), selected. */
    function insertProp(name: PropKindName, centre = canvas.current?.centre()) {
        if (!centre) return;
        const kind = PROP_KINDS[name];
        const n = picture.props.length;
        dispatch({ type: "edit", edit: (q, ids) => addProp(q, kind.create(centre, ids())) });
        dispatch({ type: "select", selection: { kind: "prop", prop: n } });
    }
    const menu = (target: MenuTarget) => (
        <DrawingMenu
            target={target}
            picture={picture}
            geometry={geometry}
            crossings={crossings}
            enabled={enabled}
            checked={checked}
            run={run}
            dispatch={dispatch}
            insertAt={(what, at) =>
                what === "rope" || what === "arrow" ? insertStrand(what, at) : insertProp(what, at)
            }
        />
    );
    const run = (id: CommandId, { far = false }: RunOptions = {}) => {
        if (id === "new") {
            if (mayDiscard())
                dispatch({ type: "load", file: untitledKnot(), fileName: UNTITLED, saved: true });
        } else if (id === "open") void open();
        else if (id === "library") setStarting("library");
        else if (id === "save") void save(false);
        else if (id === "saveAs") void save(true);
        else if (id === "details") setDetailsOpen(true);
        else if (id === "undo" || id === "redo") dispatch({ type: id });
        else if (id === "delete") {
            if (selection.kind === "prop") {
                const p = selection.prop;
                dispatch({ type: "edit", edit: (q) => deleteProp(q, p) });
                dispatch({ type: "select", selection: NOTHING });
            } else if (selection.kind === "strand") {
                const i = selection.strand;
                dispatch({ type: "edit", edit: (q) => deleteStrand(q, i) });
            } else dispatch({ type: "edit", edit: (q) => deletePins(q, pins) });
        } else if (id === "link") {
            // The second pin selected follows the first.
            const [leader, follower] = pins;
            dispatch({ type: "edit", edit: (q) => linkPins(q, geometry, leader, follower) });
        } else if (id === "unlink")
            dispatch({ type: "edit", edit: (q) => pins.reduce(unlinkPin, q) });
        else if (id === "selectNone") dispatch({ type: "select", selection: NOTHING });
        else if (id === "nextPin" || id === "previousPin") {
            const ref = nextPin(picture, selection, id === "nextPin" ? 1 : -1);
            if (ref) selectPins([ref]);
        } else if (isMove(id)) {
            // From the picture as it is when the edit runs, so a key held down can't run ahead of the drawing.
            const step = moveStep(canvas.current?.scale() ?? 1, show.snap, far);
            const direction = MOVE_DIRECTIONS[id];
            dispatch({
                type: "edit",
                edit: (q) => moved(q, pictureGeometry(q), selection, direction, step, show.snap),
                merge: "move",
            });
        } else if (id === "turnAnticlockwise" || id === "turnClockwise") {
            const step = far ? FAR_TURN_STEP : TURN_STEP;
            const sign = id === "turnClockwise" ? 1 : -1;
            dispatch({
                type: "edit",
                edit: (q) => turned(q, pictureGeometry(q), selection, sign, step, show.snap),
                merge: "turn",
            });
        } else if (id === "selectAll")
            selectPins(picture.strands.flatMap((s, i) => s.pins.map((_, k): PinRef => [i, k])));
        else if (id === "insertPin") {
            // At the middle (by length) of the first segment selected.
            const [i, k] = segments[0];
            const seg = geometry.strands[i].segments[k];
            const t = seg.cubic.tAtLength(seg.length / 2, seg.length);
            dispatch({ type: "edit", edit: (q, ids) => insertPin(q, geometry, [i, k], t, ids) });
            selectPins([[i, k + 1]]);
        } else if (id === "insertRope") insertStrand("rope");
        else if (id === "insertArrow") insertStrand("arrow");
        else if (id === "insertStep") {
            const after = state.picture;
            dispatch({
                type: "edit-file",
                edit: (f) => insertStep(f, after).file,
                show: insertStep(state.file, after).index,
            });
        } else if (id.startsWith("prop:")) insertProp(id.slice("prop:".length) as PropKindName);
        else if (id === "zoomIn") canvas.current?.zoom(1.25);
        else if (id === "zoomOut") canvas.current?.zoom(0.8);
        else if (id === "fit") canvas.current?.fit();
        else if (
            id === "pinNumbers" ||
            id === "handles" ||
            id === "crossings" ||
            id === "bendWarnings" ||
            id === "grid" ||
            id === "snap"
        )
            setShow((s) => ({ ...s, [id]: !s[id] }));
        else if (id === "shortcuts") setHelpOpen(true);
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
                    <StepsList
                        file={state.file}
                        shown={state.picture}
                        dispatch={dispatch}
                        addStep={() => run("insertStep")}
                    />
                    <ObjectsList
                        picture={picture}
                        selection={selection}
                        dispatch={dispatch}
                        run={run}
                        menu={menu}
                    />
                </aside>
                <main className="min-w-0 flex-1 bg-surface" aria-label="Drawing">
                    <Canvas
                        key={state.loads}
                        ref={canvas}
                        picture={picture}
                        frame={state.file.frame}
                        geometry={geometry}
                        crossings={crossings}
                        drawn={drawn}
                        selection={selection}
                        dispatch={dispatch}
                        show={show}
                        readouts={readouts}
                        menu={menu}
                    />
                </main>
                <aside className="w-64 shrink-0 overflow-y-auto border-l border-line-faint p-3">
                    <Inspector
                        picture={picture}
                        geometry={geometry}
                        crossings={crossings}
                        selection={selection}
                        step={
                            state.picture === "knot"
                                ? undefined
                                : { index: state.picture, step: state.file.steps[state.picture] }
                        }
                        dispatch={dispatch}
                    />
                </aside>
            </div>
            <StatusBar
                readouts={readouts}
                warnings={warnings}
                saved={saved}
                onZoom={(scale) => canvas.current?.setScale(scale)}
            />
            <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
            <StartDialog
                open={starting !== null}
                start={starting === "start"}
                canOpen={files}
                onNew={() => setStarting(null)}
                onOpen={() => void open()}
                onLibrary={openFromLibrary}
                onClose={() => setStarting(null)}
            />
            <DetailsDialog
                open={detailsOpen}
                details={state.file}
                frame={state.file.frame}
                onDone={(done) => {
                    setDetailsOpen(false);
                    if (done)
                        dispatch({
                            type: "edit-file",
                            edit: (f) => setFrame(setDetails(f, done.details), done.frame),
                        });
                }}
            />
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

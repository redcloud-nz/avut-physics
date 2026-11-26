"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
    useCallback,
    useDeferredValue,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Menubar,
    MenubarCheckboxItem,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarShortcut,
    MenubarTrigger,
} from "@/components/ui/menubar";
import { useInBrowser } from "@/components/use-in-browser";
import { KNOTS, type Knot } from "@/knots";
import { rad } from "@/lib/math";
import type { LockedEnd } from "@/lib/rope-3d/curve";
import {
    lockedEnds,
    MoveOp,
    SETTLED_STEPS,
    smoothInPlay,
    tightenInPlay,
    tightenWholeKnot,
    type Play,
    type Stepper,
} from "@/lib/rope-3d/operations";
import { redistribute, segmentMiddle, slideBoundary, type Rope3 } from "@/lib/rope-3d/rope";
import { boundsOf, vec3, type Vector3 } from "@/lib/vector3";
import { FLATS, FlatView } from "@/parts/flat-view";
import FIGURE_8_JSON from "@/rigging/knots/figure-8.json";
import { line } from "@/rigging/rope";
import Loading3D from "@/scene/loading-3d";
import type { Piece, RigLabel } from "@/scene/pieces";
import type { GLHandle, SceneConfig } from "@/scene/scene-gl";

import { canUseFiles, openKnot3d, saveKnot3d, saveKnot3dAs } from "./files";
import { fromDrawing } from "./from-drawing";
import { knot3dFile, setupOf, type Knot3dFile } from "./knot-file";
import { Panel } from "./panel";
import { RopeView, SEGMENT_COLORS } from "./rope-view";
import { initialState, keyDirection, reduce, type ChooseMode } from "./state";

const SceneGL = dynamic(() => import("@/scene/scene-gl").then((m) => m.SceneGL), {
    ssr: false,
    loading: () => <Loading3D />,
});

/** The flying fox's figure 8, the editor's first file: opened as a copy until a file's opened. */
const FIGURE_8 = knot3dFile("figure-8.json", FIGURE_8_JSON);

const DISCARD = "Discard the changes to this knot?";

/** Where the 3D view can look from: a bearing and a height (degrees). */
const LOOKS = [{ label: "Three-quarter", azimuth: 145, elevation: 20 }, ...FLATS];

/** What's running: a move of the handle (by a drag or towards a nudge's goal), or a tightening or smoothing. */
type Running =
    | {
          kind: "move";
          op: MoveOp;
          goal: Vector3;
          dragging: boolean;
          /** How many steps in a row it's been settled. */
          settled: number;
      }
    | { kind: "steps"; label: string; stepper: Stepper; steps: number };

type Message = { title: string; text: string };

const mod = (e: KeyboardEvent) => e.metaKey || e.ctrlKey;

/** The box round the rope: its middle and its longest side. */
function bounds(points: readonly Vector3[]) {
    const { lo, hi } = boundsOf(points);
    const d = hi.sub(lo);
    return { centre: lo.lerp(hi, 0.5), size: Math.max(d.x, d.y, d.z, 0.02) };
}

/** A segment's colour as CSS, for the flat views: by turns, faded out of play while some rope's in play. */
function segmentCss(seg: number, play: Play | null) {
    const base = SEGMENT_COLORS[(seg - 1) % 2];
    if (!play || (seg >= play.from && seg <= play.to)) return base;
    return `color-mix(in oklab, ${base} 35%, var(--surface))`;
}

/** The bars as rods, 80 mm long. */
const barPieces = (file: Knot3dFile): Piece[] =>
    file.props.map((bar) => ({
        kind: "rod",
        a: bar.at.sub(bar.along.scale(0.04)),
        b: bar.at.add(bar.along.scale(0.04)),
        r: bar.r,
        material: "steel",
        color: "var(--tower-steel)",
        capA: true,
        capB: true,
    }));

/**
 * The 3D knot editor: shapes a knot's rope in 3D by hand, a few segments at a time, and tightens it, saving to files on
 * your computer. The panel's on the left, the 3D view in the middle and flat views from the front, side and top on the
 * right. See `docs/knot-editor-3d.md`.
 */
export default function KnotEditor3D() {
    const [state, dispatch] = useReducer(reduce, undefined, () =>
        initialState(FIGURE_8, "figure-8.json"),
    );
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    });
    const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
    const [loads, setLoads] = useState(0);
    const [choosing, setChoosing] = useState(false);
    const [numbers, setNumbers] = useState(true);
    const [glView, setGlView] = useState<GLHandle | null>(null);
    const [message, setMessage] = useState<Message | null>(null);
    const [starting, setStarting] = useState<"start" | "new" | null>("start");
    const inBrowser = useInBrowser();
    const files = inBrowser && canUseFiles();

    // What's running, stepped every frame, and the rope as it is while it runs.
    const running = useRef<Running | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [live, setLive] = useState<Rope3 | null>(null);
    // A move's locked ends, while it runs.
    const [moveLocked, setMoveLocked] = useState<[LockedEnd, LockedEnd] | null>(null);
    const { file, play } = state;
    const rope = live ?? file.rope;

    const title = `${state.fileName}${state.saved ? "" : " •"}`;
    useEffect(() => {
        document.title = `${title} | 3D knot editor`;
    }, [title]);
    useEffect(() => {
        if (state.saved) return;
        const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", onLeave);
        return () => window.removeEventListener("beforeunload", onLeave);
    }, [state.saved]);

    /** What's running, finished: its rope kept as one edit to undo. */
    const finish = useCallback(() => {
        const r = running.current;
        if (!r) return;
        running.current = null;
        const next = r.kind === "move" ? r.op.rope() : r.stepper.result();
        dispatch({ type: "edit", file: { ...stateRef.current.file, rope: next } });
        setLive(null);
        setMoveLocked(null);
        setBusy(null);
    }, []);

    // The run loop: while something's running, a few milliseconds of its steps each frame, and the rope shown.
    useEffect(() => {
        if (!busy) return;
        let frame = 0;
        const tick = () => {
            const r = running.current;
            if (!r) return;
            const start = performance.now();
            let done = false;
            if (r.kind === "move") {
                // Settled (at its goal, or against something), there's nothing to step until the goal moves.
                while (r.settled < SETTLED_STEPS && performance.now() - start < 8)
                    r.settled = r.op.step(r.goal).settled ? r.settled + 1 : 0;
                // Let go of, it finishes once it's settled.
                done = !r.dragging && r.settled >= SETTLED_STEPS;
            } else {
                while (!done && performance.now() - start < 12) {
                    done = r.stepper.step();
                    r.steps++;
                }
                setBusy(`${r.label}: step ${r.steps}`);
            }
            if (done) return finish();
            setLive(r.kind === "move" ? r.op.rope() : r.stepper.rope());
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [busy !== null, finish]); // eslint-disable-line react-hooks/exhaustive-deps

    /** A move of the handle towards `goal`, started if one isn't already running. */
    const moveTowards = (goal: Vector3, dragging: boolean) => {
        if (!play) return;
        const r = running.current;
        if (r?.kind === "move") {
            Object.assign(r, { goal, dragging, settled: 0 });
            return;
        }
        if (r) return;
        const op = new MoveOp(file.rope, setupOf(file), play);
        running.current = {
            kind: "move",
            op,
            goal,
            dragging,
            settled: 0,
        };
        setMoveLocked(op.locked());
        setBusy("Moving");
    };

    /** A tightening or smoothing, started. */
    const run = (label: string, stepper: Stepper) => {
        if (running.current) return;
        running.current = { kind: "steps", label, stepper, steps: 0 };
        setBusy(label);
    };

    const handleAt = play ? segmentMiddle(rope, play.handle) : null;
    const offset = handleAt && state.origin ? handleAt.sub(state.origin) : null;

    // The locked ends: while moving, the move's own; otherwise where they'd be for the rope in play.
    const idleLocked = useMemo(
        () => (play ? lockedEnds(file.rope, play) : null),
        [file.rope, play],
    );
    const locked = moveLocked ?? idleLocked;

    // The view's starting place, from the rope as each file's opened.
    const scene: SceneConfig = useMemo(() => {
        const box = bounds(file.rope.points);
        return {
            centre: box.centre,
            distance: (box.size / 2 / Math.tan(rad(15))) * 1.3,
            azimuth: 145,
            elevation: 20,
            maxDistance: box.size * 12,
            zoomOut: 3,
            bounds: {
                lo: box.centre.sub(vec3(1, 1, 1).scale(box.size)),
                hi: box.centre.add(vec3(1, 1, 1).scale(box.size)),
            },
            minDistance: 0.03,
            below: true,
            ground: [],
            compass: [],
            letter: 0,
            minR: {},
            label: `${file.name} in 3D. Drag to turn it, scroll to zoom and right-drag to move it. Click a segment to choose it.`,
        };
    }, [loads]); // eslint-disable-line react-hooks/exhaustive-deps
    const bars = useMemo(() => barPieces(file), [file]);

    // Each segment's number, written along it.
    const labels = useMemo(() => {
        if (!numbers) return [];
        const out: RigLabel[] = [];
        let from = 0;
        for (let i = 1; i <= rope.points.length; i++) {
            if (i < rope.points.length && rope.seg[i] === rope.seg[from]) continue;
            const run = rope.points.slice(from, Math.min(i + 1, rope.points.length));
            let length = 0;
            for (let k = 1; k < run.length; k++) length += run[k].distanceTo(run[k - 1]);
            const dir = run.at(-1)!.sub(run[0]);
            out.push({
                text: String(rope.seg[from]),
                at: run[Math.floor(run.length / 2)],
                on: {
                    along: dir.len() > 0 ? dir.unit() : vec3(1, 0, 0),
                    length,
                    r: file.diameter / 2,
                },
                size: 0.55,
            });
            from = i;
        }
        return out;
    }, [rope, numbers, file.diameter]);

    // The flat views draw the rope as it was a moment ago while it's moving, so the 3D view keeps up.
    const flatRope = useDeferredValue(rope);
    const flatPieces = useMemo(() => {
        const pieces: Piece[] = [...bars];
        let from = 0;
        for (let i = 1; i <= flatRope.points.length; i++) {
            if (i < flatRope.points.length && flatRope.seg[i] === flatRope.seg[from]) continue;
            const run = flatRope.points.slice(from, Math.min(i + 1, flatRope.points.length));
            pieces.push(...line(run, file.diameter / 2, segmentCss(flatRope.seg[from], play)));
            from = i;
        }
        return pieces;
    }, [flatRope, bars, play, file.diameter]);

    /** Opening a file or starting a new one: asks first if there are unsaved changes. */
    const mayDiscard = () => state.saved || window.confirm(DISCARD);
    const load = (
        next: Knot3dFile,
        fileName: string,
        saved: boolean,
        h: FileSystemFileHandle | null,
    ) => {
        if (running.current) finish();
        dispatch({ type: "load", file: next, fileName, saved });
        setHandle(h);
        setLoads((n) => n + 1);
        setStarting(null);
    };

    async function open() {
        if (!mayDiscard()) return;
        const opened = await openKnot3d();
        if (opened.kind === "cancelled") return;
        if (opened.kind === "error")
            return setMessage({ title: "Couldn't open the file", text: opened.reason });
        load(opened.file, opened.handle.name, opened.upgradedFrom === undefined, opened.handle);
        if (opened.upgradedFrom !== undefined)
            setMessage({
                title: "Upgraded",
                text: `${opened.handle.name} was version ${opened.upgradedFrom}. It's been upgraded, and saving writes the new version.`,
            });
    }

    async function save(as: boolean) {
        if (running.current) finish();
        const current = stateRef.current.file;
        const result =
            handle && !as
                ? await saveKnot3d(handle, current)
                : await saveKnot3dAs(current, state.fileName);
        if (result.kind === "cancelled") return;
        if (result.kind === "error")
            return setMessage({ title: "Couldn't save", text: result.reason });
        setHandle(result.handle);
        dispatch({ type: "saved", fileName: result.handle.name });
    }

    function newFrom(knot: Knot) {
        if (!mayDiscard()) return;
        load(fromDrawing(knot), `${knot.slug}.json`, false, null);
    }

    const undo = () => !running.current && dispatch({ type: "undo" });
    const redo = () => !running.current && dispatch({ type: "redo" });
    const edit = (next: Knot3dFile) => !running.current && dispatch({ type: "edit", file: next });
    const chooseSegment = (seg: number, mode: ChooseMode) =>
        !running.current && dispatch({ type: "choose", seg, mode });

    /** Moves the handle on by `by` from where it is, or from where an unfinished nudge is taking it. */
    const nudge = (by: Vector3) => {
        const r = running.current;
        const base = r?.kind === "move" && !r.dragging ? r.goal : handleAt;
        if (base) moveTowards(base.add(by), false);
    };

    // The bearing the view looks from, for the keys that move the handle.
    const azimuth = useRef(0);
    const onTurn = useCallback((a: number) => {
        azimuth.current = a;
    }, []);

    // Shortcuts, not while typing in a field.
    useEffect(() => {
        const listener = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest("input, textarea, select")) return;
            const k = e.code;
            if (mod(e) && k === "KeyO") return (e.preventDefault(), void open());
            if (mod(e) && k === "KeyS") return (e.preventDefault(), void save(e.shiftKey));
            if (mod(e) && e.altKey && k === "KeyN") return (e.preventDefault(), setStarting("new"));
            if (mod(e) && k === "KeyZ") return (e.preventDefault(), e.shiftKey ? redo() : undo());
            if (mod(e)) return;
            if (k === "Escape")
                return running.current ? finish() : dispatch({ type: "choose-none" });
            if (k === "KeyC") return setChoosing((c) => !c);
            const dir = keyDirection(k, azimuth.current);
            if (dir && play) {
                e.preventDefault();
                if (!running.current || running.current.kind === "move")
                    nudge(dir.scale((e.shiftKey ? 5 : 1) / 1000));
            }
        };
        window.addEventListener("keydown", listener);
        return () => window.removeEventListener("keydown", listener);
    });

    const setup = setupOf(file);
    return (
        <div className="flex h-full flex-col bg-background text-ink">
            <header className="flex items-center gap-3 border-b border-line-faint px-2 py-1">
                <Menubar className="h-auto rounded-none border-0 bg-transparent p-0">
                    <MenubarMenu>
                        <MenubarTrigger className="px-2 py-1">File</MenubarTrigger>
                        <MenubarContent className="min-w-56">
                            <MenubarItem onSelect={() => setStarting("new")}>
                                New from a Knot Drawing… <MenubarShortcut>⌥⌘N</MenubarShortcut>
                            </MenubarItem>
                            <MenubarItem disabled={!files} onSelect={() => void open()}>
                                Open… <MenubarShortcut>⌘O</MenubarShortcut>
                            </MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem disabled={!files} onSelect={() => void save(false)}>
                                Save <MenubarShortcut>⌘S</MenubarShortcut>
                            </MenubarItem>
                            <MenubarItem disabled={!files} onSelect={() => void save(true)}>
                                Save As… <MenubarShortcut>⇧⌘S</MenubarShortcut>
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu>
                        <MenubarTrigger className="px-2 py-1">Edit</MenubarTrigger>
                        <MenubarContent className="min-w-56">
                            <MenubarItem
                                disabled={!state.past.length || busy !== null}
                                onSelect={undo}
                            >
                                Undo <MenubarShortcut>⌘Z</MenubarShortcut>
                            </MenubarItem>
                            <MenubarItem
                                disabled={!state.future.length || busy !== null}
                                onSelect={redo}
                            >
                                Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
                            </MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem
                                disabled={busy !== null}
                                onSelect={() => edit({ ...file, rope: redistribute(file.rope) })}
                            >
                                Redistribute Segments
                            </MenubarItem>
                            <MenubarSeparator />
                            <MenubarCheckboxItem checked={choosing} onCheckedChange={setChoosing}>
                                Choose in Play <MenubarShortcut>C</MenubarShortcut>
                            </MenubarCheckboxItem>
                            <MenubarItem onSelect={() => dispatch({ type: "choose-none" })}>
                                Nothing in Play <MenubarShortcut>Esc</MenubarShortcut>
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu>
                        <MenubarTrigger className="px-2 py-1">View</MenubarTrigger>
                        <MenubarContent className="min-w-56">
                            {LOOKS.map((l) => (
                                <MenubarItem
                                    key={l.label}
                                    onSelect={() => glView?.look(l.azimuth, l.elevation)}
                                >
                                    Look from the {l.label}
                                </MenubarItem>
                            ))}
                            <MenubarItem onSelect={() => glView?.reset()}>Whole Knot</MenubarItem>
                            <MenubarSeparator />
                            <MenubarCheckboxItem checked={numbers} onCheckedChange={setNumbers}>
                                Segment Numbers
                            </MenubarCheckboxItem>
                        </MenubarContent>
                    </MenubarMenu>
                </Menubar>
                <span className="text-sm text-ink-soft">{title}</span>
                <span className="ml-auto text-xs text-ink-muted">3D knot editor</span>
            </header>
            {inBrowser && !files && (
                <p className="border-b border-line-faint bg-surface px-3 py-1 text-xs text-warning">
                    This browser can&apos;t open or save files on your computer. Use Chrome or Edge.
                </p>
            )}
            <div className="flex min-h-0 flex-1">
                <aside className="w-72 shrink-0 overflow-y-auto border-r border-line-faint p-3">
                    <Panel
                        file={file}
                        rope={rope}
                        play={play}
                        offset={offset}
                        choosing={choosing}
                        busy={busy}
                        onChoosing={setChoosing}
                        onNudge={nudge}
                        onOffset={(to) => state.origin && moveTowards(state.origin.add(to), false)}
                        onTighten={() =>
                            play && run("Tightening in play", tightenInPlay(file.rope, setup, play))
                        }
                        onSmooth={() =>
                            play && run("Smoothing", smoothInPlay(file.rope, setup, play))
                        }
                        onTightenKnot={() =>
                            run(
                                "Tightening the knot",
                                tightenWholeKnot(file.rope, setup, file.held, file.knot),
                            )
                        }
                        onStop={finish}
                        onSlide={(after, by) =>
                            edit({ ...file, rope: slideBoundary(file.rope, after, by) })
                        }
                        onEdit={edit}
                    />
                </aside>
                <main className="relative min-w-0 flex-[2] bg-surface" aria-label="3D view">
                    <SceneGL
                        key={loads}
                        scene={scene}
                        pieces={bars}
                        labels={labels}
                        onReady={setGlView}
                        onTurn={onTurn}
                    >
                        <RopeView
                            rope={rope}
                            diameter={file.diameter}
                            play={play}
                            handle={handleAt}
                            locked={locked}
                            choosing={choosing}
                            onChoose={chooseSegment}
                            onDragStart={() => handleAt && moveTowards(handleAt, true)}
                            onDrag={(goal) => moveTowards(goal, true)}
                            onDragEnd={() => {
                                const r = running.current;
                                if (r?.kind === "move") r.dragging = false;
                            }}
                        />
                    </SceneGL>
                </main>
                <aside className="flex w-80 shrink-0 flex-col border-l border-line-faint">
                    {FLATS.map((f) => (
                        <FlatView
                            key={f.label}
                            name={file.name}
                            pieces={flatPieces}
                            labels={[]}
                            view={f}
                            detail="high"
                        />
                    ))}
                </aside>
            </div>
            <StartDialog
                open={starting !== null}
                start={starting === "start"}
                canOpen={files}
                onOpen={() => {
                    setStarting(null);
                    void open();
                }}
                onCopy={() => setStarting(null)}
                onNew={newFrom}
                onClose={() => setStarting(null)}
            />
            {/* A desktop tool: on a small screen it's covered by a note saying so. */}
            <div className="fixed inset-0 z-60 flex flex-col items-center justify-center gap-3 bg-background p-6 text-center lg:hidden">
                <h1 className="text-xl font-semibold text-ink-bright">3D knot editor</h1>
                <p className="max-w-xs text-base text-ink-soft">
                    The 3D knot editor needs a bigger screen. Open it on a computer, in Chrome or
                    Edge.
                </p>
                <Link href="/" className="text-base text-link hover:text-highlight">
                    ← Physics Visualisations
                </Link>
            </div>
            <Dialog open={message !== null} onOpenChange={(o) => !o && setMessage(null)}>
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

/**
 * Where to start: as the editor opens, open a file, work on a copy of the flying fox's figure 8, or start from a knot
 * drawing; from File > New, the drawings alone.
 */
function StartDialog(props: {
    open: boolean;
    start: boolean;
    canOpen: boolean;
    onOpen: () => void;
    onCopy: () => void;
    onNew: (knot: Knot) => void;
    onClose: () => void;
}) {
    return (
        <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {props.start ? "3D knot editor" : "New from a knot drawing"}
                    </DialogTitle>
                    <DialogDescription>
                        {props.start
                            ? "Open a 3D knot file, work on a copy of the flying fox's figure 8, or start from one of the Rescue Knots drawings."
                            : "The drawing's rope lifted into 3D as it's drawn, loose, in segments 20 mm long, with its ends held."}
                    </DialogDescription>
                </DialogHeader>
                {props.start && (
                    <div className="flex flex-wrap gap-2">
                        <Button disabled={!props.canOpen} onClick={props.onOpen}>
                            Open…
                        </Button>
                        <Button variant="secondary" onClick={props.onCopy}>
                            Figure 8 (a copy)
                        </Button>
                    </div>
                )}
                <div className="max-h-72 overflow-y-auto">
                    {props.start && (
                        <p className="mb-1 text-sm text-ink-muted">New from a drawing</p>
                    )}
                    <ul className="text-sm">
                        {KNOTS.map((knot) => (
                            <li key={knot.slug}>
                                <button
                                    type="button"
                                    className="w-full rounded px-2 py-1 text-left hover:bg-line-faint"
                                    onClick={() => props.onNew(knot)}
                                >
                                    {knot.name}
                                    {knot.variant && (
                                        <span className="text-ink-muted"> {knot.variant}</span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </DialogContent>
        </Dialog>
    );
}

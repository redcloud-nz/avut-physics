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
import { openKnotFile } from "@/knot-editor/files";
import { KNOTS, type Knot } from "@/knots";
import { rad } from "@/lib/math";
import { ropeProblems } from "@/lib/rope-3d/checks";
import {
    cubicLength,
    movePin,
    pinDirections,
    removePin,
    sampleCounts,
    sampleRope,
    segmentCubics,
    splitSegment,
    type PinnedRope,
} from "@/lib/rope-3d/pinned";
import { arcLengths } from "@/lib/rope-3d/rope";
import { StageRun, type Role } from "@/lib/rope-3d/stage";
import { PassWatch, timesThrough } from "@/lib/rope-3d/watch";
import { boundsOf, vec3, type Vector3 } from "@/lib/vector3";
import { FLATS, FlatView } from "@/parts/flat-view";
import { crossingsDiffer, ropeCrossings } from "@/rigging/knot-crossings";
import FIGURE_8_JSON from "@/rigging/knots/figure-8.json";
import { line } from "@/rigging/rope";
import Loading3D from "@/scene/loading-3d";
import type { Piece, RigLabel } from "@/scene/pieces";
import type { GLHandle, SceneConfig } from "@/scene/scene-gl";

import { canUseFiles, openKnot3d, saveKnot3d, saveKnot3dAs } from "./files";
import { fromDrawing, fromPicture } from "./from-drawing";
import { knot3dFile, setupOf, type Knot3dFile } from "./knot-file";
import { Panel, type Brush, type StageStatus } from "./panel";
import { ROLE_COLORS, RopeView, SEGMENT_COLORS } from "./rope-view";
import { initialState, keyDirection, reduce, segmentsBetween, startPainting } from "./state";

const SceneGL = dynamic(() => import("@/scene/scene-gl").then((m) => m.SceneGL), {
    ssr: false,
    loading: () => <Loading3D />,
});

/** The flying fox's figure 8, the editor's first file: opened as a copy until a file's opened. */
const FIGURE_8 = knot3dFile("figure-8.json", FIGURE_8_JSON);

const DISCARD = "Discard the changes to this knot?";

/** Where the 3D view can look from: a bearing and a height (degrees). */
const LOOKS = [{ label: "Three-quarter", azimuth: 145, elevation: 20 }, ...FLATS];

/** How many steps Step runs. */
const STEP = 25;
/** How many steps Settle runs. */
const SETTLE = 150;

type Message = { title: string; text: string };

const mod = (e: KeyboardEvent) => e.metaKey || e.ctrlKey;

/** The box round the rope: its middle and its longest side. */
function bounds(points: readonly Vector3[]) {
    const { lo, hi } = boundsOf(points);
    const d = hi.sub(lo);
    return { centre: lo.lerp(hi, 0.5), size: Math.max(d.x, d.y, d.z, 0.02) };
}

/** The bars as rods 80 mm long, and the carabiners as their rods' middle lines. */
const propPieces = (file: Knot3dFile): Piece[] =>
    file.props.map((p) =>
        p.kind === "bar"
            ? {
                  kind: "rod",
                  a: p.at.sub(p.along.scale(0.04)),
                  b: p.at.add(p.along.scale(0.04)),
                  r: p.r,
                  material: "steel",
                  color: "var(--tower-steel)",
                  capA: true,
                  capB: true,
              }
            : {
                  kind: "strand",
                  points: p.loop,
                  r: p.r,
                  material: "steel",
                  color: "var(--tower-steel)",
                  capA: false,
                  capB: false,
              },
    );

/** A pin being dragged: which, the rope's sampling frozen so the watch can follow its points, and what it passed. */
type Drag = {
    k: number;
    counts: number[];
    watch: PassWatch;
    linked: number[];
    passed: string | null;
};

/** A stage running (or paused): Step runs it on to `to` steps, Run with no end. */
type Running = { run: StageRun; settling: boolean; to: number | null };

/** A stage's state for the panel. */
const statusOf = (r: Running, on: boolean): StageStatus => ({
    steps: r.run.steps,
    shorter: r.run.shorter,
    running: on,
    ended: r.run.ended,
    problem: r.run.problem,
    settling: r.settling,
});

/**
 * The 3D knot editor: shapes a knot's rope in 3D by its pins, and tightens it in stages, saving to files on your
 * computer. The panel's on the left, the 3D view in the middle and flat views from the front, side and top on the
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
    const [numbers, setNumbers] = useState(true);
    const [showPins, setShowPins] = useState(true);
    const [glView, setGlView] = useState<GLHandle | null>(null);
    const [message, setMessage] = useState<Message | null>(null);
    const [starting, setStarting] = useState<"start" | "new" | null>("start");
    const [brush, setBrush] = useState<Brush>("shorten");
    const [until, setUntil] = useState(0.15);
    const inBrowser = useInBrowser();
    const files = inBrowser && canUseFiles();
    const { file, picked, mode, painting } = state;
    const d = file.diameter;
    const setup = useMemo(() => setupOf(file), [file]);

    // A pin's drag: the rope as it's dragged, and what the last drag passed through.
    const drag = useRef<Drag | null>(null);
    const [live, setLive] = useState<{ rope: PinnedRope; counts: number[] } | null>(null);
    const [passed, setPassed] = useState<string | null>(null);
    // A stage of tightening (or a settle): what's running, and its rope as it is.
    const running = useRef<Running | null>(null);
    const [stage, setStage] = useState<StageStatus | null>(null);
    const [stageView, setStageView] = useState<{
        points: readonly Vector3[];
        pinAt: readonly number[];
    } | null>(null);
    const busy = stage !== null;

    const rope = live?.rope ?? file.rope;
    const sampled = useMemo(() => sampleRope(rope, d / 4, live?.counts), [rope, d, live]);
    const shown = stageView?.points ?? sampled.points;
    const pinAt = stageView?.pinAt ?? sampled.pinAt;
    const directions = useMemo(() => pinDirections(rope.pins), [rope]);

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

    // What's picked, where it is in the rope.
    const pinIndex = picked?.kind === "pin" ? rope.pins.findIndex((p) => p.id === picked.id) : -1;
    const segIndex =
        picked?.kind === "segment" ? rope.segments.findIndex((s) => s.id === picked.id) : -1;
    const pickedPin =
        mode === "shape" && pinIndex >= 0
            ? { index: pinIndex, pin: rope.pins[pinIndex], dir: directions[pinIndex] }
            : null;
    const pickedSegment =
        mode === "shape" && segIndex >= 0
            ? {
                  index: segIndex,
                  segment: rope.segments[segIndex],
                  length: cubicLength(segmentCubics(rope)[segIndex]),
              }
            : null;

    const edit = (next: Knot3dFile) => !running.current && dispatch({ type: "edit", file: next });
    const editRope = (next: PinnedRope) => edit({ ...file, rope: next });
    const undo = () => !running.current && dispatch({ type: "undo" });
    const redo = () => !running.current && dispatch({ type: "redo" });

    // The stage's run loop: while it runs, a few milliseconds of its steps each frame, and the rope shown.
    const [ticking, setTicking] = useState(false);
    useEffect(() => {
        if (!ticking) return;
        let frame = 0;
        const tick = () => {
            const r = running.current;
            if (!r) return;
            const start = performance.now();
            let stop = false;
            while (performance.now() - start < 12) {
                if (r.run.step()) {
                    stop = true;
                    break;
                }
                if (r.to !== null && r.run.steps >= r.to) {
                    stop = true;
                    break;
                }
            }
            setStageView({ points: r.run.points, pinAt: r.run.sampled.pinAt });
            setStage(statusOf(r, !stop));
            if (stop) return setTicking(false);
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [ticking]);

    /** A stage begun (or a settle), or the one open, run for `steps` more steps or with no end. */
    const go = (steps: number | null, settling = false) => {
        let r = running.current;
        if (!r) {
            const run = settling
                ? new StageRun(file.rope, setup, startPainting(file.rope), { limit: SETTLE })
                : new StageRun(file.rope, setup, painting, { until });
            if (!settling && !run.shortens)
                return setMessage({
                    title: "Nothing to shorten",
                    text: "Paint some segments Shorten first. Segments held at both ends don't shorten.",
                });
            r = { run, settling, to: null };
            setStageView({ points: run.points, pinAt: run.sampled.pinAt });
        }
        if (r.run.ended) return;
        const next = { ...r, to: steps === null ? null : r.run.steps + steps };
        running.current = next;
        setStage(statusOf(next, true));
        setTicking(true);
    };
    const pause = () => {
        setTicking(false);
        const r = running.current;
        if (r) setStage(statusOf(r, false));
    };
    const closeStage = () => {
        setTicking(false);
        running.current = null;
        setStage(null);
        setStageView(null);
    };
    /** The stage kept: the rope fitted back to pins, the stage listed (a settle isn't), as one edit to undo. */
    const keep = () => {
        const r = running.current;
        if (!r) return;
        const { rope: next } = r.run.result();
        const { painting: used, options } = r.run;
        const ofRole = (role: Role) => [...used].filter(([, x]) => x === role).map(([id]) => id);
        closeStage();
        dispatch({
            type: "edit",
            file: {
                ...file,
                rope: next,
                stages: r.settling
                    ? file.stages
                    : [
                          ...file.stages,
                          {
                              shorten: ofRole("shorten"),
                              hold: ofRole("hold"),
                              straight: ofRole("straight"),
                              ...(options.until !== undefined && { until: options.until }),
                              reached: r.run.shorter,
                              ended: r.run.ended ?? "stopped",
                          },
                      ],
            },
        });
        // Pieces a segment was split into are painted as it was.
        const added: [number, Role][] = [];
        let role: Role | undefined;
        for (const s of next.segments) {
            if (used.has(s.id)) role = used.get(s.id);
            else if (role && !file.rope.segments.some((t) => t.id === s.id))
                added.push([s.id, role]);
            else role = undefined;
        }
        for (const [id, x] of added) dispatch({ type: "paint", ids: [id], role: x });
    };

    // Moving a pin: by its arrows, live; by a nudge or a typed place, at once.
    const dragStart = () => {
        if (pinIndex < 0) return;
        const s = sampleRope(file.rope, d / 4);
        const watch = new PassWatch(d, arcLengths(s.points));
        watch.look(s.points);
        drag.current = {
            k: pinIndex,
            counts: sampleCounts(s),
            watch,
            linked: (setup.loops ?? []).map((l) => timesThrough(l.points, s.points)),
            passed: null,
        };
        setPassed(null);
    };
    const dragTo = (goal: Vector3) => {
        const g = drag.current;
        if (!g) return;
        const next = movePin(file.rope, g.k, goal);
        if (!g.passed) {
            const points = sampleRope(next, d / 4, g.counts).points;
            g.passed =
                g.watch.look(points) ??
                ((setup.loops ?? []).some((l, i) => timesThrough(l.points, points) !== g.linked[i])
                    ? "the rope went through the carabiner's rod"
                    : null);
        }
        setLive({ rope: next, counts: g.counts });
    };
    const dragEnd = () => {
        const g = drag.current;
        drag.current = null;
        if (live) editRope(live.rope);
        setLive(null);
        setPassed(g?.passed ?? null);
    };
    const nudge = (by: Vector3) =>
        pinIndex >= 0 &&
        editRope(movePin(file.rope, pinIndex, file.rope.pins[pinIndex].at.add(by)));

    // Checks on the rope as it lies, a moment behind it while it moves.
    const checked = useDeferredValue(shown);
    const checks = useMemo(() => {
        const problems = ropeProblems(checked, {
            diameter: d,
            minBend: file.minBend,
            bars: setup.bars,
            loops: setup.loops,
        });
        const crossings = file.crossings
            ? crossingsDiffer(
                  ropeCrossings(checked),
                  file.crossings.map((c) => ({ crossing: c.crossing - 1, over: c.over })),
              )
            : null;
        return { problems, crossings, passed };
    }, [checked, d, file.minBend, file.crossings, setup, passed]);

    // Each segment's colour: by turns while shaping (the picked one lighter), by its role while tightening.
    const colorOf = useCallback(
        (k: number) => {
            const seg = rope.segments[k];
            const base = SEGMENT_COLORS[k % 2];
            if (mode === "tighten") {
                const role = painting.get(seg.id);
                return role
                    ? ROLE_COLORS[role]
                    : `color-mix(in oklab, ${base} 45%, var(--surface))`;
            }
            return seg.id === picked?.id && picked.kind === "segment"
                ? `color-mix(in oklab, ${base} 60%, white)`
                : base;
        },
        [rope, mode, painting, picked],
    );

    // The view's starting place, from the rope as each file's opened.
    const scene: SceneConfig = useMemo(() => {
        const box = bounds(sampleRope(file.rope, d).points);
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
            label: `${file.name} in 3D. Drag to turn it, scroll to zoom and right-drag to move it. Click a pin or a segment to pick it.`,
        };
    }, [loads]); // eslint-disable-line react-hooks/exhaustive-deps
    const props3 = useMemo(() => propPieces(file), [file]);

    // Each segment's name, written along it.
    const labels = useMemo(() => {
        if (!numbers) return [];
        const out: RigLabel[] = [];
        rope.segments.forEach((seg, k) => {
            const run = shown.slice(pinAt[k], pinAt[k + 1] + 1);
            if (run.length < 2) return;
            let length = 0;
            for (let i = 1; i < run.length; i++) length += run[i].distanceTo(run[i - 1]);
            const dir = run.at(-1)!.sub(run[0]);
            out.push({
                text: seg.name,
                at: run[Math.floor(run.length / 2)],
                on: { along: dir.len() > 0 ? dir.unit() : vec3(1, 0, 0), length, r: d / 2 },
                size: 0.55,
            });
        });
        return out;
    }, [rope, shown, pinAt, numbers, d]);

    // The flat views draw the rope as it was a moment ago while it's moving, so the 3D view keeps up.
    const flatPoints = useDeferredValue(shown);
    const flatPieces = useMemo(() => {
        const pieces: Piece[] = [...props3];
        rope.segments.forEach((_, k) => {
            const run = flatPoints.slice(pinAt[k], pinAt[k + 1] + 1);
            if (run.length > 1) pieces.push(...line(run, d / 2, colorOf(k)));
        });
        return pieces;
    }, [flatPoints, props3, rope, pinAt, d, colorOf]);

    /** Opening a file or starting a new one: asks first if there are unsaved changes. */
    const mayDiscard = () => state.saved || window.confirm(DISCARD);
    const load = (
        next: Knot3dFile,
        fileName: string,
        saved: boolean,
        h: FileSystemFileHandle | null,
    ) => {
        closeStage();
        dispatch({ type: "load", file: next, fileName, saved });
        setHandle(h);
        setLoads((n) => n + 1);
        setStarting(null);
        setPassed(null);
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
        if (running.current) return;
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

    async function newFromFile() {
        setStarting(null);
        if (!mayDiscard()) return;
        const opened = await openKnotFile();
        if (opened.kind === "cancelled") return;
        if (opened.kind === "error")
            return setMessage({ title: "Couldn't open the drawing", text: opened.reason });
        const slug = opened.handle.name.replace(/\.json$/, "");
        try {
            load(
                fromPicture(opened.file.knot, opened.file.name, slug),
                `${slug}.json`,
                false,
                null,
            );
        } catch (e) {
            setMessage({ title: "Couldn't start from the drawing", text: (e as Error).message });
        }
    }

    const clickSegment = (k: number, shift: boolean) => {
        if (running.current) return;
        const id = rope.segments[k].id;
        if (mode === "shape") return dispatch({ type: "pick", picked: { kind: "segment", id } });
        const ids =
            shift && state.lastPainted !== null
                ? segmentsBetween(rope, state.lastPainted, id)
                : [id];
        dispatch({ type: "paint", ids, role: brush === "slides" ? null : brush });
    };

    // The bearing the view looks from, for the keys that move a pin.
    const azimuth = useRef(0);
    const onTurn = useCallback((a: number) => {
        azimuth.current = a;
    }, []);

    // Shortcuts, not while typing in a field.
    useEffect(() => {
        const listener = (e: KeyboardEvent) => {
            if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
            const k = e.code;
            if (mod(e) && k === "KeyO") return (e.preventDefault(), void open());
            if (mod(e) && k === "KeyS") return (e.preventDefault(), void save(e.shiftKey));
            if (mod(e) && e.altKey && k === "KeyN") return (e.preventDefault(), setStarting("new"));
            if (mod(e) && k === "KeyZ") return (e.preventDefault(), e.shiftKey ? redo() : undo());
            if (mod(e)) return;
            if (k === "Escape")
                return running.current ? pause() : dispatch({ type: "pick", picked: null });
            const dir = keyDirection(k, azimuth.current);
            if (dir && pickedPin && !running.current) {
                e.preventDefault();
                nudge(dir.scale((e.shiftKey ? 5 : 1) / 1000));
            }
        };
        window.addEventListener("keydown", listener);
        return () => window.removeEventListener("keydown", listener);
    });

    const pinMarks =
        mode === "shape" && showPins && !busy
            ? rope.pins.map((p, k) => ({ at: p.at, held: !!p.along, picked: k === pinIndex }))
            : null;

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
                            <MenubarItem disabled={!files} onSelect={() => void newFromFile()}>
                                New from a Drawing File…
                            </MenubarItem>
                            <MenubarItem disabled={!files} onSelect={() => void open()}>
                                Open… <MenubarShortcut>⌘O</MenubarShortcut>
                            </MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem
                                disabled={!files || busy}
                                onSelect={() => void save(false)}
                            >
                                Save <MenubarShortcut>⌘S</MenubarShortcut>
                            </MenubarItem>
                            <MenubarItem disabled={!files || busy} onSelect={() => void save(true)}>
                                Save As… <MenubarShortcut>⇧⌘S</MenubarShortcut>
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>
                    <MenubarMenu>
                        <MenubarTrigger className="px-2 py-1">Edit</MenubarTrigger>
                        <MenubarContent className="min-w-56">
                            <MenubarItem disabled={!state.past.length || busy} onSelect={undo}>
                                Undo <MenubarShortcut>⌘Z</MenubarShortcut>
                            </MenubarItem>
                            <MenubarItem disabled={!state.future.length || busy} onSelect={redo}>
                                Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
                            </MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem
                                onSelect={() =>
                                    dispatch({
                                        type: "paint",
                                        ids: rope.segments.map((s) => s.id),
                                        role: null,
                                    })
                                }
                            >
                                Clear the Painting
                            </MenubarItem>
                            <MenubarItem onSelect={() => dispatch({ type: "pick", picked: null })}>
                                Pick Nothing <MenubarShortcut>Esc</MenubarShortcut>
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
                                Segment Names
                            </MenubarCheckboxItem>
                            <MenubarCheckboxItem checked={showPins} onCheckedChange={setShowPins}>
                                Pins
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
                        mode={mode}
                        busy={busy}
                        pin={pickedPin}
                        segment={pickedSegment}
                        painting={painting}
                        brush={brush}
                        until={until}
                        stage={stage}
                        checks={checks}
                        onMode={(m) => dispatch({ type: "mode", mode: m })}
                        onBrush={setBrush}
                        onUntil={setUntil}
                        onNudge={nudge}
                        onPinAt={(at) =>
                            pinIndex >= 0 && editRope(movePin(file.rope, pinIndex, at))
                        }
                        onHoldDirection={(along) =>
                            pinIndex >= 0 &&
                            editRope({
                                ...file.rope,
                                pins: file.rope.pins.map((p, i) =>
                                    i === pinIndex
                                        ? { id: p.id, at: p.at, ...(along && { along }) }
                                        : p,
                                ),
                            })
                        }
                        onRemovePin={() =>
                            pinIndex >= 0 && editRope(removePin(file.rope, pinIndex))
                        }
                        onSplit={() => segIndex >= 0 && editRope(splitSegment(file.rope, segIndex))}
                        onTension={(tension) =>
                            segIndex >= 0 &&
                            editRope({
                                ...file.rope,
                                segments: file.rope.segments.map((s, i) =>
                                    i === segIndex ? { ...s, tension } : s,
                                ),
                            })
                        }
                        onSettle={() => go(null, true)}
                        onRun={() => go(null)}
                        onPause={pause}
                        onStep={() => go(STEP)}
                        onKeep={keep}
                        onDiscard={closeStage}
                        onEdit={edit}
                    />
                </aside>
                <main className="relative min-w-0 flex-[2] bg-surface" aria-label="3D view">
                    <SceneGL
                        key={loads}
                        scene={scene}
                        pieces={props3}
                        labels={labels}
                        onReady={setGlView}
                        onTurn={onTurn}
                    >
                        <RopeView
                            points={shown}
                            pinAt={pinAt}
                            diameter={d}
                            colorOf={colorOf}
                            pins={pinMarks}
                            handle={pickedPin && !busy ? pickedPin.pin.at : null}
                            marks={checks.problems}
                            onSegment={clickSegment}
                            onPin={(k) =>
                                !busy &&
                                dispatch({
                                    type: "pick",
                                    picked: { kind: "pin", id: rope.pins[k].id },
                                })
                            }
                            onDragStart={dragStart}
                            onDrag={dragTo}
                            onDragEnd={dragEnd}
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
                onNewFromFile={() => void newFromFile()}
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
 * drawing (one of the Rescue Knots, or any drawing file); from File > New, the drawings alone.
 */
function StartDialog(props: {
    open: boolean;
    start: boolean;
    canOpen: boolean;
    onOpen: () => void;
    onCopy: () => void;
    onNew: (knot: Knot) => void;
    onNewFromFile: () => void;
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
                            ? "Open a 3D knot file, work on a copy of the flying fox's figure 8, or start from a knot drawing."
                            : "The drawing's rope lifted into 3D as it's drawn, loose, with its pins and segment numbers, and a pin added at each crossing."}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-wrap gap-2">
                    {props.start && (
                        <>
                            <Button disabled={!props.canOpen} onClick={props.onOpen}>
                                Open…
                            </Button>
                            <Button variant="secondary" onClick={props.onCopy}>
                                Figure 8 (a copy)
                            </Button>
                        </>
                    )}
                    <Button
                        variant="secondary"
                        disabled={!props.canOpen}
                        onClick={props.onNewFromFile}
                    >
                        From a drawing file…
                    </Button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                    <p className="mb-1 text-sm text-ink-muted">From a Rescue Knots drawing</p>
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

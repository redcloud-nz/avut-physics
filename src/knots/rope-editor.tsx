"use client";

/**
 * The rope editor: lay out a knot's steps (the figure-8's tying steps, or a knot finished, as listed in `editable.ts`)
 * by pinning the rope and dragging the pins, and the rope settles between them (see `pinned-rope.ts`). Every change
 * is kept straight away in the knot's file as a draft of its step, and the step itself only changes there (and on the knots page) once it's saved,
 * and a change made to that file elsewhere shows here as soon as the dev server reloads it, so the steps can be
 * worked on from either side.
 */
import { ChevronLeft, ChevronRight, CopyPlus, Save, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Toggle, VisualisationLayout } from "@/components/diagram/controls";
import { Button } from "@/components/ui/button";
import { vec2, Vector2 } from "@/lib/vector2";

import { BarDrawing } from "./bar";
import { EDITABLE, type EditableKnot } from "./editable";
import { draftsOf, stepLabel, tyingView, type TyingStepData } from "./figure-eight-tying";
import { barPasses, ropeCrossings, ropePathOf, solveRope, type RopeShape } from "./pinned-rope";
import { RopeDrawing } from "./rope-drawing";
import {
    addArrow,
    addPin,
    flipCrossing,
    flipFront,
    moveArrowPoint,
    movePin,
    removeArrow,
    removePin,
    resizeArrow,
    setAngle,
    setArrowFront,
    setLengthAfter,
} from "./rope-edits";
import { ropeEnd } from "./rope-path";
import { arrowShape, TyingArrow, type Arrow } from "./tying-arrow";

/** How far from its pin a held direction's handle sits (diameters). */
const HANDLE = 2.5;

const deg = (rad: number) => (rad * 180) / Math.PI;

/** What's being dragged: a pin, a pin's direction handle, or point `point` of an arrow. */
type Drag =
    | { kind: "pin" | "angle"; index: number }
    | { kind: "arrow"; index: number; point: number };

/** A number that's typed in and taken when Enter's pressed or the field's left. */
function NumberField(props: {
    label: string;
    value: number;
    step: number;
    onCommit: (v: number) => void;
}) {
    const [text, setText] = useState(String(props.value));
    const [shown, setShown] = useState(props.value);
    if (props.value !== shown) {
        setShown(props.value);
        setText(String(props.value));
    }
    const commit = () => {
        const v = Number(text);
        if (text.trim() !== "" && Number.isFinite(v) && v !== props.value) props.onCommit(v);
        else setText(String(props.value));
    };
    return (
        <label className="flex items-center justify-between gap-2 text-sm text-slate-300">
            {props.label}
            <input
                type="number"
                step={props.step}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => e.key === "Enter" && commit()}
                className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right font-mono text-slate-200"
            />
        </label>
    );
}

/** The steps being edited, and each one's rope solved. */
type Editing = { steps: TyingStepData[]; shapes: RopeShape[] };

/** What undo goes back to: the steps as they were being edited, and as saved. */
type Snapshot = { ed: Editing; approved: TyingStepData[] };

const editing = (steps: TyingStepData[]): Editing => ({
    steps,
    shapes: steps.map((step) => solveRope(step)),
});

const same = (a: TyingStepData, b: TyingStepData) => JSON.stringify(a) === JSON.stringify(b);

/** The steps being worked on: each one's draft if it has one, or else the step as saved. */
const working = (saved: TyingStepData[], drafts: (TyingStepData | null)[]) =>
    saved.map((step, i) => drafts[i] ?? step);

/** The file's text for steps `saved`, with drafts of those that `current` has changed. */
const fileText = (current: TyingStepData[], saved: TyingStepData[]) => {
    const drafts = current.map((step, i) => (same(step, saved[i]) ? null : step));
    return JSON.stringify(drafts.some(Boolean) ? { steps: saved, drafts } : { steps: saved });
};

/**
 * The editor, once it's in the browser: the solver's last digits can differ between the server and the browser,
 * and the page has nothing to show without it.
 */
export default function RopeEditor(props: { knot: string }) {
    const inBrowser = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );
    // Taken afresh each time, so a change to a knot's file made elsewhere comes through.
    const knot = EDITABLE.find((k) => k.slug === props.knot) ?? EDITABLE[0];
    return inBrowser ? (
        <Editor knot={knot} />
    ) : (
        <p className="text-sm text-slate-400">Loading the rope…</p>
    );
}

function Editor(props: { knot: EditableKnot }) {
    const { knot } = props;
    const area = knot.view;
    const savedSteps = knot.file.steps;
    const fileDrafts = draftsOf(knot.file);
    const [ed, setEd] = useState(() => editing(working(savedSteps, fileDrafts)));
    /** The steps as saved: what the knots page shows. */
    const [approved, setApproved] = useState(savedSteps);
    const [history, setHistory] = useState<Snapshot[]>([]);
    const [wanted, setK] = useState(0);
    /** The step shown, kept in range as steps are removed. */
    const k = Math.min(wanted, ed.steps.length - 1);
    const [selected, setSelected] = useState<number | null>(null);
    const [selectedArrow, setSelectedArrow] = useState<number | null>(null);
    const [labels, setLabels] = useState(true);
    const [status, setStatus] = useState("");
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
    /** The file's text as last written, or read. */
    const [saved, setSaved] = useState(() => fileText(working(savedSteps, fileDrafts), savedSteps));
    const [seenImport, setSeenImport] = useState(savedSteps);

    const svgRef = useRef<SVGSVGElement>(null);
    const drag = useRef<Drag | null>(null);

    // When the dev server reloads the steps' file after it's been edited elsewhere, its file gives new
    // steps: take them, unless it's what this page has just saved.
    if (savedSteps !== seenImport) {
        setSeenImport(savedSteps);
        const current = working(savedSteps, fileDrafts);
        const text = fileText(current, savedSteps);
        if (text !== saved) {
            setSaved(text);
            setHistory([...history, { ed, approved }]);
            setEd(editing(current));
            setApproved(savedSteps);
            setSelected(null);
            setSelectedArrow(null);
            setStatus("Reloaded from the file");
        }
    }

    const step = ed.steps[k];
    const shape = ed.shapes[k];
    const arrows = step.arrows ?? [];
    const arrowIndex =
        selectedArrow !== null && selectedArrow < arrows.length ? selectedArrow : null;
    const path = useMemo(() => ropePathOf(step, shape, knot.bar), [step, shape, knot.bar]);
    const crossingsHere = useMemo(() => ropeCrossings(step, shape), [step, shape]);
    const passes = useMemo(() => barPasses(step, shape, knot.bar), [step, shape, knot.bar]);
    const frame = tyingView(ed.shapes.map((s) => s.points));

    /** Write the steps (as saved, and as drafts) into the file, unless that's what's there already. */
    const save = async (steps: TyingStepData[], saving = approved) => {
        const text = fileText(steps, saving);
        if (text === saved) return;
        setSaved(text);
        setStatus("Writing…");
        const response = await fetch(`/knots/edit/save?knot=${knot.slug}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: text,
        }).catch(() => null);
        setStatus(
            response?.ok
                ? "Written to the file"
                : `Couldn't write (${response?.status ?? "no server"})`,
        );
    };

    /**
     * Change the current step, if the rope can still meet all its pins: solve it from the shape it has now, so
     * it moves smoothly. Returns whether it could.
     */
    const change = (next: TyingStepData, opts: { record?: boolean; persist?: boolean } = {}) => {
        const solved = solveRope(next, shape.theta);
        if (!solved.converged) {
            setStatus("The pins are further apart than the rope between them");
            return false;
        }
        if (opts.record !== false) setHistory([...history, { ed, approved }]);
        const updated = {
            steps: ed.steps.map((s, i) => (i === k ? next : s)),
            shapes: ed.shapes.map((s, i) => (i === k ? solved : s)),
        };
        setEd(updated);
        if (opts.persist !== false) void save(updated.steps);
        return true;
    };

    const changed = !same(step, approved[k]);

    /** Save this step as it is now: the knots page shows it from here on. */
    const saveStep = () => {
        const next = approved.map((s, i) => (i === k ? step : s));
        setApproved(next);
        void save(ed.steps, next);
    };

    const undo = () => {
        const previous = history.at(-1);
        if (!previous) return;
        setHistory(history.slice(0, -1));
        setEd(previous.ed);
        setApproved(previous.approved);
        setSelected(null);
        setSelectedArrow(null);
        void save(previous.ed.steps, previous.approved);
    };

    /** Add a copy of this step after it, saved as it is now, and go to it. */
    const addStep = () => {
        const insert = <T,>(list: T[], item: T) => [
            ...list.slice(0, k + 1),
            item,
            ...list.slice(k + 1),
        ];
        setHistory([...history, { ed, approved }]);
        const next = { steps: insert(ed.steps, step), shapes: insert(ed.shapes, shape) };
        const nextApproved = insert(approved, step);
        setEd(next);
        setApproved(nextApproved);
        setK(k + 1);
        setSelected(null);
        setSelectedArrow(null);
        void save(next.steps, nextApproved);
    };

    /** Take this step out, saved version and draft both. */
    const removeStep = () => {
        const drop = <T,>(list: T[]) => list.filter((_, i) => i !== k);
        setHistory([...history, { ed, approved }]);
        const next = { steps: drop(ed.steps), shapes: drop(ed.shapes) };
        const nextApproved = drop(approved);
        setEd(next);
        setApproved(nextApproved);
        setSelected(null);
        setSelectedArrow(null);
        void save(next.steps, nextApproved);
    };

    /** Add an arrow carrying on from the rope's end, and select it. */
    const newArrow = () => {
        const end = ropeEnd(path);
        const along = (d: number) => end.at.add(end.heading.scale(d));
        const { rope, index } = addArrow(step, [along(0.8), along(3.5), along(6)]);
        if (change(rope)) {
            setSelected(null);
            setSelectedArrow(index);
        }
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).closest("input, textarea")) return;
            if ((e.metaKey || e.ctrlKey) && e.key === "z") {
                e.preventDefault();
                undo();
            } else if ((e.key === "Delete" || e.key === "Backspace") && arrowIndex !== null) {
                e.preventDefault();
                change(removeArrow(step, arrowIndex));
                setSelectedArrow(null);
            } else if (
                (e.key === "Delete" || e.key === "Backspace") &&
                selected !== null &&
                selected > 0
            ) {
                e.preventDefault();
                change(removePin(step, selected));
                setSelected(null);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    /** Where the pointer is, in the drawing's coordinates. */
    const toDrawing = (e: React.PointerEvent) => {
        const svg = svgRef.current!;
        const m = svg.getScreenCTM()!.inverse();
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
        return { x: p.x, y: p.y };
    };

    /** Start dragging, putting the step as it is into the history unless that's been done already. */
    const startDrag = (e: React.PointerEvent, d: Drag, record = true) => {
        e.stopPropagation();
        svgRef.current!.setPointerCapture(e.pointerId);
        if (record) setHistory([...history, { ed, approved }]);
        drag.current = d;
    };

    const onMove = (e: React.PointerEvent) => {
        const p = toDrawing(e);
        setPointer(p);
        const d = drag.current;
        if (!d) return;
        const pin = step.pins[d.index];
        const next =
            d.kind === "arrow"
                ? moveArrowPoint(step, d.index, d.point, p.x, p.y)
                : d.kind === "pin"
                  ? movePin(step, d.index, p.x, p.y)
                  : setAngle(step, d.index, deg(Math.atan2(p.y - pin.y, p.x - pin.x)));
        change(next, { record: false, persist: false });
    };

    const endDrag = () => {
        if (!drag.current) return;
        drag.current = null;
        void save(ed.steps);
    };

    /** Pin the rope where it was clicked, and start dragging that pin. */
    const pinRope = (e: React.PointerEvent) => {
        const at = toDrawing(e);
        const p = vec2(at.x, at.y);
        let node = 0;
        shape.points.forEach((q, i) => {
            if (q.distanceTo(p) < shape.points[node].distanceTo(p)) node = i;
        });
        const { rope, index } = addPin(step, shape, node);
        if (rope !== step && !change(rope)) return;
        setSelected(index);
        setSelectedArrow(null);
        // Adding the pin went into the history already; dragging it straight away is part of the same change.
        startDrag(e, { kind: "pin", index }, rope === step);
    };

    const pinIndex = selected !== null && selected < step.pins.length ? selected : null;
    const pin = pinIndex !== null ? step.pins[pinIndex] : null;
    /** The selected pin's direction handle, if it holds a direction. */
    const handle =
        pin && pin.angle !== undefined
            ? {
                  from: pin,
                  at: vec2(pin.x, pin.y).add(
                      Vector2.fromAngle((pin.angle * Math.PI) / 180, HANDLE),
                  ),
              }
            : null;
    const heading = (index: number) => {
        const m = shape.pinNodes[index];
        const [a, b] =
            m === 0 ? [shape.points[0], shape.points[1]] : [shape.points[m - 1], shape.points[m]];
        return deg(Math.atan2(b.y - a.y, b.x - a.x));
    };

    const drawArrow = (arrow: Arrow, a: number, upTo?: number) => (
        <TyingArrow
            key={`a${a}${upTo === undefined ? "" : "f"}`}
            points={arrow.points}
            color={a === arrowIndex ? "#0ea5e9" : undefined}
            upTo={upTo}
        />
    );

    const label = {
        fontSize: 0.8,
        fill: "#e2e8f0",
        stroke: "#0f172a",
        strokeWidth: 0.25,
        paintOrder: "stroke",
    } as const;

    return (
        <VisualisationLayout
            diagram={
                <svg
                    ref={svgRef}
                    viewBox={`${area.x} ${area.y} ${area.w} ${area.h}`}
                    className="mx-auto block h-auto max-h-[85vh] w-full touch-none select-none"
                    onPointerMove={onMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onPointerDown={() => {
                        setSelected(null);
                        setSelectedArrow(null);
                    }}
                    onPointerLeave={() => setPointer(null)}
                >
                    {/* A grid a diameter apart, stronger every 5, with the numbers along the left and top. */}
                    <g stroke="#1e293b" strokeWidth={0.04}>
                        {Array.from({ length: area.w + 1 }, (_, i) => area.x + i).map((x) => (
                            <line
                                key={`x${x}`}
                                x1={x}
                                x2={x}
                                y1={area.y}
                                y2={area.y + area.h}
                                strokeWidth={x % 5 ? 0.03 : 0.08}
                            />
                        ))}
                        {Array.from({ length: area.h + 1 }, (_, i) => area.y + i).map((y) => (
                            <line
                                key={`y${y}`}
                                y1={y}
                                y2={y}
                                x1={area.x}
                                x2={area.x + area.w}
                                strokeWidth={y % 5 ? 0.03 : 0.08}
                            />
                        ))}
                    </g>
                    <g fontSize={0.7} fill="#64748b">
                        {Array.from({ length: area.w + 1 }, (_, i) => area.x + i)
                            .filter((x) => x % 5 === 0)
                            .map((x) => (
                                <text key={x} x={x + 0.15} y={area.y + 0.8}>
                                    {x}
                                </text>
                            ))}
                        {Array.from({ length: area.h + 1 }, (_, i) => area.y + i)
                            .filter((y) => y % 5 === 0)
                            .map((y) => (
                                <text key={y} x={area.x + 0.15} y={y - 0.15}>
                                    {y}
                                </text>
                            ))}
                    </g>
                    {/* The frame the knots page shows. */}
                    <rect
                        x={frame.x}
                        y={frame.y}
                        width={frame.w}
                        height={frame.h}
                        fill="none"
                        stroke="#475569"
                        strokeWidth={0.06}
                        strokeDasharray="0.4 0.3"
                    />

                    {/* Arrows go behind the rope unless they're marked in front, as on the knots page. */}
                    {arrows.map((arrow, a) => !arrow.front && drawArrow(arrow, a))}
                    {knot.bar && !knot.bar.length && <BarDrawing bar={knot.bar} />}
                    <RopeDrawing
                        ropes={[path]}
                        between={knot.bar?.length && <BarDrawing bar={knot.bar} />}
                    />
                    {arrows.map((arrow, a) => arrow.front && drawArrow(arrow, a))}
                    {arrows.map(
                        (arrow, a) =>
                            !arrow.front &&
                            arrow.frontTo !== undefined &&
                            drawArrow(arrow, a, arrow.frontTo),
                    )}
                    {/* Clicking the rope pins it there. */}
                    <polyline
                        points={shape.points.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={1.2}
                        style={{ pointerEvents: "stroke", cursor: "copy" }}
                        onPointerDown={pinRope}
                    />

                    {labels &&
                        step.lengths.map((length, i) => {
                            const p =
                                shape.points[
                                    Math.round((shape.pinNodes[i] + shape.pinNodes[i + 1]) / 2)
                                ];
                            return (
                                <text
                                    key={`l${i}`}
                                    x={p.x + 0.7}
                                    y={p.y}
                                    {...label}
                                    fill="#94a3b8"
                                    fontSize={0.65}
                                >
                                    {length}
                                </text>
                            );
                        })}
                    {labels && step.tail > 0 && (
                        <text
                            x={shape.points.at(-1)!.x + 0.7}
                            y={shape.points.at(-1)!.y}
                            {...label}
                            fill="#94a3b8"
                            fontSize={0.65}
                        >
                            tail {step.tail}
                        </text>
                    )}

                    {/* Clicking a pass across a bar seen side on puts it in front of the bar or behind it. */}
                    {passes.map((pass, i) => (
                        <rect
                            key={`b${i}`}
                            x={pass.at.x - 0.4}
                            y={pass.at.y - 0.4}
                            width={0.8}
                            height={0.8}
                            fill={pass.front ? "#f59e0b" : "#64748b"}
                            fillOpacity={0.85}
                            style={{ cursor: "pointer" }}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                change(flipFront(step, shape, pass));
                            }}
                        >
                            <title>{pass.front ? "In front of the bar" : "Behind the bar"}</title>
                        </rect>
                    ))}
                    {crossingsHere.map((c, i) => (
                        <g
                            key={`c${i}`}
                            style={{ cursor: "pointer" }}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                change(flipCrossing(step, c));
                            }}
                        >
                            <circle
                                cx={c.at.x}
                                cy={c.at.y}
                                r={0.45}
                                fill={c.over === null ? "#ef4444" : "#0ea5e9"}
                                fillOpacity={0.8}
                            />
                            {labels && (
                                <text x={c.at.x + 0.55} y={c.at.y - 0.45} {...label} fill="#7dd3fc">
                                    {String.fromCharCode(65 + i)}
                                </text>
                            )}
                        </g>
                    ))}

                    {step.pins.map((p, i) => (
                        <g
                            key={`p${i}`}
                            style={{ cursor: "grab" }}
                            onPointerDown={(e) => {
                                setSelected(i);
                                startDrag(e, { kind: "pin", index: i });
                            }}
                        >
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r={0.45}
                                fill={i === pinIndex ? "#0ea5e9" : "#0f172a"}
                                stroke="#f8fafc"
                                strokeWidth={0.12}
                            />
                            {p.angle !== undefined && (
                                <line
                                    x1={p.x}
                                    y1={p.y}
                                    x2={p.x + 0.9 * Math.cos((p.angle * Math.PI) / 180)}
                                    y2={p.y + 0.9 * Math.sin((p.angle * Math.PI) / 180)}
                                    stroke="#f8fafc"
                                    strokeWidth={0.12}
                                />
                            )}
                            {labels && (
                                <text x={p.x - 1.2} y={p.y - 0.5} {...label}>
                                    {i + 1}
                                </text>
                            )}
                        </g>
                    ))}

                    {handle && pinIndex !== null && (
                        <g>
                            <line
                                x1={handle.from.x}
                                y1={handle.from.y}
                                x2={handle.at.x}
                                y2={handle.at.y}
                                stroke="#0ea5e9"
                                strokeWidth={0.08}
                                strokeDasharray="0.2 0.15"
                            />
                            <circle
                                cx={handle.at.x}
                                cy={handle.at.y}
                                r={0.4}
                                fill="#0ea5e9"
                                style={{ cursor: "grab" }}
                                onPointerDown={(e) =>
                                    startDrag(e, { kind: "angle", index: pinIndex })
                                }
                            />
                        </g>
                    )}

                    {arrows.map(({ points }, a) => (
                        <g
                            key={`a${a}`}
                            style={{ cursor: "pointer" }}
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                setSelected(null);
                                setSelectedArrow(a);
                            }}
                        >
                            {/* A wider, unseen line along the arrow (drawn behind the rope), so it's easy to click. */}
                            <path
                                d={arrowShape(points)?.d}
                                fill="none"
                                stroke="transparent"
                                strokeWidth={1.2}
                                style={{ pointerEvents: "stroke" }}
                            />
                        </g>
                    ))}
                    {arrowIndex !== null &&
                        arrows[arrowIndex].points.map((p, j) => (
                            <circle
                                key={`ap${j}`}
                                cx={p.x}
                                cy={p.y}
                                r={0.4}
                                fill="#0ea5e9"
                                stroke="#f8fafc"
                                strokeWidth={0.1}
                                style={{ cursor: "grab" }}
                                onPointerDown={(e) =>
                                    startDrag(e, { kind: "arrow", index: arrowIndex, point: j })
                                }
                            />
                        ))}
                </svg>
            }
            controls={
                <>
                    <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                        {EDITABLE.map((k) =>
                            k.slug === knot.slug ? (
                                <span key={k.slug} className="text-slate-200">
                                    {k.name}
                                </span>
                            ) : (
                                <Link
                                    key={k.slug}
                                    href={`/knots/edit?knot=${k.slug}`}
                                    className="text-sky-400 hover:text-sky-300"
                                >
                                    {k.name}
                                </Link>
                            ),
                        )}
                    </nav>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                                setK(k - 1);
                                setSelected(null);
                                setSelectedArrow(null);
                            }}
                            disabled={k === 0}
                            aria-label="Previous step"
                        >
                            <ChevronLeft />
                        </Button>
                        <span className="flex-1 text-center text-sm text-slate-300">
                            {stepLabel(ed.steps, k)}
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                                setK(k + 1);
                                setSelected(null);
                                setSelectedArrow(null);
                            }}
                            disabled={k === ed.steps.length - 1}
                            aria-label="Next step"
                        >
                            <ChevronRight />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={addStep}>
                            <CopyPlus /> Add step after
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={removeStep}
                            disabled={ed.steps.length === 1}
                        >
                            <Trash2 /> Remove step
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={saveStep} disabled={!changed}>
                            <Save /> Save step
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => change(approved[k])}
                            disabled={!changed}
                        >
                            Revert
                        </Button>
                        <span className="text-xs text-slate-400">
                            {changed ? "Changed since saved" : "Saved"}
                        </span>
                    </div>
                    {ed.steps.some((s, i) => i !== k && !same(s, approved[i])) && (
                        <p className="text-xs text-slate-400">
                            Also changed:{" "}
                            {ed.steps
                                .map((s, i) =>
                                    i !== k && !same(s, approved[i])
                                        ? stepLabel(ed.steps, i)
                                        : null,
                                )
                                .filter(Boolean)
                                .join(", ")}
                        </p>
                    )}
                    <textarea
                        key={`${k}:${step.caption}`}
                        defaultValue={step.caption}
                        rows={3}
                        onBlur={(e) =>
                            e.target.value !== step.caption &&
                            change({ ...step, caption: e.target.value })
                        }
                        className="rounded border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                    />
                    <Toggle
                        label="Continues the step before (same number)"
                        checked={!!step.continues}
                        onChange={(on) => {
                            const next: TyingStepData = { ...step, continues: on };
                            if (!on) delete next.continues;
                            change(next);
                        }}
                    />

                    {pin && pinIndex !== null ? (
                        <div className="flex flex-col gap-2">
                            <h2 className="text-sm font-semibold text-slate-100">
                                Pin {pinIndex + 1}
                            </h2>
                            <NumberField
                                label="x"
                                value={pin.x}
                                step={0.1}
                                onCommit={(v) => change(movePin(step, pinIndex, v, pin.y))}
                            />
                            <NumberField
                                label="y"
                                value={pin.y}
                                step={0.1}
                                onCommit={(v) => change(movePin(step, pinIndex, pin.x, v))}
                            />
                            <Toggle
                                label="Hold its direction"
                                checked={pin.angle !== undefined}
                                onChange={(on) =>
                                    change(
                                        setAngle(
                                            step,
                                            pinIndex,
                                            on ? heading(pinIndex) : undefined,
                                        ),
                                    )
                                }
                            />
                            {pin.angle !== undefined && (
                                <NumberField
                                    label="Direction (°, −90 is up)"
                                    value={pin.angle}
                                    step={5}
                                    onCommit={(v) => change(setAngle(step, pinIndex, v))}
                                />
                            )}
                            {pinIndex > 0 && (
                                <NumberField
                                    label="Rope before"
                                    value={step.lengths[pinIndex - 1]}
                                    step={0.5}
                                    onCommit={(v) => change(setLengthAfter(step, pinIndex - 1, v))}
                                />
                            )}
                            <NumberField
                                label={
                                    pinIndex === step.pins.length - 1
                                        ? "Rope past it"
                                        : "Rope after"
                                }
                                value={
                                    pinIndex === step.pins.length - 1
                                        ? step.tail
                                        : step.lengths[pinIndex]
                                }
                                step={0.5}
                                onCommit={(v) => change(setLengthAfter(step, pinIndex, v))}
                            />
                            <Button
                                variant="outline"
                                disabled={pinIndex === 0}
                                onClick={() => {
                                    change(removePin(step, pinIndex));
                                    setSelected(null);
                                }}
                            >
                                Remove pin
                            </Button>
                        </div>
                    ) : arrowIndex !== null ? (
                        <div className="flex flex-col gap-2">
                            <h2 className="text-sm font-semibold text-slate-100">
                                Arrow {arrowIndex + 1}
                            </h2>
                            <p className="text-sm text-slate-400">
                                Drag its points to shape it; the head is at the last one.
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => change(resizeArrow(step, arrowIndex, true))}
                                >
                                    Add point
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={arrows[arrowIndex].points.length <= 2}
                                    onClick={() => change(resizeArrow(step, arrowIndex, false))}
                                >
                                    Remove point
                                </Button>
                            </div>
                            <Toggle
                                label="In front of the rope"
                                checked={!!arrows[arrowIndex].front}
                                onChange={(on) => change(setArrowFront(step, arrowIndex, on))}
                            />
                            <Button
                                variant="outline"
                                onClick={() => {
                                    change(removeArrow(step, arrowIndex));
                                    setSelectedArrow(null);
                                }}
                            >
                                Remove arrow
                            </Button>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400">
                            Click the rope to pin it there, and drag pins to move them. Select a pin
                            to hold its direction or change the rope either side. Click a crossing
                            to swap which strand is on top, or a square on a bar to put the rope in
                            front of it or behind. Add an arrow to show where the rope goes next,
                            and add a step after this one to show it in a step of its own.
                        </p>
                    )}

                    <Button variant="outline" onClick={newArrow}>
                        Add arrow
                    </Button>
                    <Toggle
                        label="Show numbers and lengths"
                        checked={labels}
                        onChange={setLabels}
                    />
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={undo}
                            disabled={!history.length}
                        >
                            <Undo2 /> Undo
                        </Button>
                        <span className="text-xs text-slate-400">{status}</span>
                    </div>
                    <p className="font-mono text-xs text-slate-500">
                        {pointer ? `x ${pointer.x.toFixed(1)}, y ${pointer.y.toFixed(1)}` : " "}
                    </p>
                </>
            }
        />
    );
}

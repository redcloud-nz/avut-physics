"use client";

import { ArrowDownUp, Link2, Link2Off, RotateCcw } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import { RawValues, Readout, Slider, VisualisationLayout } from "@/components/diagram/controls";
import { Arrow, Label } from "@/components/diagram/svg";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { G } from "@/lib/constants";
import { deg } from "@/lib/math";
import { vec2, type Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import { FourPointLowerNotes } from "./four-point-lower-notes";
import {
    follow,
    payOutNeeded,
    ROPES,
    settle,
    startOf,
    type Placed,
    type PlaceResult,
    type Setup,
} from "./four-point-lower-solver";

/** Each rope its own colour, in the ropes' order: red, green, blue, yellow. Head ropes solid, foot ropes dashed. */
const ROPE_COLORS = ["#f2555a", "#23935a", "#3d83f0", "#d9a816"];
const ropeColor = (i: number) => ROPE_COLORS[i];
const ropeDash = (i: number) => (ROPES[i].end < 0 ? "7 5" : undefined);
const COLORS = { bar: "#e2e8f0", barFill: "#475569", push: "#c4b5fd" };

const MAX_ARROW = 160;
const BAR_LENGTH = 2;
/** A basket stretcher's width and depth (a Ferno Model 71). */
const BAR_WIDTH = 0.6;
const BAR_DEPTH = 0.2;
/** How much rope a belayer can take in from where they start. */
const MOST_IN = 1.5;
/** The trace keeps this many of the latest steps. */
const TRACE_LENGTH = 1500;
/** Turn on to show a card of the inputs and solver output, for copying problem cases. */
const SHOW_RAW_VALUES = false;
/** Shown in place of a value that doesn't apply. */
const NONE = "—";

/** The drawings' width in SVG units; their heights follow from the setup. */
const W = 800;
/** Room round the drawings: beyond the belays, below the slot's bottom and above the belays. */
const MARGIN = 0.4;

/** The links between neighbouring belayers' sliders, laid out like the belays: head on top, near side on the left. */
const LINKS = [
    { name: "head pair", ropes: [0, 1] },
    { name: "foot pair", ropes: [2, 3] },
    { name: "near side", ropes: [0, 2] },
    { name: "far side", ropes: [1, 3] },
] as const;

/** How a link joins two belayers: not at all (0), moving together (1), or one paying out as the other takes in (−1). */
type Coupling = 0 | 1 | -1;

/**
 * What clicking link k makes it: coupled, then coupled the other way round, then uncoupled. But with the other three
 * links all coupled, the four make a loop round the belayers, and the fourth must agree with the other three (an
 * even number of them the other way round): it's either uncoupled or coupled the one way that agrees.
 */
function nextCoupling(k: number, couplings: Coupling[]): Coupling {
    const c = couplings[k];
    const others = couplings.filter((_, j) => j !== k);
    if (others.every((o) => o !== 0)) {
        const agrees = others.reduce<number>((product, o) => product * o, 1) as Coupling;
        return c === 0 ? agrees : 0;
    }
    return c === 0 ? 1 : c === 1 ? -1 : 0;
}

/**
 * Which way each belayer moves when belayer i moves: 1 with them, −1 against them, 0 not at all. Couplings carry on
 * along chains of links (which `nextCoupling` keeps from disagreeing round the loop).
 */
function movedWith(i: number, couplings: Coupling[]): number[] {
    const signs = [0, 0, 0, 0];
    signs[i] = 1;
    const queue = [i];
    while (queue.length) {
        const a = queue.shift()!;
        LINKS.forEach((l, k) => {
            if (!couplings[k] || !(l.ropes as readonly number[]).includes(a)) return;
            const b = l.ropes[0] === a ? l.ropes[1] : l.ropes[0];
            if (signs[b]) return;
            signs[b] = signs[a] * couplings[k];
            queue.push(b);
        });
    }
    return signs;
}

/** The ropes' pulls and the floor's and edges' push at one step. */
type Sample = { pulls: number[]; push: number };

/** Where the belayers have got to: how much each has paid out since the start, and where the stretcher is. */
type Moves = {
    setup: Setup;
    paidOut: number[];
    /** Where it last settled; null if it can't at the start. */
    last: Placed | null;
    /** Where it settled after the latest move, or why it couldn't. */
    result: PlaceResult;
    /** Why the latest move stopped short, if it did. */
    stopped: string | null;
    trace: Sample[];
};

const pushOf = (p: Placed) => p.contacts.reduce((sum, c) => sum + c.force.len(), 0);
const sampleOf = (p: Placed): Sample => ({ pulls: p.ropes.map((r) => r.tension), push: pushOf(p) });

/** The stretcher lying on the floor beside the slot, before anyone pays out. */
function startMoves(setup: Setup): Moves {
    const start = startOf(setup);
    const result = settle(setup, start.out, start.q);
    const last = result.kind === "placed" ? result.p : null;
    return {
        setup,
        paidOut: [0, 0, 0, 0],
        last,
        result,
        stopped: null,
        trace: last ? [sampleOf(last)] : [],
    };
}

/**
 * A four-point lower, rope by rope: the stretcher starts on the floor beside a slot, and each belayer pays out or
 * takes in their own rope, alone or with others. The stretcher goes wherever the ropes and the floor put it. Drawn
 * from above and end on, with a trace of the ropes' pulls over the moves made.
 */
export default function FourPointLower() {
    const [barMass, setBarMass] = useState(80);
    const [slotDepth, setSlotDepth] = useState(3);
    const [slotWidth, setSlotWidth] = useState(1.2);
    const [belaySpacing, setBelaySpacing] = useState(3);
    const [anchorUp, setAnchorUp] = useState(1);
    const [anchorBack, setAnchorBack] = useState(2);
    const [couplings, setCouplings] = useState<Coupling[]>([0, 0, 0, 0]);
    const [holdLimit, setHoldLimit] = useState(500);

    const barWeight = barMass * G;
    const setup: Setup = useMemo(
        () => ({
            slotDepth,
            slotWidth,
            anchorUp,
            anchorBack,
            belaySpacing,
            barLength: BAR_LENGTH,
            barWidth: BAR_WIDTH,
            barDepth: BAR_DEPTH,
            barWeight,
        }),
        [slotDepth, slotWidth, anchorUp, anchorBack, belaySpacing, barWeight],
    );

    // The solver's last few digits can differ between the server and the browser, which would make hydration
    // fail, so results are only shown once running in the browser.
    const inBrowser = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );
    // Changing the setup starts the lower again.
    const [saved, setSaved] = useState<Moves | null>(null);
    const fresh = useMemo(() => (inBrowser ? startMoves(setup) : null), [inBrowser, setup]);
    const moves = saved?.setup === setup ? saved : fresh;
    const mostOut = Math.ceil(payOutNeeded(setup) * 10) / 10 + 0.1;
    const startOut = useMemo(() => startOf(setup).out, [setup]);

    /** Belayer i (and any moving with them) paying out or taking in to `value` paid out since the start. */
    const pay = (i: number, value: number) => {
        if (!moves) return;
        const signs = movedWith(i, couplings);
        // Coupled, they all stop where the first of them reaches the end of their slider.
        let change = value - moves.paidOut[i];
        signs.forEach((sign, j) => {
            if (!sign) return;
            const [low, high] = [-MOST_IN - moves.paidOut[j], mostOut - moves.paidOut[j]];
            change = Math.min(Math.max(change, sign > 0 ? low : -high), sign > 0 ? high : -low);
        });
        const paidOut = moves.paidOut.map((p, j) => p + signs[j] * change);
        if (!moves.last) return setSaved({ ...moves, paidOut });
        // No belayer can take in against more than the limit: a rope already over it can't be taken in at all
        // (nor, coupled, can the ropes moving with it), and a move stops once it takes one over.
        const takingIn = [0, 1, 2, 3].filter((j) => signs[j] * change < 0);
        const overLimit = (p: Placed) => takingIn.find((j) => p.ropes[j].tension > holdLimit);
        const tooHard = (j: number, p: Placed) =>
            `${ROPES[j].name} is pulling ${p.ropes[j].tension.toFixed(0)} N, more than its belayer can take in against (${holdLimit} N). Pay it out, or move the others, to ease it.`;
        const already = overLimit(moves.last);
        if (already !== undefined)
            return setSaved({ ...moves, stopped: tooHard(already, moves.last) });
        const start = startOf(setup).out;
        const steps = follow(
            setup,
            moves.last,
            start.map((l, j) => l + paidOut[j]),
            { stopAfter: (p) => overLimit(p) !== undefined },
        );
        const settled = steps.flatMap((r) => (r.kind === "placed" ? [r.p] : []));
        const last = settled.length ? settled[settled.length - 1] : moves.last;
        const end = steps[steps.length - 1];
        const over = end.kind === "placed" ? overLimit(end.p) : undefined;
        // Where it can't settle, or a rope goes over the limit, the belayers stop at the last step where it settled.
        const stoppedShort = end.kind === "none" || over !== undefined;
        setSaved({
            setup,
            paidOut: stoppedShort ? last.ropes.map((r, j) => r.out - start[j]) : paidOut,
            last,
            result: end,
            stopped:
                over !== undefined
                    ? tooHard(over, last)
                    : end.kind === "placed"
                      ? null
                      : takingIn.length
                        ? "The ropes are as tight as they'll go: taking in any more would need them to stretch."
                        : `It can't settle any further this way. ${end.reason}`,
            trace: [...moves.trace, ...settled.map(sampleOf)].slice(-TRACE_LENGTH),
        });
    };

    const result = moves?.result ?? null;
    // Where it couldn't settle, it's drawn where it last did.
    const view = moves?.last ?? null;

    // --- Drawing ---
    const k = 120 / Math.max(barWeight, 1); // px per newton
    const force = (f: Vector3) => vec2(f.x * k, -f.y * k).clampLen(MAX_ARROW);

    // Both views share a scale across the slot, spanning just past the belays either side. They depend only on the
    // setup, so they stay still through the lower.
    const halfSpan = slotWidth / 2 + anchorBack + MARGIN;
    const PPM = W / (2 * halfSpan); // SVG units per metre
    const edgeX = slotWidth / 2;
    const anchorX = edgeX + anchorBack;
    const points = (pts: Vector2[]) => pts.map((p) => `${p.x},${p.y}`).join(" ");

    // From above: x across the slot, z along it, the head (z > 0) at the top.
    const halfLong = Math.max(belaySpacing, BAR_LENGTH) / 2 + MARGIN;
    const planH = Math.round(2 * halfLong * PPM);
    const above = (p: Vector3): Vector2 => vec2(W / 2 + p.x * PPM, planH / 2 - p.z * PPM);
    // End on: x across the slot, y up from its bottom.
    const endH = Math.round((slotDepth + anchorUp + 2 * MARGIN) * PPM);
    const endOn = (p: Vector3): Vector2 => vec2(W / 2 + p.x * PPM, endH - (MARGIN + p.y) * PPM);

    const ropePath = (view: Placed, i: number) => {
        const r = view.ropes[i];
        return [r.anchor, ...(r.edgeCrossing ? [r.edgeCrossing] : []), r.corner];
    };
    const ropeLines = (project: (p: Vector3) => Vector2) =>
        view &&
        ROPES.map((_, i) => {
            const taut = view.ropes[i].length > view.ropes[i].out - 1e-4;
            return (
                <polyline
                    key={i}
                    points={points(ropePath(view, i).map(project))}
                    fill="none"
                    stroke={ropeColor(i)}
                    strokeWidth={taut ? 2 : 1.5}
                    strokeOpacity={taut ? 1 : 0.5}
                    strokeDasharray={ropeDash(i)}
                    strokeLinejoin="round"
                />
            );
        });

    const belays = [-1, 1].flatMap((side) =>
        [-1, 1].map((end) => vec3(side * anchorX, slotDepth + anchorUp, (end * belaySpacing) / 2)),
    );
    const planView = (
        <svg viewBox={`0 0 ${W} ${planH}`} className="block h-auto w-full">
            <rect x={0} y={0} width={W} height={planH} fill="#1e293b" />
            <rect
                x={above(vec3(-edgeX, 0, 0)).x}
                y={0}
                width={slotWidth * PPM}
                height={planH}
                fill="#0f172a"
                stroke="#475569"
            />
            {view && (
                <polygon
                    points={points(hull(view.box.map(above)))}
                    fill={COLORS.barFill}
                    fillOpacity={0.6}
                    stroke={COLORS.bar}
                    strokeWidth={2}
                    strokeLinejoin="round"
                />
            )}
            {ropeLines(above)}
            {view?.contacts.map((c, i) => (
                <circle key={i} cx={above(c.at).x} cy={above(c.at).y} r={4} fill={COLORS.push} />
            ))}
            {belays.map((p, i) => (
                <circle key={i} cx={above(p).x} cy={above(p).y} r={5} fill="#cbd5e1" />
            ))}
            {view && (
                <Label
                    at={above(view.corners[0].add(view.corners[1]).scale(1 / 2)).add(vec2(0, -14))}
                    color={COLORS.bar}
                >
                    head
                </Label>
            )}
            <Caption>From above</Caption>
        </svg>
    );

    const floorTop = endOn(vec3(0, slotDepth, 0)).y;
    const bottom = endOn(vec3(0, 0, 0)).y;
    const endOnView = (
        <svg viewBox={`0 0 ${W} ${endH}`} className="block h-auto w-full">
            <line x1={0} y1={bottom} x2={W} y2={bottom} stroke="#475569" strokeWidth={1.5} />
            {[-1, 1].map((side) => {
                const x0 = side < 0 ? 0 : endOn(vec3(edgeX, 0, 0)).x;
                const x1 = side < 0 ? endOn(vec3(-edgeX, 0, 0)).x : W;
                const post = endOn(vec3(side * anchorX, slotDepth + anchorUp, 0));
                return (
                    <g key={side}>
                        <rect
                            x={x0}
                            y={floorTop}
                            width={x1 - x0}
                            height={bottom - floorTop}
                            fill="#1e293b"
                            stroke="#475569"
                        />
                        <line
                            x1={post.x}
                            y1={floorTop}
                            x2={post.x}
                            y2={post.y}
                            stroke="#475569"
                            strokeWidth={4}
                            strokeLinecap="round"
                        />
                        <circle cx={post.x} cy={post.y} r={3.5} fill="#cbd5e1" />
                    </g>
                );
            })}
            {ropeLines(endOn)}
            {view && (
                <>
                    <polygon
                        points={points(hull(view.box.map(endOn)))}
                        fill={COLORS.barFill}
                        stroke={COLORS.bar}
                        strokeWidth={3}
                        strokeLinejoin="round"
                    />
                    <Arrow
                        from={endOn(view.centre)}
                        v={force(vec3(0, -barWeight, 0))}
                        color={COLORS.bar}
                        label="W"
                    />
                    {view.contacts.map((c, i) => (
                        <Arrow
                            key={i}
                            from={endOn(c.at)}
                            v={force(c.force)}
                            color={COLORS.push}
                            width={2}
                        />
                    ))}
                </>
            )}
            <Caption>End on, looking along the slot</Caption>
        </svg>
    );

    const trace = moves?.trace ?? [];
    const hardest = trace.length ? Math.max(...trace.flatMap((x) => x.pulls)) : null;

    const notice = moves?.stopped
        ? { title: "Stopped here", detail: moves.stopped }
        : result?.kind === "none"
          ? { title: "No resting place found", detail: result.reason }
          : null;

    const ropeSlider = (i: number) => (
        <RopeSlider
            key={`rope${i}`}
            index={i}
            overLimit={!!view && view.ropes[i].tension > holdLimit}
            value={moves?.paidOut[i] ?? 0}
            ropeOut={startOut[i] + (moves?.paidOut[i] ?? 0)}
            min={-MOST_IN}
            max={mostOut}
            disabled={!moves}
            onChange={(v) => pay(i, v)}
        />
    );
    const linkButton = (k: number, across: boolean) => (
        <LinkButton
            key={`link${k}`}
            name={LINKS[k].name}
            coupling={couplings[k]}
            next={nextCoupling(k, couplings)}
            across={across}
            onClick={() =>
                setCouplings(couplings.map((c, j) => (j === k ? nextCoupling(k, couplings) : c)))
            }
        />
    );
    // In the middle, a button coupling all four the same way (or, when they all are, uncoupling them).
    const allCoupled = couplings.every((c) => c === 1);
    const allButton = (
        <div className="flex justify-center">
            <Button
                variant={allCoupled ? "secondary" : "outline"}
                size="xs"
                title={
                    allCoupled
                        ? "All four moving together. Click to uncouple them."
                        : "Click to couple all four, moving together."
                }
                aria-label={
                    allCoupled
                        ? "All four moving together. Click to uncouple them."
                        : "Couple all four, moving together."
                }
                aria-pressed={allCoupled}
                onClick={() => setCouplings(allCoupled ? [0, 0, 0, 0] : [1, 1, 1, 1])}
            >
                <Link2 />
                All
            </Button>
        </div>
    );
    // Laid out like the belays: head on top, near side on the left, each link between the sliders it joins.
    const ropeSliders = (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2">
            {ropeSlider(0)}
            {linkButton(0, true)}
            {ropeSlider(1)}
            {linkButton(2, false)}
            {allButton}
            {linkButton(3, false)}
            {ropeSlider(2)}
            {linkButton(1, true)}
            {ropeSlider(3)}
        </div>
    );

    return (
        <VisualisationLayout
            diagram={
                <div className="relative flex flex-col gap-4 p-4">
                    {notice && (
                        <div className="absolute inset-x-4 top-6 text-center text-sm text-amber-400">
                            <p className="font-medium">{notice.title}</p>
                            <p className="mx-auto mt-1 max-w-md text-amber-400/80">
                                {notice.detail}
                            </p>
                        </div>
                    )}
                    {planView}
                    {ropeSliders}
                    {endOnView}
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-slate-300">
                            The ropes&apos; pulls over the moves so far
                        </p>
                        <Button variant="outline" size="sm" onClick={() => setSaved(null)}>
                            <RotateCcw />
                            Start again
                        </Button>
                    </div>
                    <TraceGraph trace={trace} weight={barWeight} />
                </div>
            }
            controls={
                <>
                    <Slider
                        label="Belay height"
                        value={anchorUp}
                        min={0.5}
                        max={2}
                        step={0.05}
                        unit="m"
                        digits={2}
                        onChange={setAnchorUp}
                    />
                    <Slider
                        label="Belay setback from the edge"
                        value={anchorBack}
                        min={1}
                        max={5}
                        step={0.05}
                        unit="m"
                        digits={2}
                        onChange={setAnchorBack}
                    />
                    <Slider
                        label="Head to foot belays"
                        value={belaySpacing}
                        min={BAR_LENGTH}
                        max={6}
                        step={0.05}
                        unit="m"
                        digits={2}
                        onChange={setBelaySpacing}
                    />
                    <Separator />
                    <Slider
                        label="Slot depth"
                        value={slotDepth}
                        min={2}
                        max={6}
                        step={0.1}
                        unit="m"
                        onChange={setSlotDepth}
                    />
                    <Slider
                        label="Slot width"
                        value={slotWidth}
                        min={0.8}
                        max={3}
                        step={0.05}
                        unit="m"
                        digits={2}
                        onChange={setSlotWidth}
                    />
                    <Slider
                        label="Stretcher mass"
                        value={barMass}
                        min={1}
                        max={200}
                        step={1}
                        unit="kg"
                        digits={0}
                        onChange={setBarMass}
                    />
                    <Separator />
                    <Slider
                        label="Most a belayer can take in against"
                        value={holdLimit}
                        min={100}
                        max={2000}
                        step={50}
                        unit="N"
                        digits={0}
                        onChange={setHoldLimit}
                    />
                </>
            }
            readouts={
                <>
                    <Readout
                        label="Stretcher below the floor"
                        value={
                            view ? `${Math.max(0, slotDepth - view.centre.y).toFixed(2)} m` : NONE
                        }
                    />
                    <Readout
                        label="Tipped side to side"
                        value={view ? `${Math.abs(deg(view.roll)).toFixed(1)}°` : NONE}
                    />
                    <Readout
                        label="Tipped end to end"
                        value={view ? `${Math.abs(deg(view.pitch)).toFixed(1)}°` : NONE}
                    />
                    <Separator />
                    <p className="text-xs text-slate-500">Each rope&apos;s pull</p>
                    {ROPES.map((r, i) => (
                        <Readout
                            key={r.name}
                            label={r.name}
                            value={view ? `${view.ropes[i].tension.toFixed(0)} N` : NONE}
                            color={ropeColor(i)}
                        />
                    ))}
                    <Readout
                        label="Floor's and edges' push"
                        value={view ? `${pushOf(view).toFixed(0)} N` : NONE}
                        color={COLORS.push}
                    />
                    <Readout label="Stretcher weight" value={`${barWeight.toFixed(0)} N`} />
                    <Separator />
                    <Readout
                        label="Hardest rope pull so far"
                        value={
                            hardest !== null
                                ? `${hardest.toFixed(0)} N (${((100 * hardest) / barWeight).toFixed(0)}%)`
                                : NONE
                        }
                    />
                </>
            }
            footer={
                <div className="flex flex-col gap-4">
                    <FourPointLowerNotes />
                    {SHOW_RAW_VALUES && (
                        <RawValues
                            title="Raw values"
                            data={{ inputs: { ...setup, paidOut: moves?.paidOut }, result }}
                        />
                    )}
                </div>
            }
        />
    );
}

/**
 * A belayer's slider, in their rope's colour: it moves by how much they pay out or take in, and reads how much rope
 * they have out, from their belay to the stretcher's corner.
 */
function RopeSlider(props: {
    index: number;
    ropeOut: number;
    /** Pulling harder than its belayer can take in against. */
    overLimit: boolean;
    value: number;
    min: number;
    max: number;
    disabled: boolean;
    onChange: (v: number) => void;
}) {
    const rope = ROPES[props.index];
    const color = ropeColor(props.index);
    return (
        <label
            className={`flex min-w-0 flex-col gap-1 text-sm text-slate-300 ${props.disabled ? "opacity-40" : ""}`}
        >
            <span className="flex flex-wrap items-center justify-between gap-x-2">
                <span className="flex items-center gap-1.5">
                    <svg width="16" height="8" aria-hidden className="shrink-0">
                        <line
                            x1={1}
                            y1={4}
                            x2={15}
                            y2={4}
                            stroke={color}
                            strokeWidth={3}
                            strokeDasharray={rope.end < 0 ? "4 2" : undefined}
                        />
                    </svg>
                    {rope.name}
                </span>
                <span className="shrink-0 font-mono whitespace-nowrap text-slate-400">
                    {props.ropeOut.toFixed(2)} m
                </span>
                {props.overLimit && (
                    <span className="w-full text-xs text-amber-400">Too hard to take in</span>
                )}
            </span>
            <input
                type="range"
                min={props.min}
                max={props.max}
                step={0.01}
                value={props.value}
                disabled={props.disabled}
                aria-label={`${rope.name}: rope out`}
                aria-valuetext={`${props.ropeOut.toFixed(2)} m out`}
                onChange={(e) => props.onChange(Number(e.target.value))}
                className="rope-range"
                style={
                    {
                        "--rope": color,
                        "--fill": `${(100 * (props.value - props.min)) / (props.max - props.min)}%`,
                    } as React.CSSProperties
                }
            />
        </label>
    );
}

/**
 * The link between two neighbouring belayers' sliders: a line joining them, with a button on it stepping through
 * coupled, coupled the other way round, and not coupled.
 */
function LinkButton(props: {
    name: string;
    coupling: Coupling;
    /** What clicking it makes it. */
    next: Coupling;
    /** Joining sliders side by side (or one above the other). */
    across: boolean;
    onClick: () => void;
}) {
    const { coupling, across } = props;
    const state =
        coupling === 1
            ? { Icon: Link2, says: "moving together" }
            : coupling === -1
              ? { Icon: ArrowDownUp, says: "moving opposite ways" }
              : { Icon: Link2Off, says: "not coupled" };
    const next =
        props.next === 1
            ? "couple them, moving together"
            : props.next === -1
              ? "couple them, moving opposite ways"
              : "uncouple them";
    const line = coupling ? "bg-slate-300" : "bg-slate-700";
    const dashed =
        coupling === -1
            ? "opacity-70 [mask-image:repeating-linear-gradient(90deg,#000_0_4px,transparent_4px_7px)]"
            : "";
    const segment = across ? `h-0.5 w-2 ${line} ${dashed}` : `h-2 w-0.5 ${line} ${dashed}`;
    return (
        <div
            className={`flex items-center justify-center ${across ? "flex-row self-end pb-1" : "flex-col"}`}
        >
            <span className={segment} />
            <Button
                variant={coupling ? "secondary" : "ghost"}
                size="icon-sm"
                title={`The ${props.name}: ${state.says}. Click to ${next}.`}
                aria-label={`The ${props.name}: ${state.says}. Click to ${next}.`}
                onClick={props.onClick}
                className={coupling ? "" : "text-slate-500"}
            >
                <state.Icon />
            </Button>
            <span className={segment} />
        </div>
    );
}

/** The four ropes' pulls and the floor's and edges' push at each step of the moves so far, oldest on the left. */
function TraceGraph(props: { trace: Sample[]; weight: number }) {
    const { trace, weight } = props;
    const H = 280;
    const left = 64;
    const right = 12;
    const top = 34;
    const bottomPad = 36;
    const width = W - left - right;
    const height = H - top - bottomPad;
    const x = (i: number) => left + (trace.length > 1 ? i / (trace.length - 1) : 1) * width;

    const largest = Math.max(weight * 1.1, ...trace.flatMap((t) => [...t.pulls, t.push]));
    const tick = niceStep(largest / 4);
    const yMax = Math.ceil(largest / tick) * tick;
    const y = (v: number) => top + height - (v / yMax) * height;

    const series = [
        ...ROPES.map((r, i) => ({
            name: r.name,
            color: ropeColor(i),
            dash: ropeDash(i),
            value: (t: Sample) => t.pulls[i],
        })),
        {
            name: "Floor's and edges' push",
            color: COLORS.push,
            dash: undefined,
            value: (t: Sample) => t.push,
        },
    ];
    const label = (
        text: string,
        at: Vector2,
        anchor: "start" | "middle" | "end",
        color = "#94a3b8",
    ) => (
        <text
            x={at.x}
            y={at.y}
            fill={color}
            fontSize={17}
            textAnchor={anchor}
            fontFamily="var(--font-geist-mono), monospace"
        >
            {text}
        </text>
    );
    const latest = trace[trace.length - 1];

    return (
        <div className="flex flex-col gap-2">
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
                {series.map((s) => (
                    <li key={s.name} className="flex items-center gap-1.5">
                        <svg width="22" height="8" aria-hidden>
                            <line
                                x1={1}
                                y1={4}
                                x2={21}
                                y2={4}
                                stroke={s.color}
                                strokeWidth={2}
                                strokeDasharray={s.dash ? "5 3" : undefined}
                            />
                        </svg>
                        {s.name}
                    </li>
                ))}
            </ul>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="block h-auto w-full"
                role="img"
                aria-label="The ropes' pulls and the floor's and edges' push over the moves so far"
            >
                {Array.from({ length: Math.round(yMax / tick) + 1 }, (_, i) => i * tick).map(
                    (v) => (
                        <g key={v}>
                            <line x1={left} y1={y(v)} x2={W - right} y2={y(v)} stroke="#1e293b" />
                            <text
                                x={left - 8}
                                y={y(v)}
                                fill="#94a3b8"
                                fontSize={17}
                                textAnchor="end"
                                dominantBaseline="middle"
                                fontFamily="var(--font-geist-mono), monospace"
                            >
                                {v.toFixed(0)}
                            </text>
                        </g>
                    ),
                )}
                {label("N", vec2(12, top - 12), "start")}
                <line
                    x1={left}
                    y1={y(weight)}
                    x2={W - right}
                    y2={y(weight)}
                    stroke={COLORS.bar}
                    strokeOpacity={0.6}
                    strokeDasharray="2 4"
                />
                {label("stretcher's weight", vec2(W - right - 4, y(weight) - 6), "end", COLORS.bar)}
                {label("start", vec2(left, H - 10), "start")}
                {label("now", vec2(W - right, H - 10), "end")}
                {trace.length > 1 &&
                    series.map((s) => (
                        <polyline
                            key={s.name}
                            points={trace
                                .map((t, i) => `${x(i).toFixed(1)},${y(s.value(t)).toFixed(1)}`)
                                .join(" ")}
                            fill="none"
                            stroke={s.color}
                            strokeWidth={2}
                            strokeDasharray={s.dash}
                            strokeLinejoin="round"
                        />
                    ))}
                {latest &&
                    series.map((s) => (
                        <circle
                            key={s.name}
                            cx={x(trace.length - 1)}
                            cy={y(s.value(latest))}
                            r={4.5}
                            fill={s.color}
                            stroke="#0f172a"
                            strokeWidth={2}
                        />
                    ))}
                {trace.length < 2 &&
                    label(
                        "move a rope to start the trace",
                        vec2(left + width / 2, top + height / 2),
                        "middle",
                    )}
            </svg>
        </div>
    );
}

/** A round step for an axis: 1, 2 or 5 times a power of ten, at least `rough`. */
function niceStep(rough: number): number {
    const power = 10 ** Math.floor(Math.log10(Math.max(rough, 1e-9)));
    return [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power;
}

/** The convex hull of some points, in order round it. */
function hull(pts: Vector2[]): Vector2[] {
    const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
    const half = (list: Vector2[]) => {
        const out: Vector2[] = [];
        for (const p of list) {
            while (
                out.length >= 2 &&
                out[out.length - 1].sub(out[out.length - 2]).cross(p.sub(out[out.length - 2])) <= 0
            )
                out.pop();
            out.push(p);
        }
        return out.slice(0, -1);
    };
    return [...half(sorted), ...half([...sorted].reverse())];
}

/** A view's caption, in its top left corner. */
function Caption({ children }: { children: React.ReactNode }) {
    return (
        <text
            x={12}
            y={22}
            fill="#94a3b8"
            fontSize={14}
            fontFamily="var(--font-geist-mono), monospace"
        >
            {children}
        </text>
    );
}

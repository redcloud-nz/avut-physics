"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import {
    Choice,
    RawValues,
    Readout,
    Slider,
    VisualisationLayout,
} from "@/components/diagram/controls";
import { AngleArc, Arrow, Label } from "@/components/diagram/svg";
import { Separator } from "@/components/ui/separator";
import { G } from "@/lib/constants";
import { deg, rad } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";

import { MultiPointAnchorNotes } from "./multi-point-anchor-notes";
import {
    layoutFor,
    loadDirection,
    solveAnchor,
    type AnchorResult,
    type Rig,
    type Settled,
} from "./multi-point-anchor-solver";

const COLORS = {
    anchors: ["var(--anchor-a)", "var(--anchor-b)", "var(--anchor-c)"],
    load: "var(--mass)",
    taut: "var(--ink-soft)",
    slack: "var(--ink-muted)",
    tied: "var(--ghost)",
};
const NAMES = ["A", "B", "C"];
const RIG_NAMES: Record<Rig, string> = { "pre-equalised": "Pre-equalised", sliding: "Sliding" };
const RIGS: Rig[] = ["pre-equalised", "sliding"];

/** The load arrow's length (SVG units); the anchors' arrows are to the same scale, up to MAX_ARROW. */
const LOAD_ARROW = 110;
const MAX_ARROW = 220;
/** The furthest the load swings either way (degrees). */
const MAX_DIRECTION = 75;
/** The anchors' spacing (A to B, B to C) and the master point's drop below them, for two or three anchors. */
const DEFAULTS = {
    2: { gaps: [1.2, 1.2], drop: 0.6 },
    3: { gaps: [0.5, 0.5], drop: 0.75 },
};
/** Turn on to show a card of the inputs and solver output, for copying problem cases. */
const SHOW_RAW_VALUES = false;
/** Shown in place of a value that doesn't apply. */
const NONE = "—";

/** The drawing's width in SVG units; its height follows from the setup, up to MAX_H. */
const W = 800;
const MAX_H = 640;
/** Room round the drawing for labels and arrows (SVG units). */
const MARGIN = 40;
const ABOVE = 50;

/**
 * A multi-point anchor seen face on: two or three anchors joined by slings to a master point, the load hanging
 * from it. Shows how a pre-equalised rig and a sliding rig on the same anchors share the load, and what happens
 * to each as the load swings to one side.
 */
export default function MultiPointAnchor() {
    const [count, setCount] = useState<2 | 3>(2);
    const [rig, setRig] = useState<Rig>("pre-equalised");
    const [loadMass, setLoadMass] = useState(200);
    const [direction, setDirection] = useState(0);
    /** Across from A to B, and from B to C. */
    const [gaps, setGaps] = useState(DEFAULTS[2].gaps);
    const [drop, setDrop] = useState(DEFAULTS[2].drop);
    /** Switching between two and three anchors starts that layout from its own spacing and drop. */
    const changeCount = (n: 2 | 3) => {
        setCount(n);
        setGaps(DEFAULTS[n].gaps);
        setDrop(DEFAULTS[n].drop);
    };
    /** B's and C's heights above A. */
    const [heights, setHeights] = useState([0, 0]);
    const [tieDirection, setTieDirection] = useState(0);

    const load = loadMass * G;
    // Only a pre-equalised rig is tied for a load direction: a sliding rig sets itself to the load, so its sling
    // is just the length that reaches the point straight below.
    const layouts = useMemo(
        () =>
            Object.fromEntries(
                RIGS.map((r) => [
                    r,
                    layoutFor({
                        count,
                        gaps,
                        heights,
                        drop,
                        tieDirection: r === "pre-equalised" ? rad(tieDirection) : 0,
                    }),
                ]),
            ) as Record<Rig, ReturnType<typeof layoutFor>>,
        [count, gaps, heights, drop, tieDirection],
    );
    const layout = layouts[rig];
    const results = useMemo(
        () =>
            Object.fromEntries(
                RIGS.map((r) => [
                    r,
                    solveAnchor({ ...layouts[r], load, direction: rad(direction), rig: r }),
                ]),
            ) as Record<Rig, AnchorResult>,
        [layouts, load, direction],
    );
    // The solver's last few digits differ between the server and the browser, which would make hydration
    // fail, so results are only shown once running in the browser.
    const inBrowser = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );

    // --- Drawing ---
    // The drawing's frame takes in everywhere either rig's master point reaches as the load swings, so it stays
    // still while the direction slider moves.
    const frame = useMemo(() => {
        const points = [...layouts.sliding.anchors, ...RIGS.map((r) => layouts[r].tiedAt)];
        for (const r of RIGS)
            for (let d = -MAX_DIRECTION; d <= MAX_DIRECTION; d += 15) {
                const res = solveAnchor({ ...layouts[r], load, direction: rad(d), rig: r });
                if (res.kind === "settled") points.push(res.s.master);
            }
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
        };
    }, [layouts, load]);
    const PPM = Math.min(
        (W - 2 * (MARGIN + LOAD_ARROW)) / Math.max(frame.maxX - frame.minX, 0.1),
        (MAX_H - ABOVE - LOAD_ARROW - MARGIN) / Math.max(frame.maxY - frame.minY, 0.1),
    );
    const H = Math.round((frame.maxY - frame.minY) * PPM + ABOVE + LOAD_ARROW + MARGIN);
    const origin = vec2(W / 2 - ((frame.minX + frame.maxX) / 2) * PPM, ABOVE + frame.maxY * PPM);
    /** World (metres, y up) → SVG (y down). */
    const toSvg = (p: Vector2): Vector2 => vec2(origin.x + p.x * PPM, origin.y - p.y * PPM);
    const k = LOAD_ARROW / load; // px per newton
    const force = (f: Vector2) => vec2(f.x * k, -f.y * k).clampLen(MAX_ARROW);

    const rockBottom = toSvg(vec2(0, Math.min(...layout.anchors.map((a) => a.y)) - 0.15)).y;
    const tiedS = toSvg(layout.tiedAt);
    const scene = (
        <>
            {/* the rock the anchors are in, seen face on */}
            <rect
                x={0}
                y={0}
                width={W}
                height={rockBottom}
                fill="var(--surface-raised)"
                stroke="var(--line-faint)"
                rx={8}
            />
            {/* where the master point sat as the rig was tied */}
            <path
                d={`M ${tiedS.x - 5} ${tiedS.y - 5} L ${tiedS.x + 5} ${tiedS.y + 5} M ${tiedS.x - 5} ${tiedS.y + 5} L ${tiedS.x + 5} ${tiedS.y - 5}`}
                stroke={COLORS.tied}
                strokeWidth={1.5}
            />
        </>
    );
    const anchorMarks = layout.anchors.map((a, i) => {
        const p = toSvg(a);
        return (
            <g key={i}>
                <circle
                    cx={p.x}
                    cy={p.y}
                    r={7}
                    fill="none"
                    stroke="var(--ink-soft)"
                    strokeWidth={2}
                />
                <circle cx={p.x} cy={p.y} r={2.5} fill="var(--ink-soft)" />
                <Label at={p.add(vec2(0, -20))} color={COLORS.anchors[i]}>
                    {NAMES[i]}
                </Label>
            </g>
        );
    });

    /** A rig's slings: one line per strand, side by side where an anchor has more than one. */
    const slings = (s: Settled) =>
        s.legs.flatMap((leg, i) => {
            const a = toSvg(leg.anchor);
            const m = toSvg(s.master);
            const side = m.sub(a).safeUnit(vec2(0, 1)).perp();
            const taut = leg.tension > 1e-6 * load;
            return Array.from({ length: leg.strands }, (_, j) => {
                const off = side.scale((j - (leg.strands - 1) / 2) * 4);
                return (
                    <line
                        key={`${i}-${j}`}
                        x1={a.x + off.x}
                        y1={a.y + off.y}
                        x2={m.x + off.x}
                        y2={m.y + off.y}
                        stroke={taut ? COLORS.taut : COLORS.slack}
                        strokeWidth={1.75}
                        strokeDasharray={taut ? undefined : "5 5"}
                    />
                );
            });
        });

    const shown = inBrowser && results[rig].kind === "settled" ? results[rig].s : null;

    let diagram: React.ReactNode = (
        <>
            {scene}
            {anchorMarks}
        </>
    );
    if (shown) {
        const m = toSvg(shown.master);
        const outer = [shown.legs[0], shown.legs.at(-1)!].map((leg) => toSvg(leg.anchor).sub(m));
        const a0 = deg(outer[0].angle());
        const sweep = ((deg(outer[1].angle()) - a0 + 540) % 360) - 180;
        diagram = (
            <>
                {scene}
                {slings(shown)}
                <AngleArc
                    center={m}
                    radius={30}
                    startDeg={a0}
                    sweepDeg={sweep}
                    label={`${Math.abs(sweep).toFixed(0)}°`}
                />
                {anchorMarks}
                {shown.legs.map((leg, i) =>
                    leg.force.len() > 1e-6 * load ? (
                        <Arrow
                            key={i}
                            from={toSvg(leg.anchor)}
                            v={force(leg.force)}
                            color={COLORS.anchors[i]}
                            width={2}
                            label={`${((leg.force.len() / load) * 100).toFixed(0)}%`}
                        />
                    ) : null,
                )}
                <circle cx={m.x} cy={m.y} r={5} fill={COLORS.load} />
                <Arrow from={m} v={force(shown.load)} color={COLORS.load} label="W" width={2.5} />
            </>
        );
    }

    const notice =
        inBrowser && results[rig].kind === "none"
            ? {
                  title: "No balanced position for these settings",
                  detail: (results[rig] as { reason: string }).reason,
              }
            : null;

    // --- Readouts: both rigs side by side ---
    const views = Object.fromEntries(
        RIGS.map((r) => [
            r,
            inBrowser && results[r].kind === "settled" ? (results[r] as { s: Settled }).s : null,
        ]),
    ) as Record<Rig, Settled | null>;
    const angleOf = (s: Settled) => {
        const [a, b] = [s.legs[0], s.legs.at(-1)!].map((leg) => leg.anchor.sub(s.master));
        return deg(Math.acos(a.dot(b) / (a.len() * b.len())));
    };
    const row = (
        label: string,
        value: (s: Settled) => React.ReactNode,
        color?: string,
        key?: string,
    ) => (
        <div key={key ?? label} className="contents">
            <span className="text-ink-muted" style={color ? { color } : undefined}>
                {label}
            </span>
            {RIGS.map((r) => (
                <span
                    key={r}
                    className={`text-right font-mono ${r === rig ? "text-ink-strong" : "text-ink-muted"}`}
                >
                    {views[r] ? value(views[r]) : NONE}
                </span>
            ))}
        </div>
    );

    return (
        <VisualisationLayout
            diagram={
                <div className="relative flex flex-col gap-4 p-4">
                    {notice && (
                        <div className="absolute inset-x-4 top-6 text-center text-sm text-warning">
                            <p className="font-medium">{notice.title}</p>
                            <p className="mx-auto mt-1 max-w-md text-warning/80">{notice.detail}</p>
                        </div>
                    )}
                    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
                        {diagram}
                    </svg>
                    <Slider
                        label={`Load direction (${direction < 0 ? "to the left" : direction > 0 ? "to the right" : "straight down"})`}
                        value={direction}
                        min={-MAX_DIRECTION}
                        max={MAX_DIRECTION}
                        step={1}
                        unit="°"
                        digits={0}
                        onChange={setDirection}
                    />
                </div>
            }
            controls={(more) => (
                <>
                    <Choice
                        label="Anchors"
                        value={String(count) as "2" | "3"}
                        options={[
                            { value: "2", label: "Two" },
                            { value: "3", label: "Three" },
                        ]}
                        onChange={(v) => changeCount(v === "3" ? 3 : 2)}
                    />
                    <Choice
                        label="Rig"
                        value={rig}
                        options={RIGS.map((r) => ({ value: r, label: RIG_NAMES[r] }))}
                        onChange={setRig}
                    />
                    <Slider
                        label="Load"
                        value={loadMass}
                        min={10}
                        max={400}
                        step={5}
                        unit="kg"
                        digits={0}
                        onChange={setLoadMass}
                    />
                    <Slider
                        label="Master point below lowest anchor"
                        value={drop}
                        min={0.1}
                        max={2}
                        step={0.05}
                        unit="m"
                        digits={2}
                        onChange={setDrop}
                    />
                    <Separator />
                    {more(
                        <>
                            {gaps.slice(0, count - 1).map((g, i) => (
                                <Slider
                                    key={i}
                                    label={`Anchors ${NAMES[i]} to ${NAMES[i + 1]} apart`}
                                    value={g}
                                    min={0.3}
                                    max={3}
                                    step={0.05}
                                    unit="m"
                                    digits={2}
                                    onChange={(v) =>
                                        setGaps((gs) => gs.map((x, j) => (j === i ? v : x)))
                                    }
                                />
                            ))}
                            {heights.slice(0, count - 1).map((h, i) => (
                                <Slider
                                    key={i}
                                    label={`Anchor ${NAMES[i + 1]} above A`}
                                    value={h}
                                    min={-1}
                                    max={1}
                                    step={0.05}
                                    unit="m"
                                    digits={2}
                                    onChange={(v) =>
                                        setHeights((hs) => hs.map((x, j) => (j === i ? v : x)))
                                    }
                                />
                            ))}
                            <Slider
                                label="Pre-equalised legs tied for load direction"
                                value={tieDirection}
                                min={-45}
                                max={45}
                                step={1}
                                unit="°"
                                digits={0}
                                onChange={setTieDirection}
                            />
                        </>,
                    )}
                </>
            )}
            readouts={
                <>
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 text-sm">
                        <span />
                        {RIGS.map((r) => (
                            <span
                                key={r}
                                className={`text-right ${r === rig ? "text-ink" : "text-ink-muted"}`}
                            >
                                {RIG_NAMES[r]}
                            </span>
                        ))}
                        {layout.anchors.map((_, i) =>
                            row(
                                `Anchor ${NAMES[i]}`,
                                (s) => {
                                    const f = s.legs[i].force.len();
                                    return (
                                        <>
                                            {((f / load) * 100).toFixed(0)}%
                                            <span className="block text-xs text-ghost">
                                                {f.toFixed(0)} N
                                            </span>
                                        </>
                                    );
                                },
                                COLORS.anchors[i],
                                NAMES[i],
                            ),
                        )}
                        {row("Angle between outer legs", (s) => `${angleOf(s).toFixed(0)}°`)}
                        {row(
                            "Master point moved",
                            (s) => `${(s.master.distanceTo(s.tiedAt) * 100).toFixed(0)} cm`,
                        )}
                    </div>
                    <Separator />
                    <Readout label="Load W" value={`${load.toFixed(0)} N`} color={COLORS.load} />
                    <Readout
                        label="Load's swing from straight down"
                        value={`${Math.abs(direction).toFixed(0)}°`}
                    />
                </>
            }
            footer={
                <div className="flex flex-col gap-4">
                    <MultiPointAnchorNotes />
                    {SHOW_RAW_VALUES && (
                        <RawValues
                            title="Raw values"
                            data={{
                                inputs: { layouts, load, direction: rad(direction) },
                                loadDirection: loadDirection(rad(direction)),
                                results,
                            }}
                        />
                    )}
                </div>
            }
        />
    );
}

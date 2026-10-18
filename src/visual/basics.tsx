"use client";

import { useRef, useState } from "react";

import { COLORS, Rock, Tag } from "@/articles/gentle-introduction-figures";
import { Slider } from "@/components/diagram/controls";
import { AngleArc, Arrow } from "@/components/diagram/svg";
import { G } from "@/lib/constants";
import { clamp, deg } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";

import { Layout, Readout, SVG } from "./frame";

/*
 * The first figures in the visual introduction, for readers who haven't done physics since school: velocity,
 * acceleration, force, and forces drawn as arrows.
 */

const VELOCITY = "#34d399";
const GHOST = "#64748b";

/** Small grey text, for the times beside where something was. */
function Note(props: {
    at: Vector2;
    anchor?: "start" | "middle" | "end";
    children: React.ReactNode;
}) {
    return (
        <text
            x={props.at.x}
            y={props.at.y}
            fontSize={13}
            fill={GHOST}
            textAnchor={props.anchor ?? "middle"}
            dominantBaseline="middle"
        >
            {props.children}
        </text>
    );
}

/**
 * A box moving along a track measured in metres, at `time` into its run: where it is and its velocity (an arrow,
 * `arrow` drawing units per m/s), with a dashed mark and a fainter arrow where it was after each whole second.
 */
function Track(props: {
    time: number;
    length: number;
    position: (t: number) => number;
    velocity: (t: number) => number;
    arrow: number;
    label: string;
}) {
    const ground = 130;
    const side = 26;
    const at = (t: number) => 20 + (props.position(t) / props.length) * 270;
    const mark = (m: number) => 20 + (m / props.length) * 270;
    const lane = ground - side - 12;
    const seconds = Array.from({ length: Math.floor(props.time + 1e-9) }, (_, i) => i + 1);
    const x = at(props.time);
    const v = props.velocity(props.time);
    return (
        <svg
            viewBox="0 0 345 165"
            className={SVG}
            fontSize={14}
            role="img"
            aria-label={props.label}
        >
            <line x1={0} y1={ground} x2={345} y2={ground} stroke="currentColor" />
            {Array.from({ length: props.length + 1 }, (_, m) => (
                <line
                    key={m}
                    x1={mark(m)}
                    y1={ground}
                    x2={mark(m)}
                    y2={ground + (m % 5 ? 4 : 8)}
                    stroke="currentColor"
                />
            ))}
            {Array.from({ length: props.length / 5 + 1 }, (_, i) => i * 5).map((m) => (
                <Note key={m} at={vec2(mark(m), ground + 20)}>
                    {m === props.length ? `${m} m` : m}
                </Note>
            ))}
            {seconds.map((s) => (
                <g key={s}>
                    <rect
                        x={at(s) - side / 2}
                        y={ground - side}
                        width={side}
                        height={side}
                        fill="none"
                        stroke={GHOST}
                        strokeDasharray="3 3"
                    />
                    <g opacity={0.45}>
                        <Arrow
                            from={vec2(at(s), lane)}
                            v={vec2(props.velocity(s) * props.arrow, 0)}
                            color={VELOCITY}
                            width={2}
                        />
                    </g>
                    <Note at={vec2(at(s), lane - 14)}>{s} s</Note>
                </g>
            ))}
            <rect
                x={x - side / 2}
                y={ground - side}
                width={side}
                height={side}
                rx={3}
                fill="currentColor"
            />
            <Arrow from={vec2(x, lane)} v={vec2(v * props.arrow, 0)} color={VELOCITY} />
            <Tag at={vec2(x + (v * props.arrow) / 2, lane - 34)} color={VELOCITY}>
                {v.toFixed(1)} m/s
            </Tag>
        </svg>
    );
}

/** A box moving along the ground at a steady 2 m/s. */
export function VelocityFigure() {
    const [time, setTime] = useState(4);
    const speed = 2;
    return (
        <Layout
            drawing={
                <Track
                    time={time}
                    length={20}
                    position={(t) => speed * t}
                    velocity={() => speed}
                    arrow={20}
                    label="A box moving along a measured track at a steady speed"
                />
            }
            slider={
                <Slider
                    label="Time"
                    value={time}
                    min={0}
                    max={10}
                    step={0.1}
                    unit="s"
                    onChange={setTime}
                />
            }
            readouts={
                <>
                    <Readout label="gone" value={`${(speed * time).toFixed(1)} m`} />
                    <Readout label="velocity" value={`${speed} m/s`} color={VELOCITY} />
                </>
            }
        />
    );
}

/** A box speeding up from rest by 2 m/s every second. */
export function AccelerationFigure() {
    const [time, setTime] = useState(3);
    const accel = 2;
    return (
        <Layout
            drawing={
                <Track
                    time={time}
                    length={25}
                    position={(t) => 0.5 * accel * t * t}
                    velocity={(t) => accel * t}
                    arrow={5}
                    label="A box speeding up along a measured track"
                />
            }
            slider={
                <Slider
                    label="Time"
                    value={time}
                    min={0}
                    max={5}
                    step={0.1}
                    unit="s"
                    onChange={setTime}
                />
            }
            readouts={
                <>
                    <Readout label="gone" value={`${(0.5 * accel * time * time).toFixed(1)} m`} />
                    <Readout
                        label="velocity"
                        value={`${(accel * time).toFixed(1)} m/s`}
                        color={VELOCITY}
                    />
                </>
            }
        />
    );
}

/** Where the load is, and how hard gravity pulls there, in m/s every second. */
const PLACES = [
    { name: "Earth", gravity: G },
    { name: "Moon", gravity: 1.62 },
    { name: "Space", gravity: 0 },
];

/** The same 100 kg load on Earth, on the Moon and floating in space: its mass stays put, its weight doesn't. */
export function MassFigure() {
    const [place, setPlace] = useState(0);
    const { gravity } = PLACES[place];
    const heavy = gravity / G;
    const top = 40;
    const side = 64;
    // Floating, the load drifts up and its rope goes slack.
    const box = vec2(150, gravity > 0 ? 170 : 140);
    const tie = vec2(box.x, box.y - side / 2);
    const arrow = 120 * heavy;
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 0 300 330"
                    className={SVG}
                    fontSize={14}
                    role="img"
                    aria-label={`A 100 kg load hanging on a rope, in ${PLACES[place].name}`}
                >
                    <Rock y={top} width={300} />
                    {gravity > 0 ? (
                        <line
                            x1={box.x}
                            y1={top}
                            x2={tie.x}
                            y2={tie.y}
                            stroke="currentColor"
                            strokeWidth={2}
                        />
                    ) : (
                        <path
                            d={`M ${box.x} ${top} C ${box.x + 50} ${top + 30}, ${box.x - 50} ${tie.y - 20}, ${tie.x} ${tie.y}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                        />
                    )}
                    <rect
                        x={box.x - side / 2}
                        y={box.y - side / 2}
                        width={side}
                        height={side}
                        rx={4}
                        fill="currentColor"
                    />
                    <text
                        x={box.x}
                        y={box.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-slate-950"
                        fontSize={16}
                        fontWeight={600}
                    >
                        100 kg
                    </text>
                    {arrow > 0 && (
                        <>
                            <Arrow
                                from={box.add(vec2(0, side / 2))}
                                v={vec2(0, arrow)}
                                color={COLORS.load}
                                width={3}
                            />
                            <Tag
                                at={box.add(vec2(14, side / 2 + arrow / 2))}
                                color={COLORS.load}
                                anchor="start"
                            >
                                Weight
                            </Tag>
                        </>
                    )}
                    {arrow === 0 && (
                        <Tag at={box.add(vec2(0, side / 2 + 30))} color={COLORS.load}>
                            No weight
                        </Tag>
                    )}
                </svg>
            }
            slider={
                <div className="grid grid-cols-3 gap-1.5">
                    {PLACES.map((p, i) => (
                        <button
                            key={p.name}
                            type="button"
                            aria-pressed={place === i}
                            onClick={() => setPlace(i)}
                            className={`rounded-lg border py-1.5 text-sm ${
                                place === i
                                    ? "border-sky-500 bg-sky-500/15 text-slate-100"
                                    : "border-slate-700 text-slate-400"
                            }`}
                        >
                            {p.name}
                        </button>
                    ))}
                </div>
            }
            readouts={
                <>
                    <Readout label="mass" value="100 kg" />
                    <Readout
                        label="weight, against Earth"
                        value={`${Math.round(heavy * 100)}%`}
                        color={COLORS.load}
                    />
                </>
            }
        />
    );
}

/** A 100 kg load on smooth ice, pushed, with where it will be after each second. */
export function ForceFigure() {
    const [force, setForce] = useState(100);
    const mass = 100;
    const accel = force / mass;
    const ice = 110;
    const side = 30;
    const start = 105;
    const PX = 20;
    const at = (t: number) => start + 0.5 * accel * t * t * PX;
    let lastLabel = -Infinity;
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 0 320 150"
                    className={SVG}
                    fontSize={14}
                    role="img"
                    aria-label="A load pushed across ice, speeding up"
                >
                    <rect x={0} y={ice} width={320} height={10} fill="#bae6fd" opacity={0.25} />
                    <line x1={0} y1={ice} x2={320} y2={ice} stroke="#bae6fd" />
                    {[1, 2, 3].map((t) => {
                        const x = at(t);
                        const label = x - lastLabel >= 24;
                        if (label) lastLabel = x;
                        return (
                            <g key={t}>
                                <rect
                                    x={x - side / 2}
                                    y={ice - side}
                                    width={side}
                                    height={side}
                                    fill="none"
                                    stroke={GHOST}
                                    strokeDasharray="3 3"
                                />
                                {label && <Note at={vec2(x, ice + 22)}>{t} s</Note>}
                            </g>
                        );
                    })}
                    <rect
                        x={start - side / 2}
                        y={ice - side}
                        width={side}
                        height={side}
                        rx={3}
                        fill="currentColor"
                    />
                    <Arrow
                        from={vec2(start - side / 2 - force * 0.4, ice - side / 2)}
                        v={vec2(force * 0.4, 0)}
                        color={COLORS.pull}
                        width={3}
                    />
                    {force > 0 && (
                        <Tag
                            at={vec2(start - side / 2 - Math.max(force * 0.2, 20), ice - side - 14)}
                            color={COLORS.pull}
                        >
                            {force} N
                        </Tag>
                    )}
                </svg>
            }
            slider={
                <Slider
                    label="Push"
                    value={force}
                    min={0}
                    max={200}
                    step={10}
                    unit="N"
                    digits={0}
                    onChange={setForce}
                />
            }
            readouts={
                <>
                    <Readout label="push" value={`${force} N`} color={COLORS.pull} />
                    <Readout label="faster every second" value={`${accel.toFixed(1)} m/s`} />
                </>
            }
        />
    );
}

/** One kilonewton, in drawing units: a square of the grid. */
const KN = 30;
const ORIGIN = vec2(150, 150);
const TOGETHER = "#f1f5f9";

/** An arrow from the bolt to `tip`, in kilonewtons with up positive. */
const kn = (tip: Vector2) => vec2((tip.x - ORIGIN.x) / KN, (ORIGIN.y - tip.y) / KN);
const kNText = (v: number) => `${v.toFixed(1)} kN`;

/**
 * Pulls on a bolt, drawn on a grid of 1 kN squares, with arrow tips that can be dragged. A drag moves whichever tip
 * is nearest where it starts. `children` draws the arrows from the tips.
 */
function DragGrid(props: {
    tips: Vector2[];
    onChange: (tips: Vector2[]) => void;
    label: string;
    children: React.ReactNode;
}) {
    const svg = useRef<SVGSVGElement>(null);
    const dragging = useRef<number | null>(null);

    const point = (e: React.PointerEvent) => {
        const m = svg.current?.getScreenCTM();
        if (!m) return null;
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
        return vec2(p.x, p.y);
    };
    const move = (e: React.PointerEvent) => {
        const p = point(e);
        if (!p || dragging.current === null) return;
        // Snap to tenths of a kilonewton, and keep the tip on the grid.
        const snap = (v: number) => Math.round(clamp(v, 12, 288) / (KN / 10)) * (KN / 10);
        const i = dragging.current;
        props.onChange(props.tips.map((t, j) => (j === i ? vec2(snap(p.x), snap(p.y)) : t)));
    };

    return (
        <svg
            ref={svg}
            viewBox="0 0 300 300"
            className={`${SVG} touch-none select-none`}
            fontSize={14}
            role="img"
            aria-label={props.label}
            data-no-swipe
            onPointerDown={(e) => {
                const p = point(e);
                if (!p) return;
                const near = props.tips.map((t) => t.distanceTo(p));
                dragging.current = near.indexOf(Math.min(...near));
                e.currentTarget.setPointerCapture(e.pointerId);
                move(e);
            }}
            onPointerMove={move}
            onPointerUp={() => (dragging.current = null)}
            onPointerCancel={() => (dragging.current = null)}
        >
            {Array.from({ length: 11 }, (_, i) => (
                <g key={i} className="stroke-slate-800">
                    <line x1={i * KN} y1={0} x2={i * KN} y2={300} />
                    <line x1={0} y1={i * KN} x2={300} y2={i * KN} />
                </g>
            ))}
            <Note at={vec2(KN / 2, 300 - KN / 2)}>1 kN</Note>
            {props.children}
            <circle cx={ORIGIN.x} cy={ORIGIN.y} r={5} fill="currentColor" />
            {props.tips.map((t, i) => (
                <circle
                    key={i}
                    cx={t.x}
                    cy={t.y}
                    r={14}
                    fill="#94a3b8"
                    opacity={0.2}
                    className="cursor-grab"
                />
            ))}
        </svg>
    );
}

const DRAG_HINT = <p className="text-center text-sm text-slate-400">Drag the arrow’s tip.</p>;

/** One pull on a bolt as an arrow: how hard, and which way. */
export function ArrowsFigure() {
    const [tips, setTips] = useState([vec2(3, -2).scale(KN).add(ORIGIN)]);
    const f = kn(tips[0]);
    // Anticlockwise from pointing right, all the way round: 0° to 359°.
    const angle = Math.round((deg(Math.atan2(f.y, f.x)) + 360) % 360) % 360;
    return (
        <Layout
            drawing={
                <DragGrid
                    tips={tips}
                    onChange={setTips}
                    label="An arrow for a pull on a bolt, on a grid of 1 kN squares"
                >
                    <line
                        x1={ORIGIN.x}
                        y1={ORIGIN.y}
                        x2={ORIGIN.x + 60}
                        y2={ORIGIN.y}
                        stroke="currentColor"
                        strokeDasharray="4 3"
                    />
                    {f.len() > 0.2 && angle > 0 && (
                        <AngleArc center={ORIGIN} radius={30} startDeg={0} sweepDeg={-angle} />
                    )}
                    <Arrow from={ORIGIN} v={tips[0].sub(ORIGIN)} color={COLORS.pull} width={3} />
                </DragGrid>
            }
            slider={DRAG_HINT}
            readouts={
                <>
                    <Readout label="how hard" value={kNText(f.len())} color={COLORS.pull} />
                    <Readout label="round from pointing right" value={`${angle}°`} />
                </>
            }
        />
    );
}

/** Two pulls on one bolt, and the one pull they make together: each drawn again from the other's tip, either order. */
export function AddingFigure() {
    const [tips, setTips] = useState([
        vec2(3, -1).scale(KN).add(ORIGIN),
        vec2(-1, -3).scale(KN).add(ORIGIN),
    ]);
    const [a, b] = tips.map((t) => t.sub(ORIGIN));
    const sum = a.add(b);
    return (
        <Layout
            drawing={
                <DragGrid
                    tips={tips}
                    onChange={setTips}
                    label="Two pulls on a bolt, added tip to tail"
                >
                    <g opacity={0.7}>
                        <Arrow from={ORIGIN.add(a)} v={b} color={COLORS.redirect} dashed />
                        <Arrow from={ORIGIN.add(b)} v={a} color={COLORS.pull} dashed />
                    </g>
                    <Arrow from={ORIGIN} v={sum} color={TOGETHER} width={3} />
                    <Arrow from={ORIGIN} v={a} color={COLORS.pull} width={3} />
                    <Arrow from={ORIGIN} v={b} color={COLORS.redirect} width={3} />
                </DragGrid>
            }
            slider={<p className="text-center text-sm text-slate-400">Drag either arrow’s tip.</p>}
            readouts={
                <>
                    <Readout label="one" value={kNText(a.len() / KN)} color={COLORS.pull} />
                    <Readout label="other" value={kNText(b.len() / KN)} color={COLORS.redirect} />
                    <Readout label="together" value={kNText(sum.len() / KN)} color={TOGETHER} />
                </>
            }
        />
    );
}

/** One pull, and its sideways and up-or-down parts drawn tip to tail. */
export function SplitFigure() {
    const [tips, setTips] = useState([vec2(2.4, -1.8).scale(KN).add(ORIGIN)]);
    const tip = tips[0];
    const f = kn(tip);
    const corner = vec2(tip.x, ORIGIN.y);
    const left = f.x < 0;
    return (
        <Layout
            drawing={
                <DragGrid
                    tips={tips}
                    onChange={setTips}
                    label="A pull on a bolt, split into sideways and up-or-down parts"
                >
                    <Arrow from={ORIGIN} v={corner.sub(ORIGIN)} color={COLORS.sideways} />
                    <Arrow from={corner} v={tip.sub(corner)} color={COLORS.redirect} />
                    <g opacity={0.7}>
                        <Arrow from={ORIGIN} v={tip.sub(ORIGIN)} color={COLORS.pull} width={3} />
                    </g>
                </DragGrid>
            }
            slider={DRAG_HINT}
            readouts={
                <>
                    <Readout
                        label={left ? "x, to the left" : "x, to the right"}
                        value={kNText(Math.abs(f.x))}
                        color={COLORS.sideways}
                    />
                    <Readout
                        label={f.y < 0 ? "y, down" : "y, up"}
                        value={kNText(Math.abs(f.y))}
                        color={COLORS.redirect}
                    />
                </>
            }
        />
    );
}

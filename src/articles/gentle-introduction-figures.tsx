"use client";

import { useState } from "react";

import { Slider } from "@/components/diagram/controls";
import { AngleArc, Arrow } from "@/components/diagram/svg";
import { rad } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";

import { COLORS } from "./colors";
import {
    legShare,
    preEqualised,
    redirectShare,
    swungDown,
    tiedAt,
    type TwoAnchors,
} from "./gentle-introduction";

/*
 * The figures in A Gentle Introduction to Rescue Physics, each simple enough to read at a glance: the forces on a
 * hanging load, two legs sharing a load, a main line pulling off to one side, and a rope turning round a redirect. All but the
 * first have one slider. They're drawn in SVG units with y down; the maths is in metres with y up.
 */

export { COLORS };

/** The load used to turn shares into kilograms. */
const LOAD_KG = 200;

const percent = (share: number) => `${Math.round(share * 100)}%`;
/** A share of the load, as kilograms and kilonewtons of `kg`. */
const ofLoad = (share: number, kg = LOAD_KG) =>
    `${Math.round(share * kg)} kg (${((share * kg * 9.81) / 1000).toFixed(1)} kN)`;

/** Text in a figure, with a halo in the page's colour so lines behind it don't run through it. */
export function Tag(props: {
    at: Vector2;
    color?: string;
    anchor?: "start" | "middle" | "end";
    children: React.ReactNode;
}) {
    return (
        <text
            x={props.at.x}
            y={props.at.y}
            fill={props.color ?? "currentColor"}
            textAnchor={props.anchor ?? "middle"}
            dominantBaseline="middle"
            paintOrder="stroke"
            strokeWidth={4}
            className="stroke-background print:stroke-white"
        >
            {props.children}
        </text>
    );
}

/** A figure: its drawing, an optional slider under it, and a caption. */
export function Figure(props: { id: string; caption: React.ReactNode; children: React.ReactNode }) {
    return (
        <figure
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface/30 p-3 sm:p-4 print:break-inside-avoid print:border-slate-400 print:bg-transparent"
            aria-labelledby={`${props.id}-caption`}
        >
            {props.children}
            <figcaption id={`${props.id}-caption`} className="text-sm text-ink-muted">
                {props.caption}
            </figcaption>
        </figure>
    );
}

/** A rock face along the top of a drawing, above `y`. */
export function Rock(props: { y: number; width: number }) {
    return (
        <g>
            <rect
                x={0}
                y={props.y - 30}
                width={props.width}
                height={30}
                fill="currentColor"
                opacity={0.12}
            />
            <line
                x1={0}
                x2={props.width}
                y1={props.y}
                y2={props.y}
                stroke="currentColor"
                strokeWidth={2}
                opacity={0.6}
            />
        </g>
    );
}

export function Anchor(props: { at: Vector2 }) {
    return <circle cx={props.at.x} cy={props.at.y} r={4} fill="currentColor" />;
}

export function Rope(props: { from: Vector2; to: Vector2; dashed?: boolean }) {
    return (
        <line
            x1={props.from.x}
            y1={props.from.y}
            x2={props.to.x}
            y2={props.to.y}
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray={props.dashed ? "4 4" : undefined}
            opacity={props.dashed ? 0.5 : 0.8}
        />
    );
}

/** Figure 1: a load hanging on a rope, the same load pulled to one side, and that load's forces laid tip to tail. */
export function ForcesFigure() {
    const W = 64;
    // Pulled sideways until the rope leans 30°: the tag line pulls with tan 30° of the weight.
    const lean = rad(30);
    const side = W * Math.tan(lean);
    const anchor1 = vec2(80, 30);
    const load1 = vec2(80, 140);
    const anchor2 = vec2(200, 30);
    const load2 = anchor2.add(vec2(Math.sin(lean), Math.cos(lean)).scale(115));
    const rope2 = anchor2
        .sub(load2)
        .unit()
        .scale(W / Math.cos(lean));
    const start = vec2(440, 70);

    return (
        <Figure
            id="forces"
            caption={
                <>
                    <strong className="text-ink-soft">Figure 1.</strong> Left: a load hanging still
                    on a rope. Its weight pulls it down, and the rope pulls it up just as hard.
                    Middle: the same load pulled to one side by a tag line. The rope leans over
                    until the three pulls balance, and it now pulls harder than the load weighs.
                    Last: the middle load’s three arrows laid tip to tail. They join up into a
                    closed triangle, which is what balanced forces always do.
                </>
            }
        >
            {/* The hanging loads, and beside them (or below, on a phone) their forces tip to tail. */}
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
                <svg
                    viewBox="0 0 340 230"
                    className="w-full text-ink-muted sm:w-[62%]"
                    fontSize={13}
                    role="img"
                    aria-labelledby="forces-caption"
                >
                    <Rock y={30} width={330} />

                    <Rope from={anchor1} to={load1} />
                    <Anchor at={anchor1} />
                    <rect x={load1.x - 12} y={load1.y} width={24} height={24} fill="currentColor" />
                    <Arrow from={load1.add(vec2(0, 12))} v={vec2(0, W)} color={COLORS.load} />
                    <Arrow from={load1} v={vec2(0, -W)} color={COLORS.pull} />
                    <Tag
                        at={vec2(load1.x + 12, load1.y + 12 + W / 2)}
                        color={COLORS.load}
                        anchor="start"
                    >
                        Weight
                    </Tag>
                    <Tag
                        at={vec2(load1.x + 12, load1.y - W / 2)}
                        color={COLORS.pull}
                        anchor="start"
                    >
                        Rope
                    </Tag>

                    <Rope from={anchor2} to={load2} />
                    <Rope from={load2} to={vec2(load2.x + 60, load2.y)} dashed />
                    <Anchor at={anchor2} />
                    <rect x={load2.x - 12} y={load2.y} width={24} height={24} fill="currentColor" />
                    <Arrow from={load2.add(vec2(0, 12))} v={vec2(0, W)} color={COLORS.load} />
                    <Arrow from={load2} v={rope2} color={COLORS.pull} />
                    <Arrow
                        from={load2.add(vec2(12, 12))}
                        v={vec2(side, 0)}
                        color={COLORS.sideways}
                    />
                    <Tag at={vec2(load2.x + 72, load2.y - 12)} color={COLORS.sideways} anchor="end">
                        Tag line
                    </Tag>
                </svg>
                <svg
                    viewBox="370 30 160 140"
                    className="w-full max-w-56 text-ink-muted sm:w-[38%] sm:max-w-none"
                    fontSize={13}
                    aria-hidden
                >
                    <g>
                        <Arrow from={start} v={vec2(0, W)} color={COLORS.load} />
                        <Arrow
                            from={start.add(vec2(0, W))}
                            v={vec2(side, 0)}
                            color={COLORS.sideways}
                        />
                        <Arrow
                            from={start.add(vec2(side, W))}
                            v={vec2(-side, -W)}
                            color={COLORS.pull}
                        />
                        <Tag
                            at={vec2(start.x - 8, start.y + W / 2)}
                            color={COLORS.load}
                            anchor="end"
                        >
                            Weight
                        </Tag>
                        <Tag
                            at={vec2(start.x + side / 2, start.y + W + 16)}
                            color={COLORS.sideways}
                        >
                            Tag line
                        </Tag>
                        <Tag
                            at={vec2(start.x + side / 2 + 12, start.y + W / 2 - 8)}
                            color={COLORS.pull}
                            anchor="start"
                        >
                            Rope
                        </Tag>
                    </g>
                </svg>
            </div>
        </Figure>
    );
}

/** A square drawn on one side of a triangle, from `a` to `b`, out along `out`. */
function SideSquare(props: { a: Vector2; b: Vector2; out: Vector2; color: string }) {
    const pts = [props.a, props.b, props.b.add(props.out), props.a.add(props.out)];
    return (
        <polygon
            points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={props.color}
            fillOpacity={0.12}
            stroke={props.color}
            strokeOpacity={0.5}
        />
    );
}

/** Text in two lines: a large `top` and a smaller `bottom` under it, centred on `at`. */
function TwoLines(props: { at: Vector2; color: string; top: string; bottom: string }) {
    return (
        <>
            <Tag at={props.at.add(vec2(0, -8))} color={props.color}>
                <tspan fontSize={16}>{props.top}</tspan>
            </Tag>
            <Tag at={props.at.add(vec2(0, 10))} color={props.color}>
                {props.bottom}
            </Tag>
        </>
    );
}

/** For Figure 1's "Why is this?": its forces' triangle with a square on each side, showing a² + b² = c². */
export function PythagorasFigure() {
    // The triangle from Figure 1, bigger: weight down, tag line across, rope back up to the start.
    const W = 90;
    const side = W * Math.tan(rad(30));
    const p = vec2(110, 62);
    const q = p.add(vec2(0, W));
    const r = q.add(vec2(side, 0));
    // Each square sits on the outside of its side.
    const rope = p.sub(r);
    const out = vec2(-rope.y, rope.x);

    return (
        <Figure
            id="pythagoras"
            caption={
                <>
                    The three forces from Figure 1 make a triangle with a square corner, where the
                    level tag line meets the weight. Draw a square on each side: the square on the
                    long side, the rope, has exactly the area of the other two squares together.
                </>
            }
        >
            <svg
                viewBox="10 0 252 214"
                className="mx-auto w-full max-w-xs text-ink-muted"
                fontSize={12}
                role="img"
                aria-labelledby="pythagoras-caption"
            >
                <SideSquare a={p} b={q} out={vec2(-W, 0)} color={COLORS.load} />
                <SideSquare a={q} b={r} out={vec2(0, side)} color={COLORS.sideways} />
                <SideSquare a={r} b={p} out={out} color={COLORS.pull} />
                <polyline
                    points={`${q.x},${q.y - 10} ${q.x + 10},${q.y - 10} ${q.x + 10},${q.y}`}
                    fill="none"
                    stroke="currentColor"
                />
                <Arrow from={p} v={q.sub(p)} color={COLORS.load} />
                <Arrow from={q} v={r.sub(q)} color={COLORS.sideways} />
                <Arrow from={r} v={rope} color={COLORS.pull} />
                <TwoLines
                    at={vec2(p.x - W / 2, p.y + W / 2)}
                    color={COLORS.load}
                    top="a²"
                    bottom="Weight"
                />
                <TwoLines
                    at={vec2(q.x + side / 2, q.y + side / 2)}
                    color={COLORS.sideways}
                    top="b²"
                    bottom="Tag line"
                />
                <TwoLines
                    at={r.mid(p).add(out.scale(0.5))}
                    color={COLORS.pull}
                    top="c²"
                    bottom="Rope"
                />
            </svg>
        </Figure>
    );
}

/** For Figure 2's "Why is this?": legs 120° apart, each leg's pull split into a sideways part and an up part. */
export function LegPartsFigure() {
    const W = 100;
    const half = rad(60);
    const top = 40;
    const master = vec2(240, 130);
    const ROPE = (master.y - top) / Math.cos(half);
    const share = legShare(2 * half);
    const up = share * W * Math.cos(half);
    const across = share * W * Math.sin(half);

    return (
        <Figure
            id="leg-parts"
            caption={
                <>
                    Each leg’s pull, <em>T</em>, split into a sideways part, <em>x</em>, and an up
                    part, <em>y</em>, laid tip to tail. With the legs 120° apart, each leg is 60°
                    off straight up (<em>θ</em>, shown on one side; the other mirrors it), and its
                    up part is only half its pull. The sideways parts pull against each other and
                    cancel; the two up parts together hold the load’s weight, <em>W</em>.
                </>
            }
        >
            <svg
                viewBox="60 25 360 225"
                className="mx-auto w-full max-w-lg text-ink-muted"
                fontSize={13}
                role="img"
                aria-labelledby="leg-parts-caption"
            >
                <Rock y={top} width={480} />
                <Rope from={master} to={vec2(master.x, top)} dashed />
                {[-1, 1].map((sign) => {
                    const anchor = master.add(
                        vec2(sign * Math.sin(half), -Math.cos(half)).scale(ROPE),
                    );
                    const corner = master.add(vec2(sign * across, 0));
                    const tip = corner.add(vec2(0, -up));
                    const outer = sign < 0 ? "end" : "start";
                    return (
                        <g key={sign}>
                            <Rope from={master} to={anchor} />
                            <Anchor at={anchor} />
                            <Arrow from={master} v={tip.sub(master)} color={COLORS.pull} />
                            <Arrow from={master} v={corner.sub(master)} color={COLORS.sideways} />
                            <Arrow from={corner} v={tip.sub(corner)} color={COLORS.load} />
                            <Tag at={master.lerp(tip, 0.7).add(vec2(0, -16))} color={COLORS.pull}>
                                <tspan fontStyle="italic">T</tspan>
                            </Tag>
                            <Tag
                                at={corner.add(vec2(sign * 6, -up / 2))}
                                color={COLORS.load}
                                anchor={outer}
                            >
                                <tspan fontStyle="italic">y</tspan>
                            </Tag>
                            <Tag
                                at={master.add(vec2(sign * (across / 2), 16))}
                                color={COLORS.sideways}
                            >
                                <tspan fontStyle="italic">x</tspan>
                            </Tag>
                        </g>
                    );
                })}
                <AngleArc center={master} radius={28} startDeg={-90} sweepDeg={60} />
                <Tag at={master.add(vec2(Math.sin(rad(35)), -Math.cos(rad(35))).scale(42))}>
                    <tspan fontStyle="italic">θ</tspan>
                </Tag>
                <Arrow from={master} v={vec2(0, W)} color={COLORS.load} />
                <Tag at={master.add(vec2(10, W - 6))} color={COLORS.load} anchor="start">
                    <tspan fontStyle="italic">W</tspan>
                </Tag>
                <circle cx={master.x} cy={master.y} r={4} fill="currentColor" />
            </svg>
        </Figure>
    );
}

/** Figure 2: two legs from anchors to a master point, with a slider for the angle between them. */
export function TwoLegsFigure() {
    const [angle, setAngle] = useState(60);
    const share = legShare(rad(angle));
    const LEG = 180;
    const W = 60;
    const top = 40;
    const centre = 240;
    const half = rad(angle / 2);
    const master = vec2(centre, top + LEG * Math.cos(half));
    const anchors = [-1, 1].map((side) => vec2(centre + side * LEG * Math.sin(half), top));

    return (
        <Figure
            id="two-legs"
            caption={
                <>
                    <strong className="text-ink-soft">Figure 2.</strong> A load hanging from two
                    anchors, one leg to each. The arrows at the anchors show how hard each leg pulls
                    on its anchor. Each leg holds{" "}
                    <strong className="text-ink">{percent(share)}</strong> of the load: on a{" "}
                    {LOAD_KG} kg load, {ofLoad(share)} in each leg.
                    {angle > 0 && (
                        <>
                            {" "}
                            Each leg also pulls sideways, against the other, with{" "}
                            {percent(share * Math.sin(half))} of the load.
                        </>
                    )}
                </>
            }
        >
            <svg
                viewBox="0 0 480 300"
                className="w-full text-ink-muted"
                fontSize={13}
                role="img"
                aria-labelledby="two-legs-caption"
            >
                <Rock y={top} width={480} />
                {anchors.map((a, i) => (
                    <g key={i}>
                        <Rope from={a} to={master} />
                        <Anchor at={a} />
                    </g>
                ))}
                {angle > 0 && (
                    <>
                        <AngleArc
                            center={master}
                            radius={Math.min(26, (master.y - top) * 0.6)}
                            startDeg={-90 - angle / 2}
                            sweepDeg={angle}
                        />
                        <Tag at={master.add(vec2(-12, 14))} anchor="end">
                            {angle}°
                        </Tag>
                    </>
                )}
                {anchors.map((a, i) => {
                    // Each leg's pull on its anchor, labelled on the anchor's outer side.
                    const v = master
                        .sub(a)
                        .unit()
                        .scale(share * W);
                    return (
                        <g key={i}>
                            <Arrow from={a} v={v} color={COLORS.pull} />
                            <Tag
                                at={a.add(vec2(i === 0 ? -10 : 10, 14))}
                                color={COLORS.pull}
                                anchor={i === 0 ? "end" : "start"}
                            >
                                {percent(share)}
                            </Tag>
                        </g>
                    );
                })}
                <Arrow from={master} v={vec2(0, W)} color={COLORS.load} />
                <Tag at={master.add(vec2(10, W - 6))} color={COLORS.load} anchor="start">
                    Load 100%
                </Tag>
                <circle cx={master.x} cy={master.y} r={4} fill="currentColor" />
            </svg>
            <div className="print:hidden">
                <Slider
                    label="Angle between the legs"
                    value={angle}
                    min={0}
                    max={160}
                    step={1}
                    unit="°"
                    digits={0}
                    onChange={setAngle}
                />
            </div>
        </Figure>
    );
}

/** The article's rig for a main line pulling off to one side: legs 1 m long, 60° apart. */
const RIG: TwoAnchors = { gap: 1, leg: 1 };

/** Figure 3: a pre-equalised anchor, with a slider for how far the main line pulls off to the right. */
export function SwingFigure() {
    const [swing, setSwing] = useState(20);
    const s = preEqualised(RIG, rad(swing));
    const PER_METRE = 140;
    const W = 60;
    const at = (p: Vector2) => vec2(150 + p.x * PER_METRE, 30 - p.y * PER_METRE);
    const master = at(s.master);
    const tied = at(tiedAt(RIG));
    const moved = s.master.distanceTo(tiedAt(RIG));
    const d = swungDown(rad(swing));

    return (
        <Figure
            id="swing"
            caption={
                <>
                    <strong className="text-ink-soft">Figure 3.</strong> A pre-equalised anchor: two
                    anchors 1 m apart, each with a 1 m leg, so the legs are 60° apart. The main line
                    pulls {swing}° off straight down, to the right. The arrows at the anchors show
                    how hard each is pulled, as a share of the load: the left anchor takes{" "}
                    <strong className="text-ink">{percent(s.shares[0])}</strong> and the right{" "}
                    <strong className="text-ink">{percent(s.shares[1])}</strong>.
                    {moved > 0.005 && (
                        <>
                            {" "}
                            The master point has swung {Math.round(moved * 100)} cm from the cross.
                        </>
                    )}{" "}
                    The cross marks where the master point sits with the main line straight down.
                </>
            }
        >
            <svg
                viewBox="0 0 300 220"
                className="mx-auto w-full max-w-md text-ink-muted"
                fontSize={13}
                role="img"
                aria-labelledby="swing-caption"
            >
                <Rock y={30} width={300} />
                <path
                    d={`M ${tied.x - 5} ${tied.y - 5} l 10 10 m 0 -10 l -10 10`}
                    stroke="currentColor"
                    strokeWidth={1.5}
                    opacity={0.6}
                />
                {s.anchors.map((a, i) => {
                    const anchor = at(a);
                    if (s.shares[i] > 0) return <Rope key={i} from={anchor} to={master} />;
                    // A slack leg sags below the line between its ends, by about as much as its slack allows.
                    const span = a.distanceTo(s.master);
                    const sag = Math.sqrt((3 * span * Math.max(0, RIG.leg - span)) / 8);
                    const mid = anchor
                        .add(master)
                        .scale(0.5)
                        .add(vec2(0, 2 * sag * PER_METRE));
                    return (
                        <path
                            key={i}
                            d={`M ${anchor.x} ${anchor.y} Q ${mid.x} ${mid.y} ${master.x} ${master.y}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            opacity={0.5}
                        />
                    );
                })}
                {s.anchors.map((a, i) => (
                    <Anchor key={i} at={at(a)} />
                ))}
                {s.anchors.map((a, i) => {
                    // Each anchor's pull, drawn at the anchor, labelled on its outer side.
                    const anchor = at(a);
                    const label = anchor.add(vec2(i === 0 ? -10 : 10, 14));
                    const side = i === 0 ? "end" : "start";
                    if (s.shares[i] === 0)
                        return (
                            <Tag key={i} at={label} color={COLORS.pull} anchor={side}>
                                slack
                            </Tag>
                        );
                    const v = master
                        .sub(anchor)
                        .unit()
                        .scale(s.shares[i] * W);
                    return (
                        <g key={i}>
                            <Arrow from={anchor} v={v} color={COLORS.pull} />
                            <Tag at={label} color={COLORS.pull} anchor={side}>
                                {percent(s.shares[i])}
                            </Tag>
                        </g>
                    );
                })}
                <Arrow from={master} v={vec2(d.x, -d.y).scale(W)} color={COLORS.load} />
                {/* Beside the arrow, on its lower left, so it stays in the drawing with the main line straight down. */}
                <Tag
                    at={master.add(vec2(d.x, -d.y).scale(W * 0.7)).add(vec2(d.y, d.x).scale(10))}
                    color={COLORS.load}
                    anchor="end"
                >
                    Main line
                </Tag>
                <circle cx={master.x} cy={master.y} r={4} fill="currentColor" />
            </svg>
            <div className="print:hidden">
                <Slider
                    label="Main line pulls to the right"
                    value={swing}
                    min={0}
                    max={60}
                    step={1}
                    unit="°"
                    digits={0}
                    onChange={setSwing}
                />
            </div>
        </Figure>
    );
}

/** Figure 4: a rope turning round a karabiner on a redirect, with a slider for the angle between its two parts. */
export function RedirectFigure() {
    const [angle, setAngle] = useState(90);
    const share = redirectShare(rad(angle));
    const T = 50;
    const k = vec2(200, 130);
    const toLoad = vec2(0, 1);
    const toHaul = vec2(Math.sin(rad(angle)), Math.cos(rad(angle)));
    const pull = toLoad.add(toHaul);
    // The redirect's sling lines up with the rope's pull on it.
    const back = pull.len() > 1e-9 ? pull.unit().neg() : vec2(-1, 0);
    const anchor = k.add(back.scale(80));
    // Each part leaves the karabiner on its own side, so they don't overlap when the rope doubles back.
    // (Doubled back, neither leans away from the other, so the load's part goes one way and the team's the other.)
    const offset = (e: Vector2, other: Vector2, doubled: number) => {
        const p = e.perp();
        const lean = p.dot(other);
        return p.scale(lean > 1e-9 ? -5 : lean < -1e-9 ? 5 : doubled);
    };
    const loadStart = k.add(offset(toLoad, toHaul, 5));
    const haulStart = k.add(offset(toHaul, toLoad, -5));
    const loadEnd = vec2(loadStart.x, 262);
    const haulEnd = haulStart.add(toHaul.scale(90));

    return (
        <Figure
            id="redirect"
            caption={
                <>
                    <strong className="text-ink-soft">Figure 4.</strong> A rope holding a{" "}
                    {LOAD_KG / 2} kg load turns round a karabiner on a redirect, with its two parts{" "}
                    {angle}° apart. Each part pulls on the karabiner with the rope’s tension. The
                    dashed arrow is the two together: the redirect holds{" "}
                    <strong className="text-ink">{percent(share)}</strong> of the rope’s tension,{" "}
                    {ofLoad(share, LOAD_KG / 2)}.
                </>
            }
        >
            <svg
                viewBox="70 20 340 280"
                className="w-full text-ink-muted"
                fontSize={13}
                role="img"
                aria-labelledby="redirect-caption"
            >
                <Rope from={anchor} to={k} />
                <Anchor at={anchor} />
                <Tag at={anchor.add(back.scale(16))}>Anchor</Tag>
                <Rope from={loadStart} to={loadEnd} />
                <Rope from={haulStart} to={haulEnd} />
                <rect x={loadEnd.x - 14} y={loadEnd.y} width={28} height={28} fill="currentColor" />
                <Tag at={vec2(loadEnd.x - 22, loadEnd.y + 14)} anchor="end">
                    Load
                </Tag>
                <Tag at={haulEnd.add(vec2(10, 0))} anchor="start">
                    To the team
                </Tag>
                <circle
                    cx={k.x}
                    cy={k.y}
                    r={7}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                />
                <Arrow from={k} v={toLoad.scale(T)} color={COLORS.pull} />
                <Arrow from={k} v={toHaul.scale(T)} color={COLORS.pull} />
                {share > 0.05 && (
                    <>
                        <Arrow from={k} v={pull.scale(T)} color={COLORS.redirect} dashed />
                        <Tag
                            at={k.add(pull.scale(T)).add(pull.unit().scale(16))}
                            color={COLORS.redirect}
                        >
                            {percent(share)}
                        </Tag>
                    </>
                )}
            </svg>
            <div className="print:hidden">
                <Slider
                    label="Angle between the rope’s two parts"
                    value={angle}
                    min={0}
                    max={170}
                    step={1}
                    unit="°"
                    digits={0}
                    onChange={setAngle}
                />
            </div>
        </Figure>
    );
}

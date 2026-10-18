"use client";

import { useState } from "react";

import {
    legShare,
    preEqualised,
    redirectShare,
    swungDown,
    type TwoAnchors,
} from "@/articles/gentle-introduction";
import { Anchor, COLORS, Rock, Rope, Tag } from "@/articles/gentle-introduction-figures";
import { SystemDrawing, T } from "@/articles/pulley-figures";
import {
    loadPerMetre,
    pullsOf,
    REDIRECT,
    SIX_TO_ONE,
    TWO_TO_ONE,
    Z_RIG,
    type PulleySystem,
} from "@/articles/pulley-systems";
import { Slider } from "@/components/diagram/controls";
import { AngleArc, Arrow } from "@/components/diagram/svg";
import { G } from "@/lib/constants";
import { rad } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";

import { Layout, Readout, SVG } from "./frame";

/*
 * The figures in A Visual Introduction to Rescue Physics, drawn to fill a phone held upright: a drawing that grows to
 * the space it has, one slider, and a big number or two that change as the slider moves. The maths is shared with
 * A Gentle Introduction's figures.
 */

/** The load used to turn shares into kilograms. */
const LOAD_KG = 200;

const percent = (share: number) => `${Math.round(share * 100)}%`;
const kN = (kg: number) => `${((kg * G) / 1000).toFixed(1)} kN`;

/** A load hanging on a rope, its weight drawn to scale. */
export function WeightFigure() {
    const [mass, setMass] = useState(100);
    const side = 18 + Math.sqrt(mass) * 3;
    const top = 40;
    const box = vec2(150, 110);
    const arrow = mass * 0.55;
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 0 300 330"
                    className={SVG}
                    fontSize={16}
                    role="img"
                    aria-label="A load hanging on a rope, with its weight as an arrow"
                >
                    <Rock y={top} width={300} />
                    <Rope from={vec2(box.x, top)} to={box} />
                    <Anchor at={vec2(box.x, top)} />
                    <rect
                        x={box.x - side / 2}
                        y={box.y}
                        width={side}
                        height={side}
                        rx={3}
                        fill="currentColor"
                    />
                    <Arrow
                        from={box.add(vec2(0, side / 2))}
                        v={vec2(0, side / 2 + arrow)}
                        color={COLORS.load}
                    />
                    <Tag
                        at={box.add(vec2(side / 2 + 10, side / 2 + arrow / 2 + 10))}
                        color={COLORS.load}
                        anchor="start"
                    >
                        Weight
                    </Tag>
                </svg>
            }
            slider={
                <Slider
                    label="Mass"
                    value={mass}
                    min={10}
                    max={300}
                    step={5}
                    unit="kg"
                    digits={0}
                    onChange={setMass}
                />
            }
            readouts={
                <>
                    <Readout label="mass" value={`${mass} kg`} />
                    <Readout label="weight" value={kN(mass)} color={COLORS.load} />
                </>
            }
        />
    );
}

/** A load on a rope, pulled sideways by a level tag line until the rope leans. */
export function TagLineFigure() {
    const [lean, setLean] = useState(30);
    const a = rad(lean);
    const W = 56;
    const anchor = vec2(80, 40);
    const load = anchor.add(vec2(Math.sin(a), Math.cos(a)).scale(150));
    const rope = 1 / Math.cos(a);
    const tag = Math.tan(a);
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 0 320 300"
                    className={SVG}
                    fontSize={16}
                    role="img"
                    aria-label="A load on a rope pulled sideways by a tag line"
                >
                    <Rock y={40} width={320} />
                    <Rope from={anchor} to={load} />
                    <Rope from={load} to={vec2(load.x + 90, load.y)} dashed />
                    <Anchor at={anchor} />
                    <rect x={load.x - 12} y={load.y} width={24} height={24} fill="currentColor" />
                    <Arrow from={load.add(vec2(0, 12))} v={vec2(0, W)} color={COLORS.load} />
                    <Arrow
                        from={load}
                        v={anchor
                            .sub(load)
                            .unit()
                            .scale(W * rope)}
                        color={COLORS.pull}
                    />
                    <Arrow
                        from={load.add(vec2(12, 12))}
                        v={vec2(W * tag, 0)}
                        color={COLORS.sideways}
                    />
                    <Tag at={load.add(vec2(-10, 12 + W))} color={COLORS.load} anchor="end">
                        Weight
                    </Tag>
                    {lean > 0 && (
                        <AngleArc
                            center={anchor}
                            radius={34}
                            startDeg={90 - lean}
                            sweepDeg={lean}
                        />
                    )}
                </svg>
            }
            slider={
                <Slider
                    label="Tag line pulls the rope over"
                    value={lean}
                    min={0}
                    max={60}
                    step={1}
                    unit="°"
                    digits={0}
                    onChange={setLean}
                />
            }
            readouts={
                <>
                    <Readout
                        label="rope, of the load’s weight"
                        value={percent(rope)}
                        color={COLORS.pull}
                    />
                    <Readout label="tag line" value={percent(tag)} color={COLORS.sideways} />
                </>
            }
        />
    );
}

/** Two legs from two anchors to a master point, with the angle between them on the slider. */
export function TwoLegsFigure() {
    const [angle, setAngle] = useState(60);
    const share = legShare(rad(angle));
    const LEG = 140;
    const W = 64;
    const top = 40;
    const half = rad(angle / 2);
    const master = vec2(150, top + LEG * Math.cos(half));
    const anchors = [-1, 1].map((s) => vec2(150 + s * LEG * Math.sin(half), top));
    const over = share > 1.0001;
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 0 300 260"
                    className={SVG}
                    fontSize={16}
                    role="img"
                    aria-label="Two anchor legs sharing a load"
                >
                    <Rock y={top} width={300} />
                    {anchors.map((a, i) => (
                        <g key={i}>
                            <Rope from={a} to={master} />
                            <Anchor at={a} />
                            <Arrow
                                from={a}
                                v={master
                                    .sub(a)
                                    .unit()
                                    .scale(share * W)}
                                color={COLORS.pull}
                            />
                        </g>
                    ))}
                    {angle > 0 && (
                        <AngleArc
                            center={master}
                            radius={Math.min(24, (master.y - top) * 0.6)}
                            startDeg={-90 - angle / 2}
                            sweepDeg={angle}
                        />
                    )}
                    <Arrow from={master} v={vec2(0, W)} color={COLORS.load} />
                    <circle cx={master.x} cy={master.y} r={4} fill="currentColor" />
                </svg>
            }
            slider={
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
            }
            readouts={
                <>
                    <Readout
                        label="each leg holds, of the load"
                        value={percent(share)}
                        color={over ? "#fda4af" : COLORS.pull}
                    />
                    <Readout
                        label={`each leg, on a ${LOAD_KG} kg load`}
                        value={`${Math.round(share * LOAD_KG)} kg`}
                    />
                </>
            }
        />
    );
}

/** The article's rig for a main line pulling off to one side: legs 1 m long, 60° apart. */
const RIG: TwoAnchors = { gap: 1, leg: 1 };

/** A pre-equalised anchor with the main line pulled off to the right. */
export function SideLoadFigure() {
    const [swing, setSwing] = useState(20);
    const s = preEqualised(RIG, rad(swing));
    const PER_METRE = 190;
    const W = 64;
    const at = (p: Vector2) => vec2(150 + p.x * PER_METRE, 40 - p.y * PER_METRE);
    const master = at(s.master);
    const d = swungDown(rad(swing));
    return (
        <Layout
            drawing={
                <svg
                    viewBox="0 0 300 290"
                    className={SVG}
                    fontSize={16}
                    role="img"
                    aria-label="A pre-equalised anchor with the main line pulled to one side"
                >
                    <Rock y={40} width={300} />
                    {s.anchors.map((a, i) => (
                        <g key={i}>
                            <Rope from={at(a)} to={master} dashed={s.shares[i] === 0} />
                            <Anchor at={at(a)} />
                            {s.shares[i] > 0 && (
                                <Arrow
                                    from={at(a)}
                                    v={master
                                        .sub(at(a))
                                        .unit()
                                        .scale(s.shares[i] * W)}
                                    color={COLORS.pull}
                                />
                            )}
                        </g>
                    ))}
                    <Arrow from={master} v={vec2(d.x, -d.y).scale(W)} color={COLORS.load} />
                    <circle cx={master.x} cy={master.y} r={4} fill="currentColor" />
                </svg>
            }
            slider={
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
            }
            readouts={
                <>
                    <Readout label="left anchor" value={percent(s.shares[0])} color={COLORS.pull} />
                    <Readout
                        label="right anchor"
                        value={s.shares[1] > 0 ? percent(s.shares[1]) : "slack"}
                        color={COLORS.pull}
                    />
                </>
            }
        />
    );
}

/** A rope turning round a karabiner on a redirect. */
export function RedirectFigure() {
    const [angle, setAngle] = useState(90);
    const share = redirectShare(rad(angle));
    const T_ = 56;
    const k = vec2(140, 120);
    const toLoad = vec2(0, 1);
    const toTeam = vec2(Math.sin(rad(angle)), Math.cos(rad(angle)));
    const pull = toLoad.add(toTeam);
    const back = pull.len() > 1e-9 ? pull.unit().neg() : vec2(-1, 0);
    const anchor = k.add(back.scale(70));
    // Doubled back, the two parts sit side by side rather than on top of each other.
    const gap = (e: Vector2, other: Vector2, doubled: number) => {
        const p = e.perp();
        const lean = p.dot(other);
        return p.scale(lean > 1e-9 ? -5 : lean < -1e-9 ? 5 : doubled);
    };
    const loadStart = k.add(gap(toLoad, toTeam, 5));
    const teamStart = k.add(gap(toTeam, toLoad, -5));
    return (
        <Layout
            drawing={
                <svg
                    viewBox="20 10 280 270"
                    className={SVG}
                    fontSize={16}
                    role="img"
                    aria-label="A rope turning round a redirect"
                >
                    <Rope from={anchor} to={k} />
                    <Anchor at={anchor} />
                    <Rope from={loadStart} to={vec2(loadStart.x, 240)} />
                    <Rope from={teamStart} to={teamStart.add(toTeam.scale(110))} />
                    <rect x={loadStart.x - 14} y={240} width={28} height={28} fill="currentColor" />
                    <circle
                        cx={k.x}
                        cy={k.y}
                        r={7}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                    />
                    <Arrow from={k} v={toLoad.scale(T_)} color={COLORS.pull} />
                    <Arrow from={k} v={toTeam.scale(T_)} color={COLORS.pull} />
                    {share > 0.05 && (
                        <Arrow from={k} v={pull.scale(T_)} color={COLORS.redirect} dashed />
                    )}
                </svg>
            }
            slider={
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
            }
            readouts={
                <>
                    <Readout
                        label="redirect holds, of the rope’s pull"
                        value={percent(share)}
                        color={COLORS.redirect}
                    />
                </>
            }
        />
    );
}

/** A pulley system standing upright, with a slider for rope pulled in. */
function Haul(props: { sys: PulleySystem; max: number; sling?: (id: string) => boolean }) {
    const [pulled, setPulled] = useState(0);
    const advantage = pullsOf(props.sys).advantage;
    const kg = (share: number) => `${Math.round(share * LOAD_KG)} kg`;
    return (
        <Layout
            drawing={
                <SystemDrawing
                    sys={props.sys}
                    pulled={pulled}
                    upright
                    className={SVG}
                    labels={{
                        part: (_, t) => kg(t / advantage),
                        sling: (id, pull) =>
                            (props.sling?.(id) ?? true) ? kg(pull / advantage) : null,
                    }}
                />
            }
            slider={
                <Slider
                    label="Rope pulled in"
                    value={pulled}
                    min={0}
                    max={props.max}
                    step={0.1}
                    unit="m"
                    digits={1}
                    onChange={setPulled}
                />
            }
            readouts={
                <>
                    <Readout
                        label={`team pulls, for ${LOAD_KG} kg`}
                        value={kg(1 / advantage)}
                        color={COLORS.pull}
                    />
                    <Readout
                        label="load has moved"
                        value={`${(pulled * loadPerMetre(props.sys)).toFixed(1)} m`}
                        color={COLORS.load}
                    />
                </>
            }
        />
    );
}

export const RedirectHaulFigure = () => <Haul sys={REDIRECT} max={2.4} />;
export const TwoToOneFigure = () => <Haul sys={TWO_TO_ONE} max={6} sling={() => false} />;
export const ZRigFigure = () => <Haul sys={Z_RIG} max={5} />;
export const SixToOneFigure = () => <Haul sys={SIX_TO_ONE} max={3.6} />;

/** The T method, one step at a time; each step's labels in amber as they appear. */
function TSteps(props: { sys: PulleySystem; steps: { text: string; show: string[] }[] }) {
    const [step, setStep] = useState(1);
    const shown = new Set(props.steps.slice(0, step).flatMap((s) => s.show));
    const latest = new Set(props.steps[step - 1].show);
    const label = (key: string, t: number) => (shown.has(key) ? <T t={t} /> : null);
    return (
        <Layout
            drawing={
                <SystemDrawing
                    sys={props.sys}
                    pulled={0}
                    upright
                    className={SVG}
                    labels={{
                        part: label,
                        sling: label,
                        color: (key) => (latest.has(key) ? COLORS.load : COLORS.pull),
                    }}
                />
            }
            slider={
                <Slider
                    label="Step"
                    value={step}
                    min={1}
                    max={props.steps.length}
                    step={1}
                    digits={0}
                    onChange={setStep}
                />
            }
            readouts={
                <p className="min-h-12 flex-1 text-center text-sm text-slate-200">
                    {props.steps[step - 1].text}
                </p>
            }
        />
    );
}

export const ZRigTMethodFigure = () => (
    <TSteps
        sys={Z_RIG}
        steps={[
            { text: "The team pulls the haul line: 1T.", show: ["0.2"] },
            {
                text: "Round the pulleys, the rope keeps its 1T, up to the rope grab.",
                show: ["0.1", "0.0"],
            },
            { text: "Two 1T parts pull the travelling pulley: 2T.", show: ["p2"] },
            {
                text: "The grab adds 2T to the main line’s 1T: 3T on the load. It’s a 3:1.",
                show: ["0.0.g1"],
            },
            { text: "The anchor pulley holds its two parts: 2T.", show: ["p1"] },
        ]}
    />
);

export const SixToOneTMethodFigure = () => (
    <TSteps
        sys={SIX_TO_ONE}
        steps={[
            { text: "The team pulls: 1T.", show: ["1.1"] },
            { text: "The 2:1’s rope keeps 1T all along.", show: ["1.0"] },
            { text: "Its pulley pulls the Z-rig’s grab with 2T.", show: ["m2"] },
            { text: "So the Z-rig’s whole rope carries 2T.", show: ["0.2", "0.1", "0.0"] },
            { text: "Two 2T parts pull the travelling pulley: 4T.", show: ["p2"] },
            { text: "4T + 2T = 6T on the load. It’s a 6:1.", show: ["0.0.g1"] },
        ]}
    />
);

export function FrictionFigure() {
    const [efficiency, setEfficiency] = useState(90);
    const e = efficiency / 100;
    const advantage = pullsOf(Z_RIG, e).advantage;
    return (
        <Layout
            drawing={
                <SystemDrawing
                    sys={Z_RIG}
                    pulled={0}
                    efficiency={e}
                    upright
                    className={SVG}
                    labels={{ part: (_, t) => <T t={t} />, sling: (_, t) => <T t={t} /> }}
                />
            }
            slider={
                <Slider
                    label="Each pulley passes on"
                    value={efficiency}
                    min={40}
                    max={100}
                    step={1}
                    unit="%"
                    digits={0}
                    onChange={setEfficiency}
                />
            }
            readouts={
                <>
                    <Readout
                        label="advantage"
                        value={`${advantage.toFixed(1)}:1`}
                        color={COLORS.load}
                    />
                    <Readout
                        label={`team pulls, for ${LOAD_KG} kg`}
                        value={`${Math.round(LOAD_KG / advantage)} kg`}
                        color={COLORS.pull}
                    />
                </>
            }
        />
    );
}

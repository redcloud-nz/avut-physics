"use client";

import { useState } from "react";

import { Slider } from "@/components/diagram/controls";
import { Arrow } from "@/components/diagram/svg";
import { vec2, Vector2 } from "@/lib/vector2";

import { COLORS, Figure, Tag } from "./gentle-introduction-figures";
import {
    hauled,
    loadPerMetre,
    pullsOf,
    REDIRECT,
    SIX_TO_ONE,
    TWO_TO_ONE,
    Z_RIG,
    type Positions,
    type PulleySystem,
} from "./pulley-systems";

/*
 * The figures in Part 2 of A Gentle Introduction to Rescue Physics: pulley systems laid out flat, as seen from above,
 * with the anchor on the left and the load off to the right. Each rope part is labelled with its tension. Slide the
 * rope in and the marks on it show how far each part moves.
 */

/** The load used to turn the team's pull into kilograms. */
const LOAD_KG = 200;
/** Drawing units per metre, and where the anchor is. */
const PER_METRE = 100;
const ANCHOR_X = 60;
const WIDTH = 520;
/** A pulley's radius: half the gap between rope parts. */
const R = 14;
/** Rope marks, every half metre along the rope. */
const MARKS = 0.5;
const GRAB_COLOR = "var(--grab)";

const px = (x: number) => ANCHOR_X + x * PER_METRE;
const kgOf = (share: number) => `${Math.round(share * LOAD_KG)} kg`;

/** A pull in units of the team's pull, T: whole numbers as they are, others to two places. */
export function T(props: { t: number }) {
    const t = Math.abs(props.t);
    const text = Math.abs(t - Math.round(t)) < 0.005 ? String(Math.round(t)) : t.toFixed(2);
    return (
        <>
            {text}
            <tspan fontStyle="italic">T</tspan>
        </>
    );
}

export type Labels = {
    /** A rope part's label, by its key: `rope.part`, or `rope.part.grab` for the part between a grab and its body. */
    part?: (key: string, tension: number) => React.ReactNode;
    /** A pulley's sling's label, by the pulley's id. */
    sling?: (id: string, pull: number) => React.ReactNode;
    /** The colour of a label, by its key. */
    color?: (key: string) => string;
};

/** Where each part of a rope runs, in drawing units, and where its haul end or loose tail leaves the drawing. */
function partsOf(sys: PulleySystem, at: Positions, r: number) {
    const rope = sys.ropes[r];
    const n = rope.path.length;
    return rope.path.slice(1).map((id, i) => {
        const fromId = rope.path[i];
        const y = rope.lanes[i];
        const end = (k: string) => {
            const b = sys.bodies[k];
            if (b.kind === "anchor") return ANCHOR_X;
            if (b.kind === "haul") return at[k] < at[fromId] ? 0 : WIDTH;
            return px(at[k]);
        };
        let to = end(id);
        const last = i === n - 2;
        // A rope ending at a free grab carries on past it as a loose tail.
        const tail = last && sys.bodies[id].kind === "grab";
        if (tail) to += Math.sign(to - end(fromId)) * 36;
        return { from: fromId, to: id, a: vec2(end(fromId), y), b: vec2(to, y), tail };
    });
}

/**
 * Upright drawings spread the rope parts this many times further apart, squash their length to fit a phone screen,
 * and leave room at the sides and ends for labels.
 */
const SPREAD = 1.9;
const ALONG = 0.5;
const UP_PAD = 70;
const UP_END = 30;

/** A pulley system as it sits after `pulled` metres of rope has come in, across the page or upright. */
export function SystemDrawing(props: {
    sys: PulleySystem;
    pulled: number;
    efficiency?: number;
    labels: Labels;
    labelledBy?: string;
    upright?: boolean;
    /** What the haul end's arrow says. */
    haulLabel?: string;
    /** Upright, how much to stretch the drawing along the ropes, for a system that's wide for its height. */
    stretch?: number;
    className?: string;
}) {
    const { sys } = props;
    const at = hauled(sys, props.pulled);
    const pulls = pullsOf(sys, props.efficiency ?? 1);
    const lanes = sys.ropes.flatMap((r) => r.lanes);
    const height = Math.max(...lanes) + 30;
    const color = (key: string) => props.labels.color?.(key) ?? COLORS.pull;

    // Each pulley's centre, and which side the rope wraps round.
    const pulleys: { id: string; c: Vector2; right: boolean }[] = [];
    sys.ropes.forEach((rope) =>
        rope.path.slice(1, -1).forEach((id, j) => {
            const i = j + 1;
            const y = (rope.lanes[i - 1] + rope.lanes[i]) / 2;
            const right = at[rope.path[i - 1]] < at[id] && at[rope.path[i + 1]] < at[id];
            pulleys.push({ id, c: vec2(px(at[id]), y), right });
        }),
    );
    const centreOf = (id: string) => pulleys.find((p) => p.id === id)?.c;

    // The load's box, centred on what's tied or clipped to it.
    const loadId = Object.keys(sys.bodies).find((k) => sys.bodies[k].kind === "load")!;
    const onLoad = [
        ...sys.ropes.flatMap((rope) =>
            rope.path.flatMap((id, i) =>
                id === loadId ? [rope.lanes[Math.min(i, rope.lanes.length - 1)]] : [],
            ),
        ),
        ...Object.entries(sys.bodies).flatMap(([id, b]) =>
            (b.kind === "pulley" || b.kind === "grab") && b.on === loadId
                ? [b.kind === "grab" ? b.y : centreOf(id)!.y]
                : [],
        ),
    ];
    const load = vec2(px(at[loadId]), (Math.min(...onLoad) + Math.max(...onLoad)) / 2);
    // Wide enough to reach everything on it.
    const loadHalf = Math.max(20, (Math.max(...onLoad) - Math.min(...onLoad)) / 2 + 14);

    // Slings: fixed pulleys to the anchor, others to what they're clipped to.
    const slings: { id: string; a: Vector2; b: Vector2 }[] = [];
    const bolts: Vector2[] = [];
    for (const p of pulleys) {
        const body = sys.bodies[p.id];
        if (body.kind !== "pulley") continue;
        if (body.fixed) {
            slings.push({ id: p.id, a: p.c, b: vec2(ANCHOR_X, p.c.y) });
            bolts.push(vec2(ANCHOR_X, p.c.y));
        } else if (body.on) {
            const host = sys.bodies[body.on];
            const b = host.kind === "grab" ? vec2(px(at[body.on]), host.y) : vec2(load.x, p.c.y);
            slings.push({ id: p.id, a: p.c, b });
        }
    }
    sys.ropes.forEach((rope) => {
        if (rope.path[0] === "anchor") bolts.push(vec2(ANCHOR_X, rope.lanes[0]));
    });

    const grabs = Object.entries(sys.bodies).flatMap(([id, b]) =>
        b.kind === "grab" ? [{ id, at: vec2(px(at[id]), b.y), on: b.on }] : [],
    );

    // Rope parts, split where a grab rides on them: between the grab and its body, the part carries the grab's pull too.
    const ropes = sys.ropes.map((_, r) => partsOf(sys, at, r));
    const labels: { key: string; at: Vector2; tension: number; room: number }[] = [];
    ropes.forEach((parts, r) =>
        parts.forEach((part, i) => {
            const tension = pulls.tensions[r][i];
            const lo = Math.min(part.a.x, part.b.x);
            const hi = Math.max(part.a.x, part.b.x);
            const grab = grabs.find(
                (g) => g.on && g.at.y === part.a.y && g.at.x > lo && g.at.x < hi,
            );
            const mid = (x1: number, x2: number) => ({
                at: vec2((x1 + x2) / 2, part.a.y - 10),
                room: Math.abs(x2 - x1),
            });
            if (!grab) {
                labels.push({ key: `${r}.${i}`, ...mid(part.a.x, part.b.x), tension });
                return;
            }
            const hostEnd = [part.from, part.to].includes(grab.on!)
                ? part.from === grab.on
                    ? part.a.x
                    : part.b.x
                : part.a.x;
            const farEnd = hostEnd === part.a.x ? part.b.x : part.a.x;
            // The grab balances: the far part pulls it one way, the host's part and its pulleys the other.
            const away = Math.sign(farEnd - grab.at.x);
            labels.push({ key: `${r}.${i}`, ...mid(grab.at.x, farEnd), tension });
            labels.push({
                key: `${r}.${i}.${grab.id}`,
                ...mid(grab.at.x, hostEnd),
                tension: tension + pulls.pull[grab.id] * away,
            });
        }),
    );

    // Marks along each rope, every half metre from its first end, so they move as the rope does.
    const marks = ropes.flatMap((parts) => {
        let start = 0;
        return parts.flatMap((part) => {
            const length = Math.abs(part.b.x - part.a.x) / PER_METRE;
            const dir = Math.sign(part.b.x - part.a.x);
            const out: Vector2[] = [];
            for (let m = Math.ceil(start / MARKS) * MARKS; m < start + length; m += MARKS) {
                if (m - start < 0.05 || start + length - m < 0.05) continue;
                out.push(vec2(part.a.x + dir * (m - start) * PER_METRE, part.a.y));
            }
            start += length;
            return out;
        });
    });

    const haulPart = ropes
        .flatMap((parts) => parts)
        .find((part) => sys.bodies[part.to].kind === "haul")!;
    const haulDir = Math.sign(haulPart.b.x - haulPart.a.x);
    const haulTip = haulPart.b.add(vec2(-haulDir * 8, 0));

    // Everything above is laid out across the page. Upright, it's turned a quarter turn: the anchor and the team at
    // the top, the load hanging below, and the rope parts spread further apart to leave room for their labels.
    const laneMin = Math.min(...lanes) - R;
    const laneMax = Math.max(...lanes) + R;
    const up = props.upright;
    const along = ALONG * (props.stretch ?? 1);
    const P = (p: Vector2) =>
        up ? vec2(UP_PAD + (laneMax - p.y) * SPREAD, UP_END + p.x * along) : p;
    const V = (v: Vector2) => (up ? vec2(-v.y * SPREAD, v.x * along) : v);
    const r = up ? R * SPREAD : R;
    const viewBox = up
        ? `0 0 ${(laneMax - laneMin) * SPREAD + 2 * UP_PAD} ${WIDTH * along + 2 * UP_END}`
        : `0 0 ${WIDTH} ${height}`;
    const line = (a: Vector2, b: Vector2) => {
        const [p, q] = [P(a), P(b)];
        return { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
    };
    const box = [P(vec2(load.x, load.y - loadHalf)), P(vec2(load.x + 26, load.y + loadHalf))];
    // One anchor: a bar joining its bolts, if there's more than one, and one tag.
    const boltLanes = bolts.map((b) => b.y);
    const anchorEnds = [Math.min(...boltLanes), Math.max(...boltLanes)].map((y) =>
        vec2(ANCHOR_X, y),
    );
    const anchorMid = anchorEnds[0].add(anchorEnds[1]).scale(0.5);

    return (
        <svg
            viewBox={viewBox}
            className={props.className ?? "w-full text-ink-muted"}
            fontSize={15}
            role="img"
            aria-labelledby={props.labelledBy}
            aria-label={props.labelledBy ? undefined : "A pulley system"}
        >
            {slings.map((s) => (
                <line
                    key={s.id}
                    {...line(s.a, s.b)}
                    stroke="currentColor"
                    strokeWidth={3}
                    opacity={0.5}
                />
            ))}
            {bolts.length > 1 && (
                <line
                    {...line(anchorEnds[0], anchorEnds[1])}
                    stroke="currentColor"
                    strokeWidth={4}
                />
            )}
            {bolts.map((b, i) => (
                <circle key={i} cx={P(b).x} cy={P(b).y} r={5} fill="currentColor" />
            ))}
            <Tag
                at={up ? P(anchorMid).add(vec2(0, -16)) : anchorMid.add(vec2(-10, 0))}
                anchor={up ? "middle" : "end"}
            >
                Anchor
            </Tag>

            {ropes.flatMap((parts, i) =>
                parts.map((part, j) => (
                    <line
                        key={`${i}.${j}`}
                        {...line(part.a, part.b)}
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeDasharray={part.tail ? "4 4" : undefined}
                        opacity={part.tail ? 0.5 : 0.8}
                    />
                )),
            )}
            {marks.map((m, i) => (
                <line
                    key={i}
                    {...line(
                        m.add(vec2(0, -4 / (up ? SPREAD : 1))),
                        m.add(vec2(0, 4 / (up ? SPREAD : 1))),
                    )}
                    stroke="currentColor"
                    strokeWidth={2}
                    opacity={0.6}
                />
            ))}

            {pulleys.map((p) => {
                const c = P(p.c);
                const top = P(p.c.add(vec2(0, -R)));
                const bottom = P(p.c.add(vec2(0, R)));
                return (
                    <g key={p.id}>
                        <circle
                            cx={c.x}
                            cy={c.y}
                            r={r - 1}
                            className="fill-background print:fill-white"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            opacity={0.9}
                        />
                        <path
                            d={`M ${top.x} ${top.y} A ${r} ${r} 0 0 ${p.right ? 1 : 0} ${bottom.x} ${bottom.y}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            opacity={0.8}
                        />
                        <circle cx={c.x} cy={c.y} r={2.5} fill="currentColor" />
                    </g>
                );
            })}
            {grabs.map((g) => (
                <rect
                    key={g.id}
                    x={P(g.at).x - 6}
                    y={P(g.at).y - 5}
                    width={12}
                    height={10}
                    rx={2}
                    fill={GRAB_COLOR}
                />
            ))}

            <rect
                x={Math.min(box[0].x, box[1].x)}
                y={Math.min(box[0].y, box[1].y)}
                width={Math.abs(box[1].x - box[0].x)}
                height={Math.abs(box[1].y - box[0].y)}
                fill="currentColor"
            />
            <Arrow from={P(vec2(load.x + 30, load.y))} v={V(vec2(28, 0))} color={COLORS.load} />
            <Tag
                at={
                    up
                        ? P(vec2(load.x + 13, load.y)).add(
                              vec2(Math.abs(box[1].x - box[0].x) / 2 + 8, 0),
                          )
                        : vec2(load.x + 13, load.y - 30)
                }
                anchor={up ? "start" : "middle"}
            >
                Load
            </Tag>
            <Arrow
                from={P(haulTip.add(vec2(-haulDir * 34, 0)))}
                v={V(vec2(haulDir * 34, 0))}
                color={COLORS.pull}
            />
            {/* Upright, the label goes to the left of the haul end's rope, clear of the parts beside it. */}
            <Tag
                at={up ? P(haulTip).add(vec2(-10, haulDir > 0 ? -6 : 6)) : haulTip.add(vec2(0, 16))}
                color={COLORS.pull}
                anchor={up ? "end" : haulDir < 0 ? "start" : "end"}
            >
                {props.haulLabel ?? "Team pulls"}
            </Tag>

            {props.labels.sling &&
                slings.map((s) => {
                    const label = props.labels.sling!(s.id, Math.abs(pulls.pull[s.id]));
                    if (!label) return null;
                    const level = Math.abs(s.a.y - s.b.y) < 1;
                    const mid = P(s.a.add(s.b).scale(0.5));
                    // Upright, a travelling pulley's label goes beside it, past the rope on its far side.
                    const at = level ? mid : up ? P(s.a).add(vec2(r + 8, 0)) : mid.add(vec2(8, 0));
                    return (
                        <Tag
                            key={s.id}
                            at={at}
                            color={color(s.id)}
                            anchor={level ? "middle" : "start"}
                        >
                            <tspan fontSize={14}>{label}</tspan>
                        </Tag>
                    );
                })}
            {props.labels.part &&
                labels.map((l) => {
                    const label = props.labels.part!(l.key, l.tension);
                    // A part too short for its label goes without, as the Z-rig's pulleys near a reset.
                    if (!label || l.room < (up ? 40 : 60)) return null;
                    // Upright, a label sits on its rope part rather than above it.
                    return (
                        <Tag
                            key={l.key}
                            at={up ? P(l.at.add(vec2(0, 10))) : l.at}
                            color={color(l.key)}
                        >
                            <tspan fontSize={14}>{label}</tspan>
                        </Tag>
                    );
                })}
        </svg>
    );
}

/** A pulley system with a slider for how much rope the team has pulled in, its parts labelled in kilograms. */
function HaulFigure(props: {
    id: string;
    sys: PulleySystem;
    max: number;
    /** Whether a pulley's sling gets a label. */
    sling?: (id: string) => boolean;
    caption: (pulled: number) => React.ReactNode;
}) {
    const [pulled, setPulled] = useState(0);
    const advantage = pullsOf(props.sys).advantage;
    return (
        <Figure id={props.id} caption={props.caption(pulled)}>
            <SystemDrawing
                sys={props.sys}
                pulled={pulled}
                labelledBy={`${props.id}-caption`}
                labels={{
                    part: (_, t) => kgOf(t / advantage),
                    sling: (id, pull) =>
                        (props.sling?.(id) ?? true) ? kgOf(pull / advantage) : null,
                }}
            />
            <div className="print:hidden">
                <Slider
                    label="Rope the team has pulled in"
                    value={pulled}
                    min={0}
                    max={props.max}
                    step={0.1}
                    unit="m"
                    digits={1}
                    onChange={setPulled}
                />
            </div>
        </Figure>
    );
}

const Strong = (props: { children: React.ReactNode }) => (
    <strong className="text-ink">{props.children}</strong>
);
const FigureNumber = (props: { n: number }) => (
    <strong className="text-ink-soft">Figure {props.n}.</strong>
);

/** How far the rope and load have come, in words. */
function progress(sys: PulleySystem, pulled: number) {
    if (pulled < 0.05) return "Slide the rope in to see how far the load comes.";
    const cm = Math.round(pulled * loadPerMetre(sys) * 100);
    return `The team has pulled in ${pulled.toFixed(1)} m of rope, and the load has come ${cm} cm.`;
}

export function RedirectHaulFigure() {
    return (
        <HaulFigure
            id="haul-redirect"
            sys={REDIRECT}
            max={2.4}
            caption={(pulled) => (
                <>
                    <FigureNumber n={1} /> A rope from a {LOAD_KG} kg load runs round a pulley on
                    the anchor and back, and the team pulls on it. The team pulls with the full{" "}
                    <Strong>{LOAD_KG} kg</Strong>, and the anchor holds both parts of the rope:{" "}
                    {2 * LOAD_KG} kg. The marks on the rope are half a metre apart.{" "}
                    {progress(REDIRECT, pulled)}
                </>
            )}
        />
    );
}

export function TwoToOneFigure() {
    return (
        <HaulFigure
            id="haul-2-1"
            sys={TWO_TO_ONE}
            max={6}
            sling={() => false}
            caption={(pulled) => (
                <>
                    <FigureNumber n={2} /> A 2:1. The rope is tied to the anchor, runs round a
                    pulley clipped to the load, and comes back to the team. Two parts of the rope
                    hold the load, so each holds half, and the team pulls with only{" "}
                    <Strong>{LOAD_KG / 2} kg</Strong>. {progress(TWO_TO_ONE, pulled)} The part tied
                    to the anchor doesn’t move at all: its marks stay put as the pulley comes
                    towards them.
                </>
            )}
        />
    );
}

/** How far the Z-rig's rope can come in before its travelling pulley runs into the anchor pulley. */
const Z_MAX = 5;

export function ZRigFigure() {
    return (
        <HaulFigure
            id="haul-3-1"
            sys={Z_RIG}
            max={Z_MAX}
            caption={(pulled) => (
                <>
                    <FigureNumber n={3} /> A Z-rig, or 3:1. The main line runs from the load round a
                    pulley on the anchor, back round a travelling pulley, and on to the team. The
                    travelling pulley is clipped to a rope grab (green) on the main line. The team
                    pulls with <Strong>{Math.round(LOAD_KG / 3)} kg</Strong>, a third of the load.{" "}
                    {progress(Z_RIG, pulled)}
                    {pulled > Z_MAX - 0.3 &&
                        " The travelling pulley has nearly reached the anchor pulley: time to reset."}
                </>
            )}
        />
    );
}

export function SixToOneFigure() {
    return (
        <HaulFigure
            id="haul-6-1"
            sys={SIX_TO_ONE}
            max={3.6}
            caption={(pulled) => (
                <>
                    <FigureNumber n={4} /> A 2:1 on a 3:1, making a 6:1. The Z-rig from Figure 3 now
                    ends at a second rope grab, and a 2:1 pulls on that grab. The 2:1 doubles the
                    team’s pull and the Z-rig triples that, so the team pulls with only{" "}
                    <Strong>{Math.round(LOAD_KG / 6)} kg</Strong>. The Z-rig’s rope carries on past
                    its grab as a slack tail (dashed). {progress(SIX_TO_ONE, pulled)}
                </>
            )}
        />
    );
}

type Step = { text: React.ReactNode; show: string[] };

/** The T method worked through on a pulley system, one step at a time. */
function TMethodFigure(props: {
    id: string;
    n: number;
    sys: PulleySystem;
    intro: React.ReactNode;
    steps: Step[];
}) {
    const [step, setStep] = useState(1);
    const shown = new Set(props.steps.slice(0, step).flatMap((s) => s.show));
    const latest = new Set(props.steps[step - 1].show);
    const label = (key: string, t: number) => (shown.has(key) ? <T t={t} /> : null);
    return (
        <Figure
            id={props.id}
            caption={
                <>
                    <FigureNumber n={props.n} /> {props.intro} Step {step} of {props.steps.length}:{" "}
                    {props.steps[step - 1].text}
                </>
            }
        >
            <SystemDrawing
                sys={props.sys}
                pulled={0}
                labelledBy={`${props.id}-caption`}
                labels={{
                    part: label,
                    sling: label,
                    color: (key) => (latest.has(key) ? COLORS.load : COLORS.pull),
                }}
            />
            <div className="print:hidden">
                <Slider
                    label="Step"
                    value={step}
                    min={1}
                    max={props.steps.length}
                    step={1}
                    digits={0}
                    onChange={setStep}
                />
            </div>
        </Figure>
    );
}

export function ZRigTMethodFigure() {
    return (
        <TMethodFigure
            id="t-3-1"
            n={5}
            sys={Z_RIG}
            intro="The T method on the Z-rig."
            steps={[
                {
                    text: "call the team’s pull on the haul line 1T.",
                    show: ["0.2"],
                },
                {
                    text: "a rope keeps its tension round a pulley, so every part of this rope carries 1T, as far as the next thing that grips it: the rope grab.",
                    show: ["0.1", "0.0"],
                },
                {
                    text: "two parts pull on the travelling pulley, 1T each, so its sling pulls on the rope grab with 1T + 1T = 2T.",
                    show: ["p2"],
                },
                {
                    text: "the grab adds that 2T to the main line’s 1T, so between the grab and the load the main line carries 3T. The load gets 3T for each 1T the team pulls: 3:1.",
                    show: ["0.0.g1"],
                },
                {
                    text: "the same adding works for the anchor: two parts of 1T pull on the anchor pulley, so the anchor holds 2T.",
                    show: ["p1"],
                },
            ]}
        />
    );
}

export function SixToOneTMethodFigure() {
    return (
        <TMethodFigure
            id="t-6-1"
            n={6}
            sys={SIX_TO_ONE}
            intro="The T method on the 6:1."
            steps={[
                { text: "call the team’s pull 1T.", show: ["1.1"] },
                {
                    text: "the 2:1’s rope carries 1T all along, round its pulley to the anchor.",
                    show: ["1.0"],
                },
                {
                    text: "two parts of 1T pull on the 2:1’s pulley, so it pulls the Z-rig’s rope grab with 2T.",
                    show: ["m2"],
                },
                {
                    text: "that grab is the only thing pulling on the end of the Z-rig’s rope, so the whole of that rope carries 2T.",
                    show: ["0.2", "0.1", "0.0"],
                },
                {
                    text: "two parts of 2T pull on the travelling pulley, so it pulls the main line’s grab with 4T.",
                    show: ["p2"],
                },
                {
                    text: "between that grab and the load, the main line carries its own 2T plus the 4T: 6T. So it’s a 6:1.",
                    show: ["0.0.g1"],
                },
            ]}
        />
    );
}

export function FrictionFigure() {
    const [efficiency, setEfficiency] = useState(90);
    const e = efficiency / 100;
    const advantage = pullsOf(Z_RIG, e).advantage;
    return (
        <Figure
            id="friction"
            caption={
                <>
                    <FigureNumber n={7} /> The Z-rig with friction, while the team hauls. Each
                    pulley passes on {efficiency}% of the tension, so each part of the rope carries
                    less than the one before it, working back from the team. The load gets{" "}
                    <Strong>
                        {advantage.toFixed(2)}
                        <em>T</em>
                    </Strong>{" "}
                    rather than 3<em>T</em>: a {advantage.toFixed(1)}:1. To haul a {LOAD_KG} kg
                    load, the team pulls with {kgOf(1 / advantage)} rather than {kgOf(1 / 3)}.
                </>
            }
        >
            <SystemDrawing
                sys={Z_RIG}
                pulled={0}
                efficiency={e}
                labelledBy="friction-caption"
                labels={{ part: (_, t) => <T t={t} />, sling: (_, t) => <T t={t} /> }}
            />
            <div className="print:hidden">
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
            </div>
        </Figure>
    );
}

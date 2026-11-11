"use client";

import { useState } from "react";

import {
    Carabiner,
    Prusik,
    Pulley,
    pulleyClippedAt,
    pulleyEnds,
    pulleySheaves,
    ropeEye,
    ropePieces,
    Tab,
    type EyeWay,
    type RopePiece,
    type RopeStop,
} from "@/articles/pulley-blocks";
import { Select, Slider, VisualisationLayout } from "@/components/diagram/controls";
import { svgNumber } from "@/lib/svg-path";
import { vec2, type Vector2 } from "@/lib/vector2";

/** The rope's thickness. */
const ROPE = 4;
/**
 * The rope's surface, as two lanes along it, either side of its middle; the second's pattern is a little behind the
 * first's, so its tracers' stripes slant across it.
 */
const ROPE_LANES = [
    { offset: -ROPE / 4, shift: 0 },
    { offset: ROPE / 4, shift: -1.2 },
];
/** The black tracers: a stripe of two short dashes, then plain rope, about two and a half thicknesses along. */
const TRACER = "1.2 0.6 1.2 7";

/** The anchor's face, and how far below it its hangers' holes are. */
const FACE = 20;
const HANGER_Y = 36;
/** How far apart a carabiner's ends are. */
const CLIP = 26;
/** Drawing units per metre the load rises. */
const PER_METRE = 100;

/** A pulley in a diagram, and which of the rope's stops are its sheaves, so they turn with the rope. */
type ScenePulley = {
    at: Vector2;
    eye: EyeWay;
    sheaves: 1 | 2;
    stops: { large: number; small?: number };
};

/**
 * Everything in a diagram, placed: the anchor's face (from and to across), the hangers on it, the pulleys, the rope's
 * stops from its tied end to where it leaves for the team, the carabiners, the rope's end's eye, any Prusik loops, and the hole in the load's tab.
 */
type Scene = {
    face: [number, number];
    hangers: Vector2[];
    pulleys: ScenePulley[];
    rope: RopeStop[];
    clips: [Vector2, Vector2][];
    /** The rope's end's spliced eye. */
    eye: ReturnType<typeof ropeEye>;
    /** Prusik loops: where each grips the rope, and the carabiner's end it runs to. */
    prusiks?: { on: Vector2; to: Vector2 }[];
    load: Vector2;
};

/** A diagram: its name, how much rope can be pulled in (metres), and its scene with that much pulled in. */
type Diagram = { label: string; max: number; scene: (pulled: number) => Scene };

/** Where the load's tab is, hanging from a pulley's eye. */
const loadUnder = (at: Vector2, eye: EyeWay) => pulleyEnds(at, eye).clip.add(vec2(0, CLIP));

const DIAGRAMS = {
    "two-to-one": {
        label: "2:1, a single on the load",
        max: 4,
        // Spliced to a carabiner on the anchor beside where the pulley hangs, down round the pulley on the load, and up to
        // the team. The load rises half the rope pulled in.
        scene: (pulled) => {
            const at = vec2(160, 300 - (pulled * PER_METRE) / 2);
            const sheave = pulleySheaves(at).large;
            // The rope's end is spliced round a carabiner hanging from the hanger, straight above the sheave's side.
            const hanger = vec2(at.x + sheave.r, HANGER_Y);
            const end = hanger.add(vec2(0, CLIP));
            const rest: RopeStop[] = [
                { ...sheave, into: 1, out: -1 },
                { c: vec2(at.x - sheave.r, 12), r: 0 },
            ];
            const eye = ropeEye(end, rest[0], ROPE);
            return {
                face: [160, 215],
                hangers: [hanger],
                pulleys: [{ at, eye: "down", sheaves: 1, stops: { large: 1 } }],
                rope: [eye.stop, ...rest],
                eye,
                clips: [
                    [hanger, end],
                    [pulleyEnds(at, "down").clip, loadUnder(at, "down")],
                ],
                load: loadUnder(at, "down"),
            };
        },
    },
    "two-to-one-redirect": {
        label: "2:1, redirected down at the anchor",
        max: 3.2,
        // The 2:1, with a second hanger on the anchor for a pulley that turns the team's rope back down. Spliced to a
        // carabiner on one hanger, down round the pulley on the load, up over the pulley on the other hanger, and down
        // to the team. The load rises half the rope pulled in.
        scene: (pulled) => {
            const at = vec2(160, 300 - (pulled * PER_METRE) / 2);
            const sheave = pulleySheaves(at).large;
            const tie = vec2(at.x + sheave.r, HANGER_Y);
            const end = tie.add(vec2(0, CLIP));
            // The redirect's right side straight above the load pulley's left, so the rope between them runs plumb.
            const hanger = vec2(at.x - 2 * sheave.r, HANGER_Y);
            const redirect = pulleyClippedAt(hanger.add(vec2(0, CLIP)), "up");
            const rest: RopeStop[] = [
                { ...sheave, into: 1, out: -1 },
                { ...pulleySheaves(redirect).large, into: 1, out: -1 },
                // Leaning away from the load, so the two don't run together.
                { c: vec2(redirect.x - sheave.r - 40, 445), r: 0 },
            ];
            const eye = ropeEye(end, rest[0], ROPE);
            return {
                face: [105, 200],
                hangers: [hanger, tie],
                pulleys: [
                    { at, eye: "down", sheaves: 1, stops: { large: 1 } },
                    { at: redirect, eye: "up", sheaves: 1, stops: { large: 2 } },
                ],
                rope: [eye.stop, ...rest],
                clips: [
                    [tie, end],
                    [hanger, pulleyEnds(redirect, "up").clip],
                    [pulleyEnds(at, "down").clip, loadUnder(at, "down")],
                ],
                eye,
                load: loadUnder(at, "down"),
            };
        },
    },
    "one-to-one": {
        label: "1:1, a single at the anchor",
        max: 2.2,
        // Spliced to a carabiner on the load, up over the pulley at the anchor, and down to the team. The load rises as
        // far as the rope's pulled in.
        scene: (pulled) => {
            const hanger = vec2(160, HANGER_Y);
            const at = pulleyClippedAt(hanger.add(vec2(0, CLIP)), "up");
            const sheave = pulleySheaves(at).large;
            const load = vec2(at.x + sheave.r, 400 - pulled * PER_METRE);
            const end = load.sub(vec2(0, CLIP));
            const rest: RopeStop[] = [
                { ...sheave, into: 1, out: -1 },
                // Leaning away from the load, so the two don't run together.
                { c: vec2(at.x - sheave.r - 40, 445), r: 0 },
            ];
            const eye = ropeEye(end, rest[0], ROPE);
            return {
                face: [125, 195],
                hangers: [hanger],
                pulleys: [{ at, eye: "up", sheaves: 1, stops: { large: 1 } }],
                rope: [eye.stop, ...rest],
                clips: [
                    [hanger, pulleyEnds(at, "up").clip],
                    [load, end],
                ],
                eye,
                load,
            };
        },
    },
    "z-rig": {
        label: "3:1, a Z-rig",
        max: 2.2,
        // Spliced to a carabiner on the load, up over the pulley at the anchor, down round a pulley clipped to a Prusik on
        // the load's rope, and up to the team. The Prusik moves with the load's rope, and the load rises a third of the
        // rope pulled in.
        scene: (pulled) => {
            const rise = (pulled * PER_METRE) / 3;
            const hanger = vec2(160, HANGER_Y);
            const top = pulleyClippedAt(hanger.add(vec2(0, CLIP)), "up");
            const fixed = pulleySheaves(top).large;
            const load = vec2(top.x + fixed.r, 400 - rise);
            const end = load.sub(vec2(0, CLIP));
            // The Prusik grips the load's rope; its loop runs across to a carabiner hanging from the moving pulley.
            const grip = vec2(load.x, 320 - rise);
            const loop = vec2(140, grip.y + 4);
            const moving = pulleyClippedAt(loop.sub(vec2(0, CLIP)), "down");
            const rest: RopeStop[] = [
                { ...fixed, into: 1, out: -1 },
                { ...pulleySheaves(moving).large, into: 1, out: -1 },
                { c: vec2(100, 12), r: 0 },
            ];
            const eye = ropeEye(end, rest[0], ROPE);
            return {
                face: [125, 195],
                hangers: [hanger],
                pulleys: [
                    { at: top, eye: "up", sheaves: 1, stops: { large: 1 } },
                    { at: moving, eye: "down", sheaves: 1, stops: { large: 2 } },
                ],
                rope: [eye.stop, ...rest],
                clips: [
                    [hanger, pulleyEnds(top, "up").clip],
                    [pulleyEnds(moving, "down").clip, loop],
                    [load, end],
                ],
                eye,
                prusiks: [{ on: grip, to: loop }],
                load,
            };
        },
    },
    "four-doubles": {
        label: "4:1, two double pulleys",
        max: 4.5,
        // The 5:1 the other way up: spliced to a carabiner on the top pulley's becket, down and up round each sheave in
        // turn, and from the top pulley's larger sheave down to the team. Four parts hold the bottom pulley, so the load
        // rises a quarter of the rope pulled in.
        scene: (pulled) => {
            const hanger = vec2(160, HANGER_Y);
            const top = pulleyClippedAt(hanger.add(vec2(0, CLIP)), "up");
            const bottom = vec2(160, top.y + 230 - (pulled * PER_METRE) / 4);
            const becket = pulleyEnds(top, "up").becket;
            const end = becket.add(vec2(0, CLIP));
            const [t, b] = [pulleySheaves(top), pulleySheaves(bottom)];
            const rest: RopeStop[] = [
                { ...b.small, into: -1, out: 1 },
                { ...t.small, into: 1, out: -1 },
                { ...b.large, into: -1, out: 1 },
                { ...t.large, into: 1, out: -1 },
                // Leaning away from the bottom pulley, so the team's rope runs clear of it.
                { c: vec2(100, 445), r: 0 },
            ];
            const eye = ropeEye(end, rest[0], ROPE);
            return {
                face: [125, 195],
                hangers: [hanger],
                pulleys: [
                    { at: top, eye: "up", sheaves: 2, stops: { large: 4, small: 2 } },
                    { at: bottom, eye: "down", sheaves: 2, stops: { large: 3, small: 1 } },
                ],
                rope: [eye.stop, ...rest],
                clips: [
                    [hanger, pulleyEnds(top, "up").clip],
                    [becket, end],
                    [pulleyEnds(bottom, "down").clip, loadUnder(bottom, "down")],
                ],
                eye,
                load: loadUnder(bottom, "down"),
            };
        },
    },
    "five-doubles": {
        label: "5:1, two double pulleys",
        max: 4,
        // Spliced to a carabiner on the bottom pulley's becket, round each sheave in turn, and up past the top pulley to
        // the team. The load rises a fifth of the rope pulled in.
        scene: (pulled) => {
            const hanger = vec2(160, HANGER_Y);
            const top = pulleyClippedAt(hanger.add(vec2(0, CLIP)), "up");
            const bottom = vec2(160, top.y + 230 - (pulled * PER_METRE) / 5);
            // The rope's end is spliced round a carabiner clipped to the bottom pulley's becket.
            const becket = pulleyEnds(bottom, "down").becket;
            const end = becket.sub(vec2(0, CLIP));
            const [t, b] = [pulleySheaves(top), pulleySheaves(bottom)];
            const rest: RopeStop[] = [
                { ...t.small, into: -1, out: 1 },
                { ...b.small, into: 1, out: -1 },
                { ...t.large, into: -1, out: 1 },
                { ...b.large, into: 1, out: -1 },
                { c: vec2(112, 12), r: 0 },
            ];
            const eye = ropeEye(end, rest[0], ROPE);
            return {
                face: [125, 195],
                hangers: [hanger],
                pulleys: [
                    { at: top, eye: "up", sheaves: 2, stops: { large: 3, small: 1 } },
                    { at: bottom, eye: "down", sheaves: 2, stops: { large: 4, small: 2 } },
                ],
                rope: [eye.stop, ...rest],
                eye,
                clips: [
                    [hanger, pulleyEnds(top, "up").clip],
                    [becket, end],
                    [pulleyEnds(bottom, "down").clip, loadUnder(bottom, "down")],
                ],
                load: loadUnder(bottom, "down"),
            };
        },
    },
} satisfies Record<string, Diagram>;

type Key = keyof typeof DIAGRAMS;

/** A piece of rope: white, with a faint braid and black tracers spiralling round it, fixed to it so it shows running. */
function RopePath({ piece }: { piece: RopePiece }) {
    return (
        <g className="text-ink">
            <path
                d={piece.d}
                fill="none"
                stroke="currentColor"
                strokeWidth={ROPE}
                strokeLinecap="round"
            />
            {ROPE_LANES.map((lane, k) => (
                <g key={k}>
                    <path
                        d={piece.lane(lane.offset)}
                        pathLength={svgNumber(piece.length)}
                        fill="none"
                        className="stroke-background"
                        strokeOpacity={0.15}
                        strokeWidth={ROPE / 2}
                        strokeDasharray="0.8 0.7"
                        strokeDashoffset={svgNumber(piece.start + lane.shift / 2)}
                    />
                    <path
                        d={piece.lane(lane.offset)}
                        pathLength={svgNumber(piece.length)}
                        fill="none"
                        className="stroke-background"
                        strokeOpacity={0.85}
                        strokeWidth={ROPE / 2}
                        strokeDasharray={TRACER}
                        strokeDashoffset={svgNumber(piece.start + lane.shift)}
                    />
                </g>
            ))}
        </g>
    );
}

/** Pulley systems drawn as they look, picked from a list, with a slider for the rope pulled in. */
export default function Sketch() {
    const [key, setKey] = useState<Key>("two-to-one");
    const [pulled, setPulled] = useState(0);
    const diagram: Diagram = DIAGRAMS[key];
    const scene = diagram.scene(Math.min(pulled, diagram.max));
    const { pieces, spins } = ropePieces(scene.rope);
    const [from, to] = scene.face;
    const loadTop = scene.load.y + 10;
    return (
        <VisualisationLayout
            diagram={
                <div className="flex p-2 lg:h-[calc(100dvh-12rem)] lg:min-h-105">
                    <svg
                        viewBox="0 0 320 445"
                        className="h-auto w-full text-ink-muted lg:h-full"
                        role="img"
                        aria-label={diagram.label}
                    >
                        {/* The anchor, with its hangers. */}
                        <line
                            x1={from}
                            y1={FACE}
                            x2={to}
                            y2={FACE}
                            stroke="currentColor"
                            strokeWidth={2}
                        />
                        {Array.from({ length: Math.floor((to - from) / 8) + 1 }, (_, i) => (
                            <line
                                key={i}
                                x1={from + i * 8}
                                y1={FACE}
                                x2={from + 6 + i * 8}
                                y2={FACE - 8}
                                stroke="currentColor"
                                strokeWidth={1}
                            />
                        ))}
                        {scene.hangers.map((h, i) => (
                            <Tab key={i} hole={h} base={FACE} />
                        ))}
                        {/* Each part of every pulley in turn from the back, with the rope on each sheave behind it. */}
                        {(["plate", "large", "small"] as const).map((part, i) => (
                            <g key={part}>
                                {i > 0 &&
                                    pieces
                                        .filter((piece) => piece.layer === i - 1)
                                        .map((piece, j) => <RopePath key={j} piece={piece} />)}
                                {scene.pulleys.map((p, j) => (
                                    <Pulley
                                        key={j}
                                        at={p.at}
                                        eye={p.eye}
                                        sheaves={p.sheaves}
                                        part={part}
                                        spins={{
                                            large: spins[p.stops.large],
                                            small:
                                                p.stops.small === undefined
                                                    ? 0
                                                    : spins[p.stops.small],
                                        }}
                                    />
                                ))}
                            </g>
                        ))}
                        {/* The load, with its tab. */}
                        <Tab hole={scene.load} base={loadTop} />
                        <rect
                            x={scene.load.x - 30}
                            y={loadTop}
                            width={60}
                            height={30}
                            fill="currentColor"
                        />
                        {/* The rope's end, spliced into an eye round its carabiner, whose front half passes over it. */}
                        <g className="text-ink">
                            <path
                                d={scene.eye.eye}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={ROPE}
                                strokeLinejoin="round"
                            />
                            <path
                                d={scene.eye.eye}
                                fill="none"
                                className="stroke-background"
                                strokeOpacity={0.85}
                                strokeWidth={ROPE / 2}
                                strokeDasharray={TRACER}
                            />
                            <path d={scene.eye.splice} fill="currentColor" />
                        </g>
                        {/* Prusik loops, over the rope they grip and under their carabiners. */}
                        {scene.prusiks?.map((k, i) => (
                            <Prusik key={i} on={k.on} to={k.to} rope={ROPE} />
                        ))}
                        {/* The carabiners, over the plates they clip through. */}
                        {scene.clips.map((ends, i) => (
                            <Carabiner key={i} ends={ends} />
                        ))}
                    </svg>
                </div>
            }
            controls={
                <>
                    <Select
                        label="System"
                        value={key}
                        groups={[
                            {
                                options: (Object.keys(DIAGRAMS) as Key[]).map((k) => ({
                                    value: k,
                                    label: DIAGRAMS[k].label,
                                })),
                            },
                        ]}
                        onChange={(k) => {
                            setKey(k);
                            setPulled(0);
                        }}
                    />
                    <Slider
                        label="Rope pulled in"
                        value={Math.min(pulled, diagram.max)}
                        min={0}
                        max={diagram.max}
                        step={0.01}
                        unit="m"
                        digits={2}
                        onChange={setPulled}
                    />
                </>
            }
        />
    );
}

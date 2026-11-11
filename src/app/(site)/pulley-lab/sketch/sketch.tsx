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
    tangent,
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

/**
 * A pulley in a diagram, and which of a rope's stops are its sheaves, so they turn with the rope: the first rope's,
 * unless it says which.
 */
type ScenePulley = {
    at: Vector2;
    eye: EyeWay;
    sheaves: 1 | 2;
    becket?: boolean;
    stops: { rope?: number; large: number; small?: number };
};

/** A rope: its stops from its first end to its last, and the spliced eyes at its ends. */
type SceneRope = { stops: RopeStop[]; eyes: ReturnType<typeof ropeEye>[] };

/**
 * Everything in a diagram, placed: the anchor's face (from and to across), the hangers on it, the pulleys, the ropes,
 * the carabiners, any Prusik loops, and the holes in the load's tabs (the first is the one it hangs from).
 */
type Scene = {
    face: [number, number];
    hangers: Vector2[];
    pulleys: ScenePulley[];
    ropes: SceneRope[];
    clips: [Vector2, Vector2][];
    /** Prusik loops: where each grips the rope, and the carabiner's end it runs to. */
    prusiks?: { on: Vector2; to: Vector2; along?: Vector2 }[];
    load: Vector2;
    /** Other tabs on the load, level with its first. */
    ties?: Vector2[];
    /** An anchor on the ground: its face's height, from and to across, and its hangers. */
    ground?: { y: number; across: [number, number]; hangers: Vector2[] };
    /** A rope whose last piece fades out between two points, where it hangs slack. */
    fade?: { rope: number; from: Vector2; to: Vector2 };
};

/**
 * A diagram: its name, how much rope can be pulled in (metres), its scene with that much pulled in, and how tall it
 * is if it needs more than the usual room.
 */
type Diagram = { label: string; max: number; height?: number; scene: (pulled: number) => Scene };

/** How tall a diagram is, unless it says. */
const HEIGHT = 445;

/** Where the load's tab is, hanging from a pulley's eye. */
const loadUnder = (at: Vector2, eye: EyeWay) => pulleyEnds(at, eye).clip.add(vec2(0, CLIP));

/**
 * The 7:1, with the load risen `rise` (drawing units) and its team's rope running down to `team`. Two pairs side by
 * side. Spliced to a carabiner on the load's double's becket, round the right pair's sheaves like the 5:1, up to the
 * left anchor double's smaller sheave, down round the single, up over the left double's larger sheave, and down to the
 * team. Seven parts hold the load, so it rises a seventh of the rope pulled in; the last sheave only turns the team's
 * rope back down.
 */
function sevenToOne(rise: number, team: Vector2): Scene {
    const hangers = [vec2(135, HANGER_Y), vec2(185, HANGER_Y)];
    const [left, right] = hangers.map((h) => pulleyClippedAt(h.add(vec2(0, CLIP)), "up"));
    const double = vec2(right.x, right.y + 230 - rise);
    // The single sits under the left double, with its left side straight below the smaller sheave's.
    const [l, d, r] = [pulleySheaves(left), pulleySheaves(double), pulleySheaves(right)];
    const single = vec2(left.x + l.large.r - l.small.r, double.y);
    const becket = pulleyEnds(double, "down").becket;
    const end = becket.sub(vec2(0, CLIP));
    const rest: RopeStop[] = [
        { ...r.small, into: -1, out: 1 },
        { ...d.small, into: 1, out: -1 },
        { ...r.large, into: -1, out: 1 },
        { ...d.large, into: 1, out: -1 },
        { ...l.small, into: 1, out: -1 },
        { ...pulleySheaves(single).large, into: -1, out: 1 },
        { ...l.large, into: 1, out: -1 },
        { c: team, r: 0 },
    ];
    const eye = ropeEye(end, rest[0], ROPE);
    const load = loadUnder(double, "down");
    const tie = loadUnder(single, "down");
    return {
        face: [110, 210],
        hangers,
        pulleys: [
            { at: right, eye: "up", sheaves: 2, stops: { large: 3, small: 1 } },
            { at: double, eye: "down", sheaves: 2, stops: { large: 4, small: 2 } },
            { at: left, eye: "up", sheaves: 2, stops: { large: 7, small: 5 } },
            { at: single, eye: "down", sheaves: 1, stops: { large: 6 } },
        ],
        ropes: [{ stops: [eye.stop, ...rest], eyes: [eye] }],
        clips: [
            [hangers[0], pulleyEnds(left, "up").clip],
            [hangers[1], pulleyEnds(right, "up").clip],
            [becket, end],
            [pulleyEnds(double, "down").clip, load],
            [pulleyEnds(single, "down").clip, tie],
        ],
        load,
        ties: [tie],
    };
}

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
                ropes: [{ stops: [eye.stop, ...rest], eyes: [eye] }],
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
                ropes: [{ stops: [eye.stop, ...rest], eyes: [eye] }],
                clips: [
                    [tie, end],
                    [hanger, pulleyEnds(redirect, "up").clip],
                    [pulleyEnds(at, "down").clip, loadUnder(at, "down")],
                ],
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
                ropes: [{ stops: [eye.stop, ...rest], eyes: [eye] }],
                clips: [
                    [hanger, pulleyEnds(at, "up").clip],
                    [load, end],
                ],
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
            const loop = vec2(125, grip.y + 4);
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
                ropes: [{ stops: [eye.stop, ...rest], eyes: [eye] }],
                clips: [
                    [hanger, pulleyEnds(top, "up").clip],
                    [pulleyEnds(moving, "down").clip, loop],
                    [load, end],
                ],
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
                ropes: [{ stops: [eye.stop, ...rest], eyes: [eye] }],
                clips: [
                    [hanger, pulleyEnds(top, "up").clip],
                    [becket, end],
                    [pulleyEnds(bottom, "down").clip, loadUnder(bottom, "down")],
                ],
                load: loadUnder(bottom, "down"),
            };
        },
    },
    "nine-to-one": {
        label: "9:1, a 2:1 on the 4:1, tied to the load",
        max: 2.7,
        height: 520,
        // The 4:1 with its team's end spliced to a carabiner on a single pulley, and a second rope tied to the load, up
        // round the single, and down to the team. As the load rises, the 4:1's rope lets the single down four times as
        // far, so the second rope's two parts to it shorten by five times the rise each, and the load rises a ninth of
        // the rope pulled in: eight from the 2:1 on the 4:1, and one from the second rope pulling on the load itself.
        scene: (pulled) => {
            const rise = (pulled * PER_METRE) / 9;
            const hanger = vec2(160, HANGER_Y);
            const top = pulleyClippedAt(hanger.add(vec2(0, CLIP)), "up");
            const bottom = vec2(160, top.y + 300 - rise);
            const load = loadUnder(bottom, "down");
            const becket = pulleyEnds(top, "up").becket;
            const end = becket.add(vec2(0, CLIP));
            const [t, b] = [pulleySheaves(top), pulleySheaves(bottom)];
            // The single hangs from a carabiner through the eye at the 4:1's rope's other end.
            const tail = vec2(116, 145 + 4 * rise);
            const single = pulleyClippedAt(tail.add(vec2(0, CLIP)), "up");
            const s = pulleySheaves(single).large;
            const rest: RopeStop[] = [
                { ...b.small, into: -1, out: 1 },
                { ...t.small, into: 1, out: -1 },
                { ...b.large, into: -1, out: 1 },
                { ...t.large, into: 1, out: -1 },
            ];
            const eye = ropeEye(end, rest[0], ROPE);
            // Its other end's eye, worked out from the carabiner back up to the top pulley.
            const tailEye = ropeEye(tail, { ...t.large, into: -1 }, ROPE);
            // The second rope's end is spliced round a carabiner on a tab on the load, straight below the single's side.
            const tie = vec2(single.x + s.r, load.y);
            const tieEnd = tie.sub(vec2(0, CLIP));
            const second: RopeStop[] = [
                { ...s, into: 1, out: -1 },
                { c: vec2(70, 520), r: 0 },
            ];
            const tieEye = ropeEye(tieEnd, second[0], ROPE);
            return {
                face: [125, 195],
                hangers: [hanger],
                pulleys: [
                    { at: top, eye: "up", sheaves: 2, stops: { large: 4, small: 2 } },
                    { at: bottom, eye: "down", sheaves: 2, stops: { large: 3, small: 1 } },
                    { at: single, eye: "up", sheaves: 1, stops: { rope: 1, large: 1 } },
                ],
                ropes: [
                    { stops: [eye.stop, ...rest, tailEye.stop], eyes: [eye, tailEye] },
                    { stops: [tieEye.stop, ...second], eyes: [tieEye] },
                ],
                clips: [
                    [hanger, pulleyEnds(top, "up").clip],
                    [becket, end],
                    [pulleyEnds(bottom, "down").clip, load],
                    [tail, pulleyEnds(single, "up").clip],
                    [tie, tieEnd],
                ],
                load,
                ties: [tie],
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
                ropes: [{ stops: [eye.stop, ...rest], eyes: [eye] }],
                clips: [
                    [hanger, pulleyEnds(top, "up").clip],
                    [becket, end],
                    [pulleyEnds(bottom, "down").clip, loadUnder(bottom, "down")],
                ],
                load: loadUnder(bottom, "down"),
            };
        },
    },
    "seven-to-one": {
        label: "7:1, two doubles at the anchor, a double and a single on the load",
        max: 5.5,
        // Leaning away from the single, so the team's rope runs clear of it.
        scene: (pulled) => sevenToOne((pulled * PER_METRE) / 7, vec2(80, 445)),
    },
    "twenty-eight-to-one": {
        label: "28:1, a 4:1 on the 7:1's rope from a ground anchor",
        max: 7.5,
        height: 595,
        // The 7:1, with a 4:1 between an anchor on the ground and a Prusik on the 7:1's team's rope, which is slack past
        // it. Spliced to a carabiner on the ground single's becket, up round the double on the Prusik, down round the
        // single, up round the double again, and down to the team. Four parts pull the Prusik down, so it moves a
        // quarter of the 4:1's rope pulled in, pulling the 7:1's rope with it, and the load rises a seventh of that: a
        // 28th of the rope pulled in.
        scene: (pulled) => {
            const rise = (pulled * PER_METRE) / 28;
            const ground = 580;
            // The line the 7:1's team's rope runs down, from its last sheave towards the ground.
            const towards = vec2(100, ground);
            const stops = sevenToOne(rise, towards).ropes[0].stops;
            const [from, to] = tangent(stops[stops.length - 2], { c: towards, r: 0 });
            const along = to.sub(from).scale(1 / to.distanceTo(from));
            // The Prusik starts just under the 7:1's top left pulley, and moves down as far as its rope's pulled in.
            const y = 135 + 7 * rise;
            const grip = from.add(along.scale((y - from.y) / along.y));
            // Past it the 7:1's rope is slack: a short tail, fading out.
            const tail = grip.add(along.scale(70));
            const scene = sevenToOne(rise, tail);
            // The 4:1 hangs on the far side of the 7:1's rope from the load, its loop running across to it.
            const loop = vec2(85, grip.y + 4);
            const top = pulleyClippedAt(loop.add(vec2(0, CLIP)), "up");
            const hanger = vec2(85, ground - (HANGER_Y - FACE));
            const bottom = pulleyClippedAt(hanger.sub(vec2(0, CLIP)), "down");
            const becket = pulleyEnds(bottom, "down").becket;
            const end = becket.sub(vec2(0, CLIP));
            const [t, g] = [pulleySheaves(top), pulleySheaves(bottom).large];
            const rest: RopeStop[] = [
                { ...t.small, into: 1, out: -1 },
                { ...g, into: -1, out: 1 },
                { ...t.large, into: 1, out: -1 },
                // Leaning away from the single, so the team's rope runs clear of it.
                { c: vec2(30, ground), r: 0 },
            ];
            const eye = ropeEye(end, rest[0], ROPE);
            return {
                ...scene,
                pulleys: [
                    ...scene.pulleys,
                    { at: top, eye: "up", sheaves: 2, stops: { rope: 1, large: 3, small: 1 } },
                    {
                        at: bottom,
                        eye: "down",
                        sheaves: 1,
                        becket: true,
                        stops: { rope: 1, large: 2 },
                    },
                ],
                ropes: [...scene.ropes, { stops: [eye.stop, ...rest], eyes: [eye] }],
                clips: [
                    ...scene.clips,
                    [loop, pulleyEnds(top, "up").clip],
                    [hanger, pulleyEnds(bottom, "down").clip],
                    [becket, end],
                ],
                prusiks: [{ on: grip, to: loop, along }],
                ground: { y: ground, across: [60, 110], hangers: [hanger] },
                fade: { rope: 0, from: grip.add(along.scale(8)), to: tail },
            };
        },
    },
} satisfies Record<string, Diagram>;

type Key = keyof typeof DIAGRAMS;

/** A piece of rope: white, with a faint braid and black tracers spiralling round it, fixed to it so it shows running. */
function RopePath({ piece, mask }: { piece: RopePiece; mask?: string }) {
    return (
        <g className="text-ink" mask={mask}>
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

/**
 * An anchor's face at height `y`, from and to `across`, hatched on its far side (above it near the top of the drawing,
 * below it on the ground), with its hangers.
 */
function Anchor(props: { y: number; across: [number, number]; hangers: Vector2[] }) {
    const { y, hangers } = props;
    const [from, to] = props.across;
    const back = y < FACE * 2 ? -8 : 8;
    return (
        <>
            <line x1={from} y1={y} x2={to} y2={y} stroke="currentColor" strokeWidth={2} />
            {Array.from({ length: Math.floor((to - from) / 8) + 1 }, (_, i) => (
                <line
                    key={i}
                    x1={from + i * 8}
                    y1={y}
                    x2={from + 6 + i * 8}
                    y2={y + back}
                    stroke="currentColor"
                    strokeWidth={1}
                />
            ))}
            {hangers.map((h, i) => (
                <Tab key={i} hole={h} base={y} />
            ))}
        </>
    );
}

/** Pulley systems drawn as they look, picked from a list, with a slider for the rope pulled in. */
export default function Sketch() {
    const [key, setKey] = useState<Key>("two-to-one");
    const [pulled, setPulled] = useState(0);
    const diagram: Diagram = DIAGRAMS[key];
    const scene = diagram.scene(Math.min(pulled, diagram.max));
    const ropes = scene.ropes.map((rope) => ropePieces(rope.stops));
    // Each piece of rope, and whether it's the slack one that fades out.
    const pieces = ropes.flatMap((rope, r) =>
        rope.pieces.map((piece, k) => ({
            piece,
            fades: scene.fade?.rope === r && k === rope.pieces.length - 1,
        })),
    );
    const loadTop = scene.load.y + 10;
    // The load's box reaches past its tabs: 30 either side of a lone one, less past several, so it stays narrow.
    const tabs = [scene.load, ...(scene.ties ?? [])].map((t) => t.x);
    const past = tabs.length > 1 ? 20 : 30;
    const [left, wide] = [
        Math.min(...tabs) - past,
        Math.max(...tabs) - Math.min(...tabs) + 2 * past,
    ];
    const height = diagram.height ?? HEIGHT;
    return (
        <VisualisationLayout
            diagram={
                <div className="flex p-2 lg:h-[calc(100dvh-12rem)] lg:min-h-105">
                    <svg
                        viewBox={`0 0 320 ${height}`}
                        className="h-auto w-full text-ink-muted lg:h-full"
                        role="img"
                        aria-label={diagram.label}
                    >
                        {/* Slack rope fades out: it shows as much as the mask is light, which fades to dark along it. */}
                        {scene.fade && (
                            <defs>
                                <linearGradient
                                    id="slack-fade"
                                    gradientUnits="userSpaceOnUse"
                                    x1={svgNumber(scene.fade.from.x)}
                                    y1={svgNumber(scene.fade.from.y)}
                                    x2={svgNumber(scene.fade.to.x)}
                                    y2={svgNumber(scene.fade.to.y)}
                                >
                                    <stop offset={0} stopColor="white" />
                                    <stop offset={1} stopColor="black" />
                                </linearGradient>
                                <mask id="slack" maskUnits="userSpaceOnUse">
                                    <rect width={320} height={height} fill="url(#slack-fade)" />
                                </mask>
                            </defs>
                        )}
                        {/* The anchors, with their hangers. */}
                        <Anchor y={FACE} across={scene.face} hangers={scene.hangers} />
                        {scene.ground && <Anchor {...scene.ground} />}
                        {/* Each part of every pulley in turn from the back, with the rope on each sheave behind it. */}
                        {(["plate", "large", "small"] as const).map((part, i) => (
                            <g key={part}>
                                {i > 0 &&
                                    pieces
                                        .filter(({ piece }) => piece.layer === i - 1)
                                        .map(({ piece, fades }, j) => (
                                            <RopePath
                                                key={j}
                                                piece={piece}
                                                mask={fades ? "url(#slack)" : undefined}
                                            />
                                        ))}
                                {scene.pulleys.map((p, j) => {
                                    const { spins } = ropes[p.stops.rope ?? 0];
                                    return (
                                        <Pulley
                                            key={j}
                                            at={p.at}
                                            eye={p.eye}
                                            sheaves={p.sheaves}
                                            becket={p.becket}
                                            part={part}
                                            spins={{
                                                large: spins[p.stops.large],
                                                small:
                                                    p.stops.small === undefined
                                                        ? 0
                                                        : spins[p.stops.small],
                                            }}
                                        />
                                    );
                                })}
                            </g>
                        ))}
                        {/* The load, with its tabs. */}
                        {[scene.load, ...(scene.ties ?? [])].map((t, i) => (
                            <Tab key={i} hole={t} base={loadTop} />
                        ))}
                        <rect x={left} y={loadTop} width={wide} height={30} fill="currentColor" />
                        {/* The ropes' ends, spliced into eyes round their carabiners, whose front halves pass over them. */}
                        {scene.ropes
                            .flatMap((rope) => rope.eyes)
                            .map((eye, i) => (
                                <g key={i} className="text-ink">
                                    <path
                                        d={eye.eye}
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={ROPE}
                                        strokeLinejoin="round"
                                    />
                                    <path
                                        d={eye.eye}
                                        fill="none"
                                        className="stroke-background"
                                        strokeOpacity={0.85}
                                        strokeWidth={ROPE / 2}
                                        strokeDasharray={TRACER}
                                    />
                                    <path d={eye.splice} fill="currentColor" />
                                </g>
                            ))}
                        {/* Prusik loops, over the rope they grip and under their carabiners. */}
                        {scene.prusiks?.map((k, i) => (
                            <Prusik key={i} on={k.on} to={k.to} along={k.along} rope={ROPE} />
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

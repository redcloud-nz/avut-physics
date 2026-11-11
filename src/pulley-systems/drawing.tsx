"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
import { Segment } from "@/lib/segment";
import { polylinePath, svgNumber, svgPoint } from "@/lib/svg-path";
import { vec2, type Vector2 } from "@/lib/vector2";

import { SYSTEMS, type Slug } from "./systems";
import { PIN, trackOf, type PinEdge } from "./track";

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

/** How deep an anchor's hatching is. */
const HATCH = 8;
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
/**
 * A rope: its stops, its spliced eyes, and its tension at its last end, in team pulls (the team's rope's is the team's
 * pull, 1; a slack tail's is 0).
 */
type SceneRope = { stops: RopeStop[]; eyes: ReturnType<typeof ropeEye>[]; t?: number };

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
    /**
     * Prusik loops: where each grips the rope, and the carabiner's end it runs to, which rope it's on (the first,
     * unless it says), and how hard it pulls that rope towards the rope's last end, in team pulls.
     */
    prusiks?: { on: Vector2; to: Vector2; along?: Vector2; rope?: number; pull: number }[];
    load: Vector2;
    /** Other tabs on the load, level with its first. */
    ties?: Vector2[];
    /** An anchor on the ground: its face's height, from and to across, and its hangers. */
    ground?: { y: number; across: [number, number]; hangers: Vector2[] };
    /** A rope whose last piece fades out between two points, where it hangs slack. */
    fade?: { rope: number; from: Vector2; to: Vector2 };
    /**
     * The team's rope, if it runs round a pin at the drawing's foot (or top), `x` across, and on along a track round the
     * drawing to its end, which the team pulls along it: the rope's last stop is its last sheave.
     */
    pin?: { rope: number; x: number; edge?: PinEdge };
};

/** How far along the track the rope's end sits with no rope pulled in, clear of the pin. */
const LEAD = 14;

/**
 * A diagram: how much rope can be pulled in (metres), and its scene with that much pulled in. Given `room` to spare below it (drawing units), it starts its load (or what limits its
 * travel) that much lower, and `gain` is how much more rope that lets the team pull in, per unit of room, in drawing
 * units.
 */
type Diagram = {
    max: number;
    gain: number;
    scene: (pulled: number, room: number) => Scene;
};

/** Where the load's tab is, hanging from a pulley's eye. */
const loadUnder = (at: Vector2, eye: EyeWay) => pulleyEnds(at, eye).clip.add(vec2(0, CLIP));

/**
 * The 7:1, with the load risen `rise` (drawing units) from `room` below where it usually starts, and its team's rope
 * running down to `team`, if given (or, without it, ending at its last sheave, for a pin to take it on). Two pairs side
 * by side. Spliced to a carabiner on the load's double's becket, round the right pair's sheaves like the 5:1, up to the
 * left anchor double's smaller sheave, down round the single, up over the left double's larger sheave, and down to the
 * team. Seven parts hold the load, so it rises a seventh of the rope pulled in; the last sheave only turns the team's
 * rope back down.
 */
function sevenToOne(rise: number, room: number, team?: Vector2): Scene {
    const hangers = [vec2(135, HANGER_Y), vec2(185, HANGER_Y)];
    const [left, right] = hangers.map((h) => pulleyClippedAt(h.add(vec2(0, CLIP)), "up"));
    const double = vec2(right.x, right.y + 230 + room - rise);
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
        ...(team ? [{ c: team, r: 0 }] : []),
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
    "2-to-1": {
        max: 4,
        gain: 2,
        // Spliced to a carabiner on the anchor beside where the pulley hangs, down round the pulley on the load, and up to
        // the team. The load rises half the rope pulled in.
        scene: (pulled, room) => {
            const at = vec2(160, 300 + room - (pulled * PER_METRE) / 2);
            const sheave = pulleySheaves(at).large;
            // The rope's end is spliced round a carabiner hanging from the hanger, straight above the sheave's side.
            const hanger = vec2(at.x + sheave.r, HANGER_Y);
            const end = hanger.add(vec2(0, CLIP));
            const rest: RopeStop[] = [{ ...sheave, into: 1, out: -1 }];
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
                // Straight up from the sheave's side, round a pin at the top.
                pin: { rope: 0, x: at.x - sheave.r + PIN, edge: "top" },
            };
        },
    },
    "2-to-1-redirect": {
        max: 3.2,
        gain: 2,
        // The 2:1, with a second hanger on the anchor for a pulley that turns the team's rope back down. Spliced to a
        // carabiner on one hanger, down round the pulley on the load, up over the pulley on the other hanger, and down
        // to the team. The load rises half the rope pulled in.
        scene: (pulled, room) => {
            const at = vec2(160, 300 + room - (pulled * PER_METRE) / 2);
            const sheave = pulleySheaves(at).large;
            const tie = vec2(at.x + sheave.r, HANGER_Y);
            const end = tie.add(vec2(0, CLIP));
            // The redirect's right side straight above the load pulley's left, so the rope between them runs plumb.
            const hanger = vec2(at.x - 2 * sheave.r, HANGER_Y);
            const redirect = pulleyClippedAt(hanger.add(vec2(0, CLIP)), "up");
            const rest: RopeStop[] = [
                { ...sheave, into: 1, out: -1 },
                { ...pulleySheaves(redirect).large, into: 1, out: -1 },
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
                // Leaning away from the load, so the two don't run together.
                pin: { rope: 0, x: redirect.x - sheave.r - 40 },
            };
        },
    },
    "1-to-1": {
        max: 2.2,
        gain: 1,
        // Spliced to a carabiner on the load, up over the pulley at the anchor, and down to the team. The load rises as
        // far as the rope's pulled in.
        scene: (pulled, room) => {
            const hanger = vec2(160, HANGER_Y);
            const at = pulleyClippedAt(hanger.add(vec2(0, CLIP)), "up");
            const sheave = pulleySheaves(at).large;
            const load = vec2(at.x + sheave.r, 400 + room - pulled * PER_METRE);
            const end = load.sub(vec2(0, CLIP));
            const rest: RopeStop[] = [{ ...sheave, into: 1, out: -1 }];
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
                // Leaning away from the load, so the two don't run together, and the pin's readout clears it.
                pin: { rope: 0, x: at.x - sheave.r - 50 },
            };
        },
    },
    "z-rig": {
        max: 5,
        gain: 3,
        // Spliced to a carabiner on the load, up over the pulley at the anchor, down round a pulley clipped to a Prusik on
        // the load's rope, and up to the team. The Prusik moves with the load's rope, and the load rises a third of the
        // rope pulled in.
        scene: (pulled, room) => {
            const rise = (pulled * PER_METRE) / 3;
            const hanger = vec2(160, HANGER_Y);
            const top = pulleyClippedAt(hanger.add(vec2(0, CLIP)), "up");
            const fixed = pulleySheaves(top).large;
            const load = vec2(top.x + fixed.r, 455 + room - rise);
            const end = load.sub(vec2(0, CLIP));
            // The Prusik grips the load's rope; its loop runs across to a carabiner hanging from the moving pulley.
            const grip = vec2(load.x, 375 + room - rise);
            const loop = vec2(125, grip.y + 4);
            const moving = pulleyClippedAt(loop.sub(vec2(0, CLIP)), "down");
            const rest: RopeStop[] = [
                { ...fixed, into: 1, out: -1 },
                { ...pulleySheaves(moving).large, into: 1, out: -1 },
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
                // The moving pulley's two parts pull its Prusik.
                prusiks: [{ on: grip, to: loop, pull: 2 }],
                load,
                // Straight up from the moving pulley's side, round a pin at the top.
                pin: { rope: 0, x: moving.x - pulleySheaves(moving).large.r + PIN, edge: "top" },
            };
        },
    },
    "3-to-1-redirect": {
        max: 3.4,
        gain: 3,
        // The 2:1 redirected, with its anchor's pulleys made one double, and the rope's end run over it and back down to
        // the load: spliced to a carabiner on the load's single's becket, up over the double's smaller sheave, down round
        // the single, and up over the double's larger sheave down to the team. Three parts hold the load, so it rises a
        // third of the rope pulled in.
        scene: (pulled, room) => {
            const hanger = vec2(160, HANGER_Y);
            const top = pulleyClippedAt(hanger.add(vec2(0, CLIP)), "up");
            const bottom = vec2(160, top.y + 230 + room - (pulled * PER_METRE) / 3);
            const becket = pulleyEnds(bottom, "down").becket;
            const end = becket.sub(vec2(0, CLIP));
            const t = pulleySheaves(top);
            const rest: RopeStop[] = [
                { ...t.small, into: 1, out: -1 },
                { ...pulleySheaves(bottom).large, into: -1, out: 1 },
                { ...t.large, into: 1, out: -1 },
            ];
            const eye = ropeEye(end, rest[0], ROPE);
            return {
                face: [125, 195],
                hangers: [hanger],
                pulleys: [
                    { at: top, eye: "up", sheaves: 2, stops: { large: 3, small: 1 } },
                    { at: bottom, eye: "down", sheaves: 1, becket: true, stops: { large: 2 } },
                ],
                ropes: [{ stops: [eye.stop, ...rest], eyes: [eye] }],
                clips: [
                    [hanger, pulleyEnds(top, "up").clip],
                    [becket, end],
                    [pulleyEnds(bottom, "down").clip, loadUnder(bottom, "down")],
                ],
                load: loadUnder(bottom, "down"),
                // Leaning away from the single, so the team's rope runs clear of it.
                pin: { rope: 0, x: 100 - PIN },
            };
        },
    },
    "4-to-1": {
        max: 4.5,
        gain: 4,
        // The 5:1 the other way up: spliced to a carabiner on the top pulley's becket, down and up round each sheave in
        // turn, and from the top pulley's larger sheave down to the team. Four parts hold the bottom pulley, so the load
        // rises a quarter of the rope pulled in.
        scene: (pulled, room) => {
            const hanger = vec2(160, HANGER_Y);
            const top = pulleyClippedAt(hanger.add(vec2(0, CLIP)), "up");
            const bottom = vec2(160, top.y + 230 + room - (pulled * PER_METRE) / 4);
            const becket = pulleyEnds(top, "up").becket;
            const end = becket.add(vec2(0, CLIP));
            const [t, b] = [pulleySheaves(top), pulleySheaves(bottom)];
            const rest: RopeStop[] = [
                { ...b.small, into: -1, out: 1 },
                { ...t.small, into: 1, out: -1 },
                { ...b.large, into: -1, out: 1 },
                { ...t.large, into: 1, out: -1 },
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
                // Leaning away from the bottom pulley, so the team's rope runs clear of it.
                pin: { rope: 0, x: 100 - PIN },
            };
        },
    },
    "9-to-1": {
        max: 3.4,
        // The second Z-rig's pulley comes up to its anchor's at a third of the rope pulled in.
        gain: 3,
        // Two Z-rigs in one rope, the second to the left of the first. Spliced to a carabiner on the load, up over the
        // first pulley at the anchor, down round a pulley clipped to a Prusik on the load's rope, up over the second
        // pulley at the anchor, down round a pulley clipped to a Prusik on the rope coming up to it, and up to the team.
        // The second Z-rig pulls its Prusik up a third of the rope pulled in, pulling the first Z-rig's rope in with it,
        // and the first pulls the load up a third of that: a ninth of the rope pulled in.
        scene: (pulled, room) => {
            const rise = (pulled * PER_METRE) / 9;
            const hangers = [vec2(133, HANGER_Y), vec2(200, HANGER_Y)];
            const [second, first] = hangers.map((h) => pulleyClippedAt(h.add(vec2(0, CLIP)), "up"));
            const r = pulleySheaves(first).large.r;
            const load = vec2(first.x + r, 490 + room - rise);
            const end = load.sub(vec2(0, CLIP));
            // Each Prusik's loop runs across to a carabiner hanging from its moving pulley. The first's grips the load's
            // rope; the second's, the rope from the first moving pulley up to the second anchor pulley, which runs
            // plumb between them.
            const grip = vec2(load.x, load.y - 75);
            const loop = vec2(165, grip.y + 4);
            const moving = pulleyClippedAt(loop.sub(vec2(0, CLIP)), "down");
            const upper = vec2(moving.x - r, 320 + room - 3 * rise);
            const upperLoop = vec2(101, upper.y + 4);
            const upperMoving = pulleyClippedAt(upperLoop.sub(vec2(0, CLIP)), "down");
            const rest: RopeStop[] = [first, moving, second, upperMoving].map((at) => ({
                ...pulleySheaves(at).large,
                into: 1,
                out: -1,
            }));
            const eye = ropeEye(end, rest[0], ROPE);
            return {
                face: [105, 228],
                hangers,
                pulleys: [
                    { at: first, eye: "up", sheaves: 1, stops: { large: 1 } },
                    { at: moving, eye: "down", sheaves: 1, stops: { large: 2 } },
                    { at: second, eye: "up", sheaves: 1, stops: { large: 3 } },
                    { at: upperMoving, eye: "down", sheaves: 1, stops: { large: 4 } },
                ],
                ropes: [{ stops: [eye.stop, ...rest], eyes: [eye] }],
                clips: [
                    [hangers[0], pulleyEnds(second, "up").clip],
                    [hangers[1], pulleyEnds(first, "up").clip],
                    [pulleyEnds(moving, "down").clip, loop],
                    [pulleyEnds(upperMoving, "down").clip, upperLoop],
                    [load, end],
                ],
                // Each moving pulley's two parts pull its Prusik: the second's, the team's pull; the first's, the three the
                // second Z-rig makes.
                prusiks: [
                    { on: grip, to: loop, pull: 6 },
                    { on: upper, to: upperLoop, pull: 2 },
                ],
                load,
                // Straight up from the second moving pulley's side, round a pin at the top.
                pin: { rope: 0, x: upperMoving.x - r + PIN, edge: "top" },
            };
        },
    },
    "8-to-1-complex": {
        max: 4.4,
        // The single comes down beside the load towards the ground anchor, which room lowers with the load: four times
        // the load's rise, so twice the rope pulled in for each unit of room.
        gain: 2,
        // The 9:1 complex, with the second rope's end spliced to a carabiner on an anchor on the ground rather than on the
        // load: up round the single, and down to the team. The single sits further left, so the second rope runs clear of
        // the load. The load rises an eighth of the rope pulled in, all of it from the 2:1 on the 4:1.
        scene: (pulled, room) => {
            const rise = (pulled * PER_METRE) / 8;
            const hanger = vec2(160, HANGER_Y);
            const top = pulleyClippedAt(hanger.add(vec2(0, CLIP)), "up");
            const bottom = vec2(160, top.y + 300 + room - rise);
            const load = loadUnder(bottom, "down");
            // The ground is a little below the bottom of the load's box where it starts.
            const ground =
                loadUnder(vec2(160, top.y + 300 + room), "down").y + 10 + LOAD_HEIGHT + 40;
            const becket = pulleyEnds(top, "up").becket;
            const end = becket.add(vec2(0, CLIP));
            const [t, b] = [pulleySheaves(top), pulleySheaves(bottom)];
            // The single hangs from a carabiner through the eye at the 4:1's rope's other end.
            const tail = vec2(104, 145 + 4 * rise);
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
            // The second rope's end is spliced round a carabiner on the ground anchor, straight below the single's side.
            const tie = vec2(single.x + s.r, ground - (HANGER_Y - FACE));
            const tieEnd = tie.sub(vec2(0, CLIP));
            const second: RopeStop[] = [{ ...s, into: 1, out: -1 }];
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
                    // Holding the single, which the second rope's two parts pull.
                    { stops: [eye.stop, ...rest, tailEye.stop], eyes: [eye, tailEye], t: 2 },
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
                ground: { y: ground, across: [tie.x - 14, tie.x + 14], hangers: [tie] },
                // The second rope's: leaning away from the single.
                pin: { rope: 1, x: 58 - PIN },
            };
        },
    },
    "9-to-1-complex": {
        max: 2.7,
        // The single comes down to meet the load: room lets it start that much further away, which they close at five
        // times the load's rise.
        gain: 9 / 5,
        // The 4:1 with its team's end spliced to a carabiner on a single pulley, and a second rope tied to the load, up
        // round the single, and down to the team. As the load rises, the 4:1's rope lets the single down four times as
        // far, so the second rope's two parts to it shorten by five times the rise each, and the load rises a ninth of
        // the rope pulled in: eight from the 2:1 on the 4:1, and one from the second rope pulling on the load itself.
        scene: (pulled, room) => {
            const rise = (pulled * PER_METRE) / 9;
            const hanger = vec2(160, HANGER_Y);
            const top = pulleyClippedAt(hanger.add(vec2(0, CLIP)), "up");
            const bottom = vec2(160, top.y + 300 + room - rise);
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
            const second: RopeStop[] = [{ ...s, into: 1, out: -1 }];
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
                    // Holding the single, which the second rope's two parts pull.
                    { stops: [eye.stop, ...rest, tailEye.stop], eyes: [eye, tailEye], t: 2 },
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
                // The second rope's: leaning away from the single.
                pin: { rope: 1, x: 70 - PIN },
            };
        },
    },
    "5-to-1": {
        max: 4,
        gain: 5,
        // Spliced to a carabiner on the bottom pulley's becket, round each sheave in turn, and up past the top pulley to
        // the team. The load rises a fifth of the rope pulled in.
        scene: (pulled, room) => {
            const hanger = vec2(160, HANGER_Y);
            const top = pulleyClippedAt(hanger.add(vec2(0, CLIP)), "up");
            const bottom = vec2(160, top.y + 230 + room - (pulled * PER_METRE) / 5);
            // The rope's end is spliced round a carabiner clipped to the bottom pulley's becket.
            const becket = pulleyEnds(bottom, "down").becket;
            const end = becket.sub(vec2(0, CLIP));
            const [t, b] = [pulleySheaves(top), pulleySheaves(bottom)];
            const rest: RopeStop[] = [
                { ...t.small, into: -1, out: 1 },
                { ...b.small, into: 1, out: -1 },
                { ...t.large, into: -1, out: 1 },
                { ...b.large, into: 1, out: -1 },
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
                // Up past the top pulley, leaning clear of it, round a pin at the top.
                pin: { rope: 0, x: 112 + PIN, edge: "top" },
            };
        },
    },
    "5-to-1-single-pulleys": {
        max: 6,
        gain: 5,
        // The 9:1 Z-rig on Z-rig's pulleys and rope, with both moving pulleys clipped to tabs on the load rather than to
        // Prusiks on the rope. Spliced to a carabiner on the load, up over the first pulley at the anchor, down round
        // the first moving pulley, up over the second at the anchor, down round the second moving pulley, and up to the
        // team. Five parts hold the load, so it rises a fifth of the rope pulled in.
        scene: (pulled, room) => {
            const rise = (pulled * PER_METRE) / 5;
            const hangers = [vec2(133, HANGER_Y), vec2(200, HANGER_Y)];
            const [second, first] = hangers.map((h) => pulleyClippedAt(h.add(vec2(0, CLIP)), "up"));
            const r = pulleySheaves(first).large.r;
            const [moving, upperMoving] = [165, 101].map((x) => vec2(x, 300 + room - rise));
            const ties = [moving, upperMoving].map((at) => loadUnder(at, "down"));
            const load = vec2(first.x + r, ties[0].y);
            const end = load.sub(vec2(0, CLIP));
            const rest: RopeStop[] = [first, moving, second, upperMoving].map((at) => ({
                ...pulleySheaves(at).large,
                into: 1,
                out: -1,
            }));
            const eye = ropeEye(end, rest[0], ROPE);
            return {
                face: [105, 228],
                hangers,
                pulleys: [
                    { at: first, eye: "up", sheaves: 1, stops: { large: 1 } },
                    { at: moving, eye: "down", sheaves: 1, stops: { large: 2 } },
                    { at: second, eye: "up", sheaves: 1, stops: { large: 3 } },
                    { at: upperMoving, eye: "down", sheaves: 1, stops: { large: 4 } },
                ],
                ropes: [{ stops: [eye.stop, ...rest], eyes: [eye] }],
                clips: [
                    [hangers[0], pulleyEnds(second, "up").clip],
                    [hangers[1], pulleyEnds(first, "up").clip],
                    [pulleyEnds(moving, "down").clip, ties[0]],
                    [pulleyEnds(upperMoving, "down").clip, ties[1]],
                    [load, end],
                ],
                load,
                ties,
                // Straight up from the second moving pulley's side, round a pin at the top.
                pin: { rope: 0, x: upperMoving.x - r + PIN, edge: "top" },
            };
        },
    },
    "6-to-1-redirect": {
        max: 7.2,
        gain: 6,
        // The 5:1 with single pulleys, with a third single on the load and at the anchor, side by side, each a sheave's
        // width from the next so the rope runs plumb between them. Spliced to a carabiner on the anchor above the first
        // pulley on the load, down and up round each pulley in turn, and over the last at the anchor down to the team.
        // Six parts hold the load, so it rises a sixth of the rope pulled in.
        scene: (pulled, room) => {
            const rise = (pulled * PER_METRE) / 6;
            const y = 300 + room - rise;
            const r = pulleySheaves(vec2(0, 0)).large.r;
            // From the right: on the load, at the anchor, on the load, and so on.
            const xs = [232, 200, 168, 136, 104, 72];
            const hangers = xs.filter((_, i) => i % 2 === 1).map((x) => vec2(x, HANGER_Y));
            const fixed = hangers.map((h) => pulleyClippedAt(h.add(vec2(0, CLIP)), "up"));
            const moving = xs.filter((_, i) => i % 2 === 0).map((x) => vec2(x, y));
            const ties = moving.map((at) => loadUnder(at, "down"));
            const order = xs.map((_, i) => (i % 2 === 0 ? moving[i / 2] : fixed[(i - 1) / 2]));
            const tie = vec2(xs[0] + r, HANGER_Y);
            const end = tie.add(vec2(0, CLIP));
            const rest: RopeStop[] = order.map((at) => ({
                ...pulleySheaves(at).large,
                into: 1,
                out: -1,
            }));
            const eye = ropeEye(end, rest[0], ROPE);
            return {
                face: [55, 263],
                hangers: [...hangers, tie],
                pulleys: order.map((at, i) => ({
                    at,
                    eye: i % 2 === 0 ? ("down" as const) : ("up" as const),
                    sheaves: 1,
                    stops: { large: i + 1 },
                })),
                ropes: [{ stops: [eye.stop, ...rest], eyes: [eye] }],
                clips: [
                    [tie, end],
                    ...hangers.map((h, i): [Vector2, Vector2] => [
                        h,
                        pulleyEnds(fixed[i], "up").clip,
                    ]),
                    ...moving.map((at, i): [Vector2, Vector2] => [
                        pulleyEnds(at, "down").clip,
                        ties[i],
                    ]),
                ],
                load: ties[0],
                ties: ties.slice(1),
                // Straight down from the last pulley's side, round a pin at the foot.
                pin: { rope: 0, x: xs[5] - r - PIN },
            };
        },
    },
    "7-to-1": {
        max: 5.5,
        gain: 7,
        scene: (pulled, room) => ({
            ...sevenToOne((pulled * PER_METRE) / 7, room),
            // Leaning away from the single, so the team's rope runs clear of it.
            pin: { rope: 0, x: 80 - PIN },
        }),
    },
    "28-to-1": {
        max: 7.5,
        // Room lowers the ground anchor, giving the Prusik further to come down, at a quarter of the rope pulled in.
        gain: 4,
        // The 7:1, with a 4:1 between an anchor on the ground and a Prusik on the 7:1's team's rope, which is slack past
        // it. Spliced to a carabiner on the ground single's becket, up round the double on the Prusik, down round the
        // single, up round the double again, and down to the team. Four parts pull the Prusik down, so it moves a
        // quarter of the 4:1's rope pulled in, pulling the 7:1's rope with it, and the load rises a seventh of that: a
        // 28th of the rope pulled in.
        scene: (pulled, room) => {
            const rise = (pulled * PER_METRE) / 28;
            const ground = 580 + room;
            // The line the 7:1's team's rope runs down, from its last sheave towards the ground.
            const towards = vec2(100, ground);
            const stops = sevenToOne(rise, 0, towards).ropes[0].stops;
            const [from, to] = tangent(stops[stops.length - 2], { c: towards, r: 0 });
            const along = to.sub(from).scale(1 / to.distanceTo(from));
            // The Prusik starts just under the 7:1's top left pulley, and moves down as far as its rope's pulled in.
            const y = 135 + 7 * rise;
            const grip = from.add(along.scale((y - from.y) / along.y));
            // Past it the 7:1's rope is slack: a short tail, fading out.
            const tail = grip.add(along.scale(70));
            const scene = sevenToOne(rise, 0, tail);
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
                // The 7:1's rope is slack past the Prusik, which the 4:1's four parts pull.
                ropes: [
                    { ...scene.ropes[0], t: 0 },
                    { stops: [eye.stop, ...rest], eyes: [eye] },
                ],
                clips: [
                    ...scene.clips,
                    [loop, pulleyEnds(top, "up").clip],
                    [hanger, pulleyEnds(bottom, "down").clip],
                    [becket, end],
                ],
                prusiks: [{ on: grip, to: loop, along, pull: 4 }],
                // Just wider than its hanger's tab, so the pin's readout clears it.
                ground: { y: ground, across: [72, 98], hangers: [hanger] },
                // The 4:1's: leaning away from the single, so the team's rope runs clear of it.
                pin: { rope: 1, x: 26 },
                fade: { rope: 0, from: grip.add(along.scale(8)), to: tail },
            };
        },
    },
} satisfies Record<Slug, Diagram>;

/**
 * How big a drawing unit is drawn (pixels), so every diagram is drawn the same size, and the frame's height beyond a
 * diagram is room for its load to travel further. A screen too small for the tallest diagram at this size, such as a
 * phone's, draws every diagram smaller, at the size that fits it.
 */
const SCALE = 1.5;

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
    const back = y < FACE * 2 ? -HATCH : HATCH;
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

/** How wide the track's band is. */
const BAND = ROPE + 3;
/** The gap either side of the track: between it and the frame, and between it and the edge of the drawing. */
const GAP = 3;
/**
 * The room round the frame for the track, which isn't part of the system: the team's rope leaves the frame round its
 * pin, and runs round the track outside it.
 */
const MARGIN = BAND + 2 * GAP;
/** How far in from the drawing's edge the track's middle runs. */
const INSET = MARGIN / 2;
/** The rope's end's handle: small enough, with its outline, to stay inside the drawing on the track. */
const THUMB = 5;
/** How far from the rope's end's handle it can still be grabbed: about a finger's width across, on a phone. */
const GRAB = 20;
/** How round the frame's corners are. */
const CORNER = 8;

/**
 * The track the team's rope's end runs along, from where it starts (`from`, none pulled in) to as far as there's rope to
 * pull in (`to`), marked every metre from the start.
 */
function Track(props: { track: ReturnType<typeof trackOf>; from: number; to: number }) {
    const { track, from, to } = props;
    const marks = Array.from(
        { length: Math.floor((to - from) / PER_METRE + 1e-9) + 1 },
        (_, k) => k,
    );
    return (
        <g>
            <path
                d={polylinePath(track.between(from, to))}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.2}
                strokeWidth={BAND}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {marks.map((m) => {
                const s = from + m * PER_METRE;
                const p = track.at(s);
                const dir = track.dir(s);
                // The inside of the track, towards the middle of the drawing: to the right as it runs clockwise.
                const inside = vec2(-dir.y, dir.x);
                // Right across the track's band.
                const [a, b] = [p.add(inside.scale(-BAND / 2)), p.add(inside.scale(BAND / 2))];
                return (
                    <line
                        key={m}
                        x1={svgNumber(a.x)}
                        y1={svgNumber(a.y)}
                        x2={svgNumber(b.x)}
                        y2={svgNumber(b.y)}
                        stroke="currentColor"
                        strokeOpacity={0.7}
                        strokeWidth={1}
                    />
                );
            })}
        </g>
    );
}

/** How tall the load's box is. */
const LOAD_HEIGHT = 30;
/** The gap inside the frame above the anchor's hatching, and below the load or the ground anchor's hatching. */
const PADDING = FACE - HATCH;

/** How tall a diagram is with no room to spare: down to the bottom of its load where it starts, or its ground anchor. */
function heightOf(diagram: Diagram) {
    const scene = diagram.scene(0, 0);
    const load = scene.load.y + 10 + LOAD_HEIGHT;
    return Math.max(load, scene.ground ? scene.ground.y + HATCH : 0) + PADDING;
}

/** How tall the tallest diagram is. */
const TALLEST = Math.max(...Object.values(DIAGRAMS).map(heightOf));
/** How far the load must have moved (drawing units) before it's marked, from where its bottom was. */
const MOVED = 0.5;
/** A dimension's arrowheads: how long, and how wide either side of the line. */
const HEAD = 4;
const HEAD_WIDTH = 1.6;

/**
 * A length marked the way drawings mark them, beside something whose right edge is at `x`: an extension line out from
 * it at each of two heights, `from` and `to`, a dimension line between them with an arrowhead at each end pointing out
 * to them, and the length between in metres beside it. When the two are too close for the arrowheads to fit between,
 * they sit outside, pointing in.
 */
function Dimension({ x, from, to }: { x: number; from: number; to: number }) {
    const line = x + 12;
    const [top, bottom] = [Math.min(from, to), Math.max(from, to)];
    const fits = bottom - top >= 2 * HEAD + 2;
    // An arrowhead with its tip at `tip`, pointing `way` (1 down, -1 up).
    const head = (tip: number, way: 1 | -1) => {
        const base = tip - way * HEAD;
        return `M ${svgPoint(vec2(line, tip))} L ${svgPoint(vec2(line - HEAD_WIDTH, base))} L ${svgPoint(vec2(line + HEAD_WIDTH, base))} Z`;
    };
    const stroke = { stroke: "currentColor", strokeWidth: 0.75 };
    return (
        <g className="text-ink-muted" opacity={0.7}>
            {[top, bottom].map((y) => (
                <line
                    key={y}
                    x1={x + 3}
                    y1={svgNumber(y)}
                    x2={line + 4}
                    y2={svgNumber(y)}
                    {...stroke}
                />
            ))}
            <line
                x1={line}
                y1={svgNumber(fits ? top : top - 2 * HEAD)}
                x2={line}
                y2={svgNumber(fits ? bottom : bottom + 2 * HEAD)}
                {...stroke}
            />
            <path
                d={
                    fits
                        ? `${head(top, -1)} ${head(bottom, 1)}`
                        : `${head(top, 1)} ${head(bottom, -1)}`
                }
                fill="currentColor"
            />
            <text
                x={line + 5}
                y={svgNumber((top + bottom) / 2)}
                fontSize={8}
                dominantBaseline="central"
                className="fill-current font-mono"
            >
                {((bottom - top) / PER_METRE).toFixed(2)} m
            </text>
        </g>
    );
}

/** Where a tension's label goes, and its place in the order the T-method finds them. */
type Mark = { at: Vector2; order: number };

/**
 * A straight run of rope between sheaves or grips, which rope it's on, its tension in team pulls, and where its tension
 * is labelled: by each of its ends, or on the carabiner an end is spliced round.
 */
type Strand = { from: Vector2; to: Vector2; rope: number; t: number; labels: Mark[] };

/**
 * How far along a strand from where it leaves a sheave its label sits: past the pulley's plate, and further from a
 * double's smaller sheave than its larger, so labels on strands running side by side don't meet. From a Prusik or the
 * pin, less.
 */
const LABEL_FROM = { large: 28, small: 42, grip: 10, pin: 16 };

/**
 * Each straight run of rope in `scene` and its tension, for ropes through `stops` (the team's rope's on to its end on
 * the track, which isn't counted past its pin). Walking back along each rope from its last end, its tension starts at
 * the rope's own and rises by each Prusik's pull as it passes the Prusik, splitting the run the Prusik grips. That's
 * the T-method's order, so the labels are numbered in it: the team's rope first, and on each rope, from its last end
 * back, each strand's far end then its near one.
 */
function strandsOf(scene: Scene, stops: RopeStop[][]): Strand[] {
    const sheaves = pulleySheaves(vec2(0, 0));
    const ropes = scene.ropes.map((_, r) => r);
    const first = scene.pin?.rope ?? 0;
    let n = 0;
    const mark = (at: Vector2 | undefined): Mark | undefined => at && { at, order: n++ };
    return [first, ...ropes.filter((r) => r !== first)].flatMap((r) => {
        const rope = scene.ropes[r];
        const count = rope.stops.length - 1 + (scene.pin?.rope === r ? 1 : 0);
        const grips = (scene.prusiks ?? []).filter((k) => (k.rope ?? 0) === r);
        // Where the label goes for a strand's end at `stop`, leaving it `at` towards `on`: on the carabiner if the
        // end's spliced round one, or along the strand from the sheave or pin (no further than halfway); none at a
        // loose end.
        const labelAt = (stop: RopeStop, at: Vector2, on: Vector2): Vector2 | undefined => {
            const eye = rope.eyes.find((e) => e.stop === stop);
            if (eye) {
                const clip = scene.clips.find(([a, b]) => same(a, eye.end) || same(b, eye.end));
                return clip ? clip[0].mid(clip[1]) : eye.end;
            }
            if (stop.r === 0) return undefined;
            const by =
                stop.r === sheaves.large.r
                    ? LABEL_FROM.large
                    : stop.r === sheaves.small.r
                      ? LABEL_FROM.small
                      : LABEL_FROM.pin;
            return at.add(
                on
                    .sub(at)
                    .unit()
                    .scale(Math.min(by, at.distanceTo(on) / 2)),
            );
        };
        // Each strand, with no label for a loose end yet left out.
        const out: (Omit<Strand, "labels"> & { labels: (Mark | undefined)[] })[] = [];
        let t = rope.t ?? 1;
        for (let i = count - 1; i >= 0; i--) {
            const [p, q] = tangent(stops[r][i], stops[r][i + 1]);
            const run = new Segment(p, q);
            // The Prusiks on this run, from its far end back.
            const on = grips
                .filter((k) => run.distanceTo(k.on) < 1)
                .map((k) => ({ ...k, at: run.nearest(k.on).t }))
                .sort((a, b) => b.at - a.at);
            let end = q;
            let endLabel = mark(labelAt(stops[r][i + 1], q, p));
            for (const k of on) {
                const ahead = mark(k.on.add(run.direction().scale(LABEL_FROM.grip)));
                out.push({ from: k.on, to: end, rope: r, t, labels: [ahead, endLabel] });
                t += k.pull;
                end = k.on;
                endLabel = mark(k.on.sub(run.direction().scale(LABEL_FROM.grip)));
            }
            const startLabel = mark(labelAt(stops[r][i], p, q));
            out.push({ from: p, to: end, rope: r, t, labels: [startLabel, endLabel] });
        }
        return out.reverse().map((s) => ({ ...s, labels: s.labels.filter((l): l is Mark => !!l) }));
    });
}

/** Whether two points are the same, give or take rounding. */
const same = (a: Vector2, b: Vector2) => a.distanceTo(b) < 0.5;

/**
 * The force through each of `scene`'s carabiners, in team pulls, from what it holds at either end: a rope's eye, its
 * rope's tension there; a Prusik's loop, its pull; a pulley, the tension in every strand on its sheaves and whatever's
 * clipped to its becket. A carabiner with a rope spliced round it is left out, as is one between two things that hold
 * nothing of their own (a hanger and a load's tab). Each comes in the T-method's order just after the last label it's
 * found from.
 */
function carabinersOf(scene: Scene, strands: Strand[]): (Mark & { t: number })[] {
    const last = (s: Strand[]) => Math.max(-1, ...s.flatMap((o) => o.labels.map((l) => l.order)));
    const eyes = scene.ropes.flatMap((rope, r) => {
        const mine = strands.filter((s) => s.rope === r);
        return rope.eyes.map((eye) => {
            const strand = eye.stop === rope.stops[0] ? mine[0] : mine[mine.length - 1];
            return { end: eye.end, t: strand.t, order: last([strand]) };
        });
    });
    const pulleyAt = (p: Vector2) => {
        const q = scene.pulleys.find((q) => same(pulleyEnds(q.at, q.eye).clip, p));
        if (!q) return undefined;
        const { large, small } = pulleySheaves(q.at);
        const radii = q.sheaves === 2 ? [large.r, small.r] : [large.r];
        const onSheaves = strands.filter((s) =>
            [s.from, s.to].some((e) => radii.some((r) => Math.abs(e.distanceTo(q.at) - r) < 0.5)),
        );
        const becket = pulleyEnds(q.at, q.eye).becket;
        const onBecket = scene.clips.flatMap(([a, b]) => {
            if (!same(a, becket) && !same(b, becket)) return [];
            const f = forceAt(same(a, becket) ? b : a);
            return f ? [f] : [];
        });
        return {
            t: [...onSheaves, ...onBecket].reduce((sum, f) => sum + f.t, 0),
            order: Math.max(last(onSheaves), ...onBecket.map((f) => f.order)),
        };
    };
    const forceAt = (p: Vector2): { t: number; order: number } | undefined =>
        pulleyAt(p) ??
        eyes.find((e) => same(e.end, p)) ??
        scene.prusiks?.filter((k) => same(k.to, p)).map((k) => ({ t: k.pull, order: -1 }))[0];
    return scene.clips.flatMap(([a, b]) => {
        // One with a rope spliced round it carries what the rope's strand does, which is labelled already.
        if (eyes.some((e) => same(e.end, a) || same(e.end, b))) return [];
        const f = pulleyAt(a) ?? pulleyAt(b) ?? forceAt(a) ?? forceAt(b);
        return f ? [{ at: a.mid(b), t: f.t, order: f.order + 0.5 }] : [];
    });
}

/** How tall a tension's label is. */
const TAG = 9;

/**
 * Each strand's tension, labelled by both its ends in team pulls ("3T"), except slack ones, and the force through each
 * carabiner holding a pulley or a Prusik, on it.
 */
function Tensions(props: { strands: Strand[]; carabiners: (Mark & { t: number })[] }) {
    const all = [
        ...props.strands
            .filter((s) => s.t > 0)
            .flatMap((s) => s.labels.map((l) => ({ ...l, t: s.t }))),
        ...props.carabiners,
    ];
    // A label that would cover one saying the same, earlier in the order (both ends of a short strand), is left out.
    const labels = all.filter(
        (l) =>
            !all.some((o) => o.order < l.order && o.t === l.t && o.at.distanceTo(l.at) < TAG * 1.5),
    );
    return (
        <g aria-hidden>
            {labels.map((l, i) => (
                <Tag key={i} at={l.at} t={l.t} />
            ))}
        </g>
    );
}

/** A tension's label: `t` team pulls, in a pill centred `at`. */
function Tag({ at, t }: { at: Vector2; t: number }) {
    const text = `${t}T`;
    const width = text.length * 4.5 + 5;
    return (
        <g>
            <rect
                x={svgNumber(at.x - width / 2)}
                y={svgNumber(at.y - TAG / 2)}
                width={width}
                height={TAG}
                rx={TAG / 2}
                className="fill-surface"
                stroke="var(--pull)"
                strokeWidth={1}
            />
            <text
                x={svgNumber(at.x)}
                y={svgNumber(at.y)}
                dominantBaseline="central"
                textAnchor="middle"
                fontSize={7}
                fill="var(--pull)"
                className="font-mono"
            >
                {text}
            </text>
        </g>
    );
}

/** A pulley system drawn as it looks, with the team's rope's end to drag round its track to pull the rope in. */
export function SystemDrawing({ slug, tensions }: { slug: Slug; tensions?: boolean }) {
    const [pulled, setPulled] = useState(0);
    const svg = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState(false);
    const diagram: Diagram = DIAGRAMS[slug];
    const system = SYSTEMS.find((s) => s.slug === slug)!;
    // The drawing fills the box the page gives it, every diagram at the same scale: the room either side of it, in
    // drawing units, and how tall the box is, so the track can run round the box's edge, with room to spare below the
    // diagram. Until the box is measured, it takes the diagram's own shape.
    const [box, setBox] = useState<{ width: number; height: number } | null>(null);
    useEffect(() => {
        const el = svg.current;
        if (!el) return;
        const watch = new ResizeObserver(() => {
            const { width, height } = el.getBoundingClientRect();
            setBox({ width, height });
        });
        watch.observe(el);
        return () => watch.disconnect();
    }, []);
    const scale =
        box && Math.min(SCALE, box.width / (320 + 2 * MARGIN), box.height / (TALLEST + 2 * MARGIN));
    const spare = scale ? Math.max(0, box.width / scale - 2 * MARGIN - 320) : 0;
    const base = heightOf(diagram);
    const height = Math.max(base, scale ? box.height / scale - 2 * MARGIN : 0);
    // The whole drawing, the frame and the margin round it.
    const [x0, y0, across, down] = [
        -spare / 2 - MARGIN,
        -MARGIN,
        320 + spare + 2 * MARGIN,
        height + 2 * MARGIN,
    ];
    // The room below the diagram lets its load start lower, so there's more rope to pull in.
    const room = height - base;
    const rest = diagram.scene(0, room);
    // The team's rope's track (its pin stays put as the rope's pulled in), and where along it the rope's end is: as far
    // past its start as the rope's pulled in, but never so far it runs off the track's end.
    const track =
        rest.pin &&
        trackOf(rest.pin.x, rest.pin.edge ?? "bottom", x0, y0, x0 + across, y0 + down, INSET);
    // Down to the centimetre, as the rope's end steps.
    const max =
        Math.floor(
            Math.min(
                diagram.max * PER_METRE + room * diagram.gain,
                track ? track.length - LEAD - THUMB : Infinity,
            ),
        ) / PER_METRE;
    const amount = Math.min(pulled, max);
    const scene = diagram.scene(amount, room);
    const [start, finish] = [LEAD, LEAD + max * PER_METRE];
    const reach = start + amount * PER_METRE;
    const stops = scene.ropes.map((rope, r) =>
        track && scene.pin?.rope === r ? [...rope.stops, ...track.stops(reach)] : rope.stops,
    );
    const ropes = stops.map(ropePieces);
    const strands = strandsOf(scene, stops);
    // Drag the rope's end along its track: the nearest point on it to the pointer, within the rope there is to pull.
    const drag = (e: React.PointerEvent) => {
        const ctm = svg.current?.getScreenCTM();
        if (!dragging || !track || !ctm) return;
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
        setPulled(Math.round(track.nearest(vec2(p.x, p.y), start, finish) - start) / PER_METRE);
    };
    // Grabbing the rope's end, by its handle or the room round it.
    const grab = {
        onPointerDown: (e: React.PointerEvent<SVGCircleElement>) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
        },
        onPointerUp: () => setDragging(false),
        onPointerCancel: () => setDragging(false),
    };
    // A touch starting on the rope's end mustn't scroll the page, or the browser takes the touch over and the drag stops
    // there. Shapes inside an SVG ignore `touch-action`, so it's stopped as it starts instead, which needs a listener
    // that isn't passive.
    const holdTouch = useCallback((el: SVGGElement | null) => {
        if (!el) return;
        const hold = (e: TouchEvent) => e.preventDefault();
        el.addEventListener("touchstart", hold, { passive: false });
        return () => el.removeEventListener("touchstart", hold);
    }, []);
    const step = (by: number) =>
        setPulled(Math.min(Math.max(Math.round((amount + by) * 100) / 100, 0), max));
    // Each piece of rope, and whether it's the slack one that fades out.
    const pieces = ropes.flatMap((rope, r) =>
        rope.pieces.map((piece, k) => ({
            piece,
            fades: scene.fade?.rope === r && k === rope.pieces.length - 1,
        })),
    );
    const loadTop = scene.load.y + 10;
    const startTop = rest.load.y + 10;
    // The load's box reaches past its tabs: 30 either side of a lone one, less past several, so it stays narrow.
    const tabs = [scene.load, ...(scene.ties ?? [])].map((t) => t.x);
    const past = tabs.length > 1 ? 20 : 30;
    const [left, wide] = [
        Math.min(...tabs) - past,
        Math.max(...tabs) - Math.min(...tabs) + 2 * past,
    ];
    return (
        <div className="flex min-h-105 flex-1">
            <svg
                ref={svg}
                viewBox={[x0, y0, across, down].map(svgNumber).join(" ")}
                className="h-full w-full overflow-visible text-ink-muted"
                role="group"
                aria-label={`${system.name}: ${system.text}`}
                onPointerMove={drag}
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
                            <rect
                                x={svgNumber(x0)}
                                y={svgNumber(y0)}
                                width={svgNumber(across)}
                                height={svgNumber(down)}
                                fill="url(#slack-fade)"
                            />
                        </mask>
                    </defs>
                )}
                {/* The frame round the system. */}
                <rect
                    x={svgNumber(-spare / 2)}
                    width={svgNumber(320 + spare)}
                    height={svgNumber(height)}
                    rx={CORNER}
                    className="fill-surface stroke-border"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                />
                {/* The anchors, with their hangers. */}
                <Anchor y={FACE} across={scene.face} hangers={scene.hangers} />
                {scene.ground && <Anchor {...scene.ground} />}
                {track && <Track track={track} from={start} to={finish} />}
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
                                            p.stops.small === undefined ? 0 : spins[p.stops.small],
                                    }}
                                />
                            );
                        })}
                    </g>
                ))}
                {/* Where the load started, dashed, behind it. */}
                {startTop - loadTop > MOVED && (
                    <rect
                        x={left}
                        y={svgNumber(startTop)}
                        width={wide}
                        height={LOAD_HEIGHT}
                        fill="none"
                        stroke="currentColor"
                        strokeOpacity={0.6}
                        strokeWidth={1}
                        strokeDasharray="3 2"
                    />
                )}
                {/* The load, with its tabs, and how far it's risen. */}
                {[scene.load, ...(scene.ties ?? [])].map((t, i) => (
                    <Tab key={i} hole={t} base={loadTop} />
                ))}
                <rect x={left} y={loadTop} width={wide} height={LOAD_HEIGHT} fill="currentColor" />
                {startTop - loadTop > MOVED && (
                    <Dimension
                        x={left + wide}
                        from={startTop + LOAD_HEIGHT}
                        to={loadTop + LOAD_HEIGHT}
                    />
                )}
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
                {tensions && (
                    <Tensions strands={strands} carabiners={carabinersOf(scene, strands)} />
                )}
                {/* The pin the team's rope turns round, and its end, which is dragged along the track to pull it in. */}
                {track && (
                    <>
                        {/* Solid, over the frame's edge it sits on. */}
                        <circle
                            cx={svgNumber(track.pin.x)}
                            cy={svgNumber(track.pin.y)}
                            r={PIN - ROPE / 2}
                            className="fill-surface"
                        />
                        <circle
                            cx={svgNumber(track.pin.x)}
                            cy={svgNumber(track.pin.y)}
                            r={PIN - ROPE / 2}
                            fill="currentColor"
                            fillOpacity={0.3}
                            stroke="currentColor"
                            strokeWidth={1.5}
                        />
                        {/*
                         * How much rope has come off the pin: across the rope from it (left of the rope rising to
                         * a pin at the top, right of the rope coming down to one at the foot), in the middle of the
                         * frame's padding on the pin's edge.
                         */}
                        <text
                            x={svgNumber(
                                scene.pin?.edge === "top"
                                    ? track.pin.x - PIN - 6
                                    : track.pin.x + PIN + 6,
                            )}
                            y={svgNumber(
                                scene.pin?.edge === "top" ? PADDING / 2 : height - PADDING / 2,
                            )}
                            dominantBaseline="central"
                            textAnchor={scene.pin?.edge === "top" ? "end" : "start"}
                            fontSize={8}
                            className="fill-ink-muted font-mono"
                            opacity={0.7}
                        >
                            {amount.toFixed(2)} m
                        </text>
                        {/* A finger on the rope's end drags it, not the page. */}
                        <g ref={holdTouch}>
                            {/* Room round it to grab it by, wide enough for a finger. */}
                            <circle
                                cx={svgNumber(track.at(reach).x)}
                                cy={svgNumber(track.at(reach).y)}
                                r={GRAB}
                                fill="none"
                                pointerEvents="all"
                                className={dragging ? "cursor-grabbing" : "cursor-grab"}
                                {...grab}
                            />
                            <circle
                                cx={svgNumber(track.at(reach).x)}
                                cy={svgNumber(track.at(reach).y)}
                                r={THUMB}
                                className={`fill-action stroke-background outline-none focus-visible:stroke-ink ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                                strokeWidth={1.5}
                                tabIndex={0}
                                role="slider"
                                aria-label="Rope pulled in"
                                aria-valuemin={0}
                                aria-valuemax={max}
                                aria-valuenow={amount}
                                aria-valuetext={`${amount.toFixed(2)} m`}
                                {...grab}
                                onKeyDown={(e) => {
                                    const by = {
                                        ArrowUp: 0.05,
                                        ArrowRight: 0.05,
                                        ArrowDown: -0.05,
                                        ArrowLeft: -0.05,
                                        PageUp: 0.5,
                                        PageDown: -0.5,
                                        Home: -max,
                                        End: max,
                                    }[e.key];
                                    if (by === undefined) return;
                                    e.preventDefault();
                                    step(by);
                                }}
                            />
                        </g>
                    </>
                )}
            </svg>
        </div>
    );
}

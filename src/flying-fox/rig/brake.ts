import {
    CHAIN_WEIGHT,
    chainWeight,
    chainWeightPieces,
    type ChainWeight,
} from "@/flying-fox/chain-weight";
import { C, STOP_BLOCK_COLORS, STOP_BLOCK_EYE } from "@/flying-fox/colors";
import {
    BLOCKS_X,
    BRAKE,
    groundY,
    HAWSER_R,
    HAWSER_Z,
    hawserY,
    onGround,
    onHawser,
    SHEAR_LEG,
    SPAR_X,
    STABILISER_PULLEY,
    STATIC_X,
} from "@/flying-fox/site";
import { turnBetween, vec3, type Vector3 } from "@/lib/vector3";
import { carabiner, CARABINER_R, shackle, stopBlock, tiedRound } from "@/rigging/hardware";
import { figure8 } from "@/rigging/knots";
import { hanging, line, towards } from "@/rigging/rope";
import { type Piece } from "@/scene/pieces";
import { moved, posed, type Pose } from "@/scene/transforms";

import { ACROSS, picket, rigPulley, sagLike, UP } from "./shared";

/** The brakes at the bottom end: the dynamic brake (its blocks, brake line, pulley and chain weight, posed as a run moves them) and the static brakes. */

/** How far the trolley's pushed block A down the span, and how hawser A hangs (its height at each `x`). */
export type BrakeState = {
    pushed?: number;
    pushedB?: number;
    heightA?: (x: number) => number;
    heightB?: (x: number) => number;
};

/**
 * The dynamic brake, built to move: what stays put, the rigid parts (built about their own origins, so they can be
 * moved and turned whole), and for any state, where each rigid part goes and the ropes between them.
 */
export type BrakeRig = {
    fixed: Piece[];
    parts: { name: string; pieces: Piece[] }[];
    pose: (state?: BrakeState) => { poses: Map<string, Pose>; ropes: Piece[]; weight: ChainWeight };
};

/**
 * The dynamic brake: a nylon block on each hawser, joined by a rope with its middle tied to the brake line, which runs
 * back up the span to the tower's pulley and down to the chain; and the stabiliser, a shock cord from the same middle
 * back to the shear leg's bottom spar, holding the chain's first links just off the ground. Then the chain weight,
 * hanging from the brake line's end and piled on the ground, its end tied off to a picket.
 *
 * As the trolley pushes block A down the span, the blocks, the knots, the middle carabiner and the chain's top move
 * whole (the knots turning to follow their ropes), and the ropes between them, which don't stretch, are drawn again
 * between their ends. The pulleys stay as they're rigged at rest.
 */
export function brakeRig(): BrakeRig {
    const ropeR = 0.004;
    const clip = 0.11;
    const ahead = vec3(1, 0, 0);
    const Z = vec3(0, 0, 1);
    // The joining rope: 2.5 m with its knots tied, its middle drawn up the span by the brake line.
    const half = 1.25;
    /** Where a block sits on hawser `s` at `x` (hawser A hanging as `height` has it), and the wire's slope there. */
    const seat = (x: number, s: number, height: (x: number) => number) => {
        const on = (x: number) => vec3(x, height(x), s * HAWSER_Z);
        const along = on(x + 0.1)
            .sub(on(x - 0.1))
            .unit();
        return { at: on(x), along, slope: Math.atan2(along.y, along.x) };
    };
    /** The joining rope's middle, where both legs reach, as far up the span as they let the brake line draw it. */
    const middleOf = (eyeB: Vector3, eyeA: Vector3) => {
        const between = eyeA.sub(eyeB);
        const across = between.len() / 2;
        const e = between.unit();
        const up = ahead.neg();
        const w = up.sub(e.scale(up.dot(e))).unit();
        return eyeB
            .lerp(eyeA, 0.5)
            .add(w.scale(Math.sqrt(Math.max(half * half - across * across, 0))))
            .add(vec3(0, -0.05, 0));
    };

    // At rest: the blocks where they're set, on the hawsers hanging unloaded.
    const blocks = [1, -1].map((s) => {
        const at = seat(BLOCKS_X, s, hawserY);
        // The joining rope's tied to the eye on the inside, towards the other hawser.
        const block = stopBlock(at.at, at.along, UP, vec3(0, 0, -s), HAWSER_R, STOP_BLOCK_COLORS);
        return { s, ...at, pieces: block.pieces, eye: block.inner };
    });
    const [blockA, blockB] = blocks;
    const apex = middleOf(blockB.eye, blockA.eye);

    // The middle: one carabiner lying along the span (Figure 55), the brake line clipped into its uphill end, and the
    // joining rope's middle and the stabiliser side by side in its downhill end. The brake line and the stabiliser
    // each end in a figure 8 on a bight. The joining rope's middle is really an alpine butterfly: until that's drawn,
    // it takes a turn round the carabiner's bar.
    const downhill = apex.sub(ahead.scale(CARABINER_R + ropeR));
    const uphill = downhill.sub(ahead.scale(clip));
    const middle: Piece[] = [...carabiner(uphill, ahead, ACROSS, C.oval, clip, { shape: "oval" })];
    const knot = tiedRound(
        downhill.add(ACROSS.scale(0.008)),
        ACROSS,
        CARABINER_R,
        apex.add(ahead),
        ropeR,
    );
    middle.push(...line(knot.turn, ropeR, C.joining));
    const brakeEye = figure8(uphill, ACROSS, CARABINER_R, uphill.sub(ahead), 0.004);
    middle.push(...line(brakeEye.rope, 0.004, C.brakeLine, "rope", { a: true }));
    // The stabiliser: shock cord, stretched, from the joining rope's middle to the pulley under the shear leg's top spar
    // and down from it, tied off to the bottom spar with natural fibre rope. Its eye's in the carabiner's downhill end,
    // beside the joining rope's knot.
    const g = groundY(SHEAR_LEG.x);
    const centre = STABILISER_PULLEY.add(vec3(0, g, 0));
    const tie = vec3(SPAR_X, g + SHEAR_LEG.lower + SHEAR_LEG.r + 0.35, 0);
    const spar = vec3(SPAR_X, g + SHEAR_LEG.lower + SHEAR_LEG.r, 0);
    const cordEye = figure8(downhill.sub(ACROSS.scale(0.008)), ACROSS, CARABINER_R, centre, 0.005);
    middle.push(...line(cordEye.rope, 0.005, C.shockCord, "rope", { a: true }));

    // The joining rope's legs, out from the knot to each block's eye, tied into the eye's bar: really a rethreaded
    // figure 8 (drawn as a figure 8 on a bight). Each knot's built about the eye, and turns with its leg.
    const eyeKnots = blocks.map((b) => {
        const level = knot.from.sub(b.eye);
        const w = vec3(level.x, 0, level.z).unit();
        const t = figure8(
            b.eye.add(w.scale(STOP_BLOCK_EYE.r)),
            UP.cross(w),
            STOP_BLOCK_EYE.bar,
            knot.from,
            ropeR,
        );
        return {
            pieces: moved(line(t.rope, ropeR, C.joining, "rope", { a: true }), b.eye.neg()),
            end: t.end.sub(b.eye),
            toward: knot.from.sub(b.eye),
        };
    });

    // The brake line, back up the span to the pulley on the brake support's arm and straight down to the chain,
    // clipped into the eye bolt under the arm, its eye turned to face the pull.
    const reach = hanging(brakeEye.end, BRAKE.pulley, sagLike(brakeEye.end, BRAKE.pulley), 50);
    const brake = rigPulley(BRAKE.pulley, reach[reach.length - 3], BRAKE.chainTop, 0.004, {
        eyeBolt: { base: BRAKE.eye, out: vec3(0, -1, 0) },
    });
    // Tied round the crown of the shackle the chain weight's ring hangs on: the chain's top, built about where it is at
    // rest. The shackle's pin runs through the ring, square to it.
    const top = BRAKE.chainTop;
    const ringFace = ACROSS.cross(UP);
    const sh = CHAIN_WEIGHT.shackle;
    const crownBar = top.add(UP.scale(sh.body));
    const chainKnot = figure8(crownBar, ringFace, sh.body, brake.round.at(-1)!, 0.004);
    const chainTop = moved(
        [
            ...shackle("bow", top, UP.neg(), UP.neg().cross(ringFace), C.steel, C.pin, sh).pieces,
            ...line(chainKnot.rope, 0.004, C.brakeLine, "rope", { a: true }),
        ],
        top.neg(),
    );
    const stabiliser = rigPulley(centre, cordEye.end, tie, 0.005, {
        basket: {
            spar: vec3(SPAR_X, g + SHEAR_LEG.spar, 0),
            along: ACROSS,
            r: SHEAR_LEG.r,
            drop: SHEAR_LEG.r + 0.25,
        },
    });

    // What stays put: the pulleys and the brake line round its pulley, the stabiliser's tie, and the static brakes'
    // pickets (the chain weight is drawn as it's lifted).
    const statics = staticBrakes();
    const fixed: Piece[] = [
        ...brake.pieces,
        ...line(brake.round, 0.004, C.brakeLine),
        ...stabiliser.pieces,
        ...line([...stabiliser.round, tie], 0.005, C.shockCord),
        ...line([tie, spar], 0.006, C.fibre, "rail"),
        ...statics.fixed,
    ];
    const under = onGround(top.x, 0, top.z);

    const parts = [
        { name: "block-a", pieces: moved(blockA.pieces, blockA.at.neg()) },
        { name: "block-b", pieces: moved(blockB.pieces, blockB.at.neg()) },
        { name: "knot-a", pieces: eyeKnots[0].pieces },
        { name: "knot-b", pieces: eyeKnots[1].pieces },
        { name: "middle", pieces: moved(middle, apex.neg()) },
        { name: "chain-top", pieces: chainTop },
        ...statics.parts,
    ];

    const pose = ({
        pushed = 0,
        pushedB = 0,
        heightA = hawserY,
        heightB = hawserY,
    }: BrakeState = {}) => {
        // Each block on its hawser, turned with the wire's slope, and its eye with it.
        const place = (b: (typeof blocks)[number], x: number, height: (x: number) => number) => {
            const at = seat(x, b.s, height);
            const angle = at.slope - b.slope;
            return {
                pose: { at: at.at, axis: Z, angle },
                eye: at.at.add(b.eye.sub(b.at).turned(Z, angle)),
            };
        };
        let a = place(blockA, BLOCKS_X + pushed, heightA);
        let b = place(blockB, BLOCKS_X + pushedB, heightB);
        // One block pushed far enough that the joining rope's legs can't both reach its middle, it drags the other.
        const legs = 2 * half * 0.995;
        const gap = a.eye.sub(b.eye);
        const level = legs * legs - gap.y * gap.y - gap.z * gap.z;
        if (gap.len() > legs && level > 0) {
            if (gap.x > 0)
                b = place(blockB, BLOCKS_X + pushedB + gap.x - Math.sqrt(level), heightB);
            else a = place(blockA, BLOCKS_X + pushed - gap.x - Math.sqrt(level), heightA);
        }
        const lift = Math.max(pushed, pushedB);
        const mid = middleOf(b.eye, a.eye);
        const by = mid.sub(apex);
        const from = knot.from.add(by);
        const poses = new Map<string, Pose>([
            ["block-a", a.pose],
            ["block-b", b.pose],
            ["middle", { at: mid, axis: Z, angle: 0 }],
            ["chain-top", { at: top.add(vec3(0, lift, 0)), axis: Z, angle: 0 }],
        ]);
        const ropes: Piece[] = [];
        [a, b].forEach((block, i) => {
            const k = eyeKnots[i];
            const turn = turnBetween(k.toward, from.sub(block.eye));
            poses.set(i === 0 ? "knot-a" : "knot-b", { at: block.eye, ...turn });
            // Its leg, sagging a touch out to the middle.
            const end = block.eye.add(k.end.turned(turn.axis, turn.angle));
            ropes.push(...line(hanging(end, from, 0.03, 8), ropeR, C.joining));
        });
        // The brake line up the span to the pulley, sagging much as the hawsers do, and from the pulley straight down
        // to the chain's top as it's lifted.
        const brakeFrom = brakeEye.end.add(by);
        ropes.push(
            ...line(
                hanging(brakeFrom, brake.a, sagLike(brakeFrom, brake.a), 50),
                0.004,
                C.brakeLine,
            ),
        );
        const lifted = top.add(vec3(0, lift, 0));
        ropes.push(
            ...line([brake.round.at(-1)!, chainKnot.end.add(vec3(0, lift, 0))], 0.004, C.brakeLine),
        );
        // The chain weight, hanging from its top as it's lifted.
        const weight = chainWeight(under, lifted.y - under.y, ACROSS);
        // The static brakes, on the hawsers as they hang now.
        const held = statics.pose([heightA, heightB]);
        for (const [name, p] of held.poses) poses.set(name, p);
        ropes.push(...held.ropes);
        // The stabiliser from its eye back to its pulley.
        ropes.push(...line([cordEye.end.add(by), stabiliser.round[0]], 0.005, C.shockCord));
        return { poses, ropes, weight };
    };
    return { fixed, parts, pose };
}

/** The dynamic brake and its chain weight, with block A pushed `pushed` down the span (as one set of pieces). */
export function brakePieces(state: BrakeState = {}, rig = brakeRig()): Piece[] {
    const { poses, ropes, weight } = rig.pose(state);
    return [
        ...rig.fixed,
        ...rig.parts.flatMap((p) => posed(p.pieces, poses.get(p.name)!)),
        ...ropes,
        ...chainWeightPieces(weight, C.steel),
    ];
}

/**
 * The static brakes: a carabiner clipped round each hawser, hanging towards the pull of a rope tied to it and out to a
 * picket 2.5 m to its side (Figure 55).
 */
function staticBrakes() {
    const length = 0.11;
    const fixed: Piece[] = [];
    const parts: { name: string; pieces: Piece[] }[] = [];
    const sides = [1, -1].map((s) => {
        const at = onHawser(STATIC_X, s);
        const base = vec3(STATIC_X, 0, s * (HAWSER_Z + 2.5));
        const pk = picket(base, towards(at, base));
        // Square to the hawser, swung to the rope's pull, the wire in its top bend.
        const pull = pk.tie.sub(at);
        const down = vec3(0, pull.y, pull.z).unit();
        const across = down.cross(vec3(1, 0, 0)).unit();
        const top = at.sub(down.scale(HAWSER_R + CARABINER_R));
        const t = figure8(top.add(down.scale(length)), across, CARABINER_R, pk.tie, 0.0055);
        fixed.push(...pk.pieces);
        parts.push({
            name: s > 0 ? "static-a" : "static-b",
            pieces: moved(
                [
                    ...carabiner(top, down, across, C.steel, length),
                    ...line(t.rope, 0.0055, C.staticBrake, "rope", { a: true }),
                ],
                at.neg(),
            ),
        });
        return { s, at, end: t.end, tie: pk.tie, rope: t.end.distanceTo(pk.tie) };
    });
    /**
     * Each carabiner where its hawser is now at the static brakes (`heights`, hawser A's then B's), and its rope out
     * to its picket: as long as it was rigged, so it sags when the hawser's lower and pulls straight when it's higher.
     */
    const pose = (heights: [(x: number) => number, (x: number) => number]) => {
        const poses = new Map<string, Pose>();
        const ropes: Piece[] = [];
        for (const [i, b] of sides.entries()) {
            const at = vec3(STATIC_X, heights[i](STATIC_X), b.at.z);
            poses.set(b.s > 0 ? "static-a" : "static-b", { at, axis: vec3(0, 0, 1), angle: 0 });
            const end = b.end.add(at.sub(b.at));
            const chord = end.distanceTo(b.tie);
            const sag = b.rope > chord ? Math.sqrt((3 * chord * (b.rope - chord)) / 8) : 0;
            ropes.push(...line(hanging(end, b.tie, sag, 20), 0.0055, C.staticBrake));
        }
        return { poses, ropes };
    };
    return { fixed, parts, pose };
}

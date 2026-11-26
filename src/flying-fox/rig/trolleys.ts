import { C, TROLLEY_COLORS } from "@/flying-fox/colors";
import {
    groundY,
    HAWSER_R,
    onHawser,
    RETURN_EYE_Z,
    RETURN_PULLEY,
    RIDER,
    TROLLEY_X,
} from "@/flying-fox/site";
import { turnBetween, vec3, type Vector3 } from "@/lib/vector3";
import { carabiner, CARABINER_R, grigri, zipTrolley } from "@/rigging/hardware";
import { carabinerKnot, figure8, stopper, tiedTo } from "@/rigging/knots";
import { hanging, line } from "@/rigging/rope";
import { type Piece } from "@/scene/pieces";
import { moved, type Pose } from "@/scene/transforms";

import { ACROSS, rigPulley, sagLike, UP } from "./shared";
import { topEye } from "./tower";

/** The trolleys on the hawsers, with their droppers, and the return line joining them over the tower's pulleys. */

/**
 * How far below the top of its hole each of the trolley's carabiners hangs, past just touching it: the rider's, in the
 * middle hole, and the back one's.
 */
const TROLLEY_CLIP_DROP = { hang: 0.022, backUp: 0.003 };

/**
 * A trolley on the wire at `at`, its bumper towards `ahead` (downhill, where it meets the brake blocks), with its two
 * carabiners hanging from the holes below: the rider's dropper on the middle one, and the back-up line and the return
 * line together on the one behind it, uphill. Each carabiner pivots where it passes through its hole: `swing` turns its
 * bottom that far (radians) towards `ahead`, as when the trolley's stopped by the brake blocks and the rider swings on,
 * or back when the return line pulls. Returns where each carabiner's bottom is, and which way it hangs.
 */
export function rigTrolley(
    at: Vector3,
    ahead: Vector3,
    swing: { hang?: number; backUp?: number } = {},
    /** Which way the carabiners' gates face. */
    gate = ACROSS,
): {
    pieces: Piece[];
    /** The trolley alone, and its carabiners alone. */
    body: Piece[];
    clips: Piece[];
    /** Where the rider's carabiner passes through its hole, which it pivots about. */
    pivot: Vector3;
    hang: Vector3;
    backUp: Vector3;
    hangDown: Vector3;
    backUpDown: Vector3;
} {
    const t = zipTrolley(at, ahead, ACROSS, HAWSER_R, TROLLEY_COLORS);
    const pieces: Piece[] = [];
    const level = vec3(ahead.x, 0, ahead.z).unit();
    const clip = (top: Vector3, length: number, drop: number, angle = 0) => {
        const down = vec3(0, -Math.cos(angle), 0).add(level.scale(Math.sin(angle)));
        const bar = top.add(vec3(0, -0.005 - drop, 0));
        pieces.push(
            ...carabiner(bar, down, gate, C.oval, length, { shape: "oval", through: t.gap }),
        );
        return { bottom: bar.add(down.scale(length)), down, bar };
    };
    const hang = clip(t.main, 0.11, TROLLEY_CLIP_DROP.hang, swing.hang);
    const backUp = clip(t.towSide, 0.1, TROLLEY_CLIP_DROP.backUp, swing.backUp);
    return {
        pieces: [...t.pieces, ...pieces],
        body: t.pieces,
        clips: pieces,
        pivot: hang.bar,
        hang: hang.bottom,
        backUp: backUp.bottom,
        hangDown: hang.down,
        backUpDown: backUp.down,
    };
}

/**
 * A trolley on hawser `s` at `x`, with its dropper: the trolley's pieces and the dropper's apart (the dropper, with
 * the carabiners it hangs from, swings about `hang`, where the rider's carabiner passes through the trolley), where it
 * sits on the wire, and where its back (uphill) tow point is.
 */
export function trolley(
    x: number,
    s: number,
): {
    pieces: Piece[];
    dropper: Piece[];
    at: Vector3;
    hang: Vector3;
    back: Vector3;
    gate: Vector3;
} {
    const at = onHawser(x, s);
    const ahead = onHawser(x + 0.1, s)
        .sub(onHawser(x - 0.1, s))
        .unit();
    // Its carabiners' gates face in, towards the other hawser, so the return line's tied on the outside.
    const gate = ACROSS.scale(-s);
    const rig = rigTrolley(at, ahead, {}, gate);
    const { hang, backUp } = rig;
    const pieces: Piece[] = [];
    // The return line's tied on beside the back-up line, round the bend on the carabiner's spine side.
    const back = backUp;
    // The dropper: the rider's rope down through the descender, a GRIGRI+ clipped to the harness's tie-in (the
    // rider's drop below the hawser) and reaching up to about `DESCENDER` below it, the rope's brake strand hanging on
    // below; and the back-up line, down to the harness too.
    const tieIn = at.add(vec3(0, -RIDER.harness, 0));
    const down = vec3(0, -1, 0);
    const clipLength = 0.11;
    // Its coloured side towards hawser B, so its body reaches downhill, clear of the back-up line behind it.
    const g = grigri(tieIn.add(vec3(0, clipLength, 0)), UP, ACROSS.neg(), {
        body: "var(--fox-grigri)",
        dark: "var(--rig-black)",
        handle: "var(--fox-grigri-handle)",
        steel: C.steel,
    });
    pieces.push(...g.pieces);
    // Its carabiner through the hole, hanging from the hole's bottom edge to the tie-in, turned over (its gate the
    // other way from the trolley's).
    const holeBottom = tieIn.add(vec3(0, clipLength - g.holeR + 0.005, 0));
    pieces.push(
        ...carabiner(holeBottom, down, ACROSS.neg(), C.steel, clipLength - g.holeR + 0.005, {
            through: g.width,
        }),
    );
    // Tied into the trolley's carabiner with a figure 8 on a bight, its standing part on down to the GRIGRI.
    const eight = figure8(hang, ACROSS, CARABINER_R, hang.add(vec3(0, -1, 0)), 0.0055);
    // Its brake strand's end tied off with a figure 8 stopper.
    const brakeStrand = g.brake(0.9);
    const [end, before] = [brakeStrand.at(-1)!, brakeStrand.at(-2)!];
    pieces.push(
        ...line(
            [
                ...eight.rope,
                ...g.rope,
                ...brakeStrand,
                ...stopper(end, end.sub(before), 0.0055).slice(1),
            ],
            0.0055,
            C.dropper,
            "rope",
            { a: true, b: true },
        ),
    );
    // The safety (back-up) line, down beside it to a carabiner of its own on the harness.
    const safetyClip = tieIn.add(vec3(-0.05, clipLength, 0));
    // One rope, a figure 8 at each end, each knot lying straight towards the other carabiner and the rope running
    // straight between them, so it leaves each knot the way the knot lies.
    const top = carabinerKnot(backUp, safetyClip, 0.0055, 0, undefined, gate);
    const bottom = carabinerKnot(safetyClip, backUp, 0.0055);
    pieces.push(
        ...line([...top.knot.rope, ...bottom.knot.rope.reverse()], 0.0055, C.dropper, "rope", {
            a: true,
            b: true,
        }),
    );
    pieces.push(...carabiner(safetyClip, down, ACROSS.neg(), C.steel, clipLength));
    return {
        pieces: rig.body,
        dropper: [...rig.clips, ...pieces],
        at,
        hang: rig.pivot,
        back,
        gate,
    };
}

/** How far round its carabiner's bottom bend towards the spine the return line's tied (radians). */
const RETURN_SPINE = 1.1;

/**
 * The trolleys and the return line joining them over the tower's pulleys; for a run, only trolley B and the pulleys,
 * trolley A riding the hawser by itself with no return line on it.
 */
export function trolleysAndReturn(run = false): Piece[] {
    // For a run, the trolleys, the return line and its pulleys all move.
    if (run) return [];
    const a = trolley(TROLLEY_X.a, 1);
    const b = trolley(TROLLEY_X.b, -1);
    const [ca, cb] = [RETURN_PULLEY(1), RETURN_PULLEY(-1)];
    // Each pulley clipped into the inner eye bolt on its side, its eye lying flat.
    // Out to trolley B, sagging well below hawser B: slacker than the hawsers, twice their sag for its length (as long
    // as it stays clear of the ground).
    const slack = (a: Vector3, z: Vector3) => sagLike(a, z, 2);
    const out = hanging(cb, b.back, slack(cb, b.back), 60);
    const bolt = (s: number) => ({
        eyeBolt: { base: topEye(s * RETURN_EYE_Z), out: vec3(1, 0, 0), toward: ACROSS },
    });
    const pa = rigPulley(ca, a.back, cb, 0.004, bolt(1));
    const pb = rigPulley(cb, pa.centre, out[1], 0.004, bolt(-1));
    return [
        ...a.pieces,
        ...a.dropper,
        ...b.pieces,
        ...b.dropper,
        ...pa.pieces,
        ...pb.pieces,
        ...tiedTo(
            a.back,
            [...pa.round, ...pb.round],
            0.004,
            C.returnLine,
            RETURN_SPINE,
            undefined,
            a.gate,
        ),
        // Out to trolley B, sagging under its own weight below hawser B.
        ...tiedTo(
            b.back,
            hanging(pb.b, b.back, slack(pb.b, b.back), 60).reverse().slice(1),
            0.004,
            C.returnLine,
            RETURN_SPINE,
            undefined,
            b.gate,
        ),
    ];
}

/**
 * A trolley at the launch on hawser `side`, for a run: its pieces and its dropper's apart, where it sits on the wire,
 * and where the dropper hangs from; and the return line's figure 8, tied round its back carabiner's bar, built about
 * that bar so it can turn to follow the line, and where the line leaves the knot.
 */
export function runTrolley(side: number) {
    const t = trolley(TROLLEY_X.a, side);
    const toward = t.back.add(vec3(-1, 0.4, 0));
    const { knot, bar } = carabinerKnot(t.back, toward, 0.004, RETURN_SPINE, undefined, t.gate);
    return {
        ...t,
        knot: moved(line(knot.rope, 0.004, C.returnLine, "rope", { a: true }), bar.neg()),
        bar,
        tie: knot.end.sub(bar),
    };
}

/**
 * The return line's two pulleys under the tower's top bar, built to swing (each about where its carabiner hangs in its
 * eye bolt) to face its ropes, and for where the trolleys are now, the line from one trolley's knot round both pulleys
 * to the other's, sagging with however much slack it has.
 */
export function returnRig() {
    const [ca, cb] = [RETURN_PULLEY(1), RETURN_PULLEY(-1)];
    const bolt = (s: number) => ({
        eyeBolt: { base: topEye(s * RETURN_EYE_Z), out: vec3(1, 0, 0), toward: ACROSS },
    });
    // Built with the line running out to a trolley a little way along each hawser.
    const pa = rigPulley(ca, onHawser(20, 1), cb, 0.004, bolt(1));
    const pb = rigPulley(cb, pa.centre, onHawser(20, -1), 0.004, bolt(-1));
    const pulleys = [
        { name: "pulley-a", p: pa, other: pb.centre },
        { name: "pulley-b", p: pb, other: pa.centre },
    ];
    const fixed = [pa, pb].flatMap((p) => p.pieces.slice(p.pulley.length));
    const parts = pulleys.map(({ name, p }) => ({ name, pieces: moved(p.pulley, p.hook.neg()) }));
    /** The line, with the trolleys' knots' ends at `tieA` and `tieB` and `slack` metres of it to spare. */
    const pose = (tieA: Vector3, tieB: Vector3, slack: number) => {
        const poses = new Map<string, Pose>();
        // Each pulley swung so it hangs along the pull of its two ropes.
        const rounds = pulleys.map(({ name, p, other }, i) => {
            const tie = i === 0 ? tieA : tieB;
            const pull = tie.sub(p.centre).unit().add(other.sub(p.centre).unit());
            const turn = turnBetween(p.up.neg(), pull);
            poses.set(name, { at: p.hook, ...turn });
            return p.round.map((q) => p.hook.add(q.sub(p.hook).turned(turn.axis, turn.angle)));
        });
        // Pulley A's wrap runs from trolley A's side to pulley B's, pulley B's from A's side to trolley B's.
        const [ra, rb] = rounds;
        const ends = [ra[0], rb[rb.length - 1]];
        // The slack shared between the two spans as a rope's own weight shares it: each sags as its length squared,
        // with the extra length they take up (a parabola's, 8 sag² / 3 span) adding to the slack.
        const spans = [ends[0].distanceTo(tieA), ends[1].distanceTo(tieB)];
        const k = Math.sqrt((24 * Math.max(slack, 0)) / (spans[0] ** 3 + spans[1] ** 3));
        const sags = spans.map((d) => Math.max((k * d * d) / 8, 0.01 * d));
        // Lying on the ground where it sags that far.
        const onGround = (q: Vector3) => vec3(q.x, Math.max(q.y, groundY(q.x) + 0.004), q.z);
        const spanA = hanging(tieA, ends[0], sags[0], 80).map(onGround);
        const spanB = hanging(ends[1], tieB, sags[1], 80).map(onGround);
        return {
            poses,
            // Which way the line leaves each knot, a little way along it.
            leaving: [spanA[3].sub(spanA[0]), spanB[spanB.length - 4].sub(spanB[spanB.length - 1])],
            ropes: line(
                [...spanA, ...ra.slice(1), ...rb.slice(0, -1), ...spanB],
                0.004,
                C.returnLine,
            ),
        };
    };
    return { fixed, parts, pose };
}

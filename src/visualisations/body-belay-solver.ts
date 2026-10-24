import { vec3, type Vector3 } from "@/lib/vector3";
import { ropePathFor } from "@/lib/wall";

import { solveLower, type Lowered, type Setup as LowerSetup } from "./two-point-lower-solver";

/**
 * A two-point lower with no anchor: two belayers stand side by side on the wall top, each holding their own rope
 * round their waist. Both ropes are tied to the same end of the stretcher and run over the wall's edge to them,
 * so seen from above they form a V. Each belayer leans back against their rope's pull, their body a straight
 * strut from their feet to their waist, so the rope's pull and their weight together push down along it into
 * their feet. The ground under their feet must grip them for that push's sideways part, or they slide.
 *
 * Coordinates are the two-point lower's, x out from the wall's face and y up, plus z sideways along the wall,
 * with the stretcher in the plane z = 0 and the belayers mirror images either side of it. Being mirror images,
 * their ropes' sideways pulls on the stretcher cancel, and their pulls in the plane add. Each rope takes the
 * shortest path over the edge: unfolded flat about the edge, it's a straight line. So seen side on, the pair of
 * ropes acts like one rope to an anchor at the belayers' waists, as long as each rope's side-on length, and
 * the two-point lower's solver can place the stretcher. Each rope's tension is then the side-on pull shared
 * between the two, made larger by how far the V opens.
 *
 * The rope is taken to be sliding slowly over the edge, as the stretcher is lowered, so the edge's friction holds
 * back part of its tension: by the capstan rule, the belayers hold e^(−μθ) of the tension on the stretcher's side,
 * where θ is how far the rope turns over the edge.
 *
 * The belayers' lean moves their waists, which turns their ropes: how wide the V opens, how far each turns over the
 * edge, and which way it pulls them, which changes the lean they need; the two are solved together by settling the
 * lean a few times. While the ropes wrap the edge, the stretcher itself stays put: each rope is a fixed length past
 * the edge, whatever the lean.
 */

export type Setup = Omit<LowerSetup, "anchorUp" | "anchorBack" | "rope"> & {
    /** How far back from the wall's face the belayers' feet are. */
    belayerBack: number;
    /** How far apart, along the wall, the belayers' feet are. */
    gap: number;
    /** Each belayer's weight. */
    belayerWeight: number;
    /** The friction coefficient between the belayers' feet and the wall top. */
    grip: number;
    /** The friction coefficient between the rope and the wall's edge. */
    edgeFriction: number;
};

/** The rope runs round each belayer's waist, this far up their body from their feet. */
export const WAIST_HEIGHT = 1;

/**
 * The ropes are paid out to just past the wall's edge: seen side on, this much further than from the belayers'
 * waists to the edge, wherever their lean puts their waists. The stretcher's rope end has just gone over.
 */
export const PAST_EDGE = 0.5;

/** The belayer on the z > 0 side (the other is their mirror image). */
export type Belayer = {
    feet: Vector3;
    waist: Vector3;
    /** How far they lean back from upright (radians), away from their rope. */
    lean: number;
    /** The direction they lean away from, seen from above: their rope's pull, x towards the wall's face. */
    facing: { x: number; z: number };
    /** Their rope's pull on them, at their waist. */
    pull: Vector3;
    /** The ground's push on their feet: up, and back against the rope (friction). */
    ground: Vector3;
    /** The friction coefficient their feet need to hold: the ground's sideways push over its upward push. */
    gripNeeded: number;
    /** The footing's safety factor: the friction their feet can take over the friction they need (the footing's grip
     * over `gripNeeded`). Below 1, they slide. */
    safety: number;
    /** Their feet hold without sliding. */
    holds: boolean;
};

export type Belayed = {
    /** The stretcher, seen side on: `t1` is both ropes' pull on it together, `anchor` the waists seen side on. */
    l: Lowered;
    b: Belayer;
    /** Each rope's length, from waist to stretcher. */
    rope: number;
    /** Each rope's tension on the stretcher's side of the edge. */
    loadTension: number;
    /** Each rope's tension on the belayer's side of the edge: what they hold, less than `loadTension` by the edge's
     * friction. */
    tension: number;
    /** How far each rope turns as it wraps over the edge (radians), or 0 when it doesn't touch it. */
    wrap: number;
    /** The angle between the two ropes where they meet at the stretcher (radians). */
    ropeAngle: number;
    /** Where the belayer's rope crosses the wall's edge (z > 0 side), when it wraps over it. */
    edgeCrossing: Vector3 | null;
};

export type BelayResult = ({ kind: "belayed" } & Belayed) | { kind: "none"; reason: string };

/** A belayer's waist, leaning back by `lean` away from `facing`. */
function waistFor(s: Setup, lean: number, facing: { x: number; z: number }): Vector3 {
    const back = WAIST_HEIGHT * Math.sin(lean);
    return vec3(
        -s.belayerBack - back * facing.x,
        s.wallHeight + WAIST_HEIGHT * Math.cos(lean),
        s.gap / 2 - back * facing.z,
    );
}

/** The two-point lower's setup seen side on, with the rope's anchor at the belayers' waists. */
export function lowerSetupFor(s: Setup, waist: Vector3): LowerSetup {
    const anchorUp = waist.y - s.wallHeight;
    const anchorBack = -waist.x;
    return { ...s, anchorUp, anchorBack, rope: Math.hypot(anchorUp, anchorBack) + PAST_EDGE };
}

/** The ropes and the belayer, for the stretcher placed side on and the belayer at this lean. */
function belayedFor(
    s: Setup,
    ls: LowerSetup,
    l: Lowered,
    lean: number,
    facing: { x: number; z: number },
): Belayed {
    const feet = vec3(-s.belayerBack, s.wallHeight, s.gap / 2);
    const waist = waistFor(s, lean, facing);
    const end = vec3(l.barEnd1.x, l.barEnd1.y, 0);
    // Side on, the rope is `side` long; its sideways run makes it longer, and tilts its every part by the same
    // amount, unfolded about the edge. Only the part along the side-on view pulls the stretcher in its plane.
    const side = ropePathFor(ls, l.barEnd1).length;
    const rope = Math.hypot(side, waist.z);
    const loadTension = l.ropeTaut ? l.t1.len() / 2 / (side / rope) : 0;
    let edgeCrossing: Vector3 | null = null;
    let next = end;
    let wrap = 0;
    if (l.wrapEdge) {
        const toEdge = l.wrapEdge.distanceTo(waist.xy());
        edgeCrossing = vec3(0, s.wallHeight, (waist.z * (side - toEdge)) / side);
        next = edgeCrossing;
        wrap = edgeCrossing.sub(waist).angleTo(end.sub(edgeCrossing));
    }
    const tension = loadTension * Math.exp(-s.edgeFriction * wrap);
    const along = next.sub(waist);
    const pull = along.scale(tension / along.len());
    // Their feet balance the pull and their weight (taken at their waist, where the strut meets the rope).
    const ground = vec3(-pull.x, s.belayerWeight - pull.y, -pull.z);
    const sideways = Math.hypot(ground.x, ground.z);
    const gripNeeded = ground.y > 0 ? sideways / ground.y : Infinity;
    return {
        l,
        b: {
            feet,
            waist,
            lean,
            facing,
            pull,
            ground,
            gripNeeded,
            safety: s.grip / gripNeeded,
            holds: gripNeeded <= s.grip,
        },
        rope,
        loadTension,
        tension,
        wrap,
        ropeAngle: 2 * Math.asin(Math.min(1, Math.abs(waist.z) / rope)),
        edgeCrossing,
    };
}

export function solveBelay(s: Setup): BelayResult {
    if (s.belayerWeight <= 0) return { kind: "none", reason: "Give the belayers some mass." };
    // The way each belayer leans: straight back from the wall to start with, then away from their rope's pull.
    let facing = { x: 1, z: 0 };
    /** The arrangement with the belayers leaning back by `lean`, and how much further they'd need to lean. */
    const at = (lean: number): Probe | LowerNone => {
        const ls = lowerSetupFor(s, waistFor(s, lean, facing));
        const r = solveLower(ls);
        if (r.kind === "none") return r;
        const result = belayedFor(s, ls, r.l, lean, facing);
        const g = result.b.ground;
        const sideways = Math.hypot(g.x, g.z);
        // Their body lines up with the push into their feet, leaning away from the pull.
        if (sideways > 1e-9) facing = { x: -g.x / sideways, z: -g.z / sideways };
        const needed = Math.atan2(sideways, g.y);
        return { result: { kind: "belayed", ...result }, more: needed - lean };
    };

    // Lean further while they need to, then close in on the lean that needs no more, keeping it bracketed (the
    // stretcher can tip over as the belayers lean, so the needed lean can jump).
    const first = at(0);
    if ("reason" in first) return first;
    let lo: Probe = first;
    let loLean = 0;
    let hi: Probe | null = null;
    let hiLean = 0;
    let best: Probe = lo;
    let lean = lo.more;
    let side = 0;
    for (let i = 0; i < 12 && Math.abs(best.more) > LEAN_TOLERANCE; i++) {
        const x = at(lean);
        if ("reason" in x) return x;
        if (Math.abs(x.more) < Math.abs(best.more)) best = x;
        if (x.more > 0) {
            lo = x;
            loLean = lean;
            if (side === 1 && hi) hi = { result: hi.result, more: hi.more / 2 };
            side = 1;
        } else {
            hi = x;
            hiLean = lean;
            if (side === -1) lo = { result: lo.result, more: lo.more / 2 };
            side = -1;
        }
        if (!hi) lean += x.more;
        else if (hiLean - loLean < LEAN_TOLERANCE) break;
        else lean = loLean + ((hiLean - loLean) * lo.more) / (lo.more - hi.more);
    }
    // Settled, or closed in on a jump in the lean needed; otherwise the search ran out of tries.
    const settled =
        Math.abs(best.more) <= LEAN_TOLERANCE || (hi && hiLean - loLean < LEAN_TOLERANCE);
    if (!settled) {
        return {
            kind: "none",
            reason: "The page couldn’t find how far the belayers lean here. Try a slightly different setup.",
        };
    }
    return best.result;
}

/** The arrangement at one lean, and how much further the belayers would need to lean (radians). */
type Probe = { result: Extract<BelayResult, { kind: "belayed" }>; more: number };
type LowerNone = Extract<BelayResult, { kind: "none" }>;

/** Close enough on the belayers' lean (radians, about 0.05°). */
const LEAN_TOLERANCE = 1e-3;

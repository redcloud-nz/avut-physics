import { len, sub, vec } from "@/lib/vec";
import { ropePathFor } from "./ladder-hinge-held";
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
 * The belayers' lean moves their waists, which moves the stretcher a little, which changes the ropes' pull; the
 * two are solved together by settling the lean a few times.
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
};

/** The rope runs round each belayer's waist, this far up their body from their feet. */
export const WAIST_HEIGHT = 1;

/**
 * The ropes are paid out to just past the wall's edge: seen side on, this much further than from the belayers'
 * waists to the edge, wherever their lean puts their waists. The stretcher's rope end has just gone over.
 */
export const PAST_EDGE = 0.5;

export type V3 = { x: number; y: number; z: number };

const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
const sub3 = (a: V3, b: V3) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const len3 = (a: V3) => Math.hypot(a.x, a.y, a.z);
const scale3 = (a: V3, k: number) => v3(a.x * k, a.y * k, a.z * k);

/** The belayer on the z > 0 side (the other is their mirror image). */
export type Belayer = {
  feet: V3;
  waist: V3;
  /** How far they lean back from upright (radians), away from their rope. */
  lean: number;
  /** The direction they lean away from, seen from above: their rope's pull, x towards the wall's face. */
  facing: { x: number; z: number };
  /** Their rope's pull on them, at their waist. */
  pull: V3;
  /** The ground's push on their feet: up, and back against the rope (friction). */
  ground: V3;
  /** The friction coefficient their feet need to hold: the ground's sideways push over its upward push. */
  gripNeeded: number;
  /** Their feet hold without sliding. */
  holds: boolean;
};

export type Belayed = {
  /** The stretcher, seen side on: `t1` is both ropes' pull on it together, `anchor` the waists seen side on. */
  l: Lowered;
  b: Belayer;
  /** Each rope's length, from waist to stretcher. */
  rope: number;
  /** Each rope's tension. */
  tension: number;
  /** The angle between the two ropes where they meet at the stretcher (radians). */
  ropeAngle: number;
  /** Where the belayer's rope crosses the wall's edge (z > 0 side), when it wraps over it. */
  edgeCrossing: V3 | null;
};

export type BelayResult = ({ kind: "belayed" } & Belayed) | { kind: "none"; reason: string };

/** A belayer's waist, leaning back by `lean` away from `facing`. */
function waistFor(s: Setup, lean: number, facing: { x: number; z: number }): V3 {
  const back = WAIST_HEIGHT * Math.sin(lean);
  return v3(
    -s.belayerBack - back * facing.x,
    s.wallHeight + WAIST_HEIGHT * Math.cos(lean),
    s.gap / 2 - back * facing.z,
  );
}

/** The two-point lower's setup seen side on, with the rope's anchor at the belayers' waists. */
export function lowerSetupFor(s: Setup, waist: V3): LowerSetup {
  const anchorUp = waist.y - s.wallHeight;
  const anchorBack = -waist.x;
  return { ...s, anchorUp, anchorBack, rope: Math.hypot(anchorUp, anchorBack) + PAST_EDGE };
}

/** The ropes and the belayer, for the stretcher placed side on and the belayer at this lean. */
function belayedFor(s: Setup, ls: LowerSetup, l: Lowered, lean: number, facing: { x: number; z: number }): Belayed {
  const feet = v3(-s.belayerBack, s.wallHeight, s.gap / 2);
  const waist = waistFor(s, lean, facing);
  const end = v3(l.barEnd1.x, l.barEnd1.y, 0);
  // Side on, the rope is `side` long; its sideways run makes it longer, and tilts its every part by the same
  // amount, unfolded about the edge. Only the part along the side-on view pulls the stretcher in its plane.
  const side = ropePathFor(ls, l.barEnd1).length;
  const rope = Math.hypot(side, waist.z);
  const tension = l.ropeTaut ? len(l.t1) / 2 / (side / rope) : 0;
  let edgeCrossing: V3 | null = null;
  let next = end;
  if (l.wrapEdge) {
    const toEdge = len(sub(l.wrapEdge, vec(waist.x, waist.y)));
    edgeCrossing = v3(0, s.wallHeight, (waist.z * (side - toEdge)) / side);
    next = edgeCrossing;
  }
  const along = sub3(next, waist);
  const pull = scale3(along, tension / len3(along));
  // Their feet balance the pull and their weight (taken at their waist, where the strut meets the rope).
  const ground = v3(-pull.x, s.belayerWeight - pull.y, -pull.z);
  const sideways = Math.hypot(ground.x, ground.z);
  const gripNeeded = ground.y > 0 ? sideways / ground.y : Infinity;
  return {
    l,
    b: { feet, waist, lean, facing, pull, ground, gripNeeded, holds: gripNeeded <= s.grip },
    rope,
    tension,
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
  return best.result;
}

/** The arrangement at one lean, and how much further the belayers would need to lean (radians). */
type Probe = { result: Extract<BelayResult, { kind: "belayed" }>; more: number };
type LowerNone = Extract<BelayResult, { kind: "none" }>;

/** Close enough on the belayers' lean (radians, about 0.05°). */
const LEAN_TOLERANCE = 1e-3;

import { add, cross, len, rad, scale, sub, unit, vec, type Vec } from "@/lib/vec";
import { nelderMead, phiMax, solveLinear, wallPush, type Setup, type Surface } from "./ladder-hinge-solver";

/**
 * The ladder held at a set angle by a ground team, instead of left to find its own. The stretcher then
 * settles on its own: hanging from the rope and the attachment (either may go slack), and resting on the
 * ladder, the ground or the wall wherever it touches them. It takes the position of least potential energy,
 * and the team supplies whatever torque the ladder needs to stay at its angle.
 *
 * The stretcher's position is its centre and angle. Each rope, attachment and contact is a constraint g ≤ 0
 * measured in metres, so where one is active its Lagrange multiplier is the force it carries, in newtons.
 */

/** The team holds the ladder at about shoulder height (or at its tip, when that's lower), pushing straight up. */
export const HOLD_HEIGHT = 1.5;

export type HeldContact = { surface: Surface | "ladder"; point: Vec; force: Vec };

export type Held = {
  phi: number;
  anchor: Vec;
  wrapEdge: Vec | null;
  beamAttach: Vec;
  /** The ladder's tip, when the attachment runs over it to a stretcher on the ladder's far side. */
  attachVia: Vec | null;
  barEnd1: Vec; // on the rope
  barEnd2: Vec; // on the attachment
  /** The stretcher's slope, from −90° to 90°: positive when its ladder end is the higher. */
  tilt: number;
  ropeTaut: boolean;
  t1: Vec;
  attachmentTaut: boolean;
  t2: Vec;
  /** What the stretcher rests on, and the force pushing back on it. */
  contacts: HeldContact[];
  /** Where on the ladder the stretcher's contacts push back on it (the same order as `contacts`). */
  ladderPoints: (Vec | null)[];
  /** The team's push on the ladder, straight up or down (null when the wall or ground holds it instead). */
  hold: { point: Vec; force: Vec } | null;
  wallOnBeam: { point: Vec; force: Vec } | null;
  /** Force the hinge exerts on the ladder (null when it lies on the ground, which shares the load). */
  hinge: Vec | null;
};

export type HeldResult = { kind: "held"; h: Held } | { kind: "none"; reason: string };

/** The parts of the setup the wall and the rope's anchor need. */
type WallSetup = Pick<Setup, "wallHeight" | "anchorUp" | "anchorBack">;

type Kind = "rope" | "attachment" | Surface | "ladder";

/** One constraint, g ≤ 0, whose force on the stretcher pushes along m at the stretcher's point `at`. */
type Piece = { key: string; kind: Kind; g: number; at: Vec; m: Vec; ladderAt?: Vec };

const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;

const safeUnit = (v: Vec, fallback: Vec) => (len(v) > 1e-12 ? unit(v) : fallback);

/** Behind the wall's face: on the wall top, or inside the wall nearer the top than the face. */
export function behindFaceFor(s: WallSetup, p: Vec) {
  return p.x < 0 && (p.y >= s.wallHeight || s.wallHeight - p.y < -p.x);
}

/**
 * The rope's path to p, over the wall's edge when the straight line would cut through the wall. Unlike the
 * free solver's, it carries on smoothly into the wall, where the minimiser may briefly push an end: as if
 * from the face or the top, whichever is nearer.
 */
export function ropePathFor(s: WallSetup, p: Vec): { length: number; wrapEdge: Vec | null } {
  const anchor = vec(-s.anchorBack, s.wallHeight + s.anchorUp);
  const edge = vec(0, s.wallHeight);
  return !behindFaceFor(s, p) && cross(sub(edge, anchor), sub(p, anchor)) < 0
    ? { length: len(sub(edge, anchor)) + len(sub(p, edge)), wrapEdge: edge }
    : { length: len(sub(p, anchor)), wrapEdge: null };
}

/** The point of segment ab nearest p, and how far along it is (0 to 1). */
function nearest(p: Vec, a: Vec, b: Vec) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
  return { point: add(a, scale(ab, t)), t };
}

/** The stretcher with the ladder held at angle phi. */
export function solveHeld(s: Setup, phi: number): HeldResult {
  if (s.barWeight <= 0) return { kind: "none", reason: "Give the stretcher some mass." };
  phi = Math.max(0, Math.min(phiMax(s), phi));
  const W = s.barWeight;
  const half = s.barLength / 2;
  const anchor = vec(-s.anchorBack, s.wallHeight + s.anchorUp);
  const edge = vec(0, s.wallHeight);
  const along = vec(Math.cos(phi), Math.sin(phi));
  const normal = vec(-Math.sin(phi), Math.cos(phi));
  const B = scale(along, s.attachDistance);
  const tip = scale(along, s.beamLength);

  const ropePath = (p: Vec) => ropePathFor(s, p);
  const behindFace = (p: Vec) => behindFaceFor(s, p);

  /** The attachment's path to p: straight from its fixing, or over the ladder's tip to the ladder's far side. */
  function attachmentPath(p: Vec): { length: number; via: Vec | null } {
    return dot(p, normal) < 0
      ? { length: len(sub(tip, B)) + len(sub(p, tip)), via: tip }
      : { length: len(sub(p, B)), via: null };
  }

  const ends = (q: number[]): [Vec, Vec] => {
    const d = vec(Math.cos(q[2]), Math.sin(q[2]));
    const c = vec(q[0], q[1]);
    return [sub(c, scale(d, half)), add(c, scale(d, half))];
  };

  /** The stretcher can't pass through the ladder (it can only get to the far side round the tip). */
  const valid = (q: number[]) => {
    const [P1, P2] = ends(q);
    const side = (a: Vec, b: Vec, c: Vec) => cross(sub(b, a), sub(c, a));
    const O = vec(0, 0);
    return !(side(O, tip, P1) * side(O, tip, P2) < 0 && side(P1, P2, O) * side(P1, P2, tip) < 0);
  };

  const pieces = (q: number[]): Piece[] => {
    const [P1, P2] = ends(q);
    const out: Piece[] = [];
    const path = ropePath(P1);
    const towards = path.wrapEdge ?? anchor;
    out.push({
      key: "rope",
      kind: "rope",
      g: path.length - s.wallCable,
      at: P1,
      m: safeUnit(sub(towards, P1), unit(sub(anchor, P1))),
    });
    const att = attachmentPath(P2);
    out.push({
      key: "attachment",
      kind: "attachment",
      g: att.length - s.beamCable,
      at: P2,
      m: safeUnit(sub(att.via ?? B, P2), vec(0, 1)),
    });
    for (const [i, P] of [P1, P2].entries()) {
      out.push({ key: `ground${i}`, kind: "ground", g: -P.y, at: P, m: vec(0, 1) });
      // The wall's signed distance: inside, out through the nearer of the face and the top.
      const h = s.wallHeight;
      const wall: Omit<Piece, "key" | "at"> =
        P.x < 0 && P.y < h
          ? h - P.y < -P.x
            ? { kind: "top", g: h - P.y, m: vec(0, 1) }
            : { kind: "wall", g: -P.x, m: vec(1, 0) }
          : P.x >= 0 && P.y >= h
            ? { kind: "edge", g: -len(sub(P, edge)), m: safeUnit(sub(P, edge), vec(0, 1)) }
            : P.x >= 0
              ? { kind: "wall", g: -P.x, m: vec(1, 0) }
              : { kind: "top", g: h - P.y, m: vec(0, 1) };
      out.push({ key: `wall${i}`, at: P, ...wall });
      const onLadder = nearest(P, vec(0, 0), tip).point;
      out.push({
        key: `ladder${i}`,
        kind: "ladder",
        g: s.touchGap - len(sub(P, onLadder)),
        at: P,
        m: safeUnit(sub(P, onLadder), normal),
        ladderAt: onLadder,
      });
    }
    // Spanning the wall's face, the stretcher must pass above its top edge.
    if (behindFace(P1) !== behindFace(P2)) {
      const d = unit(sub(P2, P1));
      const up = d.x > 0 ? vec(-d.y, d.x) : vec(d.y, -d.x);
      const at = add(P1, scale(d, dot(sub(edge, P1), d)));
      out.push({ key: "corner", kind: "edge", g: dot(sub(edge, P1), up), at, m: up });
    }
    // The ladder's tip under the stretcher's middle (at its ends the ladder pieces above already count).
    const onBar = nearest(tip, P1, P2);
    if (onBar.t > 1e-9 && onBar.t < 1 - 1e-9) {
      out.push({
        key: "tip",
        kind: "ladder",
        g: s.touchGap - len(sub(onBar.point, tip)),
        at: onBar.point,
        m: safeUnit(sub(onBar.point, tip), normal),
        ladderAt: tip,
      });
    }
    return out;
  };

  /** A constraint's force on the stretcher per newton: its x and y, and its torque about the centre. */
  const generalised = (p: Piece, q: number[]) => [p.m.x, p.m.y, cross(sub(p.at, vec(q[0], q[1])), p.m)];

  const penalised = (k: number) => (q: number[]) => {
    if (!valid(q)) return Infinity;
    return W * q[1] + (k / 2) * pieces(q).reduce((sum, p) => sum + Math.max(0, p.g) ** 2, 0);
  };

  // Starting points: the stretcher at a spread of angles, its attachment end around the attachment point.
  const nTheta = 24;
  const nA = 24;
  const startAt = (i: number, j: number) => {
    const theta = -Math.PI + (2 * Math.PI * (i + 0.5)) / nTheta;
    const a = (2 * Math.PI * j) / nA;
    const P2 = add(B, scale(vec(Math.cos(a), Math.sin(a)), s.beamCable * 0.999));
    const c = sub(P2, scale(vec(Math.cos(theta), Math.sin(theta)), half));
    return [c.x, c.y, theta];
  };
  const soft = penalised(1e4 * W);
  const starts = searchStarts();
  const stiff = penalised(1e7 * W);
  function searchStarts() {
    const grid = Array.from({ length: nTheta }, (_, i) => Array.from({ length: nA }, (_, j) => soft(startAt(i, j))));
    const starts: { q: number[]; e: number }[] = [];
    for (let i = 0; i < nTheta; i++) {
      for (let j = 0; j < nA; j++) {
        const e = grid[i][j];
        if (!Number.isFinite(e)) continue;
        let isMin = true;
        for (let di = -1; di <= 1 && isMin; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            if ((di || dj) && grid[(i + di + nTheta) % nTheta][(j + dj + nA) % nA] < e) {
              isMin = false;
              break;
            }
          }
        }
        if (isMin) starts.push({ q: startAt(i, j), e });
      }
    }
    return starts.sort((a, b) => a.e - b.e);
  }
  let best: { q: number[]; e: number } | null = null;
  for (const st of starts.slice(0, 6)) {
    const q = nelderMead(stiff, nelderMead(soft, st.q, 0.05), 1e-3);
    const e = stiff(q);
    if (Number.isFinite(e) && (!best || e < best.e)) best = { q, e };
  }
  if (!best)
    return {
      kind: "none",
      reason: "The stretcher can't fit between the ladder and the wall with the ladder held here.",
    };

  // Polish: solve the balance exactly with the constraints the stretcher is pressed against, dropping any
  // that would have to pull and adding any it ends up pushed into.
  const tooFar = (p: Piece) => p.g > 1e-3;
  let q = best.q;
  const active = new Set(
    pieces(q)
      .filter((p) => p.g > -1e-5)
      .map((p) => p.key),
  );
  let lambda = new Map<string, number>();
  let settled = false;
  for (let round = 0; round < 8; round++) {
    const polished = kkt(q, [...active]);
    if (!polished) break;
    const all = pieces(polished.q);
    const negative = [...polished.lambda].filter(([, l]) => l < -1e-6 * W).sort((a, b) => a[1] - b[1]);
    const intruding = all.filter((p) => !active.has(p.key) && p.g > 1e-7);
    if (negative.length === 0 && intruding.length === 0 && valid(polished.q)) {
      q = polished.q;
      lambda = polished.lambda;
      settled = true;
      break;
    }
    if (negative.length > 0) active.delete(negative[0][0]);
    for (const p of intruding) active.add(p.key);
  }
  if (!settled) {
    // The polish didn't settle: fall back on the penalty forces, which balance as well as the minimiser got.
    q = best.q;
    for (const p of pieces(q)) if (p.g > 0) lambda.set(p.key, 1e7 * W * p.g);
  }

  const final = pieces(q);
  const violated = final.find(tooFar);
  if (violated) {
    return {
      kind: "none",
      reason:
        violated.kind === "rope"
          ? "The rope can't reach the stretcher with the ladder held at this angle."
          : violated.kind === "attachment"
            ? "The attachment can't reach the stretcher with the ladder held at this angle."
            : "The stretcher can't fit between the ladder and the wall with the ladder held here.",
    };
  }

  const [P1, P2] = ends(q);
  const forceOf = (p: Piece) => scale(p.m, Math.max(0, lambda.get(p.key) ?? 0));
  const byKey = new Map(final.map((p) => [p.key, p]));
  const rope = byKey.get("rope")!;
  const attachment = byKey.get("attachment")!;
  const t1 = forceOf(rope);
  const t2 = forceOf(attachment);
  // Stretched into a straight line between the anchor and the ladder, the tensions grow without bound.
  if (Math.max(len(t1), len(t2)) > 100 * W) {
    return {
      kind: "none",
      reason:
        "The rope, stretcher and attachment would be pulled into a straight line, so the tension would be unbounded.",
    };
  }
  const touching = final.filter((p) => p.kind !== "rope" && p.kind !== "attachment" && len(forceOf(p)) > 1e-9);
  const contacts = touching.map((p) => ({ surface: p.kind as Surface | "ladder", point: p.at, force: forceOf(p) }));
  const ladderPoints = touching.map((p) => p.ladderAt ?? null);

  const attachVia = attachmentPath(P2).via;
  return { kind: "held", h: settleLadder(s, phi, P1, P2, t1, t2, attachVia, contacts, ladderPoints) };

  /**
   * Newton's method on the balance of the stretcher with the given constraints held exactly at zero:
   * unknowns the position and each constraint's force. Returns null if it doesn't converge.
   */
  function kkt(q0: number[], keys: string[]): { q: number[]; lambda: Map<string, number> } | null {
    const m = keys.length;
    const at = (q: number[]) => {
      const map = new Map(pieces(q).map((p) => [p.key, p]));
      return keys.map((k) => map.get(k));
    };
    const residual = (q: number[], l: number[]) => {
      const ps = at(q);
      if (ps.some((p) => !p)) return null;
      const r = [0, -W, 0];
      ps.forEach((p, i) => generalised(p!, q).forEach((v, j) => (r[j] += l[i] * v)));
      // Constraint rows scaled to newtons, so the two kinds of row weigh alike.
      return [...r, ...ps.map((p) => W * p!.g)];
    };
    // A first guess at the forces: least squares on the balance at the starting position.
    const ps0 = at(q0);
    if (ps0.some((p) => !p)) return null;
    const cols = ps0.map((p) => generalised(p!, q0));
    let l =
      m === 0
        ? []
        : (solveLinear(
            cols.map((a, i) => cols.map((b, k) => a.reduce((sum, v, j) => sum + v * b[j], 0) + (i === k ? 1e-9 : 0))),
            cols.map((a) => a[1] * W),
          ) ?? keys.map(() => 0));
    let q = [...q0];
    for (let iter = 0; iter < 40; iter++) {
      const r = residual(q, l);
      if (!r) return null;
      const size = Math.max(...r.map(Math.abs));
      if (size < 1e-9 * W) return { q, lambda: new Map(keys.map((k, i) => [k, l[i]])) };
      // Jacobian: numerically in the position, exactly in the forces (the balance is linear in them).
      const n = 3 + m;
      const J = Array.from({ length: r.length }, () => new Array(n).fill(0));
      for (let j = 0; j < 3; j++) {
        const step = j < 2 ? 1e-7 : 1e-7 / half;
        const qp = q.map((v, k) => (k === j ? v + step : v));
        const qm = q.map((v, k) => (k === j ? v - step : v));
        const rp = residual(qp, l);
        const rm = residual(qm, l);
        if (!rp || !rm) return null;
        for (let i = 0; i < r.length; i++) J[i][j] = (rp[i] - rm[i]) / (2 * step);
      }
      at(q).forEach((p, i) => generalised(p!, q).forEach((v, j) => (J[j][3 + i] = v)));
      // Least squares (square and well-posed in the usual case; more contacts than freedoms otherwise).
      const JtJ = Array.from({ length: n }, (_, a) =>
        Array.from(
          { length: n },
          (_, b) => J.reduce((sum, row) => sum + row[a] * row[b], 0) + (a === b ? 1e-12 * W * W : 0),
        ),
      );
      const Jtr = Array.from({ length: n }, (_, a) => -J.reduce((sum, row, i) => sum + row[a] * r[i], 0));
      const dx = solveLinear(JtJ, Jtr);
      if (!dx) return null;
      q = q.map((v, j) => v + dx[j]);
      l = l.map((v, i) => v + dx[3 + i]);
    }
    return null;
  }
}

/**
 * The whole held answer, given where the stretcher is and the forces on it: the ladder's balance gives the
 * team's hold and the hinge force. Leaning on the wall or lying on the ground, those take the torque instead.
 */
function settleLadder(
  s: Setup,
  phi: number,
  P1: Vec,
  P2: Vec,
  t1: Vec,
  t2: Vec,
  attachVia: Vec | null,
  contacts: HeldContact[],
  ladderPoints: (Vec | null)[],
): Held {
  const along = vec(Math.cos(phi), Math.sin(phi));
  const B = scale(along, s.attachDistance);
  // Wrapped round the tip, the attachment's pull on the ladder acts there (its pulls along the ladder cancel).
  const onLadder = [{ at: attachVia ?? B, f: scale(t2, -1) }];
  contacts.forEach((c, i) => {
    const at = ladderPoints[i];
    if (at) onLadder.push({ at, f: scale(c.force, -1) });
  });
  const torque =
    onLadder.reduce((sum, l) => sum + cross(l.at, l.f), 0) - s.beamWeight * (s.beamLength / 2) * Math.cos(phi);
  let hold: Held["hold"] = null;
  let wallOnBeam: Held["wallOnBeam"] = null;
  const down = phi < rad(0.05) && torque <= 0;
  if (phi >= phiMax(s) - 1e-9 && torque > 0) wallOnBeam = wallPush(phi, torque, s);
  else if (!down) {
    const reach = phi > 0 ? Math.min(s.beamLength, HOLD_HEIGHT / Math.sin(phi)) : s.beamLength;
    const point = scale(along, reach);
    hold = { point, force: vec(0, -torque / point.x) };
  }
  const extra = [hold?.force, wallOnBeam?.force].filter((f): f is Vec => !!f);
  const net = [...onLadder.map((l) => l.f), ...extra].reduce(add, vec(0, 0));
  return {
    phi,
    anchor: vec(-s.anchorBack, s.wallHeight + s.anchorUp),
    wrapEdge: ropePathFor(s, P1).wrapEdge,
    beamAttach: B,
    attachVia,
    barEnd1: P1,
    barEnd2: P2,
    tilt: Math.atan2(P2.y - P1.y, Math.abs(P2.x - P1.x)),
    ropeTaut: len(t1) > 1e-9,
    t1,
    attachmentTaut: len(t2) > 1e-9,
    t2,
    contacts,
    ladderPoints,
    hold,
    wallOnBeam,
    hinge: down ? null : vec(-net.x, s.beamWeight - net.y),
  };
}

export type LevelResult = { result: HeldResult; level: boolean; reason?: string };

/**
 * Level and resting on the ladder, with the attachment taut, the stretcher's position follows from the
 * ladder's angle alone: its ladder end where the attachment holds it against the ladder, its rope end the
 * stretcher's length towards the wall at the same height.
 */
function levelEnds(s: Setup, phi: number): [Vec, Vec] {
  const reach = Math.sqrt(Math.max(0, s.beamCable ** 2 - s.touchGap ** 2));
  const P2 = add(
    scale(vec(Math.cos(phi), Math.sin(phi)), s.attachDistance - reach),
    scale(vec(-Math.sin(phi), Math.cos(phi)), s.touchGap),
  );
  return [sub(P2, vec(s.barLength, 0)), P2];
}

/** The rope that holds the stretcher level with the ladder at angle phi. */
const levelRope = (s: Setup, phi: number) => ropePathFor(s, levelEnds(s, phi)[0]).length;

/**
 * The ladder held at whichever angle keeps the stretcher level, as a ground team watching it would hold it.
 * Lowering the ladder takes the stretcher further out and down, so the rope's length fixes the angle, found
 * by bisection.
 */
export function solveLevel(s: Setup): LevelResult {
  const top = phiMax(s);
  // With more than enough rope, the ladder lies on the ground and the stretcher flat on it, where it landed:
  // on a flat ladder nothing moves it along, so the rope and attachment hang slack and the ladder carries
  // all its weight.
  if (s.wallCable >= levelRope(s, 0)) {
    let [P1, P2] = levelEnds(s, 0);
    // Too near the wall for the stretcher's length, it rests against the wall's face instead.
    if (P1.x < 0) [P1, P2] = [vec(0, P1.y), vec(s.barLength, P2.y)];
    if (len(sub(P2, vec(s.attachDistance, 0))) > s.beamCable + 1e-9) {
      const result = solveHeld(s, 0);
      return { result, level: result.kind === "held" && Math.abs(result.h.tilt) < rad(0.5) };
    }
    const centre = scale(add(P1, P2), 0.5);
    const contact: HeldContact = { surface: "ladder", point: centre, force: vec(0, s.barWeight) };
    const none = vec(0, 0);
    const h = settleLadder(s, 0, P1, P2, none, none, null, [contact], [vec(centre.x, 0)]);
    return { result: { kind: "held", h }, level: true };
  }
  if (s.wallCable < levelRope(s, top)) {
    return {
      result: solveHeld(s, top),
      level: false,
      reason: "The rope is too short to hold the stretcher level, even with the ladder upright.",
    };
  }
  let [lo, hi] = [0, top];
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (levelRope(s, mid) > s.wallCable) lo = mid;
    else hi = mid;
  }
  return levelAt(s, (lo + hi) / 2);
}

/**
 * The stretcher level with the ladder at angle phi and the rope just long enough: the stretcher's balance
 * gives the rope's and attachment's pulls and the ladder's push. Where that arrangement can't hold, the
 * ladder is held at that angle and the stretcher left to settle.
 */
function levelAt(s: Setup, phi: number): LevelResult {
  const W = s.barWeight;
  const notLevel = (reason: string): LevelResult => ({ result: solveHeld(s, phi), level: false, reason });
  const [P1, P2] = levelEnds(s, phi);
  if (P1.y < 0) return notLevel("Level, the stretcher's rope end would be below the ground.");
  if (P1.x < 0 && P1.y < s.wallHeight) return notLevel("Level, the stretcher would pass through the wall.");

  // The stretcher's balance: the rope's pull at end 1, the attachment's and the ladder's push at end 2.
  const u1 = unit(sub(ropePathFor(s, P1).wrapEdge ?? vec(-s.anchorBack, s.wallHeight + s.anchorUp), P1));
  const along = vec(Math.cos(phi), Math.sin(phi));
  const u2 = unit(sub(scale(along, s.attachDistance), P2));
  const n = vec(-Math.sin(phi), Math.cos(phi));
  const centre = scale(add(P1, P2), 0.5);
  const x = solveLinear(
    [
      [u1.x, u2.x, n.x],
      [u1.y, u2.y, n.y],
      [cross(sub(P1, P2), u1), 0, 0],
    ],
    [0, W, cross(sub(centre, P2), vec(0, -W)) * -1],
  );
  if (!x) return notLevel("The rope, attachment and ladder can't balance the stretcher level here.");
  const [T1, T2, N] = x;
  const tol = -1e-6 * W;
  if (T1 < tol) return notLevel("The rope would have to push to keep the stretcher level.");
  if (N < tol) return notLevel("The stretcher would lift off the ladder.");
  if (T2 < tol) return notLevel("The stretcher's end would slide up the ladder, with the attachment slack.");

  const ladderAt = sub(P2, scale(n, s.touchGap));
  const h = settleLadder(
    s,
    phi,
    P1,
    P2,
    scale(u1, Math.max(0, T1)),
    scale(u2, Math.max(0, T2)),
    null,
    [{ surface: "ladder", point: P2, force: scale(n, Math.max(0, N)) }],
    [ladderAt],
  );
  return { result: { kind: "held", h }, level: true };
}

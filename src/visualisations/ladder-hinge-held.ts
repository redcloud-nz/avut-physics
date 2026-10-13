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

/** The team holds the ladder at about shoulder height (or at its tip, when that's lower). */
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
  /** The team's push on the ladder, square to it (null when the wall or ground holds it instead). */
  hold: { point: Vec; force: Vec } | null;
  wallOnBeam: { point: Vec; force: Vec } | null;
  /** Force the hinge exerts on the ladder (null when it lies on the ground, which shares the load). */
  hinge: Vec | null;
};

export type HeldResult = { kind: "held"; h: Held } | { kind: "none"; reason: string };

type Kind = "rope" | "attachment" | Surface | "ladder";

/** One constraint, g ≤ 0, whose force on the stretcher pushes along m at the stretcher's point `at`. */
type Piece = { key: string; kind: Kind; g: number; at: Vec; m: Vec; ladderAt?: Vec };

const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;

/** A held answer's stretcher position: centre and angle, from end 1 to end 2. */
const poseOf = (h: Held) => {
  const c = scale(add(h.barEnd1, h.barEnd2), 0.5);
  return [c.x, c.y, Math.atan2(h.barEnd2.y - h.barEnd1.y, h.barEnd2.x - h.barEnd1.x)];
};
const safeUnit = (v: Vec, fallback: Vec) => (len(v) > 1e-12 ? unit(v) : fallback);

/** The point of segment ab nearest p, and how far along it is (0 to 1). */
function nearest(p: Vec, a: Vec, b: Vec) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
  return { point: add(a, scale(ab, t)), t };
}

/**
 * The stretcher with the ladder held at angle phi. Given `from` (the answer at a nearby angle), it settles
 * from there instead of searching every position: the one the stretcher actually reaches as the ladder moves.
 */
export function solveHeld(s: Setup, phi: number, from?: Held): HeldResult {
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

  /**
   * The rope's path to p, over the wall's edge when the straight line would cut through the wall. Unlike the
   * free solver's, it carries on smoothly into the wall, where the minimiser may briefly push an end: as
   * if from the face or the top, whichever is nearer.
   */
  const ropePath = (p: Vec) =>
    !behindFace(p) && cross(sub(edge, anchor), sub(p, anchor)) < 0
      ? { length: len(sub(edge, anchor)) + len(sub(p, edge)), wrapEdge: edge as Vec | null }
      : { length: len(sub(p, anchor)), wrapEdge: null };

  /** The attachment's path to p: straight from its fixing, or over the ladder's tip to the ladder's far side. */
  function attachmentPath(p: Vec): { length: number; via: Vec | null } {
    return dot(p, normal) < 0
      ? { length: len(sub(tip, B)) + len(sub(p, tip)), via: tip }
      : { length: len(sub(p, B)), via: null };
  }

  /** Behind the wall's face: on the wall top, or inside the wall nearer the top than the face. */
  function behindFace(p: Vec) {
    return p.x < 0 && (p.y >= s.wallHeight || s.wallHeight - p.y < -p.x);
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
  const starts: { q: number[]; e: number }[] = from ? [{ q: poseOf(from), e: 0 }] : searchStarts();
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

  // The ladder: the attachment's pull, the stretcher pushing back where it rests on it, its weight, and
  // the team's hold. Leaning on the wall or lying on the ground, those take the torque instead.
  // Wrapped round the tip, the attachment's pull on the ladder acts there (its pulls along the ladder cancel).
  const attachVia = attachmentPath(P2).via;
  const onLadder = [{ at: attachVia ?? B, f: scale(t2, -1) }];
  touching.forEach((p, i) => {
    if (p.ladderAt) onLadder.push({ at: p.ladderAt, f: scale(contacts[i].force, -1) });
  });
  const torque =
    onLadder.reduce((sum, l) => sum + cross(l.at, l.f), 0) - s.beamWeight * (s.beamLength / 2) * Math.cos(phi);
  let hold: Held["hold"] = null;
  let wallOnBeam: Held["wallOnBeam"] = null;
  const down = phi < rad(0.05) && torque <= 0;
  if (phi >= phiMax(s) - 1e-9 && torque > 0) wallOnBeam = wallPush(phi, torque, s);
  else if (!down) {
    const reach = phi > 0 ? Math.min(s.beamLength, HOLD_HEIGHT / Math.sin(phi)) : s.beamLength;
    hold = { point: scale(along, reach), force: scale(normal, -torque / reach) };
  }
  const extra = [hold?.force, wallOnBeam?.force].filter((f): f is Vec => !!f);
  const net = [...onLadder.map((l) => l.f), ...extra].reduce(add, vec(0, 0));
  const path = ropePath(P1);

  return {
    kind: "held",
    h: {
      phi,
      anchor,
      wrapEdge: path.wrapEdge,
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
    },
  };

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

export type LevelResult = { result: HeldResult; level: boolean };

/**
 * The ladder held at whatever angle brings the stretcher level, as a ground team watching it would hold it.
 * From a first guess the angle steps down (or up) until the tilt changes sign, each step settling from the
 * last, then closes in on the level angle by bisection. Where no angle levels it, the closest one.
 */
export function solveLevel(s: Setup, guess = rad(45)): LevelResult {
  const top = phiMax(s);
  const clamp = (phi: number) => Math.max(0, Math.min(top, phi));
  type Try = { phi: number; h: Held };
  const attempt = (phi: number, from?: Held): Try | null => {
    let r = solveHeld(s, phi, from);
    // Settling from a nearby angle can fail where the stretcher's arrangement changes: search afresh.
    if (r.kind === "none" && from) r = solveHeld(s, phi);
    return r.kind === "held" ? { phi, h: r.h } : null;
  };

  // A first angle with an answer: the guess, or the nearest of a spread around it.
  let first: Try | null = null;
  let firstFailure: HeldResult | null = null;
  const spread = [5, 10, 20, 30, 45, 60, 80].flatMap((d) => [guess - rad(d), guess + rad(d)]);
  for (const phi of [guess, ...spread.filter((p) => p > 0 && p < top), top, 0]) {
    const r = solveHeld(s, clamp(phi));
    if (r.kind === "held") {
      first = { phi: clamp(phi), h: r.h };
      break;
    }
    firstFailure ??= r;
  }
  if (!first) return { result: firstFailure ?? solveHeld(s, clamp(guess)), level: false };

  let best = first;
  const keep = (t: Try) => {
    if (Math.abs(t.h.tilt) < Math.abs(best.h.tilt)) best = t;
  };
  // The ladder end high: lower the ladder; low: raise it.
  const dir = first.h.tilt > 0 ? -1 : 1;
  // Steps sized to overshoot the level angle a little, judging by how the tilt has been changing.
  let step = rad(2);
  let a = first;
  let b: Try | null = null;
  while (!b) {
    if ((dir < 0 && a.phi <= 0) || (dir > 0 && a.phi >= top)) break;
    const next = attempt(clamp(a.phi + dir * step), a.h);
    if (!next) break;
    keep(next);
    if (Math.sign(next.h.tilt) !== Math.sign(a.h.tilt)) b = next;
    else {
      const slope = (a.h.tilt - next.h.tilt) / (a.phi - next.phi);
      const ahead = slope * dir < 0 ? Math.abs(next.h.tilt / slope) * 1.5 : 2 * step;
      step = Math.max(rad(0.5), Math.min(rad(15), ahead));
      a = next;
    }
  }
  if (b) {
    // Regula falsi, halving the weight of an end that keeps being kept (the Illinois method).
    let [fa, fb] = [a.h.tilt, b.h.tilt];
    for (let i = 0; i < 20 && Math.abs(best.h.tilt) > rad(0.05) && Math.abs(b.phi - a.phi) > 1e-6; i++) {
      const at = attempt((a.phi * fb - b.phi * fa) / (fb - fa), a.h);
      if (!at) break;
      keep(at);
      if (Math.sign(at.h.tilt) === Math.sign(fa)) {
        [a, fa] = [at, at.h.tilt];
        fb /= 2;
      } else {
        [b, fb] = [at, at.h.tilt];
        fa /= 2;
      }
    }
  }
  return { result: { kind: "held", h: best.h }, level: Math.abs(best.h.tilt) < rad(0.5) };
}

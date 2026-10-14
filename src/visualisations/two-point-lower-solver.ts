import { add, cross, len, scale, sub, unit, vec, type Vec } from "@/lib/vec";
import { behindFaceFor, ropePathFor } from "./ladder-hinge-held";
import { nelderMead, solveLinear, type Surface } from "./ladder-hinge-solver";

/**
 * A two-point lower: a stretcher lowered over a wall on a rope from an anchor behind the wall's top (wrapping
 * over the wall's edge when it has to), with a line from its other end to a ground team out in front, who pull
 * it with a steady force to keep it off the wall. The wall's face is at x = 0, the wall behind it (x < 0), the
 * ground at y = 0 and the team's hands at (teamDistance, TEAM_HEIGHT).
 *
 * The stretcher settles where its potential energy is lowest: its weight's, plus the team's steady pull times
 * the line's length. The stretcher's position is its centre and angle; the rope and each contact is a
 * constraint g ≤ 0 measured in metres, so where one is active its Lagrange multiplier is the force it carries.
 */

export type Setup = {
  wallHeight: number;
  /** The rope's anchor sits this far above the top of the wall and this far back from its face. */
  anchorUp: number;
  anchorBack: number;
  rope: number;
  /** How far out from the wall's face the ground team stands. */
  teamDistance: number;
  /** The team's steady pull on the line (N). */
  teamPull: number;
  barLength: number;
  barWeight: number;
};

/** The team pull on the line from about waist height. */
export const TEAM_HEIGHT = 1;

/**
 * The team stops hauling once the stretcher's end is this close to their hands: they hold it there, easing off
 * their pull as far as letting the line go slack. The rope pays out until the stretcher lies on the ground with
 * its line end this far short of them: the ground is frictionless, so paying out more would only let them drag
 * it in.
 */
export const TEAM_REACH = 1;

export type Contact = { surface: Surface; point: Vec; force: Vec };

export type Lowered = {
  anchor: Vec;
  /** The wall's top edge, when the rope wraps over it. */
  wrapEdge: Vec | null;
  team: Vec;
  /** The wall's top edge, when the line wraps over it to a stretcher end on the wall top. */
  lineEdge: Vec | null;
  barEnd1: Vec; // on the rope
  barEnd2: Vec; // on the line
  /** The stretcher's slope, from −90° to 90°: positive when its line end is the higher. */
  tilt: number;
  ropeTaut: boolean;
  t1: Vec;
  /** The line's pull on the stretcher: the team's steady pull along its last run, or less once they hold its end. */
  t2: Vec;
  /** The stretcher's end has reached the team, who hold it rather than haul it in (the line may hang slack). */
  teamHolding: boolean;
  contacts: Contact[];
};

export type LowerResult = { kind: "lowered"; l: Lowered } | { kind: "none"; reason: string };

type Kind = "rope" | "team" | Surface;

/** One constraint, g ≤ 0, whose force on the stretcher pushes along m at the stretcher's point `at`. */
type Piece = { key: string; kind: Kind; g: number; at: Vec; m: Vec };

const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;

const safeUnit = (v: Vec, fallback: Vec) => (len(v) > 1e-12 ? unit(v) : fallback);

/** The shortest rope that just lets the stretcher, lying on the wall top, reach its edge. */
export const minRope = (s: Pick<Setup, "anchorUp" | "anchorBack" | "barLength">) =>
  Math.hypot(s.anchorUp, s.anchorBack - s.barLength);

/** The longest rope: the stretcher lying on the ground, its line end TEAM_REACH short of the team (along the ground). */
export const maxRope = (s: Setup) =>
  ropePathFor(s, vec(Math.max(0, s.teamDistance - TEAM_REACH - s.barLength), 0)).length;

/** The line's path from the team to p: straight, or over the wall's edge to a stretcher end on the wall top. */
export function linePathFor(s: Setup, p: Vec): { length: number; via: Vec | null } {
  const team = vec(s.teamDistance, TEAM_HEIGHT);
  const edge = vec(0, s.wallHeight);
  return behindFaceFor(s, p) && cross(sub(edge, team), sub(p, team)) > 0
    ? { length: len(sub(edge, team)) + len(sub(p, edge)), via: edge }
    : { length: len(sub(p, team)), via: null };
}

export function solveLower(s: Setup): LowerResult {
  if (s.barWeight <= 0) return { kind: "none", reason: "Give the stretcher some mass." };
  const W = s.barWeight;
  const T = Math.max(0, s.teamPull);
  const half = s.barLength / 2;
  const anchor = vec(-s.anchorBack, s.wallHeight + s.anchorUp);
  const edge = vec(0, s.wallHeight);
  const team = vec(s.teamDistance, TEAM_HEIGHT);

  const ends = (q: number[]): [Vec, Vec] => {
    const d = vec(Math.cos(q[2]), Math.sin(q[2]));
    const c = vec(q[0], q[1]);
    return [sub(c, scale(d, half)), add(c, scale(d, half))];
  };

  /** The team's pull on the stretcher's end, per newton: along the line's last run. */
  const lineDir = (P2: Vec) => safeUnit(sub(linePathFor(s, P2).via ?? team, P2), vec(1, 0));

  const pieces = (q: number[]): Piece[] => {
    const [P1, P2] = ends(q);
    const out: Piece[] = [];
    const path = ropePathFor(s, P1);
    out.push({
      key: "rope",
      kind: "rope",
      g: path.length - s.rope,
      at: P1,
      m: safeUnit(sub(path.wrapEdge ?? anchor, P1), unit(sub(anchor, P1))),
    });
    // At the team's reach they hold the end where it is, easing their pull: a push back along the line, up to
    // their whole pull. Nearer, the line hangs slack (see `pull`), so this is never pushed against like a contact.
    out.push({ key: "team", kind: "team", g: TEAM_REACH - len(sub(P2, team)), at: P2, m: scale(lineDir(P2), -1) });
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
    }
    // Spanning the wall's face, the stretcher must pass above its top edge.
    if (behindFaceFor(s, P1) !== behindFaceFor(s, P2)) {
      const d = unit(sub(P2, P1));
      const up = d.x > 0 ? vec(-d.y, d.x) : vec(d.y, -d.x);
      const at = add(P1, scale(d, dot(sub(edge, P1), d)));
      out.push({ key: "corner", kind: "edge", g: dot(sub(edge, P1), up), at, m: up });
    }
    return out;
  };

  /** The team's pull on the stretcher: steady while the end is out of reach, nothing once it's within it. */
  const pull = (q: number[], holding: boolean) => {
    const P2 = ends(q)[1];
    return holding || linePathFor(s, P2).length > TEAM_REACH ? scale(lineDir(P2), T) : vec(0, 0);
  };

  /** A force's push on the stretcher per newton: its x and y, and its torque about the centre. */
  const generalised = (at: Vec, m: Vec, q: number[]) => [m.x, m.y, cross(sub(at, vec(q[0], q[1])), m)];

  const penalised = (k: number) => (q: number[]) => {
    const P2 = ends(q)[1];
    return (
      W * q[1] +
      T * Math.max(TEAM_REACH, linePathFor(s, P2).length) +
      (k / 2) * pieces(q).reduce((sum, p) => sum + (p.kind === "team" ? 0 : Math.max(0, p.g) ** 2), 0)
    );
  };

  // Starting points: the rope's end at full length in a spread of directions (straight from the anchor, or on
  // from the wall's edge), with the stretcher at a spread of angles.
  const nTheta = 24;
  const nA = 24;
  const toEdge = len(sub(edge, anchor));
  const startAt = (from: number, i: number, j: number) => {
    const theta = -Math.PI + (2 * Math.PI * (i + 0.5)) / nTheta;
    const a = (2 * Math.PI * j) / nA;
    const dir = vec(Math.cos(a), Math.sin(a));
    const P1 = from === 0 ? add(anchor, scale(dir, s.rope * 0.999)) : add(edge, scale(dir, (s.rope - toEdge) * 0.999));
    const c = add(P1, scale(vec(Math.cos(theta), Math.sin(theta)), half));
    return [c.x, c.y, theta];
  };
  const soft = penalised(1e4 * W);
  const stiff = penalised(1e7 * W);
  const starts: { q: number[]; e: number }[] = [];
  for (const from of s.rope > toEdge ? [0, 1] : [0]) {
    const grid = Array.from({ length: nTheta }, (_, i) =>
      Array.from({ length: nA }, (_, j) => soft(startAt(from, i, j))),
    );
    for (let i = 0; i < nTheta; i++) {
      for (let j = 0; j < nA; j++) {
        const e = grid[i][j];
        let isMin = true;
        for (let di = -1; di <= 1 && isMin; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            if ((di || dj) && grid[(i + di + nTheta) % nTheta][(j + dj + nA) % nA] < e) {
              isMin = false;
              break;
            }
          }
        }
        if (isMin) starts.push({ q: startAt(from, i, j), e });
      }
    }
  }
  starts.sort((a, b) => a.e - b.e);
  // An end caught on the wall's corner is a resting place of its own that the grid can miss: start from each
  // end on it too, with the stretcher at a spread of angles.
  const cornerStarts = [0, 1]
    .flatMap((end) =>
      Array.from({ length: nTheta }, (_, i) => {
        const theta = -Math.PI + (2 * Math.PI * (i + 0.5)) / nTheta;
        const c = add(edge, scale(vec(Math.cos(theta), Math.sin(theta)), end === 0 ? half : -half));
        const q = [c.x, c.y + 1e-3, theta];
        return { q, e: soft(q) };
      })
        .sort((a, b) => a.e - b.e)
        .slice(0, 2),
    )
    .filter((st) => Number.isFinite(st.e));

  // Refine the most promising starts, polish each, and keep the one of least energy: two resting places can be
  // close in energy (an end caught on the wall's corner, or the stretcher across its edge), and the penalised
  // energies alone don't tell them apart reliably. Where the polish can't settle (an end pressed into the
  // corner, against both the face and the top), the penalty forces stand in, balancing as well as the
  // minimiser got.
  const energy = (q: number[]) => W * q[1] + T * Math.max(TEAM_REACH, linePathFor(s, ends(q)[1]).length);
  let best: { q: number[]; lambda: Map<string, number>; e: number } | null = null;
  for (const st of [...starts.slice(0, 6), ...cornerStarts]) {
    const refined = nelderMead(stiff, nelderMead(soft, st.q, 0.05), 1e-3);
    if (pieces(refined).some((p) => p.kind !== "team" && p.g > 1e-3)) continue;
    const polished = polish(refined);
    const candidate = polished ?? {
      q: refined,
      lambda: new Map(
        pieces(refined)
          .filter((p) => p.kind !== "team" && p.g > 0)
          .map((p) => [p.key, 1e7 * W * p.g]),
      ),
    };
    const e = energy(candidate.q);
    if (!best || e < best.e - 1e-6 * W) best = { ...candidate, e };
  }
  if (!best) {
    return {
      kind: "none",
      reason: "The stretcher can't find a resting place clear of the wall and the ground here.",
    };
  }
  const { q, lambda } = best;

  const final = pieces(q);

  const [P1, P2] = ends(q);
  const forceOf = (p: Piece) => scale(p.m, Math.max(0, lambda.get(p.key) ?? 0));
  const byKey = new Map(final.map((p) => [p.key, p]));
  const t1 = forceOf(byKey.get("rope")!);
  const holding = lambda.has("team");
  const t2 = add(pull(q, holding), forceOf(byKey.get("team")!));
  const contacts = final
    .filter((p) => p.kind !== "rope" && p.kind !== "team" && len(forceOf(p)) > 1e-9)
    .map((p) => ({ surface: p.kind as Surface, point: p.at, force: forceOf(p) }));

  return {
    kind: "lowered",
    l: {
      anchor,
      wrapEdge: ropePathFor(s, P1).wrapEdge,
      team,
      lineEdge: linePathFor(s, P2).via,
      barEnd1: P1,
      barEnd2: P2,
      tilt: Math.atan2(P2.y - P1.y, Math.abs(P2.x - P1.x)),
      ropeTaut: len(t1) > 1e-9,
      t1,
      t2,
      teamHolding: holding || linePathFor(s, P2).length < TEAM_REACH,
      contacts,
    },
  };

  /**
   * Solve the balance exactly with the constraints the stretcher is pressed against, dropping any that would
   * have to pull and adding any it ends up pushed into. The team's hold is let go if they'd have to more than
   * ease off entirely. Returns null if it doesn't settle.
   */
  function polish(q0: number[]): { q: number[]; lambda: Map<string, number> } | null {
    let q = q0;
    const active = new Set(
      pieces(q)
        .filter((p) => (p.kind === "team" ? Math.abs(p.g) < 1e-5 : p.g > -1e-5))
        .map((p) => p.key),
    );
    for (let round = 0; round < 8; round++) {
      const polished = kkt(q, [...active]);
      if (!polished) return null;
      const negative = [...polished.lambda]
        .filter(([k, l]) => l < -1e-6 * W || (k === "team" && l > T * (1 + 1e-9)))
        .sort((a, b) => a[1] - b[1]);
      const intruding = pieces(polished.q).filter((p) => !active.has(p.key) && p.kind !== "team" && p.g > 1e-7);
      if (negative.length === 0 && intruding.length === 0) return polished;
      if (negative.length > 0) active.delete(negative[0][0]);
      for (const p of intruding) active.add(p.key);
      q = polished.q;
    }
    return null;
  }

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
    /** The forces that don't depend on the multipliers: the weight and the team's pull. */
    const holding = keys.includes("team");
    const applied = (q: number[]) => generalised(ends(q)[1], pull(q, holding), q).map((v, j) => v + (j === 1 ? -W : 0));
    const residual = (q: number[], l: number[]) => {
      const ps = at(q);
      if (ps.some((p) => !p)) return null;
      const r = applied(q);
      ps.forEach((p, i) => generalised(p!.at, p!.m, q).forEach((v, j) => (r[j] += l[i] * v)));
      // Constraint rows scaled to newtons, so the two kinds of row weigh alike.
      return [...r, ...ps.map((p) => W * p!.g)];
    };
    // A first guess at the forces: least squares on the balance at the starting position.
    const ps0 = at(q0);
    if (ps0.some((p) => !p)) return null;
    const cols = ps0.map((p) => generalised(p!.at, p!.m, q0));
    const rhs = applied(q0).map((v) => -v);
    let l =
      m === 0
        ? []
        : (solveLinear(
            cols.map((a, i) => cols.map((b, k) => a.reduce((sum, v, j) => sum + v * b[j], 0) + (i === k ? 1e-9 : 0))),
            cols.map((a) => a.reduce((sum, v, j) => sum + v * rhs[j], 0)),
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
      at(q).forEach((p, i) => generalised(p!.at, p!.m, q).forEach((v, j) => (J[j][3 + i] = v)));
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

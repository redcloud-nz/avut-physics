import { centralDifferences, gridMinima, leastSquares, nelderMead } from "@/lib/numeric";
import { Vector2, vec2 } from "@/lib/vector2";
import { behindFaceFor, ropePathFor } from "./ladder-hinge-held";
import type { Surface } from "./ladder-hinge-solver";

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

export type Contact = { surface: Surface; point: Vector2; force: Vector2 };

export type Lowered = {
  anchor: Vector2;
  /** The wall's top edge, when the rope wraps over it. */
  wrapEdge: Vector2 | null;
  team: Vector2;
  /** The wall's top edge, when the line wraps over it to a stretcher end on the wall top. */
  lineEdge: Vector2 | null;
  barEnd1: Vector2; // on the rope
  barEnd2: Vector2; // on the line
  /** The stretcher's slope, from −90° to 90°: positive when its line end is the higher. */
  tilt: number;
  ropeTaut: boolean;
  t1: Vector2;
  /** The line's pull on the stretcher: the team's steady pull along its last run, or less once they hold its end. */
  t2: Vector2;
  /** The stretcher's end has reached the team, who hold it rather than haul it in (the line may hang slack). */
  teamHolding: boolean;
  contacts: Contact[];
};

export type LowerResult = { kind: "lowered"; l: Lowered } | { kind: "none"; reason: string };

type Kind = "rope" | "team" | Surface;

/** One constraint, g ≤ 0, whose force on the stretcher pushes along m at the stretcher's point `at`. */
type Piece = { key: string; kind: Kind; g: number; at: Vector2; m: Vector2 };

/** The shortest rope that just lets the stretcher, lying on the wall top, reach its edge. */
export const minRope = (s: Pick<Setup, "anchorUp" | "anchorBack" | "barLength">) =>
  Math.hypot(s.anchorUp, s.anchorBack - s.barLength);

/** The longest rope: the stretcher lying on the ground, its line end TEAM_REACH short of the team (along the ground). */
export const maxRope = (s: Setup) =>
  ropePathFor(s, vec2(Math.max(0, s.teamDistance - TEAM_REACH - s.barLength), 0)).length;

/** The line's path from the team to p: straight, or over the wall's edge to a stretcher end on the wall top. */
export function linePathFor(s: Setup, p: Vector2): { length: number; via: Vector2 | null } {
  const team = vec2(s.teamDistance, TEAM_HEIGHT);
  const edge = vec2(0, s.wallHeight);
  return behindFaceFor(s, p) && edge.sub(team).cross(p.sub(team)) > 0
    ? { length: edge.distanceTo(team) + p.distanceTo(edge), via: edge }
    : { length: p.distanceTo(team), via: null };
}

export function solveLower(s: Setup): LowerResult {
  if (s.barWeight <= 0) return { kind: "none", reason: "Give the stretcher some mass." };
  const W = s.barWeight;
  const T = Math.max(0, s.teamPull);
  const half = s.barLength / 2;
  const anchor = vec2(-s.anchorBack, s.wallHeight + s.anchorUp);
  const edge = vec2(0, s.wallHeight);
  const team = vec2(s.teamDistance, TEAM_HEIGHT);

  const ends = (q: number[]): [Vector2, Vector2] => {
    const d = Vector2.fromAngle(q[2]);
    const c = vec2(q[0], q[1]);
    return [c.sub(d.scale(half)), c.add(d.scale(half))];
  };

  /** The team's pull on the stretcher's end, per newton: along the line's last run. */
  const lineDir = (P2: Vector2) => (linePathFor(s, P2).via ?? team).sub(P2).safeUnit(vec2(1, 0));

  const pieces = (q: number[]): Piece[] => {
    const [P1, P2] = ends(q);
    const out: Piece[] = [];
    const path = ropePathFor(s, P1);
    out.push({
      key: "rope",
      kind: "rope",
      g: path.length - s.rope,
      at: P1,
      m: (path.wrapEdge ?? anchor).sub(P1).safeUnit(anchor.sub(P1).unit()),
    });
    // At the team's reach they hold the end where it is, easing their pull: a push back along the line, up to
    // their whole pull. Nearer, the line hangs slack (see `pull`), so this is never pushed against like a contact.
    out.push({ key: "team", kind: "team", g: TEAM_REACH - P2.distanceTo(team), at: P2, m: lineDir(P2).neg() });
    for (const [i, P] of [P1, P2].entries()) {
      out.push({ key: `ground${i}`, kind: "ground", g: -P.y, at: P, m: vec2(0, 1) });
      // The wall's signed distance: inside, out through the nearer of the face and the top.
      const h = s.wallHeight;
      const wall: Omit<Piece, "key" | "at"> =
        P.x < 0 && P.y < h
          ? h - P.y < -P.x
            ? { kind: "top", g: h - P.y, m: vec2(0, 1) }
            : { kind: "wall", g: -P.x, m: vec2(1, 0) }
          : P.x >= 0 && P.y >= h
            ? { kind: "edge", g: -P.distanceTo(edge), m: P.sub(edge).safeUnit(vec2(0, 1)) }
            : P.x >= 0
              ? { kind: "wall", g: -P.x, m: vec2(1, 0) }
              : { kind: "top", g: h - P.y, m: vec2(0, 1) };
      out.push({ key: `wall${i}`, at: P, ...wall });
    }
    // Spanning the wall's face, the stretcher must pass above its top edge.
    if (behindFaceFor(s, P1) !== behindFaceFor(s, P2)) {
      const d = P2.sub(P1).unit();
      const up = d.x > 0 ? d.perp() : d.perp().neg();
      const at = P1.add(d.scale(edge.sub(P1).dot(d)));
      out.push({ key: "corner", kind: "edge", g: edge.sub(P1).dot(up), at, m: up });
    }
    return out;
  };

  /** The team's pull on the stretcher: steady while the end is out of reach, nothing once it's within it. */
  const pull = (q: number[], holding: boolean) => {
    const P2 = ends(q)[1];
    return holding || linePathFor(s, P2).length > TEAM_REACH ? lineDir(P2).scale(T) : Vector2.ZERO;
  };

  /** A force's push on the stretcher per newton: its x and y, and its torque about the centre. */
  const generalised = (at: Vector2, m: Vector2, q: number[]) => [m.x, m.y, at.sub(vec2(q[0], q[1])).cross(m)];

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
  const toEdge = edge.distanceTo(anchor);
  const startAt = (from: number, i: number, j: number) => {
    const theta = -Math.PI + (2 * Math.PI * (i + 0.5)) / nTheta;
    const a = (2 * Math.PI * j) / nA;
    const dir = Vector2.fromAngle(a);
    const P1 = from === 0 ? anchor.add(dir.scale(s.rope * 0.999)) : edge.add(dir.scale((s.rope - toEdge) * 0.999));
    const c = P1.add(Vector2.fromAngle(theta, half));
    return [c.x, c.y, theta];
  };
  const soft = penalised(1e4 * W);
  const stiff = penalised(1e7 * W);
  const starts: { q: number[]; e: number }[] = [];
  for (const from of s.rope > toEdge ? [0, 1] : [0]) {
    const grid = Array.from({ length: nTheta }, (_, i) =>
      Array.from({ length: nA }, (_, j) => soft(startAt(from, i, j))),
    );
    for (const { i, j, e } of gridMinima(grid)) starts.push({ q: startAt(from, i, j), e });
  }
  starts.sort((a, b) => a.e - b.e);
  // An end caught on the wall's corner is a resting place of its own that the grid can miss: start from each
  // end on it too, with the stretcher at a spread of angles.
  const cornerStarts = [0, 1]
    .flatMap((end) =>
      Array.from({ length: nTheta }, (_, i) => {
        const theta = -Math.PI + (2 * Math.PI * (i + 0.5)) / nTheta;
        const c = edge.add(Vector2.fromAngle(theta, end === 0 ? half : -half));
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
  const forceOf = (p: Piece) => p.m.scale(Math.max(0, lambda.get(p.key) ?? 0));
  const byKey = new Map(final.map((p) => [p.key, p]));
  const t1 = forceOf(byKey.get("rope")!);
  const holding = lambda.has("team");
  const t2 = pull(q, holding).add(forceOf(byKey.get("team")!));
  const contacts = final
    .filter((p) => p.kind !== "rope" && p.kind !== "team" && forceOf(p).len() > 1e-9)
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
      ropeTaut: t1.len() > 1e-9,
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
        : (leastSquares([0, 1, 2].map((j) => cols.map((c) => c[j])), rhs, 1e-9) ?? keys.map(() => 0));
    let q = [...q0];
    for (let iter = 0; iter < 40; iter++) {
      const r = residual(q, l);
      if (!r) return null;
      const size = Math.max(...r.map(Math.abs));
      if (size < 1e-9 * W) return { q, lambda: new Map(keys.map((k, i) => [k, l[i]])) };
      // Jacobian: numerically in the position, exactly in the forces (the balance is linear in them).
      const dq = centralDifferences((q) => residual(q, l), q, [1e-7, 1e-7, 1e-7 / half]);
      if (!dq) return null;
      const forces = at(q).map((p) => generalised(p!.at, p!.m, q));
      const J = dq.map((row, j) => [...row, ...forces.map((f) => (j < 3 ? f[j] : 0))]);
      // Least squares (square and well-posed in the usual case; more contacts than freedoms otherwise).
      const dx = leastSquares(J, r.map((v) => -v), 1e-12 * W * W);
      if (!dx) return null;
      q = q.map((v, j) => v + dx[j]);
      l = l.map((v, i) => v + dx[3 + i]);
    }
    return null;
  }
}

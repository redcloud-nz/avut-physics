import { add, cross, len, rad, scale, sub, unit, vec, type Vec } from "@/lib/vec";

/**
 * Statics of a beam hinged at the base of a wall (origin, y up), with a second, hanging bar suspended
 * by two cables: one from the top of the wall to one end of the bar, one from the other end of the bar
 * to the beam.
 *
 * With both cables taut the system has two degrees of freedom (beam angle, direction of the wall
 * cable). The equilibrium is the configuration of least potential energy, where the ground stops the
 * beam at horizontal and stops the bar's ends from going below ground level or into the wall. Once the
 * configuration is known, the force and torque balances give the cable tensions and contact forces.
 */

export type Setup = {
  wallHeight: number;
  /** Cable 1's anchor sits this far above the top of the wall and this far back from its face. */
  anchorUp: number;
  anchorBack: number;
  wallCable: number; // cable 1 length: wall → bar end 1
  beamCable: number; // cable 2 length: bar end 2 → beam
  beamLength: number;
  attachDistance: number; // where cable 2 meets the beam, measured from the hinge
  barLength: number;
  beamWeight: number;
  barWeight: number;
};

export type Equilibrium = {
  phi: number; // beam angle above horizontal
  /** Cable 1's anchor, and the wall's top edge if the cable wraps over it on its way to the bar. */
  anchor: Vec;
  wrapEdge: Vec | null;
  beamAttach: Vec;
  barEnd1: Vec; // attached to the wall cable
  barEnd2: Vec; // attached to the beam cable
  /** Forces the cables exert on the bar (at barEnd1 and barEnd2). */
  t1: Vec;
  t2: Vec;
  /** Where the bar's end rests on the ground or against the wall, and the force pushing back (if any). */
  contact: { point: Vec; force: Vec } | null;
  /** Force the beam cable exerts on the beam, at beamAttach. */
  cableOnBeam: Vec;
  /** Force the hinge exerts on the beam. */
  hinge: Vec;
};

/**
 * Once the main beam is down, the model simplifies: the bar's beam end is fixed on top of the main beam
 * (or just above it, where it was at touchdown, if the wall cable couldn't reach otherwise). From then on
 * the main beam and the short cable between the beams are left out, and the bar pivots on that fixed point. It lies
 * flat on the main beam if the wall cable is long enough, otherwise the wall cable holds its other end up.
 */
export type Resting = {
  anchor: Vec;
  wrapEdge: Vec | null;
  barEnd1: Vec; // held by the wall cable (or lying on the main beam when the cable is slack)
  barEnd2: Vec; // resting on the main beam
  angle: number; // bar's angle above horizontal
  cableTaut: boolean;
  t1: Vec; // wall cable's pull on the bar (zero when slack)
  support: Vec; // force on the bar at its fixed resting point (or spread along the main beam when lying flat)
  supportAt: Vec;
  /** What barEnd1 rests on when the cable is slack and the bar can't lie flat on the main beam. */
  end1Contact: { surface: "wall" | "ground"; force: Vec } | null;
};

export type Result =
  | { kind: "raised"; eq: Equilibrium }
  | { kind: "resting"; rest: Resting; reason: string }
  | { kind: "none"; reason: string };

/** The full model's outcome: beam raised, beam down on the ground, or no taut arrangement (maybe slack). */
type TautResult =
  | { kind: "raised"; eq: Equilibrium }
  | { kind: "down"; barEnd2: Vec }
  | { kind: "none"; reason: string; slack: boolean };

const fail = (reason: string): TautResult => ({ kind: "none", reason, slack: false });

/** A failure where, in reality, a cable just goes slack and everything settles onto the ground. */
const slack = (reason: string): TautResult => ({ kind: "none", reason, slack: true });

type Branch = 1 | -1;

type Geometry = { phi: number; B: Vec; P1: Vec; P2: Vec; wrapEdge: Vec | null };

/**
 * Where the wall cable ends, given the direction alpha of its last straight run (measured from straight
 * down, positive away from the wall). Directions that would cut through the wall's top edge instead
 * wrap over that edge, which then acts like a frictionless pulley.
 */
function wallCableEnd(alpha: number, s: Setup): { P1: Vec; wrapEdge: Vec | null } | null {
  const C = vec(-s.anchorBack, s.wallHeight + s.anchorUp);
  const edge = vec(0, s.wallHeight);
  const dir = vec(Math.sin(alpha), -Math.cos(alpha));
  const toEdge = Math.hypot(s.anchorBack, s.anchorUp);
  const edgeAlpha = Math.atan2(s.anchorBack, s.anchorUp);
  // A straight run steeper than the line to the edge drops to the wall's top level behind the edge.
  const reachesWallTop = s.wallCable * Math.cos(alpha) > s.anchorUp;
  if (toEdge > 1e-9 && alpha < edgeAlpha && reachesWallTop) {
    // Too short to get past the edge: the cable would end inside the wall.
    if (s.wallCable <= toEdge) return null;
    return { P1: add(edge, scale(dir, s.wallCable - toEdge)), wrapEdge: edge };
  }
  return { P1: add(C, scale(dir, s.wallCable)), wrapEdge: null };
}

const PHI_MAX = rad(89.9);
const ALPHA_MAX = rad(175);
const WALL_CABLE_SLACK = "The wall cable is too long: it goes slack, and the beam and hanging beam drop to the ground.";

/** Points within this distance of the ground or wall count as touching it. */
const CONTACT = 1e-4;

/** Positions for a trial configuration, or null if the cables can't both be taut there. */
function geometry(phi: number, alpha: number, branch: Branch, s: Setup): Geometry | null {
  const B = scale(vec(Math.cos(phi), Math.sin(phi)), s.attachDistance);
  const end = wallCableEnd(alpha, s);
  if (!end) return null;
  const { P1, wrapEdge } = end;

  // Bar end 2 is barLength from P1 and beamCable from B: a circle–circle intersection.
  const d = sub(B, P1);
  const dist = Math.hypot(d.x, d.y);
  const r1 = s.barLength;
  const r2 = s.beamCable;
  if (dist < 1e-9 || dist > r1 + r2 || dist < Math.abs(r1 - r2)) return null;
  const along = (dist * dist + r1 * r1 - r2 * r2) / (2 * dist);
  const h = Math.sqrt(Math.max(0, r1 * r1 - along * along));
  const ud = scale(d, 1 / dist);
  const perp = vec(-ud.y, ud.x);
  const P2 = add(add(P1, scale(ud, along)), scale(perp, branch * h));
  return { phi, B, P1, P2, wrapEdge };
}

/** How far a point has pushed into the ground and into the wall (both ≥ 0). */
function penetration(p: Vec, s: Setup) {
  return { ground: Math.max(0, -p.y), wall: p.y < s.wallHeight ? Math.max(0, -p.x) : 0 };
}

/**
 * How far the bar is from over-rotating: its wall-cable end must stay nearer the wall than both its
 * other end and the beam's attachment point. Arrangements past that only keep both cables taut by
 * flipping the bar over or standing it on end; in reality the wall cable just goes slack.
 */
const rotationMargin = (g: Geometry) => Math.min(g.B.x - g.P1.x, g.P2.x - g.P1.x);

/**
 * Potential energy, with the ground and wall modelled as very stiff one-sided springs at the bar's ends
 * (so the minimiser can slide along them). Infinite where the configuration is impossible.
 */
function energy(phi: number, alpha: number, branch: Branch, s: Setup): number {
  if (phi < 0 || phi > PHI_MAX || Math.abs(alpha) > ALPHA_MAX) return Infinity;
  const g = geometry(phi, alpha, branch, s);
  if (!g || rotationMargin(g) < 0) return Infinity;

  const stiffness = 1e7 * (s.beamWeight + s.barWeight);
  const pen1 = penetration(g.P1, s);
  const pen2 = penetration(g.P2, s);
  const below = pen1.ground ** 2 + pen1.wall ** 2 + pen2.ground ** 2 + pen2.wall ** 2;
  return (
    s.beamWeight * (s.beamLength / 2) * Math.sin(phi) +
    (s.barWeight * (g.P1.y + g.P2.y)) / 2 +
    (stiffness * below) / 2
  );
}

/** Nelder–Mead minimisation, restarted a few times from the best point to avoid early stalls. */
function nelderMead(f: (x: number[]) => number, start: number[], step: number): number[] {
  const n = start.length;
  const lerp = (a: number[], b: number[], t: number) => a.map((ai, i) => ai + t * (b[i] - ai));
  let best = start;
  for (let restart = 0; restart < 4; restart++) {
    let simplex = [best, ...best.map((_, i) => best.map((v, j) => (i === j ? v + step : v)))].map((x) => ({ x, v: f(x) }));
    for (let iter = 0; iter < 400 * n; iter++) {
      simplex.sort((a, b) => a.v - b.v);
      const lo = simplex[0];
      const hi = simplex[n];
      const size = Math.max(...simplex.slice(1).map((p) => Math.max(...p.x.map((v, i) => Math.abs(v - lo.x[i])))));
      if (size < 1e-12) break;
      const centroid = lo.x.map((_, i) => simplex.slice(0, n).reduce((sum, p) => sum + p.x[i], 0) / n);
      const at = (t: number) => lerp(centroid, hi.x, t);
      const r = { x: at(-1), v: f(at(-1)) };
      if (r.v < lo.v) {
        const e = { x: at(-2), v: f(at(-2)) };
        simplex[n] = e.v < r.v ? e : r;
      } else if (r.v < simplex[n - 1].v) {
        simplex[n] = r;
      } else {
        const k = { x: at(0.5), v: f(at(0.5)) };
        if (k.v < hi.v) {
          simplex[n] = k;
        } else {
          simplex = simplex.map((p, i) => {
            if (i === 0) return p;
            const x = lerp(lo.x, p.x, 0.5);
            return { x, v: f(x) };
          });
        }
      }
    }
    simplex.sort((a, b) => a.v - b.v);
    best = simplex[0].x;
    step /= 10;
  }
  return best;
}

/** Solve a small linear system by Gaussian elimination with partial pivoting. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const k = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= k * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

function solveTaut(s: Setup): TautResult {
  if (s.barWeight <= 0) return fail("Give the hanging beam some mass.");
  const toEdge = Math.hypot(s.anchorBack, s.anchorUp);
  if (s.wallCable <= toEdge) {
    return fail(`The wall cable must be longer than the ${toEdge.toFixed(2)} m from its anchor to the wall's edge.`);
  }

  // Coarse grid over both branches. Every grid point lower than its neighbours is a candidate start;
  // refine the lowest few on each branch, then keep the lowest-energy one that is a real equilibrium.
  const nPhi = 120;
  const nAlpha = 180;
  const candidates: { phi: number; alpha: number; branch: Branch; e: number }[] = [];
  for (const branch of [1, -1] as const) {
    const grid: number[][] = [];
    for (let i = 0; i <= nPhi; i++) {
      grid.push([]);
      for (let j = 0; j <= nAlpha; j++) {
        grid[i].push(energy((PHI_MAX * i) / nPhi, -ALPHA_MAX + (2 * ALPHA_MAX * j) / nAlpha, branch, s));
      }
    }
    const starts: { i: number; j: number; e: number }[] = [];
    for (let i = 0; i <= nPhi; i++) {
      for (let j = 0; j <= nAlpha; j++) {
        const e = grid[i][j];
        if (!Number.isFinite(e)) continue;
        let isMin = true;
        for (let di = -1; di <= 1 && isMin; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            const n = grid[i + di]?.[j + dj];
            if ((di || dj) && n !== undefined && n < e) {
              isMin = false;
              break;
            }
          }
        }
        if (isMin) starts.push({ i, j, e });
      }
    }
    starts.sort((a, b) => a.e - b.e);
    const f = ([phi, alpha]: number[]) => energy(phi, alpha, branch, s);
    for (const st of starts.slice(0, 4)) {
      const [phi, alpha] = nelderMead(f, [(PHI_MAX * st.i) / nPhi, -ALPHA_MAX + (2 * ALPHA_MAX * st.j) / nAlpha], PHI_MAX / nPhi);
      candidates.push({ phi, alpha, branch, e: f([phi, alpha]) });
    }
  }
  if (candidates.length === 0) {
    // Nothing allowed. If the cables could be taut by over-rotating, the wall cable is simply too long.
    const tautIfFlipped = [1, -1].some((branch) =>
      Array.from({ length: nPhi + 1 }, (_, i) => i).some((i) =>
        Array.from({ length: nAlpha + 1 }, (_, j) => j).some(
          (j) => geometry((PHI_MAX * i) / nPhi, -ALPHA_MAX + (2 * ALPHA_MAX * j) / nAlpha, branch as Branch, s) !== null,
        ),
      ),
    );
    return tautIfFlipped
      ? slack(WALL_CABLE_SLACK)
      : fail("The cables can't reach between the wall, the hanging beam and the main beam.");
  }

  candidates.sort((a, b) => a.e - b.e);
  let firstFailure: TautResult | null = null;
  for (const c of candidates) {
    const result = checkEquilibrium(geometry(c.phi, c.alpha, c.branch, s)!, s);
    if (result.kind !== "none") return result;
    firstFailure ??= result;
  }
  return firstFailure!;
}

/**
 * Turn a minimum-energy arrangement into forces, and check it really is an equilibrium: cables pulling,
 * contacts pushing, and every body's forces and torques balanced.
 */
function checkEquilibrium(g: Geometry, s: Setup): TautResult {
  // Pressed up against the over-rotation limit: only a flipped bar could keep both cables taut.
  if (rotationMargin(g) < 1e-3) {
    return slack(WALL_CABLE_SLACK);
  }
  // The main beam is down: the simpler resting model takes over from here.
  if (g.phi < rad(0.05)) return { kind: "down", barEnd2: vec(g.P2.x, Math.max(0, g.P2.y)) };

  // Snap tiny penalty penetrations back onto the surfaces, and note which surfaces each end touches.
  const contacts: { point: Vec; normal: Vec }[] = [];
  const settle = (p: Vec) => {
    const pen = penetration(p, s);
    const q = vec(p.x + pen.wall, p.y + pen.ground);
    if (q.y < CONTACT) contacts.push({ point: q, normal: vec(0, 1) });
    if (q.x < CONTACT && q.y < s.wallHeight) contacts.push({ point: q, normal: vec(1, 0) });
    return q;
  };
  const P1 = settle(g.P1);
  const P2 = settle(g.P2);
  if (contacts.length > 1) {
    return slack("The hanging beam would rest on the ground or wall at both ends, with its cables slack.");
  }

  // Bar equilibrium. Unknowns: T1, T2 and the contact force (if any).
  // Equations: ΣFx = 0, ΣFy = W and, with a contact, Σ torque about end 1 = 0.
  const C = vec(-s.anchorBack, s.wallHeight + s.anchorUp);
  const u1 = unit(sub(g.wrapEdge ?? C, P1)); // the wall cable pulls towards the anchor, or the edge it wraps over
  const u2 = unit(sub(g.B, P2));
  const centre = scale(add(P1, P2), 0.5);
  const contact = contacts[0];
  const x = contact
    ? solveLinear(
        [
          [u1.x, u2.x, contact.normal.x],
          [u1.y, u2.y, contact.normal.y],
          [0, cross(sub(P2, P1), u2), cross(sub(contact.point, P1), contact.normal)],
        ],
        [0, s.barWeight, s.barWeight * (centre.x - P1.x)],
      )
    : solveLinear(
        [
          [u1.x, u2.x],
          [u1.y, u2.y],
        ],
        [0, s.barWeight],
      );
  if (!x) return fail("The cables pull in a straight line, so the tension would be unbounded.");
  const [T1, T2, push = 0] = x;
  if (!(T1 > 0) || !(T2 > 0)) {
    return slack("One cable would go slack, so the hanging beam can't be held by both.");
  }
  if (push < -1e-6) {
    return fail("The hanging beam would need to be pulled by the ground or wall.");
  }
  // Without a contact, the torque balance on the bar isn't one of the equations solved above. It holds
  // at a true minimum, but not where the bar and beam cable are pulled into a straight line (the
  // search's boundary) — there the beam cable would really go slack.
  const barTorque = cross(sub(P2, P1), scale(u2, T2)) - s.barWeight * (centre.x - P1.x);
  if (!contact && Math.abs(barTorque) > 1e-3 * s.barWeight * s.barLength) {
    return slack("The beam cable would go slack and the hanging beam would drop onto the ground, so nothing holds the beam up.");
  }

  const t1 = scale(u1, T1);
  const t2 = scale(u2, T2);
  const cableOnBeam = scale(t2, -1);

  // The cables can only pull. If the beam's torques don't balance, the cable would be acting as a
  // strut; in reality it goes slack and everything settles onto the ground instead.
  const beamTorque = cross(g.B, cableOnBeam) - s.beamWeight * (s.beamLength / 2) * Math.cos(g.phi);
  const tolerance = 1e-3 * (s.beamWeight + s.barWeight) * s.beamLength;
  if (Math.abs(beamTorque) > tolerance) {
    return slack("The beam cable goes slack: the hanging beam rests on the ground and can't hold the beam up.");
  }
  return {
    kind: "raised",
    eq: {
      phi: g.phi,
      anchor: C,
      wrapEdge: g.wrapEdge,
      beamAttach: g.B,
      barEnd1: P1,
      barEnd2: P2,
      t1,
      t2,
      contact: contact ? { point: contact.point, force: scale(contact.normal, Math.max(0, push)) } : null,
      cableOnBeam,
      hinge: vec(-cableOnBeam.x, s.beamWeight - cableOnBeam.y),
    },
  };
}

const BEAM_DOWN = "The cables can't hold the main beam up, so it rests on the ground.";

export function solve(s: Setup): Result {
  const result = solveTaut(s);
  if (result.kind === "raised") return result;
  if (result.kind === "down" || result.slack) {
    // Fix the bar's beam end on top of the main beam, one beam-cable length in from the attachment, where
    // it lands as the beam touches down. That point doesn't depend on the wall cable's length, so a longer
    // cable just lets the bar drop lower. Only if the wall cable can't reach from there is the end left where
    // it was at touchdown, just above the main beam, still held up by the short cable.
    const rest =
      restOnBeam(s, vec(s.attachDistance - s.beamCable, 0)) ??
      (result.kind === "down" ? restOnBeam(s, result.barEnd2) : null);
    if (rest) return { kind: "resting", rest, reason: BEAM_DOWN };
    return {
      kind: "none",
      reason: "The main beam would be on the ground, but the wall cable is too short for the hanging beam to rest on it.",
    };
  }
  return { kind: "none", reason: result.reason };
}

/** Length of the wall cable's path from its anchor to p, wrapping over the wall's top edge if it has to. */
function wallCablePath(p: Vec, s: Setup): { length: number; wrapEdge: Vec | null } {
  const C = vec(-s.anchorBack, s.wallHeight + s.anchorUp);
  const edge = vec(0, s.wallHeight);
  if (p.x > -1e-9) {
    // Height at which the straight line from the anchor crosses the wall's front face.
    const yAtFace = C.y + ((p.y - C.y) * (0 - C.x)) / (p.x - C.x);
    if (yAtFace < s.wallHeight) return { length: len(sub(edge, C)) + len(sub(p, edge)), wrapEdge: edge };
  }
  return { length: len(sub(p, C)), wrapEdge: null };
}

/**
 * The bar pivots on its fixed beam end and drops as low as the wall cable allows. If the cable reaches,
 * it goes slack and the bar comes to rest flat on the main beam, or with its other end on the ground or
 * against the wall. Otherwise the bar hangs at the angle where the cable is just taut. Null if even an
 * upright bar is out of the cable's reach.
 */
function restOnBeam(s: Setup, end2: Vec): Resting | null {
  const anchor = vec(-s.anchorBack, s.wallHeight + s.anchorUp);
  const end1At = (angle: number) => add(end2, scale(vec(-Math.cos(angle), Math.sin(angle)), s.barLength));
  // A hair of tolerance: the touchdown arrangement has the cable exactly taut.
  const reaches = (angle: number) => wallCablePath(end1At(angle), s).length <= s.wallCable * (1 + 1e-9);

  // Lowest angle the bar can physically reach: end 1 on the ground (if end 2 is raised), or touching the
  // wall face if the fixed end is closer to the wall than the bar is long.
  const groundAngle = -Math.asin(Math.min(1, end2.y / s.barLength));
  const wallAngle = end2.x < s.barLength ? Math.acos(end2.x / s.barLength) : -Infinity;
  const lowest = Math.max(groundAngle, wallAngle);

  // Lowest angle the cable allows: scan up from the lowest position, then bisect onto where it is taut.
  let angle = lowest;
  if (!reaches(lowest)) {
    const steps = 900;
    const at = (i: number) => lowest + ((Math.PI / 2 - lowest) * i) / steps;
    let hi = -1;
    for (let i = 1; i <= steps && hi < 0; i++) if (reaches(at(i))) hi = i;
    if (hi < 0) return null;
    let a = at(hi - 1);
    let b = at(hi);
    for (let j = 0; j < 50; j++) {
      const m = (a + b) / 2;
      if (reaches(m)) b = m;
      else a = m;
    }
    angle = b;
  }

  const end1 = end1At(angle);
  const centre = scale(add(end1, end2), 0.5);
  const path = wallCablePath(end1, s);
  const base = { anchor, wrapEdge: path.wrapEdge, barEnd1: end1, barEnd2: end2, angle };
  const W = s.barWeight;

  if (angle > lowest) {
    // Cable taut: torques about the fixed end give the tension; the fixed end takes the rest.
    const u1 = unit(sub(path.wrapEdge ?? anchor, end1));
    const t1 = scale(u1, (W * (centre.x - end2.x)) / cross(sub(end1, end2), u1));
    return { ...base, cableTaut: true, t1, support: vec(-t1.x, W - t1.y), supportAt: end2, end1Contact: null };
  }

  const slack = { ...base, cableTaut: false, t1: vec(0, 0) };
  if (lowest === wallAngle) {
    // Leaning on the wall face: torques about the fixed end give the wall's (horizontal) push.
    const push = (W * (end2.x - centre.x)) / (end1.y - end2.y);
    return { ...slack, support: vec(-push, W), supportAt: end2, end1Contact: { surface: "wall", force: vec(push, 0) } };
  }
  if (end2.y > 1e-9) {
    // End 1 on the ground, end 2 fixed just above it: each end carries half the weight.
    return { ...slack, support: vec(0, W / 2), supportAt: end2, end1Contact: { surface: "ground", force: vec(0, W / 2) } };
  }
  // Lying flat on the main beam, which carries the whole weight.
  return { ...slack, support: vec(0, W), supportAt: centre, end1Contact: null };
}

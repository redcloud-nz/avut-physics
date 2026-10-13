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
  /** Distance between the beams' centrelines when they just touch (half of each beam's thickness). */
  touchGap: number;
  /** The main beam leans back until this thickness brings its face against the wall's top edge. */
  beamThickness: number;
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
  /** Where the bar rests on the ground, the wall, its top or its top edge, and the force pushing back. */
  contacts: { surface: Surface; point: Vec; force: Vec }[];
  /** Force the beam cable exerts on the beam, at beamAttach. */
  cableOnBeam: Vec;
  /** Where the main beam leans on the wall's top edge, and the edge's push on it. */
  wallOnBeam: { point: Vec; force: Vec } | null;
  /** Force the hinge exerts on the beam (null when the beam lies on the ground, which shares the load). */
  hinge: Vec | null;
};

/**
 * When the bar would cross (or touch) the main beam, it rests on it instead: its beam end is pinned to
 * the main beam's top surface, where the beam cable (as the hypotenuse) puts it just touching. The bar
 * pivots on that pin and the main beam on its hinge; the wall cable holds the bar up, and the main beam may
 * end up lying on the ground.
 */
export type Hinged = {
  phi: number; // main beam angle above horizontal (0 when it lies on the ground)
  anchor: Vec;
  wrapEdge: Vec | null;
  beamAttach: Vec;
  barEnd1: Vec; // held by the wall cable
  barEnd2: Vec; // pinned to the main beam
  angle: number; // bar's angle above horizontal, end 1 towards the wall
  cableTaut: boolean;
  t1: Vec; // wall cable's pull on the bar (zero when slack)
  /** Force the main beam exerts on the bar: at the pin, or spread along it when the bar lies flat on it. */
  support: Vec;
  supportAt: Vec;
  lyingFlat: boolean;
  /** What the bar rests on besides the main beam: end 1 on the wall, the ground or the wall top, or the wall's top edge. */
  barContact: { surface: "wall" | "ground" | "edge" | "top"; point: Vec; force: Vec } | null;
  /** Where the main beam leans on the wall's top edge, and the edge's push on it. */
  wallOnBeam: { point: Vec; force: Vec } | null;
  /** Force the hinge exerts on the main beam (null when the beam lies on the ground, which shares the load). */
  hinge: Vec | null;
  /** The support split into the beam cable's pull (towards beamAttach) and the main beam's push, square to it. */
  t2: Vec;
  beamPush: Vec;
  /** False when the bar's end has slid along the main beam to where the beam cable hangs slack. */
  beamCableTaut: boolean;
};

export type Result =
  | { kind: "raised"; eq: Equilibrium }
  | { kind: "hinged"; h: Hinged; reason: string }
  | { kind: "none"; reason: string };

/** The full model's outcome: beam raised, beam down on the ground, or no taut arrangement (maybe slack). */
type TautResult =
  | { kind: "raised"; eq: Equilibrium }
  | { kind: "down" }
  | { kind: "none"; reason: string; slack: boolean; mayRest?: boolean };

const fail = (reason: string): TautResult => ({ kind: "none", reason, slack: false });

/** A failure where, in reality, a cable just goes slack and everything settles onto the ground. */
const slack = (reason: string): TautResult => ({ kind: "none", reason, slack: true });

type Branch = 1 | -1;

export type Surface = "ground" | "wall" | "top" | "edge";

/**
 * overEdge: the bar rests on the wall's top edge, its wall-cable end behind it.
 * onTop: it lies flat on the wall top as well, overhanging the edge.
 */
type Geometry = { phi: number; B: Vec; P1: Vec; P2: Vec; wrapEdge: Vec | null; overEdge?: boolean; onTop?: boolean };

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

/** The steepest the main beam can stand: leaning back with its face against the wall's top edge. */
const phiMax = (s: Setup) => Math.acos(Math.min(1, s.beamThickness / 2 / s.wallHeight));

/**
 * The wall's top edge pushing on the main beam leaning against it: square to the beam, enough to balance
 * the leftover torque (positive = trying to lean further back).
 */
function wallPush(phi: number, torque: number, s: Setup): { point: Vec; force: Vec } {
  const n = vec(Math.sin(phi), -Math.cos(phi));
  return { point: vec(0, s.wallHeight), force: scale(n, torque / (s.wallHeight * Math.sin(phi))) };
}

const ALPHA_MAX = rad(175);
const WALL_CABLE_SLACK = "The rope is too long: it goes slack, and the ladder and stretcher drop to the ground.";

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

/** Where the main beam meets the beam cable from P2, or null if it can't. */
function beamFrom(P2: Vec, branch: Branch, s: Setup): { phi: number; B: Vec } | null {
  // B is attachDistance from the hinge and beamCable from P2: another circle–circle intersection.
  const dist = Math.hypot(P2.x, P2.y);
  const r1 = s.attachDistance;
  const r2 = s.beamCable;
  if (dist < 1e-9 || dist > r1 + r2 || dist < Math.abs(r1 - r2)) return null;
  const along = (dist * dist + r1 * r1 - r2 * r2) / (2 * dist);
  const h = Math.sqrt(Math.max(0, r1 * r1 - along * along));
  const u = scale(P2, 1 / dist);
  const B = add(scale(u, along), scale(vec(-u.y, u.x), branch * h));
  const phi = Math.atan2(B.y, B.x);
  return phi >= 0 && phi <= phiMax(s) ? { phi, B } : null;
}

/**
 * The bar resting on the wall's top edge, with the wall cable (too short to get past the edge, or just
 * holding the bar back) ending behind it. The cable's direction alpha fixes end 1; the bar runs from
 * there over the edge, and the beam cable sets the main beam's angle.
 */
function edgeGeometry(alpha: number, branch: Branch, s: Setup): Geometry | null {
  const C = vec(-s.anchorBack, s.wallHeight + s.anchorUp);
  const edge = vec(0, s.wallHeight);
  const P1 = add(C, scale(vec(Math.sin(alpha), -Math.cos(alpha)), s.wallCable));
  // End 1 must be behind the edge and not inside the wall.
  if (P1.x > -1e-9 || P1.y < s.wallHeight) return null;
  const toEdge = sub(edge, P1);
  const dist = len(toEdge);
  if (dist > s.barLength) return null;
  const P2 = add(P1, scale(toEdge, s.barLength / dist));
  const beam = beamFrom(P2, branch, s);
  if (!beam) return null;
  return { phi: beam.phi, B: beam.B, P1, P2, wrapEdge: null, overEdge: true };
}

/**
 * The bar lying flat on the wall top, overhanging the edge: the wall cable holds end 1 back and the beam
 * cable pulls on the overhanging end. Before the main beam's pull can tip it, this is where it sits.
 */
function onTopGeometry(branch: Branch, s: Setup): Geometry | null {
  if (s.wallCable <= s.anchorUp) return null;
  const P1 = vec(-s.anchorBack + Math.sqrt(s.wallCable ** 2 - s.anchorUp ** 2), s.wallHeight);
  const P2 = add(P1, vec(s.barLength, 0));
  if (P1.x >= 0 || P2.x <= 0) return null;
  const beam = beamFrom(P2, branch, s);
  if (!beam) return null;
  return { phi: beam.phi, B: beam.B, P1, P2, wrapEdge: null, overEdge: true, onTop: true };
}

/**
 * The shortest wall cable: the one that pulls the hanging beam's far end exactly to the wall's edge
 * with the beam lying flat on the wall top.
 */
export function minWallCable(s: Setup): number {
  return Math.hypot(s.anchorUp, s.anchorBack - s.barLength);
}

/** Whether the segment pq passes through the wall's top corner (one end behind the face, below the edge line). */
function cutsCorner(p: Vec, q: Vec, s: Setup): boolean {
  const [a, b] = p.x < q.x ? [p, q] : [q, p];
  // An end resting on the wall face (x = 0) counts too.
  if (!(a.x < -1e-9 && b.x > -CONTACT)) return false;
  return a.y + ((b.y - a.y) * -a.x) / (b.x - a.x) < s.wallHeight - 1e-6;
}

/**
 * How far a point has pushed into the ground, the wall's face and the wall's top (all ≥ 0). Inside the wall
 * it's pushed back out through whichever of the face and the top is nearer.
 */
function penetration(p: Vec, s: Setup) {
  const inWall = p.x < 0 && p.y < s.wallHeight;
  const throughTop = inWall && s.wallHeight - p.y < -p.x;
  return {
    ground: Math.max(0, -p.y),
    wall: inWall && !throughTop ? -p.x : 0,
    top: throughTop ? s.wallHeight - p.y : 0,
  };
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
  if (phi < 0 || phi > phiMax(s) || Math.abs(alpha) > ALPHA_MAX) return Infinity;
  const g = geometry(phi, alpha, branch, s);
  // Arrangements with the bar through the wall's corner belong to edgeGeometry instead.
  if (!g || rotationMargin(g) < 0 || cutsCorner(g.P1, g.P2, s)) return Infinity;
  return energyOf(g, s);
}

/** Energy of the bar over the wall's edge, as a function of the wall cable's direction alone. */
function edgeEnergy(alpha: number, branch: Branch, s: Setup): number {
  if (Math.abs(alpha) > ALPHA_MAX) return Infinity;
  const g = edgeGeometry(alpha, branch, s);
  if (!g || rotationMargin(g) < 0) return Infinity;
  return energyOf(g, s);
}

function energyOf(g: Geometry, s: Setup): number {
  const phi = g.phi;
  const stiffness = 1e7 * (s.beamWeight + s.barWeight);
  const pen1 = penetration(g.P1, s);
  const pen2 = penetration(g.P2, s);
  const below =
    pen1.ground ** 2 + pen1.wall ** 2 + pen1.top ** 2 + pen2.ground ** 2 + pen2.wall ** 2 + pen2.top ** 2;
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
  if (s.barWeight <= 0) return fail("Give the stretcher some mass.");
  const toEdge = Math.hypot(s.anchorBack, s.anchorUp);
  const PHI_MAX = phiMax(s);

  // Coarse grid over both branches. Every grid point lower than its neighbours is a candidate start;
  // refine the lowest few on each branch, then keep the lowest-energy one that is a real equilibrium.
  const nPhi = 120;
  const nAlpha = 180;
  const candidates: { g: Geometry; e: number }[] = [];
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
      let [phi, alpha] = nelderMead(f, [(PHI_MAX * st.i) / nPhi, -ALPHA_MAX + (2 * ALPHA_MAX * st.j) / nAlpha], PHI_MAX / nPhi);
      // Pressed against the wall: settle the cable's direction with the beam exactly there.
      if (phi > PHI_MAX - 1e-3) [phi, alpha] = [PHI_MAX, nelderMead(([a]) => f([PHI_MAX, a]), [alpha], 1e-3)[0]];
      const g = geometry(phi, alpha, branch, s);
      if (g) candidates.push({ g, e: f([phi, alpha]) });
    }
  }

  // The bar over the wall's edge: one degree of freedom, so a fine scan and a golden-section refinement
  // around each local minimum.
  const nEdge = 1440;
  const edgeAlpha = (j: number) => -ALPHA_MAX + (2 * ALPHA_MAX * j) / nEdge;
  for (const branch of [1, -1] as const) {
    const f = (alpha: number) => edgeEnergy(alpha, branch, s);
    const grid = Array.from({ length: nEdge + 1 }, (_, j) => f(edgeAlpha(j)));
    for (let j = 0; j <= nEdge; j++) {
      const e = grid[j];
      if (!Number.isFinite(e) || (grid[j - 1] ?? Infinity) < e || (grid[j + 1] ?? Infinity) < e) continue;
      let lo = edgeAlpha(Math.max(0, j - 1));
      let hi = edgeAlpha(Math.min(nEdge, j + 1));
      const ratio = (Math.sqrt(5) - 1) / 2;
      for (let k = 0; k < 60; k++) {
        const m1 = hi - ratio * (hi - lo);
        const m2 = lo + ratio * (hi - lo);
        if (f(m1) <= f(m2)) hi = m2;
        else lo = m1;
      }
      const alpha = f((lo + hi) / 2) <= e ? (lo + hi) / 2 : edgeAlpha(j);
      const g = edgeGeometry(alpha, branch, s);
      if (g) candidates.push({ g, e: f(alpha) });
    }
  }
  for (const branch of [1, -1] as const) {
    const g = onTopGeometry(branch, s);
    if (g) candidates.push({ g, e: energyOf(g, s) });
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
    if (tautIfFlipped) return slack(WALL_CABLE_SLACK);
    if (s.wallCable <= toEdge) {
      return fail("The rope is too short for the stretcher to reach over the wall's edge.");
    }
    // Nothing taut fits (say the rope is too long to hold anything), but everything may still come to rest
    // on the ladder and the ground.
    const reason = "The rope and attachment can't reach between the wall, the stretcher and the ladder.";
    return { kind: "none", reason, slack: false, mayRest: true };
  }

  candidates.sort((a, b) => a.e - b.e);
  let firstFailure: TautResult | null = null;
  for (const c of candidates) {
    const result = checkEquilibrium(c.g, s);
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
  if (g.onTop) return checkOnTop(g, s);
  // Pressed up against the over-rotation limit: only a flipped bar could keep both cables taut.
  if (rotationMargin(g) < 1e-3) {
    return slack(WALL_CABLE_SLACK);
  }
  // The main beam is down. With the bar still hanging from both cables that's an answer too, with the
  // ground sharing the beam's load; otherwise the hinged model takes over.
  const result = checkHanging(g, s, g.phi < rad(0.05));
  return result.kind === "none" && g.phi < rad(0.05) ? { kind: "down" } : result;
}

function checkHanging(g: Geometry, s: Setup, down: boolean): TautResult {
  // Snap tiny penalty penetrations back onto the surfaces, and note which surfaces each end touches.
  const contacts: { surface: Surface; point: Vec; normal: Vec }[] = [];
  const settle = (p: Vec) => {
    const pen = penetration(p, s);
    const q = vec(p.x + pen.wall, p.y + pen.ground + pen.top);
    if (q.y < CONTACT) contacts.push({ surface: "ground", point: q, normal: vec(0, 1) });
    // Over the edge, the bar lying flat on the wall top too belongs to onTopGeometry instead.
    if (!g.overEdge && q.x < 0 && Math.abs(q.y - s.wallHeight) < CONTACT) {
      contacts.push({ surface: "top", point: q, normal: vec(0, 1) });
    } else if (q.x < CONTACT && q.y < s.wallHeight) {
      contacts.push({ surface: "wall", point: q, normal: vec(1, 0) });
    }
    return q;
  };
  const P1 = settle(g.P1);
  const P2 = settle(g.P2);
  // An end sunk into the wall's face by the penalty springs can slip the bar past the corner check: check again.
  if (cutsCorner(P1, P2, s)) return slack("The stretcher would pass through the wall's top corner.");
  if (g.overEdge) {
    // The edge pushes square to the bar (which runs outwards over it), so upwards.
    const d = unit(sub(P2, P1));
    contacts.push({ surface: "edge", point: vec(0, s.wallHeight), normal: vec(-d.y, d.x) });
  }
  if (contacts.length > 1) {
    return slack("The stretcher would rest on the ground or wall at both ends, with the rope and attachment slack.");
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
  if (!x) return fail("The rope and attachment pull in a straight line, so the tension would be unbounded.");
  const [T1, T2, push = 0] = x;
  if (!(T1 > 0) || !(T2 > 0)) {
    return slack("The rope or attachment would go slack, so the stretcher can't be held by both.");
  }
  if (push < -1e-6) {
    return fail("The stretcher would need to be pulled by the ground or wall.");
  }
  // Without a contact, the torque balance on the bar isn't one of the equations solved above. It holds
  // at a true minimum, but not where the bar and beam cable are pulled into a straight line (the
  // search's boundary) — there the beam cable would really go slack.
  const barTorque = cross(sub(P2, P1), scale(u2, T2)) - s.barWeight * (centre.x - P1.x);
  if (!contact && Math.abs(barTorque) > 1e-3 * s.barWeight * s.barLength) {
    return slack("The attachment would go slack and the stretcher would drop onto the ground, so nothing holds the ladder up.");
  }

  const t1 = scale(u1, T1);
  const t2 = scale(u2, T2);
  const cableOnBeam = scale(t2, -1);

  // The cables can only pull. If the beam's torques don't balance, the cable would be acting as a
  // strut; in reality it goes slack and everything settles onto the ground instead.
  const beamTorque = cross(g.B, cableOnBeam) - s.beamWeight * (s.beamLength / 2) * Math.cos(g.phi);
  const tolerance = 1e-3 * (s.beamWeight + s.barWeight) * s.beamLength;
  // Leaning on the wall, the wall's top edge takes any torque that would tip the beam further back.
  const onWall = g.phi >= phiMax(s) - 1e-9 && beamTorque > 0;
  // Lying on the ground, the ground takes any torque that would lower the beam further.
  const onGround = down && beamTorque < 0;
  if (Math.abs(beamTorque) > tolerance && !onWall && !onGround) {
    return slack("The attachment goes slack: the stretcher rests on the ground and can't hold the ladder up.");
  }
  const wallOnBeam = onWall ? wallPush(g.phi, beamTorque, s) : null;
  const wallForce = wallOnBeam?.force ?? vec(0, 0);
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
      contacts: contact
        ? [{ surface: contact.surface, point: contact.point, force: scale(contact.normal, Math.max(0, push)) }]
        : [],
      cableOnBeam,
      wallOnBeam,
      hinge: down ? null : vec(-cableOnBeam.x - wallForce.x, s.beamWeight - cableOnBeam.y - wallForce.y),
    },
  };
}

/**
 * Forces with the bar lying on the wall top: the main beam's torque balance gives the beam cable's
 * tension, the horizontal balance the wall cable's, and the bar's remaining balances the push of the
 * wall top under end 1 and of the edge. Both must push, or the bar tips (or slides back).
 */
function checkOnTop(g: Geometry, s: Setup): TautResult {
  if (g.phi < rad(0.05)) return { kind: "down" };
  const C = vec(-s.anchorBack, s.wallHeight + s.anchorUp);
  const edge = vec(0, s.wallHeight);
  const { P1, P2, B } = g;
  const u1 = unit(sub(C, P1));
  const u2 = unit(sub(B, P2));
  const W = s.barWeight;
  const T2 = (-s.beamWeight * (s.beamLength / 2) * Math.cos(g.phi)) / cross(B, u2);
  const T1 = (-T2 * u2.x) / u1.x;
  if (!(T2 > 0) || !(T1 > 0)) return slack("The rope or attachment would go slack, so the stretcher can't be held by both.");
  const centre = scale(add(P1, P2), 0.5);
  const atEdge = (W * (centre.x - P1.x) - cross(sub(P2, P1), scale(u2, T2))) / (edge.x - P1.x);
  const atEnd1 = W - T1 * u1.y - T2 * u2.y - atEdge;
  if (atEdge < 0 || atEnd1 < 0) return fail("The stretcher would tip over the wall's edge.");
  const t2 = scale(u2, T2);
  return {
    kind: "raised",
    eq: {
      phi: g.phi,
      anchor: C,
      wrapEdge: null,
      beamAttach: B,
      barEnd1: P1,
      barEnd2: P2,
      t1: scale(u1, T1),
      t2,
      contacts: [
        { surface: "top", point: P1, force: vec(0, atEnd1) },
        { surface: "edge", point: edge, force: vec(0, atEdge) },
      ],
      cableOnBeam: scale(t2, -1),
      wallOnBeam: null,
      hinge: vec(t2.x, s.beamWeight + t2.y),
    },
  };
}

const BEAM_DOWN = "The rope and attachment can't hold the ladder up, so it rests on the ground.";
const BEAMS_TOUCH = "The stretcher would cross the ladder, so it rests against it, hinged where they touch.";
const LIFTS_OFF = "The stretcher would lift off the ladder, into a position this model can't find.";

export function solve(s: Setup): Result {
  const result = solveTaut(s);
  if (result.kind === "raised" && !beamsOverlap(result.eq, s)) return result;
  if (result.kind === "none" && !result.slack && !result.mayRest) return { kind: "none", reason: result.reason };
  const h = solveHinged(s);
  if (h && "fail" in h) return { kind: "none", reason: h.fail };
  if (h) {
    // The main beam can only push on the bar, and the beam cable only pull.
    const tolerance = 1e-3 * (s.beamWeight + s.barWeight);
    const normal = vec(-Math.sin(h.phi), Math.cos(h.phi));
    if (h.beamPush.x * normal.x + h.beamPush.y * normal.y < -tolerance) return { kind: "none", reason: LIFTS_OFF };
    if (h.t2.x * (h.beamAttach.x - h.barEnd2.x) + h.t2.y * (h.beamAttach.y - h.barEnd2.y) < -tolerance) {
      return { kind: "none", reason: "The attachment would have to push the stretcher, so it can't rest on the ladder here." };
    }
    return { kind: "hinged", h, reason: h.phi > 0 ? BEAMS_TOUCH : BEAM_DOWN };
  }
  if (result.kind === "none" && !result.slack) return { kind: "none", reason: result.reason };
  return {
    kind: "none",
    reason:
      s.wallCable <= Math.hypot(s.anchorBack, s.anchorUp)
        ? "The rope is too short: the stretcher can't reach far enough over the wall's edge for the attachment to reach the ladder."
        : "The stretcher rests on the ladder, but the rope is too short to reach it there.",
  };
}

/** Distance from p to the segment ab. */
function segmentDistance(p: Vec, a: Vec, b: Vec) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y)));
  return len(sub(p, add(a, scale(ab, t))));
}

/** Whether the bar crosses the main beam or comes closer to it than their thicknesses allow. */
function beamsOverlap(eq: Equilibrium, s: Setup): boolean {
  const O = vec(0, 0);
  const tip = scale(vec(Math.cos(eq.phi), Math.sin(eq.phi)), s.beamLength);
  const [p, q] = [eq.barEnd1, eq.barEnd2];
  const side = (a: Vec, b: Vec, c: Vec) => cross(sub(b, a), sub(c, a));
  const crosses = side(O, tip, p) * side(O, tip, q) < 0 && side(p, q, O) * side(p, q, tip) < 0;
  const gap = Math.min(
    segmentDistance(p, O, tip),
    segmentDistance(q, O, tip),
    segmentDistance(O, p, q),
    segmentDistance(tip, p, q),
  );
  return crosses || gap < s.touchGap * (1 - 1e-6);
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

type Limit = "beam" | "wall" | "ground" | "edge" | "top";

/**
 * The bar pinned to the main beam's top surface, the beam cable's length from its attachment and just
 * touching. For each beam angle the bar drops as low as the wall cable lets it (or onto the main beam, the
 * ground or the wall); the beam then settles at the angle of least total potential energy.
 */
function restOnBeam(s: Setup, pinAlong: number): Hinged | null {
  const anchor = vec(-s.anchorBack, s.wallHeight + s.anchorUp);
  const ell = s.barLength;
  const PHI_MAX = phiMax(s);
  const pinAt = (phi: number) =>
    add(scale(vec(Math.cos(phi), Math.sin(phi)), pinAlong), scale(vec(-Math.sin(phi), Math.cos(phi)), s.touchGap));
  const end1At = (end2: Vec, angle: number) => add(end2, scale(vec(-Math.cos(angle), Math.sin(angle)), ell));
  // A hair of tolerance, for arrangements where the cable is exactly taut.
  const reaches = (p: Vec) => wallCablePath(p, s).length <= s.wallCable * (1 + 1e-9);

  /** The bar's lowest angle at beam angle phi, and whether the cable or a surface stops it there. */
  const barAt = (phi: number): { angle: number; taut: boolean; limit: Limit; lowest: number } | null => {
    const bar = lowestBar(phi);
    // This model has no contact with the wall's top edge, so the bar mustn't pass through the corner.
    return bar && !cutsCorner(end1At(pinAt(phi), bar.angle), pinAt(phi), s) ? bar : null;
  };
  const lowestBar = (phi: number): { angle: number; taut: boolean; limit: Limit; lowest: number } | null => {
    const end2 = pinAt(phi);
    const edgeDist = Math.hypot(end2.x, s.wallHeight - end2.y);
    // Below the wall top, the pin must be in front of the wall (with the main beam leaning on the wall it
    // can be just behind the face).
    if (end2.y < s.wallHeight && end2.x < 0) return null;
    // Lying on the main beam, end 1 on the ground, or end 1 against the wall — whichever is highest.
    const limits: [number, Limit][] = [[-phi, "beam"], [-Math.asin(Math.min(1, end2.y / ell)), "ground"]];
    if (end2.y >= s.wallHeight) {
      // From above the wall top, end 1 lies on it if it reaches back past the face (the bar stays above the
      // wall from there); otherwise it hangs clear in front.
      const top = Math.asin(Math.max(-1, (s.wallHeight - end2.y) / ell));
      if (end2.x - ell * Math.cos(top) < 0) limits.push([top, "top"]);
    } else if (edgeDist < ell) {
      // The bar reaches past the wall's top edge, which stops it before end 1 reaches the face.
      limits.push([Math.atan2(s.wallHeight - end2.y, end2.x), "edge"]);
    } else if (end2.x < ell) {
      limits.push([Math.acos(Math.max(-1, end2.x / ell)), "wall"]);
    }
    const [lowest, limit] = limits.reduce((m, l) => (l[0] > m[0] ? l : m));
    // Past upright, the bar would be flipped over (the over-rotation rule).
    if (lowest > Math.PI / 2) return null;
    if (reaches(end1At(end2, lowest))) return { angle: lowest, taut: false, limit, lowest };
    // Otherwise find where the cable's path is shortest (the bar pointing as near the anchor as it can),
    // then bisect back down to the lowest angle the cable reaches. The reachable range can be a sliver.
    const pathAt = (angle: number) => wallCablePath(end1At(end2, angle), s).length;
    let lo = lowest;
    let hi = Math.PI / 2;
    const ratio = (Math.sqrt(5) - 1) / 2;
    for (let j = 0; j < 80; j++) {
      const m1 = hi - ratio * (hi - lo);
      const m2 = lo + ratio * (hi - lo);
      if (pathAt(m1) <= pathAt(m2)) hi = m2;
      else lo = m1;
    }
    let b = (lo + hi) / 2;
    if (!reaches(end1At(end2, b))) return null;
    let a = lowest;
    for (let j = 0; j < 60; j++) {
      const m = (a + b) / 2;
      if (reaches(end1At(end2, m))) b = m;
      else a = m;
    }
    return { angle: b, taut: true, limit, lowest };
  };

  const energyAt = (phi: number) => {
    const bar = barAt(phi);
    if (!bar) return Infinity;
    const centreY = pinAt(phi).y + (ell / 2) * Math.sin(bar.angle);
    return s.beamWeight * (s.beamLength / 2) * Math.sin(phi) + s.barWeight * centreY;
  };

  // Coarse scan of the beam angle, then a golden-section refinement around the lowest point.
  const n = 360;
  let best = -1;
  let bestE = Infinity;
  for (let i = 0; i <= n; i++) {
    const e = energyAt((PHI_MAX * i) / n);
    if (e < bestE) [best, bestE] = [i, e];
  }
  if (best < 0) return null;
  let lo = (PHI_MAX * Math.max(0, best - 1)) / n;
  let hi = (PHI_MAX * Math.min(n, best + 1)) / n;
  const ratio = (Math.sqrt(5) - 1) / 2;
  for (let j = 0; j < 60; j++) {
    const m1 = hi - ratio * (hi - lo);
    const m2 = lo + ratio * (hi - lo);
    if (energyAt(m1) <= energyAt(m2)) hi = m2;
    else lo = m1;
  }
  let phi = (lo + hi) / 2;
  if (!(energyAt(phi) <= bestE)) phi = (PHI_MAX * best) / n;
  if (phi < rad(0.05) && energyAt(0) <= energyAt(phi) + 1e-9 * s.barWeight) phi = 0;
  if (PHI_MAX - phi < 1e-6 && energyAt(PHI_MAX) <= energyAt(phi) + 1e-9 * s.barWeight) phi = PHI_MAX;

  /** Positions and the forces on the bar, at beam angle phi. */
  type Arrangement = Omit<Hinged, "hinge" | "wallOnBeam" | "t2" | "beamPush" | "beamCableTaut">;
  const arrangement = (phi: number, resting = false): Arrangement | null => {
    const bar = barAt(phi);
    if (!bar) return null;
    const end2 = pinAt(phi);
    const end1 = end1At(end2, bar.angle);
    const centre = scale(add(end1, end2), 0.5);
    const path = wallCablePath(end1, s);
    const W = s.barWeight;
    const base = {
      phi,
      anchor,
      wrapEdge: path.wrapEdge,
      beamAttach: scale(vec(Math.cos(phi), Math.sin(phi)), s.attachDistance),
      barEnd1: end1,
      barEnd2: end2,
      angle: bar.angle,
      cableTaut: bar.taut,
      t1: vec(0, 0),
      lyingFlat: false,
      barContact: null,
    };

    // Forces on the bar: torques about the pin give the cable's pull or end 1's contact force; the pin
    // takes the rest. Lying flat on the main beam, the beam carries its whole weight.
    let h: Arrangement;
    const u1 = unit(sub(path.wrapEdge ?? anchor, end1));
    const T1 = (W * (centre.x - end2.x)) / cross(sub(end1, end2), u1);
    // Held by the cable just above a limit, but the cable would have to push: the bar rests on that limit
    // too, with the cable at full length (the tension and contact are split at the end).
    const onLimit = bar.taut && (T1 < 0 || resting) && bar.angle - bar.lowest < 1e-3;
    if (bar.taut && !onLimit) {
      const t1 = scale(u1, T1);
      h = { ...base, t1, support: vec(-t1.x, W - t1.y), supportAt: end2 };
    } else if (bar.limit === "wall") {
      const push = (W * (end2.x - centre.x)) / (end1.y - end2.y);
      h = { ...base, support: vec(-push, W), supportAt: end2, barContact: { surface: "wall", point: end1, force: vec(push, 0) } };
    } else if (bar.limit === "edge") {
      // Resting on the wall's top edge, which pushes square to the bar.
      const edge = vec(0, s.wallHeight);
      const n = vec(Math.sin(bar.angle), Math.cos(bar.angle));
      const push = (W * (centre.x - end2.x)) / cross(sub(edge, end2), n);
      const f = scale(n, push);
      h = { ...base, support: vec(-f.x, W - f.y), supportAt: end2, barContact: { surface: "edge", point: edge, force: f } };
    } else if (bar.limit === "ground" || bar.limit === "top") {
      const up = (W * (centre.x - end2.x)) / (end1.x - end2.x);
      h = { ...base, support: vec(0, W - up), supportAt: end2, barContact: { surface: bar.limit, point: end1, force: vec(0, up) } };
    } else {
      h = { ...base, support: vec(0, W), supportAt: centre, lyingFlat: true };
    }
    return h;
  };

  // Net torque lifting the main beam about its hinge. Where the cable can't reach, the beam can't be
  // that low, which acts like an unbounded lift.
  const lift = (phi: number) => {
    const h = arrangement(phi);
    if (!h) return Infinity;
    return cross(h.supportAt, scale(h.support, -1)) - s.beamWeight * (s.beamLength / 2) * Math.cos(phi);
  };

  // The energy minimum can sit where it changes steeply (the beam hanging from an almost straight
  // cable and bar), so pin the angle down where the lift changes from positive to negative.
  if (phi > 0) {
    const step = PHI_MAX / n;
    let a = Math.max(0, phi - 3 * step);
    let b = Math.min(PHI_MAX, phi + 3 * step);
    if (lift(a) > 0 && lift(b) < 0) {
      for (let j = 0; j < 60; j++) {
        const m = (a + b) / 2;
        if (lift(m) > 0) a = m;
        else b = m;
      }
      phi = arrangement(b) ? b : a;
    }
  }

  let h = arrangement(phi)!;
  // Stopped where the cable comes taut just as the bar comes down onto a surface: move to exactly where
  // that happens and treat the bar as resting there, so the split below can balance the main beam.
  const nearLimit = (p: number) => {
    const bar = barAt(p);
    return bar !== null && bar.taut && bar.angle - bar.lowest < 1e-3;
  };
  if (phi > 0 && !h.barContact && nearLimit(phi) && Math.abs(lift(phi)) > 1e-6 * (s.beamWeight + s.barWeight)) {
    let a = phi;
    let b = Math.min(PHI_MAX, phi + 3 * (PHI_MAX / n));
    if (barAt(b) && !barAt(b)!.taut) {
      for (let j = 0; j < 60; j++) {
        const m = (a + b) / 2;
        if (barAt(m)?.taut) a = m;
        else b = m;
      }
      const resting = arrangement(b, true);
      if (resting) [phi, h] = [b, resting];
    }
  }
  // Stopped where the cable is pulled to its full length just as the bar rests on a surface: the cable's
  // tension and the surface's push share the load, and only the main beam's torque balance splits them.
  const end1 = h.barEnd1;
  const atFullLength = wallCablePath(end1, s).length >= s.wallCable * (1 - 1e-6);
  if (phi > 0 && h.barContact && atFullLength && Math.abs(lift(phi)) > 1e-6 * (s.beamWeight + s.barWeight)) {
    const W = s.barWeight;
    const end2 = h.barEnd2;
    const centre = scale(add(end1, end2), 0.5);
    const u1 = unit(sub(h.wrapEdge ?? anchor, end1));
    const n = unit(h.barContact.force);
    const at = h.barContact.point;
    const x = solveLinear(
      [
        [cross(sub(end1, end2), u1), cross(sub(at, end2), n)],
        [cross(end2, u1), cross(end2, n)],
      ],
      [W * (centre.x - end2.x), s.beamWeight * (s.beamLength / 2) * Math.cos(phi) + W * end2.x],
    );
    if (x && x[0] >= 0 && x[1] >= 0) {
      const [T1, N] = x;
      const t1 = scale(u1, T1);
      const f = scale(n, N);
      h = {
        ...h,
        cableTaut: true,
        t1,
        support: vec(-t1.x - f.x, W - t1.y - f.y),
        barContact: { ...h.barContact, force: f },
      };
    }
  }
  // The main beam: the bar pushes back on it, the wall's top edge when it leans there, and the hinge (or,
  // lying down, the ground too) holds it.
  const onBeam = scale(h.support, -1);
  const leftover = cross(h.supportAt, onBeam) - s.beamWeight * (s.beamLength / 2) * Math.cos(phi);
  const wallOnBeam = phi >= PHI_MAX && leftover > 0 ? wallPush(phi, leftover, s) : null;
  const wallForce = wallOnBeam?.force ?? vec(0, 0);
  // The main beam's surface can only push square to itself, so the beam cable takes the rest of the support.
  const u2 = unit(sub(h.beamAttach, h.barEnd2));
  const normal = vec(-Math.sin(phi), Math.cos(phi));
  const T2 = cross(h.support, normal) / cross(u2, normal);
  return {
    ...h,
    wallOnBeam,
    hinge: phi > 0 ? vec(-onBeam.x - wallForce.x, s.beamWeight - onBeam.y - wallForce.y) : null,
    t2: scale(u2, T2),
    beamPush: scale(normal, cross(u2, h.support) / cross(u2, normal)),
    beamCableTaut: true,
  };
}

/** The main beam's push on the bar's end along the beam (positive: up it, away from the hinge). */
const alongBeam = (h: Hinged) => cross(h.support, vec(-Math.sin(h.phi), Math.cos(h.phi)));

/**
 * The bar resting on the main beam. Nothing but the beam cable holds its end in place along the beam, so it
 * starts nearest the hinge with the cable taut. If the cable would have to push there, the end slides up the
 * beam: it stops where the beam's push alone balances it (the cable slack), or where the cable comes taut
 * again past its attachment. Off the beam's end, nothing holds it.
 */
function solveHinged(s: Setup): Hinged | { fail: string } | null {
  const reach = Math.sqrt(Math.max(0, s.beamCable ** 2 - s.touchGap ** 2));
  const lo = s.attachDistance - reach;
  const hi = Math.min(s.beamLength, s.attachDistance + reach);
  const tolerance = 1e-3 * (s.beamWeight + s.barWeight);
  const first = restOnBeam(s, lo);
  if (!first || alongBeam(first) >= -tolerance) return first;
  const n = 12;
  let below = lo;
  for (let i = 1; i <= n; i++) {
    const at = lo + ((hi - lo) * i) / n;
    const h = restOnBeam(s, at);
    if (!h) continue;
    if (alongBeam(h) < 0) {
      below = at;
      continue;
    }
    // Pressing back down the beam here: the end settles in between, where the beam cable hangs slack.
    let [a, b] = [below, at];
    for (let j = 0; j < 30; j++) {
      const m = (a + b) / 2;
      const hm = restOnBeam(s, m);
      if (hm && alongBeam(hm) < 0) a = m;
      else b = m;
    }
    const settled = restOnBeam(s, b) ?? h;
    const normal = vec(-Math.sin(settled.phi), Math.cos(settled.phi));
    const push = settled.support.x * normal.x + settled.support.y * normal.y;
    return { ...settled, t2: vec(0, 0), beamPush: scale(normal, push), beamCableTaut: false };
  }
  // Still sliding at the far end of its range: the beam cable catches it past the attachment, unless the
  // beam ends first.
  if (hi < s.attachDistance + reach) return { fail: "The stretcher's foot would slide off the end of the ladder." };
  return restOnBeam(s, hi);
}

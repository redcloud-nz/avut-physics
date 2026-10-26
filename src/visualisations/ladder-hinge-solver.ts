import { rad } from "@/lib/math";
import { solveLinear } from "@/lib/numeric/linear";
import { goldenSection, gridMinima, nelderMead } from "@/lib/numeric/minimise";
import { bisect } from "@/lib/numeric/roots";
import { Segment } from "@/lib/segment";
import { vec2, Vector2 } from "@/lib/vector2";
import { anchorOf } from "@/lib/wall";

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
    anchor: Vector2;
    wrapEdge: Vector2 | null;
    beamAttach: Vector2;
    barEnd1: Vector2; // attached to the wall cable
    barEnd2: Vector2; // attached to the beam cable
    /** Forces the cables exert on the bar (at barEnd1 and barEnd2). */
    t1: Vector2;
    t2: Vector2;
    /** Where the bar rests on the ground, the wall, its top or its top edge, and the force pushing back. */
    contacts: { surface: Surface; point: Vector2; force: Vector2 }[];
    /** Force the beam cable exerts on the beam, at beamAttach. */
    cableOnBeam: Vector2;
    /** Where the main beam leans on the wall's top edge, and the edge's push on it. */
    wallOnBeam: { point: Vector2; force: Vector2 } | null;
    /** Force the hinge exerts on the beam (null when the beam lies on the ground, which shares the load). */
    hinge: Vector2 | null;
};

/**
 * When the bar would cross (or touch) the main beam, it rests on it instead: its beam end is pinned to
 * the main beam's top surface, where the beam cable (as the hypotenuse) puts it just touching. The bar
 * pivots on that pin and the main beam on its hinge; the wall cable holds the bar up, and the main beam may
 * end up lying on the ground.
 */
export type Hinged = {
    phi: number; // main beam angle above horizontal (0 when it lies on the ground)
    anchor: Vector2;
    wrapEdge: Vector2 | null;
    beamAttach: Vector2;
    barEnd1: Vector2; // held by the wall cable
    barEnd2: Vector2; // pinned to the main beam
    angle: number; // bar's angle above horizontal, end 1 towards the wall
    cableTaut: boolean;
    t1: Vector2; // wall cable's pull on the bar (zero when slack)
    /** Force the main beam exerts on the bar: at the pin, or spread along it when the bar lies flat on it. */
    support: Vector2;
    supportAt: Vector2;
    lyingFlat: boolean;
    /** What the bar rests on besides the main beam: end 1 on the wall, the ground or the wall top, or the wall's top edge. */
    barContact: {
        surface: "wall" | "ground" | "edge" | "top";
        point: Vector2;
        force: Vector2;
    } | null;
    /** Where the main beam leans on the wall's top edge, and the edge's push on it. */
    wallOnBeam: { point: Vector2; force: Vector2 } | null;
    /** Force the hinge exerts on the main beam (null when the beam lies on the ground, which shares the load). */
    hinge: Vector2 | null;
    /** The support split into the beam cable's pull (towards beamAttach) and the main beam's push, square to it. */
    t2: Vector2;
    beamPush: Vector2;
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
type Geometry = {
    phi: number;
    B: Vector2;
    P1: Vector2;
    P2: Vector2;
    wrapEdge: Vector2 | null;
    overEdge?: boolean;
    onTop?: boolean;
};

/**
 * Where the wall cable ends, given the direction alpha of its last straight run (measured from straight
 * down, positive away from the wall). Directions that would cut through the wall's top edge instead
 * wrap over that edge, which then acts like a frictionless pulley.
 */
function wallCableEnd(alpha: number, s: Setup): { P1: Vector2; wrapEdge: Vector2 | null } | null {
    const C = anchorOf(s);
    const edge = vec2(0, s.wallHeight);
    const dir = vec2(Math.sin(alpha), -Math.cos(alpha));
    const toEdge = Math.hypot(s.anchorBack, s.anchorUp);
    const edgeAlpha = Math.atan2(s.anchorBack, s.anchorUp);
    // A straight run steeper than the line to the edge drops to the wall's top level behind the edge.
    const reachesWallTop = s.wallCable * Math.cos(alpha) > s.anchorUp;
    if (toEdge > 1e-9 && alpha < edgeAlpha && reachesWallTop) {
        // Too short to get past the edge: the cable would end inside the wall.
        if (s.wallCable <= toEdge) return null;
        return { P1: edge.add(dir.scale(s.wallCable - toEdge)), wrapEdge: edge };
    }
    return { P1: C.add(dir.scale(s.wallCable)), wrapEdge: null };
}

/** The steepest the main beam can stand: leaning back with its face against the wall's top edge. */
export const phiMax = (s: Setup) => Math.acos(Math.min(1, s.beamThickness / 2 / s.wallHeight));

/**
 * The wall's top edge pushing on the main beam leaning against it: square to the beam, enough to balance
 * the leftover torque (positive = trying to lean further back).
 */
export function wallPush(
    phi: number,
    torque: number,
    s: Setup,
): { point: Vector2; force: Vector2 } {
    const n = vec2(Math.sin(phi), -Math.cos(phi));
    return {
        point: vec2(0, s.wallHeight),
        force: n.scale(torque / (s.wallHeight * Math.sin(phi))),
    };
}

const ALPHA_MAX = rad(175);
const THROUGH_CORNER = "The stretcher would pass through the wall's top corner.";

const WALL_CABLE_SLACK =
    "The rope is too long: it goes slack, and the ladder and stretcher drop to the ground.";

/** Points within this distance of the ground or wall count as touching it. */
const CONTACT = 1e-4;

/** Positions for a trial configuration, or null if the cables can't both be taut there. */
function geometry(phi: number, alpha: number, branch: Branch, s: Setup): Geometry | null {
    const B = Vector2.fromAngle(phi, s.attachDistance);
    const end = wallCableEnd(alpha, s);
    if (!end) return null;
    const { P1, wrapEdge } = end;

    // Bar end 2 is barLength from P1 and beamCable from B: a circle–circle intersection.
    const d = B.sub(P1);
    const dist = d.len();
    const r1 = s.barLength;
    const r2 = s.beamCable;
    if (dist < 1e-9 || dist > r1 + r2 || dist < Math.abs(r1 - r2)) return null;
    const along = (dist * dist + r1 * r1 - r2 * r2) / (2 * dist);
    const h = Math.sqrt(Math.max(0, r1 * r1 - along * along));
    const ud = d.scale(1 / dist);
    const P2 = P1.add(ud.scale(along)).add(ud.perp().scale(branch * h));
    return { phi, B, P1, P2, wrapEdge };
}

/** Where the main beam meets the beam cable from P2, or null if it can't. */
function beamFrom(P2: Vector2, branch: Branch, s: Setup): { phi: number; B: Vector2 } | null {
    // B is attachDistance from the hinge and beamCable from P2: another circle–circle intersection.
    const dist = P2.len();
    const r1 = s.attachDistance;
    const r2 = s.beamCable;
    if (dist < 1e-9 || dist > r1 + r2 || dist < Math.abs(r1 - r2)) return null;
    const along = (dist * dist + r1 * r1 - r2 * r2) / (2 * dist);
    const h = Math.sqrt(Math.max(0, r1 * r1 - along * along));
    const u = P2.scale(1 / dist);
    const B = u.scale(along).add(u.perp().scale(branch * h));
    const phi = B.angle();
    return phi >= 0 && phi <= phiMax(s) ? { phi, B } : null;
}

/**
 * The bar resting on the wall's top edge, with the wall cable (too short to get past the edge, or just
 * holding the bar back) ending behind it. The cable's direction alpha fixes end 1; the bar runs from
 * there over the edge, and the beam cable sets the main beam's angle.
 */
function edgeGeometry(alpha: number, branch: Branch, s: Setup): Geometry | null {
    const C = anchorOf(s);
    const edge = vec2(0, s.wallHeight);
    const P1 = C.add(vec2(Math.sin(alpha), -Math.cos(alpha)).scale(s.wallCable));
    // End 1 must be behind the edge and not inside the wall.
    if (P1.x > -1e-9 || P1.y < s.wallHeight) return null;
    const toEdge = edge.sub(P1);
    const dist = toEdge.len();
    if (dist > s.barLength) return null;
    const P2 = P1.add(toEdge.scale(s.barLength / dist));
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
    const P1 = vec2(-s.anchorBack + Math.sqrt(s.wallCable ** 2 - s.anchorUp ** 2), s.wallHeight);
    const P2 = P1.add(vec2(s.barLength, 0));
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
function cutsCorner(p: Vector2, q: Vector2, s: Setup): boolean {
    const [a, b] = p.x < q.x ? [p, q] : [q, p];
    // An end resting on the wall face (x = 0) counts too.
    if (!(a.x < -1e-9 && b.x > -CONTACT)) return false;
    return a.y + ((b.y - a.y) * -a.x) / (b.x - a.x) < s.wallHeight - 1e-6;
}

/**
 * How far a point has pushed into the ground, the wall's face and the wall's top (all ≥ 0). Inside the wall
 * it's pushed back out through whichever of the face and the top is nearer.
 */
function penetration(p: Vector2, s: Setup) {
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
        pen1.ground ** 2 +
        pen1.wall ** 2 +
        pen1.top ** 2 +
        pen2.ground ** 2 +
        pen2.wall ** 2 +
        pen2.top ** 2;
    return (
        s.beamWeight * (s.beamLength / 2) * Math.sin(phi) +
        (s.barWeight * (g.P1.y + g.P2.y)) / 2 +
        (stiffness * below) / 2
    );
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
                grid[i].push(
                    energy(
                        (PHI_MAX * i) / nPhi,
                        -ALPHA_MAX + (2 * ALPHA_MAX * j) / nAlpha,
                        branch,
                        s,
                    ),
                );
            }
        }
        // Lowest first; the grid doesn't wrap round, as the angles' ranges have ends.
        const starts = gridMinima(grid, false);
        const f = ([phi, alpha]: number[]) => energy(phi, alpha, branch, s);
        for (const st of starts.slice(0, 4)) {
            let [phi, alpha] = nelderMead(
                f,
                [(PHI_MAX * st.i) / nPhi, -ALPHA_MAX + (2 * ALPHA_MAX * st.j) / nAlpha],
                PHI_MAX / nPhi,
            );
            // Pressed against the wall: settle the cable's direction with the beam exactly there.
            if (phi > PHI_MAX - 1e-3)
                [phi, alpha] = [PHI_MAX, nelderMead(([a]) => f([PHI_MAX, a]), [alpha], 1e-3)[0]];
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
            if (
                !Number.isFinite(e) ||
                (grid[j - 1] ?? Infinity) < e ||
                (grid[j + 1] ?? Infinity) < e
            )
                continue;
            const [lo, hi] = goldenSection(
                f,
                edgeAlpha(Math.max(0, j - 1)),
                edgeAlpha(Math.min(nEdge, j + 1)),
                60,
            );
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
        // Nothing allowed. If the cables could be taut by over-rotating, the wall cable is simply too long; if only
        // with the stretcher through the wall's top corner, that's what stops them.
        const tautWhere = (allowed: (g: Geometry) => boolean) =>
            [1, -1].some((branch) =>
                Array.from({ length: nPhi + 1 }, (_, i) => i).some((i) =>
                    Array.from({ length: nAlpha + 1 }, (_, j) => j).some((j) => {
                        const g = geometry(
                            (PHI_MAX * i) / nPhi,
                            -ALPHA_MAX + (2 * ALPHA_MAX * j) / nAlpha,
                            branch as Branch,
                            s,
                        );
                        return g !== null && allowed(g);
                    }),
                ),
            );
        if (tautWhere((g) => rotationMargin(g) < 0)) return slack(WALL_CABLE_SLACK);
        if (tautWhere((g) => cutsCorner(g.P1, g.P2, s))) return slack(THROUGH_CORNER);
        if (s.wallCable <= toEdge) {
            return fail("The rope is too short for the stretcher to reach over the wall's edge.");
        }
        // Nothing taut fits (say the rope is too long to hold anything), but everything may still come to rest
        // on the ladder and the ground.
        const reason =
            "The rope and attachment can't reach between the wall, the stretcher and the ladder.";
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
    const contacts: { surface: Surface; point: Vector2; normal: Vector2 }[] = [];
    const settle = (p: Vector2) => {
        const pen = penetration(p, s);
        const q = vec2(p.x + pen.wall, p.y + pen.ground + pen.top);
        if (q.y < CONTACT) contacts.push({ surface: "ground", point: q, normal: vec2(0, 1) });
        // Over the edge, the bar lying flat on the wall top too belongs to onTopGeometry instead.
        if (!g.overEdge && q.x < 0 && Math.abs(q.y - s.wallHeight) < CONTACT) {
            contacts.push({ surface: "top", point: q, normal: vec2(0, 1) });
        } else if (q.x < CONTACT && q.y < s.wallHeight) {
            contacts.push({ surface: "wall", point: q, normal: vec2(1, 0) });
        }
        return q;
    };
    const P1 = settle(g.P1);
    const P2 = settle(g.P2);
    const bar = new Segment(P1, P2);
    // An end sunk into the wall's face by the penalty springs can slip the bar past the corner check: check again.
    if (cutsCorner(P1, P2, s)) return slack(THROUGH_CORNER);
    if (g.overEdge) {
        // The edge pushes square to the bar (which runs outwards over it), so upwards.
        const d = bar.direction();
        contacts.push({ surface: "edge", point: vec2(0, s.wallHeight), normal: d.perp() });
    }
    if (contacts.length > 1) {
        return slack(
            "The stretcher would rest on the ground or wall at both ends, with the rope and attachment slack.",
        );
    }

    // Bar equilibrium. Unknowns: T1, T2 and the contact force (if any).
    // Equations: ΣFx = 0, ΣFy = W and, with a contact, Σ torque about end 1 = 0.
    const C = anchorOf(s);
    const u1 = (g.wrapEdge ?? C).sub(P1).unit(); // the wall cable pulls towards the anchor, or the edge it wraps over
    const u2 = g.B.sub(P2).unit();
    const centre = bar.mid();
    const contact = contacts[0];
    const x = contact
        ? solveLinear(
              [
                  [u1.x, u2.x, contact.normal.x],
                  [u1.y, u2.y, contact.normal.y],
                  [0, bar.vector().cross(u2), contact.point.sub(P1).cross(contact.normal)],
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
    // Nearly in line, the solve still gives an answer, but with huge tensions: as the held solver does, treat a
    // hundred times the stretcher's weight as unbounded.
    if (!x || Math.max(Math.abs(x[0]), Math.abs(x[1])) > 100 * s.barWeight)
        return fail(
            "The rope and attachment pull in a straight line, so the tension would be unbounded.",
        );
    const [T1, T2, push = 0] = x;
    if (!(T1 > 0) || !(T2 > 0)) {
        return slack(
            "The rope or attachment would go slack, so the stretcher can't be held by both.",
        );
    }
    if (push < -1e-6) {
        return fail("The stretcher would need to be pulled by the ground or wall.");
    }
    // Without a contact, the torque balance on the bar isn't one of the equations solved above. It holds
    // at a true minimum, but not where the bar and beam cable are pulled into a straight line (the
    // search's boundary) — there the beam cable would really go slack.
    const barTorque = bar.vector().cross(u2.scale(T2)) - s.barWeight * (centre.x - P1.x);
    if (!contact && Math.abs(barTorque) > 1e-3 * s.barWeight * s.barLength) {
        return slack(
            "The attachment would go slack and the stretcher would drop onto the ground, so nothing holds the ladder up.",
        );
    }

    const t1 = u1.scale(T1);
    const t2 = u2.scale(T2);
    const cableOnBeam = t2.neg();

    // The cables can only pull. If the beam's torques don't balance, the cable would be acting as a
    // strut; in reality it goes slack and everything settles onto the ground instead.
    const beamTorque = g.B.cross(cableOnBeam) - s.beamWeight * (s.beamLength / 2) * Math.cos(g.phi);
    const tolerance = 1e-3 * (s.beamWeight + s.barWeight) * s.beamLength;
    // Leaning on the wall, the wall's top edge takes any torque that would tip the beam further back.
    const onWall = g.phi >= phiMax(s) - 1e-9 && beamTorque > 0;
    // Lying on the ground, the ground takes any torque that would lower the beam further.
    const onGround = down && beamTorque < 0;
    if (Math.abs(beamTorque) > tolerance && !onWall && !onGround) {
        return slack(
            "The attachment goes slack: the stretcher rests on the ground and can't hold the ladder up.",
        );
    }
    const wallOnBeam = onWall ? wallPush(g.phi, beamTorque, s) : null;
    const wallForce = wallOnBeam?.force ?? Vector2.ZERO;
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
                ? [
                      {
                          surface: contact.surface,
                          point: contact.point,
                          force: contact.normal.scale(Math.max(0, push)),
                      },
                  ]
                : [],
            cableOnBeam,
            wallOnBeam,
            hinge: down
                ? null
                : vec2(-cableOnBeam.x - wallForce.x, s.beamWeight - cableOnBeam.y - wallForce.y),
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
    const C = anchorOf(s);
    const edge = vec2(0, s.wallHeight);
    const { P1, P2, B } = g;
    const bar = new Segment(P1, P2);
    const u1 = C.sub(P1).unit();
    const u2 = B.sub(P2).unit();
    const W = s.barWeight;
    const T2 = (-s.beamWeight * (s.beamLength / 2) * Math.cos(g.phi)) / B.cross(u2);
    const T1 = (-T2 * u2.x) / u1.x;
    if (!(T2 > 0) || !(T1 > 0))
        return slack(
            "The rope or attachment would go slack, so the stretcher can't be held by both.",
        );
    const centre = bar.mid();
    const atEdge = (W * (centre.x - P1.x) - bar.vector().cross(u2.scale(T2))) / (edge.x - P1.x);
    const atEnd1 = W - T1 * u1.y - T2 * u2.y - atEdge;
    if (atEdge < 0 || atEnd1 < 0) return fail("The stretcher would tip over the wall's edge.");
    const t2 = u2.scale(T2);
    return {
        kind: "raised",
        eq: {
            phi: g.phi,
            anchor: C,
            wrapEdge: null,
            beamAttach: B,
            barEnd1: P1,
            barEnd2: P2,
            t1: u1.scale(T1),
            t2,
            contacts: [
                { surface: "top", point: P1, force: vec2(0, atEnd1) },
                { surface: "edge", point: edge, force: vec2(0, atEdge) },
            ],
            cableOnBeam: t2.neg(),
            wallOnBeam: null,
            hinge: vec2(t2.x, s.beamWeight + t2.y),
        },
    };
}

const BEAM_DOWN = "The rope and attachment can't hold the ladder up, so it rests on the ground.";
const BEAMS_TOUCH =
    "The stretcher would cross the ladder, so it rests against it, hinged where they touch.";
const LIFTS_OFF = "The stretcher would lift off the ladder, into a position this model can't find.";

export function solve(s: Setup): Result {
    const result = solveTaut(s);
    if (result.kind === "raised" && !beamsOverlap(result.eq, s)) return result;
    if (result.kind === "none" && !result.slack && !result.mayRest)
        return { kind: "none", reason: result.reason };
    const h = solveHinged(s);
    if ("fail" in h) return { kind: "none", reason: h.fail };
    if (!("noRest" in h)) {
        // The main beam can only push on the bar, and the beam cable only pull.
        const tolerance = 1e-3 * (s.beamWeight + s.barWeight);
        const normal = Vector2.fromAngle(h.phi).perp();
        if (h.beamPush.dot(normal) < -tolerance) return { kind: "none", reason: LIFTS_OFF };
        if (h.t2.dot(h.beamAttach.sub(h.barEnd2)) < -tolerance) {
            return {
                kind: "none",
                reason: "The attachment would have to push the stretcher, so it can't rest on the ladder here.",
            };
        }
        return { kind: "hinged", h, reason: h.phi > 0 ? BEAMS_TOUCH : BEAM_DOWN };
    }
    // Neither hanging nor resting on the ladder works. Why hanging failed (a rope going slack, say) isn't why
    // there's no answer, so say why it can't rest.
    return { kind: "none", reason: h.noRest };
}

/** Whether the bar crosses the main beam or comes closer to it than their thicknesses allow. */
function beamsOverlap(eq: Equilibrium, s: Setup): boolean {
    const beam = new Segment(Vector2.ZERO, Vector2.fromAngle(eq.phi, s.beamLength));
    const bar = new Segment(eq.barEnd1, eq.barEnd2);
    return beam.crosses(bar) || beam.gap(bar) < s.touchGap * (1 - 1e-6);
}

/** Length of the wall cable's path from its anchor to p, wrapping over the wall's top edge if it has to. */
export function wallCablePath(p: Vector2, s: Setup): { length: number; wrapEdge: Vector2 | null } {
    const C = anchorOf(s);
    const edge = vec2(0, s.wallHeight);
    if (p.x > -1e-9) {
        // Height at which the straight line from the anchor crosses the wall's front face.
        const yAtFace = C.y + ((p.y - C.y) * (0 - C.x)) / (p.x - C.x);
        if (yAtFace < s.wallHeight)
            return { length: edge.distanceTo(C) + p.distanceTo(edge), wrapEdge: edge };
    }
    return { length: p.distanceTo(C), wrapEdge: null };
}

type Limit = "beam" | "wall" | "ground" | "edge" | "top";

/** Why the bar can't rest on the main beam at some beam angle. */
type NoRest = "reach" | "upright" | "behindFace" | "corner";

/**
 * Why the bar can't rest on the main beam with its end `pinAlong` along it, at any beam angle the scan tries: the
 * reason most of them fail for, said as the page says it.
 */
function whyNoRest(s: Setup, pinAlong: number): string {
    const counts = new Map<NoRest, number>();
    restOnBeam(s, pinAlong, (why) => counts.set(why, (counts.get(why) ?? 0) + 1));
    const why = [...counts].reduce<[NoRest, number]>(
        (a, b) => (b[1] > a[1] ? b : a),
        ["reach", 0],
    )[0];
    if (why === "upright")
        return "Resting on the ladder, the stretcher would have to stand up past upright.";
    if (why === "behindFace")
        return "Resting on the ladder, the stretcher's foot would be held behind the wall's face.";
    if (why === "corner")
        return "Resting on the ladder, the stretcher would pass through the wall's top edge.";
    return s.wallCable <= Math.hypot(s.anchorBack, s.anchorUp)
        ? "The rope is too short: the stretcher can't reach far enough over the wall's edge for the attachment to reach the ladder."
        : "The stretcher rests on the ladder, but the rope is too short to reach it there.";
}

/** Where the bar's lowest point is at one beam angle, and what stops it going lower. */
type BarAt = { angle: number; taut: boolean; limit: Limit; lowest: number };

/**
 * The bar pinned `pinAlong` along the main beam's top surface: where its pin is, where its other end is, and how low
 * it hangs, at any beam angle. `noted` hears why it can't hang at an angle, where it can't.
 */
function pinnedBar(s: Setup, pinAlong: number, noted?: (why: NoRest) => void) {
    const ell = s.barLength;
    const pinAt = (phi: number) =>
        Vector2.fromAngle(phi, pinAlong).add(Vector2.fromAngle(phi).perp().scale(s.touchGap));
    const end1At = (end2: Vector2, angle: number) =>
        end2.add(vec2(-Math.cos(angle), Math.sin(angle)).scale(ell));
    // A hair of tolerance, for arrangements where the cable is exactly taut.
    const reaches = (p: Vector2) => wallCablePath(p, s).length <= s.wallCable * (1 + 1e-9);

    const lowestBar = (phi: number): BarAt | null => {
        const end2 = pinAt(phi);
        const edgeDist = Math.hypot(end2.x, s.wallHeight - end2.y);
        // Below the wall top, the pin must be in front of the wall (with the main beam leaning on the wall it
        // can be just behind the face).
        if (end2.y < s.wallHeight && end2.x < 0) {
            noted?.("behindFace");
            return null;
        }
        // Lying on the main beam, end 1 on the ground, or end 1 against the wall — whichever is highest.
        const limits: [number, Limit][] = [
            [-phi, "beam"],
            [-Math.asin(Math.min(1, end2.y / ell)), "ground"],
        ];
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
        if (lowest > Math.PI / 2) {
            noted?.("upright");
            return null;
        }
        if (reaches(end1At(end2, lowest))) return { angle: lowest, taut: false, limit, lowest };
        // Otherwise find where the cable's path is shortest (the bar pointing as near the anchor as it can),
        // then bisect back down to the lowest angle the cable reaches. The reachable range can be a sliver.
        const pathAt = (angle: number) => wallCablePath(end1At(end2, angle), s).length;
        const [lo, hi] = goldenSection(pathAt, lowest, Math.PI / 2, 80);
        const shortest = (lo + hi) / 2;
        if (!reaches(end1At(end2, shortest))) {
            noted?.("reach");
            return null;
        }
        const [, b] = bisect((m) => !reaches(end1At(end2, m)), lowest, shortest, 60);
        return { angle: b, taut: true, limit, lowest };
    };

    /** The bar's lowest angle at beam angle phi, and whether the cable or a surface stops it there. */
    const barAt = (phi: number): BarAt | null => {
        const bar = lowestBar(phi);
        // This model has no contact with the wall's top edge, so the bar mustn't pass through the corner.
        if (bar && cutsCorner(end1At(pinAt(phi), bar.angle), pinAt(phi), s)) {
            noted?.("corner");
            return null;
        }
        return bar;
    };

    return { pinAt, end1At, barAt };
}

/** How finely the beam angle is scanned for the lowest energy, and the steps the repairs search over. */
const BEAM_STEPS = 360;

/**
 * The beam angle where the beam and the pinned bar have the least potential energy: a coarse scan, then a
 * golden-section refinement round the lowest point, snapped to lying flat or leaning on the wall when it's all but
 * there. Null if the bar can't hang at any angle.
 */
function lowestEnergyAngle(s: Setup, bar: ReturnType<typeof pinnedBar>): number | null {
    const PHI_MAX = phiMax(s);
    const energyAt = (phi: number) => {
        const b = bar.barAt(phi);
        if (!b) return Infinity;
        const centreY = bar.pinAt(phi).y + (s.barLength / 2) * Math.sin(b.angle);
        return s.beamWeight * (s.beamLength / 2) * Math.sin(phi) + s.barWeight * centreY;
    };
    const n = BEAM_STEPS;
    let best = -1;
    let bestE = Infinity;
    for (let i = 0; i <= n; i++) {
        const e = energyAt((PHI_MAX * i) / n);
        if (e < bestE) [best, bestE] = [i, e];
    }
    if (best < 0) return null;
    const [lo, hi] = goldenSection(
        energyAt,
        (PHI_MAX * Math.max(0, best - 1)) / n,
        (PHI_MAX * Math.min(n, best + 1)) / n,
        60,
    );
    let phi = (lo + hi) / 2;
    if (!(energyAt(phi) <= bestE)) phi = (PHI_MAX * best) / n;
    if (phi < rad(0.05) && energyAt(0) <= energyAt(phi) + 1e-9 * s.barWeight) phi = 0;
    if (PHI_MAX - phi < 1e-6 && energyAt(PHI_MAX) <= energyAt(phi) + 1e-9 * s.barWeight)
        phi = PHI_MAX;
    return phi;
}

/** The bar's positions and the forces on it, before the beam is balanced. */
type BarForces = Omit<Hinged, "hinge" | "wallOnBeam" | "t2" | "beamPush" | "beamCableTaut">;

/**
 * Positions and the forces on the bar at beam angle phi: torques about the pin give the cable's pull or end 1's
 * contact force; the pin takes the rest. Lying flat on the main beam, the beam carries its whole weight. `resting`
 * treats a bar just above a limit as resting on it. Null if the bar can't hang there.
 */
function barForces(
    s: Setup,
    bar: ReturnType<typeof pinnedBar>,
    phi: number,
    resting = false,
): BarForces | null {
    const anchor = anchorOf(s);
    const b = bar.barAt(phi);
    if (!b) return null;
    const end2 = bar.pinAt(phi);
    const end1 = bar.end1At(end2, b.angle);
    const centre = end1.mid(end2);
    const path = wallCablePath(end1, s);
    const W = s.barWeight;
    const base = {
        phi,
        anchor,
        wrapEdge: path.wrapEdge,
        beamAttach: Vector2.fromAngle(phi, s.attachDistance),
        barEnd1: end1,
        barEnd2: end2,
        angle: b.angle,
        cableTaut: b.taut,
        t1: Vector2.ZERO,
        lyingFlat: false,
        barContact: null,
    };

    const u1 = (path.wrapEdge ?? anchor).sub(end1).unit();
    const T1 = (W * (centre.x - end2.x)) / end1.sub(end2).cross(u1);
    // Held by the cable just above a limit, but the cable would have to push: the bar rests on that limit
    // too, with the cable at full length (the tension and contact are split at the end).
    const onLimit = b.taut && (T1 < 0 || resting) && b.angle - b.lowest < 1e-3;
    if (b.taut && !onLimit) {
        const t1 = u1.scale(T1);
        return { ...base, t1, support: vec2(-t1.x, W - t1.y), supportAt: end2 };
    }
    if (b.limit === "wall") {
        const push = (W * (end2.x - centre.x)) / (end1.y - end2.y);
        return {
            ...base,
            support: vec2(-push, W),
            supportAt: end2,
            barContact: { surface: "wall", point: end1, force: vec2(push, 0) },
        };
    }
    if (b.limit === "edge") {
        // Resting on the wall's top edge, which pushes square to the bar.
        const edge = vec2(0, s.wallHeight);
        const n = vec2(Math.sin(b.angle), Math.cos(b.angle));
        const push = (W * (centre.x - end2.x)) / edge.sub(end2).cross(n);
        const f = n.scale(push);
        return {
            ...base,
            support: vec2(-f.x, W - f.y),
            supportAt: end2,
            barContact: { surface: "edge", point: edge, force: f },
        };
    }
    if (b.limit === "ground" || b.limit === "top") {
        const up = (W * (centre.x - end2.x)) / (end1.x - end2.x);
        return {
            ...base,
            support: vec2(0, W - up),
            supportAt: end2,
            barContact: { surface: b.limit, point: end1, force: vec2(0, up) },
        };
    }
    return { ...base, support: vec2(0, W), supportAt: centre, lyingFlat: true };
}

/**
 * Where the cable is pulled to its full length just as the bar rests on a surface, the cable's tension and the
 * surface's push share the load, and only the main beam's torque balance splits them. `h` with them split, or as it
 * was if no split has both pulling and pushing.
 */
function splitAtFullLength(s: Setup, h: BarForces, phi: number): BarForces {
    if (!h.barContact) return h;
    const W = s.barWeight;
    const end1 = h.barEnd1;
    const end2 = h.barEnd2;
    const centre = end1.mid(end2);
    const u1 = (h.wrapEdge ?? anchorOf(s)).sub(end1).unit();
    const n = h.barContact.force.unit();
    const at = h.barContact.point;
    const x = solveLinear(
        [
            [end1.sub(end2).cross(u1), at.sub(end2).cross(n)],
            [end2.cross(u1), end2.cross(n)],
        ],
        [W * (centre.x - end2.x), s.beamWeight * (s.beamLength / 2) * Math.cos(phi) + W * end2.x],
    );
    if (!x || x[0] < 0 || x[1] < 0) return h;
    const [T1, N] = x;
    const t1 = u1.scale(T1);
    const f = n.scale(N);
    return {
        ...h,
        cableTaut: true,
        t1,
        support: vec2(-t1.x - f.x, W - t1.y - f.y),
        barContact: { ...h.barContact, force: f },
    };
}

/**
 * The main beam balanced under the bar: the bar pushes back on it, the wall's top edge when it leans there, and the
 * hinge (or, lying down, the ground too) holds it. The main beam's surface can only push square to itself, so the
 * beam cable takes the rest of the support.
 */
function balanceBeam(s: Setup, h: BarForces, phi: number): Hinged {
    const onBeam = h.support.neg();
    const leftover = h.supportAt.cross(onBeam) - s.beamWeight * (s.beamLength / 2) * Math.cos(phi);
    const wallOnBeam = phi >= phiMax(s) && leftover > 0 ? wallPush(phi, leftover, s) : null;
    const wallForce = wallOnBeam?.force ?? Vector2.ZERO;
    const u2 = h.beamAttach.sub(h.barEnd2).unit();
    const normal = Vector2.fromAngle(phi).perp();
    const T2 = h.support.cross(normal) / u2.cross(normal);
    return {
        ...h,
        wallOnBeam,
        hinge:
            phi > 0 ? vec2(-onBeam.x - wallForce.x, s.beamWeight - onBeam.y - wallForce.y) : null,
        t2: u2.scale(T2),
        beamPush: normal.scale(u2.cross(h.support) / u2.cross(normal)),
        beamCableTaut: true,
    };
}

/**
 * The bar pinned to the main beam's top surface, the beam cable's length from its attachment and just
 * touching. For each beam angle the bar drops as low as the wall cable lets it (or onto the main beam, the
 * ground or the wall); the beam then settles at the angle of least total potential energy. That angle is then
 * repaired where the energy alone pins it down poorly, before the forces are worked out. Null if the bar can't
 * hang at any angle; `noted` hears why at each angle it can't.
 */
function restOnBeam(s: Setup, pinAlong: number, noted?: (why: NoRest) => void): Hinged | null {
    const PHI_MAX = phiMax(s);
    const step = PHI_MAX / BEAM_STEPS;
    const bar = pinnedBar(s, pinAlong, noted);
    const forcesAt = (phi: number, resting = false) => barForces(s, bar, phi, resting);
    let phi = lowestEnergyAngle(s, bar);
    if (phi === null) return null;

    // Net torque lifting the main beam about its hinge. Where the cable can't reach, the beam can't be
    // that low, which acts like an unbounded lift.
    const lift = (phi: number) => {
        const h = forcesAt(phi);
        if (!h) return Infinity;
        return (
            h.supportAt.cross(h.support.neg()) - s.beamWeight * (s.beamLength / 2) * Math.cos(phi)
        );
    };
    const unbalanced = (phi: number) => Math.abs(lift(phi)) > 1e-6 * (s.beamWeight + s.barWeight);

    // The energy minimum can sit where it changes steeply (the beam hanging from an almost straight
    // cable and bar), so pin the angle down where the lift changes from positive to negative.
    if (phi > 0) {
        const below = Math.max(0, phi - 3 * step);
        const above = Math.min(PHI_MAX, phi + 3 * step);
        if (lift(below) > 0 && lift(above) < 0) {
            const [a, b] = bisect((m) => lift(m) > 0, below, above, 60);
            phi = forcesAt(b) ? b : a;
        }
    }

    let h = forcesAt(phi)!;
    // Stopped where the cable comes taut just as the bar comes down onto a surface: move to exactly where
    // that happens and treat the bar as resting there, so the split below can balance the main beam.
    const nearLimit = (p: number) => {
        const b = bar.barAt(p);
        return b !== null && b.taut && b.angle - b.lowest < 1e-3;
    };
    if (phi > 0 && !h.barContact && nearLimit(phi) && unbalanced(phi)) {
        const above = Math.min(PHI_MAX, phi + 3 * step);
        if (bar.barAt(above) && !bar.barAt(above)!.taut) {
            const [, b] = bisect((m) => !!bar.barAt(m)?.taut, phi, above, 60);
            const resting = forcesAt(b, true);
            if (resting) [phi, h] = [b, resting];
        }
    }
    // Stopped where the cable is pulled to its full length just as the bar rests on a surface.
    const atFullLength = wallCablePath(h.barEnd1, s).length >= s.wallCable * (1 - 1e-6);
    if (phi > 0 && h.barContact && atFullLength && unbalanced(phi))
        h = splitAtFullLength(s, h, phi);
    return balanceBeam(s, h, phi);
}

/** The main beam's push on the bar's end along the beam (positive: up it, away from the hinge). */
const alongBeam = (h: Hinged) => h.support.cross(Vector2.fromAngle(h.phi).perp());

/**
 * The bar resting on the main beam. Nothing but the beam cable holds its end in place along the beam, so it
 * starts nearest the hinge with the cable taut. If the cable would have to push there, the end slides up the
 * beam: it stops where the beam's push alone balances it (the cable slack), or where the cable comes taut
 * again past its attachment. Off the beam's end, nothing holds it.
 */
function solveHinged(s: Setup): Hinged | { fail: string } | { noRest: string } {
    // Shorter than the gap between them, the attachment can't hold the stretcher's end to the ladder at all.
    if (s.beamCable <= s.touchGap)
        return { fail: "The attachment is too short to reach the ladder." };
    const reach = Math.sqrt(Math.max(0, s.beamCable ** 2 - s.touchGap ** 2));
    const lo = s.attachDistance - reach;
    const hi = Math.min(s.beamLength, s.attachDistance + reach);
    const tolerance = 1e-3 * (s.beamWeight + s.barWeight);
    const first = restOnBeam(s, lo);
    if (!first) return { noRest: whyNoRest(s, lo) };
    if (alongBeam(first) >= -tolerance) return first;
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
        const [, b] = bisect(
            (m) => {
                const hm = restOnBeam(s, m);
                return !!hm && alongBeam(hm) < 0;
            },
            below,
            at,
            30,
        );
        const settled = restOnBeam(s, b) ?? h;
        const normal = Vector2.fromAngle(settled.phi).perp();
        const push = settled.support.dot(normal);
        return { ...settled, t2: Vector2.ZERO, beamPush: normal.scale(push), beamCableTaut: false };
    }
    // Still sliding at the far end of its range: the beam cable catches it past the attachment, unless the
    // beam ends first.
    if (hi < s.attachDistance + reach)
        return { fail: "The stretcher's foot would slide off the end of the ladder." };
    return restOnBeam(s, hi) ?? { noRest: whyNoRest(s, hi) };
}

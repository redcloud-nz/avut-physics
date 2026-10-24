import { nearestOnSegment, segmentsCross } from "@/lib/geometry";
import { clamp, rad } from "@/lib/math";
import {
    centralDifferences,
    gridMinima,
    leastSquares,
    nelderMead,
    solveLinear,
    transpose,
    withColumns,
} from "@/lib/numeric";
import { vec2, Vector2 } from "@/lib/vector2";
import { anchorOf, behindFaceFor, ropePathFor } from "@/lib/wall";

import { phiMax, wallPush, type Setup, type Surface } from "./ladder-hinge-solver";

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
/** Over how many degrees the team brings the ladder from where it settles by itself to level. */
export const UNDERRUN_OVER = 7.5;
/** The steepest the ground team holds the ladder (degrees). */
export const MAX_TEAM_ANGLE = 60;
/** How well the ladder's foot grips the ground (rubber feet on a hard surface). */
export const FOOT_FRICTION = 0.5;

export type HeldContact = { surface: Surface | "ladder"; point: Vector2; force: Vector2 };

export type Held = {
    phi: number;
    anchor: Vector2;
    wrapEdge: Vector2 | null;
    beamAttach: Vector2;
    /** The ladder's tip, when the attachment runs over it to a stretcher on the ladder's far side. */
    attachVia: Vector2 | null;
    barEnd1: Vector2; // on the rope
    barEnd2: Vector2; // on the attachment
    /** The stretcher's slope, from −90° to 90°: positive when its ladder end is the higher. */
    tilt: number;
    ropeTaut: boolean;
    t1: Vector2;
    attachmentTaut: boolean;
    t2: Vector2;
    /** What the stretcher rests on, and the force pushing back on it. */
    contacts: HeldContact[];
    /** Where on the ladder the stretcher's contacts push back on it (the same order as `contacts`). */
    ladderPoints: (Vector2 | null)[];
    /** The team's push on the ladder, straight up or down (null when the wall or ground holds it instead). */
    hold: { point: Vector2; force: Vector2 } | null;
    wallOnBeam: { point: Vector2; force: Vector2 } | null;
    /** Force the hinge exerts on the ladder (null when it lies on the ground, which shares the load). */
    hinge: Vector2 | null;
};

export type HeldResult = { kind: "held"; h: Held } | { kind: "none"; reason: string };

/** The parts of the setup the wall and the rope's anchor need. */
type Kind = "rope" | "attachment" | Surface | "ladder";

/** One constraint, g ≤ 0, whose force on the stretcher pushes along m at the stretcher's point `at`. */
type Piece = { key: string; kind: Kind; g: number; at: Vector2; m: Vector2; ladderAt?: Vector2 };

/** The stretcher with the ladder held at angle phi. */
export function solveHeld(s: Setup, phi: number): HeldResult {
    if (s.barWeight <= 0) return { kind: "none", reason: "Give the stretcher some mass." };
    phi = clamp(phi, 0, phiMax(s));
    const W = s.barWeight;
    const half = s.barLength / 2;
    const anchor = anchorOf(s);
    const edge = vec2(0, s.wallHeight);
    const along = Vector2.fromAngle(phi);
    const normal = along.perp();
    const B = along.scale(s.attachDistance);
    const tip = along.scale(s.beamLength);

    const ropePath = (p: Vector2) => ropePathFor(s, p);
    const behindFace = (p: Vector2) => behindFaceFor(s, p);

    /** The attachment's path to p: straight from its fixing, or over the ladder's tip to the ladder's far side. */
    function attachmentPath(p: Vector2): { length: number; via: Vector2 | null } {
        return p.dot(normal) < 0
            ? { length: tip.distanceTo(B) + p.distanceTo(tip), via: tip }
            : { length: p.distanceTo(B), via: null };
    }

    const ends = (q: number[]): [Vector2, Vector2] => {
        const d = Vector2.fromAngle(q[2]);
        const c = vec2(q[0], q[1]);
        return [c.sub(d.scale(half)), c.add(d.scale(half))];
    };

    /** The stretcher can't pass through the ladder (it can only get to the far side round the tip). */
    const valid = (q: number[]) => {
        const [P1, P2] = ends(q);
        return !segmentsCross(Vector2.ZERO, tip, P1, P2);
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
            m: towards.sub(P1).safeUnit(anchor.sub(P1).unit()),
        });
        const att = attachmentPath(P2);
        out.push({
            key: "attachment",
            kind: "attachment",
            g: att.length - s.beamCable,
            at: P2,
            m: (att.via ?? B).sub(P2).safeUnit(vec2(0, 1)),
        });
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
                      ? {
                            kind: "edge",
                            g: -P.distanceTo(edge),
                            m: P.sub(edge).safeUnit(vec2(0, 1)),
                        }
                      : P.x >= 0
                        ? { kind: "wall", g: -P.x, m: vec2(1, 0) }
                        : { kind: "top", g: h - P.y, m: vec2(0, 1) };
            out.push({ key: `wall${i}`, at: P, ...wall });
            const onLadder = nearestOnSegment(P, Vector2.ZERO, tip).point;
            out.push({
                key: `ladder${i}`,
                kind: "ladder",
                g: s.touchGap - P.distanceTo(onLadder),
                at: P,
                m: P.sub(onLadder).safeUnit(normal),
                ladderAt: onLadder,
            });
        }
        // Spanning the wall's face, the stretcher must pass above its top edge.
        if (behindFace(P1) !== behindFace(P2)) {
            const d = P2.sub(P1).unit();
            const up = d.x > 0 ? d.perp() : d.perp().neg();
            const at = P1.add(d.scale(edge.sub(P1).dot(d)));
            out.push({ key: "corner", kind: "edge", g: edge.sub(P1).dot(up), at, m: up });
        }
        // The ladder's tip under the stretcher's middle (at its ends the ladder pieces above already count).
        const onBar = nearestOnSegment(tip, P1, P2);
        if (onBar.t > 1e-9 && onBar.t < 1 - 1e-9) {
            out.push({
                key: "tip",
                kind: "ladder",
                g: s.touchGap - onBar.point.distanceTo(tip),
                at: onBar.point,
                m: onBar.point.sub(tip).safeUnit(normal),
                ladderAt: tip,
            });
        }
        return out;
    };

    /** A constraint's force on the stretcher per newton: its x and y, and its torque about the centre. */
    const generalised = (p: Piece, q: number[]) => [
        p.m.x,
        p.m.y,
        p.at.sub(vec2(q[0], q[1])).cross(p.m),
    ];

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
        const P2 = B.add(Vector2.fromAngle(a, s.beamCable * 0.999));
        const c = P2.sub(Vector2.fromAngle(theta, half));
        return [c.x, c.y, theta];
    };
    const soft = penalised(1e4 * W);
    const starts = searchStarts();
    const stiff = penalised(1e7 * W);
    function searchStarts() {
        const grid = Array.from({ length: nTheta }, (_, i) =>
            Array.from({ length: nA }, (_, j) => soft(startAt(i, j))),
        );
        return gridMinima(grid).map(({ i, j, e }) => ({ q: startAt(i, j), e }));
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
        const negative = [...polished.lambda]
            .filter(([, l]) => l < -1e-6 * W)
            .sort((a, b) => a[1] - b[1]);
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
    const forceOf = (p: Piece) => p.m.scale(Math.max(0, lambda.get(p.key) ?? 0));
    const byKey = new Map(final.map((p) => [p.key, p]));
    const rope = byKey.get("rope")!;
    const attachment = byKey.get("attachment")!;
    const t1 = forceOf(rope);
    const t2 = forceOf(attachment);
    // Stretched into a straight line between the anchor and the ladder, the tensions grow without bound.
    if (Math.max(t1.len(), t2.len()) > 100 * W) {
        return {
            kind: "none",
            reason: "The rope, stretcher and attachment would be pulled into a straight line, so the tension would be unbounded.",
        };
    }
    const touching = final.filter(
        (p) => p.kind !== "rope" && p.kind !== "attachment" && forceOf(p).len() > 1e-9,
    );
    const contacts = touching.map((p) => ({
        surface: p.kind as Surface | "ladder",
        point: p.at,
        force: forceOf(p),
    }));
    const ladderPoints = touching.map((p) => p.ladderAt ?? null);

    const attachVia = attachmentPath(P2).via;
    return {
        kind: "held",
        h: settleLadder(s, phi, P1, P2, t1, t2, attachVia, contacts, ladderPoints),
    };

    /**
     * Newton's method on the balance of the stretcher with the given constraints held exactly at zero:
     * unknowns the position and each constraint's force. Returns null if it doesn't converge.
     */
    function kkt(
        q0: number[],
        keys: string[],
    ): { q: number[]; lambda: Map<string, number> } | null {
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
            m === 0 ? [] : (leastSquares(transpose(cols), [0, W, 0], 1e-9) ?? keys.map(() => 0));
        let q = [...q0];
        for (let iter = 0; iter < 40; iter++) {
            const r = residual(q, l);
            if (!r) return null;
            const size = Math.max(...r.map(Math.abs));
            if (size < 1e-9 * W) return { q, lambda: new Map(keys.map((k, i) => [k, l[i]])) };
            // Jacobian: numerically in the position, exactly in the forces (the balance is linear in them).
            const dq = centralDifferences((q) => residual(q, l), q, [1e-7, 1e-7, 1e-7 / half]);
            if (!dq) return null;
            const forces = at(q).map((p) => generalised(p!, q));
            const J = withColumns(dq, forces);
            // Least squares (square and well-posed in the usual case; more contacts than freedoms otherwise).
            const dx = leastSquares(
                J,
                r.map((v) => -v),
                1e-12 * W * W,
            );
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
    P1: Vector2,
    P2: Vector2,
    t1: Vector2,
    t2: Vector2,
    attachVia: Vector2 | null,
    contacts: HeldContact[],
    ladderPoints: (Vector2 | null)[],
): Held {
    const along = Vector2.fromAngle(phi);
    const B = along.scale(s.attachDistance);
    // Wrapped round the tip, the attachment's pull on the ladder acts there (its pulls along the ladder cancel).
    const onLadder = [{ at: attachVia ?? B, f: t2.neg() }];
    contacts.forEach((c, i) => {
        const at = ladderPoints[i];
        if (at) onLadder.push({ at, f: c.force.neg() });
    });
    const torque =
        onLadder.reduce((sum, l) => sum + l.at.cross(l.f), 0) -
        s.beamWeight * (s.beamLength / 2) * Math.cos(phi);
    let hold: Held["hold"] = null;
    let wallOnBeam: Held["wallOnBeam"] = null;
    const down = phi < rad(0.05) && torque <= 0;
    if (phi >= phiMax(s) - 1e-9 && torque > 0) wallOnBeam = wallPush(phi, torque, s);
    else if (!down) {
        const reach = phi > 0 ? Math.min(s.beamLength, HOLD_HEIGHT / Math.sin(phi)) : s.beamLength;
        const point = along.scale(reach);
        hold = { point, force: vec2(0, -torque / point.x) };
    }
    const extra = [hold?.force, wallOnBeam?.force].filter((f): f is Vector2 => !!f);
    const net = [...onLadder.map((l) => l.f), ...extra].reduce((a, b) => a.add(b), Vector2.ZERO);
    return {
        phi,
        anchor: anchorOf(s),
        wrapEdge: ropePathFor(s, P1).wrapEdge,
        beamAttach: B,
        attachVia,
        barEnd1: P1,
        barEnd2: P2,
        tilt: Math.atan2(P2.y - P1.y, Math.abs(P2.x - P1.x)),
        ropeTaut: t1.len() > 1e-9,
        t1,
        attachmentTaut: t2.len() > 1e-9,
        t2,
        contacts,
        ladderPoints,
        hold,
        wallOnBeam,
        hinge: down ? null : vec2(-net.x, s.beamWeight - net.y),
    };
}

export type LevelResult = { result: HeldResult; level: boolean; reason?: string };

/**
 * Level and resting on the ladder, with the attachment taut, the stretcher's position follows from the
 * ladder's angle alone: its ladder end where the attachment holds it against the ladder, its rope end the
 * stretcher's length towards the wall at the same height.
 */
function levelEnds(s: Setup, phi: number): [Vector2, Vector2] {
    const reach = Math.sqrt(Math.max(0, s.beamCable ** 2 - s.touchGap ** 2));
    const along = Vector2.fromAngle(phi);
    const P2 = along.scale(s.attachDistance - reach).add(along.perp().scale(s.touchGap));
    return [P2.sub(vec2(s.barLength, 0)), P2];
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
        if (P1.x < 0) [P1, P2] = [vec2(0, P1.y), vec2(s.barLength, P2.y)];
        if (P2.distanceTo(vec2(s.attachDistance, 0)) > s.beamCable + 1e-9) {
            const result = solveHeld(s, 0);
            return { result, level: result.kind === "held" && Math.abs(result.h.tilt) < rad(0.5) };
        }
        const centre = P1.add(P2).scale(0.5);
        const contact: HeldContact = {
            surface: "ladder",
            point: centre,
            force: vec2(0, s.barWeight),
        };
        const none = Vector2.ZERO;
        const h = settleLadder(s, 0, P1, P2, none, none, null, [contact], [vec2(centre.x, 0)]);
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
    const notLevel = (reason: string): LevelResult => ({
        result: solveHeld(s, phi),
        level: false,
        reason,
    });
    const [P1, P2] = levelEnds(s, phi);
    if (P1.y < 0) return notLevel("Level, the stretcher's rope end would be below the ground.");
    if (P1.x < 0 && P1.y < s.wallHeight)
        return notLevel("Level, the stretcher would pass through the wall.");

    // The stretcher's balance: the rope's pull at end 1, the attachment's and the ladder's push at end 2.
    const u1 = (ropePathFor(s, P1).wrapEdge ?? anchorOf(s)).sub(P1).unit();
    const along = Vector2.fromAngle(phi);
    const u2 = along.scale(s.attachDistance).sub(P2).unit();
    const n = along.perp();
    const centre = P1.add(P2).scale(0.5);
    const x = solveLinear(
        [
            [u1.x, u2.x, n.x],
            [u1.y, u2.y, n.y],
            [P1.sub(P2).cross(u1), 0, 0],
        ],
        [0, W, centre.sub(P2).cross(vec2(0, -W)) * -1],
    );
    if (!x)
        return notLevel("The rope, attachment and ladder can't balance the stretcher level here.");
    const [T1, T2, N] = x;
    const tol = -1e-6 * W;
    if (T1 < tol) return notLevel("The rope would have to push to keep the stretcher level.");
    if (N < tol) return notLevel("The stretcher would lift off the ladder.");
    if (T2 < tol)
        return notLevel(
            "The stretcher's end would slide up the ladder, with the attachment slack.",
        );

    const ladderAt = P2.sub(n.scale(s.touchGap));
    const h = settleLadder(
        s,
        phi,
        P1,
        P2,
        u1.scale(Math.max(0, T1)),
        u2.scale(Math.max(0, T2)),
        null,
        [{ surface: "ladder", point: P2, force: n.scale(Math.max(0, N)) }],
        [ladderAt],
    );
    return { result: { kind: "held", h }, level: true };
}

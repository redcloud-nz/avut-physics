import { clamp } from "@/lib/math";
import {
    centralDifferences,
    leastSquares,
    nelderMead,
    nonNegativeLeastSquares,
    withColumns,
} from "@/lib/numeric";
import { vec2 } from "@/lib/vector2";
import { vec3, Vector3 } from "@/lib/vector3";
import { ropePathFor } from "@/lib/wall";

/**
 * A four-point lower down a slot. The stretcher starts on the floor beside the slot, lying along it. Four ropes, one
 * from each corner to its own hard belay, do all the work: no one lifts or pushes it. Each belayer pays out or takes
 * in their own rope (`follow`); the stretcher is free to move and turn every way, and settles where its weight sits
 * lowest, as far as the ropes, the floor, the slot's sides and bottom let it. The floor has no friction, so each
 * belayer keeps a light pull (`SNUG`) on their rope even when it has slack: that pull, not friction, keeps the
 * stretcher where the ropes put it on the floor.
 *
 * `planAt` scripts one way through the lower (slid out until it nearly balances on the slot's edge, its feet then
 * its head swung out over the slot, moved across to the middle, lowered), each belayer's rope out being as much as
 * reaches the stretcher's corner on that path. The tests follow it through.
 *
 * Coordinates: x across the slot, from its middle, the stretcher starting on the near side (x < 0); y up, from the
 * slot's bottom; z along the slot, the head end towards z > 0. The slot's edges run along z at x = ±slotWidth / 2,
 * y = slotDepth. The belays stand at the corners of a rectangle round the slot, centred on z = 0.
 *
 * Each rope takes the shortest path from its belay to its corner, over the slot's edge on its own side when it has
 * to: seen end on, the two-point lower's path over a wall, its run along the slot added as the other side of a
 * right-angled triangle (unfolded flat about the edge, the rope is a straight line).
 */

export type Setup = {
    /** From the slot's bottom up to the floor round it. */
    slotDepth: number;
    slotWidth: number;
    /** Each belay sits this far above the floor and this far back from the slot's edge. */
    anchorUp: number;
    anchorBack: number;
    /** How far apart along the slot each side's head and foot belays are. */
    belaySpacing: number;
    barLength: number;
    barWidth: number;
    /** How deep the basket is: the ropes tie to its top rail, its bottom rests on things. */
    barDepth: number;
    barWeight: number;
};

/** The stretcher starts this far back from the slot's edge. */
export const START_GAP = 0.1;

/** It's first slid out until its middle is this far short of the slot's edge, still resting on the floor. */
export const SHORT_OF_EDGE = 0.05;

/** Its feet, then its head, are swung out over the slot until they're this far clear of the edge. */
export const CLEAR = 0.02;

/** Across the slot, it's lowered this far below the floor (its bottom), so the ropes aren't quite flat. */
export const ACROSS_DROP = 0.2;

/** Once the stretcher lands on the slot's bottom, the belayers pay out this much more, so it rests there. */
export const LANDING = 0.1;

/** Each belayer keeps at least this share of the stretcher's weight on their rope: a light pull, taking up slack. */
export const SNUG = 0.05;

/** The stages of the lower, in order: the progress runs from 0 to their number, one per stage. */
export const STAGES = ["Slide out", "Feet over", "Head over", "Across", "Down"] as const;

/** Where the plan has the stretcher at a point in the lower. */
export type Plan = {
    stage: number;
    /** The stretcher's middle, across the slot and along it. */
    x: number;
    z: number;
    /** The height of the stretcher's bottom above the slot's bottom. */
    height: number;
    /** How far the stretcher is turned from lying along the slot, seen from above (radians): its foot end out. */
    yaw: number;
    /** How high the ropes would hold its bottom: below the slot's bottom once it lands, as the belayers pay out a
     *  little more. */
    ropeHeight: number;
};

/** The ropes, in order, by end (+1 head, −1 foot) and side (−1 near, +1 far). */
export const ROPES = [
    { name: "Head, near side", end: 1, side: -1 },
    { name: "Head, far side", end: 1, side: 1 },
    { name: "Foot, near side", end: -1, side: -1 },
    { name: "Foot, far side", end: -1, side: 1 },
] as const;

export type Rope = {
    anchor: Vector3;
    /** Where the rope crosses the slot's edge, when it wraps over it. */
    edgeCrossing: Vector3 | null;
    corner: Vector3;
    /** How much rope the belayer has out, and how much of it runs from the belay to the corner (less when slack). */
    out: number;
    length: number;
    tension: number;
    /** The rope's pull on the stretcher's corner. */
    pull: Vector3;
};

export type Surface = "floor" | "wall" | "edge" | "bottom";

/** Something the stretcher is pressed against, and how hard it pushes back. */
export type Contact = { surface: Surface; at: Vector3; force: Vector3 };

export type Placed = {
    /** The stretcher's position: its middle, then how far it's tipped sideways (roll, its far side up), tipped end
     *  to end (pitch, its head up) and turned (yaw, its foot end out over the slot), in radians. */
    q: number[];
    centre: Vector3;
    roll: number;
    pitch: number;
    yaw: number;
    /** The top rail's corners, where the ropes tie, in the ropes' order. */
    corners: Vector3[];
    /** All eight of the basket's corners: the top rail's, then the bottom's, each in the ropes' order. */
    box: Vector3[];
    ropes: Rope[];
    contacts: Contact[];
};

export type PlaceResult = { kind: "placed"; p: Placed } | { kind: "none"; reason: string };

/** Where the plan has the stretcher at a point in the lower, from 0 (on the floor) to `STAGES.length` (on the bottom). */
export function planAt(s: Setup, progress: number): Plan {
    const D = s.slotDepth;
    const edge = s.slotWidth / 2;
    const halfWidth = s.barWidth / 2;
    const halfLength = s.barLength / 2;
    const p = clamp(progress, 0, STAGES.length);
    const stage = Math.min(Math.floor(p), STAGES.length - 1);
    const t = p - stage;
    const lerp = (a: number, b: number) => a + (b - a) * t;
    const start = -edge - START_GAP - halfWidth;
    const balanced = -edge - SHORT_OF_EDGE;
    const clear = -edge + CLEAR + halfWidth;
    const across = D - ACROSS_DROP;
    // Swung out about the middle of its head end, the feet are clear of the edge when the foot end's near corner is:
    // balanced + length·sin(yaw) − halfWidth·cos(yaw) = clear − halfWidth. Solved for the yaw, as
    // a·sin − b·cos = c with a = length, b = halfWidth.
    const c = clear - halfWidth - balanced;
    const feetOut =
        Math.atan2(halfWidth, s.barLength) + Math.asin(c / Math.hypot(s.barLength, halfWidth));
    const level = (x: number, height: number, ropeHeight = height): Plan => ({
        stage,
        x,
        z: 0,
        height,
        yaw: 0,
        ropeHeight,
    });
    // Turned by `yaw`, with the middle of its head (end = 1) or foot (end = −1) end at (x, z).
    const endAt = (end: number, x: number, z: number, yaw: number): Plan => ({
        stage,
        x: x + end * halfLength * Math.sin(yaw),
        z: z - end * halfLength * Math.cos(yaw),
        height: D,
        yaw,
        ropeHeight: D,
    });
    switch (stage) {
        case 0:
            // Slid out along the floor until it nearly balances on the edge.
            return level(lerp(start, balanced), D);
        case 1:
            // The feet swung out over the slot, the head end staying put.
            return endAt(1, balanced, halfLength, lerp(0, feetOut));
        case 2: {
            // Then the head, the foot end moving to where it ends up with the stretcher square to the slot again.
            const foot = endAt(1, balanced, halfLength, feetOut);
            const footX = foot.x + halfLength * Math.sin(feetOut);
            const footZ = foot.z - halfLength * Math.cos(feetOut);
            return endAt(-1, lerp(footX, clear), lerp(footZ, -halfLength), lerp(feetOut, 0));
        }
        case 3:
            // Across to the middle, dropping a little.
            return level(lerp(clear, 0), lerp(D, across));
        default: {
            // Down, the ropes paid out a little past where it lands.
            const ropeHeight = lerp(across, -LANDING);
            return level(0, Math.max(0, ropeHeight), ropeHeight);
        }
    }
}

/** A direction on the stretcher, given across, up through and along it, turned to its position. */
function turn(v: Vector3, roll: number, pitch: number, yaw: number): Vector3 {
    // Roll about its length, then pitch about its width, then yaw about the vertical.
    const [cr, sr, cp, sp, cy, sy] = [
        Math.cos(roll),
        Math.sin(roll),
        Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw),
        Math.sin(yaw),
    ];
    const a = vec3(v.x * cr - v.y * sr, v.x * sr + v.y * cr, v.z);
    const b = vec3(a.x, a.y * cp + a.z * sp, -a.y * sp + a.z * cp);
    return vec3(b.x * cy - b.z * sy, b.y, b.x * sy + b.z * cy);
}

/**
 * The basket's corners at position q (its middle, and how it's turned): the top rail's four, where the ropes tie,
 * in the ropes' order, then the bottom's four in the same order.
 */
export function boxAt(s: Setup, q: number[]): Vector3[] {
    const c = vec3(q[0], q[1], q[2]);
    return [1, -1].flatMap((up) =>
        ROPES.map((r) =>
            c.add(
                turn(
                    vec3(
                        (r.side * s.barWidth) / 2,
                        (up * s.barDepth) / 2,
                        (r.end * s.barLength) / 2,
                    ),
                    q[3],
                    q[4],
                    q[5],
                ),
            ),
        ),
    );
}

/** The top rail's corners, where the ropes tie, in the ropes' order. */
export const cornersAt = (s: Setup, q: number[]) => boxAt(s, q).slice(0, 4);

/** The basket's edges, as pairs of its corners: round the top rail, round the bottom, and up the four corners. */
export const BOX_EDGES = [
    [0, 1],
    [1, 3],
    [3, 2],
    [2, 0],
    [4, 5],
    [5, 7],
    [7, 6],
    [6, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
] as const;

/** A plan as a position: the basket's middle, half its depth above its bottom, level and turned by the plan's yaw. */
export const planQ = (s: Setup, p: Plan) => [p.x, p.height + s.barDepth / 2, p.z, 0, 0, p.yaw];

/** A rope from its belay to a corner: its path over the slot's edge if it wraps, its length, and which way it pulls. */
function ropeTo(s: Setup, rope: (typeof ROPES)[number], corner: Vector3) {
    const edge = s.slotWidth / 2;
    // Seen end on, from the rope's side of the slot: x out from the slot's side into the slot.
    const toLocal = (x: number) => edge - rope.side * x;
    const fromLocal = (x: number) => rope.side * (edge - x);
    const wall = { wallHeight: s.slotDepth, anchorUp: s.anchorUp, anchorBack: s.anchorBack };
    const local = vec2(toLocal(corner.x), corner.y);
    const path = ropePathFor(wall, local);
    const anchorLocal = vec2(-s.anchorBack, s.slotDepth + s.anchorUp);
    const anchor = vec3(fromLocal(anchorLocal.x), anchorLocal.y, (rope.end * s.belaySpacing) / 2);
    const dz = anchor.z - corner.z;
    const length = Math.hypot(path.length, dz);
    const next = path.wrapEdge ?? anchorLocal;
    const run = next.sub(local).unit();
    const toward = vec3(-rope.side * run.x * path.length, run.y * path.length, dz).scale(
        1 / length,
    );
    const edgeCrossing = path.wrapEdge
        ? vec3(
              fromLocal(path.wrapEdge.x),
              path.wrapEdge.y,
              corner.z + (dz * path.wrapEdge.distanceTo(local)) / path.length,
          )
        : null;
    return { anchor, edgeCrossing, length, toward };
}

/** How much rope each belayer has out at a point in the lower: what reaches the corner on the planned path. */
export const ropeOutAt = (s: Setup, progress: number) => ropeOutFor(s, planAt(s, progress));

/** How much rope each belayer has out for a plan: what reaches the corner with the stretcher there, level. */
export function ropeOutFor(s: Setup, plan: Plan): number[] {
    const corners = cornersAt(s, planQ(s, { ...plan, height: plan.ropeHeight }));
    return ROPES.map((r, i) => ropeTo(s, r, corners[i]).length);
}

/**
 * Something limiting where the stretcher can go: g ≤ 0 where it's allowed (for a rope, g is how much longer it
 * would have to be). Held at g = 0, it pushes or pulls at `at` along `m` (a unit vector), never the other way.
 * A floor, a slot's side or a slot's edge is a flat surface or a straight line, carried on past where it ends so
 * the polish can follow it smoothly; `valid` says whether the stretcher is still where it really is.
 */
type Piece = {
    key: string;
    kind: "rope" | Surface;
    g: number;
    at: Vector3;
    m: Vector3;
    valid: boolean;
};

/**
 * Everything limiting the stretcher at position q: the ropes, the basket's corners against the floor, the slot's
 * sides and bottom, and its edges against the slot's edges. Pieces named in `keep` are included even where they don't apply.
 */
function piecesAt(s: Setup, out: number[], q: number[], keep = new Set<string>()): Piece[] {
    const D = s.slotDepth;
    const edge = s.slotWidth / 2;
    const tol = 1e-9;
    const box = boxAt(s, q);
    const corners = box.slice(0, 4);
    const pieces: Piece[] = [];
    ROPES.forEach((r, i) => {
        const path = ropeTo(s, r, corners[i]);
        pieces.push({
            key: `rope${i}`,
            kind: "rope",
            g: path.length - out[i],
            at: corners[i],
            m: path.toward,
            valid: true,
        });
    });
    for (const side of [-1, 1]) {
        // The floor on this side, seen end on: u how far out past the edge, `below` how far under the floor's level.
        box.forEach((p, i) => {
            const u = side * p.x - edge;
            const below = D - p.y;
            const floor: Piece = {
                key: `floor${side}-${i}`,
                kind: "floor",
                g: below,
                at: p,
                m: vec3(0, 1, 0),
                valid: u >= -tol,
            };
            const wall: Piece = {
                key: `wall${side}-${i}`,
                kind: "wall",
                g: u,
                at: p,
                m: vec3(-side, 0, 0),
                valid: below >= -tol,
            };
            // The one the corner would come out through: the floor over it, the slot's side beside it.
            const facing =
                u > 0 && below > 0
                    ? below < u
                        ? floor
                        : wall
                    : u >= 0
                      ? floor
                      : below > 0
                        ? wall
                        : null;
            for (const piece of [floor, wall])
                if (piece === facing || keep.has(piece.key)) pieces.push(piece);
        });
        // An edge of the basket spanning the slot's edge, seen end on, must pass above it. Pressed together, they
        // push square to both.
        const lip = vec2(side * edge, D);
        BOX_EDGES.forEach(([a, b], k) => {
            const [p, r] = [box[a], box[b]];
            const [ua, ub] = [side * p.x - edge, side * r.x - edge];
            const key = `lip${side}-${k}`;
            const spans = ua * ub <= 0;
            if ((!spans || ua === ub) && !keep.has(key)) return;
            if (Math.abs(ua - ub) < 1e-12) return;
            const [over, inSlot] = ua > ub ? [p, r] : [r, p];
            const d = vec2(inSlot.x - over.x, inSlot.y - over.y);
            const up0 = d.unit().perp();
            const up = up0.y < 0 ? up0.neg() : up0;
            const rel = lip.sub(vec2(over.x, over.y));
            const t = rel.dot(d) / d.dot(d);
            pieces.push({
                key,
                kind: "edge",
                g: rel.dot(up),
                at: over.add(inSlot.sub(over).scale(t)),
                m: vec3(up.x, up.y, 0),
                valid: spans,
            });
        });
    }
    box.forEach((p, i) =>
        pieces.push({
            key: `bottom${i}`,
            kind: "bottom",
            g: -p.y,
            at: p,
            m: vec3(0, 1, 0),
            valid: true,
        }),
    );
    return pieces;
}

/** A force's push and turning about the stretcher's middle, per newton along m. */
const generalised = (p: { at: Vector3; m: Vector3 }, centre: Vector3) => {
    const t = p.at.sub(centre).cross(p.m);
    return [p.m.x, p.m.y, p.m.z, t.x, t.y, t.z];
};

/** The stretcher's weight and the belayers' light pulls: what the ropes' extra pulls and the pushes must balance. */
function loadsAt(s: Setup, pieces: Piece[], q: number[]): number[] {
    const centre = vec3(q[0], q[1], q[2]);
    const snug = SNUG * s.barWeight;
    const load = [0, -s.barWeight, 0, 0, 0, 0];
    for (const p of pieces)
        if (p.kind === "rope") generalised(p, centre).forEach((v, j) => (load[j] += snug * v));
    return load;
}

/** The angles' steps, in metres moved at the stretcher's ends per radian. */
const lengthScale = (s: Setup) => s.barLength / 2;

/**
 * Where the stretcher settles with the ropes out by `out`, starting the search from position q0: and what holds it
 * there. A polish of q0 alone first; if that doesn't settle, a search for the lowest energy from q0 (and from `also`,
 * if given), then a polish.
 */
export function settle(s: Setup, out: number[], q0: number[], also?: number[]): PlaceResult {
    if (s.barWeight <= 0) return { kind: "none", reason: "Give the stretcher some mass." };
    if (s.barWidth >= s.slotWidth)
        return { kind: "none", reason: "The stretcher is too wide to fit down the slot." };
    const W = s.barWeight;
    const L = lengthScale(s);
    const snug = SNUG * W;
    const pieces = (q: number[], keep?: Set<string>) => piecesAt(s, out, q, keep);

    // Failing with every rope held to start with (which drags the stretcher about where a rope is well slack),
    // again with only those within a few centimetres of taut.
    let polished = polish(q0) ?? polish(q0, false);
    // How far the best balance found misses by, where it came to that.
    let missedBy: number | null = null;
    if (!polished) {
        // The stretcher's energy, with each overstep of a limit penalised as a stiff spring (angles scaled to
        // metres at its ends, so the search steps alike in each).
        const toQ = (x: number[]) => [x[0], x[1], x[2], x[3] / L, x[4] / L, x[5] / L];
        const toX = (q: number[]) => [q[0], q[1], q[2], q[3] * L, q[4] * L, q[5] * L];
        const energy = (k: number) => (x: number[]) => {
            const ps = pieces(toQ(x));
            // The ropes come first, in order: each one's length is its gap plus what's out.
            const ropeLength = ROPES.reduce((sum, _, i) => sum + ps[i].g + out[i], 0);
            return (
                W * x[1] +
                snug * ropeLength +
                (k / 2) * ps.reduce((sum, p) => sum + Math.max(0, p.g) ** 2, 0)
            );
        };
        // Search from the starting position (and the other, if given), and keep the lower.
        const stiff = energy(1e7 * W);
        const q = toQ(
            [q0, ...(also ? [also] : [])]
                .map(toX)
                .map((x0) => nelderMead(stiff, nelderMead(energy(1e4 * W), x0, 0.05), 1e-3))
                .reduce((a, b) => (stiff(b) < stiff(a) ? b : a)),
        );
        polished = polish(q);
        if (!polished) {
            // The polish can stall where a corner sits exactly on an edge. Settle for the search's position, with
            // the pulls and pushes that balance best there (counting anything within a tenth of a millimetre as
            // touching), if they balance to within a ten-thousandth of the weight.
            const held = pieces(q).filter((p) => p.g > -1e-4 && p.valid);
            const { f, misfit } = share(q, held);
            if (misfit < 1e-4 * W)
                polished = { q, lambda: new Map(held.map((p, k) => [p.key, f[k]])) };
            missedBy = misfit;
        }
    }
    if (!polished)
        return {
            kind: "none",
            // Nearly balancing, it's the search that failed, not the ropes; far off, no pulls the ropes can make
            // hold the stretcher there.
            reason:
                missedBy !== null && missedBy < 0.01 * W
                    ? "The search couldn't pin down where the stretcher rests here, though it came close. Try moving a little differently."
                    : "The ropes may run too flat to hold the stretcher here. Try higher belays, or belays nearer the edge.",
        };

    const { q, lambda } = polished;
    const ps = pieces(q, new Set(lambda.keys()));
    const corners = cornersAt(s, q);
    const ropes: Rope[] = ROPES.map((r, i) => {
        const path = ropeTo(s, r, corners[i]);
        const tension = snug + (lambda.get(`rope${i}`) ?? 0);
        return {
            anchor: path.anchor,
            edgeCrossing: path.edgeCrossing,
            corner: corners[i],
            out: out[i],
            length: path.length,
            tension,
            pull: path.toward.scale(tension),
        };
    });
    const contacts: Contact[] = ps
        .filter((p) => p.kind !== "rope" && (lambda.get(p.key) ?? 0) > 1e-9 * W)
        .map((p) => ({
            surface: p.kind as Surface,
            at: p.at,
            force: p.m.scale(lambda.get(p.key)!),
        }));
    return {
        kind: "placed",
        p: {
            q,
            centre: vec3(q[0], q[1], q[2]),
            roll: q[3],
            pitch: q[4],
            yaw: q[5],
            corners,
            box: boxAt(s, q),
            ropes,
            contacts,
        },
    };

    /** The most even pulls and pushes by `held`, none negative, that balance at q; and how far from balanced. */
    function share(
        q: number[],
        held: Piece[],
    ): { f: number[]; misfit: number; wantsToPull: number } {
        const centre = vec3(q[0], q[1], q[2]);
        const rows = [0, 1, 2, 3, 4, 5];
        const scaleRow = (j: number) => (j < 3 ? 1 : 1 / L);
        // The ropes' extra pulls count a hundred times the pushes in choosing the most even, so while the stretcher
        // rests on something its ropes stay just snug.
        const weight = held.map((p) => (p.kind === "rope" ? 0.1 : 1));
        const columns = held.map((p) => generalised(p, centre).map((v, j) => v * scaleRow(j)));
        const A = rows.map((j) => columns.map((c) => c[j]));
        const b = loadsAt(s, pieces(q), q).map((v, j) => -v * scaleRow(j));
        const f = held.length
            ? nonNegativeLeastSquares(
                  A.map((row) => row.map((a, k) => a * weight[k])),
                  b,
                  1e-10,
              ).map((v, k) => v * weight[k])
            : [];
        const left = rows.map((j) => b[j] - A[j].reduce((sum, a, k) => sum + a * f[k], 0));
        const misfit = Math.max(...left.map(Math.abs));
        // Of those left doing nothing, the one whose pull (were it allowed to pull) would most help the balance.
        let wantsToPull = -1;
        let most = 0;
        held.forEach((_, k) => {
            const help = -rows.reduce((sum, j) => sum + A[j][k] * left[j], 0);
            if (f[k] === 0 && help > most) [wantsToPull, most] = [k, help];
        });
        return { f, misfit, wantsToPull };
    }

    /**
     * Newton's method on the balance with the pieces the stretcher is pressed against held at zero, adding any it
     * ends up pushed into and dropping any that would have to pull. The ropes' extra pulls and the pushes are then
     * shared out as evenly as balance allows. Null if it doesn't settle.
     */
    function polish(
        start: number[],
        everyRope = true,
    ): { q: number[]; lambda: Map<string, number> } | null {
        let q = start;
        // Start with every rope (or those within a few centimetres of taut), and everything else within a
        // centimetre of holding: what turns out not to be needed is let go.
        const active = new Set(
            pieces(q)
                .filter((p) => (p.kind === "rope" ? everyRope || p.g > -0.05 : p.g > -0.01))
                .map((p) => p.key),
        );
        // Touching, to within a micrometre: a flat stretcher across the slot's edge touches the floor and the edge
        // alike, and which of those rounding puts just clear doesn't matter.
        const touch = 1e-6;
        // Pieces found overstepped while others were held instead: these are held first.
        const first = new Set<string>();
        for (let round = 0; round < 16; round++) {
            const solved = newton(q, independent(q, [...active], first));
            if (!solved) return null;
            q = solved.q;
            if (!solved.converged) {
                // Not settling with all of these held: let go of whatever would most have to pull.
                const touching = pieces(q, active).filter((p) => active.has(p.key) && p.g > -touch);
                const { wantsToPull } = share(q, touching);
                if (wantsToPull < 0) return null;
                active.delete(touching[wantsToPull].key);
                continue;
            }
            const kept = pieces(q, active).filter((p) => active.has(p.key));
            const overstepped = kept.filter((p) => p.g > touch && !first.has(p.key));
            if (overstepped.length > 0) {
                for (const p of overstepped) first.add(p.key);
                continue;
            }
            const held = kept.filter((p) => p.g > -touch);
            // Held past where its surface ends: let it go.
            const gone = held.filter((p) => !p.valid);
            if (gone.length > 0) {
                for (const p of gone) active.delete(p.key);
                continue;
            }
            const intruding = pieces(q).filter((p) => !active.has(p.key) && p.g > touch);
            if (intruding.length > 0) {
                for (const p of intruding) active.add(p.key);
                continue;
            }
            const { f, misfit, wantsToPull } = share(q, held);
            if (misfit < 1e-7 * W) return { q, lambda: new Map(held.map((p, k) => [p.key, f[k]])) };
            // Something would have to pull: let it go.
            if (wantsToPull < 0) return null;
            active.delete(held[wantsToPull].key);
        }
        return null;
    }

    /**
     * Of the named pieces (those in `first` first, then by kind, ropes first), those whose limits on the position
     * don't repeat the ones before. Several pieces can say the same thing, such as a corner on the floor right at
     * the slot's edge, and holding them all at exactly zero at once can be impossible to rounding.
     */
    function independent(q: number[], keys: string[], first: Set<string>): string[] {
        const order = ["rope", "floor", "bottom", "lip", "wall"];
        const rank = (k: string) =>
            (first.has(k) ? 0 : order.length) + order.findIndex((o) => k.startsWith(o));
        const sorted = [...keys].sort((a, b) => rank(a) - rank(b));
        const keep = new Set(keys);
        const gaps = (x: number[]) => {
            const map = new Map(pieces(x, keep).map((p) => [p.key, p.g]));
            return sorted.map((k) => map.get(k) ?? NaN);
        };
        const J = centralDifferences(gaps, q, [1e-7, 1e-7, 1e-7, 1e-7 / L, 1e-7 / L, 1e-7 / L]);
        if (!J) return sorted;
        const basis: number[][] = [];
        const picked: string[] = [];
        sorted.forEach((key, i) => {
            const row = J[i].map((v, j) => (j < 3 ? v : v / L));
            const length = Math.hypot(...row);
            let u = row;
            for (let pass = 0; pass < 2; pass++)
                for (const b of basis) {
                    const d = u.reduce((sum, v, j) => sum + v * b[j], 0);
                    u = u.map((v, j) => v - d * b[j]);
                }
            const left = Math.hypot(...u);
            if (Number.isFinite(left) && left > 1e-4 * length) {
                basis.push(u.map((v) => v / left));
                picked.push(key);
            }
        });
        return picked;
    }

    /**
     * Newton's method (damped where it has to be, so each step brings the balance closer) on the balance with the
     * named pieces held at zero: unknowns the position and each piece's pull or push.
     */
    function newton(
        q0: number[],
        keys: string[],
    ): { q: number[]; lambda: Map<string, number>; converged: boolean } | null {
        const keep = new Set(keys);
        const scaled = (v: number[]) => v.map((x, j) => (j < 3 ? x : x / L));
        const at = (q: number[]) => {
            const all = pieces(q, keep);
            const map = new Map(all.map((p) => [p.key, p]));
            return { all, held: keys.map((k) => map.get(k)) };
        };
        const residual = (q: number[], l: number[]) => {
            const { all, held } = at(q);
            if (held.some((p) => !p)) return null;
            const centre = vec3(q[0], q[1], q[2]);
            const r = loadsAt(s, all, q);
            held.forEach((p, i) => generalised(p!, centre).forEach((v, j) => (r[j] += l[i] * v)));
            // Turning rows over the half-length, and constraint rows in newtons, so every row weighs alike.
            return [...scaled(r), ...held.map((p) => W * p!.g)];
        };
        const size = (r: number[]) => r.reduce((sum, v) => sum + v * v, 0);
        let q = [...q0];
        const first = at(q);
        if (first.held.some((p) => !p)) return null;
        const centre0 = vec3(q[0], q[1], q[2]);
        const cols = first.held.map((p) => scaled(generalised(p!, centre0)));
        const load0 = scaled(loadsAt(s, first.all, q)).map((v) => -v);
        let l =
            keys.length === 0
                ? []
                : (leastSquares(
                      [0, 1, 2, 3, 4, 5].map((j) => cols.map((c) => c[j])),
                      load0,
                      // The columns are per newton, so the damping has no units (as in the two-point solver).
                      1e-9,
                  ) ?? keys.map(() => 0));
        const steps = [1e-7, 1e-7, 1e-7, 1e-7 / L, 1e-7 / L, 1e-7 / L];
        let damping = 1e-12 * W * W;
        let r = residual(q, l);
        if (!r) return null;
        const done = (converged: boolean) => ({
            q,
            lambda: new Map(keys.map((k, i) => [k, l[i]])),
            converged,
        });
        for (let iter = 0; iter < 60; iter++) {
            if (Math.max(...r.map(Math.abs)) < 1e-9 * W) return done(true);
            // Closing in only slowly, which happens when something held should be let go: say so.
            if (iter === 15 && Math.max(...r.map(Math.abs)) > 1e-6 * W) return done(false);
            const dq = centralDifferences((x) => residual(x, l), q, steps);
            if (!dq) return null;
            const { held } = at(q);
            const centre = vec3(q[0], q[1], q[2]);
            const forces = held.map((p) => [
                ...scaled(generalised(p!, centre)),
                ...keys.map(() => 0),
            ]);
            const J = withColumns(dq, forces);
            for (;;) {
                const dx = leastSquares(
                    J,
                    r.map((v) => -v),
                    damping,
                );
                // Never more than a few centimetres (or degrees) at once.
                const move = dx
                    ? Math.max(
                          ...dx.slice(0, 3).map(Math.abs),
                          ...dx.slice(3, 6).map((v) => Math.abs(v) * L),
                      )
                    : 0;
                const k = Math.min(1, 0.05 / Math.max(move, 1e-300));
                const qn = dx ? q.map((v, j) => v + k * dx[j]) : q;
                const ln = dx ? l.map((v, i) => v + k * dx[6 + i]) : l;
                const rn = dx ? residual(qn, ln) : null;
                if (rn && size(rn) < size(r)) {
                    [q, l, r] = [qn, ln, rn];
                    damping = Math.max(damping / 10, 1e-12 * W * W);
                    break;
                }
                damping *= 100;
                if (damping > 1e4 * W * W) return null;
            }
        }
        return done(false);
    }
}

/** Where the stretcher settles at a point in the scripted lower, searching from `from` (by default, where it has it). */
export function solveAt(s: Setup, progress: number, from?: number[]): PlaceResult {
    const planned = planQ(s, planAt(s, progress));
    return settle(s, ropeOutAt(s, progress), from ?? planned, planned);
}

/** Where the lower starts: the stretcher lying on the floor beside the slot, and how much rope each belayer has out. */
export function startOf(s: Setup): { out: number[]; q: number[] } {
    const plan = planAt(s, 0);
    return { out: ropeOutFor(s, plan), q: planQ(s, plan) };
}

/**
 * How much more rope than at the start any belayer needs to pay out: enough for the stretcher, level in the slot's
 * middle, to rest on its bottom.
 */
export function payOutNeeded(s: Setup): number {
    const start = startOf(s).out;
    const bottom = ropeOutFor(s, planAt(s, STAGES.length));
    return Math.max(...bottom.map((l, i) => l - start[i]));
}

/**
 * The belayers paying out (or taking in) from where the stretcher is, `from`, until they have `out`: a few
 * centimetres at a time, each step's search starting from where the last one settled, so the stretcher follows on
 * from where it was. Where a step won't settle, it's tried again in smaller steps. Gives where it settles at each
 * step, up to the last, the first it can't settle at, or the first where `stopAfter` says to stop.
 */
export function follow(
    s: Setup,
    from: Placed,
    out: number[],
    { most = 0.02, stopAfter }: { most?: number; stopAfter?: (p: Placed) => boolean } = {},
): PlaceResult[] {
    const was = from.ropes.map((r) => r.out);
    const count = Math.max(
        1,
        Math.ceil(Math.max(...out.map((l, i) => Math.abs(l - was[i]))) / most - 1e-9),
    );
    const at = (k: number) => out.map((l, i) => was[i] + ((l - was[i]) * k) / count);
    const results: PlaceResult[] = [];
    let q = from.q;
    for (let k = 1; k <= count; k++) {
        let result = settle(s, at(k), q);
        for (let parts = 2; result.kind === "none" && parts <= 8; parts *= 2) {
            let p = q;
            for (let j = 1; j <= parts; j++) {
                result = settle(s, at(k - 1 + j / parts), p);
                if (result.kind === "none") break;
                p = result.p.q;
            }
        }
        results.push(result);
        if (result.kind === "none" || stopAfter?.(result.p)) break;
        q = result.p.q;
    }
    return results;
}

/**
 * The whole lower, sampled evenly through each stage, one point at a time: each point's search starts from the one
 * before. Where a point won't settle from there, it's tried again in smaller steps from the one before.
 */
export function* sweeping(
    s: Setup,
    perStage = 40,
): Generator<{ progress: number; result: PlaceResult }> {
    let from: number[] | undefined;
    const step = 1 / perStage;
    for (let i = 0; i <= STAGES.length * perStage; i++) {
        const progress = i * step;
        let result = solveAt(s, progress, from);
        for (let parts = 2; result.kind === "none" && from && parts <= 8; parts *= 2) {
            let q = from;
            for (let k = 1; k <= parts; k++) {
                result = solveAt(s, progress - step + (k * step) / parts, q);
                if (result.kind === "none") break;
                q = result.p.q;
            }
        }
        if (result.kind === "placed") from = result.p.q;
        yield { progress, result };
    }
}

/** The whole lower, sampled evenly through each stage. */
export const sweep = (s: Setup, perStage = 40) => [...sweeping(s, perStage)];

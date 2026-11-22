import type { RigLabel } from "@/abseil-tower/rig";
import { rod, timber, type Material, type Piece, type Strand } from "@/abseil-tower/tower";
import { vec3, type Vector3 } from "@/lib/vector3";

/**
 * A dual-hawser flying fox braked by a chain weight, set up to Scouts NSW's "Flying Fox - Operations and Construction"
 * procedure (PRO5, 2025) on a made-up site falling steadily towards the bottom end, after a table model of one. Every
 * size not in the book is an estimate.
 *
 * Scene coordinates are metres with x along the run from the top end (the launch) to the bottom end (the landing), y up
 * and z across it, the origin on the ground under the middle of the steel tower's uprights. The ground falls along x. The hawsers run either
 * side of the centre line, hawser A on the +z side and hawser B on the −z side.
 *
 * From the top: a tree the hawsers are slung round; the FFSAC steel tower (the book's Appendix E) with the launch
 * platform, the return line's pulleys and the chain brake's pulley and weight; the two hawsers over the span; the brake
 * blocks, static brakes and a timber H-frame shear leg at the bottom; and a log and picket anchor behind it, where the
 * hawsers are tensioned.
 */

/**
 * How far the ground falls between the tower and the shear leg, as a grade over the span: 5%, the gentle end of a 5–10%
 * grade. The ground is roughly level round each end, from the tree to just past the tower's guys and from just short of
 * the shear leg's guys to the log, and falls between them, steepest (`STEEPEST`) in the middle. The unloaded hawsers
 * leave the tower at about 17°: steeper than section 4.7's "conventional" 15° for the unloaded rope, which is advisory
 * and doesn't say where it's measured, but well inside the 45° and 65° maximums (Figures 18 and 19).
 */
export const GRADE = 0.05;

/** How far the dip takes the ground down at `x`: nothing outside it, easing in and out over its slopes. */
function dipAt(x: number): number {
    const { from, to, depth, ramp } = DIP;
    if (x <= from || x >= to) return 0;
    const ease = (d: number) => (depth * (1 - Math.cos((Math.PI * Math.min(d, ramp)) / ramp))) / 2;
    return ease(Math.min(x - from, to - x));
}

/**
 * How far the ground has fallen at `x`, as a fraction of the whole fall. Over the same stretch as the dip, its slope
 * eases up from level over `ramp`, holds steady, and eases back to level.
 */
function fallenAt(x: number): number {
    const { from, to, ramp } = DIP;
    // The slope's integral from the stretch's start, `u` into it (within the first ramp or beyond it).
    const rise = (u: number) =>
        u <= ramp
            ? u / 2 - (ramp / (2 * Math.PI)) * Math.sin((Math.PI * u) / ramp)
            : ramp / 2 + (u - ramp);
    const whole = to - from - ramp;
    if (x <= from) return 0;
    if (x >= to) return 1;
    return x - from <= to - x ? rise(x - from) / whole : 1 - rise(to - x) / whole;
}

/** The ground's height at `x` along the run (level across it): its fall, and the dip in the middle. */
export function groundY(x: number): number {
    return -FALL * fallenAt(x) - dipAt(x);
}

/** The span: from the tower's top cross bar to the shear leg's top spar, measured level. */
export const SPAN = 80;
/** The unloaded hawsers' sag at mid-span: the book's minimum catenary, 5% of the span. */
export const SAG = 0.05 * SPAN;
/** How far the ground falls from the tower to the shear leg. */
export const FALL = GRADE * SPAN;
/** How far each hawser is from the centre line: 1.5 m apart, to sit between the shear leg's uprights. */
export const HAWSER_Z = 0.75;
/** The hawsers' radius: 11 mm galvanised wire rope. */
const HAWSER_R = 0.0055;

/** The steel tower (Appendix E): two SHS 75 uprights and RHS 75 × 50 cross bars, braces and brake support. */
export const TOWER = {
    /** The uprights' middles, either side of the centre line. */
    half: 1.5,
    /**
     * The adjustable feet: pushed all the way in, so the 2 m extension stands on its foot plate and the 4.8 m upright on
     * it reaches 6.8 m. That puts the top bar about 6.6 m up and the platform about 4.2 m, as measured off a photo of
     * the real tower.
     */
    feet: 0,
    /** Where the 2 m extension meets the 4.8 m upright. */
    joint: 2.0,
    /** The uprights' tops. */
    top: 6.8,
    /** The top cross bar, 175 mm below the uprights' tops. */
    bar: 6.8 - 0.175,
    /** The bottom cross bar, five holes (2.5 m) below the top one, with the platform on it. */
    lower: 6.8 - 0.175 - 2.5,
    /** Where the diagonal braces meet the uprights: seven holes (3.5 m) below the top bar. */
    braceFoot: 6.8 - 0.175 - 3.5,
    shs: 0.075,
    rhs: { w: 0.05, h: 0.075 },
    barLength: 3.27,
    /**
     * The platform: 1.1 m deep, 2.5 m wide at the front, clamped to the bottom bar off to hawser A's side, as in the
     * photos, leaving the bar's other end clear for the ladder.
     */
    platform: { depth: 1.1, width: 2.5, shift: 0.4 },
};
/** The top cross bar's middle: on the uprights' front (span) faces. */
const BAR_X = TOWER.shs / 2 + TOWER.rhs.w / 2;
/** Where a hawser rests in its cradle on the top cross bar. */
export const CRADLE_Y = TOWER.bar + TOWER.rhs.h / 2 + 0.01 + HAWSER_R;

/** The H-frame shear leg at the bottom end (Figure 32): `b` between the uprights, the top spar 2B up. */
export const SHEAR_LEG = {
    x: SPAN,
    b: 1.85,
    spar: 3.7,
    top: 4.0,
    lower: 0.55,
    /** How high up its upright the diagonal brace's top is lashed. */
    braceTop: 2.7,
    /** Spars at least 125 mm, the brace at least 90 mm. */
    r: 0.0625,
    braceR: 0.045,
};
/**
 * The dip in the middle of the run, where the hawsers hang lowest: the key to a good site, as it lets them sag without
 * the riders' feet reaching the ground. A wide hollow with a flat bottom `depth` down and smooth slopes `ramp` long at
 * each end, from just past the tower's guys to just short of the shear leg's.
 */
export const DIP = {
    from: 1.6 * TOWER.top + 3,
    to: SHEAR_LEG.x - 1.6 * SHEAR_LEG.top - 0.2,
    depth: 1.5,
    ramp: 8,
};
/** The ground's steepest slope, in the middle of the fall. */
export const STEEPEST = FALL / (DIP.to - DIP.from - DIP.ramp);

/** The hessian bagging round the top spar where each hawser lies on it. */
const BAGGING_R = SHEAR_LEG.r + 0.025;
/** Where a hawser crosses the shear leg's top spar, which is on the anchor side of the uprights (Figure 33). */
const SPAR_X = SHEAR_LEG.x + 2 * SHEAR_LEG.r;
const SADDLE_Y = groundY(SHEAR_LEG.x) + SHEAR_LEG.spar + BAGGING_R + HAWSER_R;
/** The stabiliser's pulley under the middle of the top spar, on level ground (the frame's shifted onto the ground). */
const STABILISER_PULLEY = vec3(SPAR_X, SHEAR_LEG.spar - SHEAR_LEG.r - 0.08, 0);

/** The tree the hawsers are slung round, at least 2.15 times the tower's height behind it (Figure 26). */
export const TREE = { x: -23, r: 0.36, height: 9 };
/**
 * The log and picket anchor, on the level ground past the shear leg: 2.15 times the shear leg's height past it brings the
 * hawsers down to it at 25°, so it's set back as far as keeps them at 25° down to their shackles, 0.75 m in front of the
 * log, with a little to spare.
 */
export const LOG = (() => {
    const tan = Math.tan((25 * Math.PI) / 180);
    const high = SHEAR_LEG.spar + BAGGING_R - 0.12;
    const out = high / tan + 0.3;
    return { x: SHEAR_LEG.x + 2 * SHEAR_LEG.r + out + 0.75, r: 0.075, length: 2.4 };
})();

/** The dynamic brake's blocks, this far up the span from the shear leg, and the static brakes. */
export const BLOCKS_X = SPAN - 10;
/**
 * A rider on the dropper: their harness's tie-in this far below the hawser, just more than they can reach up from it
 * with their arms (so they can't grab the hawser or the trolley, section 6.10), and their feet hanging this far below
 * the harness.
 */
export const RIDER = { harness: 1.4, reach: 1.3, feet: 1.0 };
/** How far a rider's lowest point hangs below the hawser: the book's "drop" (Figure 42). */
export const DROP = RIDER.harness + RIDER.feet;
/** The static brakes: at least twice the drop from the shear leg, so a swinging rider can't reach it (Figure 42). */
export const STATIC_X = SPAN - Math.ceil(2 * DROP);

/** The ropes and lines, and their colours. */
const C = {
    hawser: "var(--tower-steel)",
    returnLine: "var(--knot-green)",
    brakeLine: "var(--knot-yellow)",
    joining: "var(--knot-blue)",
    shockCord: "var(--rig-white)",
    staticBrake: "var(--knot-red)",
    dropper: "var(--rig-maroon)",
    towerGuy: "var(--knot-orange)",
    backstay: "var(--rig-black)",
    fibre: "var(--fox-fibre)",
    hessian: "var(--fox-hessian)",
    picket: "var(--fox-picket)",
    cap: "var(--knot-yellow)",
    steel: "var(--tower-steel)",
    trolley: "var(--knot-red)",
    nylon: "var(--fox-nylon)",
    sling: "var(--knot-red)",
    tirfor: "var(--rig-black)",
    tree: "var(--tower-log)",
    spar: "var(--fox-spar)",
    grate: "var(--fox-grate)",
};

const UP = vec3(0, 1, 0);
const ACROSS = vec3(0, 0, 1);

const colored = <T extends Piece>(pieces: T[], color: string): T[] =>
    pieces.map((p) => ({ ...p, color }));

/** `pieces` moved `dy` up: what's built on level ground, put on the ground where it stands. */
function shift(pieces: Piece[], dy: number): Piece[] {
    const d = vec3(0, dy, 0);
    return pieces.map((p) =>
        p.kind === "rod"
            ? { ...p, a: p.a.add(d), b: p.b.add(d) }
            : { ...p, points: p.points.map((q) => q.add(d)) },
    );
}

/** A point `h` above the ground at `x`, `z`. */
const onGround = (x: number, h: number, z: number) => vec3(x, groundY(x) + h, z);

/** A straight round piece in a colour. */
const bar = (a: Vector3, b: Vector3, r: number, color: string, material: Material = "steel") =>
    colored(rod(a, b, r, material, 2), color);

/** A square or rectangular steel section from `a` to `b`, `h` deep as near `up` as it can be. */
const section = (a: Vector3, b: Vector3, up: Vector3, w: number, h: number, color = C.steel) =>
    colored(timber(a, b, up, w, h, "steel"), color);

/** A run of rope or wire through `points`. Long runs are cut into strands of about `piece` points, for the sort. */
function line(points: Vector3[], r: number, color: string, material: Material = "rope"): Strand[] {
    const piece = 12;
    const out: Strand[] = [];
    for (let i = 0; i < points.length - 1; i += piece) {
        const pts = points.slice(i, Math.min(points.length, i + piece + 1));
        out.push({
            kind: "strand",
            points: pts,
            r,
            material,
            color,
            capA: i === 0,
            capB: i + piece >= points.length - 1,
        });
    }
    return out;
}

/** Points along a hanging line from `a` to `b`, `sag` below the straight line between them at its middle. */
export function hanging(a: Vector3, b: Vector3, sag: number, n = 40): Vector3[] {
    return Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        return a.lerp(b, t).add(vec3(0, -4 * sag * t * (1 - t), 0));
    });
}

/** A hawser's height along the span, unloaded, at `x` (from the tower's cradle to the shear leg's saddle). */
export function hawserY(x: number): number {
    const t = (x - BAR_X) / (SPAR_X - BAR_X);
    return CRADLE_Y + (SADDLE_Y - CRADLE_Y) * t - 4 * SAG * t * (1 - t);
}

/** Where hawser `side` (+1 for A, −1 for B) is at `x` along the span. */
export const onHawser = (x: number, side: number) => vec3(x, hawserY(x), side * HAWSER_Z);

/**
 * A star picket driven at `at` (its height is above the ground there), leaning back from the pull (a level direction) by 25°, so a rope pulling at that
 * angle is square to it, 0.6 m of it out of the ground, with a yellow safety cap on its top. Returns its pieces and its
 * top.
 */
function picket(at: Vector3, away: Vector3): { pieces: Piece[]; top: Vector3; tie: Vector3 } {
    // `at` is where it's driven across the site; it stands on the ground there.
    const base = onGround(at.x, at.y, at.z);
    const lean = 25 * (Math.PI / 180);
    const dir = away
        .unit()
        .scale(Math.sin(lean))
        .add(UP.scale(Math.cos(lean)));
    const top = base.add(dir.scale(0.6));
    return {
        pieces: [
            ...bar(base.sub(dir.scale(0.05)), top, 0.016, C.picket),
            ...bar(top.sub(dir.scale(0.02)), top.add(dir.scale(0.05)), 0.026, C.cap),
        ],
        top,
        // Ropes are tied low on a picket, just above the ground.
        tie: base.add(dir.scale(0.1)),
    };
}

/** A level unit vector pointing from `a` towards `b`. */
const towards = (a: Vector3, b: Vector3) => vec3(b.x - a.x, 0, b.z - a.z).unit();

/** A guy from `from` to a picket at `at`, the picket leaning away from it. */
function guy(from: Vector3, at: Vector3, r: number, color: string): Piece[] {
    const p = picket(at, towards(from, at));
    return [...p.pieces, ...line(hanging(from, p.tie, 0.05, 12), r, color)];
}

/** A pulley's sheave at `at`, its axle along `axle`. */
const sheave = (at: Vector3, axle: Vector3, r = 0.04) =>
    bar(at.sub(axle.unit().scale(0.012)), at.add(axle.unit().scale(0.012)), r, C.steel);

/** The lashings' rope: 12 mm natural fibre. */
const LASHING_R = 0.007;

/**
 * A square lashing where a spar lies across a pole, touching it: turns of rope over the spar either side of the pole and
 * round the back of the pole above and below the spar, each turn outside the last. `pole` and `spar` are their middles
 * where they cross, `up` the pole's direction and `along` the spar's; the spar lies on the side `pole` to `spar` points.
 */
function squareLashing(
    pole: Vector3,
    poleR: number,
    spar: Vector3,
    sparR: number,
    up: Vector3,
    along: Vector3,
    turns = 4,
): Piece[] {
    const u = up.unit();
    const a = along.unit();
    const n = spar
        .sub(pole)
        .sub(u.scale(spar.sub(pole).dot(u)))
        .unit();
    const pieces: Piece[] = [];
    const rope = 2 * LASHING_R;
    for (let k = 0; k < turns; k++) {
        // Over the spar beside the pole, and round the pole clear of the spar.
        const w = poleR + LASHING_R + k * rope;
        const h = sparR + LASHING_R + k * rope;
        const over = sparR + LASHING_R;
        const round = poleR + LASHING_R;
        const at = (q: Vector3, side: number, lift: number) =>
            q.add(a.scale(side)).add(u.scale(lift));
        const loop = [
            spar.add(a.scale(-w)).add(n.scale(over)),
            at(spar, -w, over),
            at(pole, -round, h),
            pole.add(u.scale(h)).add(n.scale(-round)),
            at(pole, round, h),
            at(spar, w, over),
            spar.add(a.scale(w)).add(n.scale(over)),
            at(spar, w, -over),
            at(pole, round, -h),
            pole.add(u.scale(-h)).add(n.scale(-round)),
            at(pole, -round, -h),
            at(spar, -w, -over),
            spar.add(a.scale(-w)).add(n.scale(over)),
        ];
        pieces.push(...line(smooth(loop, 4), LASHING_R, C.fibre, "rail"));
    }
    return pieces;
}

/** A double base clamp on a wire at `at`, the wire running along `along`. */
const clamp = (at: Vector3, along: Vector3) =>
    section(at.sub(along.unit().scale(0.025)), at.add(along.unit().scale(0.025)), UP, 0.05, 0.06);

/** A ring of chain or rope `r` round at `at`, level, as points. */
const ring = (at: Vector3, r: number, n = 16) =>
    Array.from({ length: n + 1 }, (_, i) => {
        const a = (2 * Math.PI * i) / n;
        return at.add(vec3(r * Math.cos(a), 0, r * Math.sin(a)));
    });

/** The steel tower, with its platform, ladder, brake support and guys. */
function tower(): Piece[] {
    const T = TOWER;
    const pieces: Piece[] = [];
    for (const s of [-1, 1]) {
        const z = s * T.half;
        // Foot plate, the adjustable foot, the 2 m extension and the 4.8 m upright, with plates over the joint.
        pieces.push(...section(vec3(0, 0, z), vec3(0, 0.008, z), vec3(1, 0, 0), 0.3, 0.3));
        pieces.push(
            ...section(vec3(0, 0, z), vec3(0, T.feet + 0.1, z), vec3(1, 0, 0), 0.065, 0.065),
        );
        pieces.push(...section(vec3(0, T.feet, z), vec3(0, T.top, z), vec3(1, 0, 0), T.shs, T.shs));
        for (const t of [-1, 1])
            pieces.push(
                ...section(
                    vec3(0, T.joint - 0.3, z + t * (T.shs / 2 + 0.004)),
                    vec3(0, T.joint + 0.3, z + t * (T.shs / 2 + 0.004)),
                    vec3(1, 0, 0),
                    0.008,
                    0.06,
                ),
            );
    }
    // The top and bottom cross bars, on the uprights' front faces.
    for (const y of [T.bar, T.lower])
        pieces.push(
            ...section(
                vec3(BAR_X, y, -T.barLength / 2),
                vec3(BAR_X, y, T.barLength / 2),
                UP,
                T.rhs.w,
                T.rhs.h,
            ),
        );
    // The diagonal braces, in the uprights' plane, from either side of the top bar's middle down to the uprights.
    for (const s of [-1, 1])
        pieces.push(
            ...section(
                vec3(0, T.bar - 0.05, s * 0.15),
                vec3(0, T.braceFoot, s * (T.half - T.shs / 2 - 0.03)),
                vec3(1, 0, 0),
                T.rhs.w,
                T.rhs.h,
            ),
        );
    // The brake support: up the middle in front of the bars, past the top bar, with an arm out at its top carrying the
    // brake line's pulley, back and to one side, clear of the platform and the top bar.
    const postX = BAR_X + T.rhs.w;
    const postTop = vec3(postX, BRAKE.postTop, 0);
    pieces.push(
        ...section(vec3(postX, T.lower - 0.135, 0), postTop, vec3(1, 0, 0), T.rhs.w, T.rhs.h),
    );
    const armEnd = BRAKE.armEnd;
    pieces.push(...section(postTop.add(vec3(0, -0.04, 0)), armEnd, UP, 0.05, 0.05));
    pieces.push(
        ...section(
            postTop.add(vec3(0, -0.35, 0)),
            postTop.lerp(armEnd, 0.5).add(vec3(0, -0.04, 0)),
            UP,
            0.04,
            0.04,
        ),
    );
    pieces.push(...bar(armEnd, BRAKE.pulley, 0.008, C.steel));
    pieces.push(...sheave(BRAKE.pulley, BRAKE.axle, 0.05));
    // The platform: an aluminium frame on the bottom bar, its floor a grate, its front corners chained up to the top
    // bar's ends.
    const floor = T.lower + T.rhs.h / 2 + 0.05;
    const [back, front] = [TOWER.shs / 2, TOWER.shs / 2 + T.platform.depth];
    const w = T.platform.width / 2;
    // Its two ends, across the tower.
    const [lo, hi] = [-w + T.platform.shift, w + T.platform.shift];
    for (const [a, b] of [
        [vec3(back, floor - 0.025, lo), vec3(back, floor - 0.025, hi)],
        [vec3(front, floor - 0.025, lo), vec3(front, floor - 0.025, hi)],
        [vec3(back, floor - 0.025, lo), vec3(front, floor - 0.025, lo)],
        [vec3(back, floor - 0.025, hi), vec3(front, floor - 0.025, hi)],
    ])
        pieces.push(...section(a, b, UP, 0.05, 0.05));
    pieces.push({
        kind: "face",
        points: [
            vec3(back, floor, lo),
            vec3(front, floor, lo),
            vec3(front, floor, hi),
            vec3(back, floor, hi),
        ],
        material: "steel",
        color: C.grate,
        planks: 0.15,
        joints: ACROSS,
    });
    for (const s of [-1, 1])
        pieces.push(
            ...line(
                [
                    vec3(front, floor, s < 0 ? lo : hi),
                    vec3(BAR_X, T.bar - T.rhs.h / 2, s * (T.barLength / 2 - 0.05)),
                ],
                0.006,
                C.steel,
                "steel",
            ),
        );
    // A ladder up from the front, as in the photos: resting against the bottom bar's free end, between the platform and
    // the upright on hawser B's side, its rails running on past the bar to hold onto as you step across.
    const ladderZ = (lo - T.half) / 2;
    const ladderFoot = onGround(front + 1.6, 0, ladderZ);
    const rest = vec3(BAR_X + T.rhs.w / 2 + 0.025, T.lower + T.rhs.h / 2, ladderZ);
    const ladderTop = rest.add(rest.sub(ladderFoot).unit().scale(0.9));
    const rungs = Math.round(ladderFoot.distanceTo(ladderTop) / 0.3);
    for (const s of [-1, 1]) {
        const side = ACROSS.scale(s * 0.2);
        pieces.push(...bar(ladderFoot.add(side), ladderTop.add(side), 0.025, C.steel));
    }
    for (let i = 1; i < rungs; i++) {
        const c = ladderFoot.lerp(ladderTop, i / rungs);
        pieces.push(...bar(c.add(ACROSS.scale(-0.2)), c.add(ACROSS.scale(0.2)), 0.014, C.steel));
    }
    // The hawsers' cradles on the top bar: a channel either side of each hawser.
    for (const s of [-1, 1])
        for (const t of [-1, 1]) {
            const z = s * HAWSER_Z + t * 0.035;
            pieces.push(
                ...section(
                    vec3(BAR_X, TOWER.bar + TOWER.rhs.h / 2, z),
                    vec3(BAR_X, TOWER.bar + TOWER.rhs.h / 2 + 0.08, z),
                    ACROSS,
                    0.1,
                    0.006,
                ),
            );
        }
    // The return line's pulleys, hung under the top bar between the cradles and the uprights.
    for (const s of [-1, 1]) {
        const at = RETURN_PULLEY(s);
        pieces.push(
            ...bar(
                vec3(BAR_X, T.bar - T.rhs.h / 2, at.z),
                at.add(vec3(0, 0.04, 0)),
                0.006,
                C.steel,
            ),
        );
        pieces.push(...sheave(at, UP, 0.045));
    }
    // Guys: one from each upright's top out to the front and one to the back, at 45° and 1.6 times the tower's height
    // out each way (Figure 40), and the backstay from the top bar's middle back to the tree.
    const out = 1.6 * T.top;
    for (const s of [-1, 1])
        for (const f of [-1, 1]) {
            const from = vec3(0, T.top - 0.05, s * T.half);
            pieces.push(...guy(from, vec3(f * out, 0, s * (T.half + out)), 0.006, C.towerGuy));
        }
    pieces.push(
        ...line(hanging(vec3(BAR_X, T.bar, 0), BACKSTAY_TIE, 0.08, 20), 0.0065, C.backstay),
    );
    return pieces;
}

/** The return line's pulley on side `s` (+1 for hawser A's side), under the top bar. */
const RETURN_PULLEY = (s: number) => vec3(BAR_X + 0.06, TOWER.bar - 0.18, s * 1.1);

/** The chain brake: the brake support's top and arm, its pulley, and the chain weight hanging below it. */
export const BRAKE = (() => {
    const postTop = TOWER.bar + 0.615;
    const postX = BAR_X + TOWER.rhs.w;
    const out = vec3(-1, 0, 1).unit().scale(0.6);
    const armEnd = vec3(postX, postTop - 0.02, 0).add(out);
    const pulley = armEnd.add(vec3(0, -0.12, 0));
    return {
        postTop,
        armEnd,
        pulley,
        axle: vec3(out.z, 0, -out.x),
        /** Where the brake line ends and the chain starts, the first of it just off the ground. */
        chainTop: onGround(pulley.x - 0.05, 1.1, pulley.z),
    };
})();

/** The tree, its bagging, and the two slings round it the hawsers are shackled to. */
function tree(): Piece[] {
    const c = vec3(TREE.x, 0, 0);
    const pieces: Piece[] = [];
    pieces.push(
        ...bar(c.add(vec3(0, -0.2, 0)), c.add(vec3(0, TREE.height, 0)), TREE.r, C.tree, "log"),
    );
    for (const [y, dir, r, len] of [
        [5.5, vec3(1, 0.9, 0.4), 0.16, 4],
        [6.5, vec3(-0.8, 1, -0.6), 0.14, 3.5],
        [7.6, vec3(0.3, 1, -1), 0.12, 3],
    ] as const)
        pieces.push(
            ...bar(
                c.add(vec3(0, y, 0)),
                c.add(vec3(0, y, 0)).add(dir.unit().scale(len)),
                r,
                C.tree,
                "log",
            ),
        );
    // A round sling choked round the trunk for each hawser, the choke drawn round to the hawser's own side of the
    // tree, so the two lead off either side of it.
    for (const s of [-1, 1]) {
        const y = TREE_SLING_Y(s);
        // Built on level ground, and put on the ground at the tree at the end.
        const shackle = TREE_SHACKLE(s).add(vec3(0, -groundY(TREE.x), 0));
        const choke = s * CHOKE;
        const rr = TREE.r + 0.02;
        const around = Array.from({ length: 25 }, (_, i) => {
            const a = choke + s * 2 * Math.PI * (i / 24);
            return vec3(TREE.x + rr * Math.cos(a), y, rr * Math.sin(a));
        });
        // Round the trunk from the choke and back to it, then out through itself to the shackle.
        pieces.push(...line([...around, shackle], 0.016, C.sling, "sling"));
        pieces.push(...bar(shackle, shackle.add(vec3(0.07, 0, 0)), 0.014, C.steel));
    }
    // The backstay's own sling, basketed round the trunk just above the others, to a carabiner in front.
    const tie = BACKSTAY_TIE.add(vec3(0, -groundY(TREE.x), 0));
    const rr = TREE.r + 0.02;
    const basket = Array.from({ length: 13 }, (_, i) => {
        const a = Math.PI / 4 + ((3 * Math.PI) / 2) * (i / 12);
        return vec3(TREE.x + rr * Math.cos(a), BACKSTAY_SLING_Y, rr * Math.sin(a));
    });
    pieces.push(...line([tie, ...basket, tie], 0.016, C.sling, "sling"));
    pieces.push(...bar(tie.add(vec3(-0.03, 0, 0)), tie.add(vec3(0.05, 0, 0)), 0.012, C.steel));
    return shift(pieces, groundY(TREE.x));
}

/** How high on the trunk the backstay's own sling is, just above the hawsers'. */
const BACKSTAY_SLING_Y = 0.7;
/** Where the backstay's tied to its sling: a carabiner out in front of the tree, on the centre line. */
const BACKSTAY_TIE = vec3(TREE.x + TREE.r + 0.4, groundY(TREE.x) + BACKSTAY_SLING_Y, 0);

/** How far round the trunk each sling's choke is drawn from the front (radians), towards its hawser's side. */
const CHOKE = (70 * Math.PI) / 180;
/** How high on the trunk each sling is choked. */
const TREE_SLING_Y = (s: number) => (s > 0 ? 0.5 : 0.35);
/** Where hawser `s`'s eye is shackled to its sling round the tree: out from the choke on its own side. */
export const TREE_SHACKLE = (s: number) => {
    const rr = TREE.r + 0.02;
    const choke = vec3(TREE.x + rr * Math.cos(CHOKE), 0, s * rr * Math.sin(CHOKE));
    return choke.add(vec3(0.45, groundY(TREE.x) + TREE_SLING_Y(s), s * 0.1));
};

/** The H-frame shear leg at the bottom end, its lashings, bagging and guys. */
function shearLeg(): Piece[] {
    const L = SHEAR_LEG;
    const pieces: Piece[] = [];
    const half = L.b / 2;
    for (const s of [-1, 1])
        pieces.push(
            ...bar(vec3(L.x, -0.05, s * half), vec3(L.x, L.top, s * half), L.r, C.spar, "log"),
        );
    const sparX = L.x + 2 * L.r;
    // The top spar on the anchor side of the uprights, so the hawsers push it onto them; the bottom one there too.
    pieces.push(
        ...bar(
            vec3(sparX, L.spar, -half - 0.4),
            vec3(sparX, L.spar, half + 0.4),
            L.r,
            C.spar,
            "log",
        ),
    );
    pieces.push(
        ...bar(
            vec3(sparX, L.lower, -half - 0.3),
            vec3(sparX, L.lower, half + 0.3),
            L.r,
            C.spar,
            "log",
        ),
    );
    // The diagonal brace, outermost as in the photo: from near the ground beside one upright, over the bottom spar,
    // up to the other upright two thirds of the way up, lying against it.
    const braceFoot = vec3(sparX + L.r + L.braceR, 0.15, -half + 0.25);
    const braceHead = vec3(L.x + L.r + L.braceR, L.braceTop, half);
    const braceDir = braceHead.sub(braceFoot).unit();
    pieces.push(
        ...bar(
            braceFoot.sub(braceDir.scale(0.1)),
            braceHead.add(braceDir.scale(0.15)),
            L.braceR,
            C.spar,
            "log",
        ),
    );
    // Lashed to the upright at its head, and to the bottom spar where it crosses it.
    pieces.push(
        ...squareLashing(vec3(L.x, L.braceTop, half), L.r, braceHead, L.braceR, UP, braceDir, 3),
    );
    const cross = braceFoot.lerp(braceHead, (L.lower - braceFoot.y) / (braceHead.y - braceFoot.y));
    pieces.push(
        ...squareLashing(vec3(sparX, L.lower, cross.z), L.r, cross, L.braceR, ACROSS, braceDir, 3),
    );
    // The stabiliser's pulley, hung under the middle of the top spar.
    pieces.push(...bar(vec3(sparX, L.spar - L.r, 0), STABILISER_PULLEY, 0.008, C.steel));
    pieces.push(...sheave(STABILISER_PULLEY, ACROSS, 0.045));
    // Square lashings where the spars cross the uprights (prusik-started at the top spar).
    for (const s of [-1, 1]) {
        for (const y of [L.spar, L.lower])
            pieces.push(
                ...squareLashing(
                    vec3(L.x, y, s * half),
                    L.r,
                    vec3(sparX, y, s * half),
                    L.r,
                    UP,
                    ACROSS,
                ),
            );
    }
    // Hessian bagging on the top spar where each hawser lies.
    for (const s of [-1, 1])
        pieces.push(
            ...bar(
                vec3(sparX, L.spar, s * HAWSER_Z - 0.11),
                vec3(sparX, L.spar, s * HAWSER_Z + 0.11),
                BAGGING_R,
                C.hessian,
                "sling",
            ),
        );
    // The frame's built on level ground; it stands on the ground at its uprights.
    const g = groundY(L.x);
    const frame = shift(pieces, g);
    // A star picket at each upright's heel, on the anchor side, so it can't kick out.
    for (const s of [-1, 1])
        frame.push(...picket(vec3(L.x + L.r + 0.05, 0, s * (half - 0.12)), vec3(1, 0, 0)).pieces);
    // Guys from each upright's top, at 45° out to the front and back, 1.6 times its height each way (Figure 34).
    const out = 1.6 * L.top;
    for (const s of [-1, 1])
        for (const f of [-1, 1]) {
            const from = vec3(L.x, g + L.top - 0.1, s * half);
            frame.push(...guy(from, vec3(L.x + f * out, 0, s * (half + out)), 0.006, C.fibre));
        }
    return frame;
}

/** Where a hawser comes down from the shear leg to the anchor: from the saddle to the bow shackle on its sling. */
export const SADDLE = (s: number) => vec3(SPAR_X, SADDLE_Y, s * HAWSER_Z);
/** Where each sling round the log is shackled, out in front of it towards the shear leg. */
export const SLING_Z = 0.8;
export const ANCHOR_SHACKLE = (z: number) => onGround(LOG.x - 0.75, 0.12, z);

/** The log and picket anchor: the log, two rows of six pickets with banjo lashings, and three slings round it. */
function logAnchor(): Piece[] {
    const pieces: Piece[] = [];
    const y = groundY(LOG.x) + LOG.r * 0.6;
    pieces.push(
        ...bar(
            vec3(LOG.x, y, -LOG.length / 2),
            vec3(LOG.x, y, LOG.length / 2),
            LOG.r,
            C.tree,
            "log",
        ),
    );
    const back = vec3(1, 0, 0);
    for (const z of [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0]) {
        // The front row just on the pull's side of the log, the back row 0.6 m behind it.
        const front = picket(vec3(LOG.x - LOG.r - 0.02, 0, z), back);
        const rear = picket(vec3(LOG.x + 0.6, 0, z), back);
        pieces.push(...front.pieces, ...rear.pieces);
        // A banjo lashing from the front picket's top to the back one's foot.
        for (const dz of [-0.012, 0.012])
            pieces.push(
                ...line(
                    [front.top.add(vec3(0, -0.04, dz)), rear.tie.add(vec3(0, -0.04, dz))],
                    0.006,
                    C.fibre,
                    "sling",
                ),
            );
    }
    // Round slings basketed round the log between the pickets: one for each hawser and one for the Tirfor.
    for (const z of [-SLING_Z, 0, SLING_Z]) {
        const shackle = ANCHOR_SHACKLE(z);
        const wrap = Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI / 2 - Math.PI * (i / 8);
            return vec3(LOG.x + (LOG.r + 0.02) * Math.cos(a), y + (LOG.r + 0.02) * Math.sin(a), z);
        });
        for (const dz of [-0.06, 0.06])
            pieces.push(
                ...line(
                    [
                        shackle,
                        ...wrap.map((q) => q.add(vec3(0, 0, dz))),
                        shackle.add(vec3(0, -0.02, 0)),
                    ],
                    0.018,
                    C.sling,
                    "sling",
                ),
            );
    }
    return pieces;
}

/**
 * The in-line hardware from a sling's bow shackle up the hawser, by distance along it (Figure 66): the bow shackle, the
 * turnbuckle, three D shackles, then the hawser's in-line eye round its thimble, held by three double base clamps,
 * its tail running on past them and lying on the ground.
 */
const HARDWARE = {
    shackle: 0.1,
    turnbuckle: 0.65,
    dShackles: 0.92,
    eye: 1.02,
    clamps: [1.12, 1.3, 1.48],
};

/** A hawser's bottom end: from the saddle down to its hardware at the anchor, with its tail. */
function hawserFoot(s: number): Piece[] {
    const pieces: Piece[] = [];
    const a = ANCHOR_SHACKLE(s * SLING_Z);
    const saddle = SADDLE(s);
    const along = saddle.sub(a).unit();
    const at = (d: number) => a.add(along.scale(d));
    const H = HARDWARE;
    pieces.push(...bar(at(0), at(H.shackle), 0.016, C.steel));
    pieces.push(...bar(at(H.shackle), at(H.turnbuckle), 0.022, C.steel));
    pieces.push(...bar(at(H.turnbuckle), at(H.dShackles), 0.013, C.steel));
    pieces.push(...bar(at(H.dShackles), at(H.eye), 0.02, C.steel));
    // The live hawser from the eye up to the saddle, and the dead end beside it through the clamps, then its tail.
    const side = ACROSS.scale(0.016 * s);
    pieces.push(...line([at(H.eye), saddle], HAWSER_R, C.hawser, "steel"));
    for (const d of H.clamps) pieces.push(...clamp(at(d).add(side.scale(0.5)), along));
    const tailStart = at(H.clamps[2] + 0.12).add(side);
    const tail = [
        at(H.eye).add(side),
        tailStart,
        tailStart.add(along.scale(0.4)).add(vec3(0, -0.3, s * 0.15)),
        onGround(tailStart.x - 0.2, 0.02, s * 1.6),
        onGround(LOG.x - 0.6, 0.02, s * 2.2),
        onGround(LOG.x + 0.2, 0.02, s * 1.7),
        onGround(LOG.x - 0.4, 0.02, s * 1.3),
    ];
    pieces.push(...line(smooth(tail, 6), HAWSER_R, C.hawser, "steel"));
    return pieces;
}

/** The lizard on hawser A, left slack in line to the Tirfor as a back-up once the hardware takes the load. */
export const LIZARD = { clamps: [2.9, 3.05, 3.2] };
function lizardAndTirfor(): Piece[] {
    const pieces: Piece[] = [];
    const a = ANCHOR_SHACKLE(SLING_Z);
    const along = SADDLE(1).sub(a).unit();
    const on = (d: number) => a.add(along.scale(d));
    const side = vec3(0, -0.016, -0.012);
    for (const d of LIZARD.clamps) pieces.push(...clamp(on(d).add(side.scale(0.5)), along));
    // The Tirfor, hooked to the middle sling, its cable out to the lizard.
    const hook = ANCHOR_SHACKLE(0);
    const dir = on(LIZARD.clamps[0]).sub(hook).unit();
    const body = [hook.add(dir.scale(0.15)), hook.add(dir.scale(0.75))];
    pieces.push(...bar(hook, body[0], 0.012, C.steel));
    pieces.push(...section(body[0], body[1], UP, 0.12, 0.26, C.tirfor));
    // The handle, standing up from it.
    const mid = body[0].lerp(body[1], 0.5);
    pieces.push(...bar(mid.add(vec3(0, 0.13, 0)), mid.add(vec3(-0.15, 0.6, 0.05)), 0.014, C.steel));
    // The lizard: a length of wire from the Tirfor to the clamps, slack, then along the hawser through them.
    const start = body[1].add(dir.scale(0.05));
    const reach = on(LIZARD.clamps[0] - 0.12).add(side);
    pieces.push(...line(hanging(start, reach, 0.12, 16), 0.004, C.hawser, "steel"));
    pieces.push(...line([reach, on(LIZARD.clamps[2] + 0.12).add(side)], 0.004, C.hawser, "steel"));
    return pieces;
}

/** A smooth path through `pts`, `n` points between each pair (Catmull–Rom). */
function smooth(pts: Vector3[], n: number): Vector3[] {
    const out: Vector3[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
        const [p0, p1, p2, p3] = [
            pts[Math.max(0, i - 1)],
            pts[i],
            pts[i + 1],
            pts[Math.min(pts.length - 1, i + 2)],
        ];
        for (let k = 0; k < n; k++) {
            const t = k / n;
            const t2 = t * t;
            const t3 = t2 * t;
            out.push(
                p0
                    .scale(-0.5 * t3 + t2 - 0.5 * t)
                    .add(p1.scale(1.5 * t3 - 2.5 * t2 + 1))
                    .add(p2.scale(-1.5 * t3 + 2 * t2 + 0.5 * t))
                    .add(p3.scale(0.5 * t3 - 0.5 * t2)),
            );
        }
    }
    out.push(pts.at(-1)!);
    return out;
}

/** Each hawser from its tree shackle over the tower's cradle and down the span to the shear leg's saddle. */
function hawsers(): Piece[] {
    const pieces: Piece[] = [];
    for (const s of [-1, 1]) {
        const shackle = TREE_SHACKLE(s);
        const cradle = vec3(BAR_X, CRADLE_Y, s * HAWSER_Z);
        // The eye at the tree: round its thimble, the dead end beside it through three clamps.
        const back = cradle.sub(shackle).unit();
        const eye = shackle.add(back.scale(0.12));
        const side = ACROSS.scale(0.016);
        pieces.push(...line([eye, cradle], HAWSER_R, C.hawser, "steel"));
        pieces.push(
            ...line(
                [eye.add(side), eye.add(side).add(back.scale(0.65))],
                HAWSER_R,
                C.hawser,
                "steel",
            ),
        );
        for (const d of [0.2, 0.38, 0.56])
            pieces.push(...clamp(eye.add(back.scale(d)).add(side.scale(0.5)), back));
        pieces.push(...bar(shackle.add(vec3(0.07, 0, 0)), eye, 0.018, C.steel));
        const span = Array.from({ length: 61 }, (_, i) =>
            onHawser(BAR_X + ((SPAR_X - BAR_X) * i) / 60, s),
        );
        pieces.push(...line(span, HAWSER_R, C.hawser, "steel"));
        pieces.push(...hawserFoot(s));
    }
    return pieces;
}

/** A trolley on hawser `s` at `x`, with its dropper: where its tow points are, back (uphill) and front. */
function trolley(x: number, s: number): { pieces: Piece[]; back: Vector3 } {
    const at = onHawser(x, s);
    const ahead = onHawser(x + 0.1, s)
        .sub(onHawser(x - 0.1, s))
        .unit();
    // Square to the wire and down, in the plane of the span.
    const down = ahead.cross(ACROSS).unit();
    const plate = (k: number) => at.add(down.scale(0.06 * k));
    const pieces: Piece[] = [];
    // Two sheaves riding on the wire, and the side plates hanging below them.
    for (const d of [-0.07, 0.07])
        pieces.push(...sheave(at.add(ahead.scale(d)).add(vec3(0, 0.02, 0)), ACROSS, 0.03));
    for (const dz of [-0.022, 0.022])
        pieces.push(
            ...section(
                plate(1).add(ahead.scale(-0.12)).add(ACROSS.scale(dz)),
                plate(1).add(ahead.scale(0.12)).add(ACROSS.scale(dz)),
                UP,
                0.006,
                0.14,
                C.trolley,
            ),
        );
    // The dropper: the rider's rope down to the descender, its running end hanging on below, and the back-up line.
    const hang = plate(2.2);
    // The descender sits just above the harness's tie-in, the rider's drop below the hawser.
    const rig = at.add(vec3(0, -(RIDER.harness - 0.16), 0));
    pieces.push(...line([hang, rig], 0.0055, C.dropper));
    pieces.push(
        ...section(rig, rig.add(vec3(0, -0.16, 0)), vec3(1, 0, 0), 0.03, 0.07, "var(--rig-black)"),
    );
    pieces.push(
        ...line(
            smooth(
                [
                    rig.add(vec3(0.02, -0.16, 0)),
                    rig.add(vec3(0.05, -0.6, 0.03)),
                    rig.add(vec3(0.02, -1.0, 0.0)),
                ],
                4,
            ),
            0.0055,
            C.dropper,
        ),
    );
    pieces.push(
        ...line(
            hanging(hang.add(vec3(0.04, 0, 0)), rig.add(vec3(0.06, -0.2, 0)), -0.05, 8),
            0.0055,
            C.dropper,
        ),
    );
    return { pieces, back: at.add(ahead.scale(-0.13)).add(down.scale(0.04)) };
}

/** Where the trolleys sit: A at the launch, just out from the platform, and B at the bottom against its brake block. */
export const TROLLEY_X = { a: 1.4, b: BLOCKS_X - 0.15 };

/** The trolleys and the return line joining them over the tower's pulleys. */
function trolleysAndReturn(): Piece[] {
    const a = trolley(TROLLEY_X.a, 1);
    const b = trolley(TROLLEY_X.b, -1);
    const [pa, pb] = [RETURN_PULLEY(1), RETURN_PULLEY(-1)];
    const over = (p: Vector3) => p.add(vec3(0, 0.045, 0));
    return [
        ...a.pieces,
        ...b.pieces,
        ...line([a.back, over(pa)], 0.004, C.returnLine),
        ...line([over(pa), over(pb)], 0.004, C.returnLine),
        // Out to trolley B, sagging under its own weight below hawser B.
        ...line(hanging(over(pb), b.back, 2.2, 60), 0.004, C.returnLine),
    ];
}

/**
 * The dynamic brake: a nylon block on each hawser, joined by a rope with its middle tied to the brake line, which runs
 * back up the span to the tower's pulley and down to the chain; and the stabiliser, a shock cord from the same middle
 * back to the shear leg's bottom spar, holding the chain's first links just off the ground.
 */
function dynamicBrake(): Piece[] {
    const pieces: Piece[] = [];
    const eyes: Vector3[] = [];
    for (const s of [-1, 1]) {
        const at = onHawser(BLOCKS_X, s);
        const along = onHawser(BLOCKS_X + 0.1, s)
            .sub(onHawser(BLOCKS_X - 0.1, s))
            .unit();
        pieces.push(
            ...section(at.sub(along.scale(0.05)), at.add(along.scale(0.05)), UP, 0.1, 0.1, C.nylon),
        );
        // Eye bolts either side, below the hawser.
        for (const t of [-1, 1]) {
            const eye = at.add(vec3(0, -0.03, t * 0.08));
            pieces.push(...bar(eye, eye.add(vec3(0, 0, t * 0.03)), 0.012, C.steel));
            if (t === -s) eyes.push(eye.add(vec3(0, 0, t * 0.03)));
        }
    }
    // The joining rope: 2.5 m with its knots tied, its middle drawn up the span by the brake line.
    const half = 1.25;
    const across = eyes[0].distanceTo(eyes[1]) / 2;
    const apex = eyes[0]
        .lerp(eyes[1], 0.5)
        .add(vec3(-Math.sqrt(half * half - across * across), -0.05, 0));
    for (const e of eyes) pieces.push(...line(hanging(e, apex, 0.03, 8), 0.004, C.joining));
    pieces.push(...bar(apex.add(vec3(-0.04, 0, 0)), apex.add(vec3(0.04, 0, 0)), 0.012, C.steel));
    // The brake line, back up the span to the pulley and straight down to the chain.
    const p = BRAKE.pulley;
    const toward = towards(p, apex);
    const top = p.add(vec3(0, 0.05, 0)).add(toward.scale(0.01));
    const off = p.add(toward.scale(-0.05));
    pieces.push(...line(hanging(apex.add(vec3(-0.04, 0, 0)), top, 0.4, 50), 0.004, C.brakeLine));
    pieces.push(...line([top, off, BRAKE.chainTop], 0.004, C.brakeLine));
    // The stabiliser: shock cord, stretched, from the joining rope's middle to the pulley under the shear leg's top spar
    // and down from it, tied off to the bottom spar with natural fibre rope.
    const g = groundY(SHEAR_LEG.x);
    const pulley = STABILISER_PULLEY.add(vec3(0, g, 0));
    const r = 0.045;
    const into = pulley.add(vec3(-r, 0.01, 0));
    const down = pulley.add(vec3(r * 0.2, -r, 0));
    const tie = vec3(SPAR_X, g + SHEAR_LEG.lower + SHEAR_LEG.r + 0.35, 0);
    const spar = vec3(SPAR_X, g + SHEAR_LEG.lower + SHEAR_LEG.r, 0);
    pieces.push(...line([apex.add(vec3(0.04, 0, 0)), into], 0.005, C.shockCord));
    pieces.push(...line([into, pulley.add(vec3(0, r, 0)), down, tie], 0.005, C.shockCord));
    pieces.push(...line([tie, spar], 0.006, C.fibre, "rail"));
    return pieces;
}

/** The chain weight: hanging from the brake line's end, then piled on the ground, its end tied off to a picket. */
function chainWeight(): Piece[] {
    const pieces: Piece[] = [];
    const top = BRAKE.chainTop;
    const foot = onGround(top.x, 0.2, top.z);
    pieces.push(...bar(top.add(vec3(0, 0.03, 0)), top.add(vec3(0, -0.03, 0)), 0.014, C.steel));
    pieces.push(...line([top, foot], 0.012, C.steel, "steel"));
    // The pile: rings of chain, smaller towards the top.
    for (const [y, r] of [
        [0.03, 0.32],
        [0.08, 0.27],
        [0.13, 0.2],
        [0.18, 0.12],
    ])
        pieces.push(...line(ring(onGround(top.x, y, top.z), r, 18), 0.014, C.steel, "steel"));
    const pk = picket(
        vec3(top.x - 0.9, 0, top.z + 0.6),
        towards(foot, vec3(top.x - 0.9, 0, top.z + 0.6)),
    );
    pieces.push(
        ...pk.pieces,
        ...line([onGround(top.x - 0.25, 0.03, top.z + 0.15), pk.tie], 0.012, C.steel, "steel"),
    );
    return pieces;
}

/** The static brakes: a shackle on each hawser, with a rope out to a picket 2.5 m to its side (Figure 55). */
function staticBrakes(): Piece[] {
    const pieces: Piece[] = [];
    for (const s of [-1, 1]) {
        const at = onHawser(STATIC_X, s);
        const shackle = at.add(vec3(0, -0.05, 0));
        pieces.push(...bar(at.add(vec3(0, 0.02, 0)), shackle, 0.012, C.steel));
        const base = vec3(STATIC_X, 0, s * (HAWSER_Z + 2.5));
        const pk = picket(base, towards(shackle, base));
        pieces.push(...pk.pieces, ...line([shackle, pk.tie], 0.0055, C.staticBrake));
    }
    return pieces;
}

/** The whole flying fox, as pieces to draw. */
export function foxPieces(): Piece[] {
    return [
        ...tree(),
        ...tower(),
        ...hawsers(),
        ...trolleysAndReturn(),
        ...dynamicBrake(),
        ...chainWeight(),
        ...staticBrakes(),
        ...shearLeg(),
        ...logAnchor(),
        ...lizardAndTirfor(),
    ];
}

/** What the drawings name, written beside it in the flat views. */
export function foxLabels(): RigLabel[] {
    const floor = TOWER.lower + TOWER.rhs.h / 2 + 0.05;
    return [
        { text: "Tree anchor", at: onGround(TREE.x, 1.2, 0), side: "left" },
        { text: "Steel tower", at: vec3(0, TOWER.top, TOWER.half), side: "left" },
        { text: "Launch platform", at: vec3(0.6, floor, TOWER.platform.shift), side: "right" },
        { text: "Brake pulley", at: BRAKE.pulley, side: "left" },
        {
            text: "Chain weight",
            at: onGround(BRAKE.chainTop.x, 0.3, BRAKE.chainTop.z),
            side: "left",
        },
        { text: "Trolley A", at: onHawser(TROLLEY_X.a, 1), side: "right" },
        { text: "Trolley B", at: onHawser(TROLLEY_X.b, -1), side: "left" },
        { text: "Brake blocks", at: onHawser(BLOCKS_X, -1), side: "right" },
        { text: "Static brakes", at: onHawser(STATIC_X, -1).add(vec3(0, -0.05, 0)), side: "right" },
        { text: "H-frame shear leg", at: onGround(SHEAR_LEG.x, SHEAR_LEG.top, 0), side: "right" },
        { text: "Turnbuckle", at: ANCHOR_SHACKLE(-SLING_Z).lerp(SADDLE(-1), 0.04), side: "right" },
        {
            text: "Lizard",
            at: ANCHOR_SHACKLE(SLING_Z).add(
                SADDLE(1).sub(ANCHOR_SHACKLE(SLING_Z)).unit().scale(3.05),
            ),
            side: "left",
        },
        { text: "Tirfor", at: ANCHOR_SHACKLE(0).add(vec3(-0.4, 0.15, 0)), side: "left" },
        { text: "Log and picket anchor", at: onGround(LOG.x + 0.3, 0.3, 0), side: "right" },
    ];
}

/** The legend's lines: each rope or wire by its colour, and what it is. */
export function foxLegend(): { name: string; color: string; look: "tape" | "rope" }[] {
    return [
        { name: "Hawsers (11 mm galvanised wire)", color: C.hawser, look: "rope" },
        { name: "Return line", color: C.returnLine, look: "rope" },
        { name: "Brake line", color: C.brakeLine, look: "rope" },
        { name: "Joining rope", color: C.joining, look: "rope" },
        { name: "Stabiliser (shock cord)", color: C.shockCord, look: "rope" },
        { name: "Static brakes", color: C.staticBrake, look: "rope" },
        { name: "Droppers", color: C.dropper, look: "rope" },
        { name: "Tower guys", color: C.towerGuy, look: "rope" },
        { name: "Tower backstay", color: C.backstay, look: "rope" },
        { name: "Guys and lashings (natural fibre)", color: C.fibre, look: "rope" },
        { name: "Round slings", color: C.sling, look: "tape" },
    ];
}

/** The ground: the whole site, from behind the tree to past the anchor and out past the guys. */
export const GROUND = { x0: TREE.x - 6, x1: LOG.x + 6, z: 15 };

/** How many shades the ground's patches come in, from grass to dry ground. */
const GROUND_SHADES = 6;

/** A ground shade's colour: grass mixed with dry ground, more of it the higher `k`. */
export const groundShade = (k: number) =>
    `color-mix(in oklab, var(--fox-ground-dry) ${Math.round((100 * k) / (GROUND_SHADES - 1))}%, var(--fox-ground))`;

/**
 * How dry the ground is at `x`, `z`, from 0 (grass) to 1 (bare): a few waves at odd angles added up, so it comes in
 * irregular patches a few metres across. It's the same every time, so the drawing doesn't change from one load to the
 * next.
 */
function dryness(x: number, z: number): number {
    const waves: [number, number, number, number][] = [
        [0.31, 0.17, 0.0, 1.0],
        [-0.13, 0.41, 1.7, 0.7],
        [0.52, -0.29, 4.1, 0.5],
        [0.07, 0.73, 2.9, 0.35],
        [0.89, 0.21, 0.6, 0.3],
    ];
    const total = waves.reduce((sum, wave) => sum + wave[3], 0);
    const v = waves.reduce(
        (sum, [kx, kz, phase, a]) => sum + a * Math.sin(kx * x + kz * z + phase),
        0,
    );
    return 0.5 + 0.5 * (v / total);
}

/**
 * The ground as faces: tiles 2 m square following its fall and dip, each one of a few shades from grass to dry ground,
 * so it isn't one flat colour.
 */
export function groundFaces(): Piece[] {
    const nx = Math.ceil((GROUND.x1 - GROUND.x0) / 2);
    const nz = Math.ceil((2 * GROUND.z) / 2);
    const xAt = (i: number) => GROUND.x0 + ((GROUND.x1 - GROUND.x0) * i) / nx;
    const zAt = (j: number) => -GROUND.z + (2 * GROUND.z * j) / nz;
    const faces: Piece[] = [];
    for (let i = 0; i < nx; i++)
        for (let j = 0; j < nz; j++) {
            const [a, b] = [xAt(i), xAt(i + 1)];
            const [c, d] = [zAt(j), zAt(j + 1)];
            const dry = dryness((a + b) / 2, (c + d) / 2);
            const k = Math.min(GROUND_SHADES - 1, Math.floor(dry * GROUND_SHADES));
            faces.push({
                kind: "face",
                points: [
                    vec3(a, groundY(a), c),
                    vec3(b, groundY(b), c),
                    vec3(b, groundY(b), d),
                    vec3(a, groundY(a), d),
                ],
                material: "deck",
                color: groundShade(k),
            });
        }
    return faces;
}

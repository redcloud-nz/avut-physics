import { TAPE, type RigLabel } from "@/abseil-tower/rig";
import {
    rod,
    tapeLayers,
    timber,
    type Material,
    type Piece,
    type Strand,
} from "@/abseil-tower/tower";
import { knot3dFile } from "@/knot-editor-3d/knot-file";
import { G } from "@/lib/constants";
import { convexHull } from "@/lib/hull";
import { clamp } from "@/lib/math";
import { arcLengths as ropeArcLengths } from "@/lib/rope-3d/rope";
import { Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import { CHAIN_WEIGHT, chainWeight, chainWeightPieces, type ChainWeight } from "./chain-weight";
import {
    ANCHOR_HOOK,
    baseClamp,
    baseClampWire,
    CABLE_HOOK,
    carabiner,
    CARABINER_R,
    CARABINER_WIDTH,
    chain,
    CHAIN_G80_6,
    EYE_BOLT,
    EYE_BOLT_M16,
    eyeBolt,
    eyeFrame,
    grigri,
    hook,
    M12,
    M16,
    plate,
    pulley,
    shackle,
    SHACKLE_6,
    SHACKLE_19,
    STOP_BLOCK,
    stopBlock,
    thimble,
    THIMBLE_11,
    throughBolt,
    tiedRound,
    tirfor,
    turnbuckle,
    wrap,
    zipTrolley,
    type Frame,
} from "./hardware";
import { hang, heightAt, lengthForSag, WIRE_EA, WIRE_WEIGHT, type Shape } from "./hawser";
import FIGURE_8_BIG_LOOP_JSON from "./knots/figure-8-big-loop.json";
import FIGURE_8_SINGLE_JSON from "./knots/figure-8-single.json";
import FIGURE_8_JSON from "./knots/figure-8.json";

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
 * How far the ground falls between the tower and the shear leg, as a grade over the span: 2°, a gentle site, so riders
 * reach the brake slowly enough for a chain weight within the book's limits to stop them. The unloaded hawsers leave the
 * tower inside section 4.7's "conventional" 15°, and well inside the 45° and 65° maximums (Figures 18 and 19).
 */
export const GRADE = Math.tan((2 * Math.PI) / 180);

/**
 * The lie of the land without the hollow: level round the tower and back to the tree, level round the shear leg and
 * back to the log, and falling smoothly between their guys.
 */
function natural(x: number): number {
    const from = 1.6 * TOWER.top;
    const to = SHEAR_LEG.x - 1.6 * SHEAR_LEG.top;
    if (x <= from) return 0;
    if (x >= to) return -FALL;
    return (-FALL * (1 - Math.cos((Math.PI * (x - from)) / (to - from)))) / 2;
}

/**
 * How far below the heaviest rider's feet, standing up, the ground is meant to be at `x`: `CLEARANCE.ride` along the
 * ride, easing down to `CLEARANCE.dismount` over the `EASE` before the dismount zone: gently, so the hollow's floor
 * rises smoothly into it rather than in a hump.
 */
const EASE = 15;
export function clearanceAt(x: number): number {
    const { ride, dismount } = CLEARANCE;
    const from = DISMOUNT.from - EASE;
    if (x <= from) return ride;
    if (x >= DISMOUNT.from) return dismount;
    return ride + ((dismount - ride) * (1 - Math.cos((Math.PI * (x - from)) / EASE))) / 2;
}

/**
 * The hollow's floor: where the ground would be to keep the heaviest rider's feet its clearance up off it, sampled
 * every `step` metres along the span (worked out when first needed, once the hawsers are).
 */
const FLOOR_STEP = 0.25;
let floor: number[] | undefined;
function floorAt(x: number): number {
    floor ??= Array.from({ length: Math.round(SPAN / FLOOR_STEP) + 1 }, (_, i) => {
        const at = Math.min(Math.max(i * FLOOR_STEP, 0.05), SPAN);
        const trolley = loaded(at, RIDER.mass, 2).load!.y;
        return trolley - RIDER.harness - RIDER.standing - clearanceAt(at);
    });
    const u = Math.min(Math.max(x / FLOOR_STEP, 0), floor.length - 1);
    const i = Math.min(Math.floor(u), floor.length - 2);
    return floor[i] + (floor[i + 1] - floor[i]) * (u - i);
}

/** How far the lower of two heights is rounded off where they meet, so the ground has no crease. */
const BLEND = 0.4;
/** The lower of `a` and `b`, rounded off where they're within `BLEND` of each other. */
function smoothMin(a: number, b: number): number {
    const h = Math.max(BLEND - Math.abs(a - b), 0) / BLEND;
    return Math.min(a, b) - (h * h * BLEND) / 4;
}

/**
 * The ground's height at `x` along the run (level across it): the lie of the land, with a hollow between the towers
 * shaped to the heaviest rider's path, so it keeps their feet the same height off the ground all along the ride.
 */
export function groundY(x: number): number {
    if (x <= 0 || x >= SPAN) return natural(x);
    return smoothMin(natural(x), floorAt(x));
}

/** The span: from the tower's top cross bar to the shear leg's top spar, measured level. */
export const SPAN = 80;
/**
 * The hawsers' sag at mid-span under the test load: the book's minimum catenary, 5% of the span, measured with 150 to
 * 200 kg hanging at the middle (section 5.5.3). Unloaded they hang higher.
 */
export const SAG = 0.05 * SPAN;
/**
 * The test load the hawsers are tensioned with, in kg: two people hanging off a rope over the hawser at mid-span. The
 * light end of the book's 150 to 200 kg, which leaves the hawser slackest, so the riders hang lowest.
 */
export const TEST_LOAD = 150;
/** How far the ground falls from the tower to the shear leg. */
export const FALL = GRADE * SPAN;
/** How far each hawser is from the centre line: 1.5 m apart, to sit between the shear leg's uprights. */
export const HAWSER_Z = 0.75;
/** The hawsers' radius: 11 mm galvanised wire rope. */
export const HAWSER_R = 0.0055;

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
     * The platform: 1.1 m deep, 2.5 m wide at the front, clamped to the bottom bar with its end in line with hawser A's
     * upright, as in the photos, leaving the bar's other end clear for the ladder. How far its middle is off the tower's.
     */
    platform: { depth: 1.1, width: 2.5, shift: 0.25 },
    /**
     * How far the tower's middle is off the hawsers' (towards hawser A): the saddles on its top bar aren't centred on
     * it but sit towards the platform, as in a photo of the real one: hawser A 0.55 m in from its upright, B 0.95 m.
     */
    z: -0.2,
};
/** The top cross bar's middle: on the uprights' front (span) faces. */
const BAR_X = TOWER.shs / 2 + TOWER.rhs.w / 2;
/** Where a hawser rests in its cradle on the top cross bar. */
export const CRADLE_Y = TOWER.bar + TOWER.rhs.h / 2 + 0.008 + HAWSER_R;

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
/** The hessian bagging round the top spar where each hawser lies on it. */
const BAGGING_R = SHEAR_LEG.r + 0.025;
/** Where a hawser crosses the shear leg's top spar, which is on the anchor side of the uprights (Figure 33). */
const SPAR_X = SHEAR_LEG.x + 2 * SHEAR_LEG.r;
const SADDLE_Y = -FALL + SHEAR_LEG.spar + BAGGING_R + HAWSER_R;

/**
 * A hawser between its cradle on the tower and its saddle on the shear leg, held there (it can't slide over them), so
 * the stretch of the lengths beyond, back to the anchors, is left out.
 */
const RIG = {
    from: new Vector2(BAR_X, CRADLE_Y),
    to: new Vector2(SPAR_X, SADDLE_Y),
    weight: WIRE_WEIGHT,
    ea: WIRE_EA,
};
/** Each hawser's unstretched length between its supports, tensioned so the test load sags it 5% (section 5.5.3). */
export const HAWSER_LENGTH = lengthForSag(RIG, TEST_LOAD * G, SAG);
/** How the hawsers hang with nothing on them. */
export const UNLOADED = hang({ ...RIG, length: HAWSER_LENGTH });
/** How a hawser hangs with `mass` kg hanging from it at `x` along the span. */
export const loaded = (x: number, mass: number, points = 200): Shape =>
    hang({ ...RIG, length: HAWSER_LENGTH }, { x, weight: mass * G }, points);
/** The stabiliser's pulley under the middle of the top spar, on level ground (the frame's shifted onto the ground). */
const STABILISER_PULLEY = vec3(SPAR_X, SHEAR_LEG.spar - SHEAR_LEG.r - 0.25, 0);

/** The tree the hawsers are slung round, at least 2.15 times the tower's height behind it (Figure 26). */
export const TREE = { x: -23, r: 0.36, height: 9 };
/**
 * The log and picket anchor, on the level ground past the shear leg: the book's minimum is 2.15 times the height from
 * the shear leg's base to its saddle (which brings the hawsers down at just under 25°); it's set well back from that,
 * 3 times the height, for flatter hawsers.
 */
export const LOG = { x: SHEAR_LEG.x + 3 * (SHEAR_LEG.spar + BAGGING_R), r: 0.075, length: 2.4 };

/** The dynamic brake's blocks, this far up the span from the shear leg, and the static brakes. */
export const BLOCKS_X = SPAN - 10;
/**
 * A rider on the dropper, the heaviest the book allows with their harness, trolley and hardware (120 kg, section 7.9.3).
 * Their harness's tie-in hangs this far below the hawser, just more than they can reach up from it with their arms (so
 * they can't grab the hawser or the trolley, section 6.10). Sitting in a waist harness, their legs are out in front,
 * their heels about `seated` below the tie-in; standing up to land, their feet are `standing` below it.
 */
export const RIDER = { mass: 120, harness: 1.4, reach: 1.3, seated: 0.7, standing: 1.0 };
/** How far a rider's lowest point can hang below the hawser, standing: the book's "drop" (Figure 42). */
export const DROP = RIDER.harness + RIDER.standing;
/** The static brakes: at least twice the drop from the shear leg, so a swinging rider can't reach it (Figure 42). */
export const STATIC_X = SPAN - Math.ceil(2 * DROP);
/**
 * Where riders come to rest after braking: the lowest point a rider reaches on the hawser, about the same for every
 * weight, which they roll back to from the brake blocks.
 */
export const REST_X = (() => {
    let best = { x: 0, y: Infinity };
    for (let x = SPAN / 2; x < SPAN - 1; x += 0.25) {
        const y = loaded(x, RIDER.mass, 2).load!.y;
        if (y < best.y) best = { x, y };
    }
    return best.x;
})();
/**
 * The dismount zone: from a little up the span from where the heaviest riders slow to a walk, thrown back up from the
 * brake (about 49 m along; lighter riders slow further down), to the static brakes. Staff catch riders there and lower
 * them where they're caught.
 */
export const DISMOUNT = { from: 47, to: STATIC_X };
/**
 * How far the heaviest rider's feet are off the ground standing up: well clear along the ride, but only just in the
 * dismount zone, so they can't quite stand up by themselves, and a staff member on the ground can reach their descender
 * (no higher than `STAFF_REACH`) to lower them.
 */
export const CLEARANCE = { ride: 0.5, dismount: 0.1 };
/** How high a staff member standing on the ground can reach. */
export const STAFF_REACH = 2.0;
/** How far below the hawser a rider's descender is: just above their harness's tie-in. */
export const DESCENDER = RIDER.harness - 0.16;

/** The ropes and lines, and their colours. */
export const C = {
    hawser: "var(--tower-steel)",
    returnLine: "var(--knot-green)",
    brakeLine: "var(--knot-yellow)",
    joining: "var(--knot-blue)",
    shockCord: "var(--rig-white)",
    staticBrake: "var(--knot-red)",
    dropper: "var(--rig-maroon)",
    guy: "var(--knot-orange)",
    backstay: "var(--rig-black)",
    fibre: "var(--fox-fibre)",
    hessian: "var(--fox-hessian)",
    picket: "var(--fox-picket)",
    cap: "var(--knot-yellow)",
    steel: "var(--tower-steel)",
    brass: "var(--fox-brass)",
    /** Shackles' painted screw pins. */
    pin: "var(--fox-shackle-pin)",
    trolley: "var(--knot-red)",
    nylon: "var(--fox-nylon)",
    tirfor: "var(--fox-tirfor)",
    oval: "var(--fox-carabiner-oval)",
    tree: "var(--tower-log)",
    spar: "var(--fox-spar)",
    grate: "var(--fox-grate)",
    pulley: "var(--fox-pulley)",
    sheave: "var(--fox-sheave)",
};
/** The Tirfor's colours: its alloy body, steel pin and handle, yellow release lever, black grips and labels. */
export const TIRFOR_COLORS = {
    body: "var(--fox-tirfor)",
    steel: "var(--tower-steel)",
    lever: "var(--fox-tirfor-lever)",
    grip: "var(--rig-black)",
    label: "var(--rig-black)",
};
/** The trolleys' and pulleys' colours. */
export const TROLLEY_COLORS = {
    plates: "var(--knot-red)",
    sheave: "var(--fox-sheave)",
    steel: "var(--tower-steel)",
    bumper: "var(--rig-black)",
};
/** The size of the stop blocks' eyes, which the joining rope's tied into. */
const STOP_BLOCK_EYE = STOP_BLOCK.eye.size;

/** The stop blocks' colours: the nylon body, steel eye bolts and brass bolts. */
export const STOP_BLOCK_COLORS = {
    body: "var(--fox-nylon)",
    steel: "var(--tower-steel)",
    brass: "var(--fox-brass)",
};

export const PULLEY_COLORS = {
    plates: "var(--fox-pulley)",
    sheave: "var(--fox-sheave)",
    steel: "var(--tower-steel)",
    carabiner: "var(--fox-carabiner-oval)",
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

/**
 * A square or rectangular steel section from `a` to `b`, `h` deep as near `up` as it can be, its long edges rounded as
 * a hollow section's are (a plate's left square).
 */
const section = (a: Vector3, b: Vector3, up: Vector3, w: number, h: number, color = C.steel) =>
    colored(timber(a, b, up, w, h, "steel", true, Math.min(w, h) >= 0.03 ? STEEL_ROUND : 0), color);

/** How round a hollow steel section's long edges are. */
const STEEL_ROUND = 0.005;

/**
 * A run of rope or wire through `points`. Long runs are cut into strands of about `piece` points, for the sort. `cut`
 * says which of its ends (`a` the first, `b` the last) are cut ends of rope, squared off and fused.
 */
export function line(
    points: Vector3[],
    r: number,
    color: string,
    material: Material = "rope",
    cut: { a?: boolean; b?: boolean } = {},
): Strand[] {
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
            ...(i === 0 && cut.a && { cutA: true }),
            ...(i + piece >= points.length - 1 && cut.b && { cutB: true }),
        });
    }
    return out;
}

/** The figure 8 on a bight, tightened in 3D round a carabiner-thick bar and edited in /knot-editor-3d. */
const FIGURE_8 = knot3dFile("figure-8.json", FIGURE_8_JSON);

/** A knot's rope as drawn: the file's, its tail (the straight run at its end, out of the knot) cut to half its length. */
function halveTail(points: readonly Vector3[]): Vector3[] {
    const n = points.length;
    const way = points[n - 1].sub(points[n - 2]).unit();
    // Back up the tail while it runs straight, within 10 degrees of the way it ends.
    let k = n - 2;
    while (
        k > 0 &&
        points[k]
            .sub(points[k - 1])
            .unit()
            .dot(way) > Math.cos(Math.PI / 18)
    )
        k--;
    const arc = ropeArcLengths(points.slice(k));
    const half = arc.at(-1)! / 2;
    const keep = arc.findIndex((s) => s > half);
    return points.slice(0, k + keep);
}

/** The figure 8 on a bight's rope as drawn, its tail halved. */
const FIGURE_8_ROPE = halveTail(FIGURE_8.rope.points);

/** How much of each of a big loop's legs is kept as tied (metres, at the knot file's size) before it opens out. */
const BIG_LOOP_KEEP = 0.03;

/**
 * The figure 8 on a bight tied with a big loop, as for a guy dropped over a post: edited in /knot-editor-3d for its
 * knot. Its loop's made again to fit each post (`bigLoop`), so only the knot matters.
 */
const FIGURE_8_BIG_LOOP = knot3dFile("figure-8-big-loop.json", FIGURE_8_BIG_LOOP_JSON);
const FIGURE_8_BIG_LOOP_ROPE = halveTail(FIGURE_8_BIG_LOOP.rope.points);
/** Where its loop leaves the knot and comes back to it. */
const BIG_LOOP_ENDS = loopEnds(
    FIGURE_8_BIG_LOOP_ROPE,
    FIGURE_8_BIG_LOOP.rope.seg,
    FIGURE_8_BIG_LOOP.knot,
    BIG_LOOP_KEEP,
);

/** The single figure 8, a stopper in a rope's end, edited in /knot-editor-3d from the Rescue Knots drawing. */
const FIGURE_8_SINGLE = knot3dFile("figure-8-single.json", FIGURE_8_SINGLE_JSON);

/** The single figure 8's rope as drawn, from its standing end, its tail halved. */
const FIGURE_8_SINGLE_ROPE = halveTail(FIGURE_8_SINGLE.rope.points);

/**
 * A figure 8 stopper tied in a rope's end: the rope arriving at `at` heading along `dir`, and on through the knot to
 * the tail's end, drawn at the size of a rope `ropeR` thick.
 */
export function stopper(at: Vector3, dir: Vector3, ropeR: number): Vector3[] {
    const { diameter } = FIGURE_8_SINGLE;
    const points = FIGURE_8_SINGLE_ROPE;
    const scale = ropeR / (diameter / 2);
    // The knot's way in along its standing part, turned onto `dir`, its sides kept level where they can be.
    const frame = (u: Vector3) => {
        const side = Math.abs(u.y) < 0.9 ? UP.cross(u).unit() : ACROSS.cross(u).unit();
        return [u, side, u.cross(side)];
    };
    const [u0, v0, w0] = frame(points[1].sub(points[0]).unit());
    const [u, v, w] = frame(dir.unit());
    return points.map((p) => {
        const q = p.sub(points[0]).scale(scale);
        return at
            .add(u.scale(q.dot(u0)))
            .add(v.scale(q.dot(v0)))
            .add(w.scale(q.dot(w0)));
    });
}

/** A figure 8 on a bight tied into something, as `figure8` draws it. */
export type Figure8 = {
    /** The rope from the tail's end, round through the knot, to where the standing part leaves it. */
    rope: Vector3[];
    /** Where the standing part leaves the knot, for the rope to go on from. */
    end: Vector3;
    /** How far from the bar, towards the pull, the knot reaches. */
    reach: number;
};

/**
 * A figure 8 on a bight tied into a bar (a carabiner's, a shackle's pin, an eye): the flying fox's figure 8, its bight
 * round the bar at `bar` (on its middle line), which runs along `axis` and is `barR` thick, and the knot lying towards
 * `toward`, the way its standing part pulls. It's drawn at the size of a rope `ropeR` thick, its bight opened or closed
 * to fit round the bar (blended out over the next few centimetres of the loop).
 *
 * With `loop`, the loop's a big one dropped over a post or bar: its legs run straight from the knot, `loop` from the
 * bar's middle, out to the bar and pulled snug round its far side. Its plane holds the pull, square to `axis` as near
 * as it can be, and the loop hugs what it's round where that plane cuts it: `around` (a square post or bar lies flat
 * along its faces), or by default the round bar.
 */
export function figure8(
    bar: Vector3,
    axis: Vector3,
    barR: number,
    toward: Vector3,
    ropeR: number,
    loop?: number,
    around: Prism[] = [roundBar(bar, axis, barR)],
): Figure8 {
    const { props, diameter } = loop === undefined ? FIGURE_8 : FIGURE_8_BIG_LOOP;
    const at = props[0];
    const scale = ropeR / (diameter / 2);
    // The knot's own axes turned onto the bar's: its bar along z, and back up its standing part along y. A big loop
    // lies in the plane of the pull, square to it, its bar's axis taken square to the pull.
    const off = toward.sub(bar);
    const a = axis.unit();
    const slant = loop === undefined ? off.sub(a.scale(off.dot(a))) : off;
    const down = slant.unit();
    const zRaw = loop === undefined ? a : a.sub(down.scale(a.dot(down)));
    const z = zRaw.unit();
    const y = down.neg();
    const x = y.cross(z);
    const local = (loop === undefined ? FIGURE_8_ROPE : FIGURE_8_BIG_LOOP_ROPE).map((p) =>
        p.sub(at.at).scale(scale),
    );
    let shaped: Vector3[];
    if (loop === undefined) {
        // The bight's middle line round the bar, as tightened (scaled) and as it needs to be.
        const [was, wants] = [scale * (at.r + diameter / 2), barR + ropeR];
        const blend = was + 0.03 * scale;
        shaped = local.map((q) => {
            const d = Math.hypot(q.x, q.y);
            const t = clamp((blend - d) / (blend - was), 0, 1);
            const f = d > 0 ? (d + (wants - was) * t) / d : 1;
            return vec3(q.x * f, q.y * f, q.z);
        });
    } else {
        // Each long edge of what it's round, grown by the rope's radius (a hair more, to sit just clear), cut by the
        // loop's plane, in the knot's own axes.
        const cut = around.flatMap(({ along, corners }) =>
            corners(ropeR * 1.02).map((c) => {
                const p = c.add(along.scale(-c.sub(bar).dot(z) / along.dot(z))).sub(bar);
                return new Vector2(p.dot(y.cross(z)), p.dot(y));
            }),
        );
        shaped = bigLoop(local, BIG_LOOP_ENDS, cut, ropeR, loop, 0.003 * scale);
    }
    const points = shaped.map((q) => bar.add(x.scale(q.x)).add(y.scale(q.y)).add(z.scale(q.z)));
    const reach = Math.max(...points.map((p) => p.sub(bar).dot(down)));
    // The file runs from the standing end: the tail's end comes first reversed.
    return { rope: points.reverse(), end: points[points.length - 1], reach };
}

/**
 * Where a knot's loop is: the points between its last knot segment before the loop's top (the highest point) and its
 * first knot segment after, by the file's `knot` list, less `keep` (metres) of each leg as it leaves the knot. Returns
 * the last point kept before the loop and the first after it.
 */
export function loopEnds(
    points: readonly Vector3[],
    seg: readonly number[],
    knot: readonly number[],
    keep = 0,
): [number, number] {
    let top = 0;
    points.forEach((q, i) => q.y > points[top].y && (top = i));
    const inKnot = new Set(knot);
    let a = top;
    while (a > 0 && !inKnot.has(seg[a])) a--;
    let b = top;
    while (b < points.length - 1 && !inKnot.has(seg[b])) b++;
    for (let s = 0; a < top - 1 && s < keep; a++) s += points[a].distanceTo(points[a + 1]);
    for (let s = 0; b > top + 1 && s < keep; b--) s += points[b].distanceTo(points[b - 1]);
    return [a, b];
}

/** How tight, in rope radii, a big loop bends round a square post's or bar's corners. */
const BIG_LOOP_BEND = 4;

/**
 * Something a big loop goes round: a straight post or bar running along `along`, its long edges through `corners`
 * (round one, many of them), with it grown all round by `grow`.
 */
export type Prism = { along: Vector3; corners: (grow: number) => Vector3[] };

/** A round bar `r` thick along `along` through `at`. */
export function roundBar(at: Vector3, along: Vector3, r: number, n = 32): Prism {
    const a = along.unit();
    const u = (Math.abs(a.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0)).cross(a).unit();
    const v = a.cross(u);
    const corners = (grow: number) =>
        Array.from({ length: n }, (_, k) => {
            const t = (2 * Math.PI * k) / n;
            return at.add(u.scale((r + grow) * Math.cos(t))).add(v.scale((r + grow) * Math.sin(t)));
        });
    return { along: a, corners };
}

/** A box section along `along` through `at`: `d` deep along `face` (square to `along`), `w` wide across. */
export function boxBar(at: Vector3, along: Vector3, face: Vector3, d: number, w: number): Prism {
    const a = along.unit();
    const u = face.sub(a.scale(face.dot(a))).unit();
    const v = a.cross(u);
    const corners = (grow: number) =>
        [
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1],
        ].map(([i, j]) => at.add(u.scale(i * (d / 2 + grow))).add(v.scale(j * (w / 2 + grow))));
    return { along: a, corners };
}

/**
 * The figure 8's rope (`local`: its own axes, y up its loop towards the bar) with its loop made big, its bar's middle
 * moved to the origin: the loop's legs, from where they leave the knot (points `ends`, kept), run straight out to what
 * it's round (`cut`: the outline in the loop's plane, x and y about the bar's middle, that the rope's middle line keeps
 * clear of) and round its far side, snug, its corners bent to suit a rope `ropeR` thick; the knot sits `reach` below the origin. Points about `step` apart. Says which of
 * `local`'s points it replaced (`from` to `to`) and with how many.
 */
export function bigLoop(
    local: Vector3[],
    ends: [number, number],
    cut: readonly Vector2[],
    ropeR: number,
    reach: number,
    step: number,
): Vector3[] & { replaced: { from: number; to: number; by: number } } {
    const [i, j] = [ends[0] + 1, ends[1] - 1];
    // From the last point kept on one leg, to the first kept on the other.
    const [A, B] = [local[ends[0]], local[ends[1]]];
    const centre = vec3((A.x + B.x) / 2, Math.max(A.y, B.y) + reach, (A.z + B.z) / 2);
    const flat = (q: Vector3) => new Vector2(q.x - centre.x, q.y - centre.y);
    const [a, b] = [flat(A), flat(B)];
    // The rope's middle line round it, bent round its corners no tighter than `BIG_LOOP_BEND` rope radii: the outline
    // taken in and then grown again by the bend. Taken in only so far that each corner's arc still goes round the
    // corner (less where the corner's sharper), so it lies flat along long faces but stands off short ones. Then pulled
    // tight from the legs: the hull of that and the legs' ends.
    const bend = BIG_LOOP_BEND * ropeR;
    const shape = convexHull(cut);
    const around = (k: number) => [
        shape[(k + shape.length - 1) % shape.length],
        shape[k],
        shape[(k + 1) % shape.length],
    ];
    const taken = Math.min(
        ...shape.map((_, k) => {
            const [o, p, q] = around(k);
            const turn = Math.acos(clamp(o.sub(p).unit().dot(q.sub(p).unit()), -1, 1));
            return bend * Math.sin(turn / 2);
        }),
    );
    const inset = shape.map((_, k) => {
        // Where its two faces either side, each moved in, meet.
        const [o, p, q] = around(k);
        const [d0, d1] = [p.sub(o).unit(), q.sub(p).unit()];
        const inward = (d: Vector2) => new Vector2(-d.y, d.x).scale(taken);
        const [s0, s1] = [o.add(inward(d0)), p.add(inward(d1))];
        const t = s1.sub(s0).cross(d1) / d0.cross(d1);
        return s0.add(d0.scale(t));
    });
    const round = Array.from({ length: 24 }, (_, k) => (2 * Math.PI * k) / 24);
    const outline = inset.flatMap((c) =>
        round.map((t) => c.add(new Vector2(bend * Math.cos(t), bend * Math.sin(t)))),
    );
    const hull = convexHull([a, b, ...outline]);
    const [ia, ib] = [hull.indexOf(a), hull.indexOf(b)];
    if (ia < 0 || ib < 0) throw new Error("A big loop's legs end inside what it goes round");
    // The way round from a to b over the far side: the longer of the two ways round the hull.
    const way = (dir: number) => {
        const run = [a];
        for (let k = ia; k !== ib; ) run.push(hull[(k = (k + dir + hull.length) % hull.length)]);
        return run;
    };
    const [up, down] = [way(1), way(-1)];
    const run = up.length > down.length ? up : down;
    const path: Vector2[] = [];
    // Each leg leaves the knot the way it was going, curving onto the line out to the outline (a cubic Bézier).
    const curve = (p: Vector2, from: Vector2, q: Vector2, to: Vector2) => {
        const l = p.distanceTo(q) / 3;
        const [c1, c2] = [p.add(from.scale(l)), q.sub(to.scale(l))];
        const n = Math.max(1, Math.ceil((3 * l) / step));
        for (let k = 1; k <= n; k++) {
            const t = k / n;
            const u = 1 - t;
            path.push(
                p
                    .scale(u * u * u)
                    .add(c1.scale(3 * u * u * t))
                    .add(c2.scale(3 * u * t * t))
                    .add(q.scale(t * t * t)),
            );
        }
    };
    const [p0, p1] = [run[1], run[run.length - 2]];
    const leaving = a.sub(flat(local[ends[0] - 1])).unit();
    const arriving = flat(local[ends[1] + 1])
        .sub(b)
        .unit();
    curve(a, leaving, p0, p0.sub(a).unit());
    const wrapFrom = path.length;
    // Round the outline, its flat runs cut to `step`.
    for (let k = 2; k < run.length - 1; k++) {
        const n = Math.max(1, Math.ceil(run[k - 1].distanceTo(run[k]) / step));
        for (let m = 1; m <= n; m++) path.push(run[k - 1].lerp(run[k], m / n));
    }
    const wrapTo = path.length;
    curve(p1, b.sub(p1).unit(), b, arriving);
    path.pop();
    // Each leg's depth (z) eases from its own to the loop's plane (the middle of the two) along it, so the loop lies in
    // its plane where it's round what it's round.
    const mid = centre.z;
    const ease = (t: number) => t * t * (3 - 2 * t);
    const looped = path.map((p, k) => {
        const z =
            k < wrapFrom
                ? A.z + (mid - A.z) * ease((k + 1) / wrapFrom)
                : k >= wrapTo
                  ? mid + (B.z - mid) * ease((k - wrapTo + 1) / (path.length - wrapTo + 1))
                  : mid;
        return vec3(centre.x + p.x, centre.y + p.y, z);
    });
    const points = [...local.slice(0, i), ...looped, ...local.slice(j + 1)].map((q) =>
        q.sub(centre),
    );
    return Object.assign(points, { replaced: { from: i, to: j, by: looped.length } });
}

/**
 * A sling's webbing: a round sling (an endless loop of yarn in a woven sleeve, the anchors' 4 t ones) or a climbing
 * sling (sewn flat tape as on the tower, here the common 25 mm). Neither is round in section: a round sling's sleeve
 * squashes semi-flat, about 50 mm wide and 14 mm thick. `r` is how thick the flat views draw it.
 */
export const SLINGS = {
    round: {
        width: 0.05,
        thickness: 0.014,
        r: 0.016,
        color: "var(--fox-round-sling)",
        bunched: { width: 0.038, thickness: 0.02, over: 0.15 },
    },
    climbing: {
        width: 0.025,
        thickness: TAPE.thickness,
        r: 0.0125,
        color: "var(--fox-sling)",
        // Climbing tape is flat already, and a carabiner's bar is wide enough for it not to bunch.
        bunched: { width: 0.025, thickness: TAPE.thickness, over: 0.06 },
    },
};

/**
 * A sling through `points`, doubled (an endless or tied loop goes round anything with its two parts side by side):
 * its two layers lie `across`, fanned apart where it wraps and gathered at `gather` (its shackle or carabiner) over the
 * last `ramp` metres.
 */
export function sling(
    kind: keyof typeof SLINGS,
    points: Vector3[],
    across: Vector3,
    gather: Vector3,
    ramp: number,
    layers = 2,
): Strand[] {
    const { width, thickness, r, color } = SLINGS[kind];
    const tape = { width, thickness, across, layers, gather, ramp };
    const strands = line(points, r, color, "sling").map((p) => ({ ...p, tape }));
    if (kind !== "round")
        return [
            ...strands,
            ...strands
                .flatMap((p) =>
                    tapeLayers(p).map((layer) => ({ layer, size: { width, thickness } })),
                )
                .flatMap(({ layer, size }) =>
                    stitching(
                        layer,
                        layer.map(() => size),
                        across,
                    ),
                ),
        ];
    // A round sling's stripes, along each layer.
    return [
        ...strands,
        ...strands.flatMap((p) =>
            tapeLayers(p).flatMap((layer) =>
                stripes(
                    layer,
                    layer.map(() => ({ width, thickness })),
                    across,
                ),
            ),
        ),
    ];
}

/** A round sling's stripes: two dark lines along it either side of its middle, on both faces. */
const STRIPE = { at: 0.3, width: 0.003, color: "var(--fox-round-sling-stripe)" };

/** A tape's width and thickness at a point, and (if it twists) the way its width lies there. */
type TapeSize = { width: number; thickness: number; across?: Vector3 };

/** The stripes along a round sling's layer through `points`, `profile` its size at each. */
function stripes(points: Vector3[], profile: TapeSize[], across: Vector3): Strand[] {
    const a = across.unit();
    return [-1, 1].flatMap((s) =>
        tapeRun(
            points.map((q, i) =>
                q.add((profile[i].across ?? a).unit().scale(s * STRIPE.at * profile[i].width)),
            ),
            profile.map((p) => ({
                width: STRIPE.width,
                thickness: p.thickness + 0.001,
                across: p.across,
            })),
            a,
            STRIPE.color,
            0.0015,
        ).map((p) => ({ ...p, fine: STRIPE.width })),
    );
}

/**
 * A climbing sling's stitching, the pattern woven along its tape: two rows of short light dashes, on both faces.
 */
const STITCH = {
    rows: [-0.22, 0.22],
    dash: 0.008,
    gap: 0.008,
    width: 0.0012,
    color: "var(--fox-sling-stitch)",
};

/** The stitching along a climbing sling's layer through `points`, `profile` its size at each. */
function stitching(points: Vector3[], profile: TapeSize[], across: Vector3): Strand[] {
    const a = across.unit();
    const at = [0];
    for (let i = 1; i < points.length; i++)
        at.push(at[i - 1] + points[i].distanceTo(points[i - 1]));
    // The point and size `d` along the tape, `off` (of its width) out from its middle.
    const sample = (d: number, off: number): { q: Vector3; size: TapeSize } => {
        const i = Math.min(
            points.length - 1,
            Math.max(
                1,
                at.findIndex((x) => x >= d),
            ),
        );
        const k = Math.min(1, Math.max(0, (d - at[i - 1]) / (at[i] - at[i - 1] || 1)));
        const p = profile[i];
        const w = (p.across ?? a).unit();
        return { q: points[i - 1].lerp(points[i], k).add(w.scale(off * p.width)), size: p };
    };
    const out: Strand[] = [];
    const step = STITCH.dash + STITCH.gap;
    // Fine detail, which the flat views leave out when it's too small to see.
    const fine = { fine: STITCH.width };
    for (const off of STITCH.rows)
        for (let d = 0; d + STITCH.dash < at.at(-1)!; d += step) {
            const ends = [sample(d, off), sample(d + STITCH.dash, off)];
            out.push({
                ...fine,
                kind: "strand",
                points: ends.map((e) => e.q),
                r: 0.0008,
                material: "sling",
                color: STITCH.color,
                capA: true,
                capB: true,
                tape: {
                    width: STITCH.width,
                    thickness: ends[0].size.thickness + 0.0008,
                    across: a,
                    layers: 1,
                    gather: ends[0].q,
                    ramp: 1,
                    profile: ends.map((e) => ({
                        width: STITCH.width,
                        thickness: e.size.thickness + 0.0008,
                        across: e.size.across,
                    })),
                },
            });
        }
    return out;
}

/**
 * One layer of tape through `points`, `profile` its size at each, lying `across` (where the profile doesn't say), in
 * short strands so it sorts where it is; `r` is how thick the flat views draw it.
 */
function tapeRun(
    points: Vector3[],
    profile: TapeSize[],
    across: Vector3,
    color: string,
    r: number,
): Strand[] {
    const piece = 12;
    const out: Strand[] = [];
    for (let i = 0; i < points.length - 1; i += piece) {
        const end = Math.min(points.length, i + piece + 1);
        const part = profile.slice(i, end);
        out.push({
            kind: "strand",
            points: points.slice(i, end),
            r,
            material: "sling",
            color,
            capA: i === 0,
            capB: i + piece >= points.length - 1,
            tape: {
                width: part[0].width,
                thickness: part[0].thickness,
                across,
                layers: 1,
                gather: points[i],
                ramp: 1,
                profile: part,
            },
        });
    }
    return out;
}

/**
 * A sling basketed round a log (or spar) and up into a shackle's bow (or a carabiner), both its ends on it: the loop
 * lies doubled, its two strands flat side by side round the log, and each leg ends in a bight round the shackle's crown
 * (or the carabiner's bar), one strand in over it and the other under it, the two bights one atop the other. Over the
 * last of its legs it bunches up, narrower and thicker. `log` is the log's middle (its axis `along`, `logR` its
 * radius), `bar` the middle of the crown bar (its radius `barR`), and `up` a way square to the line between them and
 * to `along`, which the top leg is on. The loop crosses itself round the crown, where it changes layer.
 */
export function basketedSling(
    kind: keyof typeof SLINGS,
    log: Vector3,
    logR: number,
    bar: Vector3,
    barR: number,
    up: Vector3,
    along: Vector3,
): Strand[] {
    const { width, thickness, r, color, bunched } = SLINGS[kind];
    // Worked out square to the log, then sheared along it as far as the bar rises along it, so the loop hugs the log
    // on a slant.
    const axis = along.unit();
    const toBar = bar.sub(log);
    const rise = toBar.dot(axis);
    const flat = toBar.sub(axis.scale(rise));
    const D = flat.len();
    const a = flat.unit();
    const b = up
        .sub(a.scale(up.dot(a)))
        .sub(axis.scale(up.dot(axis)))
        .unit();
    const p = (x: number, y: number) =>
        log
            .add(a.scale(x))
            .add(b.scale(y))
            .add(axis.scale((x / D) * rise));
    // Round the log the two strands of the doubled loop lie flat side by side, strand `k` (0 or 1) `side(k)` along
    // the log from the middle. Each leg ends in a bight through the bow round the crown: one strand comes in over the
    // crown and the other under it, joined round its far side. The two bights lie partly one atop the other, swapping
    // over round the far side, so each strand leaves the crown on the side away from the strands it crosses.
    // A climbing sling's thin flat tape comes together in the carabiner, one bight on the other; its legs close
    // from side by side round the rail to one on the other there.
    const stacked = kind === "climbing";
    const side = (k: number) => (k - 0.5) * (width + 0.004);
    const z = axis;
    const r1 = logR + thickness / 2;
    const rb = (layer: number) => barR + bunched.thickness * (layer + 0.5);
    type Flat2 = [number, number];
    // The straight line from the log (on its top or bottom, `s1` ±1) to the crown (on its top or bottom, `s2`), the
    // crown `layer` out: where it leaves each.
    const tangent = (s1: number, s2: number, layer: number): { log: number; bar: number } => {
        const r2 = rb(layer);
        if (s1 === s2) {
            const t = Math.acos((r1 - r2) / D);
            return { log: s1 * t, bar: s1 * t };
        }
        const t = Math.acos((r1 + r2) / D);
        return { log: s1 * t, bar: Math.PI + s1 * t };
    };
    const onLog = (angle: number): Flat2 => [r1 * Math.cos(angle), r1 * Math.sin(angle)];
    const onBar = (angle: number, layer: number): Flat2 => [
        D + rb(layer) * Math.cos(angle),
        rb(layer) * Math.sin(angle),
    ];
    const ease = (t: number) => t * t * (3 - 2 * t);
    // In the bow each bight is pushed to one side, the top leg's towards +z; each strand runs straight from there to
    // its place round the log, so the one whose place is on the far side angles across more.
    const lap = stacked ? 0 : 0.3 * bunched.width;
    const inBow = (bight: number) => (bight === 0 ? lap : -lap);
    const pts: Vector3[] = [];
    // A leg of strand `k` between the crown (in `bight`) and the log.
    const leg = (from: Flat2, to: Flat2, k: number, bight: number, toLog: boolean) => {
        const [z0, z1] = toLog ? [inBow(bight), side(k)] : [side(k), inBow(bight)];
        for (let i = 0; i < 10; i++) {
            const s = i / 10;
            const [x, y] = [from[0] + (to[0] - from[0]) * s, from[1] + (to[1] - from[1]) * s];
            pts.push(p(x, y).add(z.scale(z0 + (z1 - z0) * s)));
        }
    };
    const arc = (from: number, to: number, k: number) => {
        for (let i = 0; i < 16; i++) {
            const [x, y] = onLog(from + ((to - from) * i) / 16);
            pts.push(p(x, y).add(z.scale(side(k))));
        }
    };
    // A bight round the crown's far side, stepping a layer out (or in) as it goes, where it passes the other bight.
    const wrap = (from: number, to: number, bight: number, l0: number, l1: number) => {
        for (let i = 0; i < 16; i++) {
            const u = i / 16;
            const [x, y] = onBar(from + (to - from) * u, l0 + (l1 - l0) * ease(u));
            pts.push(p(x, y).add(z.scale(inBow(bight))));
        }
    };
    // Strand 0: out of the top bight over the crown (the outer layer there), along the top leg, round the back of the
    // log, along the bottom leg and in over the crown (the inner layer) into the bottom bight.
    const topOut = tangent(1, 1, 1);
    const bottomIn = tangent(-1, 1, 0);
    leg(onBar(topOut.bar, 1), onLog(topOut.log), 0, 0, true);
    arc(topOut.log, 2 * Math.PI + bottomIn.log, 0);
    leg(onLog(bottomIn.log), onBar(bottomIn.bar, 0), 0, 1, false);
    // The bottom bight, round the crown's far side from its top to its bottom, stepping out a layer.
    const bottomOut = tangent(-1, -1, 1);
    wrap(bottomIn.bar, bottomOut.bar, 1, 0, 1);
    // Strand 1: out of the bottom bight under the crown (the outer layer there), back along the bottom leg, round the
    // log, along the top leg and in under the crown (the inner layer) into the top bight.
    const topIn = tangent(1, -1, 0);
    leg(onBar(bottomOut.bar, 1), onLog(bottomOut.log), 1, 1, true);
    arc(2 * Math.PI + bottomOut.log, topIn.log, 1);
    leg(onLog(topIn.log), onBar(topIn.bar, 0), 1, 0, false);
    // The top bight, round the crown's far side from its bottom to its top, stepping out a layer, back to the start.
    wrap(topIn.bar - 2 * Math.PI, topOut.bar, 0, 0, 1);
    const points = [...pts, pts[0]];
    // Bunched up near the bar, easing out to its full width over the last of each leg.
    const profile = points.map((q) => {
        const f = Math.min(1, Math.max(0, (q.distanceTo(bar) - 0.2 * bunched.over) / bunched.over));
        const e = f * f * (3 - 2 * f);
        return {
            width: bunched.width + (width - bunched.width) * e,
            thickness: bunched.thickness + (thickness - bunched.thickness) * e,
        };
    });
    const tape = tapeRun(points, profile, z, color, r);
    return [
        ...tape,
        ...(kind === "round" ? stripes(points, profile, z) : stitching(points, profile, z)),
    ];
}

/** Points along a hanging line from `a` to `b`, `sag` below the straight line between them at its middle. */
export function hanging(a: Vector3, b: Vector3, sag: number, n = 40): Vector3[] {
    return Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        return a.lerp(b, t).add(vec3(0, -4 * sag * t * (1 - t), 0));
    });
}

/**
 * How far a line from `a` to `b` sags at its middle hanging as the hawsers do, `times` as much: a hanging line's sag
 * goes as the square of its length for the same tension per weight, so it's scaled from the unloaded hawsers'. If
 * that would bring it within `clear` of the ground, it sags only as far as keeps it that far up.
 */
export function sagLike(a: Vector3, b: Vector3, times = 1, clear = 0.5): number {
    const span = RIG.to.x - RIG.from.x;
    const mid = (RIG.from.x + RIG.to.x) / 2;
    const hawser = (RIG.from.y + RIG.to.y) / 2 - hawserY(mid);
    const want = times * hawser * (a.distanceTo(b) / span) ** 2;
    const clears = (sag: number) =>
        hanging(a, b, sag, 60).every((p) => p.y >= groundY(p.x) + clear);
    if (clears(want)) return want;
    // As much as still clears, by halving the difference.
    let [lo, hi] = [0, want];
    for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2;
        if (clears(m)) lo = m;
        else hi = m;
    }
    return lo;
}

/** A hawser's height along the span, unloaded, at `x` (from the tower's cradle to the shear leg's saddle). */
export function hawserY(x: number): number {
    return heightAt(UNLOADED, x);
}

/** `pieces` moved by `d`. */
export function moved(pieces: Piece[], d: Vector3): Piece[] {
    return pieces.map((p) =>
        p.kind === "rod"
            ? { ...p, a: p.a.add(d), b: p.b.add(d) }
            : {
                  ...p,
                  points: p.points.map((q) => q.add(d)),
                  ...(p.kind === "face" &&
                      p.holes && { holes: p.holes.map((h) => h.map((q) => q.add(d))) }),
              },
    );
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

/** How far out from a post or bar the knot of a big loop over it sits (from the post's middle). */
const BIG_LOOP = 0.3;

/**
 * A guy from `from` (the middle of what its loop goes round, `around`) to a picket at `at`, the picket leaning away
 * from it: tied with a figure 8 on a bight, its big loop round a post dropped over it, square to `axis` as near as it
 * can be (upright by default). Dropped onto `settle`, the loop rests where it's dropped or as little above as clears
 * what's under it (`clear` says whether a point of the rope's middle line is clear) and the loops already on the post
 * (`others`, which it joins).
 */
function guy(
    from: Vector3,
    at: Vector3,
    r: number,
    color: string,
    around: Prism[],
    {
        axis = UP,
        settle,
    }: { axis?: Vector3; settle?: { clear: (p: Vector3) => boolean; others: Vector3[][] } } = {},
): Piece[] {
    const p = picket(at, towards(from, at));
    const knot = figure8(from, axis, 0, p.tie, r, BIG_LOOP, around);
    let rope = knot.rope;
    let end = knot.end;
    if (settle) {
        const near = settle.others.flat().filter((q) => q.distanceTo(from) < 0.5);
        const mine = rope.filter((q) => q.distanceTo(from) < 0.5);
        const fits = (lift: number) =>
            mine.every((q) => {
                const up = q.add(UP.scale(lift));
                return settle.clear(up) && near.every((o) => o.distanceTo(up) >= 2 * r);
            });
        // Raised a quarter of the rope's thickness at a time until it fits.
        let lift = 0;
        while (!fits(lift) && lift < 0.3) lift += r / 4;
        rope = rope.map((q) => q.add(UP.scale(lift)));
        end = end.add(UP.scale(lift));
        settle.others.push(rope);
    }
    return [
        ...p.pieces,
        ...line([...rope, ...hanging(end, p.tie, 0.05, 12)], r, color, "rope", { a: true }),
    ];
}

/** A pulley's sheave at `at`, its axle along `axle`. */
/** The bar of a pulley's carabiner (its radius). */
const CARABINER_BAR = 0.0045;

/**
 * A rescue pulley, its rope running off towards points `a` and `b`, and the rope round it from `a`'s side to `b`'s.
 * Clipped into an eye bolt screwed into a post or arm at `base`, standing out towards `out`, it's moved from `near`
 * until its carabiner hangs in the eye. The eye's turned into the plane of `out` and `toward`, or to face the pull if
 * that's not given. Hung from a sling, it stays at `near` with the sling up to `mount`.
 */
export function rigPulley(
    near: Vector3,
    a: Vector3,
    b: Vector3,
    ropeR: number,
    hung:
        | { eyeBolt: { base: Vector3; out: Vector3; toward?: Vector3 } }
        | { basket: { spar: Vector3; along: Vector3; r: number; drop: number } },
) {
    const build = (centre: Vector3) =>
        pulley({ centre, toA: a.sub(centre), toB: b.sub(centre), ropeR, colors: PULLEY_COLORS });
    let centre = near;
    let p = build(centre);
    const extra: Piece[] = [];
    if ("basket" in hung) {
        // A climbing sling basketed over a spar (its middle `spar`, running along `along`), its two legs down to the
        // carabiner `drop` below the spar's middle. The pulley swings until the sling lines up with the pull of its
        // rope, as with an eye, moving half way each time so it settles.
        const { spar, along, r, drop } = hung.basket;
        const axis = along.unit();
        const square = (v: Vector3) => v.sub(axis.scale(v.dot(axis)));
        for (let i = 0; i < 100; i++) {
            const hangs = square(p.up).unit();
            const hook = spar.sub(hangs.scale(drop));
            const next = centre.lerp(hook.sub(p.hook.sub(centre)), 0.5);
            const moved = next.distanceTo(centre);
            centre = next;
            p = build(centre);
            if (moved < 1e-5) break;
        }
        // The sling doubled round the spar, each leg's bight through the carabiner round its top bar.
        const level = spar.add(axis.scale(axis.dot(p.hook.sub(spar))));
        const e = square(p.hook.sub(spar)).unit();
        extra.push(
            ...basketedSling("climbing", level, r, p.hook, CARABINER_BAR, axis.cross(e), axis),
        );
    } else {
        const { base, out, toward } = hung.eyeBolt;
        const mount = base.add(out.unit().scale(EYE_BOLT.centre));
        // Where the carabiner's top bar sits: on the eye's bar, at the edge the pull draws it to (across the hole
        // from it, if the eye's turned flat), and on the far side of the bar from the pull.
        const hookIn = (pull: Vector3) => {
            const { o, m } = eyeFrame(out, toward ?? pull);
            const inPlane = pull.sub(m.scale(pull.dot(m)));
            const edge = inPlane.len() > 1e-6 ? inPlane.unit() : o;
            return mount.add(edge.scale(EYE_BOLT.r)).sub(pull.scale(EYE_BOLT.bar + CARABINER_BAR));
        };
        // Its carabiner's top in the eye, the way the pulley pulls.
        // Until it settles. Each move turns it, as its rope's angles change, and with the rope running off close by it
        // would swing past where it settles, so it moves only halfway each time.
        for (let i = 0; i < 100; i++) {
            // Through the eye like links of a chain: the carabiner's top bar rests on the eye's bar.
            const hook = hookIn(p.up.neg());
            const next = centre.lerp(hook.sub(p.hook.sub(centre)), 0.5);
            const moved = next.distanceTo(centre);
            centre = next;
            p = build(centre);
            if (moved < 1e-5) break;
        }
        extra.push(...eyeBolt(base, out, toward ?? p.up.neg(), C.steel).pieces);
    }
    return {
        pieces: [...p.pieces, ...extra],
        /** The pulley and its carabiner alone, without what it hangs from. */
        pulley: p.pieces,
        /** Where its carabiner hangs from, and which way is up from the pulley to it. */
        hook: p.hook,
        up: p.up,
        a: p.a,
        b: p.b,
        round: wrap(centre, p.a, p.b),
        centre,
    };
}

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

/**
 * The steel tower, with its platform, ladder, brake support and guys. It's built about its own middle and moved off the
 * hawsers' by `TOWER.z`; what's placed by the hawsers or elsewhere on the site (the saddles, the backstay to the tree)
 * and what's placed in the site's terms already (the brake support, the top bar's eye bolts) is added after.
 */
/**
 * The two guys from the tower's upright on side `s` (±1, before the tower's moved by `TOWER.z`): one out to the front
 * and one to the back, at 45° and 1.6 times the tower's height out each way (Figure 40). Each guy's loop is dropped
 * over the upright's top and slides down to the top cross bar, the second resting on the first where they cross.
 */
function towerGuys(s: number): Piece[] {
    const T = TOWER;
    const out = 1.6 * T.top;
    const barTop = T.bar + T.rhs.h / 2;
    const others: Vector3[][] = [];
    // Not into the top cross bar, on the uprights' front faces.
    const clear = (q: Vector3) =>
        q.y - 0.006 >= barTop || Math.abs(q.x - BAR_X) >= T.rhs.w / 2 + 0.006;
    const from = vec3(0, barTop + 0.006, s * T.half);
    return [-1, 1].flatMap((f) =>
        guy(
            from,
            vec3(f * out, 0, s * (T.half + out)),
            0.006,
            C.guy,
            [boxBar(from, UP, vec3(1, 0, 0), T.shs, T.shs)],
            { settle: { clear, others } },
        ),
    );
}

/**
 * The guys' loops at one of the tower's uprights on their own, for a close look: the upright's top, a short stub of
 * the top cross bar on its front face to its end just past the upright, and each guy's rope from its tail's end to a little way out from its knot.
 */
export function guyLoops(): Piece[] {
    const T = TOWER;
    const post = vec3(0, 0, T.half);
    const near = (q: Vector3) => Math.hypot(q.x, q.z - T.half) < 0.45;
    return [
        ...section(
            post.add(UP.scale(T.bar - 0.4)),
            post.add(UP.scale(T.top)),
            vec3(1, 0, 0),
            T.shs,
            T.shs,
        ),
        ...section(
            vec3(BAR_X, T.bar, T.half - 0.4),
            vec3(BAR_X, T.bar, T.barLength / 2),
            UP,
            T.rhs.w,
            T.rhs.h,
        ),
        ...towerGuys(1).flatMap((p): Piece[] =>
            p.kind === "strand" && p.points.some(near)
                ? [{ ...p, points: p.points.filter(near) }]
                : [],
        ),
    ];
}

/** Where brace `b` crosses height `y`, across the tower. */
const braceZ = (b: { foot: Vector3; top: Vector3 }, y: number) =>
    b.foot.z + ((b.top.z - b.foot.z) * (y - b.foot.y)) / (b.top.y - b.foot.y);

/** A steel plate `thick` thick cut to `outline` in frame `f` (u and v in its plane). */
const plateFaces = (
    f: Frame,
    outline: [number, number][],
    thick: number,
    color = C.steel,
): Piece[] => plate(f, outline, [], thick, color);

/** The braces' middles front to back: 50 deep, flush with the uprights' front faces. */
const BRACE_X = TOWER.shs / 2 - TOWER.rhs.w / 2;
/** How far in from the upright's middle each brace's foot ends, its middle, beside the upright between its plates. */
const BRACE_FOOT_IN = 0.11;

/**
 * A hawser guide on the top cross bar (Appendix E), its middle `z` across: 3 mm steel, a strap 50 mm wide over the bar,
 * its legs down the bar's front and back and clamped together under it by a 110 mm M16 bolt; on its top two cheeks 32 mm
 * apart and 100 mm long, the hawser sitting between them on a PTFE liner, a bolt across above it to keep it in.
 */
function hawserGuide(z: number): Piece[] {
    const T = TOWER;
    const sheet = 0.003;
    const barTop = T.bar + T.rhs.h / 2;
    const pieces: Piece[] = [];
    // The strap: over the top, and its legs 147 mm down the faces.
    pieces.push(
        ...section(
            vec3(BAR_X, barTop + sheet / 2, z - 0.025),
            vec3(BAR_X, barTop + sheet / 2, z + 0.025),
            UP,
            T.rhs.w + 0.005 + 2 * sheet,
            sheet,
        ),
    );
    for (const t of [-1, 1]) {
        const x = BAR_X + t * ((T.rhs.w + 0.005) / 2 + sheet / 2);
        pieces.push(
            ...section(
                vec3(x, barTop, z),
                vec3(x, barTop + sheet - 0.15, z),
                vec3(1, 0, 0),
                0.05,
                sheet,
            ),
        );
    }
    // The clamp bolt, 12 mm up from the legs' feet.
    pieces.push(
        ...throughBolt(
            vec3(BAR_X + (T.rhs.w + 0.005) / 2 + sheet, barTop + sheet - 0.15 + 0.012, z),
            vec3(-1, 0, 0),
            T.rhs.w + 0.005 + 2 * sheet,
            0.11,
            C.steel,
        ),
    );
    // The cheeks, rounded over the top and notched 55 mm wide and 40 mm deep underneath to sit over the bar and the
    // strap's legs: a flat-topped piece and a tab either side of the notch (each kept convex).
    const seat = barTop + sheet;
    const round = 0.012;
    const high = 0.045 - sheet;
    const corner = (cx: number, from: number): [number, number][] =>
        Array.from({ length: 5 }, (_, i) => {
            const a = from + (Math.PI / 2) * (i / 4);
            return [cx + round * Math.cos(a), high - round + round * Math.sin(a)];
        });
    const notch = 0.0275 + sheet;
    const shapes: [number, number][][] = [
        [[-0.05, 0], [0.05, 0], ...corner(0.05 - round, 0), ...corner(-0.05 + round, Math.PI / 2)],
        ...[-1, 1].map((t): [number, number][] => [
            [t * notch, -0.04],
            [t * 0.05, -0.04],
            [t * 0.05, 0],
            [t * notch, 0],
        ]),
    ];
    for (const t of [-1, 1])
        for (const shape of shapes)
            pieces.push(
                ...plateFaces(
                    {
                        o: vec3(BAR_X, seat, z + t * (0.016 + sheet / 2)),
                        u: vec3(1, 0, 0),
                        v: UP,
                        n: vec3(0, 0, t),
                    },
                    shape,
                    sheet,
                ),
            );
    // The liner: a PTFE sheet bent over the bar to a 50 mm radius, its crest just above the strap, so the hawser
    // bends smoothly over the guide; its ends drop past the bar's front and back.
    const arc = 0.05;
    const crest = CRADLE_Y - HAWSER_R;
    const centre = vec3(BAR_X, crest - arc, z);
    const reach = Math.asin(0.045 / arc);
    const along = Array.from({ length: 13 }, (_, i) => {
        const a = -reach + (2 * reach * i) / 12;
        return centre.add(vec3(Math.sin(a), Math.cos(a), 0).scale(arc - sheet / 2));
    });
    for (let i = 1; i < along.length; i++) {
        const mid = along[i - 1].lerp(along[i], 0.5);
        pieces.push(
            ...section(along[i - 1], along[i], mid.sub(centre).unit(), 0.032, sheet, C.nylon),
        );
    }
    // The bolt across above the hawser, towards the span.
    pieces.push(
        ...throughBolt(
            vec3(BAR_X + 0.025, crest + 0.022, z + 0.016 + sheet),
            vec3(0, 0, -1),
            0.032 + 2 * sheet,
            0.06,
            C.steel,
            M12,
        ),
    );
    return pieces;
}

/**
 * The tower's bolts (Appendix E's layout), M16 with a washer each side and a lock nut, in the tower's own frame: the
 * cross bars to the uprights (175 mm), the braces and the brake support's post to the cross bars (150 mm), the braces'
 * feet to the uprights through the brackets on their ends (150 mm), the extensions' joint plates (125 mm, four each side)
 * and the feet (125 mm, two each side). The top bar's bolts into the uprights carry the platform's stays' eyes and are
 * drawn with them.
 */
function towerBolts(braces: { s: number; foot: Vector3; top: Vector3 }[]): Piece[] {
    const T = TOWER;
    const pieces: Piece[] = [];
    const back = vec3(-1, 0, 0);
    const barFront = BAR_X + T.rhs.w / 2;
    // From the bar's front: through it and the upright or brace behind it (both 75 deep), or the post (50 deep).
    const throughBar = (y: number, z: number, grip: number, length: number) =>
        pieces.push(...throughBolt(vec3(barFront, y, z), back, grip, length, C.steel));
    for (const s of [-1, 1]) throughBar(T.lower, s * T.half, T.rhs.w + T.shs, 0.175);
    for (const y of [T.bar, T.lower]) {
        for (const b of braces) throughBar(y, braceZ(b, y), 2 * T.rhs.w, 0.15);
        throughBar(y, 0, 2 * T.rhs.w, 0.15);
    }
    for (const b of braces) {
        // The bracket on the brace's foot (Appendix E's "Diagonal Brace End"): a 10 mm plate either side of the upright,
        // 76 mm apart, 100 mm high, reaching from the bolt hole 38 mm in from their outer end along to the brace's end,
        // their inner end cut parallel to the brace; the brace welded in between them, a 25 mm spacer behind it.
        const plate = 0.01;
        const hole = vec3(0, T.braceFoot, b.s * T.half);
        const inward = vec3(0, 0, -b.s);
        const along = b.top.sub(b.foot).unit();
        const slant = (along.z * -b.s) / along.y;
        const outline: [number, number][] = [
            [-0.038, -0.05],
            [-0.038 + 0.195 - 0.05 * slant, -0.05],
            [-0.038 + 0.195 + 0.05 * slant, 0.05],
            [-0.038, 0.05],
        ];
        for (const t of [-1, 1])
            pieces.push(
                ...plateFaces(
                    {
                        o: hole.add(vec3(t * (0.038 + plate / 2), 0, 0)),
                        u: inward,
                        v: UP,
                        n: vec3(t, 0, 0),
                    },
                    outline,
                    plate,
                ),
            );
        // The spacer: RHS 75 × 25 behind the brace's end.
        pieces.push(
            ...section(
                b.foot.add(vec3(-T.rhs.w / 2 - 0.0125, 0, 0)),
                b.foot.add(along.scale(0.12)).add(vec3(-T.rhs.w / 2 - 0.0125, 0, 0)),
                vec3(1, 0, 0),
                T.rhs.h,
                0.025,
            ),
        );
        pieces.push(
            ...throughBolt(
                vec3(0.038 + plate, T.braceFoot, b.s * T.half),
                back,
                T.shs + 2 * plate + 0.001,
                0.15,
                C.steel,
            ),
        );
    }
    // The eye bolts 350 mm below the top bar's bolts, in the front of each brace (100 mm bolts) and of the brake
    // support's post (75 mm), for safety and belay lines; their nuts behind.
    const eyeY = T.bar - 0.35;
    for (const [z, length] of [...braces.map((b) => [braceZ(b, eyeY), 0.1]), [0, 0.075]]) {
        const base = vec3(T.shs / 2, eyeY, z);
        pieces.push(...eyeBolt(base, vec3(1, 0, 0), UP, C.steel, EYE_BOLT_M16).pieces);
        pieces.push(...throughBolt(base, back, T.rhs.w, length, C.steel, M16, false));
    }
    // Across the uprights: through the joint plates either side of the extension's joint, and through the feet.
    for (const s of [-1, 1]) {
        const across = (y: number, outside: number, grip: number) =>
            pieces.push(
                ...throughBolt(
                    vec3(0, y, s * T.half + outside),
                    vec3(0, 0, -1),
                    grip,
                    0.125,
                    C.steel,
                ),
            );
        for (const dy of [-0.25, -0.05, 0.05, 0.25])
            across(T.joint + dy, T.shs / 2 + 0.008, T.shs + 0.016);
        for (const y of [T.feet + 0.04, T.feet + 0.09]) across(y, T.shs / 2, T.shs);
    }
    return pieces;
}

function tower(): Piece[] {
    const T = TOWER;
    const pieces: Piece[] = [];
    const placed: Piece[] = [];
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
    // The diagonal braces, in the uprights' plane, from the uprights up to either side of the top bar's middle, their
    // tops standing a little above it.
    // RHS 75 × 50 laid 50 deep, flush with the uprights' fronts; each foot ends between its bracket's plates, beside
    // the upright.
    const braces = [-1, 1].map((s) => {
        const foot = vec3(BRACE_X, T.braceFoot, s * (T.half - BRACE_FOOT_IN));
        const head = vec3(BRACE_X, T.bar - 0.05, s * 0.15);
        const rise = T.bar + T.rhs.h / 2 + 0.06 - foot.y;
        const top = foot.lerp(head, rise / (head.y - foot.y));
        pieces.push(...section(top, foot, vec3(1, 0, 0), T.rhs.h, T.rhs.w));
        return { s, foot, top };
    });
    pieces.push(...towerBolts(braces));
    // The brake support: up the middle behind the bars (away from the platform), past the top bar, with an arm out at
    // its top carrying the brake line's pulley, back and to one side.
    const postX = T.shs / 2 - T.rhs.w / 2;
    const postTop = vec3(postX, BRAKE.postTop, T.z);
    placed.push(
        // 50 mm front to back, so it sits just behind the bars, 75 mm across.
        ...section(vec3(postX, T.lower - 0.135, T.z), postTop, vec3(1, 0, 0), T.rhs.h, T.rhs.w),
    );
    placed.push(...section(BRAKE.armStart, BRAKE.armEnd, UP, 0.05, 0.05));
    placed.push(...section(BRAKE.strut.from, BRAKE.strut.to, UP, 0.04, 0.04));
    // The brake pulley's eye bolt through the arm, nutted on top.
    placed.push(...throughBolt(BRAKE.eye, UP, 0.05, 0.075, C.steel, M12, false));
    // The platform: an aluminium frame on the bottom bar, its floor a grate, its front corners chained up to the top
    // bar's outer eye bolts from eye bolts of their own.
    // The frame's 50 mm box section, its top flush with the floor; its back against the uprights' front faces, the
    // platform's depth and width to the frame's outsides.
    const box = 0.05;
    const floor = T.lower + T.rhs.h / 2 + box;
    const [back, front] = [TOWER.shs / 2 + box / 2, TOWER.shs / 2 + T.platform.depth - box / 2];
    const w = T.platform.width / 2 - box / 2;
    // Its two ends' middles, across the tower.
    const [lo, hi] = [-w + T.platform.shift, w + T.platform.shift];
    const y = floor - box / 2;
    // Front and back run the full width, the ends between them.
    for (const [a, b] of [
        [vec3(back, y, lo - box / 2), vec3(back, y, hi + box / 2)],
        [vec3(front, y, lo - box / 2), vec3(front, y, hi + box / 2)],
        [vec3(back + box / 2, y, lo), vec3(front - box / 2, y, lo)],
        [vec3(back + box / 2, y, hi), vec3(front - box / 2, y, hi)],
    ])
        pieces.push(...section(a, b, UP, box, box));
    // The grate, filling the frame's opening.
    const [gx0, gx1, gz0, gz1] = [back + box / 2, front - box / 2, lo + box / 2, hi - box / 2];
    pieces.push({
        kind: "face",
        points: [
            vec3(gx0, floor, gz0),
            vec3(gx1, floor, gz0),
            vec3(gx1, floor, gz1),
            vec3(gx0, floor, gz1),
        ],
        material: "steel",
        color: C.grate,
        planks: 0.15,
        joints: ACROSS,
    });
    // The stays (Appendix E): 6 mm chain from an M16 eye bolt in each of the frame's front corners up to another on
    // the bolt through the top bar and its upright on that side, each eye turned to the stay.
    for (const [s, z] of [
        [-1, lo],
        [1, hi],
    ]) {
        const base = vec3(front, floor, z + T.z);
        const topBase = topEye(s * T.half);
        const top = eyeBolt(topBase, vec3(1, 0, 0), base.sub(topBase), C.steel, EYE_BOLT_M16);
        const toTop = top.eye.sub(base);
        const corner = eyeBolt(base, UP, toTop, C.steel, EYE_BOLT_M16);
        placed.push(...top.pieces, ...corner.pieces);
        // The eye bolt's the bolt through the bar and the upright: its nut on the upright's back.
        placed.push(
            ...throughBolt(topBase, vec3(-1, 0, 0), T.rhs.w + T.shs, 0.175, C.steel, M16, false),
        );
        placed.push(
            ...chainStay(
                { eye: top.eye, m: eyeFrame(vec3(1, 0, 0), base.sub(topBase)).m },
                { eye: corner.eye, m: eyeFrame(UP, toTop).m },
            ),
        );
    }
    // A ladder up from the front, as in the photos: resting against the bottom bar's free end, between the platform and
    // the upright on hawser B's side, its rails running on past the bar to hold onto as you step across.
    const ladderZ = (lo - box / 2 - T.half) / 2;
    // At the ideal 4 to 1: its foot out a quarter of the height it rests at.
    const rest = vec3(BAR_X + T.rhs.w / 2 + 0.025, T.lower + T.rhs.h / 2, ladderZ);
    const ladderFoot = onGround(rest.x + rest.y / 4, 0, ladderZ);
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
    // The return line's pulleys' eye bolts through the top bar, nutted behind it.
    for (const s of [-1, 1])
        placed.push(
            ...throughBolt(
                topEye(s * RETURN_EYE_Z),
                vec3(-1, 0, 0),
                T.rhs.w,
                0.075,
                C.steel,
                M12,
                false,
            ),
        );
    for (const s of [-1, 1]) placed.push(...hawserGuide(s * HAWSER_Z));
    // Guys from the uprights' tops, and the backstay from the joint of the top bar and the brake support's post back to
    // the tree.
    for (const s of [-1, 1]) pieces.push(...towerGuys(s));
    placed.push(
        ...line(
            [
                ...BACKSTAY_TOWER_TIE.rope,
                ...hanging(BACKSTAY_TOWER_TIE.end, BACKSTAY_TIE.end, 0.08, 20),
                ...BACKSTAY_TIE.rope.slice().reverse(),
            ],
            0.0065,
            C.backstay,
            "rope",
            { a: true, b: true },
        ),
    );
    return [...moved(pieces, vec3(0, 0, T.z)), ...placed];
}

/** The return line's pulley on side `s` (+1 for hawser A's side), under the top bar. */
export const RETURN_PULLEY = (s: number) => vec3(0.15, TOWER.bar - 0.2, TOWER.z + s * RETURN_EYE_Z);

/**
 * How far the return line's pulleys' eye bolts are from the tower's middle, in the top cross bar's platform side, their
 * eyes lying flat (their holes upright). The platform's stays hang from the bolts through the bar into the uprights.
 */
const RETURN_EYE_Z = 1.35;
/** Where an eye bolt in the top bar's platform side screws in, `z` from the tower's middle. */
const topEye = (z: number) => vec3(BAR_X + TOWER.rhs.w / 2, TOWER.bar, TOWER.z + z);

/** The chain brake: the brake support's top and arm, its pulley, and the chain weight hanging below it. */
export const BRAKE = (() => {
    // Appendix E's brake support: the post's top 615 mm above the top bar's bolt, an arm out level from it (its top
    // flush with the post's), diagonally back and to one side, 450 mm each way, braced by a strut from 300 mm down the
    // post to 350 mm (of the 450) out along the arm.
    const postTop = TOWER.bar + 0.615;
    const postX = TOWER.shs / 2 - TOWER.rhs.w / 2;
    const along = vec3(-1, 0, 1).unit();
    const length = 0.45 * Math.SQRT2;
    const armStart = vec3(postX, postTop - 0.025, TOWER.z);
    const armEnd = armStart.add(along.scale(length));
    // The eye bolt through the hole at the arm's end, in its underside.
    const eye = armEnd.sub(along.scale(0.025)).add(vec3(0, -0.025, 0));
    const pulley = eye.add(vec3(0, -0.215, 0));
    return {
        postTop,
        armStart,
        armEnd,
        strut: {
            from: vec3(postX, postTop - 0.3, TOWER.z),
            to: armStart.add(along.scale((length * 0.35) / 0.45)).add(vec3(0, -0.025, 0)),
        },
        eye,
        pulley,
        /** Where the brake line ends, tied into the chain weight's shackle, its ring just clear of the heap. */
        chainTop: onGround(pulley.x - 0.05, 0.5, pulley.z),
    };
})();

/** The tree, its bagging, and the two slings round it the hawsers are shackled to. */
function tree(): Piece[] {
    const c = vec3(TREE.x, 0, 0);
    const pieces: Piece[] = [];
    const branches: Piece[] = [];
    pieces.push(
        ...bar(c.add(vec3(0, -0.2, 0)), c.add(vec3(0, TREE.height, 0)), TREE.r, C.tree, "log"),
    );
    for (const [y, dir, r, len] of [
        [5.5, vec3(1, 0.9, 0.4), 0.16, 4],
        [6.5, vec3(-0.8, 1, -0.6), 0.14, 3.5],
        [7.6, vec3(0.3, 1, -1), 0.12, 3],
    ] as const)
        branches.push(
            ...bar(
                c.add(vec3(0, y, 0)),
                c.add(vec3(0, y, 0)).add(dir.unit().scale(len)),
                r,
                C.tree,
                "log",
            ),
        );
    // A round sling choked round the trunk for each hawser, the choke where its hawser's line touches the trunk, on
    // the hawser's own side of the tree, so the two lead off either side of it.
    for (const s of [-1, 1]) {
        // Built on level ground, and put on the ground at the tree at the end.
        const shackle = TREE_SHACKLE(s).add(vec3(0, -groundY(TREE.x), 0));
        const { angle, turn, at } = TREE_CHOKE(s);
        const y = at.y - groundY(TREE.x);
        pieces.push(...chokedSling(angle, turn, y, TREE_WRAP_R(s), shackle));
    }
    // The backstay's own sling, basketed round the trunk above the others, up into a bow shackle in line with the
    // backstay, which is tied to the shackle's pin.
    const g = vec3(0, -groundY(TREE.x), 0);
    const { crown, along: toTower } = BACKSTAY_SHACKLE;
    // Standing on edge, its crown bar upright, so the sling's strands, on edge round the trunk, lie flat round it.
    const { upright } = linkPlanes(toTower);
    const bow = shackle("bow", crown.add(g), toTower, upright, C.steel, C.pin);
    pieces.push(...bow.pieces);
    const centre = vec3(TREE.x, BACKSTAY_SLING_Y, 0);
    const crownBar = crown.add(g).sub(toTower.scale(SHACKLE_19.body));
    pieces.push(...basketedSling("round", centre, TREE.r, crownBar, SHACKLE_19.body, ACROSS, UP));
    // The branches are left out of the overhead view, where they'd hide the slings round the trunk.
    const up = shift(branches, groundY(TREE.x));
    for (const b of up) NOT_OVERHEAD.add(b);
    return [...shift(pieces, groundY(TREE.x)), ...up];
}

/** Pieces left out of the overhead view. */
const NOT_OVERHEAD = new WeakSet<Piece>();
/** Whether `piece` (one of `foxPieces`) is drawn in the overhead view. */
export const drawnOverhead = (piece: Piece) => !NOT_OVERHEAD.has(piece);

/**
 * A taut stay of chain between two M16 eye bolts' eyes (`m` the way through each eye's hole): a 6 mm D shackle at each,
 * its pin through the eye's ring and its crown through the chain's end link (Appendix E). The book's 6 mm shackle is a
 * little narrow between its ears for the M16 eye's 14 mm ring, so they overlap by a millimetre either side. The chain has an odd number of links, so its
 * end links lie the same way and both shackles stand square to their rings; it's stretched or shortened a hair to fit.
 */
function chainStay(a: { eye: Vector3; m: Vector3 }, b: { eye: Vector3; m: Vector3 }): Piece[] {
    const [size, shackleSize, eyeSize] = [CHAIN_G80_6, SHACKLE_6, EYE_BOLT_M16];
    // Where each shackle's pin is: through the eye's hole, bearing on the inside of the ring on the side towards the
    // other end.
    const pinAt = (e: typeof a, to: Vector3) => {
        const dir = to.sub(e.eye);
        const inRing = dir.sub(e.m.scale(dir.dot(e.m))).unit();
        return e.eye.add(inRing.scale(eyeSize.r - eyeSize.bar - shackleSize.pin));
    };
    const [pinA, pinB] = [pinAt(a, b.eye), pinAt(b, a.eye)];
    const u = pinB.sub(pinA).unit();
    // Each shackle's crown towards the chain, the inside of the end link's end resting on the inside of the crown.
    const reach = shackleSize.length + shackleSize.pin;
    const [startA, startB] = [pinA.add(u.scale(reach)), pinB.sub(u.scale(reach))];
    const span = startA.distanceTo(startB);
    const links = 2 * Math.round((span / size.length - 1) / 2) + 1;
    // The links lie alternately square to the top ring and in line with it: the end links square to the shackles'
    // pins, which run through the rings.
    const face = u.cross(a.m);
    const ends = [
        shackle("d", startA, u.neg(), face.neg(), C.steel, C.pin, shackleSize),
        shackle("d", startB, u, face, C.steel, C.pin, shackleSize),
    ];
    const laid = chain([startA, startB], face, C.steel, { ...size, length: span / links });
    return [...ends.flatMap((e) => e.pieces), ...laid.pieces];
}

/** How high on the trunk the backstay's own sling is, just above the hawsers'. */
const BACKSTAY_SLING_Y = 0.7;
/** The back of the brake support's post up the tower's middle, just behind the top cross bar (`rhs.w` deep). */
const POST_BACK = TOWER.shs / 2 - TOWER.rhs.w;
/** The front of the top cross bar, on the uprights' front faces. */
const BAR_FRONT = BAR_X + TOWER.rhs.w / 2;
/**
 * The backstay's top end: the joint of the top cross bar and the brake support's post behind it, at the middle of the
 * two together, which its loop wraps diagonally.
 */
const BACKSTAY_TOP = vec3((POST_BACK + BAR_FRONT) / 2, TOWER.bar, TOWER.z);
/**
 * The line the backstay's loop wraps round at that joint: diagonal, so the loop goes past the post above the bar on one
 * side, across the bar's front and back past the post below it on the other.
 */
const BACKSTAY_WRAP = vec3(0, 1, -1).unit();
/** What the backstay's loop goes round: the top cross bar and the brake support's post behind it, both `rhs`. */
const BACKSTAY_AROUND = [
    boxBar(vec3(BAR_X, TOWER.bar, TOWER.z), ACROSS, vec3(1, 0, 0), TOWER.rhs.w, TOWER.rhs.h),
    boxBar(
        vec3(POST_BACK + TOWER.rhs.w / 2, TOWER.bar, TOWER.z),
        UP,
        vec3(1, 0, 0),
        TOWER.rhs.w,
        TOWER.rhs.h,
    ),
];
/**
 * The bow shackle on the backstay's sling: its crown's inside out in front of the tree, straight towards the
 * backstay's top end, so the sling, the shackle and the backstay line up; and the way along it.
 */
const BACKSTAY_SHACKLE = (() => {
    const centre = vec3(TREE.x, groundY(TREE.x) + BACKSTAY_SLING_Y, 0);
    const along = BACKSTAY_TOP.sub(centre).unit();
    return { crown: centre.add(along.scale(TREE.r + 0.45)), along };
})();
/** The backstay's figure 8 on a bight at the tower, its big loop wrapped diagonally round the bar's joint. */
const BACKSTAY_TOWER_TIE = (() => {
    const pin = BACKSTAY_SHACKLE.crown.add(BACKSTAY_SHACKLE.along.scale(SHACKLE_19.length));
    return figure8(BACKSTAY_TOP, BACKSTAY_WRAP, 0, pin, 0.0065, BIG_LOOP, BACKSTAY_AROUND);
})();

/**
 * The backstay's figure 8 on a bight at the tower on its own, for a close look: a short stub of the top cross bar and
 * of the brake support's post, and the rope from the tail's end to a little way down the backstay.
 */
export function backstayLoop(): Piece[] {
    const [bar, post] = [vec3(BAR_X, TOWER.bar, TOWER.z), BACKSTAY_AROUND[1]];
    const postAt = vec3(POST_BACK + TOWER.rhs.w / 2, TOWER.bar, TOWER.z);
    const { rope, end } = BACKSTAY_TOWER_TIE;
    const along = BACKSTAY_TIE.end.sub(end).unit();
    return [
        ...section(
            bar.add(ACROSS.scale(-0.3)),
            bar.add(ACROSS.scale(0.3)),
            UP,
            TOWER.rhs.w,
            TOWER.rhs.h,
        ),
        ...section(
            postAt.add(post.along.scale(-0.3)),
            postAt.add(post.along.scale(0.3)),
            vec3(1, 0, 0),
            TOWER.rhs.h,
            TOWER.rhs.w,
        ),
        ...line([...rope, end.add(along.scale(0.3))], 0.0065, C.backstay, "rope", { a: true }),
    ];
}

/** The backstay's figure 8 on a bight, tied into its shackle's pin. */
const BACKSTAY_TIE = (() => {
    const { crown, along } = BACKSTAY_SHACKLE;
    const { upright } = linkPlanes(along);
    const pin = crown.add(along.scale(SHACKLE_19.length + SHACKLE_19.pin));
    return figure8(pin, upright.cross(along), SHACKLE_19.pin, BACKSTAY_TOP, 0.0065);
})();

/**
 * A round sling choked round the trunk, the hawser's line touching the trunk at `angle` round it (the sling arriving
 * there heading out going `turn` round) at height `y`, out to the bow shackle whose crown's inside is at `crown` (the
 * shackle lying flat, its crown bar level and square to the leg). The loop goes round the trunk from the far side of
 * its choke, out along the leg towards the shackle, and through its own bight, the choke, `TREE_CHOKE_AT` of the way
 * out, which squeezes the leg's two strands together. Followed round: from the crown along the leg's top strand to the
 * trunk, the long way round the tree, out from its far side to the choke, round the leg in a flat bight and back, round
 * the tree again the other way, and out along the leg's bottom strand to the crown, round its far side and back. Round
 * the trunk the strands lie on edge one above the other; the leg twists a quarter turn to lie flat through the bow,
 * bunching up into it, and the choke's bight twists to lie flat round the leg.
 */
function chokedSling(angle: number, turn: number, y: number, R: number, crown: Vector3): Strand[] {
    const { width, thickness, r, color, bunched } = SLINGS.round;
    const ease = (t: number) => t * t * (3 - 2 * t);
    const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
    const onTrunk = (a: number, h: number) => vec3(TREE.x + R * Math.cos(a), h, R * Math.sin(a));
    const apart = (width + 0.004) / 2;
    const touch = onTrunk(angle, y);
    const d = crown.sub(touch).unit();
    const { flat: up } = linkPlanes(d);
    const w = up.cross(d);
    const barR = SHACKLE_19.body;
    const bar = crown.sub(d.scale(barR));
    const rb = barR + bunched.thickness / 2;
    const legLength = touch.distanceTo(bar);
    // The choke, out along the leg, where the leg's strands are squeezed together.
    const sA = TREE_CHOKE_AT;
    const choke = touch.lerp(bar, sA);
    const squeezed = { width: 0.036, thickness: 0.018, apart: 0.012 };
    // Seen from above, the other line from the choke that just touches the trunk: where the loop leaves the trunk.
    const plan = Math.hypot(choke.x - TREE.x, choke.z);
    const wedge = 2 * Math.acos(R / plan);
    const far = angle - turn * (2 * Math.PI - wedge);
    const leaves = onTrunk(far, y);
    // Out from the trunk at the choke, away from the trunk, square to the leg.
    const outward = w.scale(Math.sign(w.dot(choke.sub(vec3(TREE.x, choke.y, 0)))));
    const pts: Vector3[] = [];
    const sizes: TapeSize[] = [];
    const push = (q: Vector3, across: Vector3, size = { width, thickness }) => {
        pts.push(q);
        sizes.push({ ...size, across });
    };
    // A leg strand at `s` of the way from the trunk to the crown, above the middle (`k` 1) or below.
    const legPoint = (k: number, s: number) => {
        const off =
            s < sA
                ? apart + (squeezed.apart - apart) * ease(s / sA)
                : squeezed.apart + (rb - squeezed.apart) * ease((s - sA) / (1 - sA));
        const side = UP.lerp(up, ease(s)).unit();
        const twist = (Math.PI / 2) * ease(s);
        // Squeezed round the choke, bunched into the crown.
        const g = ease(clamp01((Math.abs(s - sA) * legLength) / 0.08));
        const c = ease(
            clamp01((bar.distanceTo(touch.lerp(bar, s)) - 0.2 * bunched.over) / bunched.over),
        );
        const [tw, tt] = [
            Math.min(
                squeezed.width + (width - squeezed.width) * g,
                bunched.width + (width - bunched.width) * c,
            ),
            Math.max(
                squeezed.thickness + (thickness - squeezed.thickness) * g,
                bunched.thickness + (thickness - bunched.thickness) * c,
            ),
        ];
        push(
            touch.lerp(bar, s).add(side.scale(k * off)),
            UP.scale(Math.cos(twist)).add(w.scale(Math.sin(twist))),
            { width: tw, thickness: tt },
        );
    };
    const leg = (k: number, out: boolean) => {
        for (let i = 0; i <= 24; i++) legPoint(k, out ? i / 24 : 1 - i / 24);
    };
    // Round the trunk from angle `a0` to `a1`, `h` above or below the middle. The loop round the trunk lies in the plane
    // of the leg and the other line to the choke, which both pull towards the choke: tilted, so it meets both without
    // a corner and is lowest round the back.
    const tilt = choke.sub(touch).cross(choke.sub(leaves));
    const planeY = (x: number, z: number) =>
        choke.y - (tilt.x * (x - choke.x) + tilt.z * (z - choke.z)) / tilt.y;
    const round = (a0: number, a1: number, h: number) => {
        for (let i = 1; i < 30; i++) {
            const q = onTrunk(a0 + ((a1 - a0) * i) / 30, 0);
            push(vec3(q.x, planeY(q.x, q.z) + h, q.z), UP);
        }
    };
    // The choke's bight round the squeezed leg: a smooth curve, open towards the trunk, lying flat along the leg.
    const high = squeezed.apart + squeezed.width / 2 + thickness / 2 + 0.003;
    const reach = squeezed.width / 2 + thickness / 2 + 0.003;
    const bightPoint = (phi: number) =>
        choke
            .add(up.scale(high * Math.cos(phi)))
            .add(outward.scale(reach * (1.65 * Math.sin(phi) - 0.5)));
    // Between the trunk and the choke, along the other line, twisting a quarter turn smoothly all the way from where
    // it leaves the trunk to the bight.
    const across = (from: Vector3, to: Vector3, toChoke: boolean) => {
        for (let i = 1; i < 20; i++) {
            const t = i / 20;
            const twist = ease(toChoke ? t : 1 - t);
            push(from.lerp(to, t), UP.lerp(d, twist).unit());
        }
    };
    // From the crown along the leg's top strand to the trunk, the long way round to the far side.
    leg(1, false);
    round(angle, far, apart);
    push(leaves.add(UP.scale(apart)), UP);
    // Out to the choke, round the leg and back.
    across(leaves.add(UP.scale(apart)), bightPoint(0), true);
    for (let i = 0; i <= 16; i++) push(bightPoint((Math.PI * i) / 16), d);
    across(bightPoint(Math.PI), leaves.sub(UP.scale(apart)), false);
    push(leaves.sub(UP.scale(apart)), UP);
    // Round the trunk again the other way, and out along the leg's bottom strand to the crown.
    round(far, angle, -apart);
    leg(-1, true);
    // Round the crown's far side, from its bottom to its top, back to the start.
    for (let i = 1; i < 12; i++) {
        const t = -Math.PI / 2 + (Math.PI * i) / 12;
        push(bar.add(d.scale(rb * Math.cos(t))).add(up.scale(rb * Math.sin(t))), w, bunched);
    }
    push(pts[0], sizes[0].across!, sizes[0]);
    return [...tapeRun(pts, sizes, w, color, r), ...stripes(pts, sizes, w)];
}

/** How far out along a tree sling's leg, from the trunk towards the shackle, its choke sits. */
const TREE_CHOKE_AT = 0.5;

/** How high on the trunk both slings are choked, level with each other so the hawsers lie alike. */
const TREE_SLING_Y = 0.42;
/**
 * The radius hawser `s`'s sling round the trunk lies at: the trunk's, out to the middle of the sling's thickness. The
 * two cross round the back, hawser A's over hawser B's, so it lies a layer further out.
 */
const TREE_WRAP_R = (s: number) => TREE.r + SLINGS.round.thickness * (s > 0 ? 1.5 : 0.5);
/** How far each tree sling's choke is from its shackle (the inside of the bow's crown). */
const TREE_LEG = 0.7;
/**
 * Where hawser `s`'s sling is choked round the trunk: seen from above, where the line from its cradle on the tower
 * just touches the sling round the trunk, on the hawser's own side, so the sling leaves the trunk in line with the
 * hawser. Its angle round the trunk (anticlockwise from +x, seen with +z towards that angle's sine), which way round
 * the sling runs to arrive there heading out (`turn`, ±1), and the point, at the sling's height.
 */
const TREE_CHOKE = (s: number) => {
    const [cx, cz] = [BAR_X - TREE.x, s * HAWSER_Z];
    const d = Math.hypot(cx, cz);
    const R = TREE_WRAP_R(s);
    const angle = Math.atan2(cz, cx) + s * Math.acos(R / d);
    const at = vec3(
        TREE.x + R * Math.cos(angle),
        groundY(TREE.x) + TREE_SLING_Y,
        R * Math.sin(angle),
    );
    // Heading round the trunk anticlockwise at the choke is (-sin, cos); the sling arrives heading towards the cradle.
    const heading = -Math.sin(angle) * (cx + TREE.x - at.x) + Math.cos(angle) * (cz - at.z);
    return { angle, turn: Math.sign(heading), at };
};
/**
 * Where hawser `s`'s eye is shackled to its sling round the tree: out from the choke along the line to the hawser's
 * cradle on the tower, so the sling's leg, the shackle and the hawser line up.
 */
export const TREE_SHACKLE = (s: number) => {
    const { at } = TREE_CHOKE(s);
    const cradle = vec3(BAR_X, CRADLE_Y, s * HAWSER_Z);
    return at.add(cradle.sub(at).unit().scale(TREE_LEG));
};

/**
 * The two guys from the shear leg's upright on side `s` (±1): from its top, at 45° out to the front and back, 1.6 times
 * its height each way (Figure 34). Each loop's dropped over the upright's top and slides down onto the top spar's
 * square lashing, the second resting on the first where they cross.
 */
function shearLegGuys(s: number): Piece[] {
    const L = SHEAR_LEG;
    const g = groundY(L.x);
    const half = L.b / 2;
    const sparX = L.x + 2 * L.r;
    const out = 1.6 * L.top;
    const r = 0.006;
    // The lashing's outermost turn round the upright, above the spar.
    const lashingTop = g + L.spar + L.r + LASHING_R + 3 * 2 * LASHING_R + LASHING_R;
    // Above the lashing where it's round the upright, and clear of the spar.
    const clear = (q: Vector3) =>
        (Math.hypot(q.x - L.x, q.z - s * half) > L.r + 0.05 || q.y - r >= lashingTop) &&
        Math.hypot(q.x - sparX, q.y - (g + L.spar)) >= L.r + r;
    const settle = { clear, others: [] as Vector3[][] };
    const from = vec3(L.x, lashingTop + r, s * half);
    return [-1, 1].flatMap((f) =>
        guy(from, vec3(L.x + f * out, 0, s * (half + out)), r, C.guy, [roundBar(from, UP, L.r)], {
            settle,
        }),
    );
}

/**
 * The guys' loops at one of the shear leg's uprights on their own, for a close look: the upright's top, a short stub
 * of the top spar to its end past the upright, the square lashing where they cross, and each guy's rope from its
 * tail's end to a little way out from its knot.
 */
export function shearLegGuyLoops(): Piece[] {
    const L = SHEAR_LEG;
    const g = groundY(L.x);
    const half = L.b / 2;
    const sparX = L.x + 2 * L.r;
    const near = (q: Vector3) => Math.hypot(q.x - L.x, q.z - half) < 0.45;
    return [
        ...bar(vec3(L.x, g + L.spar - 0.4, half), vec3(L.x, g + L.top, half), L.r, C.spar, "log"),
        ...bar(
            vec3(sparX, g + L.spar, half - 0.4),
            vec3(sparX, g + L.spar, half + 0.4),
            L.r,
            C.spar,
            "log",
        ),
        ...squareLashing(
            vec3(L.x, g + L.spar, half),
            L.r,
            vec3(sparX, g + L.spar, half),
            L.r,
            UP,
            ACROSS,
        ),
        ...shearLegGuys(1).flatMap((p): Piece[] =>
            p.kind === "strand" && p.points.some(near)
                ? [{ ...p, points: p.points.filter(near) }]
                : [],
        ),
    ];
}

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
    for (const s of [-1, 1]) frame.push(...shearLegGuys(s));
    return frame;
}

/** Where a hawser comes down from the shear leg to the anchor: from the saddle to the bow shackle on its sling. */
export const SADDLE = (s: number) => vec3(SPAR_X, SADDLE_Y, s * HAWSER_Z);
/**
 * Where each sling round the log is, in the gaps between its six pickets (Figure 29, dual hawser and tension setup):
 * the hawsers' in the second and fourth gaps, the Tirfor's in the middle one.
 */
export const SLING_Z = 0.4;
/** The log's middle at `z`, the log resting on the slings under it. */
const LOG_AT = (z: number) => vec3(LOG.x, groundY(LOG.x) + LOG.r + 2 * SLINGS.round.thickness, z);
/** How far out in front of the log's middle each sling's shackle is (the inside of its crown). */
const SLING_REACH = 0.8;
/**
 * Where the sling round the log at `z` is shackled (the inside of the bow shackle's crown): out from the log straight
 * towards the saddle its hawser comes from, so the log, the sling, the hardware and the hawser all line up. The Tirfor's
 * points midway between the two.
 */
export const ANCHOR_SHACKLE = (z: number) => {
    const log = LOG_AT(z);
    const saddle = vec3(SADDLE(1).x, SADDLE(1).y, (z / SLING_Z) * HAWSER_Z);
    return log.add(saddle.sub(log).unit().scale(SLING_REACH));
};

/**
 * How far in front of the log's middle the front pickets are driven: leaning back 25°, they bite a little into the log
 * at its middle's height.
 */
const FRONT_PICKET = 0.14;

/** The log and picket anchor: the log, two rows of six pickets with banjo lashings, and three slings round it. */
function logAnchor(): Piece[] {
    const pieces: Piece[] = [];
    const y = LOG_AT(0).y;
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
        // The front row just on the pull's side of the log, the back row 0.45 m behind it.
        const front = picket(vec3(LOG.x - FRONT_PICKET, 0, z), back);
        const rear = picket(vec3(LOG.x + 0.45, 0, z), back);
        pieces.push(...front.pieces, ...rear.pieces);
        // A banjo lashing from the front picket, just above the log, to the back one's foot.
        const above = groundY(LOG.x) + LOG.r * 1.6 + 0.1;
        const high = front.tie.lerp(front.top, (above - front.tie.y) / (front.top.y - front.tie.y));
        for (const dz of [-0.012, 0.012])
            pieces.push(
                ...line(
                    [high.add(vec3(0, 0, dz)), rear.tie.add(vec3(0, -0.04, dz))],
                    0.006,
                    C.fibre,
                    "sling",
                ),
            );
    }
    // Round slings basketed round the log between the pickets, up into the bow shackles: one for each hawser and one
    // for the Tirfor.
    for (const z of [-SLING_Z, SLING_Z]) {
        const crown = ANCHOR_SHACKLE(z);
        const log = LOG_AT(z);
        const bar = crown.sub(crown.sub(log).unit().scale(SHACKLE_19.body));
        pieces.push(...basketedSling("round", log, LOG.r, bar, SHACKLE_19.body, UP, vec3(0, 0, 1)));
    }
    // The Tirfor's, in the bowl of its anchor hook.
    const { hook: h } = TIRFOR_RIG;
    pieces.push(
        ...basketedSling("round", LOG_AT(0), LOG.r, h.bar, ANCHOR_HOOK.r, UP, vec3(0, 0, 1)),
    );
    return pieces;
}

/** Where a made-off eye's three double base clamps are, from the thimble's point along the hawser (Figure 66). */
const EYE_CLAMPS = [0.1, 0.25, 0.4];

/**
 * A level frame for a line of hardware along `along`: `flat` square to the links that lie flat, `upright` square to
 * the ones that stand on edge between them.
 */
function linkPlanes(along: Vector3): { flat: Vector3; upright: Vector3 } {
    const d = along.unit();
    const flat = UP.sub(d.scale(UP.dot(d))).unit();
    return { flat, upright: d.cross(flat) };
}

/**
 * A hawser's end made off round a thimble: the thimble's crown hooked on at `near`, its point along `along`, lying
 * square to `m`; the hawser's eye round it, its live part on to `live`, and its dead end back beside the live part
 * through three double base clamps and on through `tail` (given the dead end's last point and the way across from the
 * live part to the dead).
 */
function madeOff(
    near: Vector3,
    along: Vector3,
    m: Vector3,
    live: Vector3,
    tail: (end: Vector3, side: Vector3) => Vector3[],
): Piece[] {
    const d = along.unit();
    const th = thimble(near, d, m, HAWSER_R, C.steel, baseClampWire(HAWSER_R));
    const [first, last] = [th.wire[0], th.wire.at(-1)!];
    const tip = first.lerp(last, 0.5);
    const pieces: Piece[] = [...th.pieces];
    for (const k of EYE_CLAMPS)
        pieces.push(...baseClamp(tip.add(d.scale(k)), d, th.side, HAWSER_R, C.steel));
    const deadEnd = last.add(d.scale(EYE_CLAMPS.at(-1)! + 0.1));
    const path = [
        ...tail(deadEnd, th.side).reverse(),
        deadEnd,
        last,
        ...th.wire.slice(1, -1).reverse(),
        first,
        live,
    ];
    pieces.push(...line(path, HAWSER_R, C.hawser, "steel"));
    return pieces;
}

/**
 * A hawser's bottom end: from the saddle down to the anchor through its in-line hardware (Figure 66), from the sling a
 * 19 mm bow shackle, the 24 mm turnbuckle, three 19 mm D shackles, then the hawser's eye made off round its thimble,
 * its tail lying on the ground. Each link lies a quarter turn from the last.
 */
/**
 * The in-line hardware at hawser `s`'s foot (Figure 66), from the sling: a 19 mm bow shackle, the 24 mm turnbuckle and
 * three 19 mm D shackles, each link a quarter turn from the last (the turnbuckle's frame turned flat, to show from
 * above).
 */
function footLinks(s: number) {
    const a = ANCHOR_SHACKLE(s * SLING_Z);
    const along = SADDLE(s).sub(a).unit();
    const { flat, upright } = linkPlanes(along);
    const bow = shackle("bow", a, along, flat, C.steel, C.pin);
    // Its frame turned flat, so it shows from above.
    const tb = turnbuckle(bow.far, along, upright, C.steel, { turned: true });
    const d1 = shackle("d", tb.far, along, flat, C.steel, C.pin);
    const d2 = shackle("d", d1.far, along, upright, C.steel, C.pin);
    const d3 = shackle("d", d2.far, along, flat, C.steel, C.pin);
    return { along, flat, upright, bow, tb, d1, d2, d3 };
}

function hawserFoot(s: number): Piece[] {
    const pieces: Piece[] = [];
    const saddle = SADDLE(s);
    const { along, upright, bow, tb, d1, d2, d3 } = footLinks(s);
    pieces.push(...bow.pieces, ...tb.pieces, ...d1.pieces, ...d2.pieces, ...d3.pieces);
    pieces.push(
        ...madeOff(d3.far, along, upright, saddle, (end) => {
            // The stiff wire carries on up the hawser's line, bends over in one long curve to the ground, and lies
            // there curving gently out to the hawser's own side.
            const out = vec3(-1, 0, s * 0.2).unit();
            const land = onGround(end.x - 2.0, HAWSER_R, end.z + s * 0.25);
            const rest = onGround(land.x - 1.0, HAWSER_R, land.z + s * 0.35);
            const drop = bezier3(
                end,
                end.add(along.scale(0.4)),
                land.sub(out.scale(0.9)),
                land,
                24,
            );
            const lie = bezier3(
                land,
                land.add(out.scale(0.4)),
                rest.sub(vec3(-0.35, 0, s * 0.2)),
                rest,
                16,
            );
            return [...drop.slice(1), ...lie.slice(1)];
        }),
    );
    return pieces;
}

/** Where the turnbuckle is on hawser `s`'s in-line hardware, for its label: a little out from the anchor. */
export const TURNBUCKLE_AT = (s: number) => {
    const a = ANCHOR_SHACKLE(s * SLING_Z);
    return a.add(SADDLE(s).sub(a).unit().scale(0.35));
};

/**
 * The lizards, one clamped on each hawser well up from the anchor (`clamps`, metres up the hawser from its bow shackle),
 * the wire running on `tail` past the top clamp to its free eye, and `hang` of it between the bottom clamp and the
 * bottom eye. Hawser A's is left slack in line to the Tirfor as a back-up once the hardware takes the load.
 */
export const LIZARD = { clamps: [5.0, 5.15, 5.3], tail: 0.5, hang: 0.5 };
/** The lizard's wire's radius. */
const LIZARD_R = 0.004;
/** About how far a lizard's eye reaches, from its thimble's crown to the end of its ferrule. */
const LIZARD_EYE = THIMBLE_11.length + 0.065;
/** The Tirfor's 11.5 mm cable's radius. */
const TIRFOR_CABLE_R = 0.00575;
/**
 * Hawser `s`'s anchor end, and the way up it to the saddle: where its lizard's clamped on. The lizard lies `side` off
 * the hawser's middle, in the clamps' other throats, which face `toward` (down and in).
 */
const lizardLine = (s: number) => {
    const a = ANCHOR_SHACKLE(s * SLING_Z);
    const along = SADDLE(s).sub(a).unit();
    const toward = vec3(0, -0.016, -s * 0.012).unit();
    const side = toward.scale(baseClampWire(HAWSER_R) + baseClampWire(LIZARD_R));
    return { along, toward, side, on: (d: number) => a.add(along.scale(d)) };
};
/** Where the lizard on hawser `s` leaves its bottom clamp, on its way down to its bottom eye. */
const lizardFoot = (s: number) => {
    const { on, side } = lizardLine(s);
    return on(LIZARD.clamps[0] - 0.06).add(side);
};

/**
 * The Tirfor, lying on the ground in front of the log's middle sling, pointing (seen from above) up hawser A towards
 * the lizard; its anchor hook, lying flat, takes the sling's bights.
 */
const TIRFOR_RIG = (() => {
    const log = LOG_AT(0);
    const ahead = lizardFoot(1).sub(log);
    const u = vec3(ahead.x, 0, ahead.z).unit();
    const start = log.add(u.scale(LOG.r + 0.45));
    const anchor = vec3(start.x, groundY(start.x + u.x * 0.26) + 0.004, start.z);
    const t = tirfor(anchor, u, UP, TIRFOR_COLORS);
    const h = hook(t.pin, u.neg(), t.pinAlong, C.steel);
    return { tirfor: t, hook: h, u };
})();

/** `n` points along the cubic Bézier from `a` to `b` with control points `c1` and `c2`, both ends included. */
function bezier3(a: Vector3, c1: Vector3, c2: Vector3, b: Vector3, n: number): Vector3[] {
    return Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        const s = 1 - t;
        return a
            .scale(s * s * s)
            .add(c1.scale(3 * s * s * t))
            .add(c2.scale(3 * s * t * t))
            .add(b.scale(t * t * t));
    });
}

/** How far along `path` each of its points is. */
const arcLengths = (path: Vector3[]) => {
    const at = [0];
    for (let i = 1; i < path.length; i++) at.push(at[i - 1] + path[i].distanceTo(path[i - 1]));
    return at;
};

/** The point `d` along `path`, and the way it runs there. */
function alongPath(path: Vector3[], d: number): { at: Vector3; dir: Vector3; i: number } {
    const at = arcLengths(path);
    const i = Math.max(
        1,
        at.findIndex((x) => x >= d),
    );
    const k = (d - at[i - 1]) / (at[i] - at[i - 1]);
    return { at: path[i - 1].lerp(path[i], k), dir: path[i].sub(path[i - 1]).unit(), i };
}

/**
 * A swaged eye in a wire of radius `wireR` (a lizard's ends, the Tirfor cable's hook end): a thimble with its crown's
 * inside at `near`, pointing `d` along the wire, square to `m`, the wire's tail pressed into a ferrule ten times the
 * wire's radius long. Returns its pieces and the end of the ferrule, where the wire runs on.
 */
function swagedEye(
    near: Vector3,
    d: Vector3,
    m: Vector3,
    wireR = LIZARD_R,
): { pieces: Piece[]; end: Vector3 } {
    const th = thimble(near, d, m, wireR, C.steel);
    const tips = th.wire[0].lerp(th.wire.at(-1)!, 0.5);
    const ferrule = [tips.add(d.scale(3.75 * wireR)), tips.add(d.scale(13.75 * wireR))];
    return {
        pieces: [
            ...th.pieces,
            ...bar(ferrule[0], ferrule[1], wireR * 2.2, C.steel),
            ...line([ferrule[0], ...th.wire, ferrule[0]], wireR, C.hawser, "steel"),
        ],
        end: ferrule[1],
    };
}

/**
 * A lizard on hawser `s`: its three double base clamps, and the wire from `foot` (its bottom eye's ferrule, the wire
 * coming up `hang` to the bottom clamp) along the hawser through them and on to its free eye.
 */
function lizard(s: number, hang: Vector3[]): Piece[] {
    const { along, toward, side, on } = lizardLine(s);
    const pieces: Piece[] = [];
    for (const d of LIZARD.clamps)
        pieces.push(
            ...baseClamp(
                on(d).add(toward.scale(baseClampWire(HAWSER_R))),
                along,
                toward,
                HAWSER_R,
                C.steel,
            ),
        );
    // Past the top clamp the wire carries on along the hawser, then droops under its free eye's weight.
    const past = on(LIZARD.clamps[2] + 0.05).add(side);
    const droop = along.scale(0.45).sub(UP).unit();
    const tip = past.add(along.scale(LIZARD.tail - 0.2)).sub(UP.scale(0.06));
    const top = swagedEye(tip.add(droop.scale(LIZARD_EYE)), droop.neg(), along.cross(UP).unit());
    pieces.push(...top.pieces);
    const free = bezier3(
        past,
        past.add(along.scale(0.15)),
        top.end.sub(droop.scale(0.12)),
        top.end,
        16,
    );
    pieces.push(...line([...hang, ...free], LIZARD_R, C.hawser, "steel"));
    return pieces;
}

/**
 * The Tirfor and lizards. Hawser A's lizard and the Tirfor's cable are slack, so together they make one long smooth
 * curve from the Tirfor's rope guide, dipping, up into the lizard's bottom clamp; the cable's hook takes the lizard's
 * bottom eye part way along it. Hawser B's lizard waits, its bottom eye hanging free on a smooth curve from its bottom
 * clamp. The Tirfor's slack tail runs back from its anchor end over the top of the log and lies on the ground behind.
 */
function lizardAndTirfor(): Piece[] {
    const pieces: Piece[] = [];
    const { tirfor: t, hook: anchorHook, u } = TIRFOR_RIG;
    pieces.push(...t.pieces, ...anchorHook.pieces);

    // Hawser A: the whole slack run, kept off the ground.
    const A = lizardLine(1);
    const footA = lizardFoot(1);
    const span = footA.distanceTo(t.ropeOut);
    const run = bezier3(
        t.ropeOut,
        t.ropeOut.add(u.scale(0.45 * span)),
        footA.sub(A.along.scale(0.35 * span)),
        footA,
        120,
    ).map((p) => vec3(p.x, Math.max(p.y, groundY(p.x) + TIRFOR_CABLE_R), p.z));
    const total = arcLengths(run).at(-1)!;
    // The cable hook's bowl, where the lizard's bottom eye sits: far enough back along the run for `hang` of wire
    // between the eye's ferrule and the bottom clamp.
    const c = CABLE_HOOK;
    const eyeLength = LIZARD_EYE;
    const j = alongPath(run, total - LIZARD.hang - eyeLength - c.r);
    const pinWay = j.dir.cross(UP).unit();
    const toEye = c.bowl + c.r + c.shank + c.eye + c.r;
    const cableHook = hook(j.at.sub(j.dir.scale(toEye)), j.dir, pinWay, C.steel, c);
    pieces.push(...cableHook.pieces);
    // The cable from the rope guide to its swaged eye, its thimble through the hook's eye (its crown bearing on the
    // far side of the eye's bar from the Tirfor).
    const hookEye = j.at.sub(j.dir.scale(toEye));
    const cableEye = swagedEye(
        hookEye.sub(j.dir.scale(c.eye)),
        j.dir.neg(),
        cableHook.along,
        TIRFOR_CABLE_R,
    );
    pieces.push(...cableEye.pieces);
    const before = alongPath(
        run,
        total - LIZARD.hang - eyeLength - c.r - toEye - hookEye.distanceTo(cableEye.end) - 0.03,
    );
    pieces.push(
        ...line([...run.slice(0, before.i), cableEye.end], TIRFOR_CABLE_R, C.hawser, "steel"),
    );
    // The lizard's bottom eye round the hook's bar at the bottom of its bowl, its crown on the Tirfor's side.
    const bottomA = swagedEye(cableHook.bar.sub(j.dir.scale(c.r)), j.dir, cableHook.along);
    pieces.push(...bottomA.pieces);
    const after = alongPath(run, total - LIZARD.hang + 0.02);
    pieces.push(...lizard(1, [bottomA.end, ...run.slice(after.i)]));

    // Hawser B: the lizard hanging free, leaving its bottom clamp down the hawser and curving to hang straight down.
    const B = lizardLine(-1);
    const footB = lizardFoot(-1);
    const across = B.along.cross(UP).unit();
    const bottomB = swagedEye(
        footB.sub(B.along.scale(0.22)).sub(UP.scale(0.4 + eyeLength)),
        UP,
        across,
    );
    pieces.push(...bottomB.pieces);
    pieces.push(
        ...lizard(
            -1,
            bezier3(
                bottomB.end,
                bottomB.end.add(UP.scale(0.18)),
                footB.sub(B.along.scale(0.2)),
                footB,
                24,
            ),
        ),
    );

    // The Tirfor's slack tail: stiff, it rises gently back from its anchor end beside the middle sling, rests on
    // the top of the log, and comes down in a long curve to lie on the ground behind it.
    const log = LOG_AT(0);
    const tail = t.tailOut;
    const z = -0.11;
    const crest = vec3(log.x, log.y + LOG.r + TIRFOR_CABLE_R, z);
    const back = vec3(crest.x - tail.x, 0, crest.z - tail.z).unit();
    const land = onGround(log.x + 0.75, TIRFOR_CABLE_R, z - 0.05);
    const away = vec3(1, 0, -0.25).unit();
    const end = onGround(land.x + 1.1, TIRFOR_CABLE_R, land.z - 0.45);
    pieces.push(
        ...line(
            [
                ...bezier3(tail, tail.add(back.scale(0.2)), crest.sub(back.scale(0.25)), crest, 16),
                ...bezier3(
                    crest,
                    crest.add(back.scale(0.3)),
                    land.sub(away.scale(0.35)),
                    land,
                    16,
                ).slice(1),
                ...bezier3(
                    land,
                    land.add(away.scale(0.4)),
                    end.sub(vec3(1, 0, -0.6).unit().scale(0.4)),
                    end,
                    12,
                ).slice(1),
            ],
            TIRFOR_CABLE_R,
            C.hawser,
            "steel",
        ),
    );
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
function hawsers(run = false): Piece[] {
    const pieces: Piece[] = [];
    for (const s of [-1, 1]) {
        const shackleAt = TREE_SHACKLE(s);
        const cradle = vec3(BAR_X, CRADLE_Y, s * HAWSER_Z);
        // The eye at the tree: a bow shackle on the sling, the hawser's eye round its thimble on the pin, the dead end
        // back beside it through three clamps.
        const back = cradle.sub(shackleAt).unit();
        const { flat, upright } = linkPlanes(back);
        const bow = shackle("bow", shackleAt, back, flat, C.steel, C.pin);
        pieces.push(...bow.pieces);
        pieces.push(
            ...madeOff(bow.far, back, upright, cradle, (end) => [end.add(back.scale(0.12))]),
        );
        const span = Array.from({ length: 61 }, (_, i) =>
            onHawser(BAR_X + ((SPAR_X - BAR_X) * i) / 60, s),
        );
        if (!run) pieces.push(...line(span, HAWSER_R, C.hawser, "steel"));
        pieces.push(...hawserFoot(s));
    }
    return pieces;
}

/**
 * A rope from a carabiner hanging down with its gate towards `gate`, tied into its bottom bar (whose middle is `at`)
 * with a figure 8 on a bight and on through `rest`: in the middle of the bar, or `spine` (radians) round the bend
 * towards the spine. The carabiner hangs straight down unless it's swung towards `down`. Points of `rest` the knot
 * already covers are left out.
 */
export function tiedTo(
    at: Vector3,
    rest: Vector3[],
    r: number,
    color: string,
    spine = 0,
    down = vec3(0, -1, 0),
    gate = ACROSS,
): Piece[] {
    const { knot, bar } = carabinerKnot(at, rest[0], r, spine, down, gate);
    return line([...knot.rope, ...beyond(knot, bar, rest)], r, color, "rope", { a: true });
}

/**
 * A figure 8 on a bight tied into a carabiner's bottom bar (whose middle is `at`), its rope pulling towards `toward`:
 * in the middle of the bar, or `spine` (radians) round the bend towards the spine, as `tiedTo` ties it. Returns the knot
 * and the point on the bar it's round.
 */
function carabinerKnot(
    at: Vector3,
    toward: Vector3,
    r: number,
    spine = 0,
    down = vec3(0, -1, 0),
    gate = ACROSS,
): { knot: Figure8; bar: Vector3 } {
    const end = CARABINER_WIDTH / 2;
    // Round the bottom bend's middle line, from the bottom towards the spine (away from the gate).
    const bend = at.sub(down.scale(end));
    const bar = bend.sub(gate.scale(end * Math.sin(spine))).add(down.scale(end * Math.cos(spine)));
    const axis = gate.scale(Math.cos(spine)).add(down.scale(Math.sin(spine)));
    return { knot: figure8(bar, axis, CARABINER_R, toward, r), bar };
}

/** The points of `route` past the reach of `knot`, tied into the bar at `bar`. */
function beyond(knot: Figure8, bar: Vector3, route: Vector3[]): Vector3[] {
    const pull = knot.end.sub(bar).unit();
    const i = route.findIndex((p) => p.sub(bar).dot(pull) > knot.reach + 0.01);
    return i < 0 ? route.slice(-1) : route.slice(i);
}

/**
 * How far below the top of its hole each of the trolley's carabiners hangs, past just touching it: the rider's, in the
 * middle hole, and the back one's.
 */
const TROLLEY_CLIP_DROP = { hang: 0.022, backUp: 0.003 };

/**
 * A trolley on the wire at `at`, its bumper towards `ahead` (downhill, where it meets the brake blocks), with its two
 * carabiners hanging from the holes below: the rider's dropper on the middle one, and the back-up line and the return
 * line together on the one behind it, uphill. Each carabiner pivots where it passes through its hole: `swing` turns its
 * bottom that far (radians) towards `ahead`, as when the trolley's stopped by the brake blocks and the rider swings on,
 * or back when the return line pulls. Returns where each carabiner's bottom is, and which way it hangs.
 */
export function rigTrolley(
    at: Vector3,
    ahead: Vector3,
    swing: { hang?: number; backUp?: number } = {},
    /** Which way the carabiners' gates face. */
    gate = ACROSS,
): {
    pieces: Piece[];
    /** The trolley alone, and its carabiners alone. */
    body: Piece[];
    clips: Piece[];
    /** Where the rider's carabiner passes through its hole, which it pivots about. */
    pivot: Vector3;
    hang: Vector3;
    backUp: Vector3;
    hangDown: Vector3;
    backUpDown: Vector3;
} {
    const t = zipTrolley(at, ahead, ACROSS, HAWSER_R, TROLLEY_COLORS);
    const pieces: Piece[] = [];
    const level = vec3(ahead.x, 0, ahead.z).unit();
    const clip = (top: Vector3, length: number, drop: number, angle = 0) => {
        const down = vec3(0, -Math.cos(angle), 0).add(level.scale(Math.sin(angle)));
        const bar = top.add(vec3(0, -0.005 - drop, 0));
        pieces.push(
            ...carabiner(bar, down, gate, C.oval, length, { shape: "oval", through: t.gap }),
        );
        return { bottom: bar.add(down.scale(length)), down, bar };
    };
    const hang = clip(t.main, 0.11, TROLLEY_CLIP_DROP.hang, swing.hang);
    const backUp = clip(t.towSide, 0.1, TROLLEY_CLIP_DROP.backUp, swing.backUp);
    return {
        pieces: [...t.pieces, ...pieces],
        body: t.pieces,
        clips: pieces,
        pivot: hang.bar,
        hang: hang.bottom,
        backUp: backUp.bottom,
        hangDown: hang.down,
        backUpDown: backUp.down,
    };
}

/**
 * A trolley on hawser `s` at `x`, with its dropper: the trolley's pieces and the dropper's apart (the dropper, with
 * the carabiners it hangs from, swings about `hang`, where the rider's carabiner passes through the trolley), where it
 * sits on the wire, and where its back (uphill) tow point is.
 */
function trolley(
    x: number,
    s: number,
): {
    pieces: Piece[];
    dropper: Piece[];
    at: Vector3;
    hang: Vector3;
    back: Vector3;
    gate: Vector3;
} {
    const at = onHawser(x, s);
    const ahead = onHawser(x + 0.1, s)
        .sub(onHawser(x - 0.1, s))
        .unit();
    // Its carabiners' gates face in, towards the other hawser, so the return line's tied on the outside.
    const gate = ACROSS.scale(-s);
    const rig = rigTrolley(at, ahead, {}, gate);
    const { hang, backUp } = rig;
    const pieces: Piece[] = [];
    // The return line's tied on beside the back-up line, round the bend on the carabiner's spine side.
    const back = backUp;
    // The dropper: the rider's rope down through the descender, a GRIGRI+ clipped to the harness's tie-in (the
    // rider's drop below the hawser) and reaching up to about `DESCENDER` below it, the rope's brake strand hanging on
    // below; and the back-up line, down to the harness too.
    const tieIn = at.add(vec3(0, -RIDER.harness, 0));
    const down = vec3(0, -1, 0);
    const clipLength = 0.11;
    // Its coloured side towards hawser B, so its body reaches downhill, clear of the back-up line behind it.
    const g = grigri(tieIn.add(vec3(0, clipLength, 0)), UP, ACROSS.neg(), {
        body: "var(--fox-grigri)",
        dark: "var(--rig-black)",
        handle: "var(--fox-grigri-handle)",
        steel: C.steel,
    });
    pieces.push(...g.pieces);
    // Its carabiner through the hole, hanging from the hole's bottom edge to the tie-in, turned over (its gate the
    // other way from the trolley's).
    const holeBottom = tieIn.add(vec3(0, clipLength - g.holeR + 0.005, 0));
    pieces.push(
        ...carabiner(holeBottom, down, ACROSS.neg(), C.steel, clipLength - g.holeR + 0.005, {
            through: g.width,
        }),
    );
    // Tied into the trolley's carabiner with a figure 8 on a bight, its standing part on down to the GRIGRI.
    const eight = figure8(hang, ACROSS, CARABINER_R, hang.add(vec3(0, -1, 0)), 0.0055);
    // Its brake strand's end tied off with a figure 8 stopper.
    const brakeStrand = g.brake(0.9);
    const [end, before] = [brakeStrand.at(-1)!, brakeStrand.at(-2)!];
    pieces.push(
        ...line(
            [
                ...eight.rope,
                ...g.rope,
                ...brakeStrand,
                ...stopper(end, end.sub(before), 0.0055).slice(1),
            ],
            0.0055,
            C.dropper,
            "rope",
            { a: true, b: true },
        ),
    );
    // The safety (back-up) line, down beside it to a carabiner of its own on the harness.
    const safetyClip = tieIn.add(vec3(-0.05, clipLength, 0));
    // One rope, a figure 8 at each end, each knot lying straight towards the other carabiner and the rope running
    // straight between them, so it leaves each knot the way the knot lies.
    const top = carabinerKnot(backUp, safetyClip, 0.0055, 0, undefined, gate);
    const bottom = carabinerKnot(safetyClip, backUp, 0.0055);
    pieces.push(
        ...line([...top.knot.rope, ...bottom.knot.rope.reverse()], 0.0055, C.dropper, "rope", {
            a: true,
            b: true,
        }),
    );
    pieces.push(...carabiner(safetyClip, down, ACROSS.neg(), C.steel, clipLength));
    return {
        pieces: rig.body,
        dropper: [...rig.clips, ...pieces],
        at,
        hang: rig.pivot,
        back,
        gate,
    };
}

/** How far round its carabiner's bottom bend towards the spine the return line's tied (radians). */
const RETURN_SPINE = 1.1;

/** Where the trolleys sit: A at the launch, just out from the platform, and B at the bottom against its brake block. */
export const TROLLEY_X = { a: 1.4, b: BLOCKS_X - 0.15 };

/**
 * The trolleys and the return line joining them over the tower's pulleys; for a run, only trolley B and the pulleys,
 * trolley A riding the hawser by itself with no return line on it.
 */
function trolleysAndReturn(run = false): Piece[] {
    // For a run, the trolleys, the return line and its pulleys all move.
    if (run) return [];
    const a = trolley(TROLLEY_X.a, 1);
    const b = trolley(TROLLEY_X.b, -1);
    const [ca, cb] = [RETURN_PULLEY(1), RETURN_PULLEY(-1)];
    // Each pulley clipped into the inner eye bolt on its side, its eye lying flat.
    // Out to trolley B, sagging well below hawser B: slacker than the hawsers, twice their sag for its length (as long
    // as it stays clear of the ground).
    const slack = (a: Vector3, z: Vector3) => sagLike(a, z, 2);
    const out = hanging(cb, b.back, slack(cb, b.back), 60);
    const bolt = (s: number) => ({
        eyeBolt: { base: topEye(s * RETURN_EYE_Z), out: vec3(1, 0, 0), toward: ACROSS },
    });
    const pa = rigPulley(ca, a.back, cb, 0.004, bolt(1));
    const pb = rigPulley(cb, pa.centre, out[1], 0.004, bolt(-1));
    return [
        ...a.pieces,
        ...a.dropper,
        ...b.pieces,
        ...b.dropper,
        ...pa.pieces,
        ...pb.pieces,
        ...tiedTo(
            a.back,
            [...pa.round, ...pb.round],
            0.004,
            C.returnLine,
            RETURN_SPINE,
            undefined,
            a.gate,
        ),
        // Out to trolley B, sagging under its own weight below hawser B.
        ...tiedTo(
            b.back,
            hanging(pb.b, b.back, slack(pb.b, b.back), 60).reverse().slice(1),
            0.004,
            C.returnLine,
            RETURN_SPINE,
            undefined,
            b.gate,
        ),
    ];
}

/** Where a rigid part of a moving rig is: turned by `angle` about `axis` (through its own origin), then moved to `at`. */
export type Pose = { at: Vector3; axis: Vector3; angle: number };

/** `v` turned by `angle` about the unit `axis` (Rodrigues). */
export function turned(v: Vector3, axis: Vector3, angle: number): Vector3 {
    const [c, s] = [Math.cos(angle), Math.sin(angle)];
    return v
        .scale(c)
        .add(axis.cross(v).scale(s))
        .add(axis.scale(axis.dot(v) * (1 - c)));
}

/** The turn that takes direction `from` to direction `to`, about the line square to both. */
export function turnBetween(from: Vector3, to: Vector3): { axis: Vector3; angle: number } {
    const [a, b] = [from.unit(), to.unit()];
    const axis = a.cross(b);
    const sin = axis.len();
    if (sin < 1e-9) return { axis: vec3(0, 0, 1), angle: 0 };
    return { axis: axis.scale(1 / sin), angle: Math.atan2(sin, a.dot(b)) };
}

/** `pieces`, built about the origin, put in `pose`. */
export function posed(pieces: Piece[], { at, axis, angle }: Pose): Piece[] {
    const point = (q: Vector3) => turned(q, axis, angle).add(at);
    const dir = (q: Vector3) => turned(q, axis, angle);
    return pieces.map((p) => {
        if (p.kind === "rod") return { ...p, a: point(p.a), b: point(p.b) };
        if (p.kind === "face")
            return {
                ...p,
                points: p.points.map(point),
                ...(p.holes && { holes: p.holes.map((h) => h.map(point)) }),
            };
        return {
            ...p,
            points: p.points.map(point),
            ...(p.tape && {
                tape: {
                    ...p.tape,
                    across: dir(p.tape.across),
                    ...(p.tape.profile && {
                        profile: p.tape.profile.map((q) => ({
                            ...q,
                            ...(q.across && { across: dir(q.across) }),
                        })),
                    }),
                },
            }),
        };
    });
}

/** How far the trolley's pushed block A down the span, and how hawser A hangs (its height at each `x`). */
export type BrakeState = {
    pushed?: number;
    pushedB?: number;
    heightA?: (x: number) => number;
    heightB?: (x: number) => number;
};

/**
 * The dynamic brake, built to move: what stays put, the rigid parts (built about their own origins, so they can be
 * moved and turned whole), and for any state, where each rigid part goes and the ropes between them.
 */
export type BrakeRig = {
    fixed: Piece[];
    parts: { name: string; pieces: Piece[] }[];
    pose: (state?: BrakeState) => { poses: Map<string, Pose>; ropes: Piece[]; weight: ChainWeight };
};

/**
 * The dynamic brake: a nylon block on each hawser, joined by a rope with its middle tied to the brake line, which runs
 * back up the span to the tower's pulley and down to the chain; and the stabiliser, a shock cord from the same middle
 * back to the shear leg's bottom spar, holding the chain's first links just off the ground. Then the chain weight,
 * hanging from the brake line's end and piled on the ground, its end tied off to a picket.
 *
 * As the trolley pushes block A down the span, the blocks, the knots, the middle carabiner and the chain's top move
 * whole (the knots turning to follow their ropes), and the ropes between them, which don't stretch, are drawn again
 * between their ends. The pulleys stay as they're rigged at rest.
 */
export function brakeRig(): BrakeRig {
    const ropeR = 0.004;
    const clip = 0.11;
    const ahead = vec3(1, 0, 0);
    const Z = vec3(0, 0, 1);
    // The joining rope: 2.5 m with its knots tied, its middle drawn up the span by the brake line.
    const half = 1.25;
    /** Where a block sits on hawser `s` at `x` (hawser A hanging as `height` has it), and the wire's slope there. */
    const seat = (x: number, s: number, height: (x: number) => number) => {
        const on = (x: number) => vec3(x, height(x), s * HAWSER_Z);
        const along = on(x + 0.1)
            .sub(on(x - 0.1))
            .unit();
        return { at: on(x), along, slope: Math.atan2(along.y, along.x) };
    };
    /** The joining rope's middle, where both legs reach, as far up the span as they let the brake line draw it. */
    const middleOf = (eyeB: Vector3, eyeA: Vector3) => {
        const between = eyeA.sub(eyeB);
        const across = between.len() / 2;
        const e = between.unit();
        const up = ahead.neg();
        const w = up.sub(e.scale(up.dot(e))).unit();
        return eyeB
            .lerp(eyeA, 0.5)
            .add(w.scale(Math.sqrt(Math.max(half * half - across * across, 0))))
            .add(vec3(0, -0.05, 0));
    };

    // At rest: the blocks where they're set, on the hawsers hanging unloaded.
    const blocks = [1, -1].map((s) => {
        const at = seat(BLOCKS_X, s, hawserY);
        // The joining rope's tied to the eye on the inside, towards the other hawser.
        const block = stopBlock(at.at, at.along, UP, vec3(0, 0, -s), HAWSER_R, STOP_BLOCK_COLORS);
        return { s, ...at, pieces: block.pieces, eye: block.inner };
    });
    const [blockA, blockB] = blocks;
    const apex = middleOf(blockB.eye, blockA.eye);

    // The middle: one carabiner lying along the span (Figure 55), the brake line clipped into its uphill end, and the
    // joining rope's middle and the stabiliser side by side in its downhill end. The brake line and the stabiliser
    // each end in a figure 8 on a bight. The joining rope's middle is really an alpine butterfly: until that's drawn,
    // it takes a turn round the carabiner's bar.
    const downhill = apex.sub(ahead.scale(CARABINER_R + ropeR));
    const uphill = downhill.sub(ahead.scale(clip));
    const middle: Piece[] = [...carabiner(uphill, ahead, ACROSS, C.oval, clip, { shape: "oval" })];
    const knot = tiedRound(
        downhill.add(ACROSS.scale(0.008)),
        ACROSS,
        CARABINER_R,
        apex.add(ahead),
        ropeR,
    );
    middle.push(...line(knot.turn, ropeR, C.joining));
    const brakeEye = figure8(uphill, ACROSS, CARABINER_R, uphill.sub(ahead), 0.004);
    middle.push(...line(brakeEye.rope, 0.004, C.brakeLine, "rope", { a: true }));
    // The stabiliser: shock cord, stretched, from the joining rope's middle to the pulley under the shear leg's top spar
    // and down from it, tied off to the bottom spar with natural fibre rope. Its eye's in the carabiner's downhill end,
    // beside the joining rope's knot.
    const g = groundY(SHEAR_LEG.x);
    const centre = STABILISER_PULLEY.add(vec3(0, g, 0));
    const tie = vec3(SPAR_X, g + SHEAR_LEG.lower + SHEAR_LEG.r + 0.35, 0);
    const spar = vec3(SPAR_X, g + SHEAR_LEG.lower + SHEAR_LEG.r, 0);
    const cordEye = figure8(downhill.sub(ACROSS.scale(0.008)), ACROSS, CARABINER_R, centre, 0.005);
    middle.push(...line(cordEye.rope, 0.005, C.shockCord, "rope", { a: true }));

    // The joining rope's legs, out from the knot to each block's eye, tied into the eye's bar: really a rethreaded
    // figure 8 (drawn as a figure 8 on a bight). Each knot's built about the eye, and turns with its leg.
    const eyeKnots = blocks.map((b) => {
        const level = knot.from.sub(b.eye);
        const w = vec3(level.x, 0, level.z).unit();
        const t = figure8(
            b.eye.add(w.scale(STOP_BLOCK_EYE.r)),
            UP.cross(w),
            STOP_BLOCK_EYE.bar,
            knot.from,
            ropeR,
        );
        return {
            pieces: moved(line(t.rope, ropeR, C.joining, "rope", { a: true }), b.eye.neg()),
            end: t.end.sub(b.eye),
            toward: knot.from.sub(b.eye),
        };
    });

    // The brake line, back up the span to the pulley on the brake support's arm and straight down to the chain,
    // clipped into the eye bolt under the arm, its eye turned to face the pull.
    const reach = hanging(brakeEye.end, BRAKE.pulley, sagLike(brakeEye.end, BRAKE.pulley), 50);
    const brake = rigPulley(BRAKE.pulley, reach[reach.length - 3], BRAKE.chainTop, 0.004, {
        eyeBolt: { base: BRAKE.eye, out: vec3(0, -1, 0) },
    });
    // Tied round the crown of the shackle the chain weight's ring hangs on: the chain's top, built about where it is at
    // rest. The shackle's pin runs through the ring, square to it.
    const top = BRAKE.chainTop;
    const ringFace = ACROSS.cross(UP);
    const sh = CHAIN_WEIGHT.shackle;
    const crownBar = top.add(UP.scale(sh.body));
    const chainKnot = figure8(crownBar, ringFace, sh.body, brake.round.at(-1)!, 0.004);
    const chainTop = moved(
        [
            ...shackle("bow", top, UP.neg(), UP.neg().cross(ringFace), C.steel, C.pin, sh).pieces,
            ...line(chainKnot.rope, 0.004, C.brakeLine, "rope", { a: true }),
        ],
        top.neg(),
    );
    const stabiliser = rigPulley(centre, cordEye.end, tie, 0.005, {
        basket: {
            spar: vec3(SPAR_X, g + SHEAR_LEG.spar, 0),
            along: ACROSS,
            r: SHEAR_LEG.r,
            drop: SHEAR_LEG.r + 0.25,
        },
    });

    // What stays put: the pulleys and the brake line round its pulley, the stabiliser's tie, and the static brakes'
    // pickets (the chain weight is drawn as it's lifted).
    const statics = staticBrakes();
    const fixed: Piece[] = [
        ...brake.pieces,
        ...line(brake.round, 0.004, C.brakeLine),
        ...stabiliser.pieces,
        ...line([...stabiliser.round, tie], 0.005, C.shockCord),
        ...line([tie, spar], 0.006, C.fibre, "rail"),
        ...statics.fixed,
    ];
    const under = onGround(top.x, 0, top.z);

    const parts = [
        { name: "block-a", pieces: moved(blockA.pieces, blockA.at.neg()) },
        { name: "block-b", pieces: moved(blockB.pieces, blockB.at.neg()) },
        { name: "knot-a", pieces: eyeKnots[0].pieces },
        { name: "knot-b", pieces: eyeKnots[1].pieces },
        { name: "middle", pieces: moved(middle, apex.neg()) },
        { name: "chain-top", pieces: chainTop },
        ...statics.parts,
    ];

    const pose = ({
        pushed = 0,
        pushedB = 0,
        heightA = hawserY,
        heightB = hawserY,
    }: BrakeState = {}) => {
        // Each block on its hawser, turned with the wire's slope, and its eye with it.
        const place = (b: (typeof blocks)[number], x: number, height: (x: number) => number) => {
            const at = seat(x, b.s, height);
            const angle = at.slope - b.slope;
            return {
                pose: { at: at.at, axis: Z, angle },
                eye: at.at.add(turned(b.eye.sub(b.at), Z, angle)),
            };
        };
        let a = place(blockA, BLOCKS_X + pushed, heightA);
        let b = place(blockB, BLOCKS_X + pushedB, heightB);
        // One block pushed far enough that the joining rope's legs can't both reach its middle, it drags the other.
        const legs = 2 * half * 0.995;
        const gap = a.eye.sub(b.eye);
        const level = legs * legs - gap.y * gap.y - gap.z * gap.z;
        if (gap.len() > legs && level > 0) {
            if (gap.x > 0)
                b = place(blockB, BLOCKS_X + pushedB + gap.x - Math.sqrt(level), heightB);
            else a = place(blockA, BLOCKS_X + pushed - gap.x - Math.sqrt(level), heightA);
        }
        const lift = Math.max(pushed, pushedB);
        const mid = middleOf(b.eye, a.eye);
        const by = mid.sub(apex);
        const from = knot.from.add(by);
        const poses = new Map<string, Pose>([
            ["block-a", a.pose],
            ["block-b", b.pose],
            ["middle", { at: mid, axis: Z, angle: 0 }],
            ["chain-top", { at: top.add(vec3(0, lift, 0)), axis: Z, angle: 0 }],
        ]);
        const ropes: Piece[] = [];
        [a, b].forEach((block, i) => {
            const k = eyeKnots[i];
            const turn = turnBetween(k.toward, from.sub(block.eye));
            poses.set(i === 0 ? "knot-a" : "knot-b", { at: block.eye, ...turn });
            // Its leg, sagging a touch out to the middle.
            const end = block.eye.add(turned(k.end, turn.axis, turn.angle));
            ropes.push(...line(hanging(end, from, 0.03, 8), ropeR, C.joining));
        });
        // The brake line up the span to the pulley, sagging much as the hawsers do, and from the pulley straight down
        // to the chain's top as it's lifted.
        const brakeFrom = brakeEye.end.add(by);
        ropes.push(
            ...line(
                hanging(brakeFrom, brake.a, sagLike(brakeFrom, brake.a), 50),
                0.004,
                C.brakeLine,
            ),
        );
        const lifted = top.add(vec3(0, lift, 0));
        ropes.push(
            ...line([brake.round.at(-1)!, chainKnot.end.add(vec3(0, lift, 0))], 0.004, C.brakeLine),
        );
        // The chain weight, hanging from its top as it's lifted.
        const weight = chainWeight(under, lifted.y - under.y, ACROSS);
        // The static brakes, on the hawsers as they hang now.
        const held = statics.pose([heightA, heightB]);
        for (const [name, p] of held.poses) poses.set(name, p);
        ropes.push(...held.ropes);
        // The stabiliser from its eye back to its pulley.
        ropes.push(...line([cordEye.end.add(by), stabiliser.round[0]], 0.005, C.shockCord));
        return { poses, ropes, weight };
    };
    return { fixed, parts, pose };
}

/** The dynamic brake and its chain weight, with block A pushed `pushed` down the span (as one set of pieces). */
export function brakePieces(state: BrakeState = {}, rig = brakeRig()): Piece[] {
    const { poses, ropes, weight } = rig.pose(state);
    return [
        ...rig.fixed,
        ...rig.parts.flatMap((p) => posed(p.pieces, poses.get(p.name)!)),
        ...ropes,
        ...chainWeightPieces(weight, C.steel),
    ];
}

/**
 * The static brakes: a carabiner clipped round each hawser, hanging towards the pull of a rope tied to it and out to a
 * picket 2.5 m to its side (Figure 55).
 */
function staticBrakes() {
    const length = 0.11;
    const fixed: Piece[] = [];
    const parts: { name: string; pieces: Piece[] }[] = [];
    const sides = [1, -1].map((s) => {
        const at = onHawser(STATIC_X, s);
        const base = vec3(STATIC_X, 0, s * (HAWSER_Z + 2.5));
        const pk = picket(base, towards(at, base));
        // Square to the hawser, swung to the rope's pull, the wire in its top bend.
        const pull = pk.tie.sub(at);
        const down = vec3(0, pull.y, pull.z).unit();
        const across = down.cross(vec3(1, 0, 0)).unit();
        const top = at.sub(down.scale(HAWSER_R + CARABINER_R));
        const t = figure8(top.add(down.scale(length)), across, CARABINER_R, pk.tie, 0.0055);
        fixed.push(...pk.pieces);
        parts.push({
            name: s > 0 ? "static-a" : "static-b",
            pieces: moved(
                [
                    ...carabiner(top, down, across, C.steel, length),
                    ...line(t.rope, 0.0055, C.staticBrake, "rope", { a: true }),
                ],
                at.neg(),
            ),
        });
        return { s, at, end: t.end, tie: pk.tie, rope: t.end.distanceTo(pk.tie) };
    });
    /**
     * Each carabiner where its hawser is now at the static brakes (`heights`, hawser A's then B's), and its rope out
     * to its picket: as long as it was rigged, so it sags when the hawser's lower and pulls straight when it's higher.
     */
    const pose = (heights: [(x: number) => number, (x: number) => number]) => {
        const poses = new Map<string, Pose>();
        const ropes: Piece[] = [];
        for (const [i, b] of sides.entries()) {
            const at = vec3(STATIC_X, heights[i](STATIC_X), b.at.z);
            poses.set(b.s > 0 ? "static-a" : "static-b", { at, axis: vec3(0, 0, 1), angle: 0 });
            const end = b.end.add(at.sub(b.at));
            const chord = end.distanceTo(b.tie);
            const sag = b.rope > chord ? Math.sqrt((3 * chord * (b.rope - chord)) / 8) : 0;
            ropes.push(...line(hanging(end, b.tie, sag, 20), 0.0055, C.staticBrake));
        }
        return { poses, ropes };
    };
    return { fixed, parts, pose };
}

/**
 * A trolley at the launch on hawser `side`, for a run: its pieces and its dropper's apart, where it sits on the wire,
 * and where the dropper hangs from; and the return line's figure 8, tied round its back carabiner's bar, built about
 * that bar so it can turn to follow the line, and where the line leaves the knot.
 */
export function runTrolley(side: number) {
    const t = trolley(TROLLEY_X.a, side);
    const toward = t.back.add(vec3(-1, 0.4, 0));
    const { knot, bar } = carabinerKnot(t.back, toward, 0.004, RETURN_SPINE, undefined, t.gate);
    return {
        ...t,
        knot: moved(line(knot.rope, 0.004, C.returnLine, "rope", { a: true }), bar.neg()),
        bar,
        tie: knot.end.sub(bar),
    };
}

/**
 * The return line's two pulleys under the tower's top bar, built to swing (each about where its carabiner hangs in its
 * eye bolt) to face its ropes, and for where the trolleys are now, the line from one trolley's knot round both pulleys
 * to the other's, sagging with however much slack it has.
 */
export function returnRig() {
    const [ca, cb] = [RETURN_PULLEY(1), RETURN_PULLEY(-1)];
    const bolt = (s: number) => ({
        eyeBolt: { base: topEye(s * RETURN_EYE_Z), out: vec3(1, 0, 0), toward: ACROSS },
    });
    // Built with the line running out to a trolley a little way along each hawser.
    const pa = rigPulley(ca, onHawser(20, 1), cb, 0.004, bolt(1));
    const pb = rigPulley(cb, pa.centre, onHawser(20, -1), 0.004, bolt(-1));
    const pulleys = [
        { name: "pulley-a", p: pa, other: pb.centre },
        { name: "pulley-b", p: pb, other: pa.centre },
    ];
    const fixed = [pa, pb].flatMap((p) => p.pieces.slice(p.pulley.length));
    const parts = pulleys.map(({ name, p }) => ({ name, pieces: moved(p.pulley, p.hook.neg()) }));
    /** The line, with the trolleys' knots' ends at `tieA` and `tieB` and `slack` metres of it to spare. */
    const pose = (tieA: Vector3, tieB: Vector3, slack: number) => {
        const poses = new Map<string, Pose>();
        // Each pulley swung so it hangs along the pull of its two ropes.
        const rounds = pulleys.map(({ name, p, other }, i) => {
            const tie = i === 0 ? tieA : tieB;
            const pull = tie.sub(p.centre).unit().add(other.sub(p.centre).unit());
            const turn = turnBetween(p.up.neg(), pull);
            poses.set(name, { at: p.hook, ...turn });
            return p.round.map((q) => p.hook.add(turned(q.sub(p.hook), turn.axis, turn.angle)));
        });
        // Pulley A's wrap runs from trolley A's side to pulley B's, pulley B's from A's side to trolley B's.
        const [ra, rb] = rounds;
        const ends = [ra[0], rb[rb.length - 1]];
        // The slack shared between the two spans as a rope's own weight shares it: each sags as its length squared,
        // with the extra length they take up (a parabola's, 8 sag² / 3 span) adding to the slack.
        const spans = [ends[0].distanceTo(tieA), ends[1].distanceTo(tieB)];
        const k = Math.sqrt((24 * Math.max(slack, 0)) / (spans[0] ** 3 + spans[1] ** 3));
        const sags = spans.map((d) => Math.max((k * d * d) / 8, 0.01 * d));
        // Lying on the ground where it sags that far.
        const onGround = (q: Vector3) => vec3(q.x, Math.max(q.y, groundY(q.x) + 0.004), q.z);
        const spanA = hanging(tieA, ends[0], sags[0], 80).map(onGround);
        const spanB = hanging(ends[1], tieB, sags[1], 80).map(onGround);
        return {
            poses,
            // Which way the line leaves each knot, a little way along it.
            leaving: [spanA[3].sub(spanA[0]), spanB[spanB.length - 4].sub(spanB[spanB.length - 1])],
            ropes: line(
                [...spanA, ...ra.slice(1), ...rb.slice(0, -1), ...spanB],
                0.004,
                C.returnLine,
            ),
        };
    };
    return { fixed, parts, pose };
}

/**
 * The whole flying fox, as pieces to draw. For a run, what moves is left out: the hawsers' spans, the trolleys
 * (`runTrolley`), the return line and its pulleys (`returnRig`) and the dynamic brake (`brakeRig`).
 */
export function foxPieces({ run = false }: { run?: boolean } = {}): Piece[] {
    return [
        ...tree(),
        ...tower(),
        ...hawsers(run),
        ...trolleysAndReturn(run),
        ...(run ? [] : brakePieces()),
        ...shearLeg(),
        ...logAnchor(),
        ...lizardAndTirfor(),
    ];
}

/** The flat views. */
export type FlatView = "side" | "overhead";

/**
 * A label in the flat views: what it names, the target it's part of (its slug: it's shown only when the views are
 * locked onto that), and the views it's written in (both unless it names them).
 */
export type FoxLabel = RigLabel & { target: string; views?: FlatView[] };

/** What the drawings name, written beside it in the flat views. */
export function foxLabels(): FoxLabel[] {
    const floor = TOWER.lower + TOWER.rhs.h / 2 + 0.05;
    const overhead: FlatView[] = ["overhead"];
    // A little way out along a guy from the top of the upright it's tied to, at `top`, towards its picket at `foot`.
    const alongGuy = (top: Vector3, foot: Vector3, out: number) => {
        const level = foot.sub(top);
        return top.lerp(foot, out / Math.hypot(level.x, level.z));
    };
    // The tower's guy on hawser A's side, out to the front.
    const towerGuyTop = vec3(0, TOWER.bar + TOWER.rhs.h / 2, TOWER.z + TOWER.half);
    const towerGuyFoot = vec3(1.6 * TOWER.top, 0, TOWER.z + TOWER.half + 1.6 * TOWER.top);
    // The shear leg's guy on hawser A's side, out towards the anchor.
    const legGuyTop = onGround(SHEAR_LEG.x, SHEAR_LEG.top, SHEAR_LEG.b / 2);
    const legGuyFoot = vec3(
        SHEAR_LEG.x + 1.6 * SHEAR_LEG.top,
        0,
        SHEAR_LEG.b / 2 + 1.6 * SHEAR_LEG.top,
    );
    // Hawser A's eye at the tree, and the way along it to the tower.
    const treeEye = TREE_SHACKLE(1);
    const toTower = vec3(BAR_X, CRADLE_Y, HAWSER_Z).sub(treeEye).unit();
    // The ladder's middle, between its foot and where it rests on the bottom bar, between the platform and the upright
    // on hawser B's side.
    const ladderZ = TOWER.z + (TOWER.platform.shift - TOWER.platform.width / 2 - TOWER.half) / 2;
    const ladderRest = vec3(BAR_X, TOWER.lower, ladderZ);
    const ladder = ladderRest.lerp(onGround(BAR_X + TOWER.lower / 4, 0, ladderZ), 0.5);
    const foot = footLinks(1);
    return [
        // The tree.
        { target: "top-anchor", text: "Big tree", at: onGround(TREE.x, 1.2, 0), side: "left" },
        {
            target: "top-anchor",
            views: overhead,
            text: "Round slings, choked to offset hawsers",
            // On hawser B's sling's leg, between the choke and its shackle.
            at: TREE_CHOKE(-1).at.lerp(TREE_SHACKLE(-1), 0.6),
            side: "left",
        },
        {
            target: "top-anchor",
            views: overhead,
            text: "Backstay",
            at: BACKSTAY_TIE.end.lerp(BACKSTAY_TOP, 0.04),
            side: "right",
        },
        {
            target: "top-anchor",
            views: overhead,
            text: "Wire clamps",
            at: treeEye.add(toTower.scale(0.45)),
            side: "right",
        },
        // The tower.
        {
            target: "top-tower",
            text: "Steel tower",
            at: vec3(0, TOWER.top, TOWER.z + TOWER.half),
            side: "left",
        },
        {
            target: "top-tower",
            text: "Launch platform",
            at: vec3(0.6, floor, TOWER.z + TOWER.platform.shift),
            side: "right",
        },
        { target: "top-tower", text: "Brake pulley", at: BRAKE.pulley, side: "left" },
        {
            target: "top-tower",
            text: "Chain weight",
            at: onGround(BRAKE.chainTop.x, 0.3, BRAKE.chainTop.z),
            side: "left",
        },
        {
            target: "top-tower",
            views: overhead,
            text: "Guys",
            at: alongGuy(towerGuyTop, towerGuyFoot, 1),
            side: "right",
        },
        { target: "top-tower", views: overhead, text: "Ladder", at: ladder, side: "right" },
        {
            target: "top-tower",
            views: overhead,
            text: "Backstay",
            at: BACKSTAY_TOP.lerp(BACKSTAY_TIE.end, 0.06),
            side: "left",
        },
        {
            target: "top-tower",
            views: overhead,
            text: "Hawsers",
            at: vec3(BAR_X, CRADLE_Y, -HAWSER_Z).lerp(TREE_SHACKLE(-1), 0.07),
            side: "left",
        },
        {
            target: "top-tower",
            views: overhead,
            text: "Brake line",
            at: BRAKE.pulley.lerp(vec3(BLOCKS_X, hawserY(BLOCKS_X), 0), 0.03),
            side: "right",
        },
        {
            target: "top-tower",
            views: overhead,
            text: "Return line",
            at: RETURN_PULLEY(1).lerp(onHawser(TROLLEY_X.a, 1), 0.5),
            side: "right",
        },
        // The trolleys.
        { target: "trolley-a", text: "Trolley A", at: onHawser(TROLLEY_X.a, 1), side: "right" },
        { target: "trolley-b", text: "Trolley B", at: onHawser(TROLLEY_X.b, -1), side: "left" },
        // The dynamic brake.
        {
            target: "dynamic-brake",
            text: "Brake blocks",
            at: onHawser(BLOCKS_X, -1),
            side: "right",
        },
        {
            target: "dynamic-brake",
            views: overhead,
            text: "Hawsers",
            at: onHawser(BLOCKS_X + 0.6, 1),
            side: "right",
        },
        {
            target: "dynamic-brake",
            views: overhead,
            text: "Return line",
            at: RETURN_PULLEY(-1).lerp(onHawser(TROLLEY_X.b, -1), 0.99),
            side: "right",
        },
        {
            target: "dynamic-brake",
            views: overhead,
            text: "Brake line",
            at: vec3(BLOCKS_X - 1.6, hawserY(BLOCKS_X) - 0.2, 0),
            side: "left",
        },
        {
            target: "dynamic-brake",
            views: overhead,
            text: "Stabiliser",
            at: vec3(BLOCKS_X + 0.6, hawserY(BLOCKS_X) - 0.3, 0),
            side: "right",
        },
        // The static brakes.
        {
            target: "static-brake",
            text: "Static brakes",
            at: onHawser(STATIC_X, -1).add(vec3(0, -0.05, 0)),
            side: "right",
        },
        {
            target: "static-brake",
            views: overhead,
            text: "Carabiner",
            at: onHawser(STATIC_X, 1),
            side: "right",
        },
        {
            target: "static-brake",
            views: overhead,
            text: "Rope",
            at: onHawser(STATIC_X, 1).lerp(onGround(STATIC_X, 0, HAWSER_Z + 2.5), 0.5),
            side: "right",
        },
        {
            target: "static-brake",
            views: overhead,
            text: "Picket",
            at: onGround(STATIC_X, 0, HAWSER_Z + 2.5),
            side: "right",
        },
        // The shear leg.
        {
            target: "bottom-tower",
            text: "H-frame shear leg",
            at: onGround(SHEAR_LEG.x, SHEAR_LEG.top, 0),
            side: "right",
        },
        {
            target: "bottom-tower",
            views: overhead,
            text: "Guys",
            at: alongGuy(legGuyTop, legGuyFoot, 0.8),
            side: "right",
        },
        {
            target: "bottom-tower",
            views: overhead,
            text: "Lashings",
            at: onGround(SHEAR_LEG.x + 0.1, SHEAR_LEG.spar, SHEAR_LEG.b / 2 + 0.05),
            side: "right",
        },
        {
            target: "bottom-tower",
            views: overhead,
            text: "Hessian sacks",
            at: vec3(SPAR_X, SADDLE_Y, -HAWSER_Z - 0.09),
            side: "right",
        },
        {
            target: "bottom-tower",
            views: overhead,
            text: "Stabiliser",
            at: onGround(SHEAR_LEG.x - 1.5, 1, 0),
            side: "left",
        },
        {
            target: "bottom-tower",
            views: overhead,
            text: "Hawsers",
            at: SADDLE(1).lerp(ANCHOR_SHACKLE(SLING_Z), 0.12),
            side: "right",
        },
        // The log anchor.
        {
            target: "bottom-anchor",
            text: "Turnbuckle",
            at: TURNBUCKLE_AT(-1),
            side: "right",
        },
        {
            target: "bottom-anchor",
            text: "Lizard",
            at: ANCHOR_SHACKLE(SLING_Z).add(
                SADDLE(1).sub(ANCHOR_SHACKLE(SLING_Z)).unit().scale(LIZARD.clamps[1]),
            ),
            side: "left",
        },
        {
            target: "bottom-anchor",
            text: "Tirfor",
            at: TIRFOR_RIG.tirfor.ropeOut.add(vec3(0, 0.25, 0)),
            side: "left",
        },
        {
            target: "bottom-anchor",
            text: "Log and picket anchor",
            at: onGround(LOG.x + 0.3, 0.3, 0),
            side: "right",
        },
        {
            target: "bottom-anchor",
            views: overhead,
            text: "D shackles",
            at: foot.d1.far.lerp(foot.d2.far, 0.5),
            side: "left",
        },
        {
            target: "bottom-anchor",
            views: overhead,
            text: "Round slings",
            at: LOG_AT(SLING_Z).lerp(ANCHOR_SHACKLE(SLING_Z), 0.5),
            side: "left",
        },
        {
            target: "bottom-anchor",
            views: overhead,
            text: "Banjo lashings",
            at: onGround(LOG.x + 0.25, 0.2, -1.0),
            side: "right",
        },
    ];
}

/**
 * What the views can lock onto, up the site from the tree to the log: the box round all of each thing (`lo` to `hi`),
 * its middle, which the views turn and zoom about, and how far from it the 3D view starts (metres), far enough to see
 * all of the box.
 */
export type FoxTarget = {
    slug: string;
    label: string;
    lo: Vector3;
    hi: Vector3;
    centre: Vector3;
    distance: number;
    /** Where its view's middle may be panned to while locked onto it (see `Focus.pan`); none, it stays put. */
    pan?: { lo: Vector3; hi: Vector3 };
};

/** A target round `points`: centred in the box they span, and far enough out to see all of the box. */
function framing(slug: string, label: string, points: Vector3[]): FoxTarget {
    const lo = points.reduce((a, p) =>
        vec3(Math.min(a.x, p.x), Math.min(a.y, p.y), Math.min(a.z, p.z)),
    );
    const hi = points.reduce((a, p) =>
        vec3(Math.max(a.x, p.x), Math.max(a.y, p.y), Math.max(a.z, p.z)),
    );
    // The 3D view's 30° high, so a ball this big just fits it from about 3.9 times its radius out: a little further,
    // to leave some room round it.
    const r = hi.sub(lo).len() / 2;
    return {
        slug,
        label,
        lo,
        hi,
        centre: lo.lerp(hi, 0.5),
        distance: Math.max(4.2 * r, 1.5),
    };
}

/** `target`, its view's middle free to be panned within the box `box` gives round its centre. */
const panned = (target: FoxTarget, box: (centre: Vector3) => [Vector3, Vector3]): FoxTarget => {
    const [lo, hi] = box(target.centre);
    return { ...target, pan: { lo, hi } };
};

export function foxTargets(): FoxTarget[] {
    const sides = [-1, 1];
    const between = (x: number) => onHawser(x, 1).lerp(onHawser(x, -1), 0.5);
    // A trolley and its dropper: from just over the hawser down past the harness to the end of the descender's brake
    // strand, about 1.2 m below the harness.
    const trolleyAt = (x: number, s: number) => {
        const at = onHawser(x, s);
        return [at.add(vec3(-0.15, 0.08, 0)), at.add(vec3(0.15, -RIDER.harness - 1.2, 0))];
    };
    // The tree's anchor: the trunk where the slings go round it, out to the end of each hawser's made-off eye (its bow
    // shackle, thimble, clamps and tail, about 0.8 m along the hawser from the sling's shackle).
    const treeEye = (s: number) => {
        const at = TREE_SHACKLE(s);
        return at.add(
            vec3(BAR_X, CRADLE_Y, s * HAWSER_Z)
                .sub(at)
                .unit()
                .scale(0.8),
        );
    };
    // The log's anchor: the log and its pickets, out to the end of each lizard's wire up its hawser.
    const lizardEnd = (s: number) => {
        const a = ANCHOR_SHACKLE(s * SLING_Z);
        return a.add(
            SADDLE(s)
                .sub(a)
                .unit()
                .scale(LIZARD.clamps.at(-1)! + LIZARD.tail),
        );
    };
    return [
        framing("top-anchor", "Top anchor", [
            onGround(TREE.x - TREE.r, 0, -TREE.r),
            onGround(TREE.x + TREE.r, BACKSTAY_SLING_Y + 0.2, TREE.r),
            ...sides.map(treeEye),
        ]),
        // The tower from its backstay's tie to the foot of its ladder, up to the top of the brake support.
        // Panned up and down, to look at the tower's feet, platform or top from close up.
        panned(
            framing("top-tower", "Top tower", [
                onGround(-1.2, 0, TOWER.z - TOWER.half - 0.3),
                onGround(1.6, BRAKE.postTop + 0.2, TOWER.z + TOWER.half + 0.3),
            ]),
            (c) => [vec3(c.x, 0.5, c.z), vec3(c.x, BRAKE.postTop, c.z)],
        ),
        framing("trolley-a", "Trolley A", trolleyAt(TROLLEY_X.a, 1)),
        framing("trolley-b", "Trolley B", trolleyAt(TROLLEY_X.b, -1)),
        // The two blocks and the joining rope sagging between them.
        framing("dynamic-brake", "Dynamic brake", [
            between(BLOCKS_X - 0.4).add(vec3(0, 0.2, -HAWSER_Z - 0.2)),
            between(BLOCKS_X + 0.4).add(vec3(0, -0.9, HAWSER_Z + 0.2)),
        ]),
        // The carabiners on the hawsers and their ropes out to the pickets either side.
        framing("static-brake", "Static brakes", [
            vec3(STATIC_X - 0.5, groundY(STATIC_X), -HAWSER_Z - 2.6),
            between(STATIC_X).add(vec3(0.5, 0.2, HAWSER_Z + 2.6)),
        ]),
        // The H-frame, from its brace to the bagging on its top spar.
        framing("bottom-tower", "Bottom tower", [
            onGround(SHEAR_LEG.x - 0.4, 0, -SHEAR_LEG.b / 2 - 0.3),
            onGround(SHEAR_LEG.x + 0.5, SHEAR_LEG.top + 0.1, SHEAR_LEG.b / 2 + 0.3),
        ]),
        // Panned level, back to the shear leg along the lizards and out along the log.
        panned(
            framing("bottom-anchor", "Bottom anchor", [
                onGround(LOG.x + 0.5, 0, -LOG.length / 2),
                onGround(LOG.x - 0.2, 1, LOG.length / 2),
                ...sides.map(lizardEnd),
            ]),
            (c) => [
                vec3(SHEAR_LEG.x, c.y, -LOG.length / 2),
                vec3(LOG.x + 0.5, c.y, LOG.length / 2),
            ],
        ),
    ];
}

/** How high a standing person's eyes are above their feet (metres). */
const EYE_HEIGHT = 1.7;

/** Somewhere to stand on the site and look round from in 3D: where the eye is, and what it looks at first. */
export type FoxStance = {
    slug: string;
    label: string;
    at: Vector3;
    lookAt: Vector3;
    /** How wide it takes in to start with (degrees high), if not the usual. */
    fov?: number;
};
export function foxStances(): FoxStance[] {
    // The platform's deck, on the bottom cross bar.
    const deck = TOWER.lower + TOWER.rhs.h / 2 + 0.05;
    // Between the hawsers, at the hawsers' height, `x` along the span.
    const between = (x: number) => onHawser(x, 1).lerp(onHawser(x, -1), 0.5);
    return [
        (() => {
            // On the launch platform, a step back from its front edge, looking down the span and a little up and
            // towards hawser A, wide enough to take in trolley A just ahead and above.
            const at = vec3(0.3, deck + EYE_HEIGHT, TOWER.z + TOWER.platform.shift);
            return {
                slug: "loader",
                label: "Loader",
                at,
                lookAt: at.add(vec3(10, 2.1, 2.7)),
                fov: 70,
            };
        })(),
        {
            // On the ground between the hawsers, abreast where riders come to rest, looking back up the span at riders
            // coming down.
            slug: "unloader",
            label: "Unloader",
            at: onGround(REST_X, EYE_HEIGHT, 0),
            lookAt: between(SPAN / 3),
        },
        {
            // Halfway along the span, off to hawser B's side, looking across at the hawsers.
            slug: "observer",
            label: "Observer",
            at: onGround(SPAN / 2, EYE_HEIGHT, -12),
            lookAt: between(SPAN / 2),
        },
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
        { name: "Guys", color: C.guy, look: "rope" },
        { name: "Tower backstay", color: C.backstay, look: "rope" },
        { name: "Lashings and ties (natural fibre)", color: C.fibre, look: "rope" },
        { name: "Round slings (4 t)", color: SLINGS.round.color, look: "tape" },
        { name: "Climbing slings", color: SLINGS.climbing.color, look: "tape" },
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
export function groundFaces(step = 2): Piece[] {
    const nx = Math.ceil((GROUND.x1 - GROUND.x0) / step);
    const nz = Math.ceil((2 * GROUND.z) / step);
    // Each corner's own shade too, in finer steps, for the 3D view to blend across the tile.
    const tint = (x: number, z: number) =>
        `color-mix(in oklab, var(--fox-ground-dry) ${Math.round(Math.min(1, Math.max(0, dryness(x, z))) * 25) * 4}%, var(--fox-ground))`;
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
                shades: [tint(a, c), tint(b, c), tint(b, d), tint(a, d)],
            });
        }
    return faces;
}

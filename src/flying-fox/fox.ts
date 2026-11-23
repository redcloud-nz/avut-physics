import { TAPE, type RigLabel } from "@/abseil-tower/rig";
import {
    rod,
    tapeLayers,
    timber,
    type Material,
    type Piece,
    type Strand,
} from "@/abseil-tower/tower";
import { G } from "@/lib/constants";
import { Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import {
    baseClamp,
    baseClampWire,
    carabiner,
    CARABINER_R,
    CARABINER_WIDTH,
    EYE_BOLT,
    eyeBolt,
    eyeFrame,
    grigri,
    pulley,
    shackle,
    SHACKLE_19,
    STOP_BLOCK,
    stopBlock,
    thimble,
    tiedRound,
    turnbuckle,
    wrap,
    zipTrolley,
} from "./hardware";
import { hang, heightAt, lengthForSag, WIRE_EA, WIRE_WEIGHT, type Shape } from "./hawser";

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
 * grade. The unloaded hawsers leave the tower at about 17°: steeper than section 4.7's "conventional" 15° for the
 * unloaded rope, which is advisory and doesn't say where it's measured, but well inside the 45° and 65° maximums
 * (Figures 18 and 19).
 */
export const GRADE = 0.05;

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
/** The dismount zone: from a little short of where riders come to rest to the static brakes. */
export const DISMOUNT = { from: REST_X - 4, to: STATIC_X };
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
    tirfor: "var(--rig-black)",
    tree: "var(--tower-log)",
    spar: "var(--fox-spar)",
    grate: "var(--fox-grate)",
    pulley: "var(--fox-pulley)",
    sheave: "var(--fox-sheave)",
};
/** The trolleys' and pulleys' colours. */
export const TROLLEY_COLORS = {
    plates: "var(--knot-red)",
    sheave: "var(--fox-sheave)",
    steel: "var(--tower-steel)",
    bumper: "var(--rig-black)",
};
/** The size of the stop blocks' eyes, which the joining rope's tied round. */
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
export function line(
    points: Vector3[],
    r: number,
    color: string,
    material: Material = "rope",
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
        });
    }
    return out;
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
    if (kind !== "round") return strands;
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
    const lap = 0.3 * bunched.width;
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
    return kind === "round" ? [...tape, ...stripes(points, profile, z)] : tape;
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
function moved(pieces: Piece[], d: Vector3): Piece[] {
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

/** A guy from `from` to a picket at `at`, the picket leaning away from it. */
function guy(from: Vector3, at: Vector3, r: number, color: string): Piece[] {
    const p = picket(at, towards(from, at));
    return [...p.pieces, ...line(hanging(from, p.tie, 0.05, 12), r, color)];
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

/** A double base clamp on a wire at `at`, the wire running along `along`. */
/** A ring of chain or rope `r` round at `at`, level, as points. */
const ring = (at: Vector3, r: number, n = 16) =>
    Array.from({ length: n + 1 }, (_, i) => {
        const a = (2 * Math.PI * i) / n;
        return at.add(vec3(r * Math.cos(a), 0, r * Math.sin(a)));
    });

/**
 * The steel tower, with its platform, ladder, brake support and guys. It's built about its own middle and moved off the
 * hawsers' by `TOWER.z`; what's placed by the hawsers or elsewhere on the site (the saddles, the backstay to the tree)
 * and what's placed in the site's terms already (the brake support, the top bar's eye bolts) is added after.
 */
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
    // The outer eye bolts in the top bar, their eyes upright, for the platform's stays; the inner ones are drawn with
    // the pulleys hung on them.
    const outerEyes = [-1, 1].map((s) =>
        eyeBolt(topEye(s * TOP_EYES.outer), vec3(1, 0, 0), UP, C.steel),
    );
    for (const e of outerEyes) placed.push(...e.pieces);
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
    for (const s of [-1, 1]) {
        const foot = vec3(0, T.braceFoot, s * (T.half - T.shs / 2 - 0.03));
        const head = vec3(0, T.bar - 0.05, s * 0.15);
        const rise = T.bar + T.rhs.h / 2 + 0.06 - foot.y;
        const top = foot.lerp(head, rise / (head.y - foot.y));
        pieces.push(...section(top, foot, vec3(1, 0, 0), T.rhs.w, T.rhs.h));
    }
    // The brake support: up the middle behind the bars (away from the platform), past the top bar, with an arm out at
    // its top carrying the brake line's pulley, back and to one side.
    const postX = T.shs / 2 - T.rhs.w / 2;
    const postTop = vec3(postX, BRAKE.postTop, T.z);
    placed.push(
        ...section(vec3(postX, T.lower - 0.135, T.z), postTop, vec3(1, 0, 0), T.rhs.w, T.rhs.h),
    );
    const armEnd = BRAKE.armEnd;
    placed.push(...section(postTop.add(vec3(0, -0.04, 0)), armEnd, UP, 0.05, 0.05));
    placed.push(
        ...section(
            postTop.add(vec3(0, -0.35, 0)),
            postTop.lerp(armEnd, 0.5).add(vec3(0, -0.04, 0)),
            UP,
            0.04,
            0.04,
        ),
    );
    // The platform: an aluminium frame on the bottom bar, its floor a grate, its front corners chained up to the top
    // bar's outer eye bolts from eye bolts of their own.
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
    // The stays: each from the eye bolt in the frame's front corner, its eye turned to the stay, up to the top bar's
    // outer eye bolt on its side, held at the edge of each eye it pulls to.
    const grip = (eye: Vector3, out: Vector3, toward: Vector3, to: Vector3) => {
        const { m } = eyeFrame(out, toward);
        const d = to.sub(eye);
        return eye.add(
            d
                .sub(m.scale(d.dot(m)))
                .unit()
                .scale(EYE_BOLT.r),
        );
    };
    for (const [i, z] of [lo + 0.06, hi - 0.06].entries()) {
        const base = vec3(front, floor, z + T.z);
        const top = outerEyes[i];
        const toTop = top.eye.sub(base);
        const corner = eyeBolt(base, UP, toTop, C.steel);
        placed.push(...corner.pieces);
        placed.push(
            ...line(
                [
                    grip(corner.eye, UP, toTop, top.eye),
                    grip(top.eye, vec3(1, 0, 0), UP, corner.eye),
                ],
                0.006,
                C.steel,
                "steel",
            ),
        );
    }
    // A ladder up from the front, as in the photos: resting against the bottom bar's free end, between the platform and
    // the upright on hawser B's side, its rails running on past the bar to hold onto as you step across.
    const ladderZ = (lo - T.half) / 2;
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
    // The hawsers' cradles on the top bar: a channel either side of each hawser.
    for (const s of [-1, 1])
        for (const t of [-1, 1]) {
            const z = s * HAWSER_Z + t * 0.035;
            placed.push(
                ...section(
                    vec3(BAR_X, TOWER.bar + TOWER.rhs.h / 2, z),
                    vec3(BAR_X, TOWER.bar + TOWER.rhs.h / 2 + 0.08, z),
                    ACROSS,
                    0.1,
                    0.006,
                ),
            );
        }
    // Guys: one from each upright's top out to the front and one to the back, at 45° and 1.6 times the tower's height
    // out each way (Figure 40), and the backstay from the top bar's middle back to the tree.
    const out = 1.6 * T.top;
    for (const s of [-1, 1])
        for (const f of [-1, 1]) {
            const from = vec3(0, T.top - 0.05, s * T.half);
            pieces.push(...guy(from, vec3(f * out, 0, s * (T.half + out)), 0.006, C.guy));
        }
    placed.push(
        ...line(
            [...hanging(BACKSTAY_TOP, BACKSTAY_TIE.from, 0.08, 20), ...BACKSTAY_TIE.turn],
            0.0065,
            C.backstay,
        ),
    );
    return [...moved(pieces, vec3(0, 0, T.z)), ...placed];
}

/** The return line's pulley on side `s` (+1 for hawser A's side), under the top bar. */
const RETURN_PULLEY = (s: number) => vec3(0.15, TOWER.bar - 0.2, TOWER.z + s * TOP_EYES.inner);

/**
 * The eye bolts in the top cross bar's platform side, two towards each end: the outer ones' eyes stand upright (their
 * holes level), the inner ones' lie flat (their holes upright), and the return line's pulleys hang from the inner ones.
 * How far each is from the tower's middle.
 */
const TOP_EYES = { outer: 1.35, inner: 1.2 };
/** Where an eye bolt in the top bar's platform side screws in, `z` from the tower's middle. */
const topEye = (z: number) => vec3(BAR_X + TOWER.rhs.w / 2, TOWER.bar, TOWER.z + z);

/** The chain brake: the brake support's top and arm, its pulley, and the chain weight hanging below it. */
export const BRAKE = (() => {
    const postTop = TOWER.bar + 0.615;
    const postX = TOWER.shs / 2 - TOWER.rhs.w / 2;
    const out = vec3(-1, 0, 1).unit().scale(0.6);
    const armEnd = vec3(postX, postTop - 0.02, TOWER.z).add(out);
    // The eye bolt in the arm's underside, 100 mm in from its end.
    const eye = armEnd.sub(out.unit().scale(0.1)).add(vec3(0, -0.025, 0));
    const pulley = eye.add(vec3(0, -0.215, 0));
    return {
        postTop,
        armEnd,
        eye,
        pulley,
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
    return shift(pieces, groundY(TREE.x));
}

/** How high on the trunk the backstay's own sling is, just above the hawsers'. */
const BACKSTAY_SLING_Y = 0.7;
/** The backstay's top end, at the middle of the tower's top bar. */
const BACKSTAY_TOP = vec3(BAR_X, TOWER.bar, TOWER.z);
/**
 * The bow shackle on the backstay's sling: its crown's inside out in front of the tree, straight towards the
 * backstay's top end, so the sling, the shackle and the backstay line up; and the way along it.
 */
const BACKSTAY_SHACKLE = (() => {
    const centre = vec3(TREE.x, groundY(TREE.x) + BACKSTAY_SLING_Y, 0);
    const along = BACKSTAY_TOP.sub(centre).unit();
    return { crown: centre.add(along.scale(TREE.r + 0.45)), along };
})();
/** Where the backstay's tied to its shackle's pin, for now with a turn round it. */
const BACKSTAY_TIE = (() => {
    const { crown, along } = BACKSTAY_SHACKLE;
    const { upright } = linkPlanes(along);
    const pin = crown.add(along.scale(SHACKLE_19.length + SHACKLE_19.pin));
    return tiedRound(pin, upright.cross(along), SHACKLE_19.pin, BACKSTAY_TOP, 0.0065);
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
    // Guys from each upright's top, at 45° out to the front and back, 1.6 times its height each way (Figure 34).
    const out = 1.6 * L.top;
    for (const s of [-1, 1])
        for (const f of [-1, 1]) {
            const from = vec3(L.x, g + L.top - 0.1, s * half);
            frame.push(...guy(from, vec3(L.x + f * out, 0, s * (half + out)), 0.006, C.guy));
        }
    return frame;
}

/** Where a hawser comes down from the shear leg to the anchor: from the saddle to the bow shackle on its sling. */
export const SADDLE = (s: number) => vec3(SPAR_X, SADDLE_Y, s * HAWSER_Z);
/** Where each sling round the log is: one for each hawser either side, and the Tirfor's in the middle. */
export const SLING_Z = 0.8;
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
        const front = picket(vec3(LOG.x - LOG.r - 0.02, 0, z), back);
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
    for (const z of [-SLING_Z, 0, SLING_Z]) {
        const crown = ANCHOR_SHACKLE(z);
        const log = LOG_AT(z);
        const bar = crown.sub(crown.sub(log).unit().scale(SHACKLE_19.body));
        pieces.push(...basketedSling("round", log, LOG.r, bar, SHACKLE_19.body, UP, vec3(0, 0, 1)));
    }
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
function hawserFoot(s: number): Piece[] {
    const pieces: Piece[] = [];
    const a = ANCHOR_SHACKLE(s * SLING_Z);
    const saddle = SADDLE(s);
    const along = saddle.sub(a).unit();
    const { flat, upright } = linkPlanes(along);
    const bow = shackle("bow", a, along, flat, C.steel, C.pin);
    const tb = turnbuckle(bow.far, along, upright, C.steel);
    const d1 = shackle("d", tb.far, along, flat, C.steel, C.pin);
    const d2 = shackle("d", d1.far, along, upright, C.steel, C.pin);
    const d3 = shackle("d", d2.far, along, flat, C.steel, C.pin);
    pieces.push(...bow.pieces, ...tb.pieces, ...d1.pieces, ...d2.pieces, ...d3.pieces);
    pieces.push(
        ...madeOff(d3.far, along, upright, saddle, (end, side) => {
            const k = Math.sign(side.z) || s;
            const out = end.add(along.scale(0.1));
            return smooth(
                [
                    out,
                    out.add(along.scale(0.4)).add(vec3(0, -0.3, k * 0.15)),
                    onGround(out.x - 0.2, 0.02, s * 1.6),
                    onGround(LOG.x - 0.6, 0.02, s * 2.2),
                    onGround(LOG.x + 0.2, 0.02, s * 1.7),
                    onGround(LOG.x - 0.4, 0.02, s * 1.3),
                ],
                6,
            );
        }),
    );
    return pieces;
}

/** Where the turnbuckle is on hawser `s`'s in-line hardware, for its label: a little out from the anchor. */
export const TURNBUCKLE_AT = (s: number) => {
    const a = ANCHOR_SHACKLE(s * SLING_Z);
    return a.add(SADDLE(s).sub(a).unit().scale(0.35));
};

/** The lizard on hawser A, left slack in line to the Tirfor as a back-up once the hardware takes the load. */
export const LIZARD = { clamps: [2.9, 3.05, 3.2] };
/** The lizard's wire's radius. */
const LIZARD_R = 0.004;
function lizardAndTirfor(): Piece[] {
    const pieces: Piece[] = [];
    const a = ANCHOR_SHACKLE(SLING_Z);
    const along = SADDLE(1).sub(a).unit();
    const on = (d: number) => a.add(along.scale(d));
    // The way from the hawser to the lizard, which lie in a clamp's two throats.
    const toward = vec3(0, -0.016, -0.012).unit();
    const side = toward.scale(baseClampWire(HAWSER_R) + baseClampWire(LIZARD_R));
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
    pieces.push(...line(hanging(start, reach, 0.12, 16), LIZARD_R, C.hawser, "steel"));
    pieces.push(
        ...line([reach, on(LIZARD.clamps[2] + 0.12).add(side)], LIZARD_R, C.hawser, "steel"),
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
function hawsers(): Piece[] {
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
        pieces.push(...line(span, HAWSER_R, C.hawser, "steel"));
        pieces.push(...hawserFoot(s));
    }
    return pieces;
}

/**
 * A rope from a carabiner hanging down with its gate towards `ACROSS`, tied for now round its bottom bar (whose middle
 * is `at`) and on through `rest`: in the middle of the bar, or `spine` (radians) round the bend towards the spine.
 */
export function tiedTo(at: Vector3, rest: Vector3[], r: number, color: string, spine = 0): Piece[] {
    const end = CARABINER_WIDTH / 2;
    const down = vec3(0, -1, 0);
    // Round the bottom bend's middle line, from the bottom towards the spine (away from the gate).
    const bend = at.sub(down.scale(end));
    const bar = bend
        .sub(ACROSS.scale(end * Math.sin(spine)))
        .add(down.scale(end * Math.cos(spine)));
    const axis = ACROSS.scale(Math.cos(spine)).add(down.scale(Math.sin(spine)));
    const t = tiedRound(bar, axis, CARABINER_R, rest[0], r);
    return [...line(t.turn, r, color), ...line([t.from, ...rest], r, color)];
}

/**
 * A trolley on the wire at `at`, its bumper towards `ahead` (downhill, where it meets the brake blocks), with its two
 * carabiners hanging straight down from the holes below: the rider's dropper on the middle one, and the back-up line
 * and the return line together on the one behind it, uphill. Returns where each carabiner's bottom is.
 */
export function rigTrolley(
    at: Vector3,
    ahead: Vector3,
): { pieces: Piece[]; hang: Vector3; backUp: Vector3 } {
    const t = zipTrolley(at, ahead, ACROSS, HAWSER_R, TROLLEY_COLORS);
    const pieces: Piece[] = [...t.pieces];
    const down = vec3(0, -1, 0);
    const clip = (top: Vector3, length: number) => {
        const bar = top.add(vec3(0, -0.005, 0));
        pieces.push(...carabiner(bar, down, ACROSS, C.steel, length));
        return bar.add(down.scale(length));
    };
    return { pieces, hang: clip(t.main, 0.11), backUp: clip(t.towSide, 0.1) };
}

/** A trolley on hawser `s` at `x`, with its dropper: where its tow points are, back (uphill) and front. */
function trolley(x: number, s: number): { pieces: Piece[]; back: Vector3 } {
    const at = onHawser(x, s);
    const ahead = onHawser(x + 0.1, s)
        .sub(onHawser(x - 0.1, s))
        .unit();
    const { pieces, hang, backUp } = rigTrolley(at, ahead);
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
    // Its carabiner through the hole, hanging from the hole's bottom edge to the tie-in.
    const holeBottom = tieIn.add(vec3(0, clipLength - g.holeR + 0.005, 0));
    pieces.push(...carabiner(holeBottom, down, ACROSS, C.steel, clipLength - g.holeR + 0.005));
    pieces.push(...tiedTo(hang, [...g.rope, ...g.brake(0.9)], 0.0055, C.dropper));
    // The safety (back-up) line, down beside it to a carabiner of its own on the harness.
    const safetyClip = tieIn.add(vec3(-0.05, clipLength, 0));
    const safety = hanging(backUp, safetyClip, -0.05, 8);
    pieces.push(...tiedTo(backUp, safety.slice(1, -1), 0.0055, C.dropper));
    pieces.push(...tiedTo(safetyClip, safety.slice(1, -1).reverse(), 0.0055, C.dropper));
    pieces.push(...carabiner(safetyClip, down, ACROSS, C.steel, clipLength));
    return { pieces, back };
}

/** How far round its carabiner's bottom bend towards the spine the return line's tied (radians). */
const RETURN_SPINE = 1.1;

/** Where the trolleys sit: A at the launch, just out from the platform, and B at the bottom against its brake block. */
export const TROLLEY_X = { a: 1.4, b: BLOCKS_X - 0.15 };

/** The trolleys and the return line joining them over the tower's pulleys. */
function trolleysAndReturn(): Piece[] {
    const a = trolley(TROLLEY_X.a, 1);
    const b = trolley(TROLLEY_X.b, -1);
    const [ca, cb] = [RETURN_PULLEY(1), RETURN_PULLEY(-1)];
    // Each pulley clipped into the inner eye bolt on its side, its eye lying flat.
    // Out to trolley B, sagging well below hawser B: slacker than the hawsers, twice their sag for its length (as long
    // as it stays clear of the ground).
    const slack = (a: Vector3, z: Vector3) => sagLike(a, z, 2);
    const out = hanging(cb, b.back, slack(cb, b.back), 60);
    const bolt = (s: number) => ({
        eyeBolt: { base: topEye(s * TOP_EYES.inner), out: vec3(1, 0, 0), toward: ACROSS },
    });
    const pa = rigPulley(ca, a.back, cb, 0.004, bolt(1));
    const pb = rigPulley(cb, pa.centre, out[1], 0.004, bolt(-1));
    return [
        ...a.pieces,
        ...b.pieces,
        ...pa.pieces,
        ...pb.pieces,
        ...tiedTo(a.back, [...pa.round, ...pb.round], 0.004, C.returnLine, RETURN_SPINE),
        // Out to trolley B, sagging under its own weight below hawser B.
        ...tiedTo(
            b.back,
            hanging(pb.b, b.back, slack(pb.b, b.back), 60).reverse().slice(1),
            0.004,
            C.returnLine,
            RETURN_SPINE,
        ),
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
        // The joining rope's tied to the eye on the inside, towards the other hawser.
        const block = stopBlock(at, along, UP, vec3(0, 0, -s), HAWSER_R, STOP_BLOCK_COLORS);
        pieces.push(...block.pieces);
        eyes.push(block.inner);
    }
    // The joining rope: 2.5 m with its knots tied, its middle drawn up the span by the brake line.
    const half = 1.25;
    const across = eyes[0].distanceTo(eyes[1]) / 2;
    const apex = eyes[0]
        .lerp(eyes[1], 0.5)
        .add(vec3(-Math.sqrt(half * half - across * across), -0.05, 0));
    // The middle: one carabiner lying along the span (Figure 55), the brake line clipped into its uphill end, and the
    // joining rope's middle and the stabiliser side by side in its downhill end. The real knots, for when they're
    // drawn: the brake line and the stabiliser each end in a figure 8 on a bight, and the joining rope's middle is an
    // alpine butterfly. Until then, each rope takes a turn round the carabiner's bar.
    const ropeR = 0.004;
    const clip = 0.11;
    const ahead = vec3(1, 0, 0);
    const downhill = apex.sub(ahead.scale(CARABINER_R + ropeR));
    const uphill = downhill.sub(ahead.scale(clip));
    pieces.push(...carabiner(uphill, ahead, ACROSS, C.steel, clip));
    const knot = tiedRound(
        downhill.add(ACROSS.scale(0.008)),
        ACROSS,
        CARABINER_R,
        apex.add(ahead),
        ropeR,
    );
    pieces.push(...line(knot.turn, ropeR, C.joining));
    // The joining rope's legs, out from the knot to each block's eye, tied straight round the eye's bar: really a
    // rethreaded figure 8 (drawn as a figure 8 on a bight).
    for (const e of eyes) {
        const level = knot.from.sub(e);
        const w = vec3(level.x, 0, level.z).unit();
        const t = tiedRound(
            e.add(w.scale(STOP_BLOCK_EYE.r)),
            UP.cross(w),
            STOP_BLOCK_EYE.bar,
            knot.from,
            ropeR,
        );
        pieces.push(...line(t.turn, ropeR, C.joining));
        pieces.push(...line(hanging(t.from, knot.from, 0.03, 8), ropeR, C.joining));
    }
    // The brake line, back up the span to the pulley on the brake support's arm and straight down to the chain.
    const brakeEye = tiedRound(uphill, ACROSS, CARABINER_R, uphill.sub(ahead), 0.004);
    pieces.push(...line(brakeEye.turn, 0.004, C.brakeLine));
    const from = brakeEye.from;
    // Sagging much as the hawsers do.
    const reach = hanging(from, BRAKE.pulley, sagLike(from, BRAKE.pulley), 50);
    // Clipped into the eye bolt under the arm, its eye turned to face the pull.
    const brake = rigPulley(BRAKE.pulley, reach[reach.length - 3], BRAKE.chainTop, 0.004, {
        eyeBolt: { base: BRAKE.eye, out: vec3(0, -1, 0) },
    });
    pieces.push(...brake.pieces);
    pieces.push(...line(hanging(from, brake.a, sagLike(from, brake.a), 50), 0.004, C.brakeLine));
    pieces.push(...line([...brake.round, BRAKE.chainTop], 0.004, C.brakeLine));
    // The stabiliser: shock cord, stretched, from the joining rope's middle to the pulley under the shear leg's top spar
    // and down from it, tied off to the bottom spar with natural fibre rope.
    const g = groundY(SHEAR_LEG.x);
    const centre = STABILISER_PULLEY.add(vec3(0, g, 0));
    const tie = vec3(SPAR_X, g + SHEAR_LEG.lower + SHEAR_LEG.r + 0.35, 0);
    const spar = vec3(SPAR_X, g + SHEAR_LEG.lower + SHEAR_LEG.r, 0);
    // From its eye in the carabiner's downhill end, beside the joining rope's knot.
    const eye = tiedRound(downhill.sub(ACROSS.scale(0.008)), ACROSS, CARABINER_R, centre, 0.005);
    pieces.push(...line(eye.turn, 0.005, C.shockCord));
    const cord = eye.from;
    const stabiliser = rigPulley(centre, cord, tie, 0.005, {
        basket: {
            spar: vec3(SPAR_X, g + SHEAR_LEG.spar, 0),
            along: ACROSS,
            r: SHEAR_LEG.r,
            drop: SHEAR_LEG.r + 0.25,
        },
    });
    pieces.push(...stabiliser.pieces);
    pieces.push(...line([cord, ...stabiliser.round, tie], 0.005, C.shockCord));
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

/**
 * The static brakes: a carabiner clipped round each hawser, hanging towards the pull of a rope tied to it and out to a
 * picket 2.5 m to its side (Figure 55).
 */
function staticBrakes(): Piece[] {
    const pieces: Piece[] = [];
    const length = 0.11;
    for (const s of [-1, 1]) {
        const at = onHawser(STATIC_X, s);
        const base = vec3(STATIC_X, 0, s * (HAWSER_Z + 2.5));
        const pk = picket(base, towards(at, base));
        // Square to the hawser, swung to the rope's pull, the wire in its top bend.
        const pull = pk.tie.sub(at);
        const down = vec3(0, pull.y, pull.z).unit();
        const across = down.cross(vec3(1, 0, 0)).unit();
        const top = at.sub(down.scale(HAWSER_R + CARABINER_R));
        pieces.push(...carabiner(top, down, across, C.steel, length));
        const t = tiedRound(top.add(down.scale(length)), across, CARABINER_R, pk.tie, 0.0055);
        pieces.push(
            ...pk.pieces,
            ...line(t.turn, 0.0055, C.staticBrake),
            ...line([t.from, pk.tie], 0.0055, C.staticBrake),
        );
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
        { text: "Steel tower", at: vec3(0, TOWER.top, TOWER.z + TOWER.half), side: "left" },
        {
            text: "Launch platform",
            at: vec3(0.6, floor, TOWER.z + TOWER.platform.shift),
            side: "right",
        },
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
        { text: "Turnbuckle", at: TURNBUCKLE_AT(-1), side: "right" },
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

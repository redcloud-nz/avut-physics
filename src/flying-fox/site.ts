import { G } from "@/lib/constants";
import { Vector2 } from "@/lib/vector2";
import { vec3 } from "@/lib/vector3";

import { hang, heightAt, lengthForSag, WIRE_EA, WIRE_WEIGHT, type Shape } from "./hawser";

/**
 * The flying fox's site and its fixed sizes: the ground falling along the run, the span and the hawsers' sag, where
 * the tower, the tree, the shear leg, the log, the brake and the return pulleys are, and the rider. The physics
 * (`run.ts`) and the drawing (`fox.ts`) both read them. Every size not in the book is an estimate.
 *
 * Scene coordinates are metres with x along the run from the top end (the launch) to the bottom end (the landing), y up
 * and z across it, the origin on the ground under the middle of the steel tower's uprights. Hawser A is on the +z
 * side, hawser B on the −z side.
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
export function natural(x: number): number {
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
export const BAR_X = TOWER.shs / 2 + TOWER.rhs.w / 2;

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
export const BAGGING_R = SHEAR_LEG.r + 0.025;

/** Where a hawser crosses the shear leg's top spar, which is on the anchor side of the uprights (Figure 33). */
export const SPAR_X = SHEAR_LEG.x + 2 * SHEAR_LEG.r;

export const SADDLE_Y = -FALL + SHEAR_LEG.spar + BAGGING_R + HAWSER_R;

/**
 * A hawser between its cradle on the tower and its saddle on the shear leg, held there (it can't slide over them), so
 * the stretch of the lengths beyond, back to the anchors, is left out.
 */
export const RIG = {
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
export const STABILISER_PULLEY = vec3(SPAR_X, SHEAR_LEG.spar - SHEAR_LEG.r - 0.25, 0);

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

/** A point `h` above the ground at `x`, `z`. */
export const onGround = (x: number, h: number, z: number) => vec3(x, groundY(x) + h, z);

/** A hawser's height along the span, unloaded, at `x` (from the tower's cradle to the shear leg's saddle). */
export function hawserY(x: number): number {
    return heightAt(UNLOADED, x);
}

/** Where hawser `side` (+1 for A, −1 for B) is at `x` along the span. */
export const onHawser = (x: number, side: number) => vec3(x, hawserY(x), side * HAWSER_Z);

/** The return line's pulley on side `s` (+1 for hawser A's side), under the top bar. */
export const RETURN_PULLEY = (s: number) => vec3(0.15, TOWER.bar - 0.2, TOWER.z + s * RETURN_EYE_Z);

/**
 * How far the return line's pulleys' eye bolts are from the tower's middle, in the top cross bar's platform side, their
 * eyes lying flat (their holes upright). The platform's stays hang from the bolts through the bar into the uprights.
 */
export const RETURN_EYE_Z = 1.35;

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

/** Where the trolleys sit: A at the launch, just out from the platform, and B at the bottom against its brake block. */
export const TROLLEY_X = { a: 1.4, b: BLOCKS_X - 0.15 };

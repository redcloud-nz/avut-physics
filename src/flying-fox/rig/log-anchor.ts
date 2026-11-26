import { C, TIRFOR_COLORS } from "@/flying-fox/colors";
import { groundY, HAWSER_R, HAWSER_Z, LOG, onGround } from "@/flying-fox/site";
import { cubicPoints } from "@/lib/curve3";
import { arcLengths } from "@/lib/rope-3d/rope";
import { vec3, type Vector3 } from "@/lib/vector3";
import {
    ANCHOR_HOOK,
    baseClamp,
    baseClampWire,
    CABLE_HOOK,
    hook,
    SHACKLE_19,
    thimble,
    THIMBLE_11,
    tirfor,
} from "@/rigging/hardware";
import { bar, line } from "@/rigging/rope";
import { basketedSling, SLINGS } from "@/rigging/slings";
import { type Piece } from "@/scene/pieces";

import { picket, UP } from "./shared";
import { SADDLE, SLING_Z } from "./shear-leg";

/** The log and picket anchor behind the shear leg, and the lizards and Tirfor that tension the hawsers from it. */

/** The log's middle at `z`, the log resting on the slings under it. */
export const LOG_AT = (z: number) =>
    vec3(LOG.x, groundY(LOG.x) + LOG.r + 2 * SLINGS.round.thickness, z);

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
export function logAnchor(): Piece[] {
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

/** The point `d` along `path`, and the way it runs there. */
export function alongPath(path: Vector3[], d: number): { at: Vector3; dir: Vector3; i: number } {
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
export function swagedEye(
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
 * The lizards, one clamped on each hawser well up from the anchor (`clamps`, metres up the hawser from its bow shackle),
 * the wire running on `tail` past the top clamp to its free eye, and `hang` of it between the bottom clamp and the
 * bottom eye. Hawser A's is left slack in line to the Tirfor as a back-up once the hardware takes the load.
 */
export const LIZARD = { clamps: [5.0, 5.15, 5.3], tail: 0.5, hang: 0.5 };

/** The lizard's wire's radius. */
export const LIZARD_R = 0.004;

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
export const TIRFOR_RIG = (() => {
    const log = LOG_AT(0);
    const ahead = lizardFoot(1).sub(log);
    const u = vec3(ahead.x, 0, ahead.z).unit();
    const start = log.add(u.scale(LOG.r + 0.45));
    const anchor = vec3(start.x, groundY(start.x + u.x * 0.26) + 0.004, start.z);
    const t = tirfor(anchor, u, UP, TIRFOR_COLORS);
    const h = hook(t.pin, u.neg(), t.pinAlong, C.steel);
    return { tirfor: t, hook: h, u };
})();

/**
 * A lizard on hawser `s`: its three double base clamps, and the wire from `foot` (its bottom eye's ferrule, the wire
 * coming up `hang` to the bottom clamp) along the hawser through them and on to its free eye.
 */
export function lizard(s: number, hang: Vector3[]): Piece[] {
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
    const free = cubicPoints(
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
export function lizardAndTirfor(): Piece[] {
    const pieces: Piece[] = [];
    const { tirfor: t, hook: anchorHook, u } = TIRFOR_RIG;
    pieces.push(...t.pieces, ...anchorHook.pieces);

    // Hawser A: the whole slack run, kept off the ground.
    const A = lizardLine(1);
    const footA = lizardFoot(1);
    const span = footA.distanceTo(t.ropeOut);
    const run = cubicPoints(
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
            cubicPoints(
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
                ...cubicPoints(
                    tail,
                    tail.add(back.scale(0.2)),
                    crest.sub(back.scale(0.25)),
                    crest,
                    16,
                ),
                ...cubicPoints(
                    crest,
                    crest.add(back.scale(0.3)),
                    land.sub(away.scale(0.35)),
                    land,
                    16,
                ).slice(1),
                ...cubicPoints(
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

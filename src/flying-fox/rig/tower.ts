import { C } from "@/flying-fox/colors";
import {
    BAR_X,
    BRAKE,
    CRADLE_Y,
    groundY,
    HAWSER_R,
    HAWSER_Z,
    onGround,
    RETURN_EYE_Z,
    TOWER,
    TREE,
} from "@/flying-fox/site";
import { vec3, type Vector3 } from "@/lib/vector3";
import {
    chain,
    CHAIN_G80_6,
    EYE_BOLT_M16,
    eyeBolt,
    eyeFrame,
    M12,
    M16,
    plate,
    shackle,
    SHACKLE_6,
    SHACKLE_19,
    throughBolt,
    type Frame,
} from "@/rigging/hardware";
import { boxBar, figure8 } from "@/rigging/knots";
import { bar, hanging, line, section } from "@/rigging/rope";
import { type Piece } from "@/scene/pieces";
import { moved } from "@/scene/transforms";

import { ACROSS, BIG_LOOP, guy, linkPlanes, UP } from "./shared";

/** The FFSAC steel tower at the top end: its frame, bolts and hawser guides, its guys, the platform's chain stays and the backstay. */

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

export function tower(): Piece[] {
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

/** Where an eye bolt in the top bar's platform side screws in, `z` from the tower's middle. */
export const topEye = (z: number) => vec3(BAR_X + TOWER.rhs.w / 2, TOWER.bar, TOWER.z + z);

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
export const BACKSTAY_SLING_Y = 0.7;

/** The back of the brake support's post up the tower's middle, just behind the top cross bar (`rhs.w` deep). */
const POST_BACK = TOWER.shs / 2 - TOWER.rhs.w;

/** The front of the top cross bar, on the uprights' front faces. */
const BAR_FRONT = BAR_X + TOWER.rhs.w / 2;

/**
 * The backstay's top end: the joint of the top cross bar and the brake support's post behind it, at the middle of the
 * two together, which its loop wraps diagonally.
 */
export const BACKSTAY_TOP = vec3((POST_BACK + BAR_FRONT) / 2, TOWER.bar, TOWER.z);

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
export const BACKSTAY_SHACKLE = (() => {
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
export const BACKSTAY_TIE = (() => {
    const { crown, along } = BACKSTAY_SHACKLE;
    const { upright } = linkPlanes(along);
    const pin = crown.add(along.scale(SHACKLE_19.length + SHACKLE_19.pin));
    return figure8(pin, upright.cross(along), SHACKLE_19.pin, BACKSTAY_TOP, 0.0065);
})();

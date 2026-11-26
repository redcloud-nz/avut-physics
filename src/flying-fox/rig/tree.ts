import { C } from "@/flying-fox/colors";
import { BAR_X, CRADLE_Y, groundY, HAWSER_Z, TREE } from "@/flying-fox/site";
import { vec3, type Vector3 } from "@/lib/vector3";
import { shackle, SHACKLE_19 } from "@/rigging/hardware";
import { bar } from "@/rigging/rope";
import { basketedSling, SLINGS, stripes, tapeRun, type TapeSize } from "@/rigging/slings";
import { type Piece, type Strand } from "@/scene/pieces";
import { moved } from "@/scene/transforms";

import { ACROSS, linkPlanes, NOT_OVERHEAD, UP } from "./shared";
import { BACKSTAY_SHACKLE, BACKSTAY_SLING_Y } from "./tower";

/** The tree at the top end the hawsers are slung round: its trunk and branches, its bagging, and the choked slings and shackles. */

/** The tree, its bagging, and the two slings round it the hawsers are shackled to. */
export function tree(): Piece[] {
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
    const up = moved(branches, vec3(0, groundY(TREE.x), 0));
    for (const b of up) NOT_OVERHEAD.add(b);
    return [...moved(pieces, vec3(0, groundY(TREE.x), 0)), ...up];
}

/** How far out along a tree sling's leg, from the trunk towards the shackle, its choke sits. */
export const TREE_CHOKE_AT = 0.5;

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
export const TREE_CHOKE = (s: number) => {
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
export function chokedSling(
    angle: number,
    turn: number,
    y: number,
    R: number,
    crown: Vector3,
): Strand[] {
    const { width, thickness, r, heavy: color, bunched } = SLINGS.round;
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

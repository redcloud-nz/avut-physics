import { C } from "@/flying-fox/colors";
import { BAR_X, CRADLE_Y, groundY, HAWSER_Z, TREE } from "@/flying-fox/site";
import { vec3, type Vector3 } from "@/lib/vector3";
import { linkPlanes, shackle, SHACKLE_19 } from "@/rigging/hardware";
import { bar } from "@/rigging/rope";
import { basketedSling, SLINGS } from "@/rigging/slings";
import * as slings from "@/rigging/slings";
import { type Piece } from "@/scene/pieces";
import { moved } from "@/scene/transforms";

import { ACROSS, NOT_OVERHEAD, UP } from "./shared";
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

/** A round sling choked round the tree (see `rigging/slings`). */
function chokedSling(angle: number, turn: number, y: number, R: number, crown: Vector3) {
    return slings.chokedSling(vec3(TREE.x, 0, 0), angle, turn, y, R, crown, {
        chokeAt: TREE_CHOKE_AT,
        barR: SHACKLE_19.body,
    });
}

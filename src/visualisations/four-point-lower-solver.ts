import { vec2, Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import { ropePathFor } from "./ladder-hinge-held";

/**
 * A four-point lower: a stretcher lowered level down a slot, on four ropes, one from each corner to its own
 * hard belay. The belays stand in a rectangle round the slot: one at the head and one at the foot on each side,
 * set back from the slot's edges, and the stretcher hangs centred under them. Each rope runs over the slot's
 * edge on its way down when it has to.
 *
 * Coordinates: x across the slot, from its middle; y up, from the slot's bottom; z along the slot, from the
 * stretcher's middle. The slot's edges run along z at x = ±slotWidth / 2, y = slotDepth. Everything is
 * symmetric in x and in z, so all four ropes are mirror images and carry the same tension, and the stretcher
 * stays level. The rope worked out is the one on the x > 0, z > 0 side; the others mirror it.
 *
 * Seen end on, along the slot, each rope's path is the two-point lower's, over a wall with its face at the slot's
 * edge. Its run along the slot makes it longer: unfolded flat about the edge, the rope is a straight line, so its
 * length is the end-on length and the run along the slot added as the sides of a right-angled triangle.
 *
 * The stretcher settles where its potential energy is lowest: as low as the ropes let it, or on the slot's bottom.
 * The forces then follow from balancing it: the four ropes' upward pulls hold its weight between them.
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
    /** Each rope's length, from belay to stretcher. */
    rope: number;
    barLength: number;
    barWidth: number;
    barWeight: number;
};

export type Lowered = {
    /** How high the stretcher hangs above the slot's bottom. */
    height: number;
    /** The x > 0, z > 0 rope's belay, edge crossing (when it wraps over the edge) and stretcher corner. */
    anchor: Vector3;
    edgeCrossing: Vector3 | null;
    corner: Vector3;
    /** The ropes are taut, rather than the stretcher resting on the slot's bottom. */
    ropeTaut: boolean;
    /** Each rope's tension. */
    tension: number;
    /** The x > 0, z > 0 rope's pull on the stretcher's corner. */
    pull: Vector3;
    /** The rope's push on the slot's edge, as it wraps over it (zero when it doesn't). */
    onEdge: Vector3;
    /** The rope's angle from straight up, where it meets the stretcher (radians). */
    angle: number;
    /** The slot's bottom's push up on the stretcher (zero while it hangs). */
    ground: number;
};

export type LowerResult = { kind: "lowered"; l: Lowered } | { kind: "none"; reason: string };

/** The x > 0 rope seen end on: the two-point lower's, with the slot's edge as the wall's top edge. */
function endOnSetup(s: Setup) {
    return { wallHeight: s.slotDepth, anchorUp: s.anchorUp, anchorBack: s.anchorBack };
}

/** The x > 0 corner of the stretcher seen end on, at this height, in the two-point lower's coordinates: x out
 * from the wall's face into the slot. */
const endOnCorner = (s: Setup, height: number) => vec2((s.slotWidth - s.barWidth) / 2, height);

/** How far along the slot each rope runs, from the stretcher's corner to its belay. */
const alongRun = (s: Setup) => (s.belaySpacing - s.barLength) / 2;

/** Each rope's length with the stretcher at this height. */
export function ropeAt(s: Setup, height: number): number {
    return Math.hypot(ropePathFor(endOnSetup(s), endOnCorner(s, height)).length, alongRun(s));
}

/** The shortest rope: the stretcher level with the floor, ready to go down. */
export const minRope = (s: Omit<Setup, "rope">) => ropeAt({ ...s, rope: 0 }, s.slotDepth);

/** The longest rope: the stretcher on the slot's bottom. */
export const maxRope = (s: Omit<Setup, "rope">) => ropeAt({ ...s, rope: 0 }, 0);

export function solveLower(s: Setup): LowerResult {
    if (s.barWeight <= 0) return { kind: "none", reason: "Give the stretcher some mass." };
    if (s.barWidth >= s.slotWidth)
        return { kind: "none", reason: "The stretcher is too wide to fit down the slot." };
    if (s.rope < minRope(s))
        return { kind: "none", reason: "The ropes are too short to reach the floor." };
    const W = s.barWeight;

    // Below the belays, the rope only gets longer as the stretcher goes down, so the lowest height it allows is
    // where it's exactly its length: found by halving the interval it's in. Past the bottom, it rests there.
    const onBottom = ropeAt(s, 0) <= s.rope;
    let height = 0;
    if (!onBottom) {
        let lo = 0;
        let hi = s.slotDepth;
        for (let i = 0; i < 60; i++) {
            const mid = (lo + hi) / 2;
            if (ropeAt(s, mid) > s.rope) lo = mid;
            else hi = mid;
        }
        height = hi;
    }

    // The x > 0, z > 0 rope, from the end-on view back to three dimensions.
    const toWorld = (p: Vector2, z: number) => vec3(s.slotWidth / 2 - p.x, p.y, z);
    const endOn = endOnCorner(s, height);
    const path = ropePathFor(endOnSetup(s), endOn);
    const along = alongRun(s);
    const corner = toWorld(endOn, s.barLength / 2);
    const anchor = toWorld(vec2(-s.anchorBack, s.slotDepth + s.anchorUp), s.belaySpacing / 2);
    // Unfolded, the rope's run along the slot grows steadily with its end-on length.
    const edgeCrossing = path.wrapEdge
        ? toWorld(
              path.wrapEdge,
              s.barLength / 2 + (along * path.wrapEdge.distanceTo(endOn)) / path.length,
          )
        : null;
    const towards = (edgeCrossing ?? anchor).sub(corner).unit();

    // The four ropes' upward pulls share the weight equally; the slot's bottom takes it once it's there.
    const tension = onBottom ? 0 : W / 4 / towards.y;
    const pull = towards.scale(tension);
    const onEdge = edgeCrossing
        ? anchor.sub(edgeCrossing).unit().add(corner.sub(edgeCrossing).unit()).scale(tension)
        : vec3(0, 0, 0);
    return {
        kind: "lowered",
        l: {
            height,
            anchor,
            edgeCrossing,
            corner,
            ropeTaut: !onBottom,
            tension,
            pull,
            onEdge,
            angle: Math.acos(Math.min(1, towards.y)),
            ground: onBottom ? W : 0,
        },
    };
}

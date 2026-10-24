import { vec2, type Vector2 } from "./vector2";

/*
 * The wall several solvers share: its face at x = 0, its top at wallHeight, and a rope anchored behind and above its
 * top edge.
 */

export type Wall = {
    wallHeight: number;
    /** How far the anchor is above the wall top, and back from the face. */
    anchorUp: number;
    anchorBack: number;
};

/** Where the rope is anchored. */
export const anchorOf = (s: Wall) => vec2(-s.anchorBack, s.wallHeight + s.anchorUp);

/** Behind the wall's face: on the wall top, or inside the wall nearer the top than the face. */
export function behindFaceFor(s: Wall, p: Vector2) {
    return p.x < 0 && (p.y >= s.wallHeight || s.wallHeight - p.y < -p.x);
}

/**
 * The rope's path from its anchor to p, over the wall's edge when the straight line would cut through the wall. It
 * carries on smoothly into the wall, where a minimiser may briefly push an end: as if from the face or the top,
 * whichever is nearer.
 */
export function ropePathFor(s: Wall, p: Vector2): { length: number; wrapEdge: Vector2 | null } {
    const anchor = anchorOf(s);
    const edge = vec2(0, s.wallHeight);
    return !behindFaceFor(s, p) && edge.sub(anchor).cross(p.sub(anchor)) < 0
        ? { length: edge.distanceTo(anchor) + p.distanceTo(edge), wrapEdge: edge }
        : { length: p.distanceTo(anchor), wrapEdge: null };
}

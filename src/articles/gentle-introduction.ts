import { vec2, Vector2 } from "@/lib/vector2";

/*
 * The maths behind A Gentle Introduction to Rescue Physics' figures: short enough to work out as the reader moves a
 * slider, so none of it needs saving ahead of time. Ropes and slings here don't stretch, and nothing has friction.
 * Coordinates have y up; angles are in radians.
 */

/** Each leg's share of the load, with two legs `angle` apart holding it evenly. */
export const legShare = (angle: number) => 1 / (2 * Math.cos(angle / 2));

/** The pull on a redirect, as a share of the rope's tension, with the rope's two parts `angle` apart. */
export const redirectShare = (angle: number) => 2 * Math.cos(angle / 2);

/** The load's pull per unit of load: straight down, or swung off it by `swing` towards +x as when the main line runs off at an angle. */
export const swungDown = (swing: number) => vec2(Math.sin(swing), -Math.cos(swing));

/**
 * Two anchors level with each other, `gap` apart at (±gap / 2, 0), each with a leg `leg` long to a master point
 * below. The rig is just snug with the master point straight below their middle.
 */
export type TwoAnchors = { gap: number; leg: number };

export type Swung = {
    master: Vector2;
    anchors: [Vector2, Vector2];
    /** Each anchor's pull as a share of the load, left then right. */
    shares: [number, number];
};

export const anchorsOf = (r: TwoAnchors): [Vector2, Vector2] => [
    vec2(-r.gap / 2, 0),
    vec2(r.gap / 2, 0),
];

/** Where the master point is with the rig snug and the load straight down. */
export const tiedAt = (r: TwoAnchors) => vec2(0, -Math.sqrt(r.leg ** 2 - (r.gap / 2) ** 2));

/**
 * Pre-equalised: each leg keeps its length, so the master point stays put while both legs are taut, and the legs
 * share the load however balances it there. Once the load swings outside the legs' V, the far leg goes slack and
 * the master point swings out to hang from the near one alone.
 */
export function preEqualised(r: TwoAnchors, swing: number): Swung {
    const anchors = anchorsOf(r);
    const d = swungDown(swing);
    const m = tiedAt(r);
    const [u, v] = anchors.map((a) => a.sub(m).unit());
    // The legs' pulls, T₁u + T₂v, balance the load's, d.
    const det = u.cross(v);
    const t1 = -d.cross(v) / det;
    const t2 = -u.cross(d) / det;
    if (t1 < 0) return { master: anchors[1].add(d.scale(r.leg)), anchors, shares: [0, 1] };
    if (t2 < 0) return { master: anchors[0].add(d.scale(r.leg)), anchors, shares: [1, 0] };
    return { master: m, anchors, shares: [t1, t2] };
}

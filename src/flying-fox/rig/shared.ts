import { C, PULLEY_COLORS } from "@/flying-fox/colors";
import { groundY, hawserY, onGround, RIG } from "@/flying-fox/site";
import { bisect } from "@/lib/numeric/roots";
import { vec3, type Vector3 } from "@/lib/vector3";
import * as gear from "@/rigging/guys";
import { type Prism } from "@/rigging/knots";
import { squareLashing as lashing } from "@/rigging/lashings";
import { rigPulley as rigged } from "@/rigging/pulley-rig";
import { hanging, towards } from "@/rigging/rope";
import { type Piece } from "@/scene/pieces";

/**
 * What several parts of the flying fox's rig share: its directions, how its lines sag, what the overhead view leaves
 * out, and the rigging gear's builders (`src/rigging/`) in the flying fox's colours and on its ground.
 */

export const UP = vec3(0, 1, 0);

export const ACROSS = vec3(0, 0, 1);

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
    return bisect(clears, 0, want, 30)[0];
}

/** Pieces left out of the overhead view. */
export const NOT_OVERHEAD = new WeakSet<Piece>();

/** Whether `piece` (one of `foxPieces`) is drawn in the overhead view. */
export const drawnOverhead = (piece: Piece) => !NOT_OVERHEAD.has(piece);

/** A star picket driven at `at` (its height is above the ground there), leaning back from `away` (see `rigging/guys`). */
export function picket(at: Vector3, away: Vector3) {
    return gear.picket(onGround(at.x, at.y, at.z), away, C);
}

/** A guy from `from` to a picket at `at`, leaning away from it (see `rigging/guys`). */
export function guy(
    from: Vector3,
    at: Vector3,
    r: number,
    color: string,
    around: Prism[],
    options?: Parameters<typeof gear.guy>[5],
) {
    return gear.guy(from, picket(at, towards(from, at)), r, color, around, options);
}

/** A rescue pulley rigged on the flying fox, in its colours (see `rigging/pulley-rig`). */
export function rigPulley(
    near: Vector3,
    a: Vector3,
    b: Vector3,
    ropeR: number,
    hung: Parameters<typeof rigged>[4],
) {
    return rigged(near, a, b, ropeR, hung, { pulley: PULLEY_COLORS, steel: C.steel });
}

/** A square lashing in the flying fox's natural fibre (see `rigging/lashings`). */
export function squareLashing(
    pole: Vector3,
    poleR: number,
    spar: Vector3,
    sparR: number,
    up: Vector3,
    along: Vector3,
    turns?: number,
) {
    return lashing(pole, poleR, spar, sparR, up, along, C.fibre, turns);
}

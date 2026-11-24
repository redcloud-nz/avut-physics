import type { Vector3 } from "@/lib/vector3";

import { arcLengths, pointAt } from "./rope";

/** A cubic Hermite piece: from `p0` leaving along `m0` to `p1` arriving along `m1` (the derivatives at its ends). */
function hermite(p0: Vector3, m0: Vector3, p1: Vector3, m1: Vector3) {
    return (t: number) => {
        const [t2, t3] = [t * t, t * t * t];
        return p0
            .scale(2 * t3 - 3 * t2 + 1)
            .add(m0.scale(t3 - 2 * t2 + t))
            .add(p1.scale(-2 * t3 + 3 * t2))
            .add(m1.scale(t3 - t2));
    };
}

/** A curve sampled finely, for finding the point a given fraction of the way along it. */
export type Sampled = { points: Vector3[]; arc: number[]; length: number };

function sampled(at: (t: number) => Vector3, samples = 48): Sampled {
    const points = Array.from({ length: samples + 1 }, (_, k) => at(k / samples));
    const arc = arcLengths(points);
    return { points, arc, length: arc.at(-1)! };
}

/** The point `u` (0 to 1) of the way along a sampled curve. */
export const along = (curve: Sampled, u: number) =>
    pointAt(curve.points, curve.arc, u * curve.length);

/** One end of a stretch of rope that's locked: where it is, and the way the rope runs there (a unit vector). */
export type LockedEnd = { at: Vector3; dir: Vector3 };

/**
 * One smooth curve from the locked end `start`, through `handle`, to the locked end `end`: two cubic Hermite pieces,
 * each leaving and arriving along the rope's direction at the locked ends, and passing through the handle heading from
 * the start towards the end. Each end's derivative is as long as its piece's chord, which keeps the pieces from
 * looping or flattening.
 */
export function curveThrough(
    start: LockedEnd,
    handle: Vector3,
    end: LockedEnd,
): { before: Sampled; after: Sampled } {
    const [a, b] = [handle.sub(start.at), end.at.sub(handle)];
    const [la, lb] = [a.len(), b.len()];
    // The way through the handle: halfway between the ways in and out of it.
    let through = (la > 0 ? a.scale(1 / la) : a).add(lb > 0 ? b.scale(1 / lb) : b);
    if (through.len() < 1e-9) through = end.at.sub(start.at);
    if (through.len() < 1e-9) through = start.dir;
    through = through.unit();
    return {
        before: sampled(hermite(start.at, start.dir.scale(la), handle, through.scale(la))),
        after: sampled(hermite(handle, through.scale(lb), end.at, end.dir.scale(lb))),
    };
}

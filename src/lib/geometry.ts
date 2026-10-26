import { clamp } from "./math";
import type { Vector2 } from "./vector2";

/** The point of segment ab nearest p, and how far along it is (0 to 1). */
export function nearestOnSegment(
    p: Vector2,
    a: Vector2,
    b: Vector2,
): { point: Vector2; t: number } {
    const ab = b.sub(a);
    const t = clamp(p.sub(a).dot(ab) / ab.dot(ab), 0, 1);
    return { point: a.add(ab.scale(t)), t };
}

/** The distance from p to segment ab. */
export const segmentDistance = (p: Vector2, a: Vector2, b: Vector2) =>
    p.distanceTo(nearestOnSegment(p, a, b).point);

/** Whether segments ab and cd cross (touching doesn't count). */
export function segmentsCross(a: Vector2, b: Vector2, c: Vector2, d: Vector2): boolean {
    const side = (p: Vector2, q: Vector2, r: Vector2) => q.sub(p).cross(r.sub(p));
    return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/** The distance between segments ab and cd, or 0 if they cross. */
export function segmentGap(a: Vector2, b: Vector2, c: Vector2, d: Vector2): number {
    if (segmentsCross(a, b, c, d)) return 0;
    return Math.min(
        segmentDistance(a, c, d),
        segmentDistance(b, c, d),
        segmentDistance(c, a, b),
        segmentDistance(d, a, b),
    );
}

/**
 * Where segments ab and cd cross, as how far along each (t on ab, u on cd, both 0 to 1), or null if they
 * don't (parallel segments never cross). A crossing at a segment's start counts and one at its end doesn't, so where
 * a polyline crosses another at one of its points, it's found once, on the segment starting there.
 *
 * Rounding can leave a crossing at a polyline's point just past the end of one segment and just before the start of
 * the next, so neither finds it. A `tolerance` (along each, 0 to 1) widens both ends to catch it, at the cost of
 * sometimes finding it on both; t and u can then be a little outside 0 to 1.
 */
export function segmentIntersection(
    a: Vector2,
    b: Vector2,
    c: Vector2,
    d: Vector2,
    tolerance = 0,
): { t: number; u: number } | null {
    const r = b.sub(a);
    const s = d.sub(c);
    const denom = r.cross(s);
    if (Math.abs(denom) < 1e-15) return null;
    const ac = c.sub(a);
    const t = ac.cross(s) / denom;
    const u = ac.cross(r) / denom;
    const [from, to] = [-tolerance, 1 + tolerance];
    return t >= from && t < to && u >= from && u < to ? { t, u } : null;
}

/**
 * A straight piece from point `a` to point `b`, such as a stretcher between its ends or a ladder from its hinge to its
 * tip. Like `Vector2`, it's immutable. (Polylines, worked through a pair of points at a time, use the functions above
 * directly instead.)
 */
export class Segment {
    constructor(
        readonly a: Vector2,
        readonly b: Vector2,
    ) {}

    /** From a to b. */
    vector(): Vector2 {
        return this.b.sub(this.a);
    }

    length(): number {
        return this.a.distanceTo(this.b);
    }

    /** The unit vector from a towards b. */
    direction(): Vector2 {
        return this.vector().unit();
    }

    mid(): Vector2 {
        return this.a.mid(this.b);
    }

    /** The point `t` of the way along (0 at a, 1 at b). */
    at(t: number): Vector2 {
        return this.a.lerp(this.b, t);
    }

    /** The point of the segment nearest p, and how far along it is (0 to 1). */
    nearest(p: Vector2): { point: Vector2; t: number } {
        return nearestOnSegment(p, this.a, this.b);
    }

    distanceTo(p: Vector2): number {
        return segmentDistance(p, this.a, this.b);
    }

    /** Whether this and `other` cross (touching doesn't count). */
    crosses(other: Segment): boolean {
        return segmentsCross(this.a, this.b, other.a, other.b);
    }

    /** The distance between this and `other`, or 0 if they cross. */
    gap(other: Segment): number {
        return segmentGap(this.a, this.b, other.a, other.b);
    }

    /** Where this and `other` cross, as how far along each: see `segmentIntersection`. */
    intersection(other: Segment, tolerance = 0): { t: number; u: number } | null {
        return segmentIntersection(this.a, this.b, other.a, other.b, tolerance);
    }
}

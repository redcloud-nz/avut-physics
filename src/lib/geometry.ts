import { clamp } from "./math";
import type { Vector2 } from "./vector2";

/** The point of segment ab nearest p, and how far along it is (0 to 1). */
export function nearestOnSegment(p: Vector2, a: Vector2, b: Vector2): { point: Vector2; t: number } {
  const ab = b.sub(a);
  const t = clamp(p.sub(a).dot(ab) / ab.dot(ab), 0, 1);
  return { point: a.add(ab.scale(t)), t };
}

/** The distance from p to segment ab. */
export const segmentDistance = (p: Vector2, a: Vector2, b: Vector2) => p.distanceTo(nearestOnSegment(p, a, b).point);

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

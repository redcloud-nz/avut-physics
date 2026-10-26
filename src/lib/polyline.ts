import type { Vector2 } from "./vector2";

/** A polyline: the points it runs through, in order. Its pieces are `Segment.along(line)`. */
export type Polyline = readonly Vector2[];

/** The distance along the polyline to each of its points, starting at 0. */
export function arcLengths(line: Polyline): number[] {
    const s = [0];
    for (let i = 1; i < line.length; i++) s.push(s[i - 1] + line[i].distanceTo(line[i - 1]));
    return s;
}

/** The polyline's length: the distance along it from its first point to its last. */
export function lengthOf(line: Polyline): number {
    let s = 0;
    for (let i = 1; i < line.length; i++) s = s + line[i].distanceTo(line[i - 1]);
    return s;
}

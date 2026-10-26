/** Polylines: measuring along them. */

/** The distance along the polyline to each of its points, starting at 0. */
export function arcLengths<P extends { distanceTo(b: P): number }>(points: P[]): number[] {
    const s = [0];
    for (let i = 1; i < points.length; i++) s.push(s[i - 1] + points[i].distanceTo(points[i - 1]));
    return s;
}

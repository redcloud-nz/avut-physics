/** Polylines: measuring and evenly resampling along them. */

import { Vector2 } from "./vector2";

/** The distance along the polyline to each of its points, starting at 0. */
export function arcLengths<P extends { distanceTo(b: P): number }>(points: P[]): number[] {
    const s = [0];
    for (let i = 1; i < points.length; i++) s.push(s[i - 1] + points[i].distanceTo(points[i - 1]));
    return s;
}

/** The polyline again with its points evenly spaced along it, as close to `spacing` apart as divides it evenly. */
export function resample(points: Vector2[], spacing: number): Vector2[] {
    const s = arcLengths(points);
    const total = s[s.length - 1];
    const count = Math.max(1, Math.round(total / spacing));
    const out: Vector2[] = [];
    let j = 0;
    for (let k = 0; k <= count; k++) {
        const target = (total * k) / count;
        while (j < points.length - 2 && s[j + 1] < target) j++;
        const f = (target - s[j]) / (s[j + 1] - s[j] || 1);
        out.push(points[j].add(points[j + 1].sub(points[j]).scale(f)));
    }
    return out;
}

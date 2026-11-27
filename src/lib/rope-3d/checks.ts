import { nearestOnRun } from "@/lib/polyline3";
import type { Vector3 } from "@/lib/vector3";

import { arcLengths, type Bar, type Loop } from "./rope";

/**
 * What's wrong with a rope as it lies, for an editor to warn of rather than fix: rope pressed into rope or into a bar,
 * and bends tighter than the rope's least bend. Each is a place to mark, with how bad it is.
 */

export type Problem = {
    kind: "into rope" | "into a bar" | "too tight";
    at: Vector3;
    /** How far into the rope or bar (metres), or the bend's radius. */
    by: number;
};

/** Marks no nearer each other than this many diameters, so one overlap isn't marked many times. */
const MARKS_APART = 2;

function addMark(marks: Problem[], p: Problem, d: number) {
    const near = marks.find((m) => m.kind === p.kind && m.at.distanceTo(p.at) < MARKS_APART * d);
    if (!near) marks.push(p);
    else if (p.kind === "too tight" ? p.by < near.by : p.by > near.by) Object.assign(near, p);
}

/**
 * Where a rope (its points, `d` thick) is pressed into itself or a bar more than `tolerance`, or bends tighter than
 * `minBend` by more than a tenth. Points nearer along the rope than a tight bend brings rope are never into each other.
 */
export function ropeProblems(
    points: readonly Vector3[],
    {
        diameter: d,
        minBend,
        bars = [],
        loops = [],
        tolerance = 0.0005,
    }: { diameter: number; minBend: number; bars?: Bar[]; loops?: Loop[]; tolerance?: number },
): Problem[] {
    const marks: Problem[] = [];
    const n = points.length;
    const along = arcLengths(points);
    const reach = Math.PI * Math.max(minBend, d / 2);
    // Rope into rope, by a grid of cells a diameter across.
    const cell = d;
    const key = (p: Vector3) =>
        `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)},${Math.floor(p.z / cell)}`;
    const grid = new Map<string, number[]>();
    points.forEach((p, i) => {
        const k = key(p);
        const list = grid.get(k);
        if (list) list.push(i);
        else grid.set(k, [i]);
    });
    for (let i = 0; i < n; i++) {
        const p = points[i];
        const [cx, cy, cz] = [p.x, p.y, p.z].map((v) => Math.floor(v / cell));
        for (let a = -1; a <= 1; a++)
            for (let b = -1; b <= 1; b++)
                for (let c = -1; c <= 1; c++)
                    for (const j of grid.get(`${cx + a},${cy + b},${cz + c}`) ?? []) {
                        if (j <= i || along[j] - along[i] <= reach) continue;
                        const gap = p.distanceTo(points[j]);
                        if (gap < d - tolerance)
                            addMark(
                                marks,
                                { kind: "into rope", at: p.lerp(points[j], 0.5), by: d - gap },
                                d,
                            );
                    }
    }
    // Rope into a bar.
    for (const p of points) {
        for (const bar of bars) {
            const v = p.sub(bar.at);
            const off = v.sub(bar.along.scale(v.dot(bar.along))).len();
            const into = bar.r + d / 2 - off;
            if (into > tolerance) addMark(marks, { kind: "into a bar", at: p, by: into }, d);
        }
        for (const loop of loops) {
            const { distance } = nearestOnRun(p, loop.points);
            const into = loop.r + d / 2 - distance;
            if (into > tolerance) addMark(marks, { kind: "into a bar", at: p, by: into }, d);
        }
    }
    // Bends: the circle through each point and those about a diameter either side.
    const span = Math.max(1, Math.round(d / Math.max(1e-9, along[n - 1] / (n - 1))));
    for (let i = span; i < n - span; i++) {
        const [a, b, c] = [points[i - span], points[i], points[i + span]];
        const [ab, bc, ca] = [a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)];
        const twiceArea = b.sub(a).cross(c.sub(a)).len();
        if (twiceArea < 1e-15) continue;
        const radius = (ab * bc * ca) / (2 * twiceArea);
        if (radius < minBend * 0.9) addMark(marks, { kind: "too tight", at: b, by: radius }, d);
    }
    return marks;
}

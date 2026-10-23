/**
 * A rope as its centreline: points along its middle, evenly spaced, in metres. x and y are in the drawing's
 * plane (y up) and z comes out of it towards the viewer, so where the rope crosses itself the strand with the
 * greater z is on top.
 */

import { arcLengths, cubicSpline, resample } from "@/lib/curve";
import { segmentIntersection } from "@/lib/geometry";
import { Vector2 } from "@/lib/vector2";
import { Vector3 } from "@/lib/vector3";

export type Rope = {
    /** Points along the centreline, evenly spaced from one end to the other. */
    points: Vector3[];
    /** The rope's thickness (m). */
    diameter: number;
};

/** Which strand goes on top where the rope crosses itself. */
export type Layer = "over" | "under";

/** A point a laid rope passes through: a plain point, or a named crossing it goes over or under. */
export type Waypoint = Vector2 | { crossing: string; layer: Layer };

export const over = (crossing: string): Waypoint => ({ crossing, layer: "over" });
export const under = (crossing: string): Waypoint => ({ crossing, layer: "under" });

/** A named crossing of a laid rope: where it is, and how far along the rope each strand passes it. */
export type LaidCrossing = { name: string; at: Vector2; over: number; under: number };

/** A place where a flat path crosses itself. */
export type Crossing = {
    at: Vector2;
    /** How far along the path it passes this point, the first time and the second. */
    s: [number, number];
};

/** Every place where `path` crosses itself, in the order the path first reaches them. */
export function findCrossings(path: Vector2[]): Crossing[] {
    const s = arcLengths(path);
    const crossings: Crossing[] = [];
    for (let i = 0; i < path.length - 1; i++) {
        for (let j = i + 2; j < path.length - 1; j++) {
            const hit = segmentIntersection(path[i], path[i + 1], path[j], path[j + 1]);
            if (!hit) continue;
            crossings.push({
                at: path[i].add(path[i + 1].sub(path[i]).scale(hit.t)),
                s: [s[i] + (s[i + 1] - s[i]) * hit.t, s[j] + (s[j + 1] - s[j]) * hit.t],
            });
        }
    }
    return crossings;
}

/** Segments of the smooth curve between each pair of waypoints. */
const PER_SPAN = 16;

/**
 * Lays a rope through `path`: a smooth curve through its points, evenly respaced. Where the path names a
 * crossing (`over("waist")`), the rope passes through that crossing's point in `crossings` and rises over or
 * dips under there: by half a diameter, easing back to the plane over three diameters either side, so the two
 * strands clear each other by a diameter.
 *
 * Every crossing must be passed twice, once over and once under, and the rope must cross itself at the named
 * crossings and nowhere else. It throws if not.
 */
export function layRope(spec: {
    diameter: number;
    crossings: Record<string, Vector2>;
    path: Waypoint[];
}): { rope: Rope; crossings: LaidCrossing[] } {
    const { diameter: d, path } = spec;
    const point = (w: Waypoint) => {
        if (w instanceof Vector2) return w;
        const at = spec.crossings[w.crossing];
        if (!at)
            throw new Error(
                `The path goes ${w.layer} "${w.crossing}", which isn't a named crossing.`,
            );
        return at;
    };
    const curve = cubicSpline(path.map(point), PER_SPAN);
    const flat = resample(curve, d / 4);
    // How far along the respaced rope each waypoint is: the curve's distances, shrunk by the little that
    // respacing cuts off its bends.
    const sCurve = arcLengths(curve);
    const shrink = arcLengths(flat)[flat.length - 1] / sCurve[sCurve.length - 1];
    const sAt = (i: number) => sCurve[i * PER_SPAN] * shrink;

    const laid: LaidCrossing[] = Object.entries(spec.crossings).map(([name, at]) => {
        const passes = path.flatMap((w, i) =>
            w instanceof Vector2 || w.crossing !== name ? [] : [{ layer: w.layer, s: sAt(i) }],
        );
        const o = passes.filter((p) => p.layer === "over");
        const u = passes.filter((p) => p.layer === "under");
        if (o.length !== 1 || u.length !== 1)
            throw new Error(
                `The rope must pass "${name}" once over and once under, but goes over ${o.length} and under ${u.length} times.`,
            );
        return { name, at, over: o[0].s, under: u[0].s };
    });

    // The named crossings must be the only ones, or the drawing would show a crossing nobody said the layers of.
    const found = findCrossings(flat);
    const near = (a: number, b: number) => Math.abs(a - b) < d;
    for (const f of found) {
        const match = laid.find(
            (c) =>
                (near(f.s[0], c.over) && near(f.s[1], c.under)) ||
                (near(f.s[0], c.under) && near(f.s[1], c.over)),
        );
        if (!match)
            throw new Error(
                `The rope crosses itself at (${(f.at.x / d).toFixed(1)}, ${(f.at.y / d).toFixed(1)}) diameters, which isn't a named crossing.`,
            );
    }
    if (found.length !== laid.length)
        throw new Error(
            `${laid.length} crossings are named but the rope crosses itself ${found.length} times: a named crossing is touched, not crossed.`,
        );

    const reach = 3 * d;
    const lift = d / 2;
    const bump = (s: number, at: number) => {
        const x = (s - at) / reach;
        return Math.abs(x) < 1 ? (lift * (1 + Math.cos(Math.PI * x))) / 2 : 0;
    };
    const s = arcLengths(flat);
    const points = flat.map((p, i) => {
        const z = laid.reduce((z, c) => z + bump(s[i], c.over) - bump(s[i], c.under), 0);
        return new Vector3(p.x, p.y, z);
    });
    return { rope: { points, diameter: d }, crossings: laid };
}

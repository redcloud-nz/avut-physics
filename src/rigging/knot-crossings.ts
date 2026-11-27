import { pictureCrossings } from "@/knot-editor/crossing-geometry";
import { pictureGeometry, strandPosition } from "@/knot-editor/geometry";
import type { Picture } from "@/knot-editor/knot-file";
import { arcLengths } from "@/lib/rope-3d/rope";
import type { Vector3 } from "@/lib/vector3";

/**
 * A knot's crossings, to check a rope in 3D still has the crossings its drawing says: where it crosses itself as seen
 * from the drawing's side (looking down z, x across and y up, as `liftKnot` lays a drawing out), and which part's on
 * top. Read in order along the rope, they make the knot's crossing sequence (its Gauss code): each crossing met twice,
 * once over and once under. Two ropes with the same sequence cross the same way in the same order, whatever their
 * shape.
 */

/** A crossing met along the rope: which crossing it is (numbered as first met), and whether this pass is on top. */
export type CrossingPass = { crossing: number; over: boolean };

/** How far past a piece's ends (as a fraction of it) a crossing is still on it. */
const EPS = 1e-9;

/** Where the rope `points` crosses itself seen down z, read along it. */
export function ropeCrossings(points: readonly Vector3[]): CrossingPass[] {
    const along = arcLengths(points);
    const met: { s: number; key: number; over: boolean }[] = [];
    let key = 0;
    for (let i = 0; i < points.length - 1; i++)
        for (let j = i + 2; j < points.length - 1; j++) {
            const [a, b, c, d] = [points[i], points[i + 1], points[j], points[j + 1]];
            const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
            if (den === 0) continue;
            const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
            const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
            // Each piece takes a crossing at its start but not its end, a little either way so one exactly at a point
            // where pieces meet is counted once.
            if (t < -EPS || t >= 1 - EPS || u < -EPS || u >= 1 - EPS) continue;
            const za = a.z + (b.z - a.z) * t;
            const zc = c.z + (d.z - c.z) * u;
            met.push({ s: along[i] + (along[i + 1] - along[i]) * t, key, over: za > zc });
            met.push({ s: along[j] + (along[j + 1] - along[j]) * u, key, over: zc > za });
            key++;
        }
    return numbered(met);
}

/**
 * The crossings of a drawing's first rope, read along it, with the drawing's segment each pass is on. Crossings not
 * yet set (over and under not chosen) are left out.
 */
export function drawingCrossings(picture: Picture): (CrossingPass & { segment: number })[] {
    const geometry = pictureGeometry(picture);
    const { crossings } = pictureCrossings(picture, geometry);
    const strand = picture.strands[0];
    const met: { s: number; key: number; over: boolean }[] = [];
    crossings.forEach((c, key) => {
        if (c.over === undefined || c.pair[0][0] !== 0 || c.pair[1][0] !== 0) return;
        met.push({ s: c.s[0], key, over: c.over === 0 });
        met.push({ s: c.s[1], key, over: c.over === 1 });
    });
    const segmentAt = (s: number) =>
        strand.segments[strandPosition(geometry.strands[0], s).segment].id;
    const sorted = [...met].sort((p, q) => p.s - q.s);
    return numbered(met).map((pass, i) => ({ ...pass, segment: segmentAt(sorted[i].s) }));
}

/** Passes in order along the rope, each crossing numbered by when it's first met. */
function numbered(met: { s: number; key: number; over: boolean }[]): CrossingPass[] {
    const order = new Map<number, number>();
    return [...met]
        .sort((p, q) => p.s - q.s)
        .map(({ key, over }) => {
            if (!order.has(key)) order.set(key, order.size);
            return { crossing: order.get(key)!, over };
        });
}

/**
 * Where a rope's crossings differ from what they should be, read along it (null when they match): the first pass that
 * differs, and how.
 */
export function crossingsDiffer(
    rope: readonly CrossingPass[],
    wanted: readonly (CrossingPass & { segment?: number })[],
): string | null {
    const n = Math.min(rope.length, wanted.length);
    for (let i = 0; i < n; i++) {
        const [got, want] = [rope[i], wanted[i]];
        const where = want.segment !== undefined ? ` (on segment ${want.segment})` : "";
        if (got.crossing !== want.crossing)
            return `pass ${i + 1}${where} meets crossing ${got.crossing + 1}, not ${want.crossing + 1}`;
        if (got.over !== want.over)
            return `pass ${i + 1}${where} is ${got.over ? "over" : "under"}, not ${want.over ? "over" : "under"}`;
    }
    if (rope.length !== wanted.length)
        return `it has ${rope.length / 2} crossings, not ${wanted.length / 2}`;
    return null;
}

import { piercings, segmentsNearest } from "@/lib/polyline3";
import type { Vector3 } from "@/lib/vector3";

/**
 * Watching a rope as it moves for what can't happen to real rope: passing through itself, or through a closed bar.
 *
 * Seen from one side, a knot's crossings change as it tightens even when nothing passes through anything (strands in
 * front of a bar and behind it come to lie over each other), so these watch what can't change otherwise. Rope through
 * rope: for each pair of nearby pieces of rope, which side of the other each passes; if that flips while they're
 * touching, one has gone through the other. Rope through a closed bar: with the rope's ends held, the times it goes
 * through, counted each way, can only change by going through the bar.
 */

/**
 * Watches a rope for passing through itself: for each pair of its pieces near each other (and far enough apart along
 * it not to be one bend), the side of the other each passes, as the sign of their directions crossed onto the line
 * between their nearest points. A sign that flips while they're within half a diameter means one went through. The
 * rope's points must keep their order and count from one look to the next.
 */
export class PassWatch {
    private readonly sides = new Map<number, number>();

    /** `along` is how far along the rope each point is (as it started), for telling where. */
    constructor(
        private readonly d: number,
        private readonly along: readonly number[],
    ) {}

    /** Looks at the rope as it is now: what passed through what since last time, if anything. */
    look(p: readonly Vector3[]): string | null {
        const { d, along } = this;
        const n = p.length;
        const near = 2 * d;
        const seen = new Set<number>();
        // Pieces filed by the grid cell their start is in, cells as wide as a piece and the reach together, so a
        // piece's neighbours are in its own cell and those next to it.
        let longest = 0;
        for (let i = 0; i < n - 1; i++) longest = Math.max(longest, p[i].distanceTo(p[i + 1]));
        const cell = near + 2 * longest;
        const at = (q: Vector3) => [q.x, q.y, q.z].map((v) => Math.floor(v / cell));
        const grid = new Map<string, number[]>();
        for (let i = 0; i < n - 1; i++) {
            const k = at(p[i]).join(",");
            const list = grid.get(k);
            if (list) list.push(i);
            else grid.set(k, [i]);
        }
        for (let i = 0; i < n - 1; i++) {
            const [cx, cy, cz] = at(p[i]);
            for (let a = -1; a <= 1; a++)
                for (let b = -1; b <= 1; b++)
                    for (let c = -1; c <= 1; c++)
                        for (const j of grid.get(`${cx + a},${cy + b},${cz + c}`) ?? []) {
                            if (j < i + 2 || along[j] - along[i] < Math.PI * d) continue;
                            if (p[i].distanceTo(p[j]) > near + 2 * p[i].distanceTo(p[i + 1]))
                                continue;
                            const { s, t } = segmentsNearest(p[i], p[i + 1], p[j], p[j + 1]);
                            if (s <= 0 || s >= 1 || t <= 0 || t >= 1) continue;
                            const w = p[j].lerp(p[j + 1], t).sub(p[i].lerp(p[i + 1], s));
                            const gap = w.len();
                            const side = Math.sign(
                                p[i + 1]
                                    .sub(p[i])
                                    .cross(p[j + 1].sub(p[j]))
                                    .dot(w),
                            );
                            const key = i * n + j;
                            seen.add(key);
                            const was = this.sides.get(key);
                            this.sides.set(key, side);
                            if (was !== undefined && side !== 0 && was !== side && gap < d / 2)
                                return `the rope went through itself, ${(along[i] * 1000).toFixed(0)} mm and ${(along[j] * 1000).toFixed(0)} mm along it`;
                        }
        }
        for (const key of this.sides.keys()) if (!seen.has(key)) this.sides.delete(key);
        return null;
    }
}

/** How many times a rope goes through a flat closed loop, one way counted +1 and the other −1. */
export const timesThrough = (loop: readonly Vector3[], rope: readonly Vector3[]) =>
    piercings(loop, rope).reduce((sum, q) => sum + q.way, 0);

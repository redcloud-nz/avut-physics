import { bisect } from "@/lib/numeric/roots";
import { lengthOf } from "@/lib/polyline";
import { vec2, type Vector2 } from "@/lib/vector2";

/**
 * Where a basket sling sits when it's pulled: round the back of what it wraps and out along the pull, its two legs
 * meeting where it's clipped. Worked in the cross-section of what's wrapped.
 *
 * `outline` is what's wrapped, as a convex polygon anticlockwise (already grown by the tape's half thickness), `centre`
 * a point inside it the pull acts through, `pull` the unit direction it's pulled in, and `loop` the length of tape
 * from the clip round and back (for a tied sling going round doubled, its laid-flat length). The clip sits on the line from `centre` along `pull`, as far out as the
 * tape allows. Gives the clip and the tape's path from it, round the back and back to it.
 */
export function basket(
    outline: Vector2[],
    centre: Vector2,
    pull: Vector2,
    loop: number,
): { clip: Vector2; path: Vector2[] } {
    const n = outline.length;
    // The point furthest round the back, which the tape always passes over.
    const back = outline.reduce(
        (b, p, i) => (p.sub(centre).dot(pull) < outline[b].sub(centre).dot(pull) ? i : b),
        0,
    );
    const reach = Math.max(...outline.map((p) => p.sub(centre).dot(pull)));

    const pathFrom = (clip: Vector2): Vector2[] => {
        // The legs touch the outline at the points seen furthest either side of the line back to the centre.
        const toCentre = centre.sub(clip);
        const side = (p: Vector2) =>
            Math.atan2(toCentre.cross(p.sub(clip)), toCentre.dot(p.sub(clip)));
        let lo = 0;
        let hi = 0;
        outline.forEach((p, i) => {
            if (side(p) < side(outline[lo])) lo = i;
            if (side(p) > side(outline[hi])) hi = i;
        });
        // Round from one to the other the way that passes the back.
        const walk = (step: number) => {
            const ids = [lo];
            for (let i = lo; i !== hi; ) ids.push((i = (i + step + n) % n));
            return ids;
        };
        const forward = walk(1);
        const ids = forward.includes(back) ? forward : walk(-1);
        return [clip, ...ids.map((i) => outline[i]), clip];
    };
    // The further out the clip, the more tape the legs take: find where it's all used.
    const fits = (d: number) => lengthOf(pathFrom(centre.add(pull.scale(d)))) < loop;
    const near = reach + 1e-3;
    const [, far] = fits(near) ? bisect(fits, near, reach + loop, 50) : [near, near];
    const clip = centre.add(pull.scale(far));
    return { clip, path: pathFrom(clip) };
}

/** Two equal logs stacked one on the other (centres `lower` and `upper`, radius `r`), as a convex outline. */
export function stackedLogs(lower: Vector2, upper: Vector2, r: number, steps = 12): Vector2[] {
    const round = (c: Vector2, a0: number) =>
        Array.from({ length: steps + 1 }, (_, i) => {
            const a = a0 + (Math.PI * i) / steps;
            return vec2(c.x + r * Math.cos(a), c.y + r * Math.sin(a));
        });
    return [...round(upper, 0), ...round(lower, Math.PI)];
}

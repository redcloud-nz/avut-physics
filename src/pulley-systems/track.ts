import type { RopeStop } from "@/articles/pulley-blocks";
import { vec2, type Vector2 } from "@/lib/vector2";

/** The radius of the track's corners, and the radius of the pin's turn. */
const BEND = 12;
export const PIN = 8;
/** How far apart the points along the track are, for finding where along it a point is nearest. */
const STEP = 0.5;

/** Which edge of the drawing a pin is on. */
export type PinEdge = "top" | "bottom";

/**
 * The team's rope's way on past a pin at `x` on the drawing's top or bottom `edge`: clockwise round the drawing (from
 * `left` to `right` across, and `top` to `bottom` down), `inset` in from its edge, from beside the pin all the way round. From one at
 * the foot it runs along the bottom, up the left side, along the top and down the right; from one at the top, along the
 * top first. It gives the pin, where a distance along the track is and which distance along it is nearest a point, and
 * the rope's stops from the pin to a distance along it: the pin, each corner the rope has gone round, and its end.
 */
export function trackOf(
    x: number,
    edge: PinEdge,
    left: number,
    top: number,
    right: number,
    bottom: number,
    inset: number,
) {
    const [l, t, r, b] = [left + inset, top + inset, right - inset, bottom - inset];
    // Each side in turn clockwise from the bottom: where it starts and ends, between the corners at either end of it,
    // and the corner after it, with the angle its quarter turn starts from (radians, y down).
    const sides = [
        {
            from: vec2(r - BEND, b),
            to: vec2(l + BEND, b),
            c: vec2(l + BEND, b - BEND),
            turn: Math.PI / 2,
        },
        {
            from: vec2(l, b - BEND),
            to: vec2(l, t + BEND),
            c: vec2(l + BEND, t + BEND),
            turn: Math.PI,
        },
        {
            from: vec2(l + BEND, t),
            to: vec2(r - BEND, t),
            c: vec2(r - BEND, t + BEND),
            turn: (3 * Math.PI) / 2,
        },
        { from: vec2(r, t + BEND), to: vec2(r, b - BEND), c: vec2(r - BEND, b - BEND), turn: 0 },
    ];
    // The pin, with the rope leaving it along its edge clockwise: leftwards under one at the foot, rightwards over one
    // at the top.
    const first = edge === "bottom" ? 0 : 2;
    const foot = vec2(x, edge === "bottom" ? b : t);
    const pin = foot.add(vec2(0, edge === "bottom" ? -PIN : PIN));
    const order = [0, 1, 2, 3].map((k) => sides[(first + k) % 4]);
    const corners = order.map((side) => side.c);
    const points: Vector2[] = [];
    // Where each corner's turn starts, as an index into the points.
    const turning: number[] = [];
    const line = (from: Vector2, to: Vector2) => {
        const n = Math.max(1, Math.ceil(from.distanceTo(to) / STEP));
        for (let k = 0; k < n; k++) points.push(from.lerp(to, k / n));
    };
    // A quarter turn clockwise round a corner, from `start` (radians, y down).
    const corner = (c: Vector2, start: number) => {
        const n = Math.ceil((BEND * Math.PI) / 2 / STEP);
        turning.push(points.length);
        for (let k = 0; k < n; k++) {
            const a = start + ((k / n) * Math.PI) / 2;
            points.push(c.add(vec2(Math.cos(a), Math.sin(a)).scale(BEND)));
        }
    };
    order.forEach((side, k) => {
        line(k === 0 ? foot : side.from, side.to);
        corner(side.c, side.turn);
    });
    // Back along the pin's edge, stopping short of it.
    const back = order[0].to.sub(order[0].from);
    line(order[0].from, foot.sub(back.scale((3 * BEND) / back.len())));
    // How far along the track each point is.
    const along = points.map(() => 0);
    for (let i = 1; i < points.length; i++)
        along[i] = along[i - 1] + points[i].distanceTo(points[i - 1]);
    const length = along[along.length - 1];

    /** Where the track is `s` along it. */
    const at = (s: number) => {
        const i = Math.min(
            Math.max(
                along.findIndex((a) => a > s),
                1,
            ),
            points.length - 1,
        );
        const f = (s - along[i - 1]) / (along[i] - along[i - 1]);
        return points[i - 1].lerp(points[i], Math.min(Math.max(f, 0), 1));
    };
    /** Which way the track runs `s` along it, a unit long. */
    const dir = (s: number) => {
        const [p, q] = [at(Math.max(s - STEP, 0)), at(Math.min(s + STEP, length))];
        return q.sub(p).scale(1 / q.distanceTo(p));
    };
    /** How far along the track, between `from` and `to`, is nearest `p`. */
    const nearest = (p: Vector2, from: number, to: number) => {
        let best = from;
        let gap = Infinity;
        points.forEach((q, i) => {
            if (along[i] < from || along[i] > to) return;
            const d = q.distanceTo(p);
            if (d < gap) [best, gap] = [along[i], d];
        });
        return best;
    };
    /** The points from `from` to `to` along it. */
    const between = (from: number, to: number) => [
        at(from),
        ...points.filter((_, i) => along[i] > from && along[i] < to),
        at(to),
    ];
    /**
     * The rope's stops from the pin to `s` along the track: round the pin and each corner it has reached, and its end.
     * The end is a touch further on along the track than `s`, so it's never on a corner's curve, where the rope would
     * have no straight part to leave it along.
     */
    const stops = (s: number): RopeStop[] => [
        { c: pin, r: PIN, turn: 1 },
        ...corners.flatMap((c, k) =>
            along[turning[k]] < s ? [{ c, r: BEND, turn: 1 as const }] : [],
        ),
        { c: at(s).add(dir(s).scale(STEP)), r: 0 },
    ];
    return { pin, length, at, dir, nearest, between, stops };
}

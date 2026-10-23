/**
 * A figure-8 knot, tied but not yet tightened, laid flat and upright as it's usually shown: both ends run up
 * the middle, the standing part from the bottom and the tail out of the top, with the two loops stacked between
 * them. The top of the upper loop and the bottom of the lower loop are half circles, and the strands between
 * them take the smoothest line from one half circle's end to the next. It looks the same turned upside down,
 * apart from which strand is on top at each crossing.
 */

import { arcLengths, hermite } from "@/lib/curve";
import { segmentIntersection } from "@/lib/geometry";
import { vec2, type Vector2 } from "@/lib/vector2";

import { layRope, over, under, type LaidCrossing, type Rope, type Waypoint } from "./rope";

/** 11 mm static rescue rope. */
export const ROPE_DIAMETER = 0.011;

// The shape is worked out in rope diameters and scaled to metres at the end.

/** The half circles' radius, and how far above and below the middle their centres are. */
const RADIUS = 3.5;
const CENTRE = 5;
/** How far the ends reach from the middle. */
const END = 12;

const UP = vec2(0, 1);
const DOWN = vec2(0, -1);

/** Points on the upper half circle, at these angles (degrees, anticlockwise from the right). */
const upper = (...degrees: number[]) =>
    degrees.map((a) =>
        vec2(Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180))
            .scale(RADIUS)
            .add(vec2(0, CENTRE)),
    );
/** The same on the lower half circle, which is the upper one turned upside down. */
const lower = (...degrees: number[]) => upper(...degrees).map((p) => p.scale(-1));

/** The standing part, from where it crosses the bottom of the lower loop up to the upper half circle's right end. */
const RISE = hermite(vec2(0, -CENTRE - RADIUS), UP, upper(0)[0], UP);
/** The tail, from the lower half circle's left end up to where it crosses the top: the rise turned upside down. */
const TAIL = RISE.map((p) => p.scale(-1)).reverse();
/** The long diagonal, from the upper half circle's left end down to the lower one's right end. */
const DIAGONAL = hermite(upper(180)[0], DOWN, lower(180)[0], DOWN);

/** Where two polylines cross. */
function meet(a: Vector2[], b: Vector2[]): Vector2 {
    for (let i = 0; i < a.length - 1; i++)
        for (let j = 0; j < b.length - 1; j++) {
            const hit = segmentIntersection(a[i], a[i + 1], b[j], b[j + 1]);
            if (hit) return a[i].add(a[i + 1].sub(a[i]).scale(hit.t));
        }
    throw new Error("The curves don't cross.");
}

/** Where the rope crosses itself, in rope diameters. */
const CROSSINGS = {
    /** The standing part crosses the bottom of the lower loop, */
    bottom: vec2(0, -CENTRE - RADIUS),
    /** and, going up, the long diagonal just below the middle. */
    waistLow: meet(RISE, DIAGONAL),
    /** The tail crosses the long diagonal just above the middle, */
    waistHigh: meet(TAIL, DIAGONAL),
    /** and the top of the upper loop. */
    top: vec2(0, CENTRE + RADIUS),
};

/**
 * Points along `curve` (not its ends) for the rope to pass through, about every `spacing` along it, with each
 * of `marks` (crossings on the curve) put in where the curve reaches it.
 */
function along(curve: Vector2[], ...marks: Waypoint[]): Waypoint[] {
    const spacing = 1.5;
    const s = arcLengths(curve);
    const total = s[s.length - 1];
    const placed = marks.map((mark) => {
        const at = CROSSINGS[(mark as { crossing: keyof typeof CROSSINGS }).crossing];
        const i = curve.reduce(
            (best, p, k) => (p.distanceTo(at) < curve[best].distanceTo(at) ? k : best),
            0,
        );
        return { s: s[i], w: mark };
    });
    const count = Math.round(total / spacing);
    const samples = Array.from({ length: count - 1 }, (_, k) => (total * (k + 1)) / count)
        .filter((at) => placed.every((m) => Math.abs(at - m.s) > spacing / 2))
        .map((at) => ({ s: at, w: curve[s.findIndex((x) => x >= at)] as Waypoint }));
    return [...samples, ...placed].sort((a, b) => a.s - b.s).map((m) => m.w);
}

/** The rope from the standing part's end to the tail's. Over and under alternate all the way. */
const PATH: Waypoint[] = [
    // The standing part, up the middle, through the lower loop and up to the upper loop's right side.
    vec2(0, -END),
    vec2(0, -END + 1.5),
    over("bottom"),
    ...along(RISE, under("waistLow")),
    // Over the top of the upper loop.
    ...upper(0, 45),
    over("top"),
    ...upper(135, 180),
    // The long diagonal down through the middle.
    ...along(DIAGONAL, under("waistHigh"), over("waistLow")),
    // Under the bottom of the lower loop.
    ...lower(180, 135),
    under("bottom"),
    ...lower(45, 0),
    // The tail, up through the middle and out of the top.
    ...along(TAIL, over("waistHigh")),
    under("top"),
    vec2(0, END - 1.5),
    vec2(0, END),
];

/** The rope laid along `PATH`, and its crossings. */
export function looseFigureEight(): { rope: Rope; crossings: LaidCrossing[] } {
    const d = ROPE_DIAMETER;
    const toMetres = (w: Waypoint) => ("crossing" in w ? w : w.scale(d));
    return layRope({
        diameter: d,
        crossings: Object.fromEntries(
            Object.entries(CROSSINGS).map(([name, p]) => [name, p.scale(d)]),
        ),
        path: PATH.map(toMetres),
    });
}

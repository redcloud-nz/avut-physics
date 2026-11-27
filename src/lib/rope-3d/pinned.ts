import { hobbyVelocity } from "@/lib/hobby";
import { nearestOnRun } from "@/lib/polyline3";
import { vec3, type Vector3 } from "@/lib/vector3";

import { arcLengths, pointAt } from "./rope";

/**
 * A rope in 3D as pins and segments, as the 2D knot editor draws one: a run of pins, and between each two a segment,
 * one cubic Bézier. A pin may hold the way the rope runs through it; where it doesn't, the way comes from its
 * neighbours, by Hobby's method (as the 2D editor's directions do) worked in 3D. A segment's tensions (one at each end,
 * 1 by default) set how far its control points reach. The rope is smooth by construction.
 *
 * Segments have ids, which stay with them through every edit, and names to show: a knot drawing's segment number, with
 * a letter where one's been split (19a, 19b).
 */

export type Pin3 = { id: number; at: Vector3; along?: Vector3 };
export type Segment3 = { id: number; name: string; tension: [number, number] };
/** `segments[k]` runs from `pins[k]` to `pins[k + 1]`. */
export type PinnedRope = { pins: Pin3[]; segments: Segment3[] };

/** The least and greatest tension kept: past these, a segment's control points sit on its ends or far off. */
const TENSIONS: [number, number] = [0.05, 50];

/** The signed angle turned from `a` to `b` about the unit `axis` (right-handed). */
const turnAbout = (a: Vector3, b: Vector3, axis: Vector3) =>
    Math.atan2(a.cross(b).dot(axis), a.dot(b));

/** Some unit vector square to `v`. */
function squareTo(v: Vector3): Vector3 {
    const other = Math.abs(v.x) < 0.9 ? vec3(1, 0, 0) : vec3(0, 1, 0);
    return v.cross(other).unit();
}

/**
 * The ways (unit vectors) through a run of points, by Hobby's method with every tension 1, worked in 3D: at each point
 * inside the run the chords either side turn in their own plane, and the angles each direction makes with its chord
 * are solved as Hobby's are, each turned in its point's plane. The planes' normals are kept facing the same way along
 * the run, so a run lying in one plane gives exactly the 2D method's directions. Ends hold a direction, or are free
 * (curl 1).
 */
export function hobbyDirections3(
    points: readonly Vector3[],
    start?: Vector3,
    end?: Vector3,
): Vector3[] {
    const n = points.length - 1;
    const chords = points.slice(1).map((p, k) => p.sub(points[k]));
    const units = chords.map((c) => (c.len() > 1e-12 ? c.unit() : vec3(1, 0, 0)));
    const lengths = chords.map((c) => Math.max(c.len(), 1e-9));
    if (n === 1 && !start && !end) return [units[0], units[0]];

    // Each point's plane: square to the chords either side, the same way round as the one before.
    const normals: (Vector3 | undefined)[] = points.map((_, k) => {
        if (k === 0 || k === n) return undefined;
        const m = units[k - 1].cross(units[k]);
        return m.len() > 1e-6 ? m.unit() : undefined;
    });
    const firstKnown = normals.find((m) => m !== undefined);
    const fallback =
        firstKnown ??
        (start && units[0].cross(start).len() > 1e-6
            ? units[0].cross(start).unit()
            : end && units[n - 1].cross(end).len() > 1e-6
              ? units[n - 1].cross(end).unit()
              : squareTo(units[0]));
    let last = fallback;
    const N = normals.map((m) => {
        const k = m ? (m.dot(last) < 0 ? m.scale(-1) : m) : last;
        last = k;
        return k;
    });
    // The ends take their neighbours' planes.
    N[0] = N[Math.min(1, n)];
    N[n] = N[Math.max(n - 1, 0)];

    // ψₖ: how far the chords turn at each point inside the run, in its plane.
    const psi = points.map((_, k) =>
        k === 0 || k === n ? 0 : turnAbout(units[k - 1], units[k], N[k]),
    );

    // Row k: a[k] θₖ₋₁ + b[k] θₖ + c[k] θₖ₊₁ = r[k], as `hobbyDirections` in 2D.
    const [a, b, c, r] = [0, 1, 2, 3].map(() => new Array<number>(n + 1).fill(0));
    if (start) {
        b[0] = 1;
        r[0] = turnAbout(units[0], start, N[0]);
    } else {
        b[0] = 3;
        c[0] = 3;
        r[0] = -3 * psi[1];
    }
    for (let k = 1; k < n; k++) {
        const [before, after] = [lengths[k - 1], lengths[k]];
        a[k] = 1 / before;
        b[k] = 2 / before + 2 / after;
        c[k] = 1 / after;
        r[k] = (-2 * psi[k]) / before - psi[k + 1] / after;
    }
    if (end) {
        b[n] = 1;
        r[n] = -turnAbout(end, units[n - 1], N[n]);
    } else {
        a[n] = 3;
        b[n] = 3;
    }
    for (let k = 1; k <= n; k++) {
        const m = a[k] / b[k - 1];
        b[k] -= m * c[k - 1];
        r[k] -= m * r[k - 1];
    }
    const theta = new Array<number>(n + 1);
    theta[n] = r[n] / b[n];
    for (let k = n - 1; k >= 0; k--) theta[k] = (r[k] - c[k] * theta[k + 1]) / b[k];

    return points.map((_, k) =>
        k < n ? units[k].turned(N[k], theta[k]) : units[n - 1].turned(N[n], theta[n]),
    );
}

/** Each pin's direction: held, or from Hobby's method over the run between the nearest pins holding one. */
export function pinDirections(pins: readonly Pin3[]): Vector3[] {
    const points = pins.map((p) => p.at);
    const out: Vector3[] = new Array(pins.length);
    let from = 0;
    for (let k = 1; k < pins.length; k++) {
        if (!pins[k].along && k < pins.length - 1) continue;
        const run = hobbyDirections3(points.slice(from, k + 1), pins[from].along, pins[k].along);
        for (let j = from; j <= k; j++) out[j] = pins[j].along ?? run[j - from];
        from = k;
    }
    if (pins.length === 1) out[0] = pins[0].along ?? vec3(1, 0, 0);
    return out;
}

/**
 * The signed angles a segment leaves its chord at and arrives at it, for Hobby's velocity: the sizes of the angles
 * between the chord and the directions, alike in sign where the curve bends one way (a C) and unlike where it turns
 * back (an S).
 */
function chordAngles(chord: Vector3, leaving: Vector3, arriving: Vector3): [number, number] {
    const u = chord.unit();
    const theta = Math.acos(Math.max(-1, Math.min(1, u.dot(leaving))));
    let phi = Math.acos(Math.max(-1, Math.min(1, arriving.dot(u))));
    if (u.cross(leaving).dot(u.cross(arriving)) > 0) phi = -phi;
    return [theta, phi];
}

/** How far a segment's control points reach along its end directions (metres), from its tensions. */
function reaches(
    from: Vector3,
    to: Vector3,
    leaving: Vector3,
    arriving: Vector3,
    tension: readonly [number, number],
): [number, number] {
    const chord = to.sub(from);
    const d = chord.len();
    if (d < 1e-12) return [0, 0];
    const [theta, phi] = chordAngles(chord, leaving, arriving);
    return [
        (d * hobbyVelocity(theta, phi)) / tension[0],
        (d * hobbyVelocity(phi, theta)) / tension[1],
    ];
}

/** The tensions that give a segment control points reaching `reach` along its end directions. */
function tensionsFor(
    from: Vector3,
    to: Vector3,
    leaving: Vector3,
    arriving: Vector3,
    reach: readonly [number, number],
): [number, number] {
    const chord = to.sub(from);
    const d = chord.len();
    if (d < 1e-12) return [1, 1];
    const [theta, phi] = chordAngles(chord, leaving, arriving);
    const clamp = (t: number) => Math.min(TENSIONS[1], Math.max(TENSIONS[0], t));
    return [
        clamp((d * hobbyVelocity(theta, phi)) / Math.max(reach[0], 1e-12)),
        clamp((d * hobbyVelocity(phi, theta)) / Math.max(reach[1], 1e-12)),
    ];
}

/** A cubic Bézier in 3D: its ends and control points. */
export type Cubic3 = [Vector3, Vector3, Vector3, Vector3];

export function cubicAt([a, c1, c2, b]: Cubic3, t: number): Vector3 {
    const s = 1 - t;
    return a
        .scale(s * s * s)
        .add(c1.scale(3 * s * s * t))
        .add(c2.scale(3 * s * t * t))
        .add(b.scale(t * t * t));
}

/** Each segment's cubic, from its pins, their directions and its tensions. */
export function segmentCubics(rope: PinnedRope): Cubic3[] {
    const dirs = pinDirections(rope.pins);
    return rope.segments.map((s, k) => {
        const [from, to] = [rope.pins[k].at, rope.pins[k + 1].at];
        const [l0, l1] = reaches(from, to, dirs[k], dirs[k + 1], s.tension);
        return [from, from.add(dirs[k].scale(l0)), to.sub(dirs[k + 1].scale(l1)), to];
    });
}

/** A cubic as a fine run of points, with their arc lengths. */
function fine(cubic: Cubic3, n = 32) {
    const points = Array.from({ length: n + 1 }, (_, i) => cubicAt(cubic, i / n));
    return { points, arc: arcLengths(points) };
}

/** A segment's length along the rope. */
export const cubicLength = (cubic: Cubic3) => fine(cubic).arc.at(-1)!;

/**
 * The rope as a run of points about `spacing` apart, evenly along each segment, for the simulation and for drawing:
 * each point's segment (its index), and where each pin is in the run. A pin's point counts as the segment after it
 * (the last pin, the last segment).
 */
export type SampledRope = { points: Vector3[]; seg: number[]; pinAt: number[] };

export function sampleRope(rope: PinnedRope, spacing: number, counts?: number[]): SampledRope {
    const cubics = segmentCubics(rope);
    const points: Vector3[] = [];
    const seg: number[] = [];
    const pinAt: number[] = [];
    cubics.forEach((cubic, k) => {
        const { points: run, arc } = fine(cubic, 64);
        const length = arc.at(-1)!;
        const n = counts?.[k] ?? Math.max(2, Math.ceil(length / spacing));
        pinAt.push(points.length);
        for (let i = 0; i < n; i++) {
            points.push(pointAt(run, arc, (length * i) / n));
            seg.push(k);
        }
    });
    pinAt.push(points.length);
    points.push(rope.pins.at(-1)!.at);
    seg.push(Math.max(0, rope.segments.length - 1));
    return { points, seg, pinAt };
}

/** How many points each segment's given in `sampleRope`, to sample it again with the same counts. */
export const sampleCounts = (s: SampledRope) => s.pinAt.slice(1).map((p, k) => p - s.pinAt[k]);

/** The way a run of points runs at point `i`: across its neighbours, or from the one next to it at an end. */
function tangentAt(points: readonly Vector3[], i: number): Vector3 {
    const n = points.length;
    if (n < 2) return vec3(1, 0, 0);
    const [before, after] = [
        i > 0 ? points[i].sub(points[i - 1]) : undefined,
        i < n - 1 ? points[i + 1].sub(points[i]) : undefined,
    ];
    // Inside the run, the two pieces' ways each weighed by the other's length (as a parabola through the three runs).
    const way =
        before && after
            ? before
                  .scale(after.len() / Math.max(before.len(), 1e-12))
                  .add(after.scale(before.len() / Math.max(after.len(), 1e-12)))
            : (before ?? after)!;
    return way.len() > 1e-12 ? way.unit() : vec3(1, 0, 0);
}

/**
 * The cubic from `points[0]` to their last, leaving and arriving along `u0` and `u1`, that comes nearest the points
 * between (least squares in how far its control points reach, with each point's place along it found again twice), and
 * how far the farthest point strays from it.
 */
function fitCubic(
    points: readonly Vector3[],
    u0: Vector3,
    u1: Vector3,
): { reach: [number, number]; cubic: Cubic3; error: number } {
    const [p0, p3] = [points[0], points.at(-1)!];
    const chord = p3.distanceTo(p0);
    const arc = arcLengths(points);
    const total = arc.at(-1)! || 1;
    let ts = arc.map((s) => s / total);
    let reach: [number, number] = [chord / 3, chord / 3];
    const cubicOf = ([a, b]: [number, number]): Cubic3 => [
        p0,
        p0.add(u0.scale(a)),
        p3.sub(u1.scale(b)),
        p3,
    ];
    for (let pass = 0; pass < 3; pass++) {
        // B(t) = base(t) + a·A(t) − b·B(t), each point's miss squared, summed and least.
        let [aa, ab, bb, ra, rb] = [0, 0, 0, 0, 0];
        for (let i = 1; i < points.length - 1; i++) {
            const t = ts[i];
            const s = 1 - t;
            const base = p0
                .scale(s * s * s + 3 * s * s * t)
                .add(p3.scale(3 * s * t * t + t * t * t));
            const A = u0.scale(3 * s * s * t);
            const B = u1.scale(-3 * s * t * t);
            const miss = points[i].sub(base);
            aa += A.dot(A);
            ab += A.dot(B);
            bb += B.dot(B);
            ra += A.dot(miss);
            rb += B.dot(miss);
        }
        const det = aa * bb - ab * ab;
        if (Math.abs(det) > 1e-30) {
            reach = [(ra * bb - rb * ab) / det, (aa * rb - ab * ra) / det];
        }
        const least = chord * 0.02;
        reach = [Math.max(least, reach[0]), Math.max(least, reach[1])];
        // Each point's place along the curve found again: the nearest of the curve's fine points.
        const { points: run, arc: runArc } = fine(cubicOf(reach), 48);
        const runTotal = runArc.at(-1)! || 1;
        ts = points.map((p, i) => {
            if (i === 0) return 0;
            if (i === points.length - 1) return 1;
            const { at, index } = nearestOnRun(p, run);
            return (runArc[index] + at.distanceTo(run[index])) / runTotal;
        });
    }
    const cubic = cubicOf(reach);
    const { points: run } = fine(cubic, 48);
    let error = 0;
    for (let i = 1; i < points.length - 1; i++)
        error = Math.max(error, nearestOnRun(points[i], run).distance);
    return { reach, cubic, error };
}

/** A name's segment number and its letters ("19b" is 19 and "b"). */
export function nameParts(name: string): { number: string; letters: string } {
    const m = /^(.*?)([a-z]*)$/.exec(name)!;
    return { number: m[1], letters: m[2] };
}

/** The letters for the `k`th piece (from 0): a to z, then aa, ab and on. */
function letters(k: number): string {
    return k < 26 ? String.fromCharCode(97 + k) : letters(Math.floor(k / 26) - 1) + letters(k % 26);
}

/**
 * Segments named again where pieces of one drawn segment lie side by side: each run of them its number with a, b, c in
 * order, and a lone one its number alone.
 */
export function lettered(segments: readonly Segment3[]): Segment3[] {
    const out = segments.map((s) => ({ ...s }));
    let i = 0;
    while (i < out.length) {
        const { number } = nameParts(out[i].name);
        let j = i + 1;
        while (j < out.length && nameParts(out[j].name).number === number) j++;
        for (let k = i; k < j; k++) out[k].name = j - i === 1 ? number : number + letters(k - i);
        i = j;
    }
    return out;
}

/**
 * A run of points fitted with pins and segments: a pin at each of `pinAt` (indices into the points), each holding the
 * way the points run there, and each segment the cubic nearest the points between (its tensions from how far its
 * control points reach). Where a segment strays more than `tolerance` from its points, a pin's added at the middle of
 * its points and each half is fitted again. A segment keeps `segments[k]`'s id and name, and pin k `pinIds[k]` (or a
 * new id); new pins and pieces take new ids from `nextId` on, and pieces letters. Ids are one series for pins and
 * segments.
 *
 * A pin with a direction in `directions` holds that one rather than the points' own there; a segment marked in `keep`
 * isn't fitted but kept as it is (its tensions), for a segment whose points haven't moved and whose pins hold the
 * directions it had, so it's exactly the curve it was.
 */
export function fitPinned(
    points: readonly Vector3[],
    pinAt: readonly number[],
    segments: readonly Segment3[],
    {
        tolerance,
        nextId,
        pinIds,
        directions,
        keep,
    }: {
        tolerance: number;
        nextId: number;
        pinIds?: readonly number[];
        directions?: readonly (Vector3 | undefined)[];
        keep?: readonly boolean[];
    },
): { rope: PinnedRope; nextId: number; error: number } {
    let id = nextId;
    const pins: Pin3[] = [];
    const out: Segment3[] = [];
    let worst = 0;
    // The way the rope runs at each pin's point: given, or the points' own.
    const given = new Map(pinAt.map((i, k) => [i, directions?.[k]] as const));
    const wayAt = (i: number) => given.get(i) ?? tangentAt(points, i);
    const pinFor = (i: number, known?: number): Pin3 => ({
        id: known ?? id++,
        at: points[i],
        along: wayAt(i),
    });
    for (let k = 0; k < segments.length; k++) {
        const [i0, i1] = [pinAt[k], pinAt[k + 1]];
        if (k === 0) pins.push(pinFor(i0, pinIds?.[0]));
        if (keep?.[k]) {
            out.push({ ...segments[k] });
            pins.push(pinFor(i1, pinIds?.[k + 1]));
            continue;
        }
        // The segment's points cut into pieces until each fits.
        const cuts = [i0, i1];
        const fits: { reach: [number, number]; error: number }[] = [];
        for (let c = 0; c < cuts.length - 1; ) {
            const [a, b] = [cuts[c], cuts[c + 1]];
            const run = points.slice(a, b + 1);
            const fit = fitCubic(run, wayAt(a), wayAt(b));
            if (fit.error > tolerance && b - a >= 3) {
                cuts.splice(c + 1, 0, Math.round((a + b) / 2));
                continue;
            }
            fits[c] = fit;
            worst = Math.max(worst, fit.error);
            c++;
        }
        fits.forEach((fit, c) => {
            const end = pinFor(cuts[c + 1], c === fits.length - 1 ? pinIds?.[k + 1] : undefined);
            const start = pins.at(-1)!;
            out.push({
                id: c === 0 ? segments[k].id : id++,
                name: segments[k].name,
                tension: tensionsFor(start.at, end.at, start.along!, end.along!, fit.reach),
            });
            pins.push(end);
        });
    }
    return { rope: { pins, segments: lettered(out) }, nextId: id, error: worst };
}

/** The biggest id a rope's pins and segments use. */
export const lastId = (rope: PinnedRope) =>
    Math.max(0, ...rope.pins.map((p) => p.id), ...rope.segments.map((s) => s.id));

/** The rope with pin `k` moved to `at`. */
export function movePin(rope: PinnedRope, k: number, at: Vector3): PinnedRope {
    return { ...rope, pins: rope.pins.map((p, i) => (i === k ? { ...p, at } : p)) };
}

/**
 * The rope with segment `k` split at its middle by a new pin, holding the way the rope runs there. Where both its pins
 * hold their directions, the two halves are exactly the segment it was.
 */
export function splitSegment(rope: PinnedRope, k: number): PinnedRope {
    const cubic = segmentCubics(rope)[k];
    const [a, c1, c2, b] = cubic;
    // De Casteljau at a half.
    const [ab, bc, cd] = [a.lerp(c1, 0.5), c1.lerp(c2, 0.5), c2.lerp(b, 0.5)];
    const [abc, bcd] = [ab.lerp(bc, 0.5), bc.lerp(cd, 0.5)];
    const mid = abc.lerp(bcd, 0.5);
    const way = bcd.sub(abc);
    const along = way.len() > 1e-12 ? way.unit() : b.sub(a).unit();
    const dirs = pinDirections(rope.pins);
    const id = lastId(rope) + 1;
    const pin: Pin3 = { id, at: mid, along };
    const seg = rope.segments[k];
    const first: Segment3 = {
        ...seg,
        tension: tensionsFor(a, mid, dirs[k], along, [ab.distanceTo(a), mid.distanceTo(abc)]),
    };
    const second: Segment3 = {
        id: id + 1,
        name: seg.name,
        tension: tensionsFor(mid, b, along, dirs[k + 1], [bcd.distanceTo(mid), b.distanceTo(cd)]),
    };
    return {
        pins: [...rope.pins.slice(0, k + 1), pin, ...rope.pins.slice(k + 1)],
        segments: lettered([
            ...rope.segments.slice(0, k),
            first,
            second,
            ...rope.segments.slice(k + 1),
        ]),
    };
}

/**
 * The rope with pin `k` taken out (not an end), its two segments joined as one: the first's id and name, its tensions
 * the outer ends' of the two.
 */
export function removePin(rope: PinnedRope, k: number): PinnedRope {
    if (k <= 0 || k >= rope.pins.length - 1) return rope;
    const [before, after] = [rope.segments[k - 1], rope.segments[k]];
    const joined: Segment3 = {
        id: before.id,
        name: nameParts(before.name).number,
        tension: [before.tension[0], after.tension[1]],
    };
    return {
        pins: rope.pins.filter((_, i) => i !== k),
        segments: lettered([
            ...rope.segments.slice(0, k - 1),
            joined,
            ...rope.segments.slice(k + 1),
        ]),
    };
}

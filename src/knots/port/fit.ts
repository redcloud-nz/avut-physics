/**
 * Fitting a knot editor strand to a rope as it's drawn now: pins along the drawing, and each segment's tensions, so the
 * editor's curve (a Hobby cubic between each pair of pins) keeps within a tolerance of the drawing everywhere.
 *
 * Every pin starts holding the drawing's direction where it is. Each segment's two control arms are fitted to the
 * drawing between its pins by least squares, with the end directions fixed (Schneider's method: a 2×2 linear solve,
 * then the samples' places along the curve refined, a few times over), and turned into tensions. A segment still
 * straying further than the tolerance gets a pin halfway along it. Then each pin in turn is let go of its angle
 * (its direction then comes from Hobby's method, as in the editor) and kept free if every segment still fits.
 *
 * Millimetres, y down, as the editor's files.
 */

import { Cubic } from "@/lib/bezier";
import { arcLengths } from "@/lib/curve";
import { segmentDistance } from "@/lib/geometry";
import { hobbyControls, hobbyTensions, MAX_TENSION, MIN_TENSION } from "@/lib/hobby";
import { clamp, deg, rad } from "@/lib/math";
import { solveLinear } from "@/lib/numeric";
import { Vector2 } from "@/lib/vector2";

import { strandDirections, type PlacedPin } from "../../knot-editor/geometry";

/**
 * A pin the fit has to have, at a point of the target (by index). `place` and `direction` override where it is and
 * which way it runs (for a pin linked beside another, placed from its leader). A `fixed` pin always holds its
 * direction (a leader, whose followers are placed across it, or a linked pin, which runs its leader's way).
 */
export type PinSpec = { index: number; place?: Vector2; direction?: Vector2; fixed?: boolean };

export type FitOptions = {
    /** The most the curve may stray from the target, anywhere (millimetres). */
    tolerance: number;
    /** Whether the segment from spec pin `a` to `b` may take a pin between them (by default, any may). */
    splittable?: (a: PinSpec, b: PinSpec) => boolean;
    /** Whether a pin added at this target point has to hold its direction (as a leader's do). */
    holds?: (index: number) => boolean;
};

/** A pin the fit placed: where, the angle it holds (degrees) if it holds one, and which target point it's at. */
export type FittedPin = { x: number; y: number; angle?: number; index: number; spec?: PinSpec };

export type Fit = {
    pins: FittedPin[];
    /** Each segment's tensions, and how far it strays from the target at worst. */
    tensions: [number, number][];
    misses: number[];
    /** The worst of `misses`. */
    worst: number;
};

/** Places and angles are written to a hundredth (millimetres, degrees), and tensions to a hundredth. */
const hundredths = (v: number) => Math.round(v * 100) / 100 || 0;

/** How many points of the target a segment is measured at, at most, and how finely its curve is sampled. */
const MEASURED = 40;
const CURVE_SAMPLES = 48;

/** The target's direction at each point, from its neighbours. */
function tangents(target: Vector2[]): Vector2[] {
    return target.map((p, i) => {
        const a = target[Math.max(0, i - 1)];
        const b = target[Math.min(target.length - 1, i + 1)];
        return b.sub(a).safeUnit(new Vector2(1, 0));
    });
}

/** How far a polyline's nearest point is from p. */
function polylineDistance(p: Vector2, line: Vector2[]): number {
    if (line.length === 1) return p.distanceTo(line[0]);
    let best = Infinity;
    for (let k = 0; k + 1 < line.length; k++)
        best = Math.min(
            best,
            line[k].distanceTo(line[k + 1]) < 1e-9
                ? p.distanceTo(line[k])
                : segmentDistance(p, line[k], line[k + 1]),
        );
    return best;
}

/** Every `step`th point of a run, keeping both ends, so a long run is measured at no more than `most` points. */
function thinned(points: Vector2[], most: number): Vector2[] {
    if (points.length <= most) return points;
    const step = (points.length - 1) / (most - 1);
    return Array.from({ length: most }, (_, k) => points[Math.round(k * step)]);
}

/** How far apart a curve and a run of points are at worst, both ways round. */
export function miss(cubic: Cubic, run: Vector2[]): number {
    const curve = cubic.points(CURVE_SAMPLES);
    const measured = thinned(run, MEASURED);
    let worst = 0;
    for (const p of measured) worst = Math.max(worst, polylineDistance(p, curve));
    for (const p of curve) worst = Math.max(worst, polylineDistance(p, measured));
    return worst;
}

/**
 * The tensions that bring a curve from a to b, leaving and arriving along the given directions, closest to `run` (by
 * least squares on its control arms, its points' places along the curve refined three times over), kept within the
 * editor's limits and rounded as they're written.
 */
export function fitTensions(
    a: Vector2,
    b: Vector2,
    leaving: Vector2,
    arriving: Vector2,
    run: Vector2[],
): [number, number] {
    const d = a.distanceTo(b);
    if (d < 1e-9 || run.length < 3) return [1, 1];
    const s = arcLengths(run);
    let u = s.map((v) => v / s[s.length - 1]);
    let arms: [number, number] = [d / 3, d / 3];
    for (let pass = 0; pass < 4; pass++) {
        // With c1 = a + α·leaving and c2 = b − β·arriving, the curve is a·(B0 + B1) + b·(B2 + B3) + α·leaving·B1
        // − β·arriving·B2: linear in α and β.
        let [c00, c01, c11, x0, x1] = [0, 0, 0, 0, 0];
        run.forEach((p, k) => {
            const t = u[k];
            const mt = 1 - t;
            const [b0, b1, b2, b3] = [mt * mt * mt, 3 * mt * mt * t, 3 * mt * t * t, t * t * t];
            const A1 = leaving.scale(b1);
            const A2 = arriving.scale(-b2);
            const rest = p.sub(a.scale(b0 + b1).add(b.scale(b2 + b3)));
            c00 += A1.dot(A1);
            c01 += A1.dot(A2);
            c11 += A2.dot(A2);
            x0 += A1.dot(rest);
            x1 += A2.dot(rest);
        });
        const solved = solveLinear(
            [
                [c00, c01],
                [c01, c11],
            ],
            [x0, x1],
        );
        if (solved && solved[0] > 1e-6 && solved[1] > 1e-6) arms = [solved[0], solved[1]];
        const cubic = new Cubic(
            a,
            a.add(leaving.scale(arms[0])),
            b.sub(arriving.scale(arms[1])),
            b,
        );
        // Each point's place along the curve, one Newton step nearer its nearest.
        u = run.map((p, k) => {
            const t = u[k];
            const off = cubic.pointAt(t).sub(p);
            const d1 = cubic.derivativeAt(t);
            const d2 = cubic.secondDerivativeAt(t);
            const den = d1.dot(d1) + off.dot(d2);
            return Math.abs(den) < 1e-12 ? t : clamp(t - off.dot(d1) / den, 0, 1);
        });
    }
    const c1 = a.add(leaving.scale(arms[0]));
    const c2 = b.sub(arriving.scale(arms[1]));
    const [t0, t1] = hobbyTensions(a, c1, c2, b);
    const limited = (t: number) =>
        hundredths(clamp(Number.isFinite(t) ? t : MAX_TENSION, MIN_TENSION, MAX_TENSION));
    return [limited(t0), limited(t1)];
}

/** The editor's curve between two pins. */
export const curveOf = (
    a: Vector2,
    b: Vector2,
    leaving: Vector2,
    arriving: Vector2,
    tension: readonly [number, number],
) => new Cubic(a, ...hobbyControls(a, b, leaving, arriving, tension), b);

type Working = {
    index: number;
    place: Vector2;
    /** The direction it holds, if it holds one. */
    holds?: Vector2;
    /** The drawing's direction, to hold again. */
    own: Vector2;
    fixed: boolean;
    spec?: PinSpec;
};

/**
 * A strand fitted to `target` (a polyline, evenly and finely spaced, as `resample` gives), with a pin at every one of
 * `specs`.
 */
export function fitStrand(target: Vector2[], specs: PinSpec[], options: FitOptions): Fit {
    const { tolerance } = options;
    const splittable = options.splittable ?? (() => true);
    const s = arcLengths(target);
    const along = tangents(target);
    const make = (spec: PinSpec | undefined, index: number): Working => {
        const place = spec?.place ?? target[index];
        const own = spec?.direction ?? along[index];
        const angle = hundredths(deg(own.angle()));
        const held = Vector2.fromAngle(rad(angle));
        return {
            index,
            place: new Vector2(hundredths(place.x), hundredths(place.y)),
            holds: held,
            own: held,
            fixed: !!spec?.fixed || !!spec?.direction || !!options.holds?.(index),
            spec,
        };
    };
    const ends = [0, target.length - 1];
    const bySpec = new Map(specs.map((spec) => [spec.index, spec]));
    let pins: Working[] = [...new Set([...ends, ...specs.map((p) => p.index)])]
        .sort((a, b) => a - b)
        .map((index) => make(bySpec.get(index), index));

    const directions = () =>
        strandDirections(
            pins.map(
                (p): PlacedPin => ({
                    x: p.place.x,
                    y: p.place.y,
                    angle: p.holds && hundredths(deg(p.holds.angle())),
                }),
            ),
        );
    const runOf = (k: number) => [
        pins[k].place,
        ...target.slice(pins[k].index + 1, pins[k + 1].index),
        pins[k + 1].place,
    ];
    const fitSegment = (k: number, dirs: Vector2[]) => {
        const [a, b] = [pins[k].place, pins[k + 1].place];
        const run = runOf(k);
        const tension = fitTensions(a, b, dirs[k], dirs[k + 1], run);
        return { tension, miss: miss(curveOf(a, b, dirs[k], dirs[k + 1], tension), run) };
    };

    // Pins added halfway along each segment that strays, until none does (or none can take one).
    let segments: { tension: [number, number]; miss: number }[] = [];
    for (let round = 0; round < 64; round++) {
        const dirs = directions();
        segments = pins.slice(1).map((_, k) => fitSegment(k, dirs));
        const split: Working[] = [];
        segments.forEach((seg, k) => {
            const [a, b] = [pins[k], pins[k + 1]];
            if (seg.miss <= tolerance || b.index - a.index < 2) return;
            if (a.spec && b.spec && !splittable(a.spec, b.spec)) return;
            const half = (s[a.index] + s[b.index]) / 2;
            let index = a.index + 1;
            while (index < b.index - 1 && s[index] < half) index++;
            split.push(make(undefined, index));
        });
        if (!split.length) break;
        pins = [...pins, ...split].sort((a, b) => a.index - b.index);
    }

    // Each pin let go of its angle where every segment still fits without it.
    for (let k = 0; k < pins.length; k++) {
        if (pins[k].fixed) continue;
        const kept = pins[k].holds;
        pins[k].holds = undefined;
        const dirs = directions();
        const tried = pins.slice(1).map((_, j) => fitSegment(j, dirs));
        const fits = tried.every((seg, j) => seg.miss <= Math.max(tolerance, segments[j].miss));
        if (fits) segments = tried;
        else pins[k].holds = kept;
    }

    const misses = segments.map((seg) => seg.miss);
    return {
        pins: pins.map((p) => ({
            x: p.place.x,
            y: p.place.y,
            ...(p.holds && { angle: hundredths(deg(p.holds.angle())) }),
            index: p.index,
            ...(p.spec && { spec: p.spec }),
        })),
        tensions: segments.map((seg) => seg.tension),
        misses,
        worst: Math.max(0, ...misses),
    };
}

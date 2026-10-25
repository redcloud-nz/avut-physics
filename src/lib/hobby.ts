/**
 * Hobby's curves, as in METAFONT and MetaPost (Knuth, "METAFONT: The Program", §§ 255–299): smooth cubic Béziers
 * through a row of points. The directions through the points come from making the curvature (Hobby's linear "mock"
 * curvature) carry on smoothly from one segment to the next; a segment's control points then come from its two end
 * directions and its tensions. Here the directions are solved as if every tension were 1, so they depend only on the
 * points and the directions held at the ends of the run.
 */

import { Vector2 } from "./vector2";

/** How a run of points starts or ends: heading a given way, or free, with Hobby's curl there (1 for a free end). */
export type RunEnd = { direction: Vector2 } | { curl: number };

/** The least tension (MetaPost's): below it curves can loop. */
export const MIN_TENSION = 0.75;
/** The greatest tension a segment is given. */
export const MAX_TENSION = 4;

/** An angle brought into (-π, π]. */
const wrap = (angle: number) => {
    const turned = angle % (2 * Math.PI);
    return turned > Math.PI
        ? turned - 2 * Math.PI
        : turned <= -Math.PI
          ? turned + 2 * Math.PI
          : turned;
};

/** The angle turned from direction a to direction b, in (-π, π]. */
const turn = (a: Vector2, b: Vector2) => Math.atan2(a.cross(b), a.dot(b));

/**
 * Hobby's velocity function f(θ, φ): how far along the chord (as a fraction of its length, at tension 1) the
 * control point leaving at angle θ to the chord sits, when the curve arrives at angle φ to it.
 */
function velocity(theta: number, phi: number): number {
    const [st, ct, sp, cp] = [Math.sin(theta), Math.cos(theta), Math.sin(phi), Math.cos(phi)];
    const num = 2 + Math.SQRT2 * (st - sp / 16) * (sp - st / 16) * (ct - cp);
    const den = 3 * (1 + 0.5 * (Math.sqrt(5) - 1) * ct + 0.5 * (3 - Math.sqrt(5)) * cp);
    return num / den;
}

/**
 * A segment's two control points, from its ends, the directions it leaves `from` and arrives at `to` (unit
 * vectors), and the tensions at each end.
 */
export function hobbyControls(
    from: Vector2,
    to: Vector2,
    leaving: Vector2,
    arriving: Vector2,
    tensions: readonly [number, number],
): [Vector2, Vector2] {
    const chord = to.sub(from);
    const d = chord.len();
    if (d < 1e-12) return [from, to];
    const theta = turn(chord, leaving);
    const phi = turn(arriving, chord);
    return [
        from.add(leaving.scale((d * velocity(theta, phi)) / tensions[0])),
        to.sub(arriving.scale((d * velocity(phi, theta)) / tensions[1])),
    ];
}

/**
 * The tensions that give a segment control points `c1` and `c2`: the reverse of `hobbyControls`, for a curve whose
 * control points lie along its end directions, as the halves of a split Hobby curve do. Infinite at an end whose
 * control point sits on the end itself.
 */
export function hobbyTensions(
    from: Vector2,
    c1: Vector2,
    c2: Vector2,
    to: Vector2,
): [number, number] {
    const chord = to.sub(from);
    const d = chord.len();
    const [out, back] = [c1.sub(from), to.sub(c2)];
    const theta = turn(chord, out.safeUnit(chord.unit()));
    const phi = turn(back.safeUnit(chord.unit()), chord);
    return [(d * velocity(theta, phi)) / out.len(), (d * velocity(phi, theta)) / back.len()];
}

/**
 * The directions (unit vectors) through a run of points, given how the run starts and ends. Hobby's equations for
 * the angles θₖ between each direction and the chord leaving its point, with every tension 1, make a tridiagonal
 * system, solved directly (the Thomas algorithm). Two points with both ends free give a straight line.
 */
export function hobbyDirections(points: readonly Vector2[], start: RunEnd, end: RunEnd): Vector2[] {
    const n = points.length - 1;
    if (n < 1) throw new Error("hobbyDirections: a run needs at least two points");
    const chords = points.slice(1).map((p, k) => p.sub(points[k]));
    const lengths = chords.map((c) => Math.max(c.len(), 1e-9));
    const angles = chords.map((c) => c.angle());
    // ψₖ: how far the chords turn at each point inside the run (0 at the ends).
    const psi = points.map((_, k) => (k === 0 || k === n ? 0 : wrap(angles[k] - angles[k - 1])));

    if (n === 1 && "curl" in start && "curl" in end) {
        const along = chords[0].safeUnit(new Vector2(1, 0));
        return [along, along];
    }

    // Row k: a[k] θₖ₋₁ + b[k] θₖ + c[k] θₖ₊₁ = r[k]. θₙ stands for minus the arriving angle φₙ.
    const [a, b, c, r] = [0, 1, 2, 3].map(() => new Array<number>(n + 1).fill(0));
    if ("direction" in start) {
        b[0] = 1;
        r[0] = turn(chords[0], start.direction);
    } else {
        const g = start.curl;
        b[0] = g + 2;
        c[0] = 2 * g + 1;
        r[0] = -(2 * g + 1) * psi[1];
    }
    for (let k = 1; k < n; k++) {
        const [before, after] = [lengths[k - 1], lengths[k]];
        a[k] = 1 / before;
        b[k] = 2 / before + 2 / after;
        c[k] = 1 / after;
        r[k] = (-2 * psi[k]) / before - psi[k + 1] / after;
    }
    if ("direction" in end) {
        b[n] = 1;
        r[n] = -turn(end.direction, chords[n - 1]);
    } else {
        const g = end.curl;
        a[n] = 2 * g + 1;
        b[n] = g + 2;
    }

    // Forward elimination, then back substitution.
    for (let k = 1; k <= n; k++) {
        const m = a[k] / b[k - 1];
        b[k] -= m * c[k - 1];
        r[k] -= m * r[k - 1];
    }
    const theta = new Array<number>(n + 1);
    theta[n] = r[n] / b[n];
    for (let k = n - 1; k >= 0; k--) theta[k] = (r[k] - c[k] * theta[k + 1]) / b[k];

    return points.map((_, k) =>
        k < n
            ? Vector2.fromAngle(angles[k] + theta[k])
            : // θₙ = -φₙ, and the curve arrives turned by -φₙ from the last chord.
              Vector2.fromAngle(angles[n - 1] + theta[n]),
    );
}

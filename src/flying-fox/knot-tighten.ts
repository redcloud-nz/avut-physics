import { vec3, type Vector3 } from "@/lib/vector3";

/**
 * A knot pulled tight: a rope's centreline, lifted from a loose drawing (`liftKnot`), tightened by position-based
 * dynamics. The rope's points keep their spacing along it (it doesn't stretch), it bends no tighter than `minBend`
 * diameters to its centreline and resists bending a little, it can't pass through itself (any two points further
 * apart along it than a bend can bring them stay a diameter apart) or through the bar it's tied round, and its ends are
 * pulled. With no friction it would pull up until it jams, so it stops when the knot's as compact as `stop` says.
 */

export type TightenOptions = {
    /** The rope's diameter (metres). */
    diameter: number;
    /** A bar it's tied round, running along z through `at`, `r` in radius (metres). */
    bar?: { at: Vector3; r: number };
    /** How far each end is pulled each step (metres), along `pull`'s direction: one for each end. */
    pull?: [Vector3, Vector3];
    /** How much shorter the rope gets each step (a fraction of its length), drawing the knot up evenly. */
    shrink?: number;
    /** How many steps at most, and how many passes over the constraints each step. */
    steps?: number;
    iterations?: number;
    /** The tightest bend, in diameters to the centreline. */
    minBend?: number;
    /** How much each step straightens the rope, 0 to 1: its stiffness. */
    stiffness?: number;
    /** Checked every so often: true once it's tight enough. */
    stop?: (points: Vector3[]) => boolean;
};

export function tightenKnot(start: Vector3[], options: TightenOptions): Vector3[] {
    const {
        diameter: d,
        bar,
        pull,
        shrink = 0,
        steps = 4000,
        iterations = 12,
        minBend = 0.5,
        stiffness = 0.02,
        stop,
    } = options;
    const n = start.length;
    const x = Float64Array.from(start, (p) => p.x);
    const y = Float64Array.from(start, (p) => p.y);
    const z = Float64Array.from(start, (p) => p.z);
    const rest = Array.from({ length: n - 1 }, (_, i) => start[i].distanceTo(start[i + 1]));
    const step = rest.reduce((a, b) => a + b, 0) / rest.length;
    // Points closer than this along the rope are never pushed apart: a bend at its tightest can bring them within a
    // diameter of each other.
    const skip = Math.ceil((Math.PI * Math.max(minBend, 0.5) * d) / step) + 1;
    // The least chord between points two either side of one, for the tightest bend.
    const k = 2;
    const R = minBend * d;
    // The chord across an arc `k` pieces long bent to radius R: the arc turns through k·step/R, its chord 2R sin of half.
    const chordFor = (length: number) => 2 * R * Math.sin(Math.min(Math.PI / 2, length / (2 * R)));
    let chord = chordFor(k * step);
    const points = () => Array.from({ length: n }, (_, i) => vec3(x[i], y[i], z[i]));

    // Pairs near enough to touch soon, found again every so often: those within 2 diameters.
    let pairs: number[] = [];
    const findPairs = () => {
        pairs = [];
        const cell = 2 * d;
        const grid = new Map<number, number[]>();
        const key = (a: number, b: number, c: number) =>
            (a + 512) * 1048576 + (b + 512) * 1024 + (c + 512);
        for (let i = 0; i < n; i++) {
            const kk = key(
                Math.floor(x[i] / cell),
                Math.floor(y[i] / cell),
                Math.floor(z[i] / cell),
            );
            const list = grid.get(kk);
            if (list) list.push(i);
            else grid.set(kk, [i]);
        }
        for (let i = 0; i < n; i++) {
            const [cx, cy, cz] = [
                Math.floor(x[i] / cell),
                Math.floor(y[i] / cell),
                Math.floor(z[i] / cell),
            ];
            for (let a = -1; a <= 1; a++)
                for (let b = -1; b <= 1; b++)
                    for (let c = -1; c <= 1; c++)
                        for (const j of grid.get(key(cx + a, cy + b, cz + c)) ?? [])
                            if (j > i + skip) pairs.push(i, j);
        }
    };

    const apart = (i: number, j: number, want: number, wi = 0.5, wj = 0.5) => {
        const [dx, dy, dz] = [x[j] - x[i], y[j] - y[i], z[j] - z[i]];
        const len = Math.hypot(dx, dy, dz);
        if (len === 0) return;
        const c = (len - want) / len;
        x[i] += dx * c * wi;
        y[i] += dy * c * wi;
        z[i] += dz * c * wi;
        x[j] -= dx * c * wj;
        y[j] -= dy * c * wj;
        z[j] -= dz * c * wj;
    };

    for (let s = 0; s < steps; s++) {
        if (s % 10 === 0) findPairs();
        if (shrink) {
            for (let i = 0; i < rest.length; i++) rest[i] *= 1 - shrink;
            chord = chordFor(k * step * (rest[0] / start[0].distanceTo(start[1])));
        }
        // Pull the ends.
        if (pull)
            for (const [i, p] of [
                [0, pull[0]],
                [n - 1, pull[1]],
            ] as const) {
                x[i] += p.x;
                y[i] += p.y;
                z[i] += p.z;
            }
        for (let it = 0; it < iterations; it++) {
            // Stiffness: each point drawn a little towards the middle of its neighbours.
            if (stiffness > 0)
                for (let i = 1; i < n - 1; i++) {
                    x[i] += stiffness * ((x[i - 1] + x[i + 1]) / 2 - x[i]);
                    y[i] += stiffness * ((y[i - 1] + y[i + 1]) / 2 - y[i]);
                    z[i] += stiffness * ((z[i - 1] + z[i + 1]) / 2 - z[i]);
                }
            // The tightest bend.
            for (let i = k; i < n - k; i++) {
                const [a, b] = [i - k, i + k];
                const len = Math.hypot(x[b] - x[a], y[b] - y[a], z[b] - z[a]);
                if (len < chord) apart(a, b, chord);
            }
            // Not passing through itself.
            for (let p = 0; p < pairs.length; p += 2) {
                const [i, j] = [pairs[p], pairs[p + 1]];
                const len = Math.hypot(x[j] - x[i], y[j] - y[i], z[j] - z[i]);
                if (len < d) apart(i, j, d);
            }
            // Not through the bar.
            if (bar) {
                const want = bar.r + d / 2;
                for (let i = 0; i < n; i++) {
                    const [dx, dy] = [x[i] - bar.at.x, y[i] - bar.at.y];
                    const len = Math.hypot(dx, dy);
                    if (len < want && len > 0) {
                        x[i] = bar.at.x + (dx * want) / len;
                        y[i] = bar.at.y + (dy * want) / len;
                    }
                }
            }
            // Its length: each piece as long as it started, both ways along so neither end leads.
            for (let i = 0; i < n - 1; i++) apart(i, i + 1, rest[i]);
            for (let i = n - 2; i >= 0; i--) apart(i, i + 1, rest[i]);
        }
        if (stop && s % 25 === 0 && stop(points())) break;
    }
    return points();
}

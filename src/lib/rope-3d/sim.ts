import { vec3, type Vector3 } from "@/lib/vector3";

import type { Loop, RopeSetup } from "./rope";

/**
 * A rope settling by position-based dynamics: its points kept their spacing along it (it doesn't stretch), bent no
 * tighter than its least bend, straightened a little each step (its stiffness), kept a diameter off itself wherever two
 * points further apart along it than a tight bend can bring them come close, and kept off the bars and closed bars. Points held
 * (`fixed`) don't move, and everything else is kept off them. Pieces marked `shrinking` get a little shorter each step,
 * drawing the rope up.
 *
 * Strands already closer than a diameter when it starts (a knot tightened before can leave some pressed into each
 * other) are let stay as close as they are, but no closer: pushed apart all at once, they'd kink the rope.
 *
 * It works in place on flat arrays, a step at a time, so an editor can run a few steps a frame and show it.
 */
export class RopeSim {
    readonly n: number;
    readonly x: Float64Array;
    readonly y: Float64Array;
    readonly z: Float64Array;
    /** Each piece's length, from each point to the next. */
    readonly rest: Float64Array;
    readonly fixed: Uint8Array;
    shrinking: Uint8Array | null = null;
    /** How much shorter each shrinking piece gets a step, as a fraction. */
    shrink = 0;
    /** How far each end is pulled a step, if it is. */
    pull: [Vector3, Vector3] | null = null;
    /** How many passes over the constraints each step. */
    iterations = 12;
    /** How often (in steps) the pairs near enough to touch are found again. */
    refreshEvery = 10;
    stiffness: number;
    private readonly setup: RopeSetup;
    private pairs: number[] = [];
    private steps = 0;
    /** How close each pair that started closer than a diameter may come (keyed i * n + j). */
    private readonly allowed = new Map<number, number>();
    /** The closed bars, each with its pieces filed by the cells of a grid they're near, to find them quickly. */
    private readonly loops: LoopGrid[];

    constructor(points: readonly Vector3[], setup: RopeSetup, fixed?: readonly boolean[]) {
        this.setup = setup;
        this.stiffness = setup.stiffness;
        const n = (this.n = points.length);
        this.x = Float64Array.from(points, (p) => p.x);
        this.y = Float64Array.from(points, (p) => p.y);
        this.z = Float64Array.from(points, (p) => p.z);
        this.rest = Float64Array.from({ length: Math.max(0, n - 1) }, (_, i) =>
            points[i].distanceTo(points[i + 1]),
        );
        this.fixed = Uint8Array.from({ length: n }, (_, i) => (fixed?.[i] ? 1 : 0));
        this.loops = (setup.loops ?? []).map((loop) => loopGrid(loop, setup.diameter));
        this.findPairs();
        const d = setup.diameter;
        for (let p = 0; p < this.pairs.length; p += 2) {
            const [i, j] = [this.pairs[p], this.pairs[p + 1]];
            const gap = Math.hypot(
                this.x[j] - this.x[i],
                this.y[j] - this.y[i],
                this.z[j] - this.z[i],
            );
            if (gap < d) this.allowed.set(i * n + j, gap);
        }
    }

    points(): Vector3[] {
        return Array.from({ length: this.n }, (_, i) => vec3(this.x[i], this.y[i], this.z[i]));
    }

    point(i: number): Vector3 {
        return vec3(this.x[i], this.y[i], this.z[i]);
    }

    /** Moves point `i` to `p`. */
    set(i: number, p: Vector3) {
        this.x[i] = p.x;
        this.y[i] = p.y;
        this.z[i] = p.z;
    }

    /**
     * How far apart along the rope two points must be to be kept a diameter apart: a bend at its tightest brings points
     * half a turn round it within a diameter, so nearer ones than that are never pushed apart.
     */
    private get reach() {
        const d = this.setup.diameter;
        return Math.PI * Math.max(this.setup.minBend, d / 2);
    }

    /** Each point's distance along the rope, by the pieces' lengths. */
    private along(): Float64Array {
        const out = new Float64Array(this.n);
        for (let i = 1; i < this.n; i++) out[i] = out[i - 1] + this.rest[i - 1];
        return out;
    }

    /** The pairs within two diameters of each other that can touch: far enough apart along the rope, not both held. */
    findPairs() {
        const { n, x, y, z, fixed } = this;
        const d = this.setup.diameter;
        const reach = this.reach;
        const along = this.along();
        const cell = 2 * d;
        const grid = new Map<number, number[]>();
        const key = (a: number, b: number, c: number) =>
            (a + 1024) * 4194304 + (b + 1024) * 2048 + (c + 1024);
        const cx = new Int32Array(n);
        const cy = new Int32Array(n);
        const cz = new Int32Array(n);
        for (let i = 0; i < n; i++) {
            [cx[i], cy[i], cz[i]] = [
                Math.floor(x[i] / cell),
                Math.floor(y[i] / cell),
                Math.floor(z[i] / cell),
            ];
            const k = key(cx[i], cy[i], cz[i]);
            const list = grid.get(k);
            if (list) list.push(i);
            else grid.set(k, [i]);
        }
        const pairs: number[] = [];
        for (let i = 0; i < n; i++)
            for (let a = -1; a <= 1; a++)
                for (let b = -1; b <= 1; b++)
                    for (let c = -1; c <= 1; c++)
                        for (const j of grid.get(key(cx[i] + a, cy[i] + b, cz[i] + c)) ?? []) {
                            if (j <= i || along[j] - along[i] <= reach) continue;
                            if (fixed[i] && fixed[j]) continue;
                            pairs.push(i, j);
                        }
        this.pairs = pairs;
    }

    /** Moves points i and j to `want` apart along the line between them, sharing the move between those not held. */
    private apart(i: number, j: number, want: number) {
        const { x, y, z, fixed } = this;
        const [fi, fj] = [fixed[i] ? 0 : 1, fixed[j] ? 0 : 1];
        if (fi + fj === 0) return;
        const [wi, wj] = [fi / (fi + fj), fj / (fi + fj)];
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
    }

    /** One step: the pieces shrunk and ends pulled, if they are, then the constraints. */
    step() {
        const { n, rest, shrinking, shrink, pull, fixed } = this;
        if (this.steps++ % this.refreshEvery === 0) this.findPairs();
        if (shrink)
            for (let i = 0; i < rest.length; i++)
                if (!shrinking || shrinking[i]) rest[i] *= 1 - shrink;
        if (pull)
            for (const [i, p] of [
                [0, pull[0]],
                [n - 1, pull[1]],
            ] as const) {
                if (fixed[i]) continue;
                this.x[i] += p.x;
                this.y[i] += p.y;
                this.z[i] += p.z;
            }
        this.relax();
    }

    /** Pieces with no length of their own (1), left out of the length passes: they're as long as the rest makes them. */
    free: Uint8Array | null = null;

    /** Passes over the constraints, with the rope where it is. */
    relax(iterations = this.iterations) {
        const { n, x, y, z, rest, fixed, stiffness } = this;
        const { diameter: d, minBend: R, bars } = this.setup;
        const along = this.along();
        // The least chord across each point's bend, for the spans either side of it: an arc that long bent at the
        // least bend, its chord 2R sin of half the angle it turns through.
        const spans = [2, 4];
        const chord = (arc: number) => 2 * R * Math.sin(Math.min(Math.PI / 2, arc / (2 * R)));
        // Stiffness, once a pass over the constraints: each point drawn a little towards the middle of its neighbours,
        // which the constraints then hold to its length.
        if (stiffness > 0)
            for (let i = 1; i < n - 1; i++) {
                if (fixed[i]) continue;
                x[i] += stiffness * ((x[i - 1] + x[i + 1]) / 2 - x[i]);
                y[i] += stiffness * ((y[i - 1] + y[i + 1]) / 2 - y[i]);
                z[i] += stiffness * ((z[i - 1] + z[i + 1]) / 2 - z[i]);
            }
        for (let it = 0; it < iterations; it++) {
            // The least bend.
            for (const k of spans)
                for (let i = k; i < n - k; i++) {
                    const [a, b] = [i - k, i + k];
                    if (fixed[a] && fixed[b] && fixed[i]) continue;
                    const want = chord(along[b] - along[a]);
                    const len = Math.hypot(x[b] - x[a], y[b] - y[a], z[b] - z[a]);
                    if (len < want) this.apart(a, b, want);
                }
            // Not through itself.
            const { pairs, allowed } = this;
            for (let p = 0; p < pairs.length; p += 2) {
                const [i, j] = [pairs[p], pairs[p + 1]];
                const len = Math.hypot(x[j] - x[i], y[j] - y[i], z[j] - z[i]);
                const want = allowed.size ? (allowed.get(i * n + j) ?? d) : d;
                if (len < want) this.apart(i, j, want);
            }
            // Not through a bar.
            for (const bar of bars) {
                const want = bar.r + d / 2;
                const u = bar.along;
                for (let i = 0; i < n; i++) {
                    if (fixed[i]) continue;
                    const [vx, vy, vz] = [x[i] - bar.at.x, y[i] - bar.at.y, z[i] - bar.at.z];
                    const t = vx * u.x + vy * u.y + vz * u.z;
                    const [rx, ry, rz] = [vx - u.x * t, vy - u.y * t, vz - u.z * t];
                    const len = Math.hypot(rx, ry, rz);
                    if (len < want && len > 0) {
                        const c = (want - len) / len;
                        x[i] += rx * c;
                        y[i] += ry * c;
                        z[i] += rz * c;
                    }
                }
            }
            // Not through a closed bar: each point pushed out from the nearest piece of it near enough to touch.
            for (const loop of this.loops) {
                const want = loop.r + d / 2;
                const P = loop.points;
                for (let i = 0; i < n; i++) {
                    if (fixed[i]) continue;
                    const near = loop.cells.get(loop.key(x[i], y[i], z[i]));
                    if (!near) continue;
                    let [best, bx, by, bz] = [Infinity, 0, 0, 0];
                    for (const k of near) {
                        const [a, b] = [P[k], P[k + 1]];
                        const [ux, uy, uz] = [b.x - a.x, b.y - a.y, b.z - a.z];
                        const uu = ux * ux + uy * uy + uz * uz;
                        const t =
                            uu > 0
                                ? Math.min(
                                      1,
                                      Math.max(
                                          0,
                                          ((x[i] - a.x) * ux +
                                              (y[i] - a.y) * uy +
                                              (z[i] - a.z) * uz) /
                                              uu,
                                      ),
                                  )
                                : 0;
                        const [rx, ry, rz] = [
                            x[i] - (a.x + ux * t),
                            y[i] - (a.y + uy * t),
                            z[i] - (a.z + uz * t),
                        ];
                        const len = Math.hypot(rx, ry, rz);
                        if (len < best) [best, bx, by, bz] = [len, rx, ry, rz];
                    }
                    if (best < want && best > 0) {
                        const c = (want - best) / best;
                        x[i] += bx * c;
                        y[i] += by * c;
                        z[i] += bz * c;
                    }
                }
            }
            // Its length: each piece its own length, both ways along so neither end leads.
            const free = this.free;
            for (let i = 0; i < n - 1; i++) if (!free?.[i]) this.apart(i, i + 1, rest[i]);
            for (let i = n - 2; i >= 0; i--) if (!free?.[i]) this.apart(i, i + 1, rest[i]);
        }
    }
}

/** A closed bar's pieces filed by grid cell: each in every cell within reach of a rope touching it. */
type LoopGrid = {
    points: Loop["points"];
    r: number;
    cells: Map<string, number[]>;
    key: (x: number, y: number, z: number) => string;
};

function loopGrid(loop: Loop, diameter: number): LoopGrid {
    const reach = loop.r + diameter / 2;
    const cell = 2 * reach;
    const c = (v: number) => Math.floor(v / cell);
    const key = (x: number, y: number, z: number) => `${c(x)},${c(y)},${c(z)}`;
    const cells = new Map<string, number[]>();
    const P = loop.points;
    for (let k = 0; k < P.length - 1; k++) {
        const [a, b] = [P[k], P[k + 1]];
        const lo = [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z)].map((v) =>
            c(v - reach),
        );
        const hi = [Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z)].map((v) =>
            c(v + reach),
        );
        for (let i = lo[0]; i <= hi[0]; i++)
            for (let j = lo[1]; j <= hi[1]; j++)
                for (let l = lo[2]; l <= hi[2]; l++) {
                    const id = `${i},${j},${l}`;
                    const list = cells.get(id);
                    if (list) list.push(k);
                    else cells.set(id, [k]);
                }
    }
    return { points: P, r: loop.r, cells, key };
}

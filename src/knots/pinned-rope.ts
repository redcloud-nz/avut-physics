/**
 * A rope given by where it's pinned rather than by its curves: pins in order along it, the length of rope between
 * each pin and the next, and how much hangs on past the last. A pin holds the rope at a point, and can also hold
 * the way it heads through that point. Between the pins the rope lies as smoothly as it can, the way a rope
 * settles on a table: the shape that bends least overall, for its length.
 *
 * Rope diameters, y down, as in `rope-path.ts`. Angles are in degrees, measured from +x towards +y, so a rope
 * heading straight up the page is at −90.
 */

import { findRoot, solveLinear } from "@/lib/numeric";
import { vec2, Vector2 } from "@/lib/vector2";

import type { Bar } from "./bar";
import { crossings, over as overSegment, plain, type RopePath } from "./rope-path";

export type Pin = { x: number; y: number; angle?: number };

export type PinnedRope = {
    /** The first pin is the start of the rope. */
    pins: Pin[];
    /** The rope between each pin and the next. */
    lengths: number[];
    /** The rope past the last pin, lying straight on from it. */
    tail: number;
    /** Where along the rope (from its start) it goes over at a crossing: one entry for each crossing. */
    over: number[];
    /**
     * For a rope round a bar seen side on, where along it the passes across the bar that go in front of it are: one
     * entry for each. The other passes go behind it.
     */
    front?: number[];
};

/** About how far apart the solved rope's points are (diameters). */
const SPACING = 0.5;

export type RopeShape = {
    /** The rope's points, from its start, and how far along it each is. */
    points: Vector2[];
    s: number[];
    /** The way each link heads (radians), to start the next solve from. */
    theta: number[];
    /** Which point each pin is at. */
    pinNodes: number[];
    /** False if the pins couldn't all be met, as when two are further apart than the rope between them. */
    converged: boolean;
};

/** How much the pins' conditions give, to keep a straight stretch solvable. */
const GIVE = 1e-9;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** `angle` plus whatever whole turns bring it nearest `near`. */
const nearest = (angle: number, near: number) =>
    angle + 2 * Math.PI * Math.round((near - angle) / (2 * Math.PI));

/** The links' lengths, and the link each pin's point starts. */
function links(rope: PinnedRope): { h: number[]; pinNodes: number[] } {
    const h: number[] = [];
    const pinNodes = [0];
    for (const length of rope.lengths) {
        const n = Math.max(2, Math.ceil(length / SPACING));
        for (let j = 0; j < n; j++) h.push(length / n);
        pinNodes.push(h.length);
    }
    const n = Math.ceil(rope.tail / SPACING);
    for (let j = 0; j < n; j++) h.push(rope.tail / n);
    return { h, pinNodes };
}

/**
 * A first guess: each stretch between pins a circular arc of its length, bowing the way its pins' angles say, or
 * else the way that carries on smoothest from the stretch before.
 */
function firstGuess(rope: PinnedRope, h: number[], pinNodes: number[]): number[] {
    const theta: number[] = [];
    let heading = rope.pins[0].angle === undefined ? undefined : rad(rope.pins[0].angle);
    rope.lengths.forEach((length, i) => {
        const [a, b] = [rope.pins[i], rope.pins[i + 1]];
        const chord = vec2(b.x - a.x, b.y - a.y);
        const phi = Math.atan2(chord.y, chord.x);
        const ratio = Math.min(chord.len() / length, 1);
        // Half the angle the arc turns through: sin α / α = chord / length.
        const alpha =
            ratio > 0.9999 ? 0 : findRoot((t) => Math.sin(t) / t - ratio, 1e-9, Math.PI, 1e-9);
        let side = 1;
        if (a.angle !== undefined) side = Math.sign(nearest(rad(a.angle), phi) - phi) || 1;
        else if (b.angle !== undefined) side = Math.sign(phi - nearest(rad(b.angle), phi)) || 1;
        else if (heading !== undefined) side = Math.sign(nearest(heading, phi) - phi) || 1;
        const n = pinNodes[i + 1] - pinNodes[i];
        for (let j = 0; j < n; j++) {
            const t = (j + 0.5) / n;
            theta.push(phi + side * alpha * (1 - 2 * t));
        }
        heading = theta[theta.length - 1];
    });
    while (theta.length < h.length) theta.push(heading ?? -Math.PI / 2);
    // Keep the headings continuous, without jumps of a whole turn.
    for (let j = 1; j < theta.length; j++) theta[j] = nearest(theta[j], theta[j - 1]);
    return theta;
}

/**
 * The rope's shape: the headings of its links that bend it least (the sum over its joints of the turn squared,
 * over the length there) while meeting every pin. Newton's method on the conditions for a constrained minimum,
 * from `warm` (the last shape, while a pin's being dragged) or else from arcs between the pins.
 */
export function solveRope(rope: PinnedRope, warm?: number[]): RopeShape {
    const { h, pinNodes } = links(rope);
    const n = h.length;
    let theta = warm && warm.length === n ? [...warm] : firstGuess(rope, h, pinNodes);
    const start = vec2(rope.pins[0].x, rope.pins[0].y);
    const w = h.slice(1).map((hj, j) => 2 / (h[j] + hj));

    /** Each pin's conditions: what's off and how that changes with each heading. */
    type Condition = {
        value: number;
        grad: Map<number, number>;
        curve?: (j: number) => number;
        upTo?: number;
        axis?: 0 | 1;
    };
    const conditions = (th: number[]): Condition[] => {
        const out: Condition[] = [];
        const at = [start];
        for (let j = 0; j < n; j++) at.push(at[j].add(Vector2.fromAngle(th[j], h[j])));
        rope.pins.forEach((pin, k) => {
            const m = pinNodes[k];
            const prev = rope.pins[k - 1];
            const chord = prev && vec2(pin.x - prev.x, pin.y - prev.y);
            if (k > 0 && chord.len() >= rope.lengths[k - 1] - 1e-9) {
                // Pulled straight: every link heads straight for this pin, which puts the rope on it. (Holding
                // its position instead asks for a tension that grows without end as the stretch comes straight.)
                const phi = Math.atan2(chord.y, chord.x);
                for (let j = pinNodes[k - 1]; j < m; j++)
                    out.push({ value: th[j] - nearest(phi, th[j]), grad: new Map([[j, 1]]) });
            } else if (k > 0) {
                const gx = new Map<number, number>();
                const gy = new Map<number, number>();
                for (let j = 0; j < m; j++) {
                    gx.set(j, -h[j] * Math.sin(th[j]));
                    gy.set(j, h[j] * Math.cos(th[j]));
                }
                out.push({ value: at[m].x - pin.x, grad: gx, upTo: m, axis: 0 });
                out.push({ value: at[m].y - pin.y, grad: gy, upTo: m, axis: 1 });
            }
            if (pin.angle !== undefined) {
                const joint = m === 0 ? [0] : m === n ? [n - 1] : [m - 1, m];
                const mean = joint.reduce((sum, j) => sum + th[j], 0) / joint.length;
                const grad = new Map(joint.map((j) => [j, 1 / joint.length]));
                out.push({ value: mean - nearest(rad(pin.angle), mean), grad });
            }
        });
        return out;
    };
    const energy = (th: number[]) =>
        w.reduce((sum, wj, j) => sum + 0.5 * wj * (th[j + 1] - th[j]) ** 2, 0);
    const violation = (cs: Condition[]) => cs.reduce((sum, c) => sum + Math.abs(c.value), 0);

    let lambda: number[] = [];
    for (let iter = 0; iter < 100; iter++) {
        const cs = conditions(theta);
        const m = cs.length;
        if (lambda.length !== m) lambda = new Array(m).fill(0);
        // The Hessian of the Lagrangian: the bending's (tridiagonal), plus the pins' position conditions' own
        // curvature (on the diagonal), plus a little to settle any heading nothing else holds.
        const size = n + m;
        const K = Array.from({ length: size }, () => new Array<number>(size).fill(0));
        const rhs = new Array<number>(size).fill(0);
        for (let j = 0; j < n - 1; j++) {
            K[j][j] += w[j];
            K[j + 1][j + 1] += w[j];
            K[j][j + 1] -= w[j];
            K[j + 1][j] -= w[j];
            const g = w[j] * (theta[j + 1] - theta[j]);
            rhs[j] -= g;
            rhs[j + 1] += g;
        }
        for (let j = 0; j < n; j++) K[j][j] += 1e-6;
        cs.forEach((c, i) => {
            if (c.upTo !== undefined)
                for (let j = 0; j < c.upTo; j++) {
                    const second =
                        c.axis === 0 ? -h[j] * Math.cos(theta[j]) : -h[j] * Math.sin(theta[j]);
                    K[j][j] += lambda[i] * second;
                }
            for (const [j, g] of c.grad) {
                K[n + i][j] = g;
                K[j][n + i] = g;
            }
            // A stretch pulled straight makes its pins' conditions depend on each other; a touch of give keeps
            // the system solvable there, taken back out again by the last multipliers so the pins are still met
            // exactly in the end (the proximal method of multipliers).
            K[n + i][n + i] = -GIVE;
            rhs[n + i] = c.value + GIVE * lambda[i];
        });
        const solution = solveLinear(
            K,
            rhs.map((r) => -r),
        );
        if (!solution) break;
        const step = solution.slice(0, n);
        const newLambda = solution.slice(n);
        // Step as far as makes the bending plus the pins' misses smaller, up to the whole Newton step. Take the
        // whole step anyway if it at least halves the misses: near the answer the bending can rise a little as
        // the misses vanish, and refusing those steps stalls it.
        const rho = 1 + 2 * Math.max(0, ...newLambda.map(Math.abs));
        const merit = (th: number[]) => energy(th) + rho * violation(conditions(th));
        const now = merit(theta);
        const missing = violation(cs);
        let t = 1;
        let next = theta.map((v, j) => v + step[j]);
        const good = (th: number[]) => merit(th) <= now || violation(conditions(th)) < missing / 2;
        while (!good(next) && t > 1e-3) {
            t /= 2;
            next = theta.map((v, j) => v + t * step[j]);
        }
        theta = next;
        lambda = newLambda;
        const biggest = Math.max(...step.map(Math.abs)) * t;
        if (biggest < 1e-10) break;
    }
    const at = [start];
    for (let j = 0; j < n; j++) at.push(at[j].add(Vector2.fromAngle(theta[j], h[j])));
    const converged = rope.pins.every(
        (pin, k) => at[pinNodes[k]].distanceTo(vec2(pin.x, pin.y)) < 1e-6,
    );

    const points = at;
    const s = [0];
    for (let j = 0; j < n; j++) s.push(s[j] + h[j]);
    return { points, s, theta, pinNodes, converged };
}

const fmt = (v: number) => (Math.abs(v) < 1e-9 ? "0" : v.toFixed(4));

/** Smooth path data through points `from` to `to` of `points` (Catmull–Rom, as cubic Béziers). */
function smoothThrough(points: Vector2[], from: number, to: number, first: boolean): string {
    const parts: string[] = first ? [`M ${fmt(points[from].x)} ${fmt(points[from].y)}`] : [];
    for (let i = from; i < to; i++) {
        const [p0, p1, p2, p3] = [
            points[Math.max(i - 1, 0)],
            points[i],
            points[i + 1],
            points[Math.min(i + 2, points.length - 1)],
        ];
        const c1 = p1.add(p2.sub(p0).scale(1 / 6));
        const c2 = p2.sub(p3.sub(p1).scale(1 / 6));
        parts.push(
            `C ${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(p2.x)} ${fmt(p2.y)}`,
        );
    }
    return parts.join(" ");
}

/** How near (along the rope) an `over` entry has to be to a pass to say that pass goes over. */
export const OVER_MATCH = 2;

/** Every place the rope crosses itself, and which of the two passes (if either) the rope's `over` list names. */
export function ropeCrossings(rope: PinnedRope, shape: RopeShape) {
    const line: RopePath = [plain(`M ${shape.points.map((p) => `${p.x} ${p.y}`).join(" L ")}`)];
    return crossings(line).map((c) => {
        const named = c.s.map((s) => rope.over.some((o) => Math.abs(o - s) < OVER_MATCH));
        return {
            ...c,
            over: named[0] === named[1] ? null : named[0] ? (0 as const) : (1 as const),
        };
    });
}

/** How far a pass in front of a bar is marked over past the bar's edge, along the rope (diameters). */
const PAST_BAR = 0.6;

/**
 * Each place the rope passes across a bar seen side on: the points from where it meets the bar's edge to where it
 * leaves it, the point halfway along, and whether the rope's `front` list puts it in front of the bar. None for a bar
 * seen end on.
 */
export function barPasses(rope: PinnedRope, shape: RopeShape, bar?: Bar) {
    if (!bar?.length) return [];
    const { points, s } = shape;
    const on = points.map(
        (p) => Math.abs(p.y - bar.y) < bar.r && Math.abs(p.x - bar.x) < bar.length! / 2,
    );
    const passes: { from: number; to: number; at: Vector2; front: boolean }[] = [];
    for (let i = 0; i < points.length; i++) {
        if (!on[i] || (i > 0 && on[i - 1])) continue;
        let j = i;
        while (j + 1 < points.length && on[j + 1]) j++;
        const front = (rope.front ?? []).some((f) => f >= s[i] && f <= s[j]);
        passes.push({ from: i, to: j, at: points[Math.round((i + j) / 2)], front });
    }
    return passes;
}

/**
 * The solved rope as a `RopePath` to draw and check: smooth curves through its points, with a stretch marked over
 * where it passes over at each crossing (long enough to cover the strand underneath, more so where they cross at
 * a shallow angle), and, round a bar seen side on, where it passes in front of the bar.
 */
export function ropePathOf(rope: PinnedRope, shape: RopeShape, bar?: Bar): RopePath {
    const { points, s } = shape;
    const last = points.length - 1;
    const runs: [number, number][] = [];
    for (const pass of barPasses(rope, shape, bar)) {
        if (!pass.front) continue;
        const i0 = Math.max(
            0,
            s.findLastIndex((v) => v <= s[pass.from] - PAST_BAR),
        );
        const found = s.findIndex((v) => v >= s[pass.to] + PAST_BAR);
        runs.push([i0, found < 0 ? last : found]);
    }
    for (const c of ropeCrossings(rope, shape)) {
        if (c.over === null) continue;
        const at = c.s[c.over];
        const other = c.s[1 - c.over];
        const dir = (sAt: number) => {
            const i = Math.min(
                s.findIndex((v) => v > sAt),
                last,
            );
            return points[i].sub(points[i - 1]).unit();
        };
        const sin = Math.abs(dir(at).cross(dir(other)));
        const half = Math.min(4, 0.75 + 0.6 / Math.max(sin, 0.15));
        const i0 = Math.max(
            0,
            s.findLastIndex((v) => v <= at - half),
        );
        const found = s.findIndex((v) => v >= at + half);
        runs.push([i0, found < 0 ? last : found]);
    }
    runs.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const r of runs)
        if (merged.length && r[0] <= merged[merged.length - 1][1])
            merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], r[1]);
        else merged.push([...r]);

    const path: RopePath = [];
    let i = 0;
    for (const [a, b] of merged) {
        if (a > i) path.push(plain(smoothThrough(points, i, a, i === 0)));
        path.push(overSegment(smoothThrough(points, a, b, a === 0)));
        i = b;
    }
    if (i < last) path.push(plain(smoothThrough(points, i, last, i === 0)));
    return path;
}

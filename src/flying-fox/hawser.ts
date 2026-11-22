import { G } from "@/lib/constants";
import { maxAbs, solveLinear } from "@/lib/numeric/linear";
import { bisect } from "@/lib/numeric/roots";
import { Vector2 } from "@/lib/vector2";

/**
 * A hawser hanging between two supports, as an elastic catenary (Irvine, "Cable Structures", 1981), with or without a
 * load hanging from one point on it. Coordinates are in the hawser's vertical plane: x along the span, y up.
 */

/** A hawser between its supports: its length unstretched, its weight per metre (N/m) and its stiffness EA (N). */
export type Hawser = { from: Vector2; to: Vector2; length: number; weight: number; ea: number };

/** A load hanging on the hawser at `x` along the span (a trolley and rider, or a test load), its weight in newtons. */
export type Load = { x: number; weight: number };

/** How a hawser hangs: points along it, where the load hangs, and the tension at each end. */
export type Shape = {
    points: Vector2[];
    /** How far along the unstretched hawser each point is. */
    s: number[];
    /** Where the load hangs, when there is one, and how far along the unstretched hawser. */
    load?: Vector2;
    loadS?: number;
    /** The horizontal part of the tension, the same all along. */
    horizontal: number;
    /** The tension at each end, as the pull the hawser puts on that support. */
    pull: { from: Vector2; to: Vector2 };
};

/** A hawser's weight per metre: 11 mm galvanised 6 × 19 wire rope, about 0.42 kg/m. */
export const WIRE_WEIGHT = 0.42 * G;
/**
 * Its stiffness: a metallic area of about 0.4 d² (48 mm²) at a rope modulus of about 100 GPa. Wire rope stretches more
 * than solid steel as its strands bed in, so this is an estimate.
 */
export const WIRE_EA = 100e9 * 0.4 * 0.011 ** 2;

/**
 * Where a piece of hawser `l` long ends up relative to its start, when the tension's vertical part runs from `va` at its
 * start to `va + w l` at its end (Irvine's elastic catenary).
 */
function piece(h: number, va: number, l: number, w: number, ea: number): Vector2 {
    const vb = va + w * l;
    const x = (h * l) / ea + (h / w) * (Math.asinh(vb / h) - Math.asinh(va / h));
    const y = (vb * vb - va * va) / (2 * ea * w) + (Math.hypot(h, vb) - Math.hypot(h, va)) / w;
    return new Vector2(x, y);
}

/**
 * Where a point `s` along the unstretched hawser is, given the tension's horizontal part `h`, its vertical part `v0` at
 * the start (negative: heading down), and the load `weight` at `sLoad` along it.
 */
function at(hw: Hawser, h: number, v0: number, s: number, sLoad: number, weight: number): Vector2 {
    const { weight: w, ea } = hw;
    if (s <= sLoad) return hw.from.add(piece(h, v0, s, w, ea));
    const before = piece(h, v0, sLoad, w, ea);
    const after = piece(h, v0 + w * sLoad + weight, s - sLoad, w, ea);
    return hw.from.add(before).add(after);
}

/**
 * How `hawser` hangs with `load` on it (or none): the tension's horizontal and starting vertical parts, and where along
 * it the load sits, found by Newton's method so its end lands on the far support and the load at its `x`.
 */
export function hang(hawser: Hawser, load?: Load, points = 400): Shape {
    const { from, to, length: L, weight: w } = hawser;
    const W = load?.weight ?? 0;
    const span = to.x - from.x;
    const chord = to.sub(from).len();
    // A start from the parabola with the same extra length.
    const sag0 = Math.sqrt((3 * span * Math.max(L - chord, 1e-4 * span)) / 8);
    const h0 = ((w * L * span) / 8 + (W * span) / 4) / sag0;
    const v00 = (h0 * (to.y - from.y)) / span - (w * L + W) / 2;
    const s0 = load ? L * ((load.x - from.x) / span) : L;

    // The unknowns: the tension's horizontal and starting vertical parts, and (with a load) how far along it hangs.
    const residual = ([h, v0, sLoad = L]: number[]) => {
        const end = at(hawser, h, v0, L, sLoad, W).sub(to);
        const r = [end.x, end.y];
        if (load) r.push(at(hawser, h, v0, sLoad, sLoad, W).x - load.x);
        return r;
    };
    let u = load ? [h0, v00, s0] : [h0, v00];
    let r = residual(u);
    for (let k = 0; k < 100 && maxAbs(r) > 1e-10; k++) {
        const J = r.map(() => u.map(() => 0));
        u.forEach((_, j) => {
            const d = 1e-7 * Math.max(1, Math.abs(u[j]));
            const up = residual(u.map((x, i) => (i === j ? x + d : x)));
            const down = residual(u.map((x, i) => (i === j ? x - d : x)));
            for (let i = 0; i < r.length; i++) J[i][j] = (up[i] - down[i]) / (2 * d);
        });
        const step = solveLinear(
            J,
            r.map((x) => -x),
        );
        if (!step) break;
        // Back off any step that makes things worse, or takes the horizontal tension below zero.
        let t = 1;
        for (; t > 1e-4; t /= 2) {
            const next = u.map((x, i) => x + t * step[i]);
            if (next[0] <= 0) continue;
            const rn = residual(next);
            if (maxAbs(rn) < maxAbs(r)) {
                u = next;
                r = rn;
                break;
            }
        }
        if (t <= 1e-4) break;
    }
    const [h, v0] = u;
    const sLoad = load ? u[2] : L;
    const s = Array.from({ length: points + 1 }, (_, i) => (L * i) / points);
    if (load) {
        s.push(sLoad);
        s.sort((a, b) => a - b);
    }
    const vEnd = v0 + w * L + W;
    return {
        points: s.map((si) => at(hawser, h, v0, si, sLoad, W)),
        s,
        load: load ? at(hawser, h, v0, sLoad, sLoad, W) : undefined,
        loadS: load ? sLoad : undefined,
        horizontal: h,
        pull: { from: new Vector2(h, v0), to: new Vector2(-h, -vEnd) },
    };
}

/** How far a hawser hangs below the straight line between its supports at `x`. */
export function sagAt(shape: Shape, from: Vector2, to: Vector2, x: number): number {
    const line = from.y + ((to.y - from.y) * (x - from.x)) / (to.x - from.x);
    return line - heightAt(shape, x);
}

/** A hawser's height at `x` along the span. */
export function heightAt(shape: Shape, x: number): number {
    const p = shape.points;
    let i = 1;
    while (i < p.length - 1 && p[i].x < x) i++;
    const a = p[i - 1];
    const b = p[i];
    return b.x === a.x ? b.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
}

/**
 * The unstretched length that makes a hawser sag `sag` at mid-span with `test` hanging there: how it's tensioned, by
 * tightening it until the test load at the middle hangs that far below the line between the supports (section 5.5.3).
 */
export function lengthForSag(rig: Omit<Hawser, "length">, test: number, sag: number): number {
    const { from, to } = rig;
    const mid = (from.x + to.x) / 2;
    const chord = to.sub(from).len();
    const sagWith = (length: number) => {
        const shape = hang({ ...rig, length }, { x: mid, weight: test }, 40);
        return sagAt(shape, from, to, mid);
    };
    const [a, b] = bisect((length) => sagWith(length) < sag, chord * 0.98, chord * 1.1, 60);
    return (a + b) / 2;
}

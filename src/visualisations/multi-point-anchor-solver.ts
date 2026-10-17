import { solveLinear } from "@/lib/numeric";
import { vec2, Vector2 } from "@/lib/vector2";

/**
 * A multi-point anchor seen face on: two or three anchors in a vertical plane, joined by slings to a master
 * point that the load hangs from. The load pulls on the master point in a set direction, swung from straight
 * down by `direction` (positive towards +x).
 *
 * Two ways of rigging the same anchors:
 * - pre-equalised: each anchor has its own leg to the master point, tied off so every leg is just snug with
 *   the master point at `tiedAt`. The legs' lengths are then fixed.
 * - sliding: one length of sling, its strands running freely through the master point (and, with three
 *   anchors, through a karabiner on the middle anchor), so every strand carries the same tension. It's the
 *   length that reaches `tiedAt` too. With two anchors it's a sliding X, one strand to each; with three, it's
 *   tied off at the outer anchors and runs through the middle one, so that anchor has two strands.
 *
 * The slings stretch a little (`SLING_STIFFNESS`), which settles how a pre-equalised rig of three legs shares
 * its load. The master point settles where its energy is lowest: the load's, plus each sling's stretch.
 */

export type Rig = "pre-equalised" | "sliding";

export type Setup = {
    /** Two or three, in order from left to right. */
    anchors: Vector2[];
    /** Where the master point sits with the rig just snug and unloaded. */
    tiedAt: Vector2;
    /** The load on the master point (N). */
    load: number;
    /** The load's swing from straight down (radians), positive towards +x. */
    direction: number;
    rig: Rig;
};

/** The slings' stiffness, EA: the pull that would stretch them by their own length (N). About 10% at 10 kN. */
export const SLING_STIFFNESS = 100e3;

export type Leg = {
    anchor: Vector2;
    /** How many strands run from the master point to this anchor. */
    strands: number;
    /** Each strand's tension (N). */
    tension: number;
    /** The leg's pull on the anchor: all its strands', towards the master point. */
    force: Vector2;
};

export type Settled = {
    master: Vector2;
    tiedAt: Vector2;
    /** The load's pull on the master point. */
    load: Vector2;
    legs: Leg[];
};

export type AnchorResult = { kind: "settled"; s: Settled } | { kind: "none"; reason: string };

/** How many strands of a sliding rig run to each anchor, left to right. */
export const strandsFor = (count: number) => (count === 3 ? [1, 2, 1] : [1, 1]);

/**
 * The page's layout: `count` anchors left to right, `gaps[i]` across from each to the next, centred on x = 0.
 * Anchor A is at y = 0 and the others `heights` above it (B's first). The rig is tied with the master point `drop` below the lowest
 * anchor, out from the anchors' centre in the direction `tieDirection` (radians from straight down, like the load).
 */
export function layoutFor(p: {
    count: 2 | 3;
    gaps: number[];
    heights: number[];
    drop: number;
    tieDirection: number;
}): Pick<Setup, "anchors" | "tiedAt"> {
    const xs = [0];
    for (let i = 1; i < p.count; i++) xs.push(xs[i - 1] + p.gaps[i - 1]);
    const anchors = xs.map((x, i) =>
        vec2(x - xs.at(-1)! / 2, i === 0 ? 0 : (p.heights[i - 1] ?? 0)),
    );
    const centre = anchors.reduce((sum, a) => sum.add(a), Vector2.ZERO).scale(1 / p.count);
    const y = Math.min(...anchors.map((a) => a.y)) - p.drop;
    return { anchors, tiedAt: vec2(centre.x + (centre.y - y) * Math.tan(p.tieDirection), y) };
}

/** The load's pull per newton: straight down, swung by `direction` towards +x. */
export const loadDirection = (direction: number) => vec2(Math.sin(direction), -Math.cos(direction));

/**
 * One sling: strands from the master point to anchors, `strands[i]` of them to `anchors[i]`, all at one tension.
 * Unstretched, together they're `length` long.
 */
type Sling = { anchors: Vector2[]; strands: number[]; length: number };

/** The slings of a rig, each unstretched and just snug with the master point at `tiedAt`. */
export function slingsFor(s: Pick<Setup, "anchors" | "tiedAt" | "rig">): Sling[] {
    if (s.rig === "pre-equalised") {
        return s.anchors.map((a) => ({
            anchors: [a],
            strands: [1],
            length: a.distanceTo(s.tiedAt),
        }));
    }
    const strands = strandsFor(s.anchors.length);
    return [
        {
            anchors: s.anchors,
            strands,
            length: s.anchors.reduce((sum, a, i) => sum + strands[i] * a.distanceTo(s.tiedAt), 0),
        },
    ];
}

/** The sling's stretched length with the master point at m. */
const lengthAt = (sl: Sling, m: Vector2) =>
    sl.anchors.reduce((sum, a, i) => sum + sl.strands[i] * a.distanceTo(m), 0);

export function solveAnchor(s: Setup): AnchorResult {
    if (s.anchors.length < 2) return { kind: "none", reason: "Place at least two anchors." };
    if (s.load <= 0) return { kind: "none", reason: "Give the load some mass." };
    if (s.anchors.some((a) => a.distanceTo(s.tiedAt) < 1e-6)) {
        return { kind: "none", reason: "The master point can't sit on an anchor." };
    }
    const F = loadDirection(s.direction).scale(s.load);
    const slings = slingsFor(s);
    const k = (sl: Sling) => SLING_STIFFNESS / sl.length;
    const stretch = (sl: Sling, m: Vector2) => Math.max(0, lengthAt(sl, m) - sl.length);

    // The energy: the load's (it pulls with a steady force, like a weight), plus each sling's stretch. It's
    // convex in the master point's position, so Newton's method from where the rig was tied finds its one minimum.
    const energy = (m: Vector2) =>
        -F.dot(m) + slings.reduce((sum, sl) => sum + (k(sl) / 2) * stretch(sl, m) ** 2, 0);
    /** The energy's gradient and Hessian at m. */
    const derivatives = (m: Vector2) => {
        const g = [-F.x, -F.y];
        const H = [
            [0, 0],
            [0, 0],
        ];
        for (const sl of slings) {
            const e = stretch(sl, m);
            if (e <= 0) continue;
            // The sling's length grows along each strand, away from its anchor, and curves as the strands turn.
            let dx = 0;
            let dy = 0;
            const curve = [
                [0, 0],
                [0, 0],
            ];
            sl.anchors.forEach((a, i) => {
                const r = m.sub(a);
                const d = r.len();
                const u = r.scale(1 / d);
                const n = sl.strands[i];
                dx += n * u.x;
                dy += n * u.y;
                curve[0][0] += (n * (1 - u.x * u.x)) / d;
                curve[0][1] += (n * -u.x * u.y) / d;
                curve[1][1] += (n * (1 - u.y * u.y)) / d;
            });
            curve[1][0] = curve[0][1];
            const ks = k(sl);
            g[0] += ks * e * dx;
            g[1] += ks * e * dy;
            const grad = [dx, dy];
            for (let i = 0; i < 2; i++)
                for (let j = 0; j < 2; j++) H[i][j] += ks * (grad[i] * grad[j] + e * curve[i][j]);
        }
        return { g, H };
    };

    let m = s.tiedAt;
    let e = energy(m);
    const scale = Math.max(...slings.map(k));
    for (let iter = 0; iter < 100; iter++) {
        const { g, H } = derivatives(m);
        if (Math.hypot(g[0], g[1]) < 1e-9 * s.load) break;
        // A Newton step, damped while the Hessian is singular (no sling taut yet, or only one), then halved
        // until it lowers the energy.
        let damping = 1e-9 * scale;
        let step: number[] | null = null;
        while (!step && damping < 1e3 * scale) {
            step = solveLinear(
                [
                    [H[0][0] + damping, H[0][1]],
                    [H[1][0], H[1][1] + damping],
                ],
                [-g[0], -g[1]],
            );
            damping *= 100;
        }
        if (!step)
            return { kind: "none", reason: "The master point couldn't find where it settles." };
        let t = 1;
        let next = m.add(vec2(step[0], step[1]));
        let eNext = energy(next);
        while (eNext > e && t > 1e-12) {
            t /= 2;
            next = m.add(vec2(step[0] * t, step[1] * t));
            eNext = energy(next);
        }
        if (eNext > e) break;
        m = next;
        e = eNext;
    }
    const { g } = derivatives(m);
    if (Math.hypot(g[0], g[1]) > 1e-6 * s.load) {
        return { kind: "none", reason: "The master point couldn't find where it settles." };
    }

    const legs: Leg[] = slings.flatMap((sl) => {
        const tension = k(sl) * stretch(sl, m);
        return sl.anchors.map((a, i) => ({
            anchor: a,
            strands: sl.strands[i],
            tension,
            force: m
                .sub(a)
                .unit()
                .scale(sl.strands[i] * tension),
        }));
    });
    return { kind: "settled", s: { master: m, tiedAt: s.tiedAt, load: F, legs } };
}

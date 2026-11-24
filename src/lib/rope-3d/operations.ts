import type { Vector3 } from "@/lib/vector3";

import { along, curveThrough, type LockedEnd } from "./curve";
import {
    arcLengths,
    pointAt,
    pointsOf,
    respaceFree,
    segmentSpan,
    spacingOf,
    type Rope3,
    type RopeSetup,
} from "./rope";
import { RopeSim } from "./sim";

/**
 * The edits the 3D knot editor makes, each a stepper: made from the rope as it is, then stepped a little at a time (a
 * few steps a frame in the editor, so you see it happen), its rope read at any point, until it's done or stopped.
 */

/** The rope in play: a run of segments, `from` to `to`, and the one whose centre is the handle that's moved. */
export type Play = { from: number; to: number; handle: number };

/**
 * Where the rope in play is: its first and last points (`a`, `b`), and the locked points either side of it (`lo`,
 * `hi`): the fixed points it joins, or the rope's own end where the rope in play runs to it.
 */
export function stretchOf(rope: Rope3, play: Play) {
    const a = rope.seg.findIndex((s) => s >= play.from);
    let b = rope.seg.length - 1;
    while (b > 0 && rope.seg[b] > play.to) b--;
    return { a, b, lo: Math.max(0, a - 1), hi: Math.min(rope.points.length - 1, b + 1) };
}

/** The locked ends of the rope in play: where it joins the fixed rope (or the rope's end), and the way it runs there. */
export function lockedEnds(rope: Rope3, play: Play): [LockedEnd, LockedEnd] {
    const { lo, hi } = stretchOf(rope, play);
    const p = rope.points;
    const n = p.length;
    return [
        { at: p[lo], dir: (lo > 0 ? p[lo].sub(p[lo - 1]) : p[lo + 1].sub(p[lo])).unit() },
        { at: p[hi], dir: (hi < n - 1 ? p[hi + 1].sub(p[hi]) : p[hi].sub(p[hi - 1])).unit() },
    ];
}

/** Whether each point is in play. */
export const inPlayMask = (rope: Rope3, play: { from: number; to: number }) =>
    rope.seg.map((s) => s >= play.from && s <= play.to);

/** Each piece (from a point to the next) whose two points are both among `segments`. */
const piecesWithin = (rope: Rope3, segments: ReadonlySet<number>) =>
    rope.seg.slice(1).map((s, i) => segments.has(s) && segments.has(rope.seg[i]));

/** The longest `v` may be, as a vector the same way. */
const atMost = (v: Vector3, length: number) => {
    const l = v.len();
    return l > length ? v.scale(length / l) : v;
};

/**
 * Moving the handle. The rope in play lies along one smooth curve from one locked end, through the handle, to the other,
 * leaving and joining the fixed rope along its own direction (`curveThrough`), and gets as long as the curve. Each
 * segment in play keeps its share of the rope on its side of the handle. A step moves the curve's handle (where the
 * handle's sent) a little towards where it's wanted, moves the rope in play a little towards the curve, and lets it
 * settle against the fixed rope and the bars, so it goes round them rather than through. Where the handle's sent is
 * kept within a diameter and a half of where it is, so a move that would cut through rope stops against it.
 */
export class MoveOp {
    private readonly setup: RopeSetup;
    private readonly spacing: number;
    private readonly start: LockedEnd;
    private readonly end: LockedEnd;
    /** The fixed rope before the stretch (up to and with its locked point) and after it (from its locked point on). */
    private readonly head: Rope3;
    private readonly tail: Rope3;
    /** Where each segment in play starts along the stretch, as a fraction of it, in order. */
    private readonly starts: { seg: number; u: number }[];
    /** How far along the stretch the handle is, as a fraction. */
    private readonly uHandle: number;
    /** The segments of the stretch's ends, the locked points. */
    private readonly endSegs: [number, number];
    private sim!: RopeSim;
    private seg!: number[];
    /** How many pieces the stretch has, from locked point to locked point. */
    private m = 0;
    /** Where the handle's sent: the curve passes through it, and the rope follows. */
    private sent: Vector3;

    constructor(rope: Rope3, setup: RopeSetup, play: Play) {
        this.setup = setup;
        this.spacing = spacingOf(rope.points) || setup.diameter / 4;
        const { lo, hi } = stretchOf(rope, play);
        const p = rope.points;
        [this.start, this.end] = lockedEnds(rope, play);
        this.head = { points: p.slice(0, lo + 1), seg: rope.seg.slice(0, lo + 1) };
        this.tail = { points: p.slice(hi), seg: rope.seg.slice(hi) };
        this.endSegs = [rope.seg[lo], rope.seg[hi]];
        // The segments' places along the stretch, from the rope as it is.
        const stretch = { points: p.slice(lo, hi + 1), seg: rope.seg.slice(lo, hi + 1) };
        const arc = arcLengths(stretch.points);
        const total = arc.at(-1)! || 1;
        this.starts = [];
        for (let k = play.from; k <= play.to; k++) {
            this.starts.push({
                seg: k,
                u: k === play.from ? 0 : segmentSpan(stretch, k, arc)[0] / total,
            });
        }
        // The handle's the middle of its segment's points (`segmentMiddle`), as far along the stretch as it is.
        const [h0, h1] = pointsOf(rope, play.handle);
        const middle = (h0 + h1) / 2 - lo;
        const k = Math.floor(middle);
        const sMiddle = arc[k] + (k + 1 < arc.length ? (arc[k + 1] - arc[k]) * (middle - k) : 0);
        this.uHandle = Math.min(0.98, Math.max(0.02, sMiddle / total));
        this.lay(
            stretch.points,
            Math.max(this.starts.length + 1, Math.round(arc.at(-1)! / this.spacing)),
        );
        this.sent = this.handle();
    }

    /**
     * The stretch laid out again as `m` pieces along `points` (its locked ends first and last): even on each side of the
     * handle, which is `split` along them (the handle's share of the way along unless given).
     */
    private lay(points: readonly Vector3[], m: number, split?: number) {
        const arc = arcLengths(points);
        const total = arc.at(-1)!;
        const at = split ?? this.uHandle * total;
        const free = Array.from({ length: m - 1 }, (_, k) => {
            const u = (k + 1) / m;
            const s =
                u <= this.uHandle
                    ? (at * u) / this.uHandle
                    : at + ((total - at) * (u - this.uHandle)) / (1 - this.uHandle);
            return pointAt(points, arc, s);
        });
        const freeSeg = free.map((_, k) => {
            const u = (k + 1) / m;
            let seg = this.starts[0].seg;
            for (const s of this.starts) if (s.u <= u) seg = s.seg;
            return seg;
        });
        this.fillEvery(freeSeg);
        this.m = m;
        this.seg = [...this.head.seg, ...freeSeg, ...this.tail.seg];
        const all = [...this.head.points, ...free, ...this.tail.points];
        const lo = this.head.points.length - 1;
        this.sim = new RopeSim(
            all,
            this.setup,
            all.map((_, i) => i <= lo || i >= lo + m),
        );
        this.sim.refreshEvery = 1;
        // The curve gives the rope in play its shape: stiffness would only draw its bends in, short of the handle.
        this.sim.stiffness = 0;
    }

    /** Gives every segment in play at least one of the free points, shifting the boundaries along to make room. */
    private fillEvery(freeSeg: number[]) {
        const segs = this.starts.map((s) => s.seg);
        for (let pass = 0; pass < segs.length; pass++)
            for (let k = 0; k < segs.length; k++) {
                if (freeSeg.includes(segs[k])) continue;
                // Take the nearest point of the segment before or after it.
                const after = freeSeg.findIndex((s) => s > segs[k]);
                const before = freeSeg.findLastIndex((s) => s < segs[k]);
                const i =
                    after >= 0 && (before < 0 || after < freeSeg.length - 1 - before)
                        ? after
                        : before;
                if (i >= 0) freeSeg[i] = segs[k];
            }
    }

    /** The stretch, from locked point to locked point, as it is now. */
    private stretchNow(): Vector3[] {
        const lo = this.head.points.length - 1;
        return Array.from({ length: this.m + 1 }, (_, k) => this.sim.point(lo + k));
    }

    /** Where the handle (its segment's centre) is now: its share of the way along the stretch's points. */
    handle(): Vector3 {
        return this.handleAlong(this.stretchNow()).at;
    }

    /** The handle on the stretch's points, and how far along them it is. */
    private handleAlong(points: Vector3[]): { at: Vector3; s: number } {
        const arc = arcLengths(points);
        const index = this.uHandle * this.m;
        const k = Math.min(this.m - 1, Math.floor(index));
        const s = arc[k] + (arc[k + 1] - arc[k]) * (index - k);
        return { at: pointAt(points, arc, s), s };
    }

    /**
     * One step towards the handle being at `goal`: where it's sent moves at most a sixth of a diameter, each point of the
     * rope in play halfway to the curve but at most a quarter of a diameter (so none can jump through rope a diameter
     * thick), then it all settles. Says how far where it's sent still is from the goal, and whether it's settled:
     * neither it nor the handle moved more than a tenth of a millimetre this step.
     */
    step(goal: Vector3): { left: number; settled: boolean } {
        const d = this.setup.diameter;
        const now = this.handle();
        let sent = this.sent.add(atMost(goal.sub(this.sent), d / 6));
        const lead = sent.sub(now);
        if (lead.len() > 1.5 * d) sent = now.add(atMost(lead, 1.5 * d));
        const sentMoved = sent.distanceTo(this.sent);
        this.sent = sent;
        const { before, after } = curveThrough(this.start, sent, this.end);
        const length = before.length + after.length;
        const want = length / this.spacing;
        if (Math.abs(want - this.m) > 0.75) {
            const points = this.stretchNow();
            const { s } = this.handleAlong(points);
            this.lay(points, Math.max(this.starts.length + 1, Math.round(want)), s);
        }
        const lo = this.head.points.length - 1;
        const onCurve = (u: number) =>
            u <= this.uHandle
                ? along(before, u / this.uHandle)
                : along(after, (u - this.uHandle) / (1 - this.uHandle));
        for (let k = 1; k < this.m; k++) {
            const i = lo + k;
            const p = this.sim.point(i);
            this.sim.set(
                i,
                p.add(
                    atMost(
                        onCurve(k / this.m)
                            .sub(p)
                            .scale(0.5),
                        d / 4,
                    ),
                ),
            );
        }
        // Each piece as long as the curve's spacing on its side of the handle: the two sides keep their shares of the
        // points, so they're spaced differently as one side grows more than the other.
        const [spaceBefore, spaceAfter] = [
            before.length / (this.uHandle * this.m),
            after.length / ((1 - this.uHandle) * this.m),
        ];
        for (let k = 0; k < this.m; k++)
            this.sim.rest[lo + k] = (k + 0.5) / this.m < this.uHandle ? spaceBefore : spaceAfter;
        this.sim.step();
        const moved = this.handle().distanceTo(now);
        return { left: goal.distanceTo(sent), settled: sentMoved < 1e-4 && moved < 1e-4 };
    }

    rope(): Rope3 {
        return { points: this.sim.points(), seg: [...this.seg] };
    }

    /** The locked ends, for the view to mark. */
    locked(): [LockedEnd, LockedEnd] {
        return [this.start, this.end];
    }

    /** The segments of the locked points. */
    lockedSegments(): [number, number] {
        return this.endSegs;
    }
}

/** A stepper that runs until it's done: tightening or smoothing. */
export type Stepper = {
    /** A step; true once it's done. */
    step(): boolean;
    /** The rope as it is now. */
    rope(): Rope3;
    /** The rope once it's finished (or stopped): laid out again at the rope's spacing where it's been drawn up. */
    result(): Rope3;
};

/**
 * Drawing rope up: the pieces among `shrinking` (pieces between neighbouring points) get a little shorter each step,
 * while everything not `fixed` settles, until it's jammed (the shrinking rope gets no shorter) or it's run `maxSteps`.
 */
class TightenOp implements Stepper {
    private readonly sim: RopeSim;
    private readonly seg: number[];
    private readonly kept: boolean[];
    private readonly spacing: number;
    private readonly shrinking: boolean[];
    private steps = 0;
    private last: number;

    constructor(
        rope: Rope3,
        setup: RopeSetup,
        fixed: boolean[],
        shrinking: boolean[],
        private readonly maxSteps = 3000,
    ) {
        this.sim = new RopeSim(rope.points, setup, fixed);
        this.sim.shrink = 2e-3;
        this.sim.shrinking = Uint8Array.from(shrinking, (s) => (s ? 1 : 0));
        this.seg = rope.seg;
        this.kept = fixed;
        this.shrinking = shrinking;
        this.spacing = spacingOf(rope.points) || setup.diameter / 4;
        this.last = this.length();
    }

    /** How long the shrinking rope is now. */
    private length() {
        const p = this.sim.points();
        return this.shrinking.reduce((sum, s, i) => (s ? sum + p[i].distanceTo(p[i + 1]) : sum), 0);
    }

    step(): boolean {
        this.sim.step();
        this.steps++;
        if (this.steps % 25 === 0) {
            const now = this.length();
            const jammed = this.last - now < 2e-4;
            this.last = now;
            if (jammed) return true;
        }
        return this.steps >= this.maxSteps;
    }

    rope(): Rope3 {
        return { points: this.sim.points(), seg: this.seg };
    }

    result(): Rope3 {
        return respaceFree(this.rope(), this.kept, this.spacing);
    }
}

/**
 * Tightening the rope in play: everything else is held (so the ends of the rope in play are locked), and every segment in
 * play shortens by the same proportion, a little each step, until it's jammed.
 */
export function tightenInPlay(
    rope: Rope3,
    setup: RopeSetup,
    play: { from: number; to: number },
): Stepper {
    const inPlay = inPlayMask(rope, play);
    const segments = new Set(rope.seg.filter((_, i) => inPlay[i]));
    return new TightenOp(
        rope,
        setup,
        inPlay.map((p) => !p),
        piecesWithin(rope, segments),
    );
}

/**
 * Tightening the whole knot: the `held` segments stay where they are (the rope's ends and the top of the loop), the
 * `knot` segments shorten together, and the rest slides freely. A free end that isn't held is drawn into the knot.
 */
export function tightenWholeKnot(
    rope: Rope3,
    setup: RopeSetup,
    held: number[],
    knot: number[],
): Stepper {
    const isHeld = new Set(held);
    return new TightenOp(
        rope,
        setup,
        rope.seg.map((s) => isHeld.has(s)),
        piecesWithin(rope, new Set(knot.filter((k) => !isHeld.has(k)))),
    );
}

/** Smoothing the rope in play: it settles as a stiffer rope for `steps` steps, so a sharp bend eases out. */
export function smoothInPlay(
    rope: Rope3,
    setup: RopeSetup,
    play: { from: number; to: number },
    steps = 400,
): Stepper {
    const sim = new RopeSim(
        rope.points,
        setup,
        inPlayMask(rope, play).map((p) => !p),
    );
    sim.stiffness = Math.max(0.2, setup.stiffness);
    let done = 0;
    const now = () => ({ points: sim.points(), seg: rope.seg });
    return {
        step: () => {
            sim.step();
            return ++done >= steps;
        },
        rope: now,
        result: now,
    };
}

/** Runs a stepper to the end. */
export function runToEnd(stepper: Stepper): Rope3 {
    while (!stepper.step());
    return stepper.result();
}

/** How many steps in a row a move must be settled to be done. */
export const SETTLED_STEPS = 15;

/**
 * The handle moved to `goal`, step by step, until it's settled there or against something in its way, or `maxSteps`
 * have run.
 */
export function moveHandle(
    rope: Rope3,
    setup: RopeSetup,
    play: Play,
    goal: Vector3,
    maxSteps = 3000,
): Rope3 {
    const op = new MoveOp(rope, setup, play);
    let settled = 0;
    for (let s = 0; s < maxSteps && settled < SETTLED_STEPS; s++)
        settled = op.step(goal).settled ? settled + 1 : 0;
    return op.rope();
}

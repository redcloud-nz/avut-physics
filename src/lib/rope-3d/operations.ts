import type { Vector3 } from "@/lib/vector3";

import { along, curveThrough, type LockedEnd, type Sampled } from "./curve";
import {
    arcLengths,
    pointAt,
    pointsOf,
    respaceFree,
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
 * Moving the handle. Only the handle's segment changes length: the other segments in play keep theirs, as rope worked
 * by hand feeds slack into one place and leaves the rest of the dressed knot as it was. The rope in play is wanted in
 * its shape as the handle was chosen, moved by as much as a smooth curve from one locked end, through the handle, to the
 * other (`curveThrough`) moves from where it was then (`wanted`). The segments either side of the handle's lie along
 * that, measured from the locked ends, and the handle's segment takes whatever's left on each side of the handle. A step
 * moves where the handle's sent a little towards the goal, moves the rope in play a little towards where it's wanted,
 * and lets it settle against the fixed rope and the bars, so it goes round them rather than through. Where the handle's
 * sent is kept within a diameter and a half of where it is, so a move that would cut through rope stops against it.
 */
/** The point `s` along a sampled curve (clamped to its ends). */
const on = (curve: Sampled, s: number) => along(curve, Math.min(1, Math.max(0, s / curve.length)));

export class MoveOp {
    private readonly setup: RopeSetup;
    private readonly spacing: number;
    private readonly start: LockedEnd;
    private readonly end: LockedEnd;
    /** The fixed rope before the stretch (up to and with its locked point) and after it (from its locked point on). */
    private readonly head: Rope3;
    private readonly tail: Rope3;
    /** The segments of the stretch's ends, the locked points. */
    private readonly endSegs: [number, number];
    private readonly handleSeg: number;
    /**
     * The rope in play before the handle's segment, from the locked point to the point before the handle's segment's
     * first: its points' segments, its pieces' lengths (kept), and how far along it each point is.
     */
    private readonly before: { seg: number[]; rest: number[]; arc: number[] };
    /** The same after the handle's segment, from the point after its last to the locked point; `arc` measured from the end. */
    private readonly after: { seg: number[]; rest: number[]; arc: number[] };
    /** The handle segment's points' segments: its own, except for a locked point that's in it at the rope's end. */
    private spanEnds: [number, number];
    /** How many pieces the handle's segment has each side of the handle. */
    private c = 1;
    private sim!: RopeSim;
    private seg!: number[];
    /** Where the handle's sent: the wanted shape passes through it, and the rope follows. */
    private sent: Vector3;
    /** The stretch's shape as it was chosen, on each side of the handle. */
    private readonly shape: Halves;
    /** The curve through the handle where it was chosen: the rope moves as the curve moves away from this. */
    private readonly first: Halves;
    /** Where the other segments' points were wanted last step, and where the handle was sent then. */
    private lastWanted: { before: Vector3[]; after: Vector3[] } | null = null;
    private sentBefore!: Vector3;

    constructor(rope: Rope3, setup: RopeSetup, play: Play) {
        this.setup = setup;
        this.spacing = spacingOf(rope.points) || setup.diameter / 4;
        this.handleSeg = play.handle;
        const { lo, hi } = stretchOf(rope, play);
        const p = rope.points;
        [this.start, this.end] = lockedEnds(rope, play);
        this.head = { points: p.slice(0, lo + 1), seg: rope.seg.slice(0, lo + 1) };
        this.tail = { points: p.slice(hi), seg: rope.seg.slice(hi) };
        this.endSegs = [rope.seg[lo], rope.seg[hi]];
        // The handle's segment, with the points either side of it: the run that changes length.
        const [h0, h1] = pointsOf(rope, play.handle);
        const [s0, s1] = [Math.max(lo, h0 - 1), Math.min(hi, h1 + 1)];
        this.spanEnds = [rope.seg[s0], rope.seg[s1]];
        const run = (from: number, to: number) => {
            const points = p.slice(from, to + 1);
            return {
                seg: rope.seg.slice(from, to + 1),
                rest: points.slice(1).map((q, i) => q.distanceTo(points[i])),
                arc: arcLengths(points),
            };
        };
        this.before = run(lo, s0);
        const after = run(s1, hi);
        const total = after.arc.at(-1)!;
        this.after = { ...after, arc: after.arc.map((s) => total - s) };
        // The handle's segment laid out again evenly each side of its middle, which stays where it is.
        const span = p.slice(s0, s1 + 1);
        const spanArc = arcLengths(span);
        const middle = (h0 + h1) / 2 - s0;
        const k = Math.floor(middle);
        const split =
            spanArc[k] + (k + 1 < span.length ? (spanArc[k + 1] - spanArc[k]) * (middle - k) : 0);
        this.layHandle(
            span,
            split,
            Math.max(1, Math.round(spanArc.at(-1)! / (2 * this.spacing))),
            p.slice(0, lo + 1),
            p.slice(lo, s0 + 1),
            p.slice(s1, hi + 1),
        );
        this.sent = this.handle();
        this.sentBefore = this.sent;
        const stretch = this.stretchNow();
        const mid = this.before.rest.length + this.c;
        this.shape = {
            before: resample(along_(stretch.slice(0, mid + 1)), 2 * mid),
            after: resample(along_(stretch.slice(mid)), 2 * (stretch.length - 1 - mid)),
        };
        this.first = curveThrough(this.start, this.sent, this.end);
    }

    /**
     * The rope again, with the handle's segment laid out along `span` (from the point before it to the point after it)
     * as `c` even pieces either side of the handle, which is `split` along it. The rest of the rope is as given.
     */
    private layHandle(
        span: readonly Vector3[],
        split: number,
        c: number,
        head: readonly Vector3[],
        before: readonly Vector3[],
        after: readonly Vector3[],
    ) {
        const arc = arcLengths(span);
        const total = arc.at(-1)!;
        const inner = Array.from({ length: 2 * c - 1 }, (_, k) =>
            k < c
                ? pointAt(span, arc, (split * (k + 1)) / c)
                : pointAt(span, arc, split + ((total - split) * (k + 1 - c)) / c),
        );
        this.c = c;
        const all = [
            ...head.slice(0, -1),
            ...before,
            ...inner,
            ...after,
            ...this.tail.points.slice(1),
        ];
        const spanSeg = inner.map(() => this.handleSeg);
        this.seg = [
            ...this.head.seg.slice(0, -1),
            ...this.before.seg.slice(0, -1),
            this.spanEnds[0],
            ...spanSeg,
            this.spanEnds[1],
            ...this.after.seg.slice(1),
            ...this.tail.seg.slice(1),
        ];
        const lo = this.head.points.length - 1;
        const hi = all.length - this.tail.points.length;
        this.sim = new RopeSim(
            all,
            this.setup,
            all.map((_, i) => i <= lo || i >= hi),
        );
        this.sim.refreshEvery = 1;
        // The wanted shape gives the rope in play its shape: stiffness would only draw its bends in.
        this.sim.stiffness = 0;
        // The segments either side of the handle's keep their pieces' lengths. The handle's has no length of its own: it's
        // as long as the gap between them and the handle needs.
        const nb = this.before.rest.length;
        this.sim.free = Uint8Array.from({ length: all.length - 1 }, (_, i) =>
            i >= lo + nb && i < lo + nb + 2 * c ? 1 : 0,
        );
        this.before.rest.forEach((r, i) => (this.sim.rest[lo + i] = r));
        this.after.rest.forEach((r, i) => (this.sim.rest[lo + nb + 2 * c + i] = r));
    }

    /** Where the stretch's points are in the simulation: the locked point before it, and the one after. */
    private bounds() {
        const lo = this.head.points.length - 1;
        return { lo, hi: lo + this.before.rest.length + 2 * this.c + this.after.rest.length };
    }

    /** The stretch, from locked point to locked point, as it is now. */
    private stretchNow(): Vector3[] {
        const { lo, hi } = this.bounds();
        return Array.from({ length: hi - lo + 1 }, (_, k) => this.sim.point(lo + k));
    }

    /** Where the points of the segments either side of the handle's are wanted, for `wanted`, measured from the locked ends. */
    private wantedFixed({ before, after }: Halves): { before: Vector3[]; after: Vector3[] } {
        return {
            before: this.before.arc.map((s) => on(before, s)),
            after: this.after.arc.map((s) => on(after, after.length - s)),
        };
    }

    /** Where the handle (its segment's middle) is now. */
    handle(): Vector3 {
        return this.sim.point(this.bounds().lo + this.before.rest.length + this.c);
    }

    /**
     * Where the stretch is wanted with the handle sent to `sent`: its shape as chosen, moved by as much as the curve
     * through the handle moves from where it was chosen. So a small move makes a small change, rather than the stretch
     * taking the curve's shape the moment it's touched.
     */
    private wanted(sent: Vector3): Halves {
        const now = curveThrough(this.start, sent, this.end);
        const half = (k: keyof Halves) =>
            resample(
                (t) => along(this.shape[k], t).add(along(now[k], t)).sub(along(this.first[k], t)),
                this.shape[k].points.length - 1,
            );
        return { before: half("before"), after: half("after") };
    }

    /**
     * One step towards the handle being at `goal`: where it's sent moves at most a sixth of a diameter, each point of the
     * rope in play halfway to where it's wanted but at most a quarter of a diameter (so none can jump through rope a
     * diameter thick), then it all settles. Says how far where it's sent still is from the goal, and whether it's
     * settled: neither it nor the handle moved more than a tenth of a millimetre this step.
     */
    step(goal: Vector3): { left: number; settled: boolean } {
        const d = this.setup.diameter;
        const now = this.handle();
        let sent: Vector3 = this.sent.add(atMost(goal.sub(this.sent), d / 6));
        const lead = sent.sub(now);
        if (lead.len() > 1.5 * d) sent = now.add(atMost(lead, 1.5 * d));
        // What the handle's segment has each side of the handle: what's left once the other segments have theirs. A
        // move that would leave it less than half a point's spacing either side goes no further: the other segments
        // can't give it rope.
        const least = this.spacing / 2;
        const fixedBefore = this.before.arc.at(-1)!;
        const fixedAfter = this.after.arc[0];
        const sidesFor = ({ before, after }: Halves) => [
            before.length - fixedBefore,
            after.length - fixedAfter,
        ];
        let wanted = this.wanted(sent);
        if (Math.min(...sidesFor(wanted)) < least) {
            sent = this.sent;
            wanted = this.wanted(sent);
        }
        const sentMoved = sent.distanceTo(this.sent);
        this.sent = sent;
        const { before, after } = wanted;
        const sides = sidesFor(wanted).map((side) => Math.max(side, least));
        // The handle's segment laid out again when it's grown or shrunk by most of a piece, by its length as it is, as
        // it has no length of its own to hold it: long pieces could straddle a bar or a strand.
        const points = this.stretchNow();
        const nb0 = this.before.rest.length;
        const span = points.slice(nb0, nb0 + 2 * this.c + 1);
        const spanArc = arcLengths(span);
        const want = spanArc.at(-1)! / (2 * this.spacing);
        if (Math.abs(want - this.c) > 0.75) {
            const split = spanArc[this.c];
            this.layHandle(
                span,
                split,
                Math.max(1, Math.round(want)),
                this.head.points,
                points.slice(0, nb0 + 1),
                points.slice(nb0 + 2 * this.c),
            );
        }
        const { lo } = this.bounds();
        const nb = this.before.rest.length;
        const c = this.c;
        // The other segments move as their wanted places move, without being drawn onto them: where rope's in the
        // way, they stay where it pushed them, their own lengths, rather than stretching to reach.
        const was = this.lastWanted ?? this.wantedFixed(this.wanted(this.sentBefore));
        const is = this.wantedFixed(wanted);
        this.lastWanted = is;
        this.sentBefore = sent;
        const shift = (i: number, by: Vector3) =>
            this.sim.set(i, this.sim.point(i).add(atMost(by, d / 4)));
        for (let k = 1; k <= nb; k++) shift(lo + k, is.before[k].sub(was.before[k]));
        for (let j = 0; j < is.after.length - 1; j++)
            shift(lo + nb + 2 * c + j, is.after[j].sub(was.after[j]));
        // The handle's segment is drawn onto its wanted place, which it can reach, being as long as it needs.
        for (let k = nb + 1; k < nb + 2 * c; k++) {
            const target =
                k <= nb + c
                    ? on(before, fixedBefore + (sides[0] * (k - nb)) / c)
                    : on(after, (sides[1] * (k - nb - c)) / c);
            const p = this.sim.point(lo + k);
            this.sim.set(lo + k, p.add(atMost(target.sub(p).scale(0.5), d / 4)));
        }
        // The handle's segment's pieces as long as its share each side of the handle: not held to it, only how far apart
        // along the rope its points count as, for bends and for not passing through itself.
        for (let k = 0; k < 2 * c; k++) this.sim.rest[lo + nb + k] = sides[k < c ? 0 : 1] / c;
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

/** A polyline as a curve: the point `t` (0 to 1) of the way along it. */
const along_ = (points: readonly Vector3[]) => {
    const arc = arcLengths(points);
    const total = arc.at(-1)!;
    return (t: number) => pointAt(points, arc, t * total);
};

/** A stretch of rope in two halves, before the handle and after it, each sampled finely. */
type Halves = { before: Sampled; after: Sampled };

/** A curve given by the point `at(t)` for `t` from 0 to 1, sampled finely. */
function resample(at: (t: number) => Vector3, samples = 48): Sampled {
    const points = Array.from({ length: samples + 1 }, (_, k) => at(k / samples));
    const arc = arcLengths(points);
    return { points, arc, length: arc.at(-1)! };
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

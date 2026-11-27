import type { Vector3 } from "@/lib/vector3";

import {
    fitPinned,
    lastId,
    pinDirections,
    sampleRope,
    type PinnedRope,
    type SampledRope,
} from "./pinned";
import { arcLengths, type RopeSetup } from "./rope";
import { RopeSim } from "./sim";
import { PassWatch, timesThrough } from "./watch";

/**
 * A stage of tightening a rope of pins and segments, run a step at a time so it can be watched and stopped. Its
 * segments are painted with what they do: shorten (drawn up, a little each step), hold (stay where they are), hold
 * straight (stay on the line they lie along, their far end held, sliding along it into the knot as a loaded standing end
 * does), or nothing (slide freely). The rope's sampled about a quarter of a diameter apart and settled by `RopeSim`,
 * watched for passing through itself or a closed bar, and fitted back to pins at the end: each pin goes where its point
 * of rope ended up.
 */

export type Role = "shorten" | "hold" | "straight";
/** Each painted segment's role, by segment id. Segments not in it slide. */
export type Painting = ReadonlyMap<number, Role>;

export type StageEnd = "jammed" | "far enough" | "stopped";

/** How a stage is run: how far to go, and how hard it's worked. */
export type StageOptions = {
    /** Stop once the shortening rope's this much shorter, as a fraction of its length when the stage started. */
    until?: number;
    /** How much shorter each shortening piece gets a step, as a fraction. */
    shrink?: number;
    /** Passes over the constraints each step. */
    iterations?: number;
    /** Stop after this many steps (as far as it's to go, when nothing shortens). */
    limit?: number;
};

/** Steps between checks for being jammed or far enough. */
const CHECK_EVERY = 25;
/** Jammed: the shortening rope got less than this much shorter (metres) over the steps between checks. */
const JAMMED = 1e-4;

export class StageRun {
    readonly sampled: SampledRope;
    readonly setup: RopeSetup;
    private readonly sim: RopeSim;
    private readonly watch: PassWatch;
    private readonly linked: number[];
    private readonly pieces: boolean[];
    private readonly lines: { far: Vector3; u: Vector3; points: number[] }[] = [];
    private readonly start: number;
    /** Which points are held still. */
    private readonly fixed: boolean[];
    /** Whether segment `k` is painted to hold. */
    private readonly held: (k: number) => boolean;
    private last: number;
    private good: Vector3[];
    steps = 0;
    /** What stopped it early, if anything did: the rope's as it was the step before. */
    problem: string | null = null;
    ended: StageEnd | null = null;

    constructor(
        readonly rope: PinnedRope,
        setup: RopeSetup,
        readonly painting: Painting,
        readonly options: StageOptions = {},
    ) {
        this.setup = setup;
        const d = setup.diameter;
        const sampled = (this.sampled = sampleRope(rope, d / 4));
        const { points, seg, pinAt } = sampled;
        const role = (k: number) => painting.get(rope.segments[k].id);
        this.held = (k) => role(k) === "hold";
        // A segment's points, both its pins with them.
        const fixed = (this.fixed = points.map(() => false));
        rope.segments.forEach((_, k) => {
            if (role(k) !== "hold") return;
            for (let i = pinAt[k]; i <= pinAt[k + 1]; i++) fixed[i] = true;
        });
        // Each run of segments held straight: a line from its far end (the one nearer the rope's end), held.
        const count = rope.segments.length;
        for (let k = 0; k < count; ) {
            if (role(k) !== "straight") {
                k++;
                continue;
            }
            let j = k;
            while (j + 1 < count && role(j + 1) === "straight") j++;
            const [a, b] = [pinAt[k], pinAt[j + 1]];
            const farIsStart = k <= count - 1 - j;
            const [far, near] = farIsStart ? [a, b] : [b, a];
            fixed[far] = true;
            const run: number[] = [];
            for (let i = a; i <= b; i++) if (i !== far) run.push(i);
            this.lines.push({
                far: points[far],
                u: points[near].sub(points[far]).unit(),
                points: run,
            });
            k = j + 1;
        }
        // Each piece is its first point's segment's.
        this.pieces = seg
            .slice(0, -1)
            .map((s, i) => !fixed[i] && !fixed[i + 1] && role(s) === "shorten");
        const sim = (this.sim = new RopeSim(points, setup, fixed));
        sim.shrink = options.shrink ?? 5e-4;
        sim.iterations = options.iterations ?? 30;
        sim.shrinking = Uint8Array.from(this.pieces, (s) => (s ? 1 : 0));
        this.watch = new PassWatch(d, arcLengths(points));
        this.watch.look(points);
        this.linked = (setup.loops ?? []).map((l) => timesThrough(l.points, points));
        this.good = points;
        this.start = this.last = this.shorteningLength(points);
    }

    private shorteningLength(p: readonly Vector3[]) {
        return this.pieces.reduce((sum, s, i) => (s ? sum + p[i].distanceTo(p[i + 1]) : sum), 0);
    }

    /** Whether any rope's painted to shorten. */
    get shortens() {
        return this.start > 0;
    }

    /** How much shorter the shortening rope is, as a fraction of its length when the stage started. */
    get shorter() {
        return this.start > 0 ? 1 - this.shorteningLength(this.good) / this.start : 0;
    }

    /** The rope's points as they are now. */
    get points(): readonly Vector3[] {
        return this.good;
    }

    /** One step. True once it's ended (jammed, far enough or stopped by a problem). */
    step(): boolean {
        if (this.ended) return true;
        const { sim } = this;
        sim.step();
        for (const line of this.lines)
            for (const i of line.points) {
                const p = sim.point(i);
                const t = Math.max(0, p.sub(line.far).dot(line.u));
                sim.set(i, line.far.add(line.u.scale(t)));
            }
        const points = sim.points();
        const loops = this.setup.loops ?? [];
        const problem =
            this.watch.look(points) ??
            loops
                .map((l, k) => {
                    const now = timesThrough(l.points, points);
                    return now === this.linked[k]
                        ? null
                        : `it went through the carabiner's rod: through it ${now} times, not ${this.linked[k]}`;
                })
                .find((p) => p !== null) ??
            null;
        this.steps++;
        if (problem) {
            this.problem = problem;
            this.ended = "stopped";
            return true;
        }
        this.good = points;
        const { until, limit } = this.options;
        if (limit !== undefined && this.steps >= limit) this.ended = "far enough";
        if (this.ended || this.steps % CHECK_EVERY !== 0 || !this.shortens)
            return this.ended !== null;
        const now = this.shorteningLength(points);
        if (until !== undefined && now <= this.start * (1 - until)) this.ended = "far enough";
        else if (this.last - now < JAMMED) this.ended = "jammed";
        this.last = now;
        return this.ended !== null;
    }

    /**
     * The rope as it is now, fitted back to pins: each pin where its point of rope is, holding the way the rope runs
     * there, and a pin added in a segment wherever one curve can't follow the rope within a twentieth of a diameter.
     */
    result(): { rope: PinnedRope; error: number } {
        const { rope, sampled, setup, fixed } = this;
        // Held rope is kept as it was: its pins hold the ways they ran, and a segment held all along isn't fitted.
        const was = pinDirections(rope.pins);
        const { pinAt } = sampled;
        const { rope: fitted, error } = fitPinned(this.good, pinAt, rope.segments, {
            tolerance: setup.diameter / 20,
            nextId: lastId(rope) + 1,
            pinIds: rope.pins.map((p) => p.id),
            directions: pinAt.map((i, k) => (fixed[i] ? was[k] : undefined)),
            keep: rope.segments.map(
                (_, k) => fixed[pinAt[k]] && fixed[pinAt[k + 1]] && this.held(k),
            ),
        });
        return { rope: fitted, error };
    }
}

/** A stage run to its end (for tests and scripts). */
export function runStage(run: StageRun, maxSteps = 20000): StageRun {
    while (run.steps < maxSteps && !run.step());
    return run;
}

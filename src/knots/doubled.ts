/**
 * Knots tied with two strands side by side through them, drawn from the same knot tied in a single strand: two
 * strands laid along its centreline (scaled, so the pair fits where one strand went). Wherever the single strand went
 * over, both strands of the pair go over both strands underneath.
 *
 * - On the bight (`onTheBight`): the knot tied in the rope doubled. Before the single strand's end leaves the knot,
 *   the two strands part, and they come round in a loop as wide as the knot. A knot rethreaded, its end followed back
 *   through it, comes out the same.
 * - Joined (`joined`): two ropes, the first tied in the knot and the second's end following it back through, so each
 *   rope's end comes out beside the other's standing part.
 */

import { arcLengths, resample } from "@/lib/curve";
import { segmentIntersection } from "@/lib/geometry";
import type { Vector2 } from "@/lib/vector2";

import { centreline, crossings, over, plain, type Crossing, type RopePath } from "./rope-path";

export type BightOptions = {
    /** How much bigger the doubled knot is than the single one, so the pairs of strands keep clear of each other. */
    scale: number;
    /** How far apart the two strands of a pair are, centre to centre (diameters). */
    spacing: number;
    /**
     * How far before the single strand's last crossing the two strands start to part, along the single strand scaled
     * (diameters), so they're apart already as they leave the knot.
     */
    part: number;
    /** How far the loop's centre is past the last crossing, along the way the single strand leaves (diameters). */
    reach: number;
    /** How far the tail runs past the first crossing, along the single strand scaled (diameters). */
    tail: number;
};

export type JoinedOptions = {
    /** How much bigger the doubled knot is than the single one, so the pairs of strands keep clear of each other. */
    scale: number;
    /** How far apart the two strands of a pair are, centre to centre (diameters). */
    spacing: number;
    /** How far each rope's tail runs past the knot, along the single strand scaled (diameters). */
    tail: number;
    /** How much further the single strand's end runs on straight, for the second rope's standing part (diameters). */
    extend: number;
};

/** How far each strand is marked over past the edges of the strand it crosses (diameters). */
const PAST = 1.2;

/** A point every this far along the strands (diameters). */
const STEP = 0.1;

/** A point of a strand, and how far along the single strand it stands for. */
type Point = { p: Vector2; along: number };

/**
 * The single strand scaled (and run on straight `extend` past its end), how far along it each point and crossing is,
 * and the points either side of it, `half` a spacing out.
 */
function lay(single: RopePath, scale: number, half: number, extend = 0) {
    const points = centreline(single).points.map((p) => p.scale(scale));
    if (extend > 0) {
        const [a, b] = points.slice(-2);
        points.push(b.add(b.sub(a).unit().scale(extend)));
    }
    const base = resample(points, STEP);
    const s = arcLengths(base);
    const found = crossings(single).map((c) => ({
        ...c,
        s: c.s.map((at) => at * scale) as [number, number],
    }));
    const at = (x: number) => Math.min(s.length - 1, Math.max(0, Math.round(x / STEP)));
    const heading = (i: number) =>
        base[Math.min(i + 1, base.length - 1)].sub(base[Math.max(i - 1, 0)]).unit();
    const side = (i: number, sign: number): Point => ({
        p: base[i].add(
            heading(i)
                .perp()
                .scale(sign * half),
        ),
        along: s[i],
    });
    return {
        base,
        s,
        found,
        firstCrossing: Math.min(...found.flatMap((c) => c.s)),
        lastCrossing: Math.max(...found.flatMap((c) => c.s)),
        at,
        heading,
        side,
    };
}

/** The points of one side of the single strand from index `from` to `to`, either way along it. */
const strand = (side: (i: number, sign: number) => Point, sign: number, from: number, to: number) =>
    Array.from({ length: Math.abs(to - from) + 1 }, (_, k) =>
        side(from + (to > from ? k : -k), sign),
    );

export function onTheBight(single: RopePath, options: BightOptions): RopePath {
    const { scale, spacing, reach } = options;
    const { base, s, found, firstCrossing, lastCrossing, at, heading, side } = lay(
        single,
        scale,
        spacing / 2,
    );
    const parting = at(lastCrossing - options.part);
    const tail = at(firstCrossing - options.tail);

    // The two strands, each side of the single one: out along one side to where they part, and back along the other.
    const outward = strand(side, 1, 0, parting);
    const back = strand(side, -1, parting, tail);

    // The loop: centred across the knot and as wide as it, round a half circle past where the single strand leaves.
    const u = heading(at(lastCrossing));
    const n = u.perp();
    const across = [...outward, ...back].map(({ p }) => p.sub(base[parting]).dot(n));
    const [lo, hi] = [Math.min(...across), Math.max(...across)];
    const radius = (hi - lo) / 2;
    const centre = base[at(lastCrossing)]
        .add(u.scale(reach))
        .add(n.scale((hi + lo) / 2 - base[at(lastCrossing)].sub(base[parting]).dot(n)));
    const bezier = (a: Vector2, b: Vector2, c: Vector2, d: Vector2, t: number) =>
        a
            .scale((1 - t) ** 3)
            .add(b.scale(3 * t * (1 - t) ** 2))
            .add(c.scale(3 * t * t * (1 - t)))
            .add(d.scale(t ** 3));
    // A leg leaves the pair the way the single strand was going, and meets the loop's side heading along `u`.
    const leg = (from: Vector2, out: Vector2, to: Vector2, into: Vector2): Vector2[] => {
        const handle = from.distanceTo(to) / 3;
        return Array.from({ length: 60 }, (_, k) =>
            bezier(from, from.add(out.scale(handle)), to.sub(into.scale(handle)), to, (k + 1) / 60),
        );
    };
    const arc = Array.from({ length: 80 }, (_, k) => {
        const angle = (Math.PI * (k + 1)) / 81;
        return centre.add(n.scale(radius * Math.cos(angle))).add(u.scale(radius * Math.sin(angle)));
    });
    const loopPoints = resample(
        [
            outward[outward.length - 1].p,
            ...leg(outward[outward.length - 1].p, heading(parting), centre.add(n.scale(radius)), u),
            ...arc,
            ...leg(centre.sub(n.scale(radius)), u.neg(), back[0].p, heading(parting).neg()),
        ],
        STEP,
    );
    // Along the loop, carry on counting from where the strands parted, out one leg and back the other, so where a leg
    // crosses the knot it stands for about the right place on the single strand.
    const loopS = arcLengths(loopPoints);
    const loopLength = loopS[loopS.length - 1];
    const loop = loopPoints.slice(1, -1).map((p, k) => {
        const d = loopS[k + 1];
        return { p, along: s[parting] + Math.min(d, loopLength - d) };
    });
    const rope = [...outward, ...loop, ...back];
    return ropePaths([rope], found)[0];
}

/**
 * Two ropes joined: the first along one side of the single strand, from its start to `tail` past the knot, and the
 * second along the other side the opposite way, from past the single strand's end to `tail` past the knot at its
 * start. The first rope is drawn first.
 */
export function joined(single: RopePath, options: JoinedOptions): [RopePath, RopePath] {
    const { scale, spacing, tail, extend } = options;
    const { s, found, firstCrossing, lastCrossing, at, side } = lay(
        single,
        scale,
        spacing / 2,
        extend,
    );
    const first = strand(side, 1, 0, at(lastCrossing + tail));
    const second = strand(side, -1, s.length - 1, at(firstCrossing - tail));
    const [a, b] = ropePaths([first, second], found);
    return [a, b];
}

/**
 * The ropes as paths, each marked over where it crosses itself or another as the strand standing for the single
 * strand's over pass: from past the edge of the strand under it on one side to past it on the other.
 */
function ropePaths(ropes: Point[][], found: Pick<Crossing, "s" | "over">[]): RopePath[] {
    const lengths = ropes.map((rope) => arcLengths(rope.map(({ p }) => p)));
    const overs: [number, number][][] = ropes.map(() => []);
    ropes.forEach((one, r) =>
        ropes.slice(r).forEach((other, dr) => {
            const q = r + dr;
            for (let i = 0; i < one.length - 1; i++)
                for (let j = q === r ? i + 2 : 0; j < other.length - 1; j++) {
                    const hit = segmentIntersection(
                        one[i].p,
                        one[i + 1].p,
                        other[j].p,
                        other[j + 1].p,
                    );
                    if (!hit) continue;
                    const a = one[i].along + (one[i + 1].along - one[i].along) * hit.t;
                    const b = other[j].along + (other[j + 1].along - other[j].along) * hit.u;
                    const c = found.reduce((best, c) =>
                        miss(c.s, a, b) < miss(best.s, a, b) ? c : best,
                    );
                    const aOver = Math.abs(a - c.s[c.over!]) < Math.abs(b - c.s[c.over!]);
                    const [rope, k, t] = aOver ? [r, i, hit.t] : [q, j, hit.u];
                    const length = lengths[rope];
                    const there = length[k] + (length[k + 1] - length[k]) * t;
                    const ha = one[i + 1].p.sub(one[i].p).unit();
                    const hb = other[j + 1].p.sub(other[j].p).unit();
                    const sin = Math.abs(ha.cross(hb));
                    const cos = Math.sqrt(1 - sin * sin);
                    const reachOver = (0.5 + 0.5 * cos) / sin + PAST;
                    overs[rope].push([there - reachOver, there + reachOver]);
                }
        }),
    );
    return ropes.map((rope, r) =>
        toPath(
            rope.map(({ p }) => p),
            (k) => overs[r].some(([a, b]) => lengths[r][k] >= a && lengths[r][k] <= b),
        ),
    );
}

/** Runs of points over or not, each a segment of straight lines through them carrying on from the last. */
function toPath(points: Vector2[], isOver: (k: number) => boolean): RopePath {
    const path: RopePath = [];
    let run: string[] = [];
    let runOver = isOver(0);
    const flush = () => {
        const d =
            path.length === 0 ? `M ${run[0]} L ${run.slice(1).join(" ")}` : `L ${run.join(" ")}`;
        path.push((runOver ? over : plain)(d));
        run = [];
    };
    points.forEach((p, k) => {
        if (k > 0 && isOver(k) !== runOver) {
            flush();
            runOver = !runOver;
        }
        run.push(`${round(p.x)} ${round(p.y)}`);
    });
    flush();
    return path;
}

/** How far a crossing of strands standing for `a` and `b` along the single strand is from the single one's crossing. */
const miss = ([x, y]: number[], a: number, b: number) =>
    Math.min(Math.abs(x - a) + Math.abs(y - b), Math.abs(x - b) + Math.abs(y - a));

const round = (x: number) => Math.round(x * 1000) / 1000;

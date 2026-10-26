/**
 * Ropes running side by side: finding them in a drawing, and fitting them as the knot editor's linked pins, one
 * stretch leading and the other linked to it pin for pin.
 *
 * A stretch is paired where another stretch (of another rope, or of the same rope further along) runs beside it about
 * `spacing` apart, parallel or the reverse. The stretch met first leads. The pair keeps its centreline and is set the
 * editor's distance apart: the leader is fitted to the centreline set out by half of it, and the follower's pins are
 * placed from the leader's, as the editor places linked pins.
 *
 * Millimetres, y down.
 */

import { arcLengths } from "@/lib/curve";
import { rad } from "@/lib/math";
import { Vector2 } from "@/lib/vector2";

import { fitStrand, type Fit, type FitOptions, type PinSpec } from "./fit";

/** A stretch of a rope, by its target points (from and to, both included). */
export type Stretch = { rope: number; from: number; to: number };

/**
 * Two stretches side by side. `partner[k]` is the follower's point beside the leader's point `leader.from + k`;
 * `side` is which side of the leader the follower is, looking the way the leader runs; `reverse`, whether it runs
 * the other way.
 */
export type Pair = {
    leader: Stretch;
    follower: Stretch;
    partner: number[];
    side: "left" | "right";
    reverse: boolean;
};

export type PairOptions = {
    /** How far apart the stretches are now, centre to centre, and how far from that they may be (millimetres). */
    spacing: number;
    within: number;
    /** The shortest stretch counted as a pair (millimetres). */
    shortest: number;
};

/** Directions this close to parallel, or to the reverse, count (the cosine of the angle between them). */
const PARALLEL = 0.94;

const tangent = (points: Vector2[], i: number) =>
    points[Math.min(points.length - 1, i + 1)]
        .sub(points[Math.max(0, i - 1)])
        .safeUnit(new Vector2(1, 0));

/** Left of a direction d, with y down. */
const leftOf = (d: Vector2) => new Vector2(d.y, -d.x);

/** Every stretch of `ropes` (target polylines, evenly spaced) with another beside it, each pair once. */
export function pairedStretches(ropes: Vector2[][], options: PairOptions): Pair[] {
    const { spacing, within, shortest } = options;
    const s = ropes.map((points) => arcLengths(points));
    // A grid of every point, to find those near each one quickly.
    const cell = spacing + within;
    const grid = new Map<string, [number, number][]>();
    const key = (p: Vector2) => `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
    ropes.forEach((points, r) =>
        points.forEach((p, i) => {
            const k = key(p);
            if (!grid.has(k)) grid.set(k, []);
            grid.get(k)!.push([r, i]);
        }),
    );
    const near = (p: Vector2) => {
        const [cx, cy] = [Math.floor(p.x / cell), Math.floor(p.y / cell)];
        const found: [number, number][] = [];
        for (let dx = -1; dx <= 1; dx++)
            for (let dy = -1; dy <= 1; dy++)
                found.push(...(grid.get(`${cx + dx},${cy + dy}`) ?? []));
        return found;
    };

    /** The point beside each point of rope r, if one is: which rope, which point, and whether it runs the other way. */
    const beside = (r: number) =>
        ropes[r].map((p, i) => {
            const d = tangent(ropes[r], i);
            let best: { rope: number; at: number; reverse: boolean; off: number } | undefined;
            for (const [r2, j] of near(p)) {
                // Not the rope itself, near here: it's beside itself only where it's come back.
                if (r2 === r && Math.abs(s[r][i] - s[r][j]) < 3 * spacing) continue;
                const q = ropes[r2][j];
                const off = Math.abs(p.distanceTo(q) - spacing);
                if (off > within) continue;
                const cos = d.dot(tangent(ropes[r2], j));
                if (Math.abs(cos) < PARALLEL) continue;
                // Across from it, not ahead or behind (within about 9°).
                if (Math.abs(q.sub(p).unit().dot(d)) > 0.15) continue;
                if (!best || off < best.off) best = { rope: r2, at: j, reverse: cos < 0, off };
            }
            return best;
        });

    const pairs: Pair[] = [];
    ropes.forEach((points, r) => {
        const found = beside(r);
        let start = 0;
        while (start < points.length) {
            const first = found[start];
            // A run leads where its partner comes after it: a later rope, or further along the same rope.
            const leads = (b: (typeof found)[number]) =>
                b !== undefined && (b.rope > r || (b.rope === r && b.at > start));
            if (!first || !leads(first)) {
                start++;
                continue;
            }
            // Which side of the rope its partner is, at point i.
            const sideAt = (i: number) =>
                ropes[found[i]!.rope][found[i]!.at].sub(points[i]).dot(leftOf(tangent(points, i))) >
                0;
            let end = start;
            while (
                end + 1 < points.length &&
                found[end + 1] &&
                found[end + 1]!.rope === first.rope &&
                found[end + 1]!.reverse === first.reverse &&
                Math.abs(found[end + 1]!.at - found[end]!.at) <= 3 &&
                sideAt(end + 1) === sideAt(start)
            )
                end++;
            const partner = found.slice(start, end + 1).map((b) => b!.at);
            const leader: Stretch = { rope: r, from: start, to: end };
            const follower: Stretch = {
                rope: first.rope,
                from: Math.min(...partner),
                to: Math.max(...partner),
            };
            // Each stretch is in one pair at most, and a rope's two stretches of a pair don't overlap.
            const overlaps = (a: Stretch, b: Stretch) =>
                a.rope === b.rope && a.from <= b.to && b.from <= a.to;
            const taken = pairs.some(
                (p) =>
                    overlaps(p.leader, leader) ||
                    overlaps(p.follower, leader) ||
                    overlaps(p.leader, follower) ||
                    overlaps(p.follower, follower),
            );
            if (s[r][end] - s[r][start] >= shortest && !overlaps(leader, follower) && !taken)
                pairs.push({
                    leader,
                    follower,
                    partner,
                    side: sideAt(start) ? "left" : "right",
                    reverse: first.reverse,
                });
            start = end + 1;
        }
    });
    return pairs;
}

/** A pin linked to another: which rope and pin of the fit leads it, which side it's on, and whether it's reversed. */
export type FittedLink = { rope: number; pin: number; side: "left" | "right"; reverse: boolean };

/** A rope fitted: its fit, the target it was fitted to, and the links of its linked pins (by pin). */
export type FittedRope = { fit: Fit; target: Vector2[]; links: Map<number, FittedLink> };

/**
 * The ropes fitted, with every pair linked. Each rope's `starts` are points (by index) that must be pins, such as
 * the old pins. `apart` is how far apart the editor sets linked ropes, centre to centre, and `ease` how far past
 * a pair a rope takes to come back to its drawing.
 */
export function fitRopes(
    ropes: Vector2[][],
    starts: number[][],
    pairs: Pair[],
    options: FitOptions & { apart: number; ease: number },
): FittedRope[] {
    const { tolerance, apart } = options;
    // Each rope's target: its drawing, with each paired stretch moved onto the pair's centreline set out by half of
    // `apart` (square to the leader), so the pair keeps its middle and comes out the editor's distance apart. Beyond each end of a stretch,
    // the free rope's target eases back from there to its drawing over `ease`, so it has no step in it for a pin's
    // direction to be taken across.
    const targets = ropes.map((points) => points.slice());
    const paired = ropes.map((points) => points.map(() => false));
    for (const pair of pairs)
        pair.partner.forEach((j, k) => {
            const i = pair.leader.from + k;
            const [p, q] = [ropes[pair.leader.rope][i], ropes[pair.follower.rope][j]];
            // Square to the way the leader runs, as the editor places a linked pin.
            const across = leftOf(tangent(ropes[pair.leader.rope], i)).scale(
                pair.side === "left" ? -1 : 1,
            );
            const middle = p.add(q).scale(0.5);
            targets[pair.leader.rope][i] = middle.add(across.scale(apart / 2));
            targets[pair.follower.rope][j] = middle.sub(across.scale(apart / 2));
            paired[pair.leader.rope][i] = paired[pair.follower.rope][j] = true;
        });
    const easeFrom = (r: number, end: number, way: 1 | -1) => {
        const moved = targets[r][end].sub(ropes[r][end]);
        let gone = 0;
        for (let i = end + way; i >= 0 && i < ropes[r].length && !paired[r][i]; i += way) {
            gone += ropes[r][i].distanceTo(ropes[r][i - way]);
            if (gone >= options.ease) break;
            const f = gone / options.ease;
            targets[r][i] = ropes[r][i].add(moved.scale(1 - f * f * (3 - 2 * f)));
        }
    };
    for (const pair of pairs)
        for (const stretch of [pair.leader, pair.follower]) {
            easeFrom(stretch.rope, stretch.from, -1);
            easeFrom(stretch.rope, stretch.to, 1);
        }

    const inLeader = (r: number, i: number) =>
        pairs.some((p) => p.leader.rope === r && i >= p.leader.from && i <= p.leader.to);
    /** The leader's points that must be pins, by rope: where each pair starts and ends, and any added for a follower. */
    const leaderPins = ropes.map(() => new Set<number>());
    for (const pair of pairs) {
        leaderPins[pair.leader.rope].add(pair.leader.from);
        leaderPins[pair.leader.rope].add(pair.leader.to);
    }

    let fitted: FittedRope[] = [];
    for (let round = 0; round < 12; round++) {
        // The leaders first, as they are: every pin in a paired stretch holds its direction.
        const leaders = ropes.map((_, r) =>
            fitStrand(
                targets[r],
                [...new Set([...starts[r], ...leaderPins[r]])].map((index) => ({ index })),
                { tolerance, holds: (i) => inLeader(r, i) },
            ),
        );
        // Every pin the leaders put in a paired stretch is kept, and gets a follower.
        for (const pair of pairs)
            for (const pin of leaders[pair.leader.rope].pins)
                if (pin.index >= pair.leader.from && pin.index <= pair.leader.to)
                    leaderPins[pair.leader.rope].add(pin.index);

        // Then every rope again, its leaders' pins as they are and its followers placed from them.
        const links = ropes.map(
            () =>
                new Map<
                    number,
                    { spec: PinSpec; link: Omit<FittedLink, "pin"> & { at: number } }
                >(),
        );
        for (const pair of pairs) {
            const lead = leaders[pair.leader.rope];
            for (const pin of lead.pins) {
                if (pin.index < pair.leader.from || pin.index > pair.leader.to) continue;
                const d = Vector2.fromAngle(rad(pin.angle ?? 0));
                const left = leftOf(d);
                const place = new Vector2(pin.x, pin.y).add(
                    left.scale(pair.side === "left" ? apart : -apart),
                );
                const index = pair.partner[pin.index - pair.leader.from];
                links[pair.follower.rope].set(index, {
                    spec: { index, place, direction: pair.reverse ? d.neg() : d, fixed: true },
                    link: {
                        rope: pair.leader.rope,
                        side: pair.side,
                        reverse: pair.reverse,
                        at: pin.index,
                    },
                });
            }
        }
        const linked = (r: number, spec: PinSpec) => links[r].get(spec.index)?.spec === spec;
        fitted = ropes.map((_, r) => {
            const specs: PinSpec[] = [
                ...[...new Set([...starts[r], ...leaderPins[r]])]
                    .filter((index) => !links[r].has(index))
                    .map((index) => ({ index, fixed: inLeader(r, index) })),
                ...[...links[r].values()].map((l) => l.spec),
            ];
            const fit = fitStrand(targets[r], specs, {
                tolerance,
                holds: (i) => inLeader(r, i),
                // Between two linked pins, or two of a leader's, a pin would have no partner.
                splittable: (a, b) =>
                    !(linked(r, a) && linked(r, b)) &&
                    !(inLeader(r, a.index) && inLeader(r, b.index)),
            });
            return { fit, target: targets[r], links: new Map() };
        });
        // Each linked pin's leader, by the pin it is in the leader's fit.
        fitted.forEach((rope, r) =>
            rope.fit.pins.forEach((pin, k) => {
                const l = pin.spec && links[r].get(pin.index);
                if (!l || l.spec !== pin.spec) return;
                const leader = fitted[l.link.rope].fit.pins.findIndex((p) => p.index === l.link.at);
                rope.links.set(k, {
                    rope: l.link.rope,
                    pin: leader,
                    side: l.link.side,
                    reverse: l.link.reverse,
                });
            }),
        );

        // A follower straying between two of its linked pins gets another pair of pins, halfway along.
        let added = false;
        fitted.forEach((rope) =>
            rope.fit.misses.forEach((m, k) => {
                const [a, b] = [rope.links.get(k), rope.links.get(k + 1)];
                if (m <= tolerance || !a || !b || a.rope !== b.rope) return;
                const lead = fitted[a.rope].fit.pins;
                const [i, j] = [lead[a.pin].index, lead[b.pin].index].sort((x, y) => x - y);
                if (j - i < 2) return;
                leaderPins[a.rope].add(Math.round((i + j) / 2));
                added = true;
            }),
        );
        if (!added) break;
    }
    return fitted;
}

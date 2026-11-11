import { Segment } from "@/lib/segment";
import { vec2 } from "@/lib/vector2";

import { ANCHOR_X, geometryOf } from "./pulley-geometry";
import { hauled, pullsOf, type Body, type PulleySystem } from "./pulley-systems";

/*
 * Pulley systems written as what's joined to what, with the drawing's lanes worked out. Each rope's parts take the next
 * lanes in turn, 28 apart; the ropes go in whichever order crosses itself least in the drawing (ties and slings
 * across rope parts, and rope parts across the anchor), the order they're written in when there's a tie.
 */

/** A rope grab, riding on part `rides` (`rope.part`) of a rope. */
type RigGrab = { kind: "grab"; x: number; rides: string; on?: string };

export type RigBody = Exclude<Body, { kind: "grab" }> | RigGrab;

export type Rig = { bodies: Record<string, RigBody>; ropes: { path: string[] }[] };

/** The first lane, and the gap between lanes: a pulley's diameter. */
const FIRST = 40;
const GAP = 28;

/** `rig` with its ropes' lanes in `order`, and its grabs on the lanes they ride on. */
function withLanes(rig: Rig, order: number[]): PulleySystem {
    const lanes: number[][] = rig.ropes.map(() => []);
    let next = FIRST;
    for (const r of order) {
        lanes[r] = rig.ropes[r].path.slice(1).map((_, i) => next + i * GAP);
        next += lanes[r].length * GAP;
    }
    const bodies: PulleySystem["bodies"] = {};
    for (const [id, b] of Object.entries(rig.bodies)) {
        if (b.kind !== "grab") {
            bodies[id] = b;
            continue;
        }
        const [r, i] = b.rides.split(".").map(Number);
        const y = lanes[r]?.[i];
        if (y === undefined)
            throw new Error(`Grab ${id} rides on ${b.rides}, which isn't a rope part`);
        bodies[id] = { kind: "grab", x: b.x, y, ...(b.on && { on: b.on }) };
    }
    return { bodies, ropes: rig.ropes.map((rope, r) => ({ path: rope.path, lanes: lanes[r] })) };
}

/** How many times the drawing of `sys` at rest crosses itself. */
export function crossings(sys: PulleySystem): number {
    const g = geometryOf(sys, hauled(sys, 0), pullsOf(sys));
    const parts = g.ropes.flat().map((p) => new Segment(p.a, p.b));
    const lanes = g.bolts.map((b) => b.y);
    const across = [
        ...g.ties.map((t) => new Segment(t.a, t.b)),
        ...g.slings.map((s) => new Segment(s.a, s.b)),
        new Segment(vec2(ANCHOR_X, Math.min(...lanes)), vec2(ANCHOR_X, Math.max(...lanes))),
    ];
    return parts.reduce((n, p) => n + across.filter((a) => p.crosses(a)).length, 0);
}

/** Every order of 0 to n − 1, the natural order first. */
function orders(n: number): number[][] {
    if (n === 0) return [[]];
    return orders(n - 1).flatMap((o) =>
        Array.from({ length: n }, (_, k) => [
            ...o.slice(0, n - 1 - k),
            n - 1,
            ...o.slice(n - 1 - k),
        ]),
    );
}

/** `rig` laid out for drawing, its ropes in the order that crosses itself least. */
export function layOut(rig: Rig): PulleySystem {
    let best: { sys: PulleySystem; n: number } | null = null;
    for (const order of orders(rig.ropes.length)) {
        const sys = withLanes(rig, order);
        const n = crossings(sys);
        if (!best || n < best.n) best = { sys, n };
    }
    return best!.sys;
}

import { vec2, type Vector2 } from "@/lib/vector2";

import type { Positions, PulleySystem, Pulls } from "./pulley-systems";

/*
 * Where everything in a pulley system's drawing goes, laid out across the page with the anchor on the left: the rope
 * parts, sheaves, blocks, ties, slings, grabs and labels. Drawing units are SVG's, y down. `SystemDrawing` draws it,
 * and the layout scores rope orders by where it crosses itself.
 */

/** Drawing units per metre, and where the anchor is. */
export const PER_METRE = 100;
export const ANCHOR_X = 60;
export const WIDTH = 520;
/** How far past the load the drawing reaches: its box, and its arrow to the tip. */
const LOAD_REACH = 60;
/** A pulley's radius: half the gap between rope parts. */
export const R = 14;
/** Rope marks, every half metre along the rope. */
export const MARKS = 0.5;

export const px = (x: number) => ANCHOR_X + x * PER_METRE;

/** Where each part of a rope runs, in drawing units, and where its haul end or loose tail leaves the drawing. */
function partsOf(sys: PulleySystem, at: Positions, r: number) {
    const rope = sys.ropes[r];
    const n = rope.path.length;
    return rope.path.slice(1).map((id, i) => {
        const fromId = rope.path[i];
        const y = rope.lanes[i];
        const end = (k: string) => {
            const b = sys.bodies[k];
            if (b.kind === "anchor") return ANCHOR_X;
            if (b.kind === "haul") return at[k] < at[fromId] ? 0 : WIDTH;
            return px(at[k]);
        };
        let to = end(id);
        const last = i === n - 2;
        // A rope ending at a free grab carries on past it as a loose tail.
        const tail = last && sys.bodies[id].kind === "grab";
        if (tail) to += Math.sign(to - end(fromId)) * 36;
        return { from: fromId, to: id, a: vec2(end(fromId), y), b: vec2(to, y), tail };
    });
}

/** Where everything in the drawing of `sys` goes, with its bodies `at` and its ropes pulling as in `pulls`. */
export function geometryOf(sys: PulleySystem, at: Positions, pulls: Pulls) {
    // Each sheave's centre, and which side the rope wraps round. A pulley the rope runs round more than once is a
    // block with a sheave for each time (a double pulley); one at a rope's end has the rope tied to its becket.
    const pulleys: { key: string; id: string; c: Vector2; right: boolean }[] = [];
    const beckets: { id: string; at: Vector2 }[] = [];
    sys.ropes.forEach((rope, r) => {
        rope.path.slice(1, -1).forEach((id, j) => {
            const i = j + 1;
            const y = (rope.lanes[i - 1] + rope.lanes[i]) / 2;
            const right = at[rope.path[i - 1]] < at[id] && at[rope.path[i + 1]] < at[id];
            pulleys.push({ key: `${r}.${i}`, id, c: vec2(px(at[id]), y), right });
        });
        const n = rope.path.length;
        for (const [id, y] of [
            [rope.path[0], rope.lanes[0]],
            [rope.path[n - 1], rope.lanes[n - 2]],
        ] as const) {
            if (sys.bodies[id].kind === "pulley") beckets.push({ id, at: vec2(px(at[id]), y) });
        }
    });
    // Each block: how many sheaves it has, the span across the ropes they take up, and a tie from each becket to it.
    const blocks = [...new Set(pulleys.map((p) => p.id))].map((id) => {
        const ys = pulleys.filter((p) => p.id === id).map((p) => p.c.y);
        const lo = Math.min(...ys) - R;
        const hi = Math.max(...ys) + R;
        const x = px(at[id]);
        return { id, x, lo, hi, sheaves: ys.length, c: vec2(x, (lo + hi) / 2) };
    });
    const blockOf = (id: string) => blocks.find((b) => b.id === id)!;
    const ties = beckets.map((k) => {
        const b = blockOf(k.id);
        return { a: k.at, b: vec2(k.at.x, k.at.y < b.lo ? b.lo : b.hi) };
    });
    // A rope tied to a grab on another rope's lane: tie the two together.
    sys.ropes.forEach((rope) => {
        const n = rope.path.length;
        for (const [id, y] of [
            [rope.path[0], rope.lanes[0]],
            [rope.path[n - 1], rope.lanes[n - 2]],
        ] as const) {
            const b = sys.bodies[id];
            if (b.kind === "grab" && b.y !== y) {
                ties.push({ a: vec2(px(at[id]), b.y), b: vec2(px(at[id]), y) });
            }
        }
    });

    // The load's box, centred on what's tied or clipped to it.
    const loadId = Object.keys(sys.bodies).find((k) => sys.bodies[k].kind === "load")!;
    const onLoad = [
        ...sys.ropes.flatMap((rope) =>
            rope.path.flatMap((id, i) =>
                id === loadId ? [rope.lanes[Math.min(i, rope.lanes.length - 1)]] : [],
            ),
        ),
        ...Object.entries(sys.bodies).flatMap(([id, b]) =>
            (b.kind === "pulley" || b.kind === "grab") && b.on === loadId
                ? b.kind === "grab"
                    ? [b.y]
                    : [blockOf(id).lo + R, blockOf(id).hi - R]
                : [],
        ),
        ...beckets.flatMap((k) => {
            const b = sys.bodies[k.id];
            return b.kind === "pulley" && b.on === loadId ? [k.at.y] : [];
        }),
    ];
    const load = vec2(px(at[loadId]), (Math.min(...onLoad) + Math.max(...onLoad)) / 2);
    // Wide enough to reach everything on it.
    const loadHalf = Math.max(20, (Math.max(...onLoad) - Math.min(...onLoad)) / 2 + 14);
    // The drawing's length along the ropes: room for the load's box and arrow where it starts, so it doesn't change
    // as the team hauls, and never shorter than the usual width.
    const rest = sys.bodies[loadId];
    const length = Math.max(WIDTH, px(rest.kind === "load" ? rest.x : at[loadId]) + LOAD_REACH);

    // Slings: fixed pulleys to the anchor, others to what they're clipped to.
    const slings: { id: string; a: Vector2; b: Vector2 }[] = [];
    const bolts: Vector2[] = [];
    for (const p of blocks) {
        const body = sys.bodies[p.id];
        if (body.kind !== "pulley") continue;
        if (body.fixed) {
            slings.push({ id: p.id, a: p.c, b: vec2(ANCHOR_X, p.c.y) });
            bolts.push(vec2(ANCHOR_X, p.c.y));
        } else if (body.on) {
            const host = sys.bodies[body.on];
            const b = host.kind === "grab" ? vec2(px(at[body.on]), host.y) : vec2(load.x, p.c.y);
            slings.push({ id: p.id, a: p.c, b });
        }
    }
    sys.ropes.forEach((rope) => {
        if (rope.path[0] === "anchor") bolts.push(vec2(ANCHOR_X, rope.lanes[0]));
        if (rope.path.at(-1) === "anchor") bolts.push(vec2(ANCHOR_X, rope.lanes.at(-1)!));
    });

    const grabs = Object.entries(sys.bodies).flatMap(([id, b]) =>
        b.kind === "grab" ? [{ id, at: vec2(px(at[id]), b.y), on: b.on }] : [],
    );

    // Rope parts, split where a grab rides on them: between the grab and its body, the part carries the grab's pull too.
    const ropes = sys.ropes.map((_, r) => partsOf(sys, at, r));
    const labels: { key: string; at: Vector2; tension: number; room: number }[] = [];
    ropes.forEach((parts, r) =>
        parts.forEach((part, i) => {
            const tension = pulls.tensions[r][i];
            const lo = Math.min(part.a.x, part.b.x);
            const hi = Math.max(part.a.x, part.b.x);
            const grab = grabs.find(
                (g) => g.on && g.at.y === part.a.y && g.at.x > lo && g.at.x < hi,
            );
            const mid = (x1: number, x2: number) => ({
                at: vec2((x1 + x2) / 2, part.a.y - 10),
                room: Math.abs(x2 - x1),
            });
            if (!grab) {
                labels.push({ key: `${r}.${i}`, ...mid(part.a.x, part.b.x), tension });
                return;
            }
            const hostEnd = [part.from, part.to].includes(grab.on!)
                ? part.from === grab.on
                    ? part.a.x
                    : part.b.x
                : part.a.x;
            const farEnd = hostEnd === part.a.x ? part.b.x : part.a.x;
            // The grab balances: the far part pulls it one way, the host's part and its pulleys the other.
            const away = Math.sign(farEnd - grab.at.x);
            labels.push({ key: `${r}.${i}`, ...mid(grab.at.x, farEnd), tension });
            labels.push({
                key: `${r}.${i}.${grab.id}`,
                ...mid(grab.at.x, hostEnd),
                tension: tension + pulls.pull[grab.id] * away,
            });
        }),
    );

    // Marks along each rope, every half metre from its first end, so they move as the rope does.
    const marks = ropes.flatMap((parts) => {
        let start = 0;
        return parts.flatMap((part) => {
            const length = Math.abs(part.b.x - part.a.x) / PER_METRE;
            const dir = Math.sign(part.b.x - part.a.x);
            const out: Vector2[] = [];
            for (let m = Math.ceil(start / MARKS) * MARKS; m < start + length; m += MARKS) {
                if (m - start < 0.05 || start + length - m < 0.05) continue;
                out.push(vec2(part.a.x + dir * (m - start) * PER_METRE, part.a.y));
            }
            start += length;
            return out;
        });
    });

    const haulPart = ropes
        .flatMap((parts) => parts)
        .find((part) => sys.bodies[part.to].kind === "haul")!;
    const haulDir = Math.sign(haulPart.b.x - haulPart.a.x);
    const haulTip = haulPart.b.add(vec2(-haulDir * 8, 0));
    return {
        pulleys,
        beckets,
        blocks,
        ties,
        load,
        loadHalf,
        slings,
        bolts,
        grabs,
        ropes,
        labels,
        marks,
        haulDir,
        haulTip,
        length,
    };
}

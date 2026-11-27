import { vec3, type Vector3 } from "@/lib/vector3";
import { tapeLayers } from "@/scene/pieces";
import type { Strand } from "@/scene/pieces";

import { linkPlanes } from "./hardware";
import { line } from "./rope";

/**
 * Slings and webbing as pieces: round slings and tape, their stripes and stitching, slings basketed round a bar, and a
 * round sling choked round a trunk.
 */

const UP = vec3(0, 1, 0);

/**
 * A sling's webbing: a round sling (an endless loop of yarn in a woven sleeve, the anchors' 4 t ones) or a climbing
 * sling (sewn flat tape as on the tower, here the common 25 mm). Neither is round in section: a round sling's sleeve
 * squashes semi-flat, about 50 mm wide and 14 mm thick. `r` is how thick the flat views draw it.
 */
export const SLINGS = {
    round: {
        width: 0.05,
        thickness: 0.014,
        r: 0.016,
        color: "var(--fox-round-sling)",
        /** The heavier 6 t slings choked round the tree for the hawsers: pale pink. */
        heavy: "var(--fox-round-sling-6t)",
        bunched: { width: 0.038, thickness: 0.02, over: 0.15 },
    },
    climbing: {
        width: 0.025,
        thickness: 0.003,
        r: 0.0125,
        color: "var(--fox-sling)",
        // Climbing tape is flat already, and a carabiner's bar is wide enough for it not to bunch.
        bunched: { width: 0.025, thickness: 0.003, over: 0.06 },
    },
};

/**
 * A sling through `points`, doubled (an endless or tied loop goes round anything with its two parts side by side):
 * its two layers lie `across`, fanned apart where it wraps and gathered at `gather` (its shackle or carabiner) over the
 * last `ramp` metres.
 */
export function sling(
    kind: keyof typeof SLINGS,
    points: Vector3[],
    across: Vector3,
    gather: Vector3,
    ramp: number,
    layers = 2,
): Strand[] {
    const { width, thickness, r, color } = SLINGS[kind];
    const tape = { width, thickness, across, layers, gather, ramp };
    const strands = line(points, r, color, "sling").map((p) => ({ ...p, tape }));
    if (kind !== "round")
        return [
            ...strands,
            ...strands
                .flatMap((p) =>
                    tapeLayers(p).map((layer) => ({ layer, size: { width, thickness } })),
                )
                .flatMap(({ layer, size }) =>
                    stitching(
                        layer,
                        layer.map(() => size),
                        across,
                    ),
                ),
        ];
    // A round sling's stripes, along each layer.
    return [
        ...strands,
        ...strands.flatMap((p) =>
            tapeLayers(p).flatMap((layer) =>
                stripes(
                    layer,
                    layer.map(() => ({ width, thickness })),
                    across,
                ),
            ),
        ),
    ];
}

/** A round sling's stripes: two dark lines along it either side of its middle, on both faces. */
const STRIPE = { at: 0.3, width: 0.003, color: "var(--fox-round-sling-stripe)" };

/** A tape's width and thickness at a point, and (if it twists) the way its width lies there. */
export type TapeSize = { width: number; thickness: number; across?: Vector3 };

/** The stripes along a round sling's layer through `points`, `profile` its size at each. */
export function stripes(points: Vector3[], profile: TapeSize[], across: Vector3): Strand[] {
    const a = across.unit();
    return [-1, 1].flatMap((s) =>
        tapeRun(
            points.map((q, i) =>
                q.add((profile[i].across ?? a).unit().scale(s * STRIPE.at * profile[i].width)),
            ),
            profile.map((p) => ({
                width: STRIPE.width,
                thickness: p.thickness + 0.001,
                across: p.across,
            })),
            a,
            STRIPE.color,
            0.0015,
        ).map((p) => ({ ...p, fine: STRIPE.width })),
    );
}

/**
 * A climbing sling's stitching, the pattern woven along its tape: two rows of short light dashes, on both faces.
 */
const STITCH = {
    rows: [-0.22, 0.22],
    dash: 0.008,
    gap: 0.008,
    width: 0.0012,
    color: "var(--fox-sling-stitch)",
};

/** The stitching along a climbing sling's layer through `points`, `profile` its size at each. */
function stitching(points: Vector3[], profile: TapeSize[], across: Vector3): Strand[] {
    const a = across.unit();
    const at = [0];
    for (let i = 1; i < points.length; i++)
        at.push(at[i - 1] + points[i].distanceTo(points[i - 1]));
    // The point and size `d` along the tape, `off` (of its width) out from its middle.
    const sample = (d: number, off: number): { q: Vector3; size: TapeSize } => {
        const i = Math.min(
            points.length - 1,
            Math.max(
                1,
                at.findIndex((x) => x >= d),
            ),
        );
        const k = Math.min(1, Math.max(0, (d - at[i - 1]) / (at[i] - at[i - 1] || 1)));
        const p = profile[i];
        const w = (p.across ?? a).unit();
        return { q: points[i - 1].lerp(points[i], k).add(w.scale(off * p.width)), size: p };
    };
    const out: Strand[] = [];
    const step = STITCH.dash + STITCH.gap;
    // Fine detail, which the flat views leave out when it's too small to see.
    const fine = { fine: STITCH.width };
    for (const off of STITCH.rows)
        for (let d = 0; d + STITCH.dash < at.at(-1)!; d += step) {
            const ends = [sample(d, off), sample(d + STITCH.dash, off)];
            out.push({
                ...fine,
                kind: "strand",
                points: ends.map((e) => e.q),
                r: 0.0008,
                material: "sling",
                color: STITCH.color,
                capA: true,
                capB: true,
                tape: {
                    width: STITCH.width,
                    thickness: ends[0].size.thickness + 0.0008,
                    across: a,
                    layers: 1,
                    gather: ends[0].q,
                    ramp: 1,
                    profile: ends.map((e) => ({
                        width: STITCH.width,
                        thickness: e.size.thickness + 0.0008,
                        across: e.size.across,
                    })),
                },
            });
        }
    return out;
}

/**
 * One layer of tape through `points`, `profile` its size at each, lying `across` (where the profile doesn't say), in
 * short strands of `piece` points so it sorts where it is; `r` is how thick the flat views draw it.
 */
export function tapeRun(
    points: Vector3[],
    profile: TapeSize[],
    across: Vector3,
    color: string,
    r: number,
    piece = 12,
): Strand[] {
    const out: Strand[] = [];
    for (let i = 0; i < points.length - 1; i += piece) {
        const end = Math.min(points.length, i + piece + 1);
        const part = profile.slice(i, end);
        out.push({
            kind: "strand",
            points: points.slice(i, end),
            r,
            material: "sling",
            color,
            capA: i === 0,
            capB: i + piece >= points.length - 1,
            tape: {
                width: part[0].width,
                thickness: part[0].thickness,
                across,
                layers: 1,
                gather: points[i],
                ramp: 1,
                profile: part,
            },
        });
    }
    return out;
}

/**
 * A sling basketed round a log (or spar) and up into a shackle's bow (or a carabiner), both its ends on it: the loop
 * lies doubled, its two strands flat side by side round the log, and each leg ends in a bight round the shackle's crown
 * (or the carabiner's bar), one strand in over it and the other under it, the two bights one atop the other. Over the
 * last of its legs it bunches up, narrower and thicker. `log` is the log's middle (its axis `along`), `around` its
 * radius, or for anything not round (logs stacked, a sawn timber) its section as a convex outline round `log` (points
 * anywhere along it), `bar` the middle of the crown bar (its radius `barR`), and `up` a way square to the line between
 * them and to `along`, which the top leg is on. The loop crosses itself round the crown, where it changes layer. It's
 * in the sling's own colour unless given `color`, and a climbing sling's stitching is drawn unless it's not `stitched`.
 */
export function basketedSling(...args: Parameters<typeof basketedSlingWith>): Strand[] {
    return basketedSlingWith(...args).pieces;
}

/**
 * What a sling's connections are checked against: its tape's middle line (closed, its last point its first) and how
 * thick the tape is at each of its points.
 */
export type TapeFeatures = { points: Vector3[]; thickness: number[] };

/** A basketed sling as `basketedSling` draws it, with its tape's features for checking its connections. */
export function basketedSlingWith(
    kind: keyof typeof SLINGS,
    log: Vector3,
    around: number | Vector3[],
    bar: Vector3,
    barR: number,
    up: Vector3,
    along: Vector3,
    { color = SLINGS[kind].color, stitched = true }: { color?: string; stitched?: boolean } = {},
): { pieces: Strand[]; tape: TapeFeatures } {
    const { width, thickness, r, bunched } = SLINGS[kind];
    // Worked out square to the log, then sheared along it as far as the bar rises along it, so the loop hugs the log
    // on a slant.
    const axis = along.unit();
    const toBar = bar.sub(log);
    const rise = toBar.dot(axis);
    const flat = toBar.sub(axis.scale(rise));
    const D = flat.len();
    const a = flat.unit();
    const b = up
        .sub(a.scale(up.dot(a)))
        .sub(axis.scale(up.dot(axis)))
        .unit();
    const p = (x: number, y: number) =>
        log
            .add(a.scale(x))
            .add(b.scale(y))
            .add(axis.scale((x / D) * rise));
    // Round the log the two strands of the doubled loop lie flat side by side, strand `k` (0 or 1) `side(k)` along
    // the log from the middle. Each leg ends in a bight through the bow round the crown: one strand comes in over the
    // crown and the other under it, joined round its far side. The two bights lie partly one atop the other, swapping
    // over round the far side, so each strand leaves the crown on the side away from the strands it crosses.
    // A climbing sling's thin flat tape comes together in the carabiner, one bight on the other; its legs close
    // from side by side round the rail to one on the other there.
    const stacked = kind === "climbing";
    const side = (k: number) => (k - 0.5) * (width + 0.004);
    const z = axis;
    const rb = (layer: number) => barR + bunched.thickness * (layer + 0.5);
    type Flat2 = [number, number];
    // What it wraps, as its support: for each way out (an angle in the loop's plane, from the bar), how far out the
    // tape's middle lies that way, and where it touches. A log is round; an outline is grown by half the tape's
    // thickness, rounding its corners.
    const r1 = typeof around === "number" ? around + thickness / 2 : 0;
    const outline: Flat2[] =
        typeof around === "number" ? [] : around.map((q) => [q.sub(log).dot(a), q.sub(log).dot(b)]);
    const support = (angle: number): { h: number; at: Flat2 } => {
        const [c, s] = [Math.cos(angle), Math.sin(angle)];
        if (typeof around === "number") return { h: r1, at: [r1 * c, r1 * s] };
        let best = outline[0];
        for (const q of outline) if (q[0] * c + q[1] * s > best[0] * c + best[1] * s) best = q;
        const h = best[0] * c + best[1] * s + thickness / 2;
        return { h, at: [best[0] + (thickness / 2) * c, best[1] + (thickness / 2) * s] };
    };
    // The straight line from the log (on its top or bottom, `s1` ±1) to the crown (on its top or bottom, `s2`), the
    // crown `layer` out: where it leaves each, as the angle its line is square to. Round, that's worked straight out;
    // round an outline, it's where the outline's support meets the crown's.
    const tangent = (s1: number, s2: number, layer: number): { log: number; bar: number } => {
        const r2 = rb(layer);
        if (typeof around === "number") {
            if (s1 === s2) {
                const t = Math.acos((r1 - r2) / D);
                return { log: s1 * t, bar: s1 * t };
            }
            const t = Math.acos((r1 + r2) / D);
            return { log: s1 * t, bar: Math.PI + s1 * t };
        }
        // Same side: the outline reaches as far out as the crown's side, h(t) = D cos t + r2. Crossing: h(t) = D cos t
        // - r2. Below the line at t = 0 (it's well clear of the bar), above it by a half turn.
        const off = s1 === s2 ? r2 : -r2;
        const f = (t: number) => support(t).h - D * Math.cos(t) - off;
        let [lo, hi] = [0, Math.PI];
        for (let i = 0; i < 60; i++) {
            const mid = (lo + hi) / 2;
            if (f(mid) < 0) lo = mid;
            else hi = mid;
        }
        const t = (lo + hi) / 2;
        return s1 === s2 ? { log: s1 * t, bar: s1 * t } : { log: s1 * t, bar: Math.PI + s1 * t };
    };
    const onLog = (angle: number): Flat2 => support(angle).at;
    const onBar = (angle: number, layer: number): Flat2 => [
        D + rb(layer) * Math.cos(angle),
        rb(layer) * Math.sin(angle),
    ];
    const ease = (t: number) => t * t * (3 - 2 * t);
    // In the bow each bight is pushed to one side, the top leg's towards +z; each strand runs straight from there to
    // its place round the log, so the one whose place is on the far side angles across more.
    const lap = stacked ? 0 : 0.3 * bunched.width;
    const inBow = (bight: number) => (bight === 0 ? lap : -lap);
    const pts: Vector3[] = [];
    // A leg of strand `k` between the crown (in `bight`) and the log.
    const leg = (from: Flat2, to: Flat2, k: number, bight: number, toLog: boolean) => {
        const [z0, z1] = toLog ? [inBow(bight), side(k)] : [side(k), inBow(bight)];
        for (let i = 0; i < 10; i++) {
            const s = i / 10;
            const [x, y] = [from[0] + (to[0] - from[0]) * s, from[1] + (to[1] - from[1]) * s];
            pts.push(p(x, y).add(z.scale(z0 + (z1 - z0) * s)));
        }
    };
    const steps = typeof around === "number" ? 16 : 64;
    const arc = (from: number, to: number, k: number) => {
        for (let i = 0; i < steps; i++) {
            const [x, y] = onLog(from + ((to - from) * i) / steps);
            pts.push(p(x, y).add(z.scale(side(k))));
        }
    };
    // A bight round the crown's far side, stepping a layer out (or in) as it goes, where it passes the other bight.
    const wrap = (from: number, to: number, bight: number, l0: number, l1: number) => {
        for (let i = 0; i < 16; i++) {
            const u = i / 16;
            const [x, y] = onBar(from + (to - from) * u, l0 + (l1 - l0) * ease(u));
            pts.push(p(x, y).add(z.scale(inBow(bight))));
        }
    };
    // Strand 0: out of the top bight over the crown (the outer layer there), along the top leg, round the back of the
    // log, along the bottom leg and in over the crown (the inner layer) into the bottom bight.
    const topOut = tangent(1, 1, 1);
    const bottomIn = tangent(-1, 1, 0);
    leg(onBar(topOut.bar, 1), onLog(topOut.log), 0, 0, true);
    arc(topOut.log, 2 * Math.PI + bottomIn.log, 0);
    leg(onLog(bottomIn.log), onBar(bottomIn.bar, 0), 0, 1, false);
    // The bottom bight, round the crown's far side from its top to its bottom, stepping out a layer.
    const bottomOut = tangent(-1, -1, 1);
    wrap(bottomIn.bar, bottomOut.bar, 1, 0, 1);
    // Strand 1: out of the bottom bight under the crown (the outer layer there), back along the bottom leg, round the
    // log, along the top leg and in under the crown (the inner layer) into the top bight.
    const topIn = tangent(1, -1, 0);
    leg(onBar(bottomOut.bar, 1), onLog(bottomOut.log), 1, 1, true);
    arc(2 * Math.PI + bottomOut.log, topIn.log, 1);
    leg(onLog(topIn.log), onBar(topIn.bar, 0), 1, 0, false);
    // The top bight, round the crown's far side from its bottom to its top, stepping out a layer, back to the start.
    wrap(topIn.bar - 2 * Math.PI, topOut.bar, 0, 0, 1);
    const points = [...pts, pts[0]];
    // Bunched up near the bar, easing out to its full width over the last of each leg.
    const profile = points.map((q) => {
        const f = Math.min(1, Math.max(0, (q.distanceTo(bar) - 0.2 * bunched.over) / bunched.over));
        const e = f * f * (3 - 2 * f);
        return {
            width: bunched.width + (width - bunched.width) * e,
            thickness: bunched.thickness + (thickness - bunched.thickness) * e,
        };
    });
    // Round an outline (finer than round a log) in shorter strands, so none reaching from a leg over the top of what
    // it wraps sorts below it in the flat views.
    const tape = tapeRun(points, profile, z, color, r, typeof around === "number" ? 12 : 4);
    return {
        pieces: [
            ...tape,
            ...(kind === "round"
                ? stripes(points, profile, z)
                : stitched
                  ? stitching(points, profile, z)
                  : []),
        ],
        tape: { points, thickness: profile.map((q) => q.thickness) },
    };
}

/**
 * A round sling choked round a tree's trunk (upright, `R` round, its middle at `trunk`), the line touching the trunk at `angle` round it (the sling arriving
 * there heading out going `turn` round) at height `y`, out to the bow shackle whose crown's inside is at `crown` (the
 * shackle lying flat, its crown bar level and square to the leg, its bar `barR` round). The loop goes round the trunk
 * from the far side of its choke, out along the leg towards the shackle, and through its own bight, the choke, `chokeAt` of the way
 * out, which squeezes the leg's two strands together. Followed round: from the crown along the leg's top strand to the
 * trunk, the long way round the tree, out from its far side to the choke, round the leg in a flat bight and back, round
 * the tree again the other way, and out along the leg's bottom strand to the crown, round its far side and back. Round
 * the trunk the strands lie on edge one above the other; the leg twists a quarter turn to lie flat through the bow,
 * bunching up into it, and the choke's bight twists to lie flat round the leg.
 */
export function chokedSling(
    trunk: Vector3,
    angle: number,
    turn: number,
    y: number,
    R: number,
    crown: Vector3,
    { chokeAt, barR }: { chokeAt: number; barR: number },
): Strand[] {
    const { width, thickness, r, heavy: color, bunched } = SLINGS.round;
    const ease = (t: number) => t * t * (3 - 2 * t);
    const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
    const onTrunk = (a: number, h: number) =>
        vec3(trunk.x + R * Math.cos(a), h, trunk.z + R * Math.sin(a));
    const apart = (width + 0.004) / 2;
    const touch = onTrunk(angle, y);
    const d = crown.sub(touch).unit();
    const { flat: up } = linkPlanes(d);
    const w = up.cross(d);
    const bar = crown.sub(d.scale(barR));
    const rb = barR + bunched.thickness / 2;
    const legLength = touch.distanceTo(bar);
    // The choke, out along the leg, where the leg's strands are squeezed together.
    const sA = chokeAt;
    const choke = touch.lerp(bar, sA);
    const squeezed = { width: 0.036, thickness: 0.018, apart: 0.012 };
    // Seen from above, the other line from the choke that just touches the trunk: where the loop leaves the trunk.
    const plan = Math.hypot(choke.x - trunk.x, choke.z - trunk.z);
    const wedge = 2 * Math.acos(R / plan);
    const far = angle - turn * (2 * Math.PI - wedge);
    const leaves = onTrunk(far, y);
    // Out from the trunk at the choke, away from the trunk, square to the leg.
    const outward = w.scale(Math.sign(w.dot(choke.sub(vec3(trunk.x, choke.y, trunk.z)))));
    const pts: Vector3[] = [];
    const sizes: TapeSize[] = [];
    const push = (q: Vector3, across: Vector3, size = { width, thickness }) => {
        pts.push(q);
        sizes.push({ ...size, across });
    };
    // A leg strand at `s` of the way from the trunk to the crown, above the middle (`k` 1) or below.
    const legPoint = (k: number, s: number) => {
        const off =
            s < sA
                ? apart + (squeezed.apart - apart) * ease(s / sA)
                : squeezed.apart + (rb - squeezed.apart) * ease((s - sA) / (1 - sA));
        const side = UP.lerp(up, ease(s)).unit();
        const twist = (Math.PI / 2) * ease(s);
        // Squeezed round the choke, bunched into the crown.
        const g = ease(clamp01((Math.abs(s - sA) * legLength) / 0.08));
        const c = ease(
            clamp01((bar.distanceTo(touch.lerp(bar, s)) - 0.2 * bunched.over) / bunched.over),
        );
        const [tw, tt] = [
            Math.min(
                squeezed.width + (width - squeezed.width) * g,
                bunched.width + (width - bunched.width) * c,
            ),
            Math.max(
                squeezed.thickness + (thickness - squeezed.thickness) * g,
                bunched.thickness + (thickness - bunched.thickness) * c,
            ),
        ];
        push(
            touch.lerp(bar, s).add(side.scale(k * off)),
            UP.scale(Math.cos(twist)).add(w.scale(Math.sin(twist))),
            { width: tw, thickness: tt },
        );
    };
    const leg = (k: number, out: boolean) => {
        for (let i = 0; i <= 24; i++) legPoint(k, out ? i / 24 : 1 - i / 24);
    };
    // Round the trunk from angle `a0` to `a1`, `h` above or below the middle. The loop round the trunk lies in the plane
    // of the leg and the other line to the choke, which both pull towards the choke: tilted, so it meets both without
    // a corner and is lowest round the back.
    const tilt = choke.sub(touch).cross(choke.sub(leaves));
    const planeY = (x: number, z: number) =>
        choke.y - (tilt.x * (x - choke.x) + tilt.z * (z - choke.z)) / tilt.y;
    const round = (a0: number, a1: number, h: number) => {
        for (let i = 1; i < 30; i++) {
            const q = onTrunk(a0 + ((a1 - a0) * i) / 30, 0);
            push(vec3(q.x, planeY(q.x, q.z) + h, q.z), UP);
        }
    };
    // The choke's bight round the squeezed leg: a smooth curve, open towards the trunk, lying flat along the leg.
    const high = squeezed.apart + squeezed.width / 2 + thickness / 2 + 0.003;
    const reach = squeezed.width / 2 + thickness / 2 + 0.003;
    const bightPoint = (phi: number) =>
        choke
            .add(up.scale(high * Math.cos(phi)))
            .add(outward.scale(reach * (1.65 * Math.sin(phi) - 0.5)));
    // Between the trunk and the choke, along the other line, twisting a quarter turn smoothly all the way from where
    // it leaves the trunk to the bight.
    const across = (from: Vector3, to: Vector3, toChoke: boolean) => {
        for (let i = 1; i < 20; i++) {
            const t = i / 20;
            const twist = ease(toChoke ? t : 1 - t);
            push(from.lerp(to, t), UP.lerp(d, twist).unit());
        }
    };
    // From the crown along the leg's top strand to the trunk, the long way round to the far side.
    leg(1, false);
    round(angle, far, apart);
    push(leaves.add(UP.scale(apart)), UP);
    // Out to the choke, round the leg and back.
    across(leaves.add(UP.scale(apart)), bightPoint(0), true);
    for (let i = 0; i <= 16; i++) push(bightPoint((Math.PI * i) / 16), d);
    across(bightPoint(Math.PI), leaves.sub(UP.scale(apart)), false);
    push(leaves.sub(UP.scale(apart)), UP);
    // Round the trunk again the other way, and out along the leg's bottom strand to the crown.
    round(far, angle, -apart);
    leg(-1, true);
    // Round the crown's far side, from its bottom to its top, back to the start.
    for (let i = 1; i < 12; i++) {
        const t = -Math.PI / 2 + (Math.PI * i) / 12;
        push(bar.add(d.scale(rb * Math.cos(t))).add(up.scale(rb * Math.sin(t))), w, bunched);
    }
    push(pts[0], sizes[0].across!, sizes[0]);
    return [...tapeRun(pts, sizes, w, color, r), ...stripes(pts, sizes, w)];
}

/**
 * A daisy chain made as a chain: closed loops of flat Dyneema tape, each sewn shut with a bar tack and threaded
 * through the next, each turned a quarter round from the one before as a metal chain's links are. Pulled out straight,
 * the loops' bends only just touch. Pale tape with coloured edges, the last loop's edges in their own colour. Sizes (m): 13 mm
 * tape, loops about 100 mm long.
 */
export const DAISY = {
    width: 0.013,
    thickness: 0.0015,
    /** A loop's length, from the middle of the tape at one end to the other's. */
    link: 0.1,
    /** How much room a loop leaves round the tape threaded through it, each side. */
    room: 0.0005,
    /** A loop's bar tack: how long along the tape it is, and how much of its width it crosses. */
    tack: { long: 0.012, across: 0.7 },
    /** How many points round each end of a loop, and how far apart the points along its legs are. */
    bend: 12,
    step: 0.01,
};

/** A daisy chain's colours: its tape, its edges, its last loop's edges and its bar tacks. */
export type DaisyColors = { tape: string; edge: string; tab: string; tack: string };

/**
 * A daisy chain from the bar at `from` to the bar at `to` (both bars `barR` thick): its first loop round the first
 * bar, its tape's width lying `across` (squared to the line between them; the way the first bar runs), and its last
 * round the second. As many loops as fit, stretched a little to reach. Gives its pieces and the way the last loop's
 * tape lies, which the second bar should run.
 */
export function daisyChain(
    from: Vector3,
    to: Vector3,
    across: Vector3,
    barR: number,
    colors: DaisyColors,
): { pieces: Strand[]; lastAcross: Vector3 } {
    const { width: W, thickness: t } = DAISY;
    const a = to.sub(from).unit();
    const u0 = across.sub(a.scale(across.dot(a))).unit();
    const v0 = a.cross(u0);
    // A loop's half-width (to its tape's middle): just room inside for the next loop's tape to pass through flat.
    const R = W / 2 + DAISY.room + t / 2;
    const inner = R - t / 2;
    // How far two linked loops' ends overlap when pulled tight: each tape's edges, where the other's bend has curved
    // back furthest, touch.
    const overlap = 2 * (R - Math.sqrt(inner * inner - (W * W) / 4));
    // Each end loop goes round its bar, its tape's middle that far past the bar's middle.
    const past = barR + t / 2;
    const reach = to.distanceTo(from) + 2 * past;
    const count = Math.max(1, Math.round((reach - overlap) / (DAISY.link - overlap)));
    const link = (reach + (count - 1) * overlap) / count;
    const pieces: Strand[] = [];
    let width = u0;
    for (let i = 0; i < count; i++) {
        // Each loop's tape lies across its own plane: the first's along the bar, the next's square to it.
        width = i % 2 === 0 ? u0 : v0;
        const side = i % 2 === 0 ? v0 : u0;
        const centre = from.add(a.scale(-past + link / 2 + i * (link - overlap)));
        const half = link / 2 - R;
        // Round the loop: up one leg, round the far end, down the other leg and round the near end.
        const legSteps = Math.max(1, Math.ceil((2 * half) / DAISY.step));
        const leg = (sign: 1 | -1) =>
            Array.from({ length: legSteps }, (_, k) =>
                centre
                    .add(side.scale(sign * R))
                    .add(a.scale(sign * (-half + (2 * half * k) / legSteps))),
            );
        const end = (sign: 1 | -1) =>
            Array.from({ length: DAISY.bend }, (_, k) => {
                const phi = (Math.PI * k) / DAISY.bend;
                return centre
                    .add(a.scale(sign * (half + R * Math.sin(phi))))
                    .add(side.scale(sign * R * Math.cos(phi)));
            });
        const round = [...leg(1), ...end(1), ...leg(-1), ...end(-1)];
        const points = [...round, round[0]];
        const last = i === count - 1;
        const profile = points.map(() => ({ width: W, thickness: t, across: width }));
        const closed = (strands: Strand[]) =>
            strands.map((s, k) => ({
                ...s,
                capA: k === 0 ? false : s.capA,
                capB: k === strands.length - 1 ? false : s.capB,
            }));
        pieces.push(...closed(tapeRun(points, profile, width, colors.tape, W / 2)));
        // Its edges, a little proud of the tape on both faces.
        const edge = 0.0025;
        for (const s of [-1, 1])
            pieces.push(
                ...closed(
                    tapeRun(
                        points.map((q) => q.add(width.scale((s * (W - edge)) / 2))),
                        points.map(() => ({ width: edge, thickness: t + 0.0006, across: width })),
                        width,
                        last ? colors.tab : colors.edge,
                        edge / 2,
                    ),
                ).map((p) => ({ ...p, fine: edge })),
            );
        // Its bar tack, across the middle of one leg where it's sewn shut.
        const tackAt = centre.add(side.scale(R));
        const tackHalf = (DAISY.tack.across * W) / 2;
        pieces.push(
            ...tapeRun(
                [tackAt.sub(width.scale(tackHalf)), tackAt.add(width.scale(tackHalf))],
                [0, 1].map(() => ({ width: DAISY.tack.long, thickness: t + 0.001, across: a })),
                a,
                colors.tack,
                DAISY.tack.long / 2,
            ).map((p) => ({ ...p, fine: DAISY.tack.long })),
        );
    }
    return { pieces, lastAcross: width };
}

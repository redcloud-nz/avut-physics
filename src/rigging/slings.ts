import { TAPE } from "@/abseil-tower/rig";
import { type Vector3 } from "@/lib/vector3";
import { tapeLayers } from "@/scene/pieces";
import type { Strand } from "@/scene/pieces";

import "./hardware";

import { line } from "./rope";

/** Slings and webbing as pieces: round slings and tape, their stripes and stitching, and slings basketed round a bar. */

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
        thickness: TAPE.thickness,
        r: 0.0125,
        color: "var(--fox-sling)",
        // Climbing tape is flat already, and a carabiner's bar is wide enough for it not to bunch.
        bunched: { width: 0.025, thickness: TAPE.thickness, over: 0.06 },
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
 * short strands so it sorts where it is; `r` is how thick the flat views draw it.
 */
export function tapeRun(
    points: Vector3[],
    profile: TapeSize[],
    across: Vector3,
    color: string,
    r: number,
): Strand[] {
    const piece = 12;
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
 * last of its legs it bunches up, narrower and thicker. `log` is the log's middle (its axis `along`, `logR` its
 * radius), `bar` the middle of the crown bar (its radius `barR`), and `up` a way square to the line between them and
 * to `along`, which the top leg is on. The loop crosses itself round the crown, where it changes layer.
 */
export function basketedSling(
    kind: keyof typeof SLINGS,
    log: Vector3,
    logR: number,
    bar: Vector3,
    barR: number,
    up: Vector3,
    along: Vector3,
): Strand[] {
    const { width, thickness, r, color, bunched } = SLINGS[kind];
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
    const r1 = logR + thickness / 2;
    const rb = (layer: number) => barR + bunched.thickness * (layer + 0.5);
    type Flat2 = [number, number];
    // The straight line from the log (on its top or bottom, `s1` ±1) to the crown (on its top or bottom, `s2`), the
    // crown `layer` out: where it leaves each.
    const tangent = (s1: number, s2: number, layer: number): { log: number; bar: number } => {
        const r2 = rb(layer);
        if (s1 === s2) {
            const t = Math.acos((r1 - r2) / D);
            return { log: s1 * t, bar: s1 * t };
        }
        const t = Math.acos((r1 + r2) / D);
        return { log: s1 * t, bar: Math.PI + s1 * t };
    };
    const onLog = (angle: number): Flat2 => [r1 * Math.cos(angle), r1 * Math.sin(angle)];
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
    const arc = (from: number, to: number, k: number) => {
        for (let i = 0; i < 16; i++) {
            const [x, y] = onLog(from + ((to - from) * i) / 16);
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
    const tape = tapeRun(points, profile, z, color, r);
    return [
        ...tape,
        ...(kind === "round" ? stripes(points, profile, z) : stitching(points, profile, z)),
    ];
}

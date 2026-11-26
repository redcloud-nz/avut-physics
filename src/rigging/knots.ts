import { knot3dFile } from "@/knot-editor-3d/knot-file";
import { convexHull } from "@/lib/hull";
import { clamp } from "@/lib/math";
import { arcLengths } from "@/lib/rope-3d/rope";
import { Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";
import type { Piece } from "@/scene/pieces";

import { CARABINER_R, CARABINER_WIDTH } from "./hardware";
import FIGURE_8_BIG_LOOP_JSON from "./knots/figure-8-big-loop.json";
import FIGURE_8_SINGLE_JSON from "./knots/figure-8-single.json";
import FIGURE_8_JSON from "./knots/figure-8.json";
import { line } from "./rope";

/**
 * Knots in 3D: figure 8s on a bight (tightened by hand in the 3D knot editor and saved in `knots/`), big loops round
 * bars, stoppers, and a rope's knot on a carabiner.
 */

const UP = vec3(0, 1, 0);
const ACROSS = vec3(0, 0, 1);

/** The figure 8 on a bight, tightened in 3D round a carabiner-thick bar and edited in /knot-editor-3d. */
const FIGURE_8 = knot3dFile("figure-8.json", FIGURE_8_JSON);

/** A knot's rope as drawn: the file's, its tail (the straight run at its end, out of the knot) cut to half its length. */
function halveTail(points: readonly Vector3[]): Vector3[] {
    const n = points.length;
    const way = points[n - 1].sub(points[n - 2]).unit();
    // Back up the tail while it runs straight, within 10 degrees of the way it ends.
    let k = n - 2;
    while (
        k > 0 &&
        points[k]
            .sub(points[k - 1])
            .unit()
            .dot(way) > Math.cos(Math.PI / 18)
    )
        k--;
    const arc = arcLengths(points.slice(k));
    const half = arc.at(-1)! / 2;
    const keep = arc.findIndex((s) => s > half);
    return points.slice(0, k + keep);
}

/** The figure 8 on a bight's rope as drawn, its tail halved. */
const FIGURE_8_ROPE = halveTail(FIGURE_8.rope.points);

/** How much of each of a big loop's legs is kept as tied (metres, at the knot file's size) before it opens out. */
const BIG_LOOP_KEEP = 0.03;

/**
 * The figure 8 on a bight tied with a big loop, as for a guy dropped over a post: edited in /knot-editor-3d for its
 * knot. Its loop's made again to fit each post (`bigLoop`), so only the knot matters.
 */
const FIGURE_8_BIG_LOOP = knot3dFile("figure-8-big-loop.json", FIGURE_8_BIG_LOOP_JSON);

const FIGURE_8_BIG_LOOP_ROPE = halveTail(FIGURE_8_BIG_LOOP.rope.points);

/** Where its loop leaves the knot and comes back to it. */
const BIG_LOOP_ENDS = loopEnds(
    FIGURE_8_BIG_LOOP_ROPE,
    FIGURE_8_BIG_LOOP.rope.seg,
    FIGURE_8_BIG_LOOP.knot,
    BIG_LOOP_KEEP,
);

/** The single figure 8, a stopper in a rope's end, edited in /knot-editor-3d from the Rescue Knots drawing. */
const FIGURE_8_SINGLE = knot3dFile("figure-8-single.json", FIGURE_8_SINGLE_JSON);

/** The single figure 8's rope as drawn, from its standing end, its tail halved. */
const FIGURE_8_SINGLE_ROPE = halveTail(FIGURE_8_SINGLE.rope.points);

/**
 * A figure 8 stopper tied in a rope's end: the rope arriving at `at` heading along `dir`, and on through the knot to
 * the tail's end, drawn at the size of a rope `ropeR` thick.
 */
export function stopper(at: Vector3, dir: Vector3, ropeR: number): Vector3[] {
    const { diameter } = FIGURE_8_SINGLE;
    const points = FIGURE_8_SINGLE_ROPE;
    const scale = ropeR / (diameter / 2);
    // The knot's way in along its standing part, turned onto `dir`, its sides kept level where they can be.
    const frame = (u: Vector3) => {
        const side = Math.abs(u.y) < 0.9 ? UP.cross(u).unit() : ACROSS.cross(u).unit();
        return [u, side, u.cross(side)];
    };
    const [u0, v0, w0] = frame(points[1].sub(points[0]).unit());
    const [u, v, w] = frame(dir.unit());
    return points.map((p) => {
        const q = p.sub(points[0]).scale(scale);
        return at
            .add(u.scale(q.dot(u0)))
            .add(v.scale(q.dot(v0)))
            .add(w.scale(q.dot(w0)));
    });
}

/** A figure 8 on a bight tied into something, as `figure8` draws it. */
export type Figure8 = {
    /** The rope from the tail's end, round through the knot, to where the standing part leaves it. */
    rope: Vector3[];
    /** Where the standing part leaves the knot, for the rope to go on from. */
    end: Vector3;
    /** How far from the bar, towards the pull, the knot reaches. */
    reach: number;
};

/**
 * A figure 8 on a bight tied into a bar (a carabiner's, a shackle's pin, an eye): the flying fox's figure 8, its bight
 * round the bar at `bar` (on its middle line), which runs along `axis` and is `barR` thick, and the knot lying towards
 * `toward`, the way its standing part pulls. It's drawn at the size of a rope `ropeR` thick, its bight opened or closed
 * to fit round the bar (blended out over the next few centimetres of the loop).
 *
 * With `loop`, the loop's a big one dropped over a post or bar: its legs run straight from the knot, `loop` from the
 * bar's middle, out to the bar and pulled snug round its far side. Its plane holds the pull, square to `axis` as near
 * as it can be, and the loop hugs what it's round where that plane cuts it: `around` (a square post or bar lies flat
 * along its faces), or by default the round bar.
 */
export function figure8(
    bar: Vector3,
    axis: Vector3,
    barR: number,
    toward: Vector3,
    ropeR: number,
    loop?: number,
    around: Prism[] = [roundBar(bar, axis, barR)],
): Figure8 {
    const { props, diameter } = loop === undefined ? FIGURE_8 : FIGURE_8_BIG_LOOP;
    const at = props[0];
    const scale = ropeR / (diameter / 2);
    // The knot's own axes turned onto the bar's: its bar along z, and back up its standing part along y. A big loop
    // lies in the plane of the pull, square to it, its bar's axis taken square to the pull.
    const off = toward.sub(bar);
    const a = axis.unit();
    const slant = loop === undefined ? off.sub(a.scale(off.dot(a))) : off;
    const down = slant.unit();
    const zRaw = loop === undefined ? a : a.sub(down.scale(a.dot(down)));
    const z = zRaw.unit();
    const y = down.neg();
    const x = y.cross(z);
    const local = (loop === undefined ? FIGURE_8_ROPE : FIGURE_8_BIG_LOOP_ROPE).map((p) =>
        p.sub(at.at).scale(scale),
    );
    let shaped: Vector3[];
    if (loop === undefined) {
        // The bight's middle line round the bar, as tightened (scaled) and as it needs to be.
        const [was, wants] = [scale * (at.r + diameter / 2), barR + ropeR];
        const blend = was + 0.03 * scale;
        shaped = local.map((q) => {
            const d = Math.hypot(q.x, q.y);
            const t = clamp((blend - d) / (blend - was), 0, 1);
            const f = d > 0 ? (d + (wants - was) * t) / d : 1;
            return vec3(q.x * f, q.y * f, q.z);
        });
    } else {
        // Each long edge of what it's round, grown by the rope's radius (a hair more, to sit just clear), cut by the
        // loop's plane, in the knot's own axes.
        const cut = around.flatMap(({ along, corners }) =>
            corners(ropeR * 1.02).map((c) => {
                const p = c.add(along.scale(-c.sub(bar).dot(z) / along.dot(z))).sub(bar);
                return new Vector2(p.dot(y.cross(z)), p.dot(y));
            }),
        );
        shaped = bigLoop(local, BIG_LOOP_ENDS, cut, ropeR, loop, 0.003 * scale);
    }
    const points = shaped.map((q) => bar.add(x.scale(q.x)).add(y.scale(q.y)).add(z.scale(q.z)));
    const reach = Math.max(...points.map((p) => p.sub(bar).dot(down)));
    // The file runs from the standing end: the tail's end comes first reversed.
    return { rope: points.reverse(), end: points[points.length - 1], reach };
}

/**
 * Where a knot's loop is: the points between its last knot segment before the loop's top (the highest point) and its
 * first knot segment after, by the file's `knot` list, less `keep` (metres) of each leg as it leaves the knot. Returns
 * the last point kept before the loop and the first after it.
 */
export function loopEnds(
    points: readonly Vector3[],
    seg: readonly number[],
    knot: readonly number[],
    keep = 0,
): [number, number] {
    let top = 0;
    points.forEach((q, i) => q.y > points[top].y && (top = i));
    const inKnot = new Set(knot);
    let a = top;
    while (a > 0 && !inKnot.has(seg[a])) a--;
    let b = top;
    while (b < points.length - 1 && !inKnot.has(seg[b])) b++;
    for (let s = 0; a < top - 1 && s < keep; a++) s += points[a].distanceTo(points[a + 1]);
    for (let s = 0; b > top + 1 && s < keep; b--) s += points[b].distanceTo(points[b - 1]);
    return [a, b];
}

/** How tight, in rope radii, a big loop bends round a square post's or bar's corners. */
const BIG_LOOP_BEND = 4;

/**
 * Something a big loop goes round: a straight post or bar running along `along`, its long edges through `corners`
 * (round one, many of them), with it grown all round by `grow`.
 */
export type Prism = { along: Vector3; corners: (grow: number) => Vector3[] };

/** A round bar `r` thick along `along` through `at`. */
export function roundBar(at: Vector3, along: Vector3, r: number, n = 32): Prism {
    const a = along.unit();
    const u = (Math.abs(a.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0)).cross(a).unit();
    const v = a.cross(u);
    const corners = (grow: number) =>
        Array.from({ length: n }, (_, k) => {
            const t = (2 * Math.PI * k) / n;
            return at.add(u.scale((r + grow) * Math.cos(t))).add(v.scale((r + grow) * Math.sin(t)));
        });
    return { along: a, corners };
}

/** A box section along `along` through `at`: `d` deep along `face` (square to `along`), `w` wide across. */
export function boxBar(at: Vector3, along: Vector3, face: Vector3, d: number, w: number): Prism {
    const a = along.unit();
    const u = face.sub(a.scale(face.dot(a))).unit();
    const v = a.cross(u);
    const corners = (grow: number) =>
        [
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1],
        ].map(([i, j]) => at.add(u.scale(i * (d / 2 + grow))).add(v.scale(j * (w / 2 + grow))));
    return { along: a, corners };
}

/**
 * The figure 8's rope (`local`: its own axes, y up its loop towards the bar) with its loop made big, its bar's middle
 * moved to the origin: the loop's legs, from where they leave the knot (points `ends`, kept), run straight out to what
 * it's round (`cut`: the outline in the loop's plane, x and y about the bar's middle, that the rope's middle line keeps
 * clear of) and round its far side, snug, its corners bent to suit a rope `ropeR` thick; the knot sits `reach` below the origin. Points about `step` apart. Says which of
 * `local`'s points it replaced (`from` to `to`) and with how many.
 */
export function bigLoop(
    local: Vector3[],
    ends: [number, number],
    cut: readonly Vector2[],
    ropeR: number,
    reach: number,
    step: number,
): Vector3[] & { replaced: { from: number; to: number; by: number } } {
    const [i, j] = [ends[0] + 1, ends[1] - 1];
    // From the last point kept on one leg, to the first kept on the other.
    const [A, B] = [local[ends[0]], local[ends[1]]];
    const centre = vec3((A.x + B.x) / 2, Math.max(A.y, B.y) + reach, (A.z + B.z) / 2);
    const flat = (q: Vector3) => new Vector2(q.x - centre.x, q.y - centre.y);
    const [a, b] = [flat(A), flat(B)];
    // The rope's middle line round it, bent round its corners no tighter than `BIG_LOOP_BEND` rope radii: the outline
    // taken in and then grown again by the bend. Taken in only so far that each corner's arc still goes round the
    // corner (less where the corner's sharper), so it lies flat along long faces but stands off short ones. Then pulled
    // tight from the legs: the hull of that and the legs' ends.
    const bend = BIG_LOOP_BEND * ropeR;
    const shape = convexHull(cut);
    const around = (k: number) => [
        shape[(k + shape.length - 1) % shape.length],
        shape[k],
        shape[(k + 1) % shape.length],
    ];
    const taken = Math.min(
        ...shape.map((_, k) => {
            const [o, p, q] = around(k);
            const turn = Math.acos(clamp(o.sub(p).unit().dot(q.sub(p).unit()), -1, 1));
            return bend * Math.sin(turn / 2);
        }),
    );
    const inset = shape.map((_, k) => {
        // Where its two faces either side, each moved in, meet.
        const [o, p, q] = around(k);
        const [d0, d1] = [p.sub(o).unit(), q.sub(p).unit()];
        const inward = (d: Vector2) => new Vector2(-d.y, d.x).scale(taken);
        const [s0, s1] = [o.add(inward(d0)), p.add(inward(d1))];
        const t = s1.sub(s0).cross(d1) / d0.cross(d1);
        return s0.add(d0.scale(t));
    });
    const round = Array.from({ length: 24 }, (_, k) => (2 * Math.PI * k) / 24);
    const outline = inset.flatMap((c) =>
        round.map((t) => c.add(new Vector2(bend * Math.cos(t), bend * Math.sin(t)))),
    );
    const hull = convexHull([a, b, ...outline]);
    const [ia, ib] = [hull.indexOf(a), hull.indexOf(b)];
    if (ia < 0 || ib < 0) throw new Error("A big loop's legs end inside what it goes round");
    // The way round from a to b over the far side: the longer of the two ways round the hull.
    const way = (dir: number) => {
        const run = [a];
        for (let k = ia; k !== ib; ) run.push(hull[(k = (k + dir + hull.length) % hull.length)]);
        return run;
    };
    const [up, down] = [way(1), way(-1)];
    const run = up.length > down.length ? up : down;
    const path: Vector2[] = [];
    // Each leg leaves the knot the way it was going, curving onto the line out to the outline (a cubic Bézier).
    const curve = (p: Vector2, from: Vector2, q: Vector2, to: Vector2) => {
        const l = p.distanceTo(q) / 3;
        const [c1, c2] = [p.add(from.scale(l)), q.sub(to.scale(l))];
        const n = Math.max(1, Math.ceil((3 * l) / step));
        for (let k = 1; k <= n; k++) {
            const t = k / n;
            const u = 1 - t;
            path.push(
                p
                    .scale(u * u * u)
                    .add(c1.scale(3 * u * u * t))
                    .add(c2.scale(3 * u * t * t))
                    .add(q.scale(t * t * t)),
            );
        }
    };
    const [p0, p1] = [run[1], run[run.length - 2]];
    const leaving = a.sub(flat(local[ends[0] - 1])).unit();
    const arriving = flat(local[ends[1] + 1])
        .sub(b)
        .unit();
    curve(a, leaving, p0, p0.sub(a).unit());
    const wrapFrom = path.length;
    // Round the outline, its flat runs cut to `step`.
    for (let k = 2; k < run.length - 1; k++) {
        const n = Math.max(1, Math.ceil(run[k - 1].distanceTo(run[k]) / step));
        for (let m = 1; m <= n; m++) path.push(run[k - 1].lerp(run[k], m / n));
    }
    const wrapTo = path.length;
    curve(p1, b.sub(p1).unit(), b, arriving);
    path.pop();
    // Each leg's depth (z) eases from its own to the loop's plane (the middle of the two) along it, so the loop lies in
    // its plane where it's round what it's round.
    const mid = centre.z;
    const ease = (t: number) => t * t * (3 - 2 * t);
    const looped = path.map((p, k) => {
        const z =
            k < wrapFrom
                ? A.z + (mid - A.z) * ease((k + 1) / wrapFrom)
                : k >= wrapTo
                  ? mid + (B.z - mid) * ease((k - wrapTo + 1) / (path.length - wrapTo + 1))
                  : mid;
        return vec3(centre.x + p.x, centre.y + p.y, z);
    });
    const points = [...local.slice(0, i), ...looped, ...local.slice(j + 1)].map((q) =>
        q.sub(centre),
    );
    return Object.assign(points, { replaced: { from: i, to: j, by: looped.length } });
}

/**
 * A rope from a carabiner hanging down with its gate towards `gate`, tied into its bottom bar (whose middle is `at`)
 * with a figure 8 on a bight and on through `rest`: in the middle of the bar, or `spine` (radians) round the bend
 * towards the spine. The carabiner hangs straight down unless it's swung towards `down`. Points of `rest` the knot
 * already covers are left out.
 */
export function tiedTo(
    at: Vector3,
    rest: Vector3[],
    r: number,
    color: string,
    spine = 0,
    down = vec3(0, -1, 0),
    gate = ACROSS,
): Piece[] {
    const { knot, bar } = carabinerKnot(at, rest[0], r, spine, down, gate);
    return line([...knot.rope, ...beyond(knot, bar, rest)], r, color, "rope", { a: true });
}

/**
 * A figure 8 on a bight tied into a carabiner's bottom bar (whose middle is `at`), its rope pulling towards `toward`:
 * in the middle of the bar, or `spine` (radians) round the bend towards the spine, as `tiedTo` ties it. Returns the knot
 * and the point on the bar it's round.
 */
export function carabinerKnot(
    at: Vector3,
    toward: Vector3,
    r: number,
    spine = 0,
    down = vec3(0, -1, 0),
    gate = ACROSS,
): { knot: Figure8; bar: Vector3 } {
    const end = CARABINER_WIDTH / 2;
    // Round the bottom bend's middle line, from the bottom towards the spine (away from the gate).
    const bend = at.sub(down.scale(end));
    const bar = bend.sub(gate.scale(end * Math.sin(spine))).add(down.scale(end * Math.cos(spine)));
    const axis = gate.scale(Math.cos(spine)).add(down.scale(Math.sin(spine)));
    return { knot: figure8(bar, axis, CARABINER_R, toward, r), bar };
}

/** The points of `route` past the reach of `knot`, tied into the bar at `bar`. */
export function beyond(knot: Figure8, bar: Vector3, route: Vector3[]): Vector3[] {
    const pull = knot.end.sub(bar).unit();
    const i = route.findIndex((p) => p.sub(bar).dot(pull) > knot.reach + 0.01);
    return i < 0 ? route.slice(-1) : route.slice(i);
}

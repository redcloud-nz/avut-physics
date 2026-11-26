import { C, PULLEY_COLORS } from "@/flying-fox/colors";
import { groundY, hawserY, onGround, RIG } from "@/flying-fox/site";
import { catmullRom } from "@/lib/curve3";
import { bisect } from "@/lib/numeric/roots";
import { vec3, type Vector3 } from "@/lib/vector3";
import { EYE_BOLT, eyeBolt, eyeFrame, pulley, wrap } from "@/rigging/hardware";
import { figure8, type Prism } from "@/rigging/knots";
import { bar, hanging, line, towards } from "@/rigging/rope";
import { basketedSling } from "@/rigging/slings";
import { type Piece } from "@/scene/pieces";

/** The flying fox's own builders that several parts of its rig use: guys and pickets, pulleys rigged on a carabiner, lashings, choked slings, made-off and swaged eyes. */

export const UP = vec3(0, 1, 0);

export const ACROSS = vec3(0, 0, 1);

/**
 * How far a line from `a` to `b` sags at its middle hanging as the hawsers do, `times` as much: a hanging line's sag
 * goes as the square of its length for the same tension per weight, so it's scaled from the unloaded hawsers'. If
 * that would bring it within `clear` of the ground, it sags only as far as keeps it that far up.
 */
export function sagLike(a: Vector3, b: Vector3, times = 1, clear = 0.5): number {
    const span = RIG.to.x - RIG.from.x;
    const mid = (RIG.from.x + RIG.to.x) / 2;
    const hawser = (RIG.from.y + RIG.to.y) / 2 - hawserY(mid);
    const want = times * hawser * (a.distanceTo(b) / span) ** 2;
    const clears = (sag: number) =>
        hanging(a, b, sag, 60).every((p) => p.y >= groundY(p.x) + clear);
    if (clears(want)) return want;
    // As much as still clears, by halving the difference.
    return bisect(clears, 0, want, 30)[0];
}

/**
 * A star picket driven at `at` (its height is above the ground there), leaning back from the pull (a level direction) by 25°, so a rope pulling at that
 * angle is square to it, 0.6 m of it out of the ground, with a yellow safety cap on its top. Returns its pieces and its
 * top.
 */
export function picket(
    at: Vector3,
    away: Vector3,
): { pieces: Piece[]; top: Vector3; tie: Vector3 } {
    // `at` is where it's driven across the site; it stands on the ground there.
    const base = onGround(at.x, at.y, at.z);
    const lean = 25 * (Math.PI / 180);
    const dir = away
        .unit()
        .scale(Math.sin(lean))
        .add(UP.scale(Math.cos(lean)));
    const top = base.add(dir.scale(0.6));
    return {
        pieces: [
            ...bar(base.sub(dir.scale(0.05)), top, 0.016, C.picket),
            ...bar(top.sub(dir.scale(0.02)), top.add(dir.scale(0.05)), 0.026, C.cap),
        ],
        top,
        // Ropes are tied low on a picket, just above the ground.
        tie: base.add(dir.scale(0.1)),
    };
}

/** How far out from a post or bar the knot of a big loop over it sits (from the post's middle). */
export const BIG_LOOP = 0.3;

/**
 * A guy from `from` (the middle of what its loop goes round, `around`) to a picket at `at`, the picket leaning away
 * from it: tied with a figure 8 on a bight, its big loop round a post dropped over it, square to `axis` as near as it
 * can be (upright by default). Dropped onto `settle`, the loop rests where it's dropped or as little above as clears
 * what's under it (`clear` says whether a point of the rope's middle line is clear) and the loops already on the post
 * (`others`, which it joins).
 */
export function guy(
    from: Vector3,
    at: Vector3,
    r: number,
    color: string,
    around: Prism[],
    {
        axis = UP,
        settle,
    }: { axis?: Vector3; settle?: { clear: (p: Vector3) => boolean; others: Vector3[][] } } = {},
): Piece[] {
    const p = picket(at, towards(from, at));
    const knot = figure8(from, axis, 0, p.tie, r, BIG_LOOP, around);
    let rope = knot.rope;
    let end = knot.end;
    if (settle) {
        const near = settle.others.flat().filter((q) => q.distanceTo(from) < 0.5);
        const mine = rope.filter((q) => q.distanceTo(from) < 0.5);
        const fits = (lift: number) =>
            mine.every((q) => {
                const up = q.add(UP.scale(lift));
                return settle.clear(up) && near.every((o) => o.distanceTo(up) >= 2 * r);
            });
        // Raised a quarter of the rope's thickness at a time until it fits.
        let lift = 0;
        while (!fits(lift) && lift < 0.3) lift += r / 4;
        rope = rope.map((q) => q.add(UP.scale(lift)));
        end = end.add(UP.scale(lift));
        settle.others.push(rope);
    }
    return [
        ...p.pieces,
        ...line([...rope, ...hanging(end, p.tie, 0.05, 12)], r, color, "rope", { a: true }),
    ];
}

/** A pulley's sheave at `at`, its axle along `axle`. */

/** The bar of a pulley's carabiner (its radius). */
const CARABINER_BAR = 0.0045;

/**
 * A rescue pulley, its rope running off towards points `a` and `b`, and the rope round it from `a`'s side to `b`'s.
 * Clipped into an eye bolt screwed into a post or arm at `base`, standing out towards `out`, it's moved from `near`
 * until its carabiner hangs in the eye. The eye's turned into the plane of `out` and `toward`, or to face the pull if
 * that's not given. Hung from a sling, it stays at `near` with the sling up to `mount`.
 */
export function rigPulley(
    near: Vector3,
    a: Vector3,
    b: Vector3,
    ropeR: number,
    hung:
        | { eyeBolt: { base: Vector3; out: Vector3; toward?: Vector3 } }
        | { basket: { spar: Vector3; along: Vector3; r: number; drop: number } },
) {
    const build = (centre: Vector3) =>
        pulley({ centre, toA: a.sub(centre), toB: b.sub(centre), ropeR, colors: PULLEY_COLORS });
    let centre = near;
    let p = build(centre);
    const extra: Piece[] = [];
    if ("basket" in hung) {
        // A climbing sling basketed over a spar (its middle `spar`, running along `along`), its two legs down to the
        // carabiner `drop` below the spar's middle. The pulley swings until the sling lines up with the pull of its
        // rope, as with an eye, moving half way each time so it settles.
        const { spar, along, r, drop } = hung.basket;
        const axis = along.unit();
        const square = (v: Vector3) => v.sub(axis.scale(v.dot(axis)));
        for (let i = 0; i < 100; i++) {
            const hangs = square(p.up).unit();
            const hook = spar.sub(hangs.scale(drop));
            const next = centre.lerp(hook.sub(p.hook.sub(centre)), 0.5);
            const moved = next.distanceTo(centre);
            centre = next;
            p = build(centre);
            if (moved < 1e-5) break;
        }
        // The sling doubled round the spar, each leg's bight through the carabiner round its top bar.
        const level = spar.add(axis.scale(axis.dot(p.hook.sub(spar))));
        const e = square(p.hook.sub(spar)).unit();
        extra.push(
            ...basketedSling("climbing", level, r, p.hook, CARABINER_BAR, axis.cross(e), axis),
        );
    } else {
        const { base, out, toward } = hung.eyeBolt;
        const mount = base.add(out.unit().scale(EYE_BOLT.centre));
        // Where the carabiner's top bar sits: on the eye's bar, at the edge the pull draws it to (across the hole
        // from it, if the eye's turned flat), and on the far side of the bar from the pull.
        const hookIn = (pull: Vector3) => {
            const { o, m } = eyeFrame(out, toward ?? pull);
            const inPlane = pull.sub(m.scale(pull.dot(m)));
            const edge = inPlane.len() > 1e-6 ? inPlane.unit() : o;
            return mount.add(edge.scale(EYE_BOLT.r)).sub(pull.scale(EYE_BOLT.bar + CARABINER_BAR));
        };
        // Its carabiner's top in the eye, the way the pulley pulls.
        // Until it settles. Each move turns it, as its rope's angles change, and with the rope running off close by it
        // would swing past where it settles, so it moves only halfway each time.
        for (let i = 0; i < 100; i++) {
            // Through the eye like links of a chain: the carabiner's top bar rests on the eye's bar.
            const hook = hookIn(p.up.neg());
            const next = centre.lerp(hook.sub(p.hook.sub(centre)), 0.5);
            const moved = next.distanceTo(centre);
            centre = next;
            p = build(centre);
            if (moved < 1e-5) break;
        }
        extra.push(...eyeBolt(base, out, toward ?? p.up.neg(), C.steel).pieces);
    }
    return {
        pieces: [...p.pieces, ...extra],
        /** The pulley and its carabiner alone, without what it hangs from. */
        pulley: p.pieces,
        /** Where its carabiner hangs from, and which way is up from the pulley to it. */
        hook: p.hook,
        up: p.up,
        a: p.a,
        b: p.b,
        round: wrap(centre, p.a, p.b),
        centre,
    };
}

/** The lashings' rope: 12 mm natural fibre. */
export const LASHING_R = 0.007;

/**
 * A square lashing where a spar lies across a pole, touching it: turns of rope over the spar either side of the pole and
 * round the back of the pole above and below the spar, each turn outside the last. `pole` and `spar` are their middles
 * where they cross, `up` the pole's direction and `along` the spar's; the spar lies on the side `pole` to `spar` points.
 */
export function squareLashing(
    pole: Vector3,
    poleR: number,
    spar: Vector3,
    sparR: number,
    up: Vector3,
    along: Vector3,
    turns = 4,
): Piece[] {
    const u = up.unit();
    const a = along.unit();
    const n = spar
        .sub(pole)
        .sub(u.scale(spar.sub(pole).dot(u)))
        .unit();
    const pieces: Piece[] = [];
    const rope = 2 * LASHING_R;
    for (let k = 0; k < turns; k++) {
        // Over the spar beside the pole, and round the pole clear of the spar.
        const w = poleR + LASHING_R + k * rope;
        const h = sparR + LASHING_R + k * rope;
        const over = sparR + LASHING_R;
        const round = poleR + LASHING_R;
        const at = (q: Vector3, side: number, lift: number) =>
            q.add(a.scale(side)).add(u.scale(lift));
        const loop = [
            spar.add(a.scale(-w)).add(n.scale(over)),
            at(spar, -w, over),
            at(pole, -round, h),
            pole.add(u.scale(h)).add(n.scale(-round)),
            at(pole, round, h),
            at(spar, w, over),
            spar.add(a.scale(w)).add(n.scale(over)),
            at(spar, w, -over),
            at(pole, round, -h),
            pole.add(u.scale(-h)).add(n.scale(-round)),
            at(pole, -round, -h),
            at(spar, -w, -over),
            spar.add(a.scale(-w)).add(n.scale(over)),
        ];
        pieces.push(...line(catmullRom(loop, 4), LASHING_R, C.fibre, "rail"));
    }
    return pieces;
}

/**
 * The steel tower, with its platform, ladder, brake support and guys. It's built about its own middle and moved off the
 * hawsers' by `TOWER.z`; what's placed by the hawsers or elsewhere on the site (the saddles, the backstay to the tree)
 * and what's placed in the site's terms already (the brake support, the top bar's eye bolts) is added after.
 */

/** Pieces left out of the overhead view. */
export const NOT_OVERHEAD = new WeakSet<Piece>();

/** Whether `piece` (one of `foxPieces`) is drawn in the overhead view. */
export const drawnOverhead = (piece: Piece) => !NOT_OVERHEAD.has(piece);

/**
 * A level frame for a line of hardware along `along`: `flat` square to the links that lie flat, `upright` square to
 * the ones that stand on edge between them.
 */
export function linkPlanes(along: Vector3): { flat: Vector3; upright: Vector3 } {
    const d = along.unit();
    const flat = UP.sub(d.scale(UP.dot(d))).unit();
    return { flat, upright: d.cross(flat) };
}

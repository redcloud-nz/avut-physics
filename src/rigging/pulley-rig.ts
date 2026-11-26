import type { Vector3 } from "@/lib/vector3";
import type { Piece } from "@/scene/pieces";

import { EYE_BOLT, eyeBolt, eyeFrame, pulley, wrap } from "./hardware";
import { basketedSling } from "./slings";

/** A rescue pulley rigged: clipped into an eye bolt, or hung from a sling basketed over a spar. */

/** The bar of a pulley's carabiner (its radius). */
const CARABINER_BAR = 0.0045;

/**
 * A rescue pulley, its rope running off towards points `a` and `b`, and the rope round it from `a`'s side to `b`'s.
 * Clipped into an eye bolt screwed into a post or arm at `base`, standing out towards `out`, it's moved from `near`
 * until its carabiner hangs in the eye. The eye's turned into the plane of `out` and `toward`, or to face the pull if
 * that's not given. Hung from a sling, it stays at `near` with the sling up to `mount`. In `colors`: the pulley's, and
 * the eye bolt's steel.
 */
export function rigPulley(
    near: Vector3,
    a: Vector3,
    b: Vector3,
    ropeR: number,
    hung:
        | { eyeBolt: { base: Vector3; out: Vector3; toward?: Vector3 } }
        | { basket: { spar: Vector3; along: Vector3; r: number; drop: number } },
    colors: { pulley: Parameters<typeof pulley>[0]["colors"]; steel: string },
) {
    const build = (centre: Vector3) =>
        pulley({ centre, toA: a.sub(centre), toB: b.sub(centre), ropeR, colors: colors.pulley });
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
        extra.push(...eyeBolt(base, out, toward ?? p.up.neg(), colors.steel).pieces);
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

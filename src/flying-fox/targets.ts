import { ANCHOR_SHACKLE, LIZARD } from "@/flying-fox/rig/log-anchor";
import { SADDLE, SLING_Z } from "@/flying-fox/rig/shear-leg";
import { BACKSTAY_SLING_Y } from "@/flying-fox/rig/tower";
import { TREE_SHACKLE } from "@/flying-fox/rig/tree";
import { vec3 } from "@/lib/vector3";
import { framing, panned, type NamedStance, type Target } from "@/scene/targets";

import {
    BAR_X,
    BLOCKS_X,
    BRAKE,
    CRADLE_Y,
    groundY,
    HAWSER_Z,
    LOG,
    onGround,
    onHawser,
    REST_X,
    RIDER,
    SHEAR_LEG,
    SPAN,
    STATIC_X,
    TOWER,
    TREE,
    TROLLEY_X,
} from "./site";

/** What the flying fox's views can lock onto (targets) and where the 3D view can stand and look round from (stances). */

export function foxTargets(): Target[] {
    const sides = [-1, 1];
    const between = (x: number) => onHawser(x, 1).lerp(onHawser(x, -1), 0.5);
    // A trolley and its dropper: from just over the hawser down past the harness to the end of the descender's brake
    // strand, about 1.2 m below the harness.
    const trolleyAt = (x: number, s: number) => {
        const at = onHawser(x, s);
        return [at.add(vec3(-0.15, 0.08, 0)), at.add(vec3(0.15, -RIDER.harness - 1.2, 0))];
    };
    // The tree's anchor: the trunk where the slings go round it, out to the end of each hawser's made-off eye (its bow
    // shackle, thimble, clamps and tail, about 0.8 m along the hawser from the sling's shackle).
    const treeEye = (s: number) => {
        const at = TREE_SHACKLE(s);
        return at.add(
            vec3(BAR_X, CRADLE_Y, s * HAWSER_Z)
                .sub(at)
                .unit()
                .scale(0.8),
        );
    };
    // The log's anchor: the log and its pickets, out to the end of each lizard's wire up its hawser.
    const lizardEnd = (s: number) => {
        const a = ANCHOR_SHACKLE(s * SLING_Z);
        return a.add(
            SADDLE(s)
                .sub(a)
                .unit()
                .scale(LIZARD.clamps.at(-1)! + LIZARD.tail),
        );
    };
    return [
        framing("top-anchor", "Top anchor", [
            onGround(TREE.x - TREE.r, 0, -TREE.r),
            onGround(TREE.x + TREE.r, BACKSTAY_SLING_Y + 0.2, TREE.r),
            ...sides.map(treeEye),
        ]),
        // The tower from its backstay's tie to the foot of its ladder, up to the top of the brake support.
        // Panned up and down, to look at the tower's feet, platform or top from close up.
        panned(
            framing("top-tower", "Top tower", [
                onGround(-1.2, 0, TOWER.z - TOWER.half - 0.3),
                onGround(1.6, BRAKE.postTop + 0.2, TOWER.z + TOWER.half + 0.3),
            ]),
            (c) => [vec3(c.x, 0.5, c.z), vec3(c.x, BRAKE.postTop, c.z)],
        ),
        framing("trolley-a", "Trolley A", trolleyAt(TROLLEY_X.a, 1)),
        framing("trolley-b", "Trolley B", trolleyAt(TROLLEY_X.b, -1)),
        // The two blocks and the joining rope sagging between them.
        framing("dynamic-brake", "Dynamic brake", [
            between(BLOCKS_X - 0.4).add(vec3(0, 0.2, -HAWSER_Z - 0.2)),
            between(BLOCKS_X + 0.4).add(vec3(0, -0.9, HAWSER_Z + 0.2)),
        ]),
        // The carabiners on the hawsers and their ropes out to the pickets either side.
        framing("static-brake", "Static brakes", [
            vec3(STATIC_X - 0.5, groundY(STATIC_X), -HAWSER_Z - 2.6),
            between(STATIC_X).add(vec3(0.5, 0.2, HAWSER_Z + 2.6)),
        ]),
        // The H-frame, from its brace to the bagging on its top spar.
        framing("bottom-tower", "Bottom tower", [
            onGround(SHEAR_LEG.x - 0.4, 0, -SHEAR_LEG.b / 2 - 0.3),
            onGround(SHEAR_LEG.x + 0.5, SHEAR_LEG.top + 0.1, SHEAR_LEG.b / 2 + 0.3),
        ]),
        // Panned level, back to the shear leg along the lizards and out along the log.
        panned(
            framing("bottom-anchor", "Bottom anchor", [
                onGround(LOG.x + 0.5, 0, -LOG.length / 2),
                onGround(LOG.x - 0.2, 1, LOG.length / 2),
                ...sides.map(lizardEnd),
            ]),
            (c) => [
                vec3(SHEAR_LEG.x, c.y, -LOG.length / 2),
                vec3(LOG.x + 0.5, c.y, LOG.length / 2),
            ],
        ),
    ];
}

/** How high a standing person's eyes are above their feet (metres). */
const EYE_HEIGHT = 1.7;

export function foxStances(): NamedStance[] {
    // The platform's deck, on the bottom cross bar.
    const deck = TOWER.lower + TOWER.rhs.h / 2 + 0.05;
    // Between the hawsers, at the hawsers' height, `x` along the span.
    const between = (x: number) => onHawser(x, 1).lerp(onHawser(x, -1), 0.5);
    return [
        (() => {
            // On the launch platform, a step back from its front edge, looking down the span and a little up and
            // towards hawser A, wide enough to take in trolley A just ahead and above.
            const at = vec3(0.3, deck + EYE_HEIGHT, TOWER.z + TOWER.platform.shift);
            return {
                slug: "loader",
                label: "Loader",
                at,
                lookAt: at.add(vec3(10, 2.1, 2.7)),
                fov: 70,
            };
        })(),
        {
            // On the ground between the hawsers, abreast where riders come to rest, looking back up the span at riders
            // coming down.
            slug: "unloader",
            label: "Unloader",
            at: onGround(REST_X, EYE_HEIGHT, 0),
            lookAt: between(SPAN / 3),
        },
        {
            // Halfway along the span, off to hawser B's side, looking across at the hawsers.
            slug: "observer",
            label: "Observer",
            at: onGround(SPAN / 2, EYE_HEIGHT, -12),
            lookAt: between(SPAN / 2),
        },
    ];
}

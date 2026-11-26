import { vec3, type Vector3 } from "@/lib/vector3";
import { SLINGS } from "@/rigging/slings";
import { type RigLabel } from "@/scene/pieces";

import { C } from "./colors";
import {
    ANCHOR_SHACKLE,
    BACKSTAY_TIE,
    BACKSTAY_TOP,
    footLinks,
    LIZARD,
    LOG_AT,
    SADDLE,
    SLING_Z,
    TIRFOR_RIG,
    TREE_CHOKE,
    TREE_SHACKLE,
    TURNBUCKLE_AT,
} from "./fox";
import {
    BAR_X,
    BLOCKS_X,
    BRAKE,
    CRADLE_Y,
    HAWSER_Z,
    hawserY,
    LOG,
    onGround,
    onHawser,
    RETURN_PULLEY,
    SADDLE_Y,
    SHEAR_LEG,
    SPAR_X,
    STATIC_X,
    TOWER,
    TREE,
    TROLLEY_X,
} from "./site";

/** What's written on the flying fox: each part's labels, for the target they belong to, and the legend. */

/** The flat views. */
export type FlatView = "side" | "overhead";

/**
 * A label in the flat views: what it names, the target it's part of (its slug: it's shown only when the views are
 * locked onto that), and the views it's written in (both unless it names them).
 */
export type FoxLabel = RigLabel & { target: string; views?: FlatView[] };

/** What the drawings name, written beside it in the flat views. */
export function foxLabels(): FoxLabel[] {
    const floor = TOWER.lower + TOWER.rhs.h / 2 + 0.05;
    const overhead: FlatView[] = ["overhead"];
    // A little way out along a guy from the top of the upright it's tied to, at `top`, towards its picket at `foot`.
    const alongGuy = (top: Vector3, foot: Vector3, out: number) => {
        const level = foot.sub(top);
        return top.lerp(foot, out / Math.hypot(level.x, level.z));
    };
    // The tower's guy on hawser A's side, out to the front.
    const towerGuyTop = vec3(0, TOWER.bar + TOWER.rhs.h / 2, TOWER.z + TOWER.half);
    const towerGuyFoot = vec3(1.6 * TOWER.top, 0, TOWER.z + TOWER.half + 1.6 * TOWER.top);
    // The shear leg's guy on hawser A's side, out towards the anchor.
    const legGuyTop = onGround(SHEAR_LEG.x, SHEAR_LEG.top, SHEAR_LEG.b / 2);
    const legGuyFoot = vec3(
        SHEAR_LEG.x + 1.6 * SHEAR_LEG.top,
        0,
        SHEAR_LEG.b / 2 + 1.6 * SHEAR_LEG.top,
    );
    // Hawser A's eye at the tree, and the way along it to the tower.
    const treeEye = TREE_SHACKLE(1);
    const toTower = vec3(BAR_X, CRADLE_Y, HAWSER_Z).sub(treeEye).unit();
    // The ladder's middle, between its foot and where it rests on the bottom bar, between the platform and the upright
    // on hawser B's side.
    const ladderZ = TOWER.z + (TOWER.platform.shift - TOWER.platform.width / 2 - TOWER.half) / 2;
    const ladderRest = vec3(BAR_X, TOWER.lower, ladderZ);
    const ladder = ladderRest.lerp(onGround(BAR_X + TOWER.lower / 4, 0, ladderZ), 0.5);
    const foot = footLinks(1);
    return [
        // The tree.
        { target: "top-anchor", text: "Big tree", at: onGround(TREE.x, 1.2, 0), side: "left" },
        {
            target: "top-anchor",
            views: overhead,
            text: "Round slings, choked to offset hawsers",
            // On hawser B's sling's leg, between the choke and its shackle.
            at: TREE_CHOKE(-1).at.lerp(TREE_SHACKLE(-1), 0.6),
            side: "left",
        },
        {
            target: "top-anchor",
            views: overhead,
            text: "Backstay",
            at: BACKSTAY_TIE.end.lerp(BACKSTAY_TOP, 0.04),
            side: "right",
        },
        {
            target: "top-anchor",
            views: overhead,
            text: "Wire clamps",
            at: treeEye.add(toTower.scale(0.45)),
            side: "right",
        },
        // The tower.
        {
            target: "top-tower",
            text: "Steel tower",
            at: vec3(0, TOWER.top, TOWER.z + TOWER.half),
            side: "left",
        },
        {
            target: "top-tower",
            text: "Launch platform",
            at: vec3(0.6, floor, TOWER.z + TOWER.platform.shift),
            side: "right",
        },
        { target: "top-tower", text: "Brake pulley", at: BRAKE.pulley, side: "left" },
        {
            target: "top-tower",
            text: "Chain weight",
            at: onGround(BRAKE.chainTop.x, 0.3, BRAKE.chainTop.z),
            side: "left",
        },
        {
            target: "top-tower",
            views: overhead,
            text: "Guys",
            at: alongGuy(towerGuyTop, towerGuyFoot, 1),
            side: "right",
        },
        { target: "top-tower", views: overhead, text: "Ladder", at: ladder, side: "right" },
        {
            target: "top-tower",
            views: overhead,
            text: "Backstay",
            at: BACKSTAY_TOP.lerp(BACKSTAY_TIE.end, 0.06),
            side: "left",
        },
        {
            target: "top-tower",
            views: overhead,
            text: "Hawsers",
            at: vec3(BAR_X, CRADLE_Y, -HAWSER_Z).lerp(TREE_SHACKLE(-1), 0.07),
            side: "left",
        },
        {
            target: "top-tower",
            views: overhead,
            text: "Brake line",
            at: BRAKE.pulley.lerp(vec3(BLOCKS_X, hawserY(BLOCKS_X), 0), 0.03),
            side: "right",
        },
        {
            target: "top-tower",
            views: overhead,
            text: "Return line",
            at: RETURN_PULLEY(1).lerp(onHawser(TROLLEY_X.a, 1), 0.5),
            side: "right",
        },
        // The trolleys.
        { target: "trolley-a", text: "Trolley A", at: onHawser(TROLLEY_X.a, 1), side: "right" },
        { target: "trolley-b", text: "Trolley B", at: onHawser(TROLLEY_X.b, -1), side: "left" },
        // The dynamic brake.
        {
            target: "dynamic-brake",
            text: "Brake blocks",
            at: onHawser(BLOCKS_X, -1),
            side: "right",
        },
        {
            target: "dynamic-brake",
            views: overhead,
            text: "Hawsers",
            at: onHawser(BLOCKS_X + 0.6, 1),
            side: "right",
        },
        {
            target: "dynamic-brake",
            views: overhead,
            text: "Return line",
            at: RETURN_PULLEY(-1).lerp(onHawser(TROLLEY_X.b, -1), 0.99),
            side: "right",
        },
        {
            target: "dynamic-brake",
            views: overhead,
            text: "Brake line",
            at: vec3(BLOCKS_X - 1.6, hawserY(BLOCKS_X) - 0.2, 0),
            side: "left",
        },
        {
            target: "dynamic-brake",
            views: overhead,
            text: "Stabiliser",
            at: vec3(BLOCKS_X + 0.6, hawserY(BLOCKS_X) - 0.3, 0),
            side: "right",
        },
        // The static brakes.
        {
            target: "static-brake",
            text: "Static brakes",
            at: onHawser(STATIC_X, -1).add(vec3(0, -0.05, 0)),
            side: "right",
        },
        {
            target: "static-brake",
            views: overhead,
            text: "Carabiner",
            at: onHawser(STATIC_X, 1),
            side: "right",
        },
        {
            target: "static-brake",
            views: overhead,
            text: "Rope",
            at: onHawser(STATIC_X, 1).lerp(onGround(STATIC_X, 0, HAWSER_Z + 2.5), 0.5),
            side: "right",
        },
        {
            target: "static-brake",
            views: overhead,
            text: "Picket",
            at: onGround(STATIC_X, 0, HAWSER_Z + 2.5),
            side: "right",
        },
        // The shear leg.
        {
            target: "bottom-tower",
            text: "H-frame shear leg",
            at: onGround(SHEAR_LEG.x, SHEAR_LEG.top, 0),
            side: "right",
        },
        {
            target: "bottom-tower",
            views: overhead,
            text: "Guys",
            at: alongGuy(legGuyTop, legGuyFoot, 0.8),
            side: "right",
        },
        {
            target: "bottom-tower",
            views: overhead,
            text: "Lashings",
            at: onGround(SHEAR_LEG.x + 0.1, SHEAR_LEG.spar, SHEAR_LEG.b / 2 + 0.05),
            side: "right",
        },
        {
            target: "bottom-tower",
            views: overhead,
            text: "Hessian sacks",
            at: vec3(SPAR_X, SADDLE_Y, -HAWSER_Z - 0.09),
            side: "right",
        },
        {
            target: "bottom-tower",
            views: overhead,
            text: "Stabiliser",
            at: onGround(SHEAR_LEG.x - 1.5, 1, 0),
            side: "left",
        },
        {
            target: "bottom-tower",
            views: overhead,
            text: "Hawsers",
            at: SADDLE(1).lerp(ANCHOR_SHACKLE(SLING_Z), 0.12),
            side: "right",
        },
        // The log anchor.
        {
            target: "bottom-anchor",
            text: "Turnbuckle",
            at: TURNBUCKLE_AT(-1),
            side: "right",
        },
        {
            target: "bottom-anchor",
            text: "Lizard",
            at: ANCHOR_SHACKLE(SLING_Z).add(
                SADDLE(1).sub(ANCHOR_SHACKLE(SLING_Z)).unit().scale(LIZARD.clamps[1]),
            ),
            side: "left",
        },
        {
            target: "bottom-anchor",
            text: "Tirfor",
            at: TIRFOR_RIG.tirfor.ropeOut.add(vec3(0, 0.25, 0)),
            side: "left",
        },
        {
            target: "bottom-anchor",
            text: "Log and picket anchor",
            at: onGround(LOG.x + 0.3, 0.3, 0),
            side: "right",
        },
        {
            target: "bottom-anchor",
            views: overhead,
            text: "D shackles",
            at: foot.d1.far.lerp(foot.d2.far, 0.5),
            side: "left",
        },
        {
            target: "bottom-anchor",
            views: overhead,
            text: "Round slings",
            at: LOG_AT(SLING_Z).lerp(ANCHOR_SHACKLE(SLING_Z), 0.5),
            side: "left",
        },
        {
            target: "bottom-anchor",
            views: overhead,
            text: "Banjo lashings",
            at: onGround(LOG.x + 0.25, 0.2, -1.0),
            side: "right",
        },
    ];
}

/** The legend's lines: each rope or wire by its colour, and what it is. */
export function foxLegend(): { name: string; color: string; look: "tape" | "rope" }[] {
    return [
        { name: "Hawsers (11 mm galvanised wire)", color: C.hawser, look: "rope" },
        { name: "Return line", color: C.returnLine, look: "rope" },
        { name: "Brake line", color: C.brakeLine, look: "rope" },
        { name: "Joining rope", color: C.joining, look: "rope" },
        { name: "Stabiliser (shock cord)", color: C.shockCord, look: "rope" },
        { name: "Static brakes", color: C.staticBrake, look: "rope" },
        { name: "Droppers", color: C.dropper, look: "rope" },
        { name: "Guys", color: C.guy, look: "rope" },
        { name: "Tower backstay", color: C.backstay, look: "rope" },
        { name: "Lashings and ties (natural fibre)", color: C.fibre, look: "rope" },
        { name: "Round slings (6 t)", color: SLINGS.round.heavy, look: "tape" },
        { name: "Round slings (4 t)", color: SLINGS.round.color, look: "tape" },
        { name: "Climbing slings", color: SLINGS.climbing.color, look: "tape" },
    ];
}

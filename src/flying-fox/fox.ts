import { brakePieces } from "@/flying-fox/rig/brake";
import { hawsers } from "@/flying-fox/rig/hawsers";
import { lizardAndTirfor, logAnchor } from "@/flying-fox/rig/log-anchor";
import { shearLeg } from "@/flying-fox/rig/shear-leg";
import { tower } from "@/flying-fox/rig/tower";
import { tree } from "@/flying-fox/rig/tree";
import { trolleysAndReturn } from "@/flying-fox/rig/trolleys";
import { type Piece } from "@/scene/pieces";

/**
 * A dual-hawser flying fox braked by a chain weight, set up to Scouts NSW's "Flying Fox - Operations and Construction"
 * procedure (PRO5, 2025) on a made-up site falling steadily towards the bottom end, after a table model of one. Every
 * size not in the book is an estimate.
 *
 * Scene coordinates are metres with x along the run from the top end (the launch) to the bottom end (the landing), y up
 * and z across it, the origin on the ground under the middle of the steel tower's uprights. The ground falls along x. The hawsers run either
 * side of the centre line, hawser A on the +z side and hawser B on the −z side.
 *
 * From the top: a tree the hawsers are slung round; the FFSAC steel tower (the book's Appendix E) with the launch
 * platform, the return line's pulleys and the chain brake's pulley and weight; the two hawsers over the span; the brake
 * blocks, static brakes and a timber H-frame shear leg at the bottom; and a log and picket anchor behind it, where the
 * hawsers are tensioned.
 */

/**
 * The whole flying fox, as pieces to draw. For a run, what moves is left out: the hawsers' spans, the trolleys
 * (`runTrolley`), the return line and its pulleys (`returnRig`) and the dynamic brake (`brakeRig`).
 */
export function foxPieces({ run = false }: { run?: boolean } = {}): Piece[] {
    return [
        ...tree(),
        ...tower(),
        ...hawsers(run),
        ...trolleysAndReturn(run),
        ...(run ? [] : brakePieces()),
        ...shearLeg(),
        ...logAnchor(),
        ...lizardAndTirfor(),
    ];
}

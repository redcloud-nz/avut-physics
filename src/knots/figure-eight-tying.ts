/**
 * Tying a figure-8 by twisting a loop: form a bight, bring the end round behind the standing part to make a
 * loop, twist the top of the loop into an 8, bring the end round in front so its tip lies over the top loop, then
 * pull it through. Each step is the rope as it lies once that step is done, given by where it's pinned (see
 * `pinned-rope.ts`) in `figure-eight-tying.json`, which the rope editor at /knots/edit reads and writes. The file
 * also keeps the editor's drafts: steps changed since they were last saved there, which nothing else uses.
 */

import type { Vector2 } from "@/lib/vector2";

import data from "./figure-eight-tying.json";
import { ropePathOf, solveRope, type PinnedRope } from "./pinned-rope";
import type { RopePath } from "./rope-path";

export type TyingStepData = PinnedRope & { caption: string };
export type TyingStep = { caption: string; rope: PinnedRope; path: RopePath };

type TyingFile = { steps: TyingStepData[]; drafts?: (TyingStepData | null)[] };
const file: TyingFile = data;

/** The steps as saved in the rope editor. */
export const TYING_DATA: TyingStepData[] = file.steps;

/** For each step, the editor's draft of it if it's been changed since it was saved, or else null. */
export const TYING_DRAFTS: (TyingStepData | null)[] = TYING_DATA.map(
    (_, i) => file.drafts?.[i] ?? null,
);

/** A step's rope solved and ready to draw. */
export function tyingStep({ caption, ...rope }: TyingStepData): TyingStep {
    return { caption, rope, path: ropePathOf(rope, solveRope(rope)) };
}

export const FIGURE_EIGHT_TYING: TyingStep[] = TYING_DATA.map(tyingStep);

/**
 * The view every step shares: centred on the finished knot (at the origin), with room for each step's rope above
 * it and to each side. The standing part runs on out of the bottom, so the only end in view is the running end.
 */
export function tyingView(ropes: Vector2[][], margin = 1.5) {
    const all = ropes.flat();
    const w = 2 * (Math.max(...all.map((p) => Math.abs(p.x))) + margin);
    const h = 2 * (Math.max(...all.map((p) => -p.y)) + margin);
    return { x: -w / 2, y: -h / 2, w, h };
}

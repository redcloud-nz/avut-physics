/**
 * Tying a figure-8 by twisting a loop: form a bight, bring the end round behind the standing part to make a
 * loop, twist the top of the loop into an 8, bring the end round in front so its tip lies over the top loop, then
 * pull it through. Each step is the rope as it lies once that step is done (with arrows, if it has any, showing
 * where it goes next), given by where it's pinned (see
 * `pinned-rope.ts`) in `figure-eight-tying.json`, which the rope editor at /knots/edit reads and writes. The file
 * also keeps the editor's drafts: steps changed since they were last saved there, which nothing else uses.
 */

import data from "./figure-eight-tying.json";
import { ropePathOf, solveRope, type PinnedRope } from "./pinned-rope";
import type { RopePath } from "./rope-path";
import type { Arrow } from "./tying-arrow";

/**
 * A step: its caption, the rope, and any arrows showing where the rope goes next. A step that `continues` the one
 * before is numbered with it, as "Step 2 (cont.)".
 */
export type TyingStepData = PinnedRope & {
    caption: string;
    arrows?: Arrow[];
    continues?: boolean;
};
export type TyingStep = {
    caption: string;
    label: string;
    /** Where it's pinned, for a step laid out in the rope editor. */
    rope?: PinnedRope;
    path: RopePath;
    /** For a knot joining two ropes, the first rope, which stays put while the second (`path`) is tied round it. */
    first?: RopePath;
    arrows: Arrow[];
};

type TyingFile = { steps: TyingStepData[]; drafts?: (TyingStepData | null)[] };
const file: TyingFile = data;

/** The steps as saved in the rope editor. */
export const TYING_DATA: TyingStepData[] = file.steps;

/** For each step, the editor's draft of it if it's been changed since it was saved, or else null. */
export const TYING_DRAFTS: (TyingStepData | null)[] = TYING_DATA.map(
    (_, i) => file.drafts?.[i] ?? null,
);

/** What step `i` is called: "Step 2 of 5", or "Step 2 (cont.)" where it continues the step before. */
export function stepLabel(steps: Pick<TyingStepData, "continues">[], i: number): string {
    const numbered = (s: Pick<TyingStepData, "continues">, k: number) => k === 0 || !s.continues;
    const n = steps.slice(0, i + 1).filter(numbered).length;
    return steps[i].continues && i > 0
        ? `Step ${n} (cont.)`
        : `Step ${n} of ${steps.filter(numbered).length}`;
}

/** A step's rope solved and ready to draw. */
export function tyingStep(
    { caption, arrows = [], ...rope }: TyingStepData,
    label: string,
): TyingStep {
    return { caption, label, rope, path: ropePathOf(rope, solveRope(rope)), arrows };
}

export const FIGURE_EIGHT_TYING: TyingStep[] = TYING_DATA.map((step, i) =>
    tyingStep(step, stepLabel(TYING_DATA, i)),
);

/**
 * The view every step shares: centred on the finished knot (at the origin), with room for each step's rope above
 * it and to each side. The standing part runs on out of the bottom, so the only end in view is the running end.
 */
export function tyingView(ropes: { x: number; y: number }[][], margin = 1.5) {
    const all = ropes.flat();
    const w = 2 * (Math.max(...all.map((p) => Math.abs(p.x))) + margin);
    const h = 2 * (Math.max(...all.map((p) => -p.y)) + margin);
    return { x: -w / 2, y: -h / 2, w, h };
}

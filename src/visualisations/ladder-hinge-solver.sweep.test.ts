import { describe, expect, it } from "vitest";

import { deg } from "@/lib/math";

import { solve, type Result } from "./ladder-hinge-solver";
import { arrangement, randomInputs, setupFor } from "./ladder-hinge-solver.checks";

/** The ladder's angle and the rope's and attachment's pulls, rounded, so a change to them shows even where the
 * arrangement stays the same. */
function settled(r: Result): string {
    if (r.kind === "none") return "";
    const { phi, t1, t2 } = r.kind === "raised" ? r.eq : r.h;
    return `  (${deg(phi).toFixed(1)}°, ${t1.len().toFixed(0)} N, ${t2.len().toFixed(0)} N)`;
}

/**
 * Which arrangement each of a couple of thousand random setups settles into, with its ladder angle and the rope's
 * and attachment's pulls, against the last recorded run:
 * run `npm run test:sweep` before and after a solver change to see what it moved. Not part of `npm test`, as
 * any deliberate change to the model moves some setups; once the moves look right, record them with
 * `npm run test:sweep -- -u`.
 */
describe.runIf(process.env.SWEEP)("sweep", () => {
    it("matches the recorded arrangements", { timeout: 120_000 }, async () => {
        const lines = randomInputs(2000, 7).map((i) => {
            const r = solve(setupFor(i));
            return `${JSON.stringify(i)}  →  ${arrangement(r)}${settled(r)}`;
        });
        await expect(lines.join("\n") + "\n").toMatchFileSnapshot(
            "__snapshots__/ladder-hinge-sweep.txt",
        );
    });
});

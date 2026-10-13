import { describe, expect, it } from "vitest";
import { solve } from "./ladder-hinge-solver";
import { arrangement, randomInputs, setupFor } from "./ladder-hinge-solver.checks";

/**
 * Which arrangement each of a couple of thousand random setups settles into, against the last recorded run:
 * run `npm run test:sweep` before and after a solver change to see what it moved. Not part of `npm test`, as
 * any deliberate change to the model moves some setups; once the moves look right, record them with
 * `npm run test:sweep -- -u`.
 */
describe.runIf(process.env.SWEEP)("sweep", () => {
  it("matches the recorded arrangements", { timeout: 120_000 }, async () => {
    const lines = randomInputs(2000, 7).map((i) => `${JSON.stringify(i)}  →  ${arrangement(solve(setupFor(i)))}`);
    await expect(lines.join("\n") + "\n").toMatchFileSnapshot("__snapshots__/ladder-hinge-sweep.txt");
  });
});

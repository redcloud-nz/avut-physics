import { writeFileSync } from "node:fs";
import { format, resolveConfig } from "prettier";
import { describe, expect, it } from "vitest";

import { articles } from "../../scripts/figures.mjs";

/*
 * Checks every article's saved figures are up to date. With FIGURES=1 (`npm run figures`), works out and saves
 * those that aren't instead.
 */

const UPDATE = process.env.FIGURES === "1";
const modules = import.meta.glob<{ compute: () => unknown }>("./*.compute.ts");

describe("article figures", () => {
    for (const a of articles()) {
        it(`${a.name} are up to date`, { timeout: 600_000 }, async () => {
            if (!a.stale) return;
            if (!UPDATE)
                expect.fail(
                    `${a.name}'s figures are out of date: run \`npm run figures\` and commit the result.`,
                );
            const { compute } = await modules[`./${a.name}.compute.ts`]();
            const json = JSON.stringify({ hash: a.hash, figures: compute() });
            writeFileSync(
                a.figures,
                await format(json, { ...(await resolveConfig(a.figures)), filepath: a.figures }),
            );
        });
    }
});

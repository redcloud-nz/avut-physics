import { readFileSync, writeFileSync } from "node:fs";
import { format, resolveConfig } from "prettier";
import { describe, expect, it } from "vitest";

import { articles, dependencies, hashFor } from "../../scripts/figures.mjs";

/*
 * Checks every article's saved figures are up to date. With FIGURES=1 (`npm run figures`), works out and saves
 * those that aren't instead, first running Prettier over the files they're hashed from: the commit hook formats
 * them anyway, and a hash taken before that would be stale by the time the commit is checked.
 */

const UPDATE = process.env.FIGURES === "1";
const modules = import.meta.glob<{ compute: () => unknown }>("./*.compute.ts");

describe("article figures", () => {
    for (const a of articles()) {
        it(`${a.name} are up to date`, { timeout: 600_000 }, async () => {
            if (UPDATE) {
                for (const file of dependencies(a.compute)) await formatFile(file);
                // Formatting a file changes the hash, which leaves the saved figures stale.
                const hash = hashFor(a.compute);
                if (hash !== a.hash) Object.assign(a, { hash, stale: true });
            }
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

/** Formats a file with Prettier in place, if it isn't already. */
async function formatFile(file: string) {
    const source = readFileSync(file, "utf8");
    // As the Prettier command line does, taking the indent from .editorconfig.
    const options = await resolveConfig(file, { editorconfig: true });
    const formatted = await format(source, { ...options, filepath: file });
    if (formatted !== source) writeFileSync(file, formatted);
}

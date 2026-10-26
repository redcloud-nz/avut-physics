/**
 * Writes every knot's file (`src/knots/files/<slug>.json`) and reports on each picture: `npm run port-knots`. Skipped
 * otherwise, so `npm test` doesn't write anything. A file that's there already is left alone, since it may have been
 * edited in the knot editor since: `PORT_KNOTS=overwrite` writes it again.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";

import { writeKnotFile } from "../../knot-editor/format";
import { DRAWN_KNOTS } from "../drawn-knots";
import { ROUND_TURN_FILE } from "../round-turn";

import { convertKnot } from "./convert";

const DIR = join(__dirname, "..", "files");

it.runIf(process.env.PORT_KNOTS)(
    "ports every knot to a knot file",
    { timeout: 600_000 },
    async () => {
        mkdirSync(DIR, { recursive: true });
        const lines: string[] = [];
        for (const knot of DRAWN_KNOTS) {
            // The round turn's finished knot is a pinned rope of its own, not one of its steps.
            const pins = knot.slug.startsWith("round-turn")
                ? ROUND_TURN_FILE.steps[0].pins
                : undefined;
            const path = join(DIR, `${knot.slug}.json`);
            if (existsSync(path) && process.env.PORT_KNOTS !== "overwrite") {
                lines.push(`${knot.slug}: there already, left alone`);
                continue;
            }
            const { file, reports } = convertKnot(knot, pins);
            writeFileSync(path, await writeKnotFile(file));
            lines.push(knot.slug);
            for (const r of reports) {
                const ropes = r.ropes
                    .map(
                        (rope) =>
                            `${rope.pins} pins (${rope.linked} linked), worst ${rope.worst.toFixed(2)} mm`,
                    )
                    .join("; ");
                lines.push(
                    `  ${r.label}: ${ropes}${r.unset ? `; ${r.unset} crossings unset` : ""}`,
                );
            }
        }
        process.stdout.write(`${lines.join("\n")}\n`);
    },
);

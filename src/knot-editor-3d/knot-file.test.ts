import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import FIGURE_8 from "@/flying-fox/knots/figure-8.json";

import { knot3dFile, parseKnot3d, writeKnot3d } from "./knot-file";
import { CURRENT_VERSION } from "./versions";

const SAMPLES = join(import.meta.dirname, "samples");
const sample = (name: string) => readFileSync(join(SAMPLES, name), "utf8");

/** The current sample with `change` made to its JSON. */
function changed(change: (json: Record<string, unknown>) => void): string {
    const json = JSON.parse(sample(`v${CURRENT_VERSION}.json`)) as Record<string, unknown>;
    change(json);
    return JSON.stringify(json);
}

describe("3D knot files", () => {
    it("keeps a sample of every version, and opens each", () => {
        const names = readdirSync(SAMPLES).filter((n) => n.endsWith(".json"));
        expect(names.sort()).toEqual(
            Array.from({ length: CURRENT_VERSION }, (_, k) => `v${k + 1}.json`).sort(),
        );
        for (const name of names) expect(parseKnot3d(sample(name)).kind, name).toBe("read");
    });

    it("writes the current sample back exactly as it's saved", async () => {
        const text = sample(`v${CURRENT_VERSION}.json`);
        const read = parseKnot3d(text);
        if (read.kind !== "read") throw new Error(read.reason);
        expect(await writeKnot3d(read.file)).toBe(text);
    });

    it("reads the flying fox's figure 8", () => {
        const file = knot3dFile("figure-8.json", FIGURE_8);
        expect(file.rope.points.length).toBe(file.rope.seg.length);
        expect(file.held).toContain(1);
    });

    it("refuses what isn't a 3D knot file, or is newer than it reads", () => {
        expect(parseKnot3d("{")).toMatchObject({ kind: "error" });
        expect(parseKnot3d(changed((j) => (j.format = "avut-knot")))).toMatchObject({
            kind: "error",
            reason: expect.stringContaining("isn't a 3D knot file"),
        });
        expect(parseKnot3d(changed((j) => (j.version = CURRENT_VERSION + 1)))).toMatchObject({
            kind: "error",
            reason: expect.stringContaining("newer"),
        });
    });

    it("says where a file doesn't read", () => {
        const cases: [(j: Record<string, unknown>) => void, string][] = [
            [(j) => ((j.rope as { segments: number[] }).segments = [3, 3, 2]), "rope.segments"],
            [(j) => (j.held = [1, 4]), "held[1]"],
            [(j) => (j.knot = [2, 2]), "knot[1]"],
            [(j) => (j.stiffness = 2), "stiffness"],
            [(j) => (j.extra = 1), "unknown field"],
            [(j) => ((j.props as { along: number[] }[])[0].along = [0, 0, 0]), "props[0].along"],
        ];
        for (const [change, where] of cases)
            expect(parseKnot3d(changed(change))).toMatchObject({
                kind: "error",
                reason: expect.stringContaining(where),
            });
    });
});

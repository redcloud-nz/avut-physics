import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseKnotFile, type Picture } from "@/knot-editor/knot-file";

import { liftKnot } from "./knot-3d";
import { crossingsDiffer, drawingCrossings, ropeCrossings } from "./knot-crossings";

const DIR = "src/knots/files";
const pictureOf = (name: string): Picture => {
    const read = parseKnotFile(readFileSync(`${DIR}/${name}`, "utf8"));
    if (read.kind === "error") throw new Error(`${name}: ${read.reason}`);
    return read.file.knot;
};

describe("a drawing lifted into 3D", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));

    it.each(files)("%s keeps its drawing's crossings, in order and the right way up", (name) => {
        const picture = pictureOf(name);
        const [rope] = liftKnot(picture);
        expect(crossingsDiffer(ropeCrossings(rope.points), drawingCrossings(picture))).toBeNull();
    });

    it("lifts close crossings their full rope's thickness apart", () => {
        // The munter's half hitches cross the standing end close together: averaged, they'd come out short.
        const picture = pictureOf("munter-and-two-half-hitches.json");
        const [rope] = liftKnot(picture);
        const passes = ropeCrossings(rope.points);
        expect(passes.length).toBe(28);
        const d = rope.diameter;
        const p = rope.points;
        for (let i = 0; i < p.length - 1; i++)
            for (let j = i + 2; j < p.length - 1; j++) {
                const [a, b, c, e] = [p[i], p[i + 1], p[j], p[j + 1]];
                const den = (b.x - a.x) * (e.y - c.y) - (b.y - a.y) * (e.x - c.x);
                if (den === 0) continue;
                const t = ((c.x - a.x) * (e.y - c.y) - (c.y - a.y) * (e.x - c.x)) / den;
                const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
                if (t < 0 || t >= 1 || u < 0 || u >= 1) continue;
                const gap = Math.abs(a.z + (b.z - a.z) * t - (c.z + (e.z - c.z) * u));
                expect(gap).toBeGreaterThan(0.98 * d);
            }
    });
});

describe("crossingsDiffer", () => {
    it("names the first pass that's the wrong way up", () => {
        const wanted = [
            { crossing: 0, over: true, segment: 3 },
            { crossing: 0, over: false, segment: 5 },
        ];
        const got = [
            { crossing: 0, over: false },
            { crossing: 0, over: true },
        ];
        expect(crossingsDiffer(got, wanted)).toBe("pass 1 (on segment 3) is under, not over");
        expect(crossingsDiffer(wanted, wanted)).toBeNull();
    });
});

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseKnotFile } from "@/knot-editor/knot-file";
import { sampleRope } from "@/lib/rope-3d/pinned";
import { crossingsDiffer, drawingCrossings, ropeCrossings } from "@/rigging/knot-crossings";

import { fromPicture } from "./from-drawing";

const DIR = "src/knots/files";

describe("a 3D knot from a drawing", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));

    it.each(files)("%s keeps its drawing's crossings and segment numbers", (name) => {
        const read = parseKnotFile(readFileSync(`${DIR}/${name}`, "utf8"));
        if (read.kind === "error") throw new Error(read.reason);
        const picture = read.file.knot;
        const file = fromPicture(picture, name, name);
        const { points } = sampleRope(file.rope, file.diameter / 4);
        expect(crossingsDiffer(ropeCrossings(points), drawingCrossings(picture))).toBeNull();
        const drawn = picture.strands[0].segments.map((s) => String(s.id));
        const numbers = [...new Set(file.rope.segments.map((s) => s.name.replace(/[a-z]+$/, "")))];
        expect(numbers).toEqual(drawn);
    });
});

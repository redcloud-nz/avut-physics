import { describe, expect, it } from "vitest";

import { insertStep } from "./edits";
import type { KnotFile } from "./format";
import { highestId, idsFor } from "./ids";
import { testPicture, testStrand } from "./test-pictures";

const line = testStrand("rope", [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
]);

describe("ids", () => {
    // The knot's highest id is 1500 (its strand's segment); the step's, 2500 (its second strand's).
    const file: KnotFile = {
        name: "Test",
        frame: { x: -20, y: -20, w: 40, h: 40 },
        knot: testPicture([line]),
        steps: [{ number: 1, instructions: "", picture: testPicture([line, line]) }],
    };

    it("gives new ids above every id in the file, in any picture", () => {
        expect([highestId(file.knot), highestId(file.steps[0].picture)]).toEqual([1500, 2500]);
        const ids = idsFor(file);
        expect([ids(), ids(), ids()]).toEqual([2501, 2502, 2503]);
        expect(idsFor({ ...file, steps: [] })()).toBe(1501);
        expect(highestId({ strands: [], crossings: [], props: [] })).toBe(0);
    });

    it("keeps a picture's ids when it's copied into a step", () => {
        const { file: copied, index } = insertStep(file, "knot");
        expect(copied.steps[index].picture).toBe(file.knot);
        const { file: again } = insertStep(file, 0);
        expect(again.steps[1].picture.strands.map((s) => s.id)).toEqual([1000, 2000]);
    });
});

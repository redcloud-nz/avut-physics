import { describe, expect, it } from "vitest";

import { deleteStrand, movePin, setRopeColour } from "./edits";
import type { KnotFile } from "./knot-file";
import { editorReducer, loaded, NOTHING } from "./state";
import { free, testPicture, testStrand } from "./test-pictures";

const line = (y: number) =>
    testStrand("rope", [
        { x: 0, y },
        { x: 10, y },
    ]);

const file: KnotFile = {
    name: "Three ropes",
    frame: { x: -20, y: -20, w: 40, h: 40 },
    knot: testPicture([line(0), line(5), line(10)]),
    steps: [],
};

describe("a whole strand selected", () => {
    const selected = editorReducer(loaded(file, "three.json"), {
        type: "select",
        selection: { kind: "strand", strand: 1 },
    });

    it("stays selected through an edit to it", () => {
        const after = editorReducer(selected, {
            type: "edit",
            edit: (q) => setRopeColour(q, 1, "blue"),
        });
        expect(after.selection).toEqual({ kind: "strand", strand: 1 });
    });

    it("follows its strand when one before it goes", () => {
        const after = editorReducer(selected, { type: "edit", edit: (q) => deleteStrand(q, 0) });
        expect(after.selection).toEqual({ kind: "strand", strand: 0 });
    });

    it("goes when its strand does", () => {
        const after = editorReducer(selected, { type: "edit", edit: (q) => deleteStrand(q, 1) });
        expect(after.selection).toEqual(NOTHING);
    });
});

describe("merged edits", () => {
    const start = loaded(file, "three.json");
    const nudge = (state: typeof start, merge = "move") =>
        editorReducer(state, {
            type: "edit",
            edit: (q) => movePin(q, [0, 0], free(q.strands[0].pins[0]).x + 1, 0),
            merge,
        });

    it("go into one history entry, one after another", () => {
        const after = nudge(nudge(nudge(start)));
        expect(after.undo).toHaveLength(1);
        expect(editorReducer(after, { type: "undo" }).file).toBe(file);
    });

    it("start a new entry after anything else, or a different merge", () => {
        const selected = editorReducer(nudge(start), { type: "select", selection: NOTHING });
        expect(nudge(selected).undo).toHaveLength(2);
        expect(nudge(nudge(start), "turn").undo).toHaveLength(2);
    });
});

import { describe, expect, it } from "vitest";

import { vec3 } from "@/lib/vector3";

import type { Knot3dFile } from "./knot-file";
import { initialState, keyDirection, reduce, segmentsBetween } from "./state";

const FILE: Knot3dFile = {
    name: "Test",
    diameter: 0.011,
    minBend: 0.011,
    stiffness: 0.05,
    props: [],
    rope: {
        pins: [0, 1, 2, 3].map((i) => ({ id: i + 1, at: vec3(i * 0.02, 0, 0) })),
        segments: [10, 11, 12].map((id, k) => ({ id, name: String(k + 1), tension: [1, 1] })),
    },
    knot: [],
    stages: [],
};

describe("the editor's state", () => {
    it("starts with the rope's end segments held", () => {
        const state = initialState(FILE, "test.json");
        expect([...state.painting]).toEqual([
            [10, "hold"],
            [12, "hold"],
        ]);
    });

    it("undoes and redoes edits, keeping what's picked while the file has it", () => {
        let state = initialState(FILE, "test.json");
        state = reduce(state, { type: "pick", picked: { kind: "pin", id: 3 } });
        const moved = { ...FILE, stiffness: 0.1 };
        state = reduce(state, { type: "edit", file: moved });
        expect(state.saved).toBe(false);
        state = reduce(state, { type: "undo" });
        expect(state.file).toBe(FILE);
        expect(state.picked).toEqual({ kind: "pin", id: 3 });
        state = reduce(state, { type: "redo" });
        expect(state.file).toBe(moved);
        const fewer = { ...FILE, rope: { ...FILE.rope, pins: FILE.rope.pins.slice(0, 2) } };
        expect(reduce(state, { type: "edit", file: fewer }).picked).toBeNull();
    });

    it("paints segments, and a run between two", () => {
        let state = initialState(FILE, "test.json");
        state = reduce(state, {
            type: "paint",
            ids: segmentsBetween(FILE.rope, 12, 10),
            role: "shorten",
        });
        expect(state.painting.get(11)).toBe("shorten");
        state = reduce(state, { type: "paint", ids: [11], role: null });
        expect(state.painting.has(11)).toBe(false);
    });
});

describe("moving the handle by key", () => {
    it("moves away from the eye, to its right, and up, along the nearest axis", () => {
        // Looking from the front (bearing 0, eye out along +Z): away is -Z, and right is -X, as the view draws it.
        expect(keyDirection("KeyW", 0)).toEqual(vec3(0, 0, -1));
        expect(keyDirection("KeyS", 0)).toEqual(vec3(0, 0, 1));
        expect(keyDirection("KeyD", 0)).toEqual(vec3(-1, 0, 0));
        expect(keyDirection("KeyA", 0)).toEqual(vec3(1, 0, 0));
        // From the three-quarter look, 145 degrees round: away is nearest +Z.
        expect(keyDirection("KeyW", 145)).toEqual(vec3(0, 0, 1));
        expect(keyDirection("KeyR", 145)).toEqual(vec3(0, 1, 0));
        expect(keyDirection("KeyF", 145)).toEqual(vec3(0, -1, 0));
        expect(keyDirection("KeyQ", 0)).toBeNull();
    });
});

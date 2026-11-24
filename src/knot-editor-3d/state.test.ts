import { describe, expect, it } from "vitest";

import { segmentsOf } from "@/lib/rope-3d/rope";
import { vec3 } from "@/lib/vector3";

import type { Knot3dFile } from "./knot-file";
import { choose, initialState, keyDirection, reduce } from "./state";

const points = Array.from({ length: 81 }, (_, i) => vec3(i * 0.0025, 0, 0));
const FILE: Knot3dFile = {
    name: "Test",
    diameter: 0.011,
    minBend: 0.011,
    stiffness: 0.05,
    props: [],
    rope: { points, seg: segmentsOf(points, 0.02) },
    held: [],
    knot: [],
};

describe("choosing segments in play", () => {
    it("makes a clicked segment the handle, on its own if it wasn't in play", () => {
        expect(choose(null, 4, "handle", null)).toEqual({ from: 4, to: 4, handle: 4 });
        const play = { from: 3, to: 6, handle: 4 };
        expect(choose(play, 5, "handle", 4)).toEqual({ from: 3, to: 6, handle: 5 });
        expect(choose(play, 8, "handle", 4)).toEqual({ from: 8, to: 8, handle: 8 });
    });

    it("toggles segments in and out, filling gaps and keeping a run", () => {
        const play = { from: 3, to: 6, handle: 4 };
        expect(choose(play, 9, "toggle", 4)).toEqual({ from: 3, to: 9, handle: 4 });
        expect(choose(play, 3, "toggle", 4)).toEqual({ from: 4, to: 6, handle: 4 });
        expect(choose(play, 6, "toggle", 4)).toEqual({ from: 3, to: 5, handle: 4 });
        expect(choose(play, 5, "toggle", 4)).toEqual({ from: 3, to: 4, handle: 4 });
        expect(choose({ from: 3, to: 3, handle: 3 }, 3, "toggle", 3)).toBeNull();
    });

    it("puts in a range from the last chosen", () => {
        expect(choose({ from: 3, to: 3, handle: 3 }, 7, "range", 3)).toEqual({
            from: 3,
            to: 7,
            handle: 3,
        });
    });
});

describe("the editor's state", () => {
    it("undoes and redoes edits, keeping what's in play", () => {
        let state = initialState(FILE, "test.json");
        state = reduce(state, { type: "choose", seg: 3, mode: "handle" });
        const moved = { ...FILE, stiffness: 0.1 };
        state = reduce(state, { type: "edit", file: moved });
        expect(state.saved).toBe(false);
        state = reduce(state, { type: "undo" });
        expect(state.file).toBe(FILE);
        expect(state.play).toEqual({ from: 3, to: 3, handle: 3 });
        state = reduce(state, { type: "redo" });
        expect(state.file).toBe(moved);
    });

    it("notes where the handle was when it was chosen", () => {
        const state = reduce(initialState(FILE, "test.json"), {
            type: "choose",
            seg: 2,
            mode: "handle",
        });
        expect(state.origin!.x).toBeCloseTo(0.03, 2);
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

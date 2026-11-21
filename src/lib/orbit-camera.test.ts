import { describe, expect, it } from "vitest";

import { OrbitCamera } from "./orbit-camera";
import { vec3 } from "./vector3";

const EAST = vec3(1, 0, 0);
const UP = vec3(0, 1, 0);
const NORTH = vec3(0, 0, 1);

describe("OrbitCamera", () => {
    it("looks north from the south, with east to the right", () => {
        const cam = new OrbitCamera(Math.PI, 0);
        expect(cam.project(EAST).x).toBeCloseTo(1);
        expect(cam.project(UP).y).toBeCloseTo(1);
        expect(cam.depth(NORTH)).toBeCloseTo(-1);
    });

    it("looks south from the north, with west to the right", () => {
        const cam = new OrbitCamera(0, 0);
        expect(cam.project(EAST).x).toBeCloseTo(-1);
        expect(cam.depth(NORTH)).toBeCloseTo(1);
    });

    it("looks straight down from overhead, with north up the view when it's from the south", () => {
        const cam = new OrbitCamera(Math.PI, Math.PI / 2);
        expect(cam.project(NORTH).y).toBeCloseTo(1);
        expect(cam.project(UP).len()).toBeCloseTo(0);
        expect(cam.depth(UP)).toBeCloseTo(1);
    });

    it("keeps its three directions square to each other and one long", () => {
        const cam = new OrbitCamera(0.7, 0.4);
        for (const [a, b] of [
            [cam.right, cam.up],
            [cam.up, cam.toward],
            [cam.toward, cam.right],
        ])
            expect(a.dot(b)).toBeCloseTo(0);
        for (const v of [cam.right, cam.up, cam.toward]) expect(v.len()).toBeCloseTo(1);
    });
});

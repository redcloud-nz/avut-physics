import { describe, expect, it } from "vitest";

import { seededPicker } from "./random";
import { vec2, type Vector2 } from "./vector2";
import { behindFaceFor, ropePathFor } from "./wall";

// A 3 m wall with the anchor 2 m back from its face and 1 m above its top: the anchor at (−2, 4), the edge at (0, 3).
const WALL = { wallHeight: 3, anchorBack: 2, anchorUp: 1 };
const ANCHOR = vec2(-2, 4);
const EDGE = vec2(0, 3);

describe("behind the wall's face", () => {
    it("is on the wall top, or inside the wall nearer the top than the face", () => {
        expect(behindFaceFor(WALL, vec2(-1, 3))).toBe(true);
        expect(behindFaceFor(WALL, vec2(-0.5, 2.8))).toBe(true);
        expect(behindFaceFor(WALL, vec2(-0.5, 2))).toBe(false);
        expect(behindFaceFor(WALL, vec2(1, 4))).toBe(false);
    });
});

describe("the rope's path", () => {
    it("runs straight to the wall top", () => {
        const path = ropePathFor(WALL, vec2(-1, 3));
        expect(path.length).toBeCloseTo(Math.SQRT2, 12);
        expect(path.wrapEdge).toBeNull();
    });

    it("runs straight to a point in front of the wall it can see", () => {
        const path = ropePathFor(WALL, vec2(1, 4));
        expect(path.length).toBeCloseTo(3, 12);
        expect(path.wrapEdge).toBeNull();
    });

    it("wraps over the edge to a point below the line from the anchor past it", () => {
        // The straight line to (1, 0) crosses the face 1⅓ m up, through the wall.
        const path = ropePathFor(WALL, vec2(1, 0));
        expect(path.length).toBeCloseTo(Math.sqrt(5) + Math.sqrt(10), 12);
        expect(path.wrapEdge).toEqual(EDGE);
    });

    it("is the same either way on the line from the anchor past the edge", () => {
        // (2, 2) is on that line, 2√5 from the anchor.
        expect(ropePathFor(WALL, vec2(2, 2)).length).toBeCloseTo(2 * Math.sqrt(5), 12);
        expect(ropePathFor(WALL, vec2(2, 2 + 1e-9)).length).toBeCloseTo(2 * Math.sqrt(5), 8);
        expect(ropePathFor(WALL, vec2(2, 2 - 1e-9)).length).toBeCloseTo(2 * Math.sqrt(5), 8);
    });

    it("wraps only where the straight line would pass through the wall", () => {
        // Checked by walking along the straight line, not by the path's own test.
        const inWall = (p: Vector2) => p.x < 0 && p.y < WALL.wallHeight;
        const blocked = (p: Vector2) =>
            Array.from({ length: 999 }, (_, k) =>
                ANCHOR.add(p.sub(ANCHOR).scale((k + 1) / 1000)),
            ).some(inWall);
        const pick = seededPicker(11);
        for (let n = 0; n < 500; n++) {
            const p = vec2(pick(-3, 4, 0.01), pick(0, 6, 0.01));
            if (inWall(p)) continue;
            const path = ropePathFor(WALL, p);
            const straight = ANCHOR.distanceTo(p);
            const viaEdge = ANCHOR.distanceTo(EDGE) + EDGE.distanceTo(p);
            // (Where the line only grazes the edge the walk can miss it, but then the two lengths all but agree.)
            expect(path.length).toBeCloseTo(blocked(p) ? viaEdge : straight, 4);
        }
    });
});

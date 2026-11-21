import { describe, expect, it } from "vitest";

import { lengthOf } from "@/lib/polyline";
import { vec2 } from "@/lib/vector2";

import { basket, stackedLogs } from "./basket";

describe("basket", () => {
    const logs = stackedLogs(vec2(0, 0), vec2(0, 0.25), 0.14, 24);
    const centre = vec2(0, 0.125);

    it("uses all of the tape", () => {
        const { path } = basket(logs, centre, vec2(0, -1), 4);
        expect(lengthOf(path)).toBeCloseTo(4, 4);
    });

    it("puts the clip on the line of pull", () => {
        const pull = vec2(2, -1.3).unit();
        const { clip } = basket(logs, centre, pull, 4);
        expect(clip.sub(centre).cross(pull)).toBeCloseTo(0, 6);
        expect(clip.sub(centre).dot(pull)).toBeGreaterThan(1);
    });

    it("hangs evenly when pulled straight down", () => {
        const { clip, path } = basket(logs, centre, vec2(0, -1), 4);
        const [first, last] = [path[1], path[path.length - 2]];
        expect(first.distanceTo(clip)).toBeCloseTo(last.distanceTo(clip), 6);
        expect(clip.x).toBeCloseTo(0, 9);
    });

    it("goes over the top of the logs when pulled down", () => {
        const { path } = basket(logs, centre, vec2(0, -1), 4);
        expect(Math.max(...path.map((p) => p.y))).toBeCloseTo(0.25 + 0.14, 6);
    });
});

import { describe, expect, it } from "vitest";

import { vec3, type Vector3 } from "@/lib/vector3";

import { carabinerWith, type CarabinerFeatures } from "./hardware";
import { checkConnection, type Arrangement, type Connection } from "./interactions";

const DOWN = vec3(0, -1, 0);
const ALONG = vec3(1, 0, 0);
const ROPE_R = 0.0055;

/** A D carabiner hanging from the origin by its top (wide) end, 110 mm to its bottom (narrow) end. */
const krab = carabinerWith(vec3(0, 0, 0), DOWN, ALONG, "steel", 0.11, { settled: true }).features;

/** The middle of a stretch of the carabiner's loop. */
function middleOf(c: CarabinerFeatures, s: keyof CarabinerFeatures["stretches"]): number {
    const n = c.loop.length - 1;
    const { from, to } = c.stretches[s];
    const span = (to - from + n) % n;
    return (from + Math.round(span / 2)) % n;
}

/**
 * A ring of rope `r` thick round the carabiner's bar at loop index `i`, `gap` clear of it, and `shift` moved: an ideal
 * bight round the bar.
 */
function ringAt(i: number, r: number, gap = 0, shift = vec3(0, 0, 0)): Vector3[] {
    const { loop } = krab;
    const at = loop[i];
    const tangent = loop[i + 1].sub(loop[i - 1 < 0 ? loop.length - 2 : i - 1]).unit();
    const normal = vec3(0, 0, 1).cross(tangent).unit();
    const binormal = tangent.cross(normal);
    const R = krab.r + r + gap;
    return Array.from({ length: 49 }, (_, k) => {
        const a = (2 * Math.PI * k) / 48;
        return at
            .add(normal.scale(R * Math.cos(a)))
            .add(binormal.scale(R * Math.sin(a)))
            .add(shift);
    });
}

const knotAt = (
    i: number,
    gap = 0,
    shift?: Vector3,
    pull = DOWN,
    arrangement: Arrangement = "end",
): Connection => ({
    kind: "figure-8-on-carabiner",
    id: "test",
    arrangement,
    carabiner: krab,
    knot: { rope: ringAt(i, ROPE_R, gap, shift), r: ROPE_R },
    pull,
});

const checks = (c: Connection) => checkConnection(c).map((f) => f.check);

describe("a rope's end carabiner", () => {
    const bottom = middleOf(krab, "bottom");

    it("passes with the knot round the narrow end, pulled along the carabiner", () => {
        expect(checkConnection(knotAt(bottom))).toEqual([]);
    });

    it("fails on the gate", () => {
        expect(checks(knotAt(middleOf(krab, "gate")))).toEqual([
            "passes through at the carabiner's bottom end",
            "bears on the bottom bend",
        ]);
    });

    it("fails when it's beside the carabiner rather than through it", () => {
        expect(checks(knotAt(bottom, 0, vec3(0, 0, 0.03)))).toContain(
            "passes through the carabiner",
        );
    });

    it("fails when it's into the bar or off it", () => {
        expect(checks(knotAt(bottom, -0.003))).toEqual(["stays out of the bar"]);
        expect(checks(knotAt(bottom, 0.003))).toEqual(["bears on the bar"]);
    });

    it("fails when it pulls across the carabiner", () => {
        const across = DOWN.add(ALONG.scale(0.6)).unit();
        expect(checks(knotAt(bottom, 0, undefined, across))).toEqual(["pulls along the carabiner"]);
    });
});

describe("an anchor's carabiner", () => {
    const [top, bottom] = [middleOf(krab, "top"), middleOf(krab, "bottom")];
    const UP = vec3(0, 1, 0);
    const tape = (i: number) => {
        const points = ringAt(i, 0.002);
        return { points, thickness: points.map(() => 0.004) };
    };
    const sling = (i: number, pull = DOWN, arrangement: Arrangement = "anchor"): Connection => ({
        kind: "carabiner-on-sling",
        id: "test",
        arrangement,
        carabiner: krab,
        sling: tape(i),
        pull,
    });

    it("has the sling on the narrow end and the knot on the wide end, pulling opposite ways along it", () => {
        expect(checkConnection(sling(bottom))).toEqual([]);
        expect(checkConnection(knotAt(top, 0, undefined, UP, "anchor"))).toEqual([]);
    });

    it("fails with the sling on the wide (top) end", () => {
        expect(checks(sling(top, UP))).toEqual([
            "passes through at the carabiner's bottom end",
            "bears on the bottom bend",
            "pulls along the carabiner",
        ]);
    });

    it("fails with a sling on a rope's end carabiner, which has none", () => {
        expect(checks(sling(bottom, DOWN, "end"))).toEqual(["is part of the end arrangement"]);
    });
});

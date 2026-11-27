import { describe, expect, it } from "vitest";

import { hobbyDirections } from "@/lib/hobby";
import { nearestOnRun } from "@/lib/polyline3";
import { Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import {
    cubicAt,
    fitPinned,
    hobbyDirections3,
    lettered,
    pinDirections,
    removePin,
    sampleRope,
    segmentCubics,
    splitSegment,
    type PinnedRope,
} from "./pinned";

const near = (a: Vector3, b: Vector3, by = 1e-9) => expect(a.distanceTo(b)).toBeLessThan(by);

/** A rope through `points`, every pin free, every tension 1, segments named from 1. */
const ropeThrough = (points: Vector3[]): PinnedRope => ({
    pins: points.map((at, i) => ({ id: i + 1, at })),
    segments: points.slice(1).map((_, k) => ({
        id: 100 + k,
        name: String(k + 1),
        tension: [1, 1],
    })),
});

const WAVE = [vec3(0, 0, 0), vec3(0.03, 0.02, 0), vec3(0.06, -0.01, 0), vec3(0.1, 0.01, 0)];

describe("pins and segments in 3D", () => {
    it("gives a run lying in a plane the 2D method's directions", () => {
        const flat = hobbyDirections(
            WAVE.map((p) => new Vector2(p.x, p.y)),
            { curl: 1 },
            { curl: 1 },
        );
        hobbyDirections3(WAVE).forEach((d, k) => near(d, vec3(flat[k].x, flat[k].y, 0), 1e-9));
        // Held at its ends too.
        const [s, e] = [new Vector2(0, 1), new Vector2(1, 0)];
        const held = hobbyDirections(
            WAVE.map((p) => new Vector2(p.x, p.y)),
            { direction: s },
            { direction: e },
        );
        hobbyDirections3(WAVE, vec3(0, 1, 0), vec3(1, 0, 0)).forEach((d, k) =>
            near(d, vec3(held[k].x, held[k].y, 0), 1e-9),
        );
    });

    it("turns the same however the plane lies", () => {
        const axis = vec3(1, 2, 3).unit();
        const turned = WAVE.map((p) => p.turned(axis, 0.7));
        const flat = hobbyDirections3(WAVE);
        hobbyDirections3(turned).forEach((d, k) => near(d, flat[k].turned(axis, 0.7), 1e-9));
    });

    it("holds a pin's direction and runs through every pin", () => {
        const rope = ropeThrough(WAVE);
        rope.pins[1] = { ...rope.pins[1], along: vec3(0, 0, 1) };
        expect(pinDirections(rope.pins)[1]).toEqual(vec3(0, 0, 1));
        const cubics = segmentCubics(rope);
        cubics.forEach((c, k) => {
            near(c[0], WAVE[k]);
            near(c[3], WAVE[k + 1]);
        });
        // Leaving pin 2 along z.
        near(cubics[1][1].sub(cubics[1][0]).unit(), vec3(0, 0, 1));
    });

    it("samples the rope with a point at every pin", () => {
        const rope = ropeThrough(WAVE);
        const s = sampleRope(rope, 0.003);
        s.pinAt.forEach((i, k) => near(s.points[i], WAVE[k]));
        expect(s.seg[s.pinAt[1] - 1]).toBe(0);
        expect(s.seg[s.pinAt[1]]).toBe(1);
    });

    it("splits a segment into two halves that are the curve it was, where its pins hold their ways", () => {
        const rope = ropeThrough(WAVE);
        const dirs = pinDirections(rope.pins);
        const held: PinnedRope = {
            ...rope,
            pins: rope.pins.map((p, i) => ({ ...p, along: dirs[i] })),
        };
        const before = segmentCubics(held)[1];
        const split = splitSegment(held, 1);
        expect(split.pins).toHaveLength(5);
        expect(split.segments.map((s) => s.name)).toEqual(["1", "2a", "2b", "3"]);
        const [a, b] = segmentCubics(split).slice(1, 3);
        for (const t of [0.1, 0.4, 0.8]) {
            near(cubicAt(a, t), cubicAt(before, t / 2), 1e-9);
            near(cubicAt(b, t), cubicAt(before, 0.5 + t / 2), 1e-9);
        }
        expect(removePin(split, 2).segments.map((s) => s.name)).toEqual(["1", "2", "3"]);
    });

    it("fits a sampled rope back to pins close to it", () => {
        const rope = ropeThrough([...WAVE, vec3(0.12, 0.04, 0.02), vec3(0.1, 0.07, 0.03)]);
        const s = sampleRope(rope, 0.002);
        const { rope: fitted, error } = fitPinned(s.points, s.pinAt, rope.segments, {
            tolerance: 1e-4,
            nextId: 1000,
            pinIds: rope.pins.map((p) => p.id),
        });
        expect(error).toBeLessThan(1e-4);
        expect(fitted.pins[0].id).toBe(1);
        expect(fitted.pins.at(-1)!.id).toBe(rope.pins.at(-1)!.id);
        const again = sampleRope(fitted, 0.002).points;
        for (const p of s.points) expect(nearestOnRun(p, again).distance).toBeLessThan(2e-4);
    });

    it("adds pins where one cubic can't follow the points, lettering the pieces", () => {
        // A full turn of a helix in one segment.
        const helix = Array.from({ length: 81 }, (_, i) => {
            const a = (2 * Math.PI * i) / 80;
            return vec3(0.02 * Math.cos(a), 0.02 * Math.sin(a), 0.01 * a);
        });
        const { rope, error } = fitPinned(helix, [0, 80], [{ id: 5, name: "7", tension: [1, 1] }], {
            tolerance: 2e-4,
            nextId: 10,
        });
        expect(error).toBeLessThan(2e-4);
        expect(rope.segments.length).toBeGreaterThan(2);
        expect(rope.segments[0]).toMatchObject({ id: 5, name: "7a" });
        expect(rope.segments[1].name).toBe("7b");
    });

    it("letters runs of pieces of one segment", () => {
        const s = (name: string) => ({ id: 0, name, tension: [1, 1] as [number, number] });
        expect(lettered([s("4"), s("19"), s("19c"), s("20")]).map((x) => x.name)).toEqual([
            "4",
            "19a",
            "19b",
            "20",
        ]);
    });
});

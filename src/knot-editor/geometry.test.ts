import { describe, expect, it } from "vitest";

import { Cubic } from "@/lib/bezier";
import { hobbyControls } from "@/lib/hobby";
import { rad } from "@/lib/math";
import { Vector2 } from "@/lib/vector2";

import type { Picture, Rope } from "./format";
import { pictureGeometry, strandDistance, strandPosition, TIGHTEST_BEND } from "./geometry";
import { free, testStrand, type TestPin, type TestSegment } from "./test-pictures";

const rope = (pins: TestPin[], segments?: TestSegment[]) =>
    testStrand("rope", pins, { segments }) as Rope;
const picture = (...strands: Rope[]): Picture => ({ strands, crossings: [], props: [] });

/** A bowed segment: from (0, 0) heading 45° below the x axis, to (6, 0) heading 45° above it. */
const BOW: TestPin[] = [
    { x: 0, y: 0, angle: 45 },
    { x: 6, y: 0, angle: -45 },
];

/** The bowed segment's length with these tensions, worked out directly. */
function bowLength(tension: [number, number]) {
    const [a, b] = [new Vector2(0, 0), new Vector2(6, 0)];
    const [leaving, arriving] = [Vector2.fromAngle(rad(45)), Vector2.fromAngle(rad(-45))];
    return new Cubic(a, ...hobbyControls(a, b, leaving, arriving, tension), b).length();
}

/** A wavy rope of `count` pins, some holding angles. */
function wavy(count: number, holding: number[] = []): Rope {
    return rope(
        Array.from({ length: count }, (_, k) => ({
            x: 3 * k,
            y: 4 * Math.sin(k * 0.9),
            ...(holding.includes(k) && { angle: 20 }),
        })),
    );
}

describe("pictureGeometry", () => {
    it("meets a locked segment's length", () => {
        // Lengths from tensions in the 1.3 : 0.9 ratio, scaled within the reach.
        for (const k of [1, 0.9, 2.5]) {
            const length = bowLength([1.3 * k, 0.9 * k]);
            const g = pictureGeometry(picture(rope(BOW, [{ tension: [1.3, 0.9], length }])));
            const seg = g.strands[0].segments[0];
            expect(seg.lock?.kind).toBe("ok");
            expect(Math.abs(seg.length - length)).toBeLessThan(1e-3);
            // The tensions keep their ratio.
            expect(seg.tension[0] / seg.tension[1]).toBeCloseTo(1.3 / 0.9, 12);
        }
    });

    it("reports a locked segment it can't fit, by how much against its reach", () => {
        // Ratio 2 : 1, so the reach runs from tensions [4, 2] down to [1.5, 0.75].
        const [shortest, longest] = [bowLength([4, 2]), bowLength([1.5, 0.75])];
        const tooShort = pictureGeometry(picture(rope(BOW, [{ tension: [2, 1], length: 5.5 }])));
        const short = tooShort.strands[0].segments[0];
        expect(short.lock).toMatchObject({ kind: "too-short", reach: [shortest, longest] });
        expect(short.lock?.kind === "too-short" && short.lock.by).toBeCloseTo(shortest - 5.5, 9);
        expect(short.tension).toEqual([4, 2]);

        const tooLong = pictureGeometry(picture(rope(BOW, [{ tension: [2, 1], length: 12 }])));
        const long = tooLong.strands[0].segments[0];
        expect(long.lock).toMatchObject({ kind: "too-long" });
        expect(long.lock?.kind === "too-long" && long.lock.by).toBeCloseTo(12 - longest, 9);
        expect(long.length).toBeCloseTo(longest, 9);
    });

    it("leaves every direction alone when a segment's tensions or locked length change", () => {
        const base = wavy(8, [3]);
        const before = pictureGeometry(picture(base)).strands[0].directions;
        const segments = [...base.segments];
        segments[2] = { ...segments[2], tension: [2.5, 0.8] };
        segments[5] = { ...segments[5], tension: [1, 1], length: 3.5 };
        const after = pictureGeometry(picture({ ...base, segments })).strands[0].directions;
        expect(after).toEqual(before);
    });

    it("keeps every segment outside the moved pin's run", () => {
        const base = wavy(10, [3, 6]);
        const g = pictureGeometry(picture(base));
        const pins = base.pins.map(free);
        pins[1] = { ...pins[1], x: pins[1].x + 0.5, y: pins[1].y - 1 };
        const moved = pictureGeometry(picture({ ...base, pins }), g);
        const [old, now] = [g.strands[0].segments, moved.strands[0].segments];
        // Pin 1's run is pins 0 to 3, so segments 0 to 2.
        for (let k = 0; k < 3; k++) expect(now[k]).not.toBe(old[k]);
        for (let k = 3; k < 9; k++) expect(now[k]).toBe(old[k]);
        // What it kept is what it would have worked out afresh.
        expect(
            pictureGeometry(picture({ ...base, pins })).strands[0].segments.map((s) => s.length),
        ).toEqual(now.map((s) => s.length));
    });

    it("keeps everything when nothing changed, and nothing when tensions change", () => {
        const base = picture(wavy(6));
        const g = pictureGeometry(base);
        const again = pictureGeometry(base, g);
        again.strands[0].segments.forEach((s, k) => expect(s).toBe(g.strands[0].segments[k]));
        const segments = [...base.strands[0].segments];
        segments[4] = { ...segments[4], tension: [1.2, 1.2] };
        const retensioned = pictureGeometry(picture({ ...(base.strands[0] as Rope), segments }), g);
        expect(retensioned.strands[0].segments[4]).not.toBe(g.strands[0].segments[4]);
        expect(retensioned.strands[0].segments[3]).toBe(g.strands[0].segments[3]);
    });

    it("finds tight bends on ropes, and none on arrows", () => {
        // A hairpin round two pins a diameter apart.
        const pins: TestPin[] = [
            { x: 0, y: 5 },
            { x: 0, y: 0, angle: -90 },
            { x: 1, y: 0, angle: 90 },
            { x: 1, y: 5 },
        ];
        const g = pictureGeometry(picture(rope(pins)));
        const turn = g.strands[0].segments[1];
        expect(turn.tightest.radius).toBeLessThan(TIGHTEST_BEND);
        expect(turn.bends.length).toBeGreaterThan(0);
        expect(g.strands[0].segments[0].bends).toEqual([]);
        const arrow = pictureGeometry({
            strands: [testStrand("arrow", pins)],
            crossings: [],
            props: [],
        });
        expect(arrow.strands[0].segments[1].bends).toEqual([]);
    });

    it("measures along the strand", () => {
        const g = pictureGeometry(picture(wavy(5))).strands[0];
        expect(g.length).toBeCloseTo(
            g.segments.reduce((sum, s) => sum + s.length, 0),
            12,
        );
        const at = strandPosition(g, g.starts[2] + 1);
        expect(at.segment).toBe(2);
        expect(strandDistance(g, at.segment, at.t)).toBeCloseTo(g.starts[2] + 1, 9);
    });

    it("works out a 100-pin rope quickly", () => {
        const many = picture(wavy(100, [20, 50, 80]));
        for (let k = 0; k < 5; k++) pictureGeometry(many);
        const times = Array.from({ length: 20 }, () => {
            const start = performance.now();
            pictureGeometry(many);
            return performance.now() - start;
        }).sort((a, b) => a - b);
        expect(times[10]).toBeLessThan(50);
    });
});

describe("bend warnings by size", () => {
    it("warns of a 6 mm rope's bends tighter than 6 mm, and an 11 mm rope's tighter than 11 mm", () => {
        const radius = pictureGeometry(picture(rope(BOW))).strands[0].segments[0].tightest.radius;
        const bow = (tightest: number, diameter: number) => {
            const by = tightest / radius;
            const pins = BOW.map((pin) => ({ ...pin, x: pin.x * by, y: pin.y * by }));
            const seg = pictureGeometry(picture({ ...rope(pins), diameter })).strands[0]
                .segments[0];
            expect(seg.tightest.radius).toBeCloseTo(tightest, 6);
            return seg.bends.length > 0;
        };
        expect([bow(5.9, 6), bow(6.1, 6)]).toEqual([true, false]);
        expect([bow(10.9, 11), bow(11.1, 11)]).toEqual([true, false]);
        expect(TIGHTEST_BEND).toBe(1);
    });
});

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import { centreline, crossings, laySegments, type RopePath } from "@/knots/rope-path";
import { arcLengths } from "@/lib/curve";
import { Segment } from "@/lib/segment";

import {
    clearance,
    overReach,
    pictureCrossings,
    strandPaths,
    type PictureCrossings,
} from "./crossing-geometry";
import { pictureGeometry } from "./geometry";
import { parseKnotFile, type CrossingAt, type Picture, type Strand } from "./knot-file";
import { free, testPicture, testStrand, type TestBar, type TestPin } from "./test-pictures";

const strand = (pins: TestPin[], kind: "rope" | "arrow" = "rope"): Strand => testStrand(kind, pins);

/** A straight rope along the x axis. */
const LINE = strand([
    { x: -10, y: 0 },
    { x: 10, y: 0 },
]);

/** One segment arching up across the x axis twice, from (-5, 3) to (5, 3). */
const ARCH = strand([
    { x: -5, y: 3, angle: -70 },
    { x: 5, y: 3, angle: 70 },
]);

/** The arch with its end lifted above the axis, so it crosses it once. */
const LIFTED = strand([
    { x: -5, y: 3, angle: -70 },
    { x: 5, y: -3, angle: 70 },
]);

const picture = testPicture;

function found(p: Picture) {
    const geometry = pictureGeometry(p);
    const c = pictureCrossings(p, geometry);
    return { geometry, crossings: c, paths: strandPaths(p, geometry, c) };
}

/** The stretches of a path marked over, as distances along it. */
const overStretches = (path: RopePath) =>
    laySegments(path)
        .filter((s) => s.over)
        .map((s) => [s.start, s.start + s.length]);

/** Where two ropes cross each other, and whether each is marked over there (as `rope-path.test.ts` checks). */
function between(first: RopePath, second: RopePath) {
    const [a, b] = [first, second].map((path) => {
        const { points, over } = centreline(path);
        return { pieces: Segment.along(points), over, s: arcLengths(points) };
    });
    const hits: { over: [boolean, boolean] }[] = [];
    for (let i = 0; i < a.pieces.length; i++)
        for (let j = 0; j < b.pieces.length; j++)
            if (a.pieces[i].intersection(b.pieces[j]))
                hits.push({ over: [a.over[i] && a.over[i + 1], b.over[j] && b.over[j + 1]] });
    return hits;
}

const statuses = (c: PictureCrossings) => c.crossings.map((x) => x.status);

describe("pictureCrossings", () => {
    it("matches a pair crossing twice to its two entries", () => {
        const { crossings: c } = found(
            picture(
                [LINE, ARCH],
                [
                    { over: [0, 0], under: [1, 0], n: 1 },
                    { over: [1, 0], under: [0, 0], n: 2 },
                ],
            ),
        );
        expect(c.crossings).toHaveLength(2);
        expect(statuses(c)).toEqual(["set", "set"]);
        // n counts along the line, the pair's first segment, from left to right.
        expect(c.crossings[0].at.x).toBeLessThan(c.crossings[1].at.x);
        expect(c.crossings.map((x) => x.over)).toEqual([0, 1]);
        expect(c.lost).toEqual([]);
        expect(c.toCheck).toEqual([]);
    });

    it("leaves a crossing with no entry unset", () => {
        const { crossings: c } = found(
            picture([LINE, ARCH], [{ over: [0, 0], under: [1, 0], n: 1 }]),
        );
        // One entry for two crossings: to check, the first still drawn as its entry says.
        expect(statuses(c)).toEqual(["to-check", "to-check"]);
        expect(c.crossings.map((x) => x.over)).toEqual([0, undefined]);
        const none = found(picture([LINE, ARCH])).crossings;
        expect(statuses(none)).toEqual(["unset", "unset"]);
        expect(none.toCheck).toEqual([]);
    });

    it("shows both entries to check when a pair crossing twice loses one", () => {
        const entries: CrossingAt[] = [
            { over: [0, 0], under: [1, 0], n: 1 },
            { over: [1, 0], under: [0, 0], n: 2 },
        ];
        const { crossings: c } = found(picture([LINE, LIFTED], entries));
        expect(c.crossings).toHaveLength(1);
        expect(statuses(c)).toEqual(["to-check"]);
        expect(c.toCheck).toEqual([
            {
                pair: [
                    [0, 0],
                    [1, 0],
                ],
                entries,
                found: 1,
            },
        ]);
        expect(c.lost).toEqual([]);
    });

    it("lists an entry whose segments no longer cross as lost", () => {
        const apart = strand([
            { x: -5, y: 3 },
            { x: 5, y: 3 },
        ]);
        const entry: CrossingAt = { over: [0, 0], under: [1, 0], n: 1 };
        const { crossings: c } = found(picture([LINE, apart], [entry]));
        expect(c.crossings).toEqual([]);
        expect(c.lost).toEqual([entry]);
    });

    it("finds an arrow crossing a rope", () => {
        const arrow = strand(
            [
                { x: 1, y: 5 },
                { x: 2, y: -5 },
            ],
            "arrow",
        );
        const { crossings: c } = found(
            picture([LINE, arrow], [{ over: [1, 0], under: [0, 0], n: 1 }]),
        );
        expect(c.crossings).toHaveLength(1);
        expect(c.crossings[0]).toMatchObject({
            status: "set",
            over: 1,
            pair: [
                [0, 0],
                [1, 0],
            ],
        });
    });

    it("finds no crossings along a smooth strand, where its segments meet at their pins", () => {
        const wavy = strand(
            Array.from({ length: 30 }, (_, k) => ({ x: 2 * k, y: 3 * Math.sin(k * 0.7) })),
        );
        const tight = strand(
            Array.from({ length: 12 }, (_, k) => ({ x: 0.7 * k, y: k % 2 ? 0.4 : -0.4 })),
        );
        for (const s of [wavy, tight]) expect(found(picture([s])).crossings.crossings).toEqual([]);
    });

    it("finds and matches passes across a bar seen side on", () => {
        // Down in front of the bar, then back up behind it.
        const round = strand([
            { x: -2, y: -6 },
            { x: 0, y: 4 },
            { x: 2, y: -6 },
        ]);
        const bar = (passes: TestBar["passes"]): TestBar => ({
            kind: "bar",
            x: 0,
            y: 0,
            r: 1.6,
            length: 20,
            passes,
        });
        const { crossings: c } = found(
            picture(
                [round],
                [],
                [
                    bar([
                        [0, 0, 1, "front"],
                        [0, 1, 1, "behind"],
                    ]),
                ],
            ),
        );
        expect(c.passes.map((p) => [p.segment, p.status, p.side])).toEqual([
            [0, "set", "front"],
            [1, "set", "behind"],
        ]);
        const unset = found(picture([round], [], [bar([[0, 0, 1, "front"]])])).crossings;
        expect(unset.passes.map((p) => [p.status, p.side])).toEqual([
            ["set", "front"],
            ["unset", undefined],
        ]);
        // An end-on bar has no passes.
        const end: TestBar = { kind: "bar", x: 0, y: 0, r: 1.6, passes: [] };
        expect(found(picture([round], [], [end])).crossings.passes).toEqual([]);
    });

    it("shows a segment's passes to check when it passes a bar twice and loses one", () => {
        // One segment dipping down across the bar's middle line and back.
        const dip = (lift: number) =>
            strand([
                { x: -5, y: -3, angle: 70 },
                { x: 5, y: -3 - lift, angle: -70 },
            ]);
        const bar: TestBar = {
            kind: "bar",
            x: 0,
            y: 0,
            r: 1,
            length: 20,
            passes: [
                [0, 0, 1, "front"],
                [0, 0, 2, "behind"],
            ],
        };
        expect(found(picture([dip(0)], [], [bar])).crossings.passes.map((p) => p.status)).toEqual([
            "set",
            "set",
        ]);
        // Its end brought down below the bar, it crosses the middle line once.
        const { crossings: c } = found(picture([dip(-6)], [], [bar]));
        expect(c.passes.map((p) => p.status)).toEqual(["to-check"]);
        expect(c.passesToCheck).toEqual([
            { prop: 0, strand: 0, segment: 0, entries: bar.passes, found: 1 },
        ]);
        expect(c.lostPasses).toEqual([]);
        // Moved clear of the bar, its entries are lost.
        const clear = found(
            picture(
                [
                    strand([
                        { x: -5, y: -5 },
                        { x: 5, y: -5 },
                    ]),
                ],
                [],
                [bar],
            ),
        ).crossings;
        expect(clear.lostPasses).toHaveLength(2);
    });
});

describe("strandPaths", () => {
    /** A rope looping across itself: along, round and back across its own start. */
    const LOOP = strand([
        { x: -6, y: 2 },
        { x: 0, y: 0 },
        { x: 5, y: -3 },
        { x: 3, y: -7 },
        { x: -1, y: -5 },
        { x: 1, y: 1 },
        { x: 3, y: 6 },
    ]);

    it("marks one strand over at each of a rope's own crossings", () => {
        const p = picture([LOOP]);
        const { crossings: c } = found(p);
        expect(c.crossings).toHaveLength(1);
        for (const [a, b] of [c.crossings[0].pair, [...c.crossings[0].pair].reverse()]) {
            const { paths } = found(picture([LOOP], [{ over: a, under: b, n: 1 }]));
            const hits = crossings(paths.paths[0]);
            expect(paths.tooClose).toEqual([]);
            expect(hits).toHaveLength(1);
            expect(hits[0].over).not.toBeNull();
        }
    });

    it("marks one of two ropes over at each place they cross", () => {
        // Across the loop, through both its sides.
        const second = {
            ...strand([
                { x: -8, y: -4 },
                { x: 0, y: -4.5 },
                { x: 8, y: -4 },
            ]),
            colour: "green",
        } as Strand;
        const p = picture([LOOP, second]);
        const { crossings: c } = found(p);
        const between_ = c.crossings.filter((x) => x.pair[0][0] !== x.pair[1][0]);
        expect(between_.length).toBeGreaterThanOrEqual(2);
        // Alternate which is on top.
        const entries: CrossingAt[] = c.crossings.map((x, k) => ({
            over: x.pair[k % 2],
            under: x.pair[1 - (k % 2)],
            n: x.n,
        }));
        const { paths, crossings: matched } = found(picture([LOOP, second], entries));
        expect(statuses(matched).every((s) => s === "set")).toBe(true);
        const hits = between(paths.paths[0], paths.paths[1]);
        expect(hits).toHaveLength(between_.length);
        for (const h of hits) expect(h.over[0]).not.toBe(h.over[1]);
        for (const h of crossings(paths.paths[0])) expect(h.over).not.toBeNull();
    });

    it("reaches the angle-dependent length past each crossing, stopping short of where its strand goes under", () => {
        // Three ropes across one, far apart, the middle one under it.
        const across = (x: number, lean: number) =>
            strand([
                { x: x - lean, y: -6 },
                { x: x + lean, y: 6 },
            ]);
        const strands = [LINE, across(-6, 0), across(0, 3), across(6, 1)];
        const entries: CrossingAt[] = [
            { over: [0, 0], under: [1, 0], n: 1 },
            { over: [2, 0], under: [0, 0], n: 1 },
            { over: [0, 0], under: [3, 0], n: 1 },
        ];
        const { paths, crossings: c } = found(picture(strands, entries));
        expect(paths.tooClose).toEqual([]);
        const stretches = overStretches(paths.paths[0]);
        expect(stretches).toHaveLength(2);
        for (const x of c.crossings.filter((x) => x.over === 0)) {
            const s = x.s[0];
            const reach = overReach(x.sin);
            const stretch = stretches.find(([a, b]) => a <= s && s <= b)!;
            expect(stretch[0]).toBeCloseTo(s - reach, 2);
            expect(stretch[1]).toBeCloseTo(s + reach, 2);
        }
        const under = c.crossings.find((x) => x.over === 1)!;
        for (const [a, b] of stretches) expect(under.s[0] < a || under.s[0] > b).toBe(true);
    });

    it("clips a stretch short of a crossing where its strand goes under, warning when they're too close", () => {
        const across = (x: number) =>
            strand([
                { x, y: -6 },
                { x, y: 6 },
            ]);
        // Over at x = 0 and under at x = gap: clipped at the clearance short of it.
        for (const gap of [2, 3.5]) {
            const entries: CrossingAt[] = [
                { over: [0, 0], under: [1, 0], n: 1 },
                { over: [2, 0], under: [0, 0], n: 1 },
            ];
            const { paths, crossings: c } = found(picture([LINE, across(0), across(gap)], entries));
            const [stretch, ...rest] = overStretches(paths.paths[0]);
            expect(rest).toEqual([]);
            const under = c.crossings.find((x) => x.over === 1)!;
            expect(stretch[1]).toBeCloseTo(
                Math.min(10 + overReach(1), under.s[0] - clearance(1)),
                2,
            );
            // It must reach the clearance past its own crossing at 10; with the under crossing 2 away, it can't.
            expect(paths.tooClose.length > 0).toBe(gap < 2 * clearance(1));
        }
    });

    it("merges stretches that overlap", () => {
        const across = (x: number) =>
            strand([
                { x, y: -6 },
                { x, y: 6 },
            ]);
        const entries: CrossingAt[] = [
            { over: [0, 0], under: [1, 0], n: 1 },
            { over: [0, 0], under: [2, 0], n: 1 },
        ];
        const { paths } = found(picture([LINE, across(0), across(2)], entries));
        const stretches = overStretches(paths.paths[0]);
        expect(stretches).toHaveLength(1);
        expect(stretches[0][0]).toBeCloseTo(10 - overReach(1), 2);
        expect(stretches[0][1]).toBeCloseTo(12 + overReach(1), 2);
    });

    it("covers a bar's whole height where a strand passes in front of it, and stops short where it's behind", () => {
        const round = strand([
            { x: -2, y: -6 },
            { x: 0, y: 4 },
            { x: 2, y: -6 },
        ]);
        const bar: TestBar = {
            kind: "bar",
            x: 0,
            y: 0,
            r: 1.6,
            length: 20,
            passes: [
                [0, 0, 1, "front"],
                [0, 1, 1, "behind"],
            ],
        };
        const { paths, crossings: c } = found(picture([round], [], [bar]));
        const { points, over } = centreline(paths.paths[0]);
        const front = c.passes[0];
        const behind = c.passes[1];
        const s = arcLengths(points);
        points.forEach((p, i) => {
            const inBand = Math.abs(p.y) <= bar.r;
            if (inBand && s[i] < (front.s + behind.s) / 2) expect(over[i]).toBe(true);
            if (s[i] > behind.cover[0] && s[i] < behind.cover[1]) expect(over[i]).toBe(false);
        });
    });

    it("ends a pass where the strand turns back round the bar's edge, so a wrap's passes don't meet", () => {
        // Down in front of the bar, round its bottom edge, and back up behind it, as a round turn goes.
        const wrap = strand([
            { x: -1, y: -6 },
            { x: 0, y: 1.6, angle: 0 },
            { x: 1, y: -6 },
        ]);
        const bar: TestBar = {
            kind: "bar",
            x: 0,
            y: 0,
            r: 1.6,
            length: 20,
            passes: [
                [0, 0, 1, "front"],
                [0, 1, 1, "behind"],
            ],
        };
        const { paths, crossings: c } = found(picture([wrap], [], [bar]));
        const [front, behind] = c.passes;
        expect(front.cover[1]).toBeLessThanOrEqual(behind.cover[0] + 1e-6);
        expect(paths.tooClosePasses).toEqual([]);
        expect(paths.paths[0].some((seg) => seg.over)).toBe(true);
    });
});

describe("samples/v1.json", () => {
    it("has every crossing and pass set, and room for every over stretch", () => {
        const read = parseKnotFile(
            readFileSync(join(import.meta.dirname, "samples", "v1.json"), "utf8"),
        );
        if (read.kind !== "ok") throw new Error(read.reason);
        for (const p of [read.file.knot, ...read.file.steps.map((s) => s.picture)]) {
            const { crossings: c, paths } = found(p);
            expect(c.crossings.every((x) => x.status === "set")).toBe(true);
            expect(c.passes.every((x) => x.status === "set")).toBe(true);
            expect([c.lost, c.toCheck, c.lostPasses, c.passesToCheck]).toEqual([[], [], [], []]);
            expect(c.crossings.length).toBe(p.crossings.length);
            expect([paths.tooClose, paths.tooClosePasses]).toEqual([[], []]);
        }
        const knot = found(read.file.knot);
        // Crossings between all three strands, and passes in front and behind.
        const pairs = new Set(
            knot.crossings.crossings.map((x) => `${x.pair[0][0]}-${x.pair[1][0]}`),
        );
        expect([...pairs].sort()).toEqual(["0-1", "0-2", "1-2"]);
        expect(new Set(knot.crossings.passes.map((p) => p.side))).toEqual(
            new Set(["front", "behind"]),
        );
    });
});

describe("strand sizes", () => {
    /** The picture with every place and length scaled, and its ropes given a diameter. */
    const scaled = (p: Picture, by: number, diameter: number): Picture => ({
        ...p,
        strands: p.strands.map((s) => ({
            ...s,
            ...(s.kind === "rope" && { diameter }),
            pins: s.pins.map(free).map((pin) => ({ ...pin, x: pin.x * by, y: pin.y * by })),
            segments: s.segments.map((seg) => ({
                ...seg,
                ...(seg.length !== undefined && { length: seg.length * by }),
            })),
        })),
        props: p.props.map((prop) => ({
            ...prop,
            x: prop.x * by,
            y: prop.y * by,
            r: prop.r * by,
            ...(prop.length !== undefined && { length: prop.length * by }),
        })),
    });

    it("works out the same bends, crossings, passes and over stretches at any size", () => {
        const read = parseKnotFile(
            readFileSync(join(import.meta.dirname, "samples", "v3.json"), "utf8"),
        );
        if (read.kind !== "ok") throw new Error(read.reason);
        // Without its arrow, whose size is fixed: 11 mm ropes, and the same in 1 mm ropes, scaled down by 11.
        const knot = read.file.knot;
        const arrow = knot.strands.findIndex((s) => s.kind === "arrow");
        const gone = new Set(knot.strands[arrow].segments.map((q) => q.id));
        const big: Picture = {
            ...knot,
            strands: knot.strands.filter((_, i) => i !== arrow),
            crossings: knot.crossings.filter((e) => !gone.has(e.over) && !gone.has(e.under)),
        };
        const small = scaled(big, 1 / 11, 1);
        const [a, b] = [found(big), found(small)];
        a.geometry.strands.forEach((strand, i) =>
            strand.segments.forEach((seg, k) => {
                const other = b.geometry.strands[i].segments[k];
                expect(seg.bends.length).toBe(other.bends.length);
                seg.bends.forEach(([t0, t1], j) => {
                    expect(t0).toBeCloseTo(other.bends[j][0], 6);
                    expect(t1).toBeCloseTo(other.bends[j][1], 6);
                });
            }),
        );
        expect(a.crossings.crossings.length).toBeGreaterThan(0);
        expect(a.crossings.crossings.map((c) => [c.pair, c.n, c.status, c.over])).toEqual(
            b.crossings.crossings.map((c) => [c.pair, c.n, c.status, c.over]),
        );
        a.crossings.crossings.forEach((c, j) => {
            expect(c.t[0]).toBeCloseTo(b.crossings.crossings[j].t[0], 6);
            expect(c.s[0] / 11).toBeCloseTo(b.crossings.crossings[j].s[0], 6);
        });
        expect(a.crossings.passes.length).toBeGreaterThan(0);
        a.crossings.passes.forEach((p, j) => {
            const q = b.crossings.passes[j];
            expect([p.prop, p.strand, p.segment, p.n, p.side]).toEqual([
                q.prop,
                q.strand,
                q.segment,
                q.n,
                q.side,
            ]);
            expect(p.cover[0] / 11).toBeCloseTo(q.cover[0], 4);
            expect(p.cover[1] / 11).toBeCloseTo(q.cover[1], 4);
        });
        expect([a.paths.tooClose, a.paths.tooClosePasses]).toEqual([
            b.paths.tooClose,
            b.paths.tooClosePasses,
        ]);
        a.paths.paths.forEach((path, i) => {
            const [mine, theirs] = [overStretches(path), overStretches(b.paths.paths[i])];
            expect(mine.length).toBe(theirs.length);
            mine.forEach(([from, to], j) => {
                expect(from / 11).toBeCloseTo(theirs[j][0], 4);
                expect(to / 11).toBeCloseTo(theirs[j][1], 4);
            });
        });
    });

    it("marks a thin rope over a thick one far enough to clear the thick one's width", () => {
        const thick = { ...LINE, diameter: 4 } as Strand;
        const thin = strand([
            { x: 0, y: -8 },
            { x: 0, y: 8 },
        ]);
        const { paths } = found(picture([thick, thin], [{ over: [1, 0], under: [0, 0], n: 1 }]));
        const [stretch] = overStretches(paths.paths[1]);
        // Its square-cut ends are past the thick rope's edges, outline and all, either side of where they cross.
        const half = (1.25 * 4) / 2;
        expect(stretch[0]).toBeLessThanOrEqual(8 - half + 1e-9);
        expect(stretch[1]).toBeGreaterThanOrEqual(8 + half - 1e-9);
        expect(clearance(1, 1, 4)).toBeCloseTo(half, 9);
        // And the thick rope over the thin one reaches its own, longer, reach.
        const { paths: flipped } = found(
            picture([thick, thin], [{ over: [0, 0], under: [1, 0], n: 1 }]),
        );
        const [wide] = overStretches(flipped.paths[0]);
        expect(wide[1] - wide[0]).toBeCloseTo(2 * overReach(1, 4), 6);
    });
});

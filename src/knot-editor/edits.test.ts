import { describe, expect, it } from "vitest";

import { Vector2 } from "@/lib/vector2";

import { pictureCrossings } from "./crossing-geometry";
import {
    addProp,
    addStrand,
    changeProp,
    confirmCrossings,
    confirmPasses,
    deleteCrossing,
    deletePass,
    deletePin,
    deletePins,
    deleteProp,
    deleteStep,
    deleteStrand,
    draggedFrame,
    duplicateStep,
    insertPin,
    insertStep,
    lockSegment,
    movePin,
    moveStep,
    NEW_ROPE_DIAMETER,
    setCrossing,
    setDetails,
    setFrame,
    setPass,
    setPinAngle,
    setRopeColour,
    setRopeDiameter,
    setRopeName,
    setSegmentLength,
    setStepInstructions,
    setStepNumber,
    setTensions,
    shiftAt,
    unlockSegment,
} from "./edits";
import { pictureGeometry, type PictureGeometry } from "./geometry";
import {
    parseKnotFile,
    writeKnotFile,
    type KnotFile,
    type Picture,
    type Strand,
} from "./knot-file";
import { kindOf } from "./props";
import { BAR, type BarProp } from "./props/bar";
import {
    editorReducer,
    isSaved,
    loaded,
    NOTHING,
    pictureOf,
    type EditorState,
    type Selection,
} from "./state";
import {
    entriesAt,
    free,
    newIds,
    passesOf,
    pinId,
    segmentId,
    testPicture,
    testStrand,
    withoutIds,
    type TestBar,
    type TestPin,
} from "./test-pictures";

const rope = (pins: TestPin[], colour: "orange" | "green" | "blue" = "orange"): Strand =>
    testStrand("rope", pins, { colour });

const picture = testPicture;

/** A rope wandering through five free pins. */
const WIGGLE = rope([
    { x: 0, y: 0 },
    { x: 5, y: 3 },
    { x: 10, y: -2 },
    { x: 14, y: 4 },
    { x: 18, y: 0 },
]);

/** A straight rope along the x axis. */
const LINE = rope([
    { x: -10, y: 0 },
    { x: 10, y: 0 },
]);

/** One segment arching up across the x axis twice, from (-5, 3) to (5, 3). */
const ARCH = rope(
    [
        { x: -5, y: 3, angle: -70 },
        { x: 5, y: 3, angle: 70 },
    ],
    "green",
);

/** How far, at most, any point of one picture's strand is from the same strand in another. */
function farthest(a: PictureGeometry, b: PictureGeometry, strand: number): number {
    const along = (g: PictureGeometry, count: number) =>
        g.strands[strand].segments.flatMap((s) => s.cubic.points(count));
    const [from, to] = [along(a, 50), along(b, 4000)];
    return Math.max(...from.map((p) => Math.min(...to.map((q) => q.distanceTo(p)))));
}

/** Which strand is on top at each set crossing, by where it is. */
const overs = (p: Picture) =>
    pictureCrossings(p, pictureGeometry(p)).crossings.map((c) => ({
        at: c.at,
        status: c.status,
        over: c.over === undefined ? undefined : c.pair[c.over][0],
    }));

function expectSameOvers(before: Picture, after: Picture) {
    const [was, now] = [overs(before), overs(after)];
    expect(now).toHaveLength(was.length);
    for (const c of now) {
        const match = was.find((w) => w.at.distanceTo(c.at) < 1e-3);
        expect(match, `a crossing at ${c.at.x}, ${c.at.y}`).toBeDefined();
        expect(c.status).toBe("set");
        expect(c.over).toBe(match!.over);
    }
}

describe("pins and segments", () => {
    const p = picture([WIGGLE, LINE]);

    it("moves a pin, sharing everything else", () => {
        const moved = movePin(p, [0, 2], 11, -3);
        expect(moved.strands[0].pins[2]).toEqual({ id: pinId(0, 2), x: 11, y: -3 });
        expect(moved.strands[1]).toBe(p.strands[1]);
        expect(moved.strands[0].segments).toBe(p.strands[0].segments);
        moved.strands[0].pins.forEach(
            (pin, k) => k !== 2 && expect(pin).toBe(p.strands[0].pins[k]),
        );
        expect(movePin(p, [0, 2], 10, -2)).toBe(p);
    });

    it("sets and clears an angle", () => {
        const held = setPinAngle(p, [0, 1], 270);
        expect(held.strands[0].pins[1]).toEqual({ id: pinId(0, 1), x: 5, y: 3, angle: -90 });
        expect(setPinAngle(held, [0, 1], -90)).toBe(held);
        expect(setPinAngle(held, [0, 1], undefined).strands[0].pins[1]).toEqual({
            id: pinId(0, 1),
            x: 5,
            y: 3,
        });
        expect(setPinAngle(p, [0, 1], undefined)).toBe(p);
    });

    it("sets tensions within their range, but not on a locked segment", () => {
        expect(setTensions(p, [0, 1], [0.5, 9]).strands[0].segments[1].tension).toEqual([0.75, 4]);
        const locked = lockSegment(p, pictureGeometry(p), [0, 1]);
        expect(setTensions(locked, [0, 1], [2, 2])).toBe(locked);
    });

    it("locks and unlocks without moving the curve", () => {
        const before = setTensions(p, [0, 1], [1.4, 0.9]);
        const geometry = pictureGeometry(before);
        const locked = lockSegment(before, geometry, [0, 1]);
        expect(locked.strands[0].segments[1]).toEqual({
            id: segmentId(0, 1),
            tension: [1.4, 0.9],
            length: geometry.strands[0].segments[1].length,
        });
        const lockedGeometry = pictureGeometry(locked);
        expect(farthest(geometry, lockedGeometry, 0)).toBeLessThan(1e-6);
        const unlocked = unlockSegment(locked, lockedGeometry, [0, 1]);
        expect(unlocked.strands[0].segments[1].length).toBeUndefined();
        expect(unlocked.strands[0].segments[1].tension[0]).toBeCloseTo(1.4, 6);
        expect(farthest(geometry, pictureGeometry(unlocked), 0)).toBeLessThan(1e-6);
    });

    it("sets a locked segment's length, and only a locked one's", () => {
        expect(setSegmentLength(p, [0, 1], 9)).toBe(p);
        const locked = lockSegment(p, pictureGeometry(p), [0, 1]);
        expect(setSegmentLength(locked, [0, 1], 9).strands[0].segments[1].length).toBe(9);
        expect(setSegmentLength(locked, [0, 1], 0)).toBe(locked);
    });

    it("shifts rope through a pin between two locked segments, keeping the total", () => {
        const g = pictureGeometry(p);
        const one = lockSegment(p, g, [0, 1]);
        expect(shiftAt(one, [0, 2], 0.5)).toBe(one);
        const both = lockSegment(lockSegment(p, g, [0, 1]), g, [0, 2]);
        const [a, b] = [both.strands[0].segments[1].length!, both.strands[0].segments[2].length!];
        const shifted = shiftAt(both, [0, 2], 0.5);
        expect(shifted.strands[0].segments[1].length).toBeCloseTo(a + 0.5, 12);
        expect(shifted.strands[0].segments[2].length).toBeCloseTo(b - 0.5, 12);
        expect(shiftAt(both, [0, 2], b + 1)).toBe(both);
    });

    it("sets a rope's colour and name", () => {
        expect(setRopeColour(p, 1, "blue").strands[1]).toMatchObject({ colour: "blue" });
        expect(setRopeColour(p, 1, "orange")).toBe(p);
        const named = setRopeName(p, 0, "  Working end ");
        expect(named.strands[0]).toMatchObject({ name: "Working end" });
        expect(setRopeName(named, 0, " ").strands[0]).not.toHaveProperty("name");
    });

    it("sets a rope's diameter, above 0", () => {
        expect(setRopeDiameter(p, 1, 6).strands[1]).toMatchObject({ diameter: 6 });
        expect(setRopeDiameter(p, 1, 6).strands[0]).toBe(p.strands[0]);
        for (const d of [1, 0, -2, NaN]) expect(setRopeDiameter(p, 1, d)).toBe(p);
    });
});

describe("inserting a pin", () => {
    const p = picture([WIGGLE, LINE]);
    const g = pictureGeometry(p);

    it("leaves the curve where it was", () => {
        for (const [k, t] of [
            [0, 0.5],
            [1, 0.3],
            [3, 0.7],
        ] as const) {
            const { picture: after } = insertPin(p, g, [0, k], t, newIds());
            const strand = after.strands[0];
            expect(strand.pins).toHaveLength(6);
            expect(strand.segments).toHaveLength(5);
            expect(free(strand.pins[k + 1]).angle).toBeDefined();
            expect(after.strands[1]).toBe(p.strands[1]);
            expect(farthest(g, pictureGeometry(after), 0)).toBeLessThan(1e-3);
        }
    });

    it("gives a locked segment two locked halves, their lengths summing to its", () => {
        const locked = lockSegment(p, g, [0, 1]);
        const lockedGeometry = pictureGeometry(locked);
        const { picture: after } = insertPin(locked, lockedGeometry, [0, 1], 0.4, newIds());
        const [a, b] = after.strands[0].segments.slice(1, 3);
        expect(a.length! + b.length!).toBeCloseTo(locked.strands[0].segments[1].length!, 9);
        const afterGeometry = pictureGeometry(after);
        expect(afterGeometry.strands[0].segments[1].lock?.kind).toBe("ok");
        expect(afterGeometry.strands[0].segments[2].lock?.kind).toBe("ok");
        expect(farthest(lockedGeometry, afterGeometry, 0)).toBeLessThan(1e-3);
    });

    it("refuses the very ends of a segment", () => {
        expect(insertPin(p, g, [0, 1], 0, newIds()).picture).toBe(p);
        expect(insertPin(p, g, [0, 1], 1, newIds()).picture).toBe(p);
    });
});

describe("deleting a pin", () => {
    const p = picture([WIGGLE]);
    const g = pictureGeometry(p);

    it("joins two locked segments at the sum of their lengths", () => {
        const both = lockSegment(lockSegment(p, g, [0, 1]), g, [0, 2]);
        const [a, b] = [both.strands[0].segments[1].length!, both.strands[0].segments[2].length!];
        const { picture: after } = deletePin(both, pictureGeometry(both), [0, 2]);
        expect(after.strands[0].pins).toHaveLength(4);
        expect(after.strands[0].segments[1].length).toBeCloseTo(a + b, 12);
    });

    it("unlocks the joined segment when either wasn't locked", () => {
        const one = lockSegment(p, g, [0, 1]);
        const { picture: after } = deletePin(one, pictureGeometry(one), [0, 2]);
        expect(after.strands[0].segments[1].length).toBeUndefined();
    });

    it("takes an end's segment with it, and refuses a strand of two pins", () => {
        const { picture: after } = deletePin(p, g, [0, 0]);
        expect(after.strands[0].pins[0]).toBe(p.strands[0].pins[1]);
        expect(after.strands[0].segments).toEqual(p.strands[0].segments.slice(1));
        const line = picture([LINE]);
        expect(deletePin(line, pictureGeometry(line), [0, 0]).picture).toBe(line);
    });

    it("undoes an insert", () => {
        const { picture: inserted } = insertPin(p, g, [0, 1], 0.5, newIds());
        const { picture: after } = deletePin(inserted, pictureGeometry(inserted), [0, 2]);
        expect(after.strands[0].pins.map(free).map(({ id, x, y }) => ({ id, x, y }))).toEqual(
            p.strands[0].pins,
        );
        expect(after.strands[0].segments.map((q) => q.id)).toEqual(
            p.strands[0].segments.map((q) => q.id),
        );
    });
});

describe("crossings and passes follow inserts and deletes", () => {
    // The line (strand 0) on top where the arch (strand 1) first crosses it, and under where it crosses back.
    const crossed = picture(
        [LINE, ARCH],
        [
            { over: [0, 0], under: [1, 0], n: 1 },
            { over: [1, 0], under: [0, 0], n: 2 },
        ],
    );
    const g = pictureGeometry(crossed);

    it("starts with both crossings set", () => {
        expect(overs(crossed).map((c) => c.status)).toEqual(["set", "set"]);
    });

    it("splits the pair's first segment between its crossings", () => {
        const { picture: after } = insertPin(crossed, g, [0, 0], 0.5, newIds());
        expect(entriesAt(after)).toEqual([
            { over: [0, 0], under: [1, 0], n: 1 },
            { over: [1, 0], under: [0, 1], n: 1 },
        ]);
        expectSameOvers(crossed, after);
    });

    it("splits the pair's second segment between its crossings", () => {
        const { picture: after } = insertPin(crossed, g, [1, 0], 0.5, newIds());
        expect(entriesAt(after)).toEqual([
            { over: [0, 0], under: [1, 0], n: 1 },
            { over: [1, 1], under: [0, 0], n: 1 },
        ]);
        expectSameOvers(crossed, after);
    });

    it("renumbers a split before both crossings, and joins them back", () => {
        const { picture: after } = insertPin(crossed, g, [0, 0], 0.1, newIds());
        expect(entriesAt(after)).toEqual([
            { over: [0, 1], under: [1, 0], n: 1 },
            { over: [1, 0], under: [0, 1], n: 2 },
        ]);
        expectSameOvers(crossed, after);
        const { picture: joined } = deletePin(after, pictureGeometry(after), [0, 1]);
        expect(joined.crossings).toEqual(crossed.crossings);
        expectSameOvers(crossed, joined);
    });

    it("keeps entries untouched by the edit", () => {
        const three = picture([LINE, ARCH, WIGGLE], entriesAt(crossed));
        const { picture: after } = insertPin(three, pictureGeometry(three), [2, 1], 0.5, newIds());
        after.crossings.forEach((c, k) => expect(c).toBe(three.crossings[k]));
    });

    it("leaves an entry between two joined segments to check", () => {
        // A loop: the first segment swings out and back to its pin, and the second runs back across it.
        const loop = picture([
            rope([
                { x: 0, y: 0, angle: 0 },
                { x: 8, y: 4, angle: 180 },
                { x: 4, y: -4, angle: 90 },
            ]),
        ]);
        const found = pictureCrossings(loop, pictureGeometry(loop)).crossings;
        expect(found.map((c) => c.pair)).toEqual([
            [
                [0, 0],
                [0, 1],
            ],
        ]);
        const set = {
            ...loop,
            crossings: [{ over: segmentId(0, 0), under: segmentId(0, 1), n: 1 }],
        };
        const { picture: after } = deletePin(set, pictureGeometry(set), [0, 1]);
        expect(entriesAt(after)).toEqual([{ over: [0, 0], under: [0, 0], n: 1 }]);
        const check = pictureCrossings(after, pictureGeometry(after));
        expect(check.toCheck).toHaveLength(1);
        expect(check.lost).toEqual([]);
    });

    it("moves a prop's passes to the half they're on", () => {
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
        const p = picture([ARCH], [], [bar]);
        const { picture: after } = insertPin(p, pictureGeometry(p), [0, 0], 0.5, newIds());
        expect(passesOf(after, 0)).toEqual([
            [0, 0, 1, "front"],
            [0, 1, 1, "behind"],
        ]);
        const check = pictureCrossings(after, pictureGeometry(after));
        expect(check.passes.map((q) => q.status)).toEqual(["set", "set"]);
        const { picture: joined } = deletePin(after, pictureGeometry(after), [0, 1]);
        expect(passesOf(joined, 0)).toEqual(bar.passes);
    });
});

describe("setting crossings", () => {
    // The line (strand 0) and the arch (strand 1) cross twice, with no entries yet.
    const bare = picture([LINE, ARCH]);
    const pair = pictureCrossings(bare, pictureGeometry(bare)).crossings[0].pair;
    const statuses = (p: Picture) =>
        pictureCrossings(p, pictureGeometry(p)).crossings.map((c) => c.status);

    it("sets each crossing, then swaps one in place", () => {
        expect(statuses(bare)).toEqual(["unset", "unset"]);
        const one = setCrossing(bare, pair, 1, 0);
        expect(entriesAt(one)).toEqual([{ over: [0, 0], under: [1, 0], n: 1 }]);
        // One entry for a pair crossing twice can't be trusted to name the same crossing.
        expect(statuses(one)).toEqual(["to-check", "to-check"]);
        const both = setCrossing(one, pair, 2, 1);
        expect(statuses(both)).toEqual(["set", "set"]);
        const swapped = setCrossing(both, pair, 1, 1);
        expect(entriesAt(swapped)).toEqual([
            { over: [1, 0], under: [0, 0], n: 1 },
            { over: [1, 0], under: [0, 0], n: 2 },
        ]);
        expect(swapped.crossings[1]).toBe(both.crossings[1]);
        expect(setCrossing(swapped, pair, 1, 1)).toBe(swapped);
    });

    it("puts an arrow over one strand and under another", () => {
        const arrow: Strand = {
            ...rope([
                { x: 0, y: -6 },
                { x: 0, y: 8 },
            ]),
            kind: "arrow",
        } as Strand;
        const p = picture([
            LINE,
            rope(
                [
                    { x: -10, y: 4 },
                    { x: 10, y: 4 },
                ],
                "green",
            ),
            arrow,
        ]);
        const found = pictureCrossings(p, pictureGeometry(p)).crossings;
        expect(found.map((c) => c.pair[1][0])).toEqual([2, 2]);
        const set = setCrossing(setCrossing(p, found[0].pair, 1, 1), found[1].pair, 1, 0);
        expect(overs(set).map((c) => [c.status, c.over])).toEqual([
            ["set", 2],
            ["set", 1],
        ]);
    });

    const set = setCrossing(setCrossing(bare, pair, 1, 0), pair, 2, 1);

    it("lists an entry as lost once its crossing goes, and deletes it", () => {
        const apart = movePin(movePin(set, [0, 0], -10, 9), [0, 1], 10, 9);
        const found = pictureCrossings(apart, pictureGeometry(apart));
        expect(found.crossings).toEqual([]);
        expect(found.lost).toEqual(entriesAt(set));
        const cleared = deleteCrossing(apart, found.lost[0]);
        expect(cleared.crossings).toEqual([set.crossings[1]]);
        expect(deleteCrossing(cleared, found.lost[0])).toBe(cleared);
    });

    it("shows a pair that goes from two crossings to one as to check, until confirmed", () => {
        const once = movePin(set, [0, 1], 0, 0);
        const found = pictureCrossings(once, pictureGeometry(once));
        expect(found.crossings.map((c) => [c.status, c.over])).toEqual([["to-check", 0]]);
        expect(found.toCheck).toHaveLength(1);
        const confirmed = confirmCrossings(once, pictureGeometry(once), pair);
        expect(entriesAt(confirmed)).toEqual([{ over: [0, 0], under: [1, 0], n: 1 }]);
        expect(statuses(confirmed)).toEqual(["set"]);
    });

    it("confirms a pair with no side yet with its first segment on top", () => {
        const one = setCrossing(bare, pair, 2, 1);
        const confirmed = confirmCrossings(one, pictureGeometry(one), pair);
        expect(entriesAt(confirmed)).toEqual([
            { over: [0, 0], under: [1, 0], n: 1 },
            { over: [1, 0], under: [0, 0], n: 2 },
        ]);
    });

    it("removes an entry naming one segment twice on confirming it", () => {
        const self = picture([LINE], [{ over: [0, 0], under: [0, 0], n: 1 }]);
        const confirmed = confirmCrossings(self, pictureGeometry(self), [
            [0, 0],
            [0, 0],
        ]);
        expect(entriesAt(confirmed)).toEqual([]);
    });
});

describe("props", () => {
    const at = (x: number, y: number) => new Vector2(x, y);

    it("adds a bar, moves it, sets its fields and deletes it", () => {
        const p = addProp(picture([LINE]), BAR.create(at(2, 3), 7));
        expect(p.props).toEqual([
            { id: 7, kind: "bar", x: 2, y: 3, r: 17.6, length: 220, passes: [] },
        ]);
        const bar = p.props[0] as BarProp;
        const moved = changeProp(p, 0, (q) => kindOf(q).moved(q, at(1, -1)));
        expect([moved.props[0].x, moved.props[0].y]).toEqual([3, 2]);
        expect(moved.strands).toBe(p.strands);
        const field = (q: BarProp, label: string) => BAR.fields(q).find((f) => f.label === label)!;
        const radius = field(bar, "Radius");
        if (radius.kind !== "number") throw new Error("Radius should be a number");
        expect(changeProp(p, 0, (q) => radius.set(q as BarProp, 2)).props[0].r).toBe(2);
        expect(changeProp(p, 0, (q) => radius.set(q as BarProp, 0))).toBe(p);
        expect(changeProp(p, 0, (q) => q)).toBe(p);
        expect(deleteProp(p, 0).props).toEqual([]);
        expect(deleteProp(p, 1)).toBe(p);
    });

    it("drops a bar's length and passes when it's seen end on, and gives it a length back", () => {
        const bar: BarProp = {
            ...BAR.create(at(0, 0), 7),
            passes: [[segmentId(0, 0), 1, "front"]],
        };
        const seen = BAR.fields(bar).find((f) => f.label === "Seen")!;
        if (seen.kind !== "choice") throw new Error("Seen should be a choice");
        const endOn = seen.set(bar, "end");
        expect(endOn).toEqual({ id: 7, kind: "bar", x: 0, y: 0, r: 17.6, passes: [] });
        expect(BAR.fields(endOn).map((f) => f.label)).not.toContain("Length");
        expect(seen.set(endOn, "side").length).toBe(220);
        expect(seen.set(bar, "side")).toBe(bar);
        // Seen end on, it's drawn behind every strand.
        expect([BAR.between(bar), BAR.between(endOn)]).toEqual([true, false]);
    });

    // The arch crosses the x axis twice, about 2.3 either side of the middle, so a short bar there has two passes.
    const short: TestBar = { kind: "bar", x: 0, y: 0, r: 1, length: 6, passes: [] };
    const bare = picture([ARCH], [], [short]);
    const found = (p: Picture) => pictureCrossings(p, pictureGeometry(p));

    it("sets each pass's side, then swaps one in place", () => {
        expect(found(bare).passes.map((q) => q.status)).toEqual(["unset", "unset"]);
        const both = setPass(setPass(bare, 0, [0, 0], 1, "front"), 0, [0, 0], 2, "behind");
        expect(passesOf(both, 0)).toEqual([
            [0, 0, 1, "front"],
            [0, 0, 2, "behind"],
        ]);
        expect(found(both).passes.map((q) => [q.status, q.side])).toEqual([
            ["set", "front"],
            ["set", "behind"],
        ]);
        const swapped = setPass(both, 0, [0, 0], 2, "front");
        expect(passesOf(swapped, 0)[1]).toEqual([0, 0, 2, "front"]);
        expect(setPass(swapped, 0, [0, 0], 2, "front")).toBe(swapped);
    });

    const set = setPass(setPass(bare, 0, [0, 0], 1, "front"), 0, [0, 0], 2, "behind");

    it("shows a segment's passes as to check when the bar moves off one, until confirmed", () => {
        const shifted = changeProp(set, 0, (q) => kindOf(q).moved(q, at(4, 0)));
        const now = found(shifted);
        expect(now.passes.map((q) => [q.status, q.side])).toEqual([["to-check", "front"]]);
        expect(now.passesToCheck).toHaveLength(1);
        const confirmed = confirmPasses(shifted, pictureGeometry(shifted), 0, [0, 0]);
        expect(passesOf(confirmed, 0)).toEqual([[0, 0, 1, "front"]]);
        expect(found(confirmed).passes.map((q) => q.status)).toEqual(["set"]);
    });

    it("lists passes as lost once the bar is clear of the strand, and deletes them", () => {
        const away = changeProp(set, 0, (q) => kindOf(q).moved(q, at(30, 0)));
        const now = found(away);
        expect(now.passes).toEqual([]);
        expect(now.lostPasses.map((q) => q.entry)).toEqual(passesOf(set, 0));
        const cleared = deletePass(away, 0, now.lostPasses[0].entry);
        expect(passesOf(cleared, 0)).toEqual([passesOf(set, 0)[1]]);
        expect(deletePass(cleared, 0, now.lostPasses[0].entry)).toBe(cleared);
    });
});

describe("deleting the selected pins", () => {
    it("deletes each, keeping the others' numbers right", () => {
        const p = picture([LINE, WIGGLE]);
        const { picture: after, renumbering } = deletePins(p, [
            [1, 1],
            [1, 3],
        ]);
        const was = p.strands[1].pins;
        expect(after.strands[1].pins).toEqual([was[0], was[2], was[4]]);
        expect(after.strands[0]).toBe(p.strands[0]);
        expect(renumbering!.pin([1, 4])).toEqual([1, 2]);
        expect(renumbering!.pin([1, 3])).toBeUndefined();
    });

    it("deletes a strand left with fewer than two pins", () => {
        const p = picture([LINE, WIGGLE, ARCH]);
        const { picture: after, renumbering } = deletePins(p, [
            [0, 0],
            [1, 0],
            [1, 1],
            [1, 2],
            [1, 3],
        ]);
        expect(after.strands).toEqual([p.strands[2]]);
        expect(renumbering!.pin([2, 1])).toEqual([0, 1]);
    });
});

describe("strands", () => {
    it("adds ropes in the first colour not used, and arrows", () => {
        const p = picture([LINE]);
        const added = addStrand(p, "rope", new Vector2(0, 5), new Vector2(10, 5), newIds());
        expect(added.strands[1]).toMatchObject({ kind: "rope", colour: "green", diameter: 1 });
        // As thick as the picture's last rope, or 11 mm in a picture with none.
        const thin = setRopeDiameter(added, 1, 6);
        expect(
            addStrand(thin, "rope", Vector2.ZERO, Vector2.ZERO, newIds()).strands[2],
        ).toMatchObject({
            diameter: 6,
        });
        expect(
            addStrand(picture([]), "rope", Vector2.ZERO, Vector2.ZERO, newIds()).strands[0],
        ).toMatchObject({ diameter: NEW_ROPE_DIAMETER });
        expect(added.strands[0]).toBe(p.strands[0]);
        const arrow = addStrand(added, "arrow", new Vector2(0, 8), new Vector2(10, 8), newIds());
        expect(withoutIds(arrow.strands[2])).toEqual({
            id: 0,
            kind: "arrow",
            pins: [
                { id: 0, x: 0, y: 8 },
                { id: 0, x: 10, y: 8 },
            ],
            segments: [{ id: 0, tension: [1, 1] }],
        });
        // Each new thing has a new id.
        const made = arrow.strands[2];
        expect(new Set([made.id, ...made.pins.map((q) => q.id), made.segments[0].id]).size).toBe(4);
        expect(
            addStrand(arrow, "rope", Vector2.ZERO, new Vector2(1, 0), newIds()).strands[3],
        ).toMatchObject({
            colour: "blue",
        });
    });

    it("deletes a strand with its entries, renumbering the rest and keeping colours", () => {
        const bar: TestBar = {
            kind: "bar",
            x: 0,
            y: 0,
            r: 1,
            length: 20,
            passes: [
                [1, 0, 1, "front"],
                [2, 0, 1, "behind"],
            ],
        };
        const p = picture(
            [
                LINE,
                ARCH,
                rope(
                    [
                        { x: 0, y: -5 },
                        { x: 0, y: 5 },
                    ],
                    "blue",
                ),
            ],
            [
                { over: [0, 0], under: [1, 0], n: 1 },
                { over: [2, 0], under: [0, 0], n: 1 },
            ],
            [bar],
        );
        const { picture: after, renumbering } = deleteStrand(p, 1);
        expect(after.strands.map((s) => s.kind === "rope" && s.colour)).toEqual(["orange", "blue"]);
        expect(entriesAt(after)).toEqual([{ over: [1, 0], under: [0, 0], n: 1 }]);
        expect(passesOf(after, 0)).toEqual([[1, 0, 1, "behind"]]);
        // Nothing else is renumbered: the strands after it keep their ids, and so do the entries naming them.
        expect(after.strands.map((q) => q.id)).toEqual([p.strands[0].id, p.strands[2].id]);
        expect(after.crossings).toEqual([p.crossings[1]]);
        expect(renumbering!.pin([1, 0])).toBeUndefined();
        expect(renumbering!.pin([2, 1])).toEqual([1, 1]);
    });
});

describe("steps and details", () => {
    const knot = picture([LINE]);
    const one = picture([WIGGLE]);
    const base: KnotFile = {
        name: "Test",
        frame: { x: -20, y: -20, w: 40, h: 40 },
        knot,
        steps: [{ number: 1, instructions: "Make a bight.", picture: one }],
    };

    it("inserts a step after the one chosen, as a copy numbered one more", () => {
        const { file, index } = insertStep(base, 0);
        expect(index).toBe(1);
        expect(file.steps[1]).toEqual({ number: 2, instructions: "", picture: one });
        expect(file.steps[1].picture).toBe(one);
        expect(file.steps[0]).toBe(base.steps[0]);
    });

    it("inserts after the last step, as a copy of the knot, with the knot chosen", () => {
        const { file, index } = insertStep(base, "knot");
        expect(index).toBe(1);
        expect(file.steps[1]).toEqual({ number: 2, instructions: "", picture: knot });
        const first = insertStep({ ...base, steps: [] }, "knot");
        expect(first.file.steps).toEqual([{ number: 1, instructions: "", picture: knot }]);
    });

    it("duplicates a step with its number, moves steps and deletes them, never renumbering", () => {
        const three = insertStep(duplicateStep(base, 0), 1).file;
        expect(three.steps.map((s) => s.number)).toEqual([1, 1, 2]);
        const moved = moveStep(three, 2, -1);
        expect(moved.steps.map((s) => s.number)).toEqual([1, 2, 1]);
        expect(moveStep(moved, 0, -1)).toBe(moved);
        expect(moveStep(moved, 2, 1)).toBe(moved);
        expect(deleteStep(moved, 0).steps.map((s) => s.number)).toEqual([2, 1]);
        expect(deleteStep(moved, 3)).toBe(moved);
    });

    it("sets a step's number (a whole number from 1) and instructions", () => {
        expect(setStepNumber(base, 0, 4).steps[0].number).toBe(4);
        expect(setStepNumber(base, 0, 0)).toBe(base);
        expect(setStepNumber(base, 0, 2.5)).toBe(base);
        expect(setStepNumber(base, 0, 1)).toBe(base);
        expect(setStepInstructions(base, 0, "Pass the end through.").steps[0].instructions).toBe(
            "Pass the end through.",
        );
        expect(setStepInstructions(base, 0, "Make a bight.")).toBe(base);
    });

    it("sets the details, leaving blank ones out and refusing a blank name", () => {
        const set = setDetails(base, { name: " Bowline ", description: "A loop.", about: "  " });
        expect(set).toEqual({ ...base, name: "Bowline", description: "A loop." });
        expect("about" in set).toBe(false);
        expect(setDetails(set, { name: "Bowline", description: "A loop.", about: "" })).toBe(set);
        expect(setDetails(set, { name: "  ", description: "", about: "" })).toBe(set);
        const cleared = setDetails(set, { name: "Bowline", description: "", about: "" });
        expect("description" in cleared).toBe(false);
    });

    it("saves three steps, two sharing a number, and reads them back the same", async () => {
        const three = setStepInstructions(
            insertStep(duplicateStep(base, 0), 1).file,
            2,
            "Dress it.",
        );
        const read = parseKnotFile(await writeKnotFile(three));
        expect(read.kind).toBe("ok");
        if (read.kind === "ok") expect(read.file.steps).toEqual(three.steps);
    });
});

describe("the frame", () => {
    const f: KnotFile = {
        name: "Test",
        frame: { x: -20, y: -10, w: 40, h: 20 },
        knot: picture([LINE]),
        steps: [],
    };

    it("sets the frame, refusing a width or height not above 0", () => {
        expect(setFrame(f, { x: 0, y: 0, w: 300, h: 200 }).frame).toEqual({
            x: 0,
            y: 0,
            w: 300,
            h: 200,
        });
        expect(setFrame(f, { ...f.frame })).toBe(f);
        for (const bad of [{ w: 0 }, { h: -5 }, { x: NaN }, { w: Infinity }])
            expect(setFrame(f, { ...f.frame, ...bad })).toBe(f);
    });

    it("drags an edge or a corner, stopping a millimetre short of the opposite edge", () => {
        expect(draggedFrame(f.frame, [-1, 0], new Vector2(5, 9))).toEqual({
            x: -15,
            y: -10,
            w: 35,
            h: 20,
        });
        expect(draggedFrame(f.frame, [0, 1], new Vector2(9, 5))).toEqual({
            x: -20,
            y: -10,
            w: 40,
            h: 25,
        });
        expect(draggedFrame(f.frame, [1, -1], new Vector2(-100, 100))).toEqual({
            x: -20,
            y: 9,
            w: 1,
            h: 1,
        });
        expect(draggedFrame(f.frame, [-1, 0], new Vector2(100, 0))).toMatchObject({ x: 19, w: 1 });
    });
});

describe("state", () => {
    const file = (knot: Picture, steps: Picture[] = []): KnotFile => ({
        name: "Test",
        frame: { x: -20, y: -20, w: 40, h: 40 },
        knot,
        steps: steps.map((picture, k) => ({ number: k + 1, instructions: "", picture })),
    });
    const start = (f: KnotFile) => loaded(f, "test.json");
    const run = (state: EditorState, ...actions: Parameters<typeof editorReducer>[1][]) =>
        actions.reduce(editorReducer, state);
    const knotOf = (s: EditorState) => pictureOf(s.file, s.picture);

    it("edits the file as one entry, showing the step it gives, and undoes back to the picture before", () => {
        const s0 = start(file(picture([LINE]), [picture([WIGGLE])]));
        const s1 = run(s0, { type: "edit-file", edit: (f) => insertStep(f, 0).file, show: 1 });
        expect(s1.file.steps).toHaveLength(2);
        expect(s1.picture).toBe(1);
        const s2 = run(s1, { type: "edit-file", edit: (f) => deleteStep(f, 1) });
        // The step shown has gone, so the knot is shown.
        expect(s2.picture).toBe("knot");
        const back = run(s2, { type: "undo" }, { type: "undo" });
        expect(back.file).toBe(s0.file);
        expect(back.picture).toBe("knot");
        expect(run(s1, { type: "undo" }).picture).toBe("knot");
        expect(run(s0, { type: "edit-file", edit: (f) => f })).toBe(s0);
    });

    it("keeps a selected pin selected under its new number", () => {
        const p = picture([WIGGLE]);
        const g = pictureGeometry(p);
        let s = run(start(file(p)), {
            type: "select",
            selection: { kind: "parts", pins: [[0, 3]], segments: [[0, 1]] },
        });
        s = run(s, { type: "edit", edit: (q) => insertPin(q, g, [0, 1], 0.5, newIds()) });
        expect(s.selection).toEqual({
            kind: "parts",
            pins: [[0, 4]],
            segments: [
                [0, 1],
                [0, 2],
            ],
        });
        const inserted = knotOf(s);
        s = run(s, { type: "edit", edit: (q) => deletePin(q, pictureGeometry(inserted), [0, 0]) });
        expect(s.selection).toEqual({
            kind: "parts",
            pins: [[0, 3]],
            segments: [
                [0, 0],
                [0, 1],
            ],
        });
        s = run(s, {
            type: "edit",
            edit: (q) => deletePin(q, pictureGeometry(knotOf(s)), [0, 3]),
        });
        expect(s.selection).toEqual({
            kind: "parts",
            pins: [],
            segments: [
                [0, 0],
                [0, 1],
            ],
        });
    });

    it("undoes and redoes a drag as one step", () => {
        const p = picture([WIGGLE]);
        const s0 = start(file(p));
        const moves = [1, 2, 3].map(
            (x) =>
                ({
                    type: "edit",
                    edit: (q: Picture) => movePin(q, [0, 1], x, x),
                }) as const,
        );
        const dragged = run(s0, { type: "begin-drag" }, ...moves, { type: "end-drag" });
        expect(knotOf(dragged).strands[0].pins[1]).toEqual({ id: pinId(0, 1), x: 3, y: 3 });
        expect(dragged.undo).toHaveLength(1);
        const undone = run(dragged, { type: "undo" });
        expect(undone.file).toBe(s0.file);
        const redone = run(undone, { type: "redo" });
        expect(redone.file).toBe(dragged.file);
        // A drag that moves nothing leaves nothing to undo.
        expect(run(s0, { type: "begin-drag" }, { type: "end-drag" }).undo).toEqual([]);
    });

    it("drags the frame as one entry, the same for every step", () => {
        const s0 = run(start(file(picture([LINE]), [picture([WIGGLE])])), {
            type: "show",
            picture: 0,
        });
        const moves = [5, 10, 15].map(
            (x) =>
                ({
                    type: "edit-file",
                    edit: (f: KnotFile) =>
                        setFrame(f, draggedFrame(s0.file.frame, [1, 1], new Vector2(x, x))),
                }) as const,
        );
        const dragged = run(s0, { type: "begin-drag" }, ...moves, { type: "end-drag" });
        expect(dragged.file.frame).toEqual({ x: -20, y: -20, w: 55, h: 55 });
        expect(dragged.undo).toHaveLength(1);
        expect(dragged.picture).toBe(0);
        expect(run(dragged, { type: "undo" }).file).toBe(s0.file);
    });

    it("shows the picture an undo changes, with the selection it had", () => {
        const f = file(picture([LINE]), [picture([WIGGLE])]);
        const selection: Selection = { kind: "parts", pins: [[0, 2]], segments: [] };
        let s = run(
            start(f),
            { type: "show", picture: 0 },
            { type: "select", selection },
            { type: "edit", edit: (q) => movePin(q, [0, 2], 0, 0) },
            { type: "show", picture: "knot" },
        );
        expect(s.selection).toEqual(NOTHING);
        s = run(s, { type: "undo" });
        expect(s.picture).toBe(0);
        expect(s.selection).toEqual(selection);
        expect(s.file).toBe(f);
        s = run(s, { type: "redo" });
        expect(s.picture).toBe(0);
        expect(pictureOf(s.file, 0).strands[0].pins[2]).toEqual({ id: pinId(0, 2), x: 0, y: 0 });
    });

    it("knows when it's saved, including after undoing back to it", () => {
        const s0 = start(file(picture([LINE])));
        expect(isSaved(s0)).toBe(true);
        const s1 = run(s0, { type: "edit", edit: (q) => movePin(q, [0, 0], 1, 1) });
        expect(isSaved(s1)).toBe(false);
        expect(isSaved(run(s1, { type: "undo" }))).toBe(true);
        expect(
            isSaved(start(file(picture([LINE]))) && loaded(s0.file, "x", { saved: false })),
        ).toBe(false);
    });
});

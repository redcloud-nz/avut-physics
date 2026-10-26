import { describe, expect, it } from "vitest";

import {
    deletePin,
    deleteStrand,
    insertPin,
    linkPins,
    movePin,
    setLink,
    setPinAngle,
    unlinkPin,
} from "./edits";
import { pictureGeometry, placedPins } from "./geometry";
import {
    isLinked,
    parseKnotFile,
    writeKnotFile,
    type KnotFile,
    type LinkedPin,
    type Picture,
    type PinLink,
} from "./knot-file";
import { free, newIds, pinId, testPicture, testStrand } from "./test-pictures";

/** A rope running right along y = 0, its middle pin holding an angle of 0 (along x). */
const leaderRope = (diameter = 1) =>
    testStrand(
        "rope",
        [
            { x: -10, y: 0 },
            { x: 0, y: 0, angle: 0 },
            { x: 10, y: 0 },
        ],
        { diameter },
    );

/** A second rope, its middle pin to be linked; it starts a little below the leader's. */
const followerRope = (diameter = 1) =>
    testStrand(
        "rope",
        [
            { x: -10, y: 3 },
            { x: 0, y: 3 },
            { x: 10, y: 3 },
        ],
        { colour: "green", diameter },
    );

/** The picture with strand 1's middle pin linked to strand 0's. */
function linked(link: Omit<PinLink, "pin">, sizes: [number, number] = [1, 1]): Picture {
    const p = testPicture([leaderRope(sizes[0]), followerRope(sizes[1])]);
    const pin: LinkedPin = { id: pinId(1, 1), link: { pin: pinId(0, 1), ...link } };
    const strands = p.strands.slice();
    strands[1] = { ...strands[1], pins: strands[1].pins.map((q, k) => (k === 1 ? pin : q)) };
    return { ...p, strands };
}

const placeOf = (p: Picture, i: number, k: number) => placedPins(p)[i][k];

describe("where a linked pin goes", () => {
    it("sits beside its leader, across the way it runs, the two drawn half-widths apart", () => {
        // The leader runs along +x; y is down, so its left is up (−y).
        expect(placeOf(linked({ side: "left" }), 1, 1)).toEqual({ x: 0, y: -1.25, angle: 0 });
        expect(placeOf(linked({ side: "right" }), 1, 1)).toEqual({ x: 0, y: 1.25, angle: 0 });
    });

    it("runs the other way reversed, and stands off by its gap", () => {
        expect(placeOf(linked({ side: "right", reverse: true }), 1, 1)).toEqual({
            x: 0,
            y: 1.25,
            angle: 180,
        });
        expect(placeOf(linked({ side: "right", gap: 2.5 }), 1, 1).y).toBe(3.75);
    });

    it("is set apart by both ropes' sizes", () => {
        // 11 mm and 6 mm: half of each drawn width (1.25 diameters) apart.
        expect(placeOf(linked({ side: "left" }, [11, 6]), 1, 1).y).toBe(-10.625);
    });

    it("turns with its leader", () => {
        const p = setPinAngle(linked({ side: "left" }), [0, 1], 90);
        // Running down (+y), its left is +x.
        const at = placeOf(p, 1, 1);
        expect(at.x).toBeCloseTo(1.25, 12);
        expect(at.y).toBeCloseTo(0, 12);
        expect(at.angle).toBe(90);
    });

    it("follows a chain of leaders", () => {
        const p = linked({ side: "right" });
        const third = testStrand("rope", [
            { x: -10, y: 6 },
            { x: 0, y: 6 },
            { x: 10, y: 6 },
        ]);
        const strands = [
            ...p.strands,
            {
                ...third,
                id: 3000,
                pins: [
                    { id: 3001, x: -10, y: 6 },
                    { id: 3002, link: { pin: pinId(1, 1), side: "right" as const, gap: 1 } },
                    { id: 3003, x: 10, y: 6 },
                ],
                segments: third.segments.map((s, k) => ({ ...s, id: 3500 + k })),
            },
        ];
        // Two diameters below the leader's line, then one more and the gap of 1.
        expect(placeOf({ ...p, strands }, 2, 1)).toEqual({ x: 0, y: 3.5, angle: 0 });
    });

    it("works out a follower's curve again when only its leader moved", () => {
        const p = linked({ side: "right" });
        const g = pictureGeometry(p);
        const moved = movePin(p, [0, 1], 0, -4);
        const again = pictureGeometry(moved, g);
        // Its pin's object is the same, but its place isn't.
        expect(moved.strands[1]).toBe(p.strands[1]);
        expect(again.strands[1].segments[0]).not.toBe(g.strands[1].segments[0]);
        expect(again.strands[1].pins[1]).toEqual({ x: 0, y: -2.75, angle: 0 });
        expect(again.strands[1].segments.map((s) => s.length)).toEqual(
            pictureGeometry(moved).strands[1].segments.map((s) => s.length),
        );
    });
});

describe("linking and unlinking", () => {
    const p = testPicture([leaderRope(), followerRope()]);
    const g = pictureGeometry(p);

    it("links on the side the follower is, running the way it runs", () => {
        const done = linkPins(p, g, [0, 1], [1, 1]);
        expect(done.strands[1].pins[1]).toEqual({
            id: pinId(1, 1),
            link: { pin: pinId(0, 1), side: "right" },
        });
        // A follower above the leader, running the other way, links on the left, reversed.
        const flipped = testPicture([
            leaderRope(),
            testStrand("rope", [
                { x: 10, y: -3 },
                { x: 0, y: -3 },
                { x: -10, y: -3 },
            ]),
        ]);
        const other = linkPins(flipped, pictureGeometry(flipped), [0, 1], [1, 1]);
        expect(other.strands[1].pins[1]).toMatchObject({ link: { side: "left", reverse: true } });
    });

    it("holds a free leader's direction as its angle first", () => {
        const loose = testPicture([followerRope(), leaderRope()]);
        const done = linkPins(loose, pictureGeometry(loose), [0, 1], [1, 1]);
        expect(free(done.strands[0].pins[1]).angle).toBeCloseTo(0, 9);
    });

    it("refuses a pin linked to itself, or round in a loop", () => {
        expect(linkPins(p, g, [0, 1], [0, 1])).toBe(p);
        const done = linkPins(p, g, [0, 1], [1, 1]);
        expect(linkPins(done, pictureGeometry(done), [1, 1], [0, 1])).toBe(done);
    });

    it("unlinks a pin where it is, holding the way it runs", () => {
        const done = linkPins(p, g, [0, 1], [1, 1]);
        expect(unlinkPin(done, [1, 1]).strands[1].pins[1]).toEqual({
            id: pinId(1, 1),
            x: 0,
            y: 1.25,
            angle: 0,
        });
        expect(unlinkPin(p, [1, 1])).toBe(p);
    });

    it("sets the side, gap and direction, leaving out a gap of 0", () => {
        const done = linkPins(p, g, [0, 1], [1, 1]);
        const set = setLink(done, [1, 1], { side: "left", gap: 2, reverse: true });
        expect(set.strands[1].pins[1]).toEqual({
            id: pinId(1, 1),
            link: { pin: pinId(0, 1), side: "left", gap: 2, reverse: true },
        });
        expect(setLink(set, [1, 1], { gap: 0, reverse: false }).strands[1].pins[1]).toEqual({
            id: pinId(1, 1),
            link: { pin: pinId(0, 1), side: "left" },
        });
        expect(setLink(set, [1, 1], { gap: -1 })).toBe(set);
        expect(setLink(set, [1, 1], { side: "left" })).toBe(set);
    });

    it("refuses moving or turning a linked pin, and clearing a leader's angle", () => {
        const done = linkPins(p, g, [0, 1], [1, 1]);
        expect(movePin(done, [1, 1], 5, 5)).toBe(done);
        expect(setPinAngle(done, [1, 1], 30)).toBe(done);
        expect(setPinAngle(done, [0, 1], undefined)).toBe(done);
    });
});

describe("links through edits", () => {
    const p = linkPins(
        testPicture([leaderRope(), followerRope()]),
        pictureGeometry(testPicture([leaderRope(), followerRope()])),
        [0, 1],
        [1, 1],
    );
    const followerOf = (q: Picture) => q.strands.flatMap((s) => s.pins).find(isLinked);

    it("keeps a link when a pin is added before its leader", () => {
        const { picture: after } = insertPin(p, pictureGeometry(p), [0, 0], 0.5, newIds());
        expect(after.strands[0].pins[2].id).toBe(pinId(0, 1));
        expect(followerOf(after)?.link.pin).toBe(pinId(0, 1));
        expect(placeOf(after, 1, 1)).toEqual(placeOf(p, 1, 1));
    });

    it("unlinks followers in place when their leader's pin or strand goes", () => {
        const where = placeOf(p, 1, 1);
        const { picture: noPin } = deletePin(p, pictureGeometry(p), [0, 1]);
        expect(followerOf(noPin)).toBeUndefined();
        expect(noPin.strands[1].pins[1]).toEqual({ id: pinId(1, 1), ...where });
        const { picture: noStrand } = deleteStrand(p, 0);
        expect(noStrand.strands[0].pins[1]).toEqual({ id: pinId(1, 1), ...where });
    });

    it("drops nothing else when a follower is deleted", () => {
        const { picture: after } = deletePin(p, pictureGeometry(p), [1, 1]);
        expect(after.strands[0]).toBe(p.strands[0]);
        expect(after.strands[1].pins.some(isLinked)).toBe(false);
    });
});

describe("links in the file", () => {
    const file = (picture: Picture): KnotFile => ({
        name: "Links",
        frame: { x: -20, y: -20, w: 40, h: 40 },
        knot: picture,
        steps: [],
    });

    it("writes a link and reads it back", async () => {
        const p = setLink(linked({ side: "left" }), [1, 1], { gap: 1.5, reverse: true });
        const text = await writeKnotFile(file(p));
        expect(JSON.parse(text).knot.strands[1].pins[1]).toEqual({
            id: pinId(1, 1),
            link: { pin: pinId(0, 1), side: "left", gap: 1.5, reverse: true },
        });
        expect(parseKnotFile(text)).toEqual({ kind: "ok", file: file(p) });
    });

    it("refuses a missing leader, a loop, and a free leader with no angle", async () => {
        const bad = async (change: (j: ReturnType<typeof JSON.parse>) => void, reason: string) => {
            const json = JSON.parse(await writeKnotFile(file(linked({ side: "left" }))));
            change(json);
            const read = parseKnotFile(JSON.stringify(json));
            expect(read.kind, reason).toBe("error");
            if (read.kind === "error") expect(read.reason).toContain(reason);
        };
        await bad((j) => (j.knot.strands[1].pins[1].link.pin = 99), "link.pin: names pin 99");
        await bad(
            (j) => (j.knot.strands[1].pins[1].link.pin = pinId(1, 1)),
            "knot.strands[1].pins[1]: is linked to itself",
        );
        await bad(
            (j) =>
                (j.knot.strands[0].pins[1] = {
                    id: pinId(0, 1),
                    link: { pin: pinId(1, 1), side: "left" },
                }),
            "is linked round in a loop",
        );
        await bad((j) => delete j.knot.strands[0].pins[1].angle, "which holds no angle");
        await bad((j) => (j.knot.strands[1].pins[1].link.side = "up"), "link.side");
        await bad(
            (j) => (j.knot.strands[1].pins[1].link.gap = -1),
            "link.gap: should be 0 or more",
        );
        await bad((j) => (j.knot.strands[1].pins[1].x = 1), 'has an unknown field "x"');
    });
});

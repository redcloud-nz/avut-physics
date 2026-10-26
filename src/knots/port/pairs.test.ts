import { describe, expect, it } from "vitest";

import { resample } from "@/lib/curve";
import { Vector2 } from "@/lib/vector2";

import { movePin } from "../../knot-editor/edits";
import { isLinked, type Picture } from "../../knot-editor/format";
import { pictureGeometry, placedPins } from "../../knot-editor/geometry";

import { strandsOf } from "./build";
import { fitRopes, pairedStretches } from "./pairs";

const D = 11;
const SPACING = 1.1 * D;
const OPTIONS = { spacing: SPACING, within: 0.2 * D, shortest: 2 * D };
const FIT = { tolerance: 0.1 * D, apart: 1.25 * D, ease: 2 * D };
const v = (x: number, y: number) => new Vector2(x, y);
const along = (...points: Vector2[]) => resample(points, 0.5);

/** A rope down one leg, round a half circle, and back up the other: the legs `SPACING` apart. */
function bight(): Vector2[] {
    const r = SPACING / 2;
    const round = Array.from({ length: 40 }, (_, k) =>
        v(r * Math.cos(Math.PI * (k / 39)), 200 + r * Math.sin(Math.PI * (k / 39))),
    );
    return along(v(r, 0), ...round, v(-r, 0));
}

const pictureOf = (ropes: Vector2[][]) => {
    const pairs = pairedStretches(ropes, OPTIONS);
    const fitted = fitRopes(
        ropes,
        ropes.map(() => []),
        pairs,
        FIT,
    );
    let next = 1;
    const strands = strandsOf(
        fitted,
        ropes.map(() => ({ kind: "rope" as const, colour: "orange" as const, diameter: D })),
        () => next++,
    );
    const picture: Picture = { strands, crossings: [], props: [] };
    return { pairs, fitted, picture };
};

describe("finding ropes side by side", () => {
    it("pairs two parallel ropes, the first leading", () => {
        const ropes = [along(v(0, 0), v(200, 0)), along(v(0, SPACING), v(200, SPACING))];
        const pairs = pairedStretches(ropes, OPTIONS);
        expect(pairs).toHaveLength(1);
        expect(pairs[0]).toMatchObject({
            leader: { rope: 0 },
            follower: { rope: 1 },
            reverse: false,
            side: "right",
        });
    });

    it("doesn't pair ropes that cross", () => {
        const ropes = [along(v(0, 0), v(200, 0)), along(v(100, -100), v(100, 100))];
        expect(pairedStretches(ropes, OPTIONS)).toEqual([]);
    });

    it("pairs a bight's legs within one rope, reversed", () => {
        const pairs = pairedStretches([bight()], OPTIONS);
        expect(pairs).toHaveLength(1);
        expect(pairs[0]).toMatchObject({
            leader: { rope: 0 },
            follower: { rope: 0 },
            reverse: true,
        });
        expect(pairs[0].follower.from).toBeGreaterThan(pairs[0].leader.to);
    });
});

describe("fitting ropes side by side as linked pins", () => {
    it("links a bight's second leg to its first, the editor's distance apart", () => {
        const { picture } = pictureOf([bight()]);
        const pins = picture.strands[0].pins;
        const followers = pins.filter(isLinked);
        expect(followers.length).toBeGreaterThan(1);
        // Every follower is placed 1.25 diameters from its leader, as the fit placed it.
        const placed = placedPins(picture)[0];
        const byId = new Map(pins.map((p, k) => [p.id, k]));
        for (const pin of followers) {
            const [a, b] = [placed[byId.get(pin.link.pin)!], placed[byId.get(pin.id)!]];
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(FIT.apart, 6);
        }
    });

    it("keeps the follower on its drawing", () => {
        const { fitted } = pictureOf([bight()]);
        expect(fitted[0].fit.worst).toBeLessThanOrEqual(FIT.tolerance);
    });

    it("moves a follower within one rope when its leader moves", () => {
        const { picture } = pictureOf([bight()]);
        const pins = picture.strands[0].pins;
        const follower = pins.findIndex(isLinked);
        const leaderId = (pins[follower] as { link: { pin: number } }).link.pin;
        const leader = pins.findIndex((p) => p.id === leaderId);
        const before = placedPins(picture)[0][follower];
        const at = placedPins(picture)[0][leader];
        const moved = movePin(picture, [0, leader], at.x + 5, at.y);
        const after = placedPins(moved)[0][follower];
        expect(after.x - before.x).toBeCloseTo(5, 6);
        expect(pictureGeometry(moved).strands[0].segments.length).toBe(pins.length - 1);
    });
});

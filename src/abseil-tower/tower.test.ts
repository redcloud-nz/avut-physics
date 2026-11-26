import { describe, expect, it } from "vitest";

import { piecePoints } from "@/scene/pieces";

import { groundAt, SIDE, TOP, towerPieces } from "./tower";

const points = piecePoints;

describe("the tower, by the compass", () => {
    const pieces = towerPieces();

    it("has its full-height boarding on the east face", () => {
        const tall = pieces.filter(
            (p) =>
                p.kind === "face" &&
                p.material === "board" &&
                points(p).some((q) => q.y > TOP - 0.1),
        );
        expect(tall.length).toBeGreaterThan(0);
        for (const p of tall) for (const q of points(p)) expect(q.x).toBeGreaterThan(SIDE);
    });

    it("has its outrigger out past the west side", () => {
        const outside = pieces.filter((p) => points(p).every((q) => q.x < -0.5));
        expect(outside.length).toBeGreaterThan(0);
        for (const p of outside) expect(p.shell?.out.x).toBe(-1);
    });

    it("has the ground falling to the west", () => {
        expect(groundAt(0)).toBeCloseTo(-1);
        expect(groundAt(SIDE)).toBeCloseTo(0);
    });

    it("keeps the stairs and their railings clear inside the corner logs and the tower's railings", () => {
        // The stairs' timber (stringers, their railings and the ladder's sides) is the only rail off the shell.
        for (const p of pieces.filter((p) => !p.shell && p.material === "rail"))
            for (const q of points(p)) {
                expect(q.x).toBeGreaterThan(0.125);
                expect(q.x).toBeLessThan(SIDE - 0.125);
                expect(q.z).toBeGreaterThan(0.125);
                expect(q.z).toBeLessThan(SIDE - 0.125);
            }
    });
});

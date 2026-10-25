import { describe, expect, it } from "vitest";

import { Vector2 } from "@/lib/vector2";

import {
    everyFineLineNumbered,
    everyLineNumbered,
    finestStep,
    GRID,
    gridLines,
    snapped,
    snappedFrame,
    snappedMove,
    snapStep,
} from "./grid";
import { scaleOf } from "./zoom";

describe("snapping", () => {
    it("puts a value on its nearest grid line", () => {
        expect(GRID).toBe(20);
        expect([9.9, 10.1, -29, -31, 0.4].map((v) => snapped(v, GRID))).toEqual([
            0, 20, -20, -40, 0,
        ]);
        expect([2.4, 2.6, -7.6].map((v) => snapped(v, 5))).toEqual([0, 5, -10]);
        expect(Object.is(snapped(-3, GRID), 0)).toBe(true);
    });

    it("moves a dragged pin onto the grid, and the others with it, keeping their shape", () => {
        const pins = [new Vector2(3, 4), new Vector2(10.5, -7), new Vector2(-12, 30)];
        const move = snappedMove(pins[0], new Vector2(25, 13), GRID);
        const moved = pins.map((p) => p.add(move));
        expect([moved[0].x, moved[0].y]).toEqual([20, 20]);
        for (const k of [1, 2]) {
            expect(moved[k].sub(moved[0]).x).toBeCloseTo(pins[k].sub(pins[0]).x, 12);
            expect(moved[k].sub(moved[0]).y).toBeCloseTo(pins[k].sub(pins[0]).y, 12);
        }
    });

    it("snaps only the frame's dragged edges, never past the opposite one", () => {
        const frame = { x: -33, y: -17, w: 70, h: 41 };
        expect(snappedFrame(frame, [1, 0], GRID)).toEqual({ x: -33, y: -17, w: 73, h: 41 });
        expect(snappedFrame(frame, [-1, -1], GRID)).toEqual({ x: -40, y: -20, w: 77, h: 44 });
        expect(snappedFrame(frame, [-1, 0], 5)).toEqual({ x: -35, y: -17, w: 72, h: 41 });
        // The left edge's nearest line is past the right edge, so it stays.
        expect(snappedFrame({ x: 12, y: 0, w: 6, h: 5 }, [-1, 0], GRID)).toEqual({
            x: 12,
            y: 0,
            w: 6,
            h: 5,
        });
    });
});

describe("gridLines", () => {
    it("draws every line close in, every fifth strong", () => {
        const lines = gridLines(-45, 105, 2);
        expect(lines.map((l) => l.at)).toEqual([-40, -20, 0, 20, 40, 60, 80, 100]);
        expect(lines.filter((l) => l.weight === "strong").map((l) => l.at)).toEqual([0, 100]);
        expect(lines.some((l) => l.weight === "fine")).toBe(false);
    });

    it("snaps to the finest lines drawn at the zoom", () => {
        expect(snapStep(scaleOf(100))).toBe(20);
        expect(snapStep(scaleOf(149))).toBe(20);
        expect(snapStep(scaleOf(150))).toBe(5);
        expect(snapStep(scaleOf(599))).toBe(5);
        expect(snapStep(scaleOf(600))).toBe(1);
        expect(snapStep(scaleOf(20))).toBe(100);
        // Too far out for any lines, it snaps to the strong lines' spacing.
        expect(finestStep(0.07)).toBeUndefined();
        expect(snapStep(0.07)).toBe(100);
    });

    it("adds millimetre lines from 600%, where the fine lines are as far apart as the grid's at 150%", () => {
        expect(5 * scaleOf(600)).toBeCloseTo(20 * scaleOf(150), 9);
        const lines = gridLines(0, 20, scaleOf(600));
        expect(lines.map((l) => l.at)).toEqual(Array.from({ length: 21 }, (_, k) => k));
        const at = (weight: string) => lines.filter((l) => l.weight === weight).map((l) => l.at);
        expect(at("strong")).toEqual([0]);
        expect(at("grid")).toEqual([20]);
        expect(at("fine")).toEqual([5, 10, 15]);
        expect(at("mm")).toHaveLength(16);
        expect(gridLines(0, 20, scaleOf(599)).some((l) => l.weight === "mm")).toBe(false);
    });

    it("numbers every grid line from 200%, and every fine line from 800%", () => {
        expect(everyLineNumbered(scaleOf(199))).toBe(false);
        expect(everyLineNumbered(scaleOf(200))).toBe(true);
        expect(everyFineLineNumbered(scaleOf(799))).toBe(false);
        expect(everyFineLineNumbered(scaleOf(800))).toBe(true);
        expect(5 * scaleOf(800)).toBeCloseTo(20 * scaleOf(200), 9);
    });

    it("adds the fine lines between them from 150%", () => {
        const lines = gridLines(-10, 100, scaleOf(150));
        expect(lines.map((l) => l.at)).toEqual(Array.from({ length: 23 }, (_, k) => -10 + 5 * k));
        const at = (weight: string) => lines.filter((l) => l.weight === weight).map((l) => l.at);
        expect(at("strong")).toEqual([0, 100]);
        expect(at("grid")).toEqual([20, 40, 60, 80]);
        expect(at("fine")).toHaveLength(17);
        expect(gridLines(0, 100, scaleOf(149)).some((l) => l.weight === "fine")).toBe(false);
    });

    it("leaves out the lines too close together zoomed out, then all of them", () => {
        // 20 mm at 0.3 px/mm is 6 px: only the strong lines, 30 px apart.
        const strong = gridLines(-250, 250, 0.3);
        expect(strong.map((l) => l.at)).toEqual([-200, -100, 0, 100, 200]);
        expect(strong.every((l) => l.weight === "strong")).toBe(true);
        // 100 mm at 0.07 px/mm is 7 px: none.
        expect(gridLines(-1000, 1000, 0.07)).toEqual([]);
        // At 0.4 px/mm, 20 mm is 8 px: every line again.
        expect(gridLines(0, 100, 0.4)).toHaveLength(6);
    });
});

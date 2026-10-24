import { describe, expect, it } from "vitest";

import { arrowShape } from "./tying-arrow";

describe("arrowShape", () => {
    it("puts the head at the last point, pointing on from the one before", () => {
        const shape = arrowShape([
            { x: 0, y: 0 },
            { x: 0, y: -5 },
        ])!;
        const [tip, a, b] = shape.head;
        expect(tip).toMatchObject({ x: 0, y: -5 });
        expect(a.y).toBeCloseTo(-3.9);
        expect(b.y).toBeCloseTo(-3.9);
        expect(a.x).toBeCloseTo(-b.x);
        // The shaft stops where the head starts.
        expect(shape.d.endsWith("0 -3.9")).toBe(true);
    });

    it("needs two points", () => {
        expect(arrowShape([{ x: 0, y: 0 }])).toBeNull();
    });
});

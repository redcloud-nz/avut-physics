import { describe, expect, it } from "vitest";

import { stepLabel } from "./figure-eight-tying";

describe("stepLabel", () => {
    it("numbers a step that continues the one before with it", () => {
        const steps = [{}, {}, { continues: true }, {}];
        expect(steps.map((_, i) => stepLabel(steps, i))).toEqual([
            "Step 1 of 3",
            "Step 2 of 3",
            "Step 2 (cont.)",
            "Step 3 of 3",
        ]);
    });

    it("numbers the first step 1 whatever it says", () => {
        expect(stepLabel([{ continues: true }], 0)).toBe("Step 1 of 1");
    });
});

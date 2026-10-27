import { describe, expect, it } from "vitest";

import { KNOTS } from ".";
import { knotView, stepLabels, workedPicture } from "./knot-drawing";

describe("stepLabels", () => {
    it("numbers each step, and marks a number shown again as continued", () => {
        expect(stepLabels([1, 2, 2, 3])).toEqual(["Step 1", "Step 2", "Step 2 (cont.)", "Step 3"]);
    });
});

describe("the knots' files", () => {
    it.each(KNOTS.map((knot) => [knot.slug, knot] as const))(
        "%s reads, and its finished knot has a view round it",
        (_, knot) => {
            const view = knotView(workedPicture(knot.file.knot));
            expect(view.w).toBeGreaterThan(0);
            expect(view.h).toBeGreaterThan(0);
        },
    );
});

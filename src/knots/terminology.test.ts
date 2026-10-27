import { describe, expect, it } from "vitest";

import { KNOTS } from ".";
import { TERMS } from "./terminology";

describe("the terminology", () => {
    it.each(TERMS.filter((term) => term.example).map((term) => [term.term, term.example] as const))(
        "%s's example is a knot",
        (_, slug) => {
            expect(KNOTS.map((knot) => knot.slug)).toContain(slug);
        },
    );

    // Pictures from a file of their own are checked as the file's read.
    it.each(
        TERMS.flatMap((term) =>
            term.picture && "knot" in term.picture ? [[term.term, term.picture] as const] : [],
        ),
    )("%s's picture is a knot's, and one of its steps where it names one", (_, picture) => {
        const knot = KNOTS.find((k) => k.slug === picture.knot);
        expect(knot).toBeDefined();
        if (picture.step !== undefined) expect(knot!.file.steps[picture.step]).toBeDefined();
    });
});

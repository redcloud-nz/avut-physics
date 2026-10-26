import { describe, expect, it } from "vitest";

import { pictureCrossings, strandPaths } from "../../knot-editor/crossing-geometry";
import { parseKnotFile, writeKnotFile, type Picture } from "../../knot-editor/format";
import { pictureGeometry } from "../../knot-editor/geometry";
import { KNOTS } from "../index";
import { ROUND_TURN_FILE } from "../round-turn";

import { convertKnot, TOLERANCE } from "./convert";

const knot = (slug: string) => KNOTS.find((k) => k.slug === slug)!;

/** What the editor would warn of in a picture: crossings or passes unset, lost, to check, or too close to draw. */
function warnings(picture: Picture) {
    const geometry = pictureGeometry(picture);
    const found = pictureCrossings(picture, geometry);
    const drawn = strandPaths(picture, geometry, found);
    return {
        unset: found.crossings.filter((c) => c.status !== "set").length,
        lost: found.lost.length,
        toCheck: found.toCheck.length,
        passes: found.passes.filter((p) => p.status !== "set").length + found.lostPasses.length,
        tooClose: drawn.tooClose.length + drawn.tooClosePasses.length,
    };
}
const NONE = { unset: 0, lost: 0, toCheck: 0, passes: 0, tooClose: 0 };

describe("converting a knot to a knot file", () => {
    it("keeps the figure-8's steps, numbers and captions, every rope close to its drawing", async () => {
        const { file, reports } = convertKnot(knot("figure-8"));
        expect(file.steps.map((s) => s.number)).toEqual([1, 2, 2, 3, 3, 4, 4]);
        expect(file.steps[0].instructions).toBe(knot("figure-8").steps![0].caption);
        expect(file.name).toBe("Figure-8");
        for (const report of reports)
            for (const rope of report.ropes) expect(rope.worst).toBeLessThanOrEqual(TOLERANCE);
        const read = parseKnotFile(await writeKnotFile(file));
        expect(read.kind).toBe("ok");
    });

    it("sets every crossing and pass, so the editor has nothing to warn of", () => {
        for (const slug of ["figure-8", "round-turn-and-two-half-hitches"]) {
            const pins = slug.startsWith("round-turn") ? ROUND_TURN_FILE.steps[0].pins : undefined;
            const { file } = convertKnot(knot(slug), pins);
            for (const picture of [file.knot, ...file.steps.map((s) => s.picture)])
                expect(warnings(picture)).toEqual(NONE);
        }
    });

    it(
        "links the joining-8's second rope to its first, and reads back",
        { timeout: 30000 },
        async () => {
            const { file } = convertKnot(knot("joining-8"));
            const [first, second] = file.knot.strands;
            expect(first).toMatchObject({ kind: "rope", colour: "orange" });
            expect(second).toMatchObject({ kind: "rope", colour: "green" });
            const leaders = new Set(first.pins.map((p) => p.id));
            expect(
                second.pins.filter((p) => "link" in p && leaders.has(p.link.pin)).length,
            ).toBeGreaterThan(5);
            expect(warnings(file.knot)).toEqual(NONE);
            expect(parseKnotFile(await writeKnotFile(file)).kind).toBe("ok");
        },
    );
});

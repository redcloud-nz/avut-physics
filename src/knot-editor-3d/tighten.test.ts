import { describe, expect, it } from "vitest";

import { parseKnotFile } from "@/knot-editor/knot-file";
import MUNTER_2HH from "@/knots/files/munter-and-two-half-hitches.json";
import { sampleRope } from "@/lib/rope-3d/pinned";
import { runStage, StageRun, type Painting, type Role } from "@/lib/rope-3d/stage";
import { timesThrough } from "@/lib/rope-3d/watch";

import { fromPicture } from "./from-drawing";
import { segmentNumber, setupOf, type Knot3dFile } from "./knot-file";

const read = parseKnotFile(JSON.stringify(MUNTER_2HH));
if (read.kind === "error") throw new Error(read.reason);
const file = fromPicture(read.file.knot, "Munter", "munter-and-two-half-hitches");

/** Segments painted by their drawn numbers, the rope's two end segments held. */
function paint(f: Knot3dFile, roles: [Role, number[]][]): Painting {
    const out = new Map<number, Role>();
    const segs = f.rope.segments;
    out.set(segs[0].id, "hold");
    out.set(segs.at(-1)!.id, "hold");
    for (const [role, numbers] of roles)
        for (const s of segs) if (numbers.includes(segmentNumber(s))) out.set(s.id, role);
    return out;
}

const MUNTER = [20, 21, 22, 23, 24, 27, 31, 32, 33];
const BIGHT = [77, 67];

describe("tightening the munter and two half hitches in stages", () => {
    it("draws the munter up a little, the bight held and the standing end straight, without passing through", () => {
        const setup = setupOf(file);
        const painting = paint(file, [
            ["shorten", MUNTER],
            ["hold", BIGHT],
            ["straight", [19]],
        ]);
        const run = runStage(new StageRun(file.rope, setup, painting, { until: 0.1 }), 3000);
        expect(run.problem).toBeNull();
        expect(run.ended).toBe("far enough");
        expect(run.shorter).toBeGreaterThanOrEqual(0.1);
        // Fitted back to pins, it's still through the carabiner as often.
        const { rope, error } = run.result();
        expect(error).toBeLessThan(file.diameter / 10);
        // The held bight and end are kept exactly, not fitted again.
        for (const s of file.rope.segments)
            if (painting.get(s.id) === "hold")
                expect(rope.segments.find((t) => t.id === s.id)).toEqual(s);
        const loop = setup.loops![0].points;
        const before = timesThrough(loop, sampleRope(file.rope, file.diameter / 4).points);
        expect(timesThrough(loop, sampleRope(rope, file.diameter / 4).points)).toBe(before);
    }, 60000);
});

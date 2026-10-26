import { describe, expect, it } from "vitest";

import { resample } from "@/lib/curve";
import { segmentDistance } from "@/lib/geometry";
import { Vector2 } from "@/lib/vector2";

import type { Picture } from "../../knot-editor/format";
import { pictureGeometry } from "../../knot-editor/geometry";
import { FIGURE_EIGHT_TYING } from "../figure-eight-tying";
import { centreline } from "../rope-path";

import { fitStrand } from "./fit";

const line = (n: number, f: (u: number) => Vector2) =>
    Array.from({ length: n + 1 }, (_, k) => f(k / n));

describe("fitting a strand to a drawing", () => {
    it("takes two free pins for a straight rope", () => {
        const fit = fitStrand(
            line(100, (u) => new Vector2(100 * u, 0)),
            [],
            { tolerance: 1 },
        );
        expect(fit.pins).toHaveLength(2);
        expect(fit.pins.every((p) => p.angle === undefined)).toBe(true);
        expect(fit.worst).toBeLessThan(0.01);
    });

    it("meets the tolerance round a half circle", () => {
        const target = line(400, (u) => Vector2.fromAngle(Math.PI * u).scale(50));
        const fit = fitStrand(target, [], { tolerance: 0.5 });
        expect(fit.worst).toBeLessThanOrEqual(0.5);
        expect(fit.pins.length).toBeLessThan(6);
    });

    it("keeps the pins it's given", () => {
        const target = line(200, (u) => new Vector2(100 * u, 20 * Math.sin(6 * u)));
        const fit = fitStrand(target, [{ index: 50 }, { index: 120 }], { tolerance: 0.3 });
        expect(fit.pins.map((p) => p.index)).toEqual(expect.arrayContaining([0, 50, 120, 200]));
        expect(fit.worst).toBeLessThanOrEqual(0.3);
    });

    it("fits a figure-8 step as the editor draws it, freeing angles only where it still fits", () => {
        const step = FIGURE_EIGHT_TYING[FIGURE_EIGHT_TYING.length - 1];
        const target = resample(
            centreline(step.path).points.map((p) => p.scale(11)),
            0.5,
        );
        const fit = fitStrand(target, [], { tolerance: 1.1 });
        // Worked out again by the editor, and measured against the drawing independently of the fit.
        const picture: Picture = {
            strands: [
                {
                    id: 1,
                    kind: "rope",
                    colour: "orange",
                    diameter: 11,
                    pins: fit.pins.map((p, k) => ({
                        id: 10 + k,
                        x: p.x,
                        y: p.y,
                        ...(p.angle !== undefined && { angle: p.angle }),
                    })),
                    segments: fit.tensions.map((tension, k) => ({ id: 100 + k, tension })),
                },
            ],
            crossings: [],
            props: [],
        };
        const drawn = pictureGeometry(picture).strands[0].segments.flatMap((seg) =>
            seg.cubic.points(48),
        );
        // Each segment's samples start where the last one's ended: a piece of no length is measured to its point.
        const far = (p: Vector2, line: Vector2[]) =>
            Math.min(
                ...line
                    .slice(1)
                    .map((q, k) =>
                        q.distanceTo(line[k]) < 1e-9
                            ? p.distanceTo(q)
                            : segmentDistance(p, line[k], q),
                    ),
            );
        const worst = Math.max(
            ...drawn.map((p) => far(p, target)),
            ...target.filter((_, k) => k % 4 === 0).map((p) => far(p, drawn)),
        );
        expect(worst).toBeLessThanOrEqual(1.1 * 1.02);
        expect(fit.pins.some((p) => p.angle === undefined)).toBe(true);
    });
});

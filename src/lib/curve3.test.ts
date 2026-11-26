import { describe, expect, it } from "vitest";

import { thinned } from "./curve3";
import { vec3 } from "./vector3";

describe("thinned", () => {
    it("brings a straight run down to its ends", () => {
        const run = Array.from({ length: 11 }, (_, i) => vec3(i, 0, 0));
        expect(thinned(run, 0.01)).toEqual([run[0], run[10]]);
    });

    it("keeps a bend further off the line than the tolerance, and not one within it", () => {
        const run = [vec3(0, 0, 0), vec3(1, 0, 0), vec3(2, 0.5, 0), vec3(3, 0, 0), vec3(4, 0, 0)];
        expect(thinned(run, 0.3)).toEqual([run[0], run[2], run[4]]);
        expect(thinned(run, 0.6)).toEqual([run[0], run[4]]);
    });

    it("keeps a closed loop closed, and round", () => {
        const round = Array.from({ length: 40 }, (_, i) => {
            const t = (2 * Math.PI * i) / 40;
            return vec3(Math.cos(t), Math.sin(t), 0);
        });
        const loop = [...round, round[0]];
        const thin = thinned(loop, 0.05);
        expect(thin[0]).toEqual(thin.at(-1));
        expect(thin.length).toBeGreaterThan(4);
        expect(thin.length).toBeLessThan(loop.length);
        // Every left-out point is within the tolerance of the line through those kept.
        for (const p of loop) {
            const near = Math.min(
                ...thin.slice(1).map((b, i) => {
                    const a = thin[i];
                    const ab = b.sub(a);
                    const t = Math.min(1, Math.max(0, p.sub(a).dot(ab) / ab.dot(ab)));
                    return p.distanceTo(a.add(ab.scale(t)));
                }),
            );
            expect(near).toBeLessThanOrEqual(0.05 + 1e-12);
        }
    });

    it("leaves a run alone with no tolerance", () => {
        const run = [vec3(0, 0, 0), vec3(1, 0, 0), vec3(2, 0, 0)];
        expect(thinned(run, 0)).toBe(run);
    });
});

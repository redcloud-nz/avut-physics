import { describe, expect, it } from "vitest";

import { vec3 } from "@/lib/vector3";

import { layoutRig, RIGS } from "./rig";
import { EAST_EDGE, OVERHEAD, overheadSpace, SIDE, TOP, topOpening, type Piece } from "./tower";

describe("the first east face rig", () => {
    const { pieces } = layoutRig(RIGS[0]);
    const ropes = pieces.filter((p) => p.kind === "strand" && p.material === "rope");
    const sling = pieces.filter((p) => p.kind === "strand" && p.material === "sling");
    // The abseil lines alone, without the belay and its bucket.
    const abseil = layoutRig({
        ...RIGS[0],
        items: RIGS[0].items.filter((i) => i.kind !== "belay" && i.id !== "bucket-3"),
    }).pieces;

    it("keeps each sling within its space on the beam: 1, 2 and 4", () => {
        const middle = (p: (typeof sling)[number]) =>
            p.kind === "strand" ? p.points.reduce((t, q) => t + q.z, 0) / p.points.length : NaN;
        for (const p of sling) {
            const z = middle(p);
            const inSpace = (n: number) => {
                const { z0, z1 } = overheadSpace(n);
                return z > z0 && z < z1;
            };
            expect(inSpace(1) || inSpace(2) || inSpace(4)).toBe(true);
        }
    });

    it("mirrors the second line's bucket across the tower's middle", () => {
        const middles = abseil
            .filter((p) => p.material === "bucket" && p.kind === "face" && p.points.length > 4)
            .map((p) =>
                p.kind === "face" ? p.points.reduce((t, q) => t + q.z, 0) / p.points.length : 0,
            );
        expect(middles).toHaveLength(2);
        expect(middles[0] + middles[1]).toBeCloseTo(SIDE);
    });

    it("lines the sling's legs and the rope up towards the rail", () => {
        // The rope's first stretch, from its hitch, points from the beam's middle at the rail's corner.
        // That's the run that ends just short of the rail, inside the tower.
        const knot = ropes.find(
            (p) => p.kind === "strand" && !p.shell && p.points[p.points.length - 1].x > SIDE - 0.5,
        )!;
        if (knot.kind !== "strand") throw new Error();
        const centre = vec3(OVERHEAD.x, (OVERHEAD.lowerY + OVERHEAD.upperY) / 2, knot.points[0].z);
        const rail = vec3(EAST_EDGE.rail.x, EAST_EDGE.rail.y, knot.points[0].z);
        const towards = rail.sub(centre).unit();
        for (const p of knot.points) expect(p.sub(centre).cross(towards).len()).toBeLessThan(0.01);
    });

    it("hangs the rope down the outside of the east face to the ground", () => {
        const last = ropes.find((p) => p.shell?.out.x === 1)!;
        if (last.kind !== "strand") throw new Error();
        const foot = last.points[last.points.length - 1];
        expect(foot.x).toBeGreaterThan(SIDE + 0.15);
        expect(foot.y).toBeLessThan(0.1);
    });

    it("stands the bucket on the top deck under the beam, just north of the stairs' steel railing", () => {
        const bucket = abseil.filter((p) => p.material === "bucket");
        expect(bucket.length).toBeGreaterThan(0);
        const pts = bucket.flatMap((p) => (p.kind === "face" ? p.points : []));
        const xs = pts.map((p) => p.x);
        const zs = pts.map((p) => p.z);
        expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(TOP);
        expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(OVERHEAD.x);
        expect(Math.min(...zs)).toBeGreaterThan(topOpening().z1);
        expect(Math.min(...zs) - topOpening().z1).toBeLessThan(0.15);
    });

    it("hangs the belay rope just past the east rail, not down to the ground", () => {
        const white = ropes.filter(
            (p) => p.kind === "strand" && p.color === "var(--rig-white)" && p.shell?.out.x === 1,
        );
        expect(white).toHaveLength(1);
        const end = white[0].kind === "strand" ? white[0].points.at(-1)! : vec3(0, 0, 0);
        expect(end.x).toBeGreaterThan(EAST_EDGE.rail.x);
        expect(end.y).toBeGreaterThan(EAST_EDGE.rail.y - 0.5);
    });

    it("stands the belay's bucket east of the stairs' steel railing, clear of the opening", () => {
        const yellow = pieces.filter(
            (p) => p.material === "bucket" && p.color === "var(--knot-yellow)",
        );
        const extra = pieces
            .filter((p) => p.material === "bucket")
            .filter((p) => !abseil.some((q) => q.material === "bucket" && sameFace(p, q)));
        expect(yellow.length).toBeGreaterThan(0);
        expect(extra.length).toBeGreaterThan(0);
        for (const p of extra)
            if (p.kind === "face")
                for (const q of p.points) {
                    expect(q.x).toBeGreaterThan(topOpening().x1);
                    expect(q.x).toBeLessThan(SIDE);
                }
    });
});

const sameFace = (a: Piece, b: Piece) =>
    a.kind === "face" &&
    b.kind === "face" &&
    a.points.length === b.points.length &&
    a.points.every((p, i) => p.distanceTo(b.points[i]) < 1e-9);

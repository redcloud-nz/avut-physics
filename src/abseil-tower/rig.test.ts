import { describe, expect, it } from "vitest";

import { vec3 } from "@/lib/vector3";

import { layoutRig, RIGS } from "./rig";
import { EAST_EDGE, OVERHEAD, SIDE, TOP, topOpening, WEST_EDGE } from "./tower";

describe("the first east face rig", () => {
    const { pieces } = layoutRig(RIGS[0]);
    const ropes = pieces.filter((p) => p.kind === "strand" && p.material === "rope");
    // The slings round the overhead beam, not the one round the stairs' stringer.
    const sling = pieces.filter(
        (p) => p.kind === "strand" && p.material === "sling" && p.points[0].y > TOP + 1,
    );
    // The abseil lines alone, without the belay and its bucket.
    const abseil = layoutRig({
        ...RIGS[0],
        items: RIGS[0].items.filter(
            (i) => i.kind !== "belay" && !["bucket-3", "bucket-4", "bucket-6"].includes(i.id),
        ),
    }).pieces;

    it("hangs each sling at its distance along the beam", () => {
        // The beam slings' carabiners: those clipped to them start where each sling's legs meet.
        const at = RIGS[0].items.flatMap((i) => (i.kind === "sling" ? [i.at] : []));
        const middle = (p: (typeof sling)[number]) =>
            p.kind === "strand" ? p.points.reduce((t, q) => t + q.z, 0) / p.points.length : NaN;
        // Each piece of tape sits within 15 cm of one of the slings' places (the angled belays' legs lean
        // a little along the beam).
        for (const p of sling)
            expect(Math.min(...at.map((z) => Math.abs(middle(p) - z)))).toBeLessThan(0.15);
        // And every sling has tape there.
        for (const z of at) expect(sling.some((p) => Math.abs(middle(p) - z) < 0.1)).toBe(true);
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
        // The rope's real end past the east rail: the stretch outside that ends rounded.
        const last = ropes.find((p) => p.kind === "strand" && p.shell?.out.x === 1 && p.capB)!;
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

    it("hangs the belay ropes just past the east rail, not down to the ground", () => {
        const white = ropes.filter(
            (p) => p.kind === "strand" && p.color === "var(--rig-white)" && p.shell?.out.x === 1,
        );
        // The red belay's too: the only red rope past the east rail.
        const red = ropes.filter(
            (p) => p.kind === "strand" && p.color === "var(--knot-red)" && p.shell?.out.x === 1,
        );
        expect(red).toHaveLength(1);
        expect(white).toHaveLength(1);
        for (const rope of [...white, ...red]) {
            const end = rope.kind === "strand" ? rope.points.at(-1)! : vec3(0, 0, 0);
            expect(end.x).toBeGreaterThan(EAST_EDGE.rail.x);
            expect(end.y).toBeGreaterThan(EAST_EDGE.rail.y - 0.5);
        }
    });

    it("stands the first belay's bucket on the top deck in line with the black bucket, clear of the opening", () => {
        // The yellow bucket on the top deck (the other is on level 3, under the redirected belay).
        const onTop = (color: string) =>
            pieces
                .filter(
                    (p) =>
                        p.material === "bucket" &&
                        p.color === color &&
                        p.kind === "face" &&
                        p.points.every((q) => q.y > TOP - 0.01),
                )
                .flatMap((p) => (p.kind === "face" ? p.points : []));
        const yellow = onTop("var(--knot-yellow)");
        const black = onTop("var(--rig-black)").filter((q) => q.z > topOpening().z1);
        expect(yellow.length).toBeGreaterThan(0);
        const mid = (vs: number[]) => (Math.min(...vs) + Math.max(...vs)) / 2;
        expect(mid(yellow.map((q) => q.z))).toBeCloseTo(mid(black.map((q) => q.z)));
        const { x0, x1, z0, z1 } = topOpening();
        for (const q of yellow) expect(q.x < x0 || q.x > x1 || q.z < z0 || q.z > z1).toBe(true);
    });

    it("stands the red belays' bucket directly under the beam, between their slings", () => {
        // The blue bucket at the north end (the other blue one is the space 4 line's, further south).
        const blue = pieces.filter(
            (p) =>
                p.material === "bucket" &&
                p.color === "var(--knot-blue)" &&
                p.kind === "face" &&
                p.points.every((q) => q.z > 3.25),
        );
        expect(blue.length).toBeGreaterThan(0);
        const pts = blue.flatMap((p) => (p.kind === "face" ? p.points : []));
        const mid = (vs: number[]) => (Math.min(...vs) + Math.max(...vs)) / 2;
        const at = (id: string) =>
            RIGS[0].items.flatMap((i) => (i.kind === "sling" && i.id === id ? [i.at] : []))[0];
        expect(mid(pts.map((p) => p.x))).toBeCloseTo(OVERHEAD.x);
        expect(mid(pts.map((p) => p.z))).toBeGreaterThan(at("sling-7"));
        expect(mid(pts.map((p) => p.z))).toBeLessThan(at("sling-6"));
    });

    it("stops the maroon fixed line just below the outrigger, not at the ground", () => {
        const maroon = ropes.filter(
            (p) => p.kind === "strand" && p.color === "var(--rig-maroon)" && p.shell?.out.x === -1,
        );
        const ends = maroon.filter((p) => p.kind === "strand" && p.capB);
        expect(ends).toHaveLength(1);
        const end = ends[0].kind === "strand" ? ends[0].points.at(-1)! : vec3(0, 0, 0);
        const { x, y, r } = WEST_EDGE.outrigger;
        expect(end.x).toBeLessThan(x - r);
        expect(end.y).toBeLessThan(y - r);
        expect(end.y).toBeGreaterThan(y - r - 0.3);
    });
});

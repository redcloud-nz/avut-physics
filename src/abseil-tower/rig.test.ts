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

    it("hangs the rope down the outside of the east face to the ground, a stopper on its end", () => {
        // The lowest points of the rope outside the east face: those at the ground are the abseil ropes' stoppers.
        const feet = ropes.flatMap((p) =>
            p.kind === "strand" && p.shell?.out.x === 1
                ? [p.points.reduce((low, q) => (q.y < low.y ? q : low))]
                : [],
        );
        const onGround = feet.filter((q) => q.y < 0.1);
        expect(onGround.length).toBeGreaterThan(0);
        for (const q of onGround) expect(q.x).toBeGreaterThan(SIDE + 0.15);
    });

    // A bucket's outline on the top deck, by the colour it's drawn.
    const bucketOnTop = (color: string) =>
        pieces
            .filter(
                (p) =>
                    p.material === "bucket" &&
                    p.color === color &&
                    p.kind === "face" &&
                    p.points.every((q) => q.y > TOP - 0.01),
            )
            .flatMap((p) => (p.kind === "face" ? p.points : []));

    it("stands the black bucket on the top deck clear of the beam to its east, just north of the stairs' opening", () => {
        // The black bucket north of the opening (the other is in the SW corner).
        const pts = bucketOnTop("var(--rig-black)").filter((q) => q.z > topOpening().z1);
        expect(pts.length).toBeGreaterThan(0);
        expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(TOP);
        expect(Math.min(...pts.map((p) => p.x))).toBeGreaterThan(OVERHEAD.x + OVERHEAD.r);
        expect(Math.min(...pts.map((p) => p.z))).toBeGreaterThan(topOpening().z1);
        expect(Math.min(...pts.map((p) => p.z)) - topOpening().z1).toBeLessThan(0.3);
    });

    it("stands the northern buckets clear of the beam to its west, the red ropes' north of the light blue's", () => {
        const pts = bucketOnTop("var(--rig-mid-blue)");
        expect(pts.length).toBeGreaterThan(0);
        expect(Math.max(...pts.map((p) => p.x))).toBeLessThan(OVERHEAD.x - OVERHEAD.r);
        // Two buckets, split by the gap between them along the beam.
        const zs = pts.map((p) => p.z).sort((a, b) => a - b);
        const gap = zs.findIndex((z, i) => i > 0 && z - zs[i - 1] > 0.05);
        expect(gap).toBeGreaterThan(0);
        const at = (id: string) =>
            RIGS[0].items.flatMap((i) => (i.kind === "sling" && i.id === id ? [i.at] : []))[0];
        // The red ropes' bucket (the northern one) reaches past the red belays' slings' middle.
        expect(zs.at(-1)!).toBeGreaterThan((at("sling-6") + at("sling-7")) / 2);
    });

    it("hangs the belay ropes just past the east rail, not down to the ground", () => {
        const white = ropes.filter(
            (p) => p.kind === "strand" && p.color === "var(--rig-white)" && p.shell?.out.x === 1,
        );
        // The red belay's too: the only red rope past the east rail.
        const red = ropes.filter(
            (p) => p.kind === "strand" && p.color === "var(--knot-red)" && p.shell?.out.x === 1,
        );
        expect(red.length).toBeGreaterThan(0);
        expect(white.length).toBeGreaterThan(0);
        // Over the rail and down to the figure 8 on its end, and no further.
        for (const rope of [...white, ...red]) {
            const points = rope.kind === "strand" ? rope.points : [];
            const low = points.reduce((l, q) => (q.y < l.y ? q : l));
            expect(low.x).toBeGreaterThan(EAST_EDGE.rail.x);
            expect(low.y).toBeGreaterThan(EAST_EDGE.rail.y - 0.5);
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

    it("stops the maroon fixed line just below the outrigger, not at the ground", () => {
        // Where it finishes: the bottom of the figure 8 on its end, outside the west side.
        const outside = ropes.flatMap((p) =>
            p.kind === "strand" && p.color === "var(--rig-maroon)" && p.shell?.out.x === -1
                ? p.points
                : [],
        );
        expect(outside.length).toBeGreaterThan(0);
        const end = outside.reduce((low, q) => (q.y < low.y ? q : low));
        const { x, y, r } = WEST_EDGE.outrigger;
        expect(end.x).toBeLessThan(x - r);
        expect(end.y).toBeLessThan(y - r);
        expect(end.y).toBeGreaterThan(y - r - 0.3);
    });
});

describe("the figure 8s", () => {
    const knotLabels = (cylinders: boolean) =>
        layoutRig(RIGS[0], undefined, { knotCylinders: cylinders }).labels.filter(
            (l) => l.text === "F8OB" || l.text === "F8",
        );

    it("are drawn as they're tied, their labels written beside them", () => {
        const labels = knotLabels(false);
        expect(labels.length).toBeGreaterThan(0);
        for (const l of labels) expect(l.on).toBeUndefined();
    });

    it("are drawn as labelled cylinders when asked, one for each knot", () => {
        const labels = knotLabels(true);
        expect(labels).toHaveLength(knotLabels(false).length);
        for (const l of labels) expect(l.on).toBeDefined();
    });
});

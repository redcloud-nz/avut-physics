import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { vec3 } from "@/lib/vector3";
import { chain, CHAIN_10 } from "@/rigging/hardware";

import type { Piece } from "./pieces";
import { buildScene, T } from "./scene-gl";
import { moved, posed } from "./transforms";

/**
 * For each copy (in the order of `pieces`): how far its corners stick out past a radius from its own strand's
 * centreline, and how far its bounds are from that strand's built on its own. A tube's rings can start at any angle round
 * it, so its corners themselves differ.
 */
function strays(pieces: Piece[]) {
    const built = buildScene(pieces, {});
    const copies = built.repeats.flatMap((s) => s.places.map((m) => ({ g: s.geometry, m })));
    return copies.map(({ g, m }, k) => {
        const p = pieces[k];
        if (p.kind !== "strand") throw new Error("not a strand");
        const line = p.points.map(T);
        const pos = g.getAttribute("position");
        const v = new THREE.Vector3();
        const seg = new THREE.Line3();
        const on = new THREE.Vector3();
        let most = 0;
        const box = new THREE.Box3();
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m);
            box.expandByPoint(v);
            let near = Infinity;
            for (let j = 0; j + 1 < line.length; j++) {
                seg.set(line[j], line[j + 1]).closestPointToPoint(v, true, on);
                near = Math.min(near, on.distanceTo(v));
            }
            most = Math.max(most, near - p.r);
        }
        const alone = buildScene([{ ...p, shape: undefined }], {}).solids[0].geometry;
        alone.computeBoundingBox();
        const bounds = Math.max(
            alone.boundingBox!.min.distanceTo(box.min),
            alone.boundingBox!.max.distanceTo(box.max),
        );
        return Math.max(most, bounds);
    });
}

describe("buildScene's repeated shapes", () => {
    const links = chain(
        [vec3(0, 1, 0), vec3(0.4, 0.7, 0.3), vec3(0.9, 0.9, -0.2)],
        vec3(0, 0, 1),
        "red",
        CHAIN_10,
    ).pieces;
    // Within a tenth of the wire's radius: a ring at a bend sits a little inside the two segments either side of it.
    const close = CHAIN_10.r / 10;

    it("draws a chain's links as copies of one link, each where its own points are", () => {
        const built = buildScene(links, {});
        expect(built.solids).toHaveLength(0);
        expect(built.repeats.reduce((n, s) => n + s.places.length, 0)).toBe(links.length);
        expect(Math.max(...strays(links))).toBeLessThan(close);
    });

    it("follows links moved and turned after they're built", () => {
        const turned = posed(moved(links, vec3(1, 2, 3)), {
            at: vec3(-2, 0, 1),
            axis: vec3(1, 1, 0).unit(),
            angle: 0.7,
        });
        expect(buildScene(turned, {}).solids).toHaveLength(0);
        expect(Math.max(...strays(turned))).toBeLessThan(close);
    });

    it("draws a link on its own when it's no longer its shape", () => {
        const [first, ...rest] = links;
        const bent =
            first.kind === "strand"
                ? {
                      ...first,
                      points: first.points.map((q, i) => (i ? q : q.add(vec3(0.01, 0, 0)))),
                  }
                : first;
        const built = buildScene([bent, ...rest], {});
        expect(built.solids).toHaveLength(1);
        expect(built.repeats.reduce((n, s) => n + s.places.length, 0)).toBe(rest.length);
    });
});

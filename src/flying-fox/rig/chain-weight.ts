import { vec3, type Vector3 } from "@/lib/vector3";
import { chainLink, chainLinks, type LinkFrame } from "@/rigging/hardware";
import type { Piece } from "@/scene/pieces";

import { CHAIN_WEIGHT, leaves, shell } from "../chain-weight";

/**
 * The chain brake's weight drawn (see `CHAIN_WEIGHT`): its strands' links hung from the ring and laid in the heap.
 */

/** The chain weight as drawn: where each of its links is, its ring, and the shackle's crown it hangs from. */
export type ChainWeight = { links: LinkFrame[]; ring: Piece; top: Vector3 };

/**
 * Strand `j`'s place in the heap: a loose spiral out from the hole, `length` long, lying on its own cone-shaped layer
 * of the heap (wandering a little in and out and up and down, as chain heaps do), as points from its inner end.
 */
function coil(ground: Vector3, e1: Vector3, e2: Vector3, j: number, length: number): Vector3[] {
    const W = CHAIN_WEIGHT;
    const n = W.strands.length;
    const turn0 = (2 * Math.PI * j) / n;
    const at = (phi: number) => {
        const r = W.hole + (W.pitch * phi) / (2 * Math.PI) + 0.012 * Math.sin(4 * phi + 1.7 * j);
        const a = turn0 + phi;
        const rise = shell(j, n) * W.heap.height * Math.max(0, 1 - r / W.heap.radius);
        const y = W.size.r + rise + 0.01 * Math.sin(3 * phi + j) * Math.min(1, rise / 0.05);
        return ground
            .add(e1.scale(r * Math.cos(a)))
            .add(e2.scale(r * Math.sin(a)))
            .add(vec3(0, Math.max(W.size.r, y), 0));
    };
    const pts: Vector3[] = [at(0)];
    let [phi, run] = [0, 0];
    for (;;) {
        phi += 0.05;
        const p = at(phi);
        const step = p.distanceTo(pts[pts.length - 1]);
        if (run + step >= length) {
            pts.push(pts[pts.length - 1].lerp(p, (length - run) / step));
            return pts;
        }
        run += step;
        pts.push(p);
    }
}

/** The points along `pts` from `from` metres along it to its end. */
function from(pts: Vector3[], s: number): Vector3[] {
    let run = 0;
    for (let i = 1; i < pts.length; i++) {
        const step = pts[i].distanceTo(pts[i - 1]);
        if (run + step >= s) return [pts[i - 1].lerp(pts[i], (s - run) / step), ...pts.slice(i)];
        run += step;
    }
    return [pts[pts.length - 1]];
}

/**
 * The chain weight with its shackle's crown (where the brake line's tied) `height` above `ground` (the point on the
 * ground under it), its ring turned to lie in the plane of up and `across`, hanging on the shackle's pin.
 *
 * Each strand lies in the heap where it was laid: lifting it draws chain up out of the heap's middle, so the rest of it
 * stays put. Its hanging links are laid from the ring, so they rise with it, and those in the heap from the strand's
 * outer end, so they stay put; where the two meet, over the hole, a link may be a little long or short.
 */
export function chainWeight(ground: Vector3, height: number, across: Vector3): ChainWeight {
    const W = CHAIN_WEIGHT;
    const { size } = W;
    const up = vec3(0, 1, 0);
    const e1 = across.sub(up.scale(across.dot(up))).unit();
    const normal = e1.cross(up);
    const top = ground.add(up.scale(height));
    const links: LinkFrame[] = [];

    // The ring hangs on the shackle's pin, the inside of its top on the pin.
    const pin = top.sub(up.scale(W.shackle.length + W.shackle.pin));
    const centre = pin.add(up.scale(W.shackle.pin - (W.ring.r - W.ring.bar)));
    const ring: Piece = {
        kind: "strand",
        points: Array.from({ length: 41 }, (_, i) => {
            const t = (2 * Math.PI * i) / 40;
            return centre
                .add(e1.scale(W.ring.r * Math.cos(t)))
                .add(up.scale(W.ring.r * Math.sin(t)));
        }),
        r: W.ring.bar,
        material: "steel",
        capA: true,
        capB: true,
        toScale: true,
    };

    // The strands, spread along the ring's bottom, the longest at one end, and at the bottom of the heap.
    const n = W.strands.length;
    W.strands.forEach((length, j) => {
        const angle = -Math.PI / 2 + W.spread * (n === 1 ? 0 : (2 * j) / (n - 1) - 1);
        const onRing = centre
            .add(e1.scale(W.ring.r * Math.cos(angle)))
            .add(up.scale(W.ring.r * Math.sin(angle)));
        // The first link's end rests on top of the ring's bar, hanging straight down through it.
        const start = onRing.add(up.scale(W.ring.bar));
        const tangent = e1.scale(-Math.sin(angle)).add(up.scale(Math.cos(angle)));
        const face = tangent.cross(up).len() > 1e-6 ? tangent.cross(up) : normal;
        // Where it leaves the heap, over the hole up its middle.
        const level = ground.y + leaves(j);
        const drop = start.y - level;
        if (length <= drop) {
            links.push(...chainLinks([start, start.sub(up.scale(length))], face, size).links);
            return;
        }
        // Its place in the heap, laid with the whole strand in it; what's still in the heap is its outer part. Down
        // to the hole, and across to where what's left starts: a few goes to get that crossing's length right.
        const spiral = coil(ground, e1, normal, j, length);
        const foot = vec3(start.x, level, start.z);
        let across = 0;
        let rest = spiral;
        for (let k = 0; k < 4; k++) {
            rest = from(spiral, Math.min(length, drop + across));
            across = foot.distanceTo(rest[0]);
        }
        const hung = chainLinks([start, foot], face, size);
        const laid = chainLinks([...rest].reverse(), up, size);
        const between = chainLinks([hung.end, laid.end], up, size);
        links.push(...hung.links, ...between.links, ...laid.links);
    });
    return { links, ring, top };
}

/** The chain weight's pieces, in `color`. */
export function chainWeightPieces(weight: ChainWeight, color: string): Piece[] {
    return [
        ...weight.links.flatMap(
            (l) => chainLink(l.near, l.d, l.m, color, CHAIN_WEIGHT.size).pieces,
        ),
        { ...weight.ring, color },
    ];
}

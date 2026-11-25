import type { Piece } from "@/abseil-tower/tower";
import { vec3, type Vector3 } from "@/lib/vector3";

import { CHAIN_10, chainLink, chainLinks, SHACKLE_10, type LinkFrame } from "./hardware";

/**
 * The chain brake's weight as a fan off one ring, after Figure 50 of the book: the brake line tied into a shackle whose
 * pin goes through a big ring, and strands of chain of different lengths hung from the ring's bottom, heaped on the
 * ground under it. Each strand lies in the heap in a loose spiral out from its middle, the longest at the bottom and the
 * shortest over the top, so the heap's a low cone; as it's lifted the strands come up out of the heap's middle and the
 * rest stays put.
 *
 * The brake's physics works from it as drawn (`chainWeightPull` in `run.ts`). Ten strands 2.1 to 2.7 m long, 54 kg in
 * all: at least the book's 50 kg, light enough to pull no more than 0.8 kN on the rider, and enough, with the
 * trolley's rolling resistance, to stop a 120 kg rider short of the static brakes.
 */
export const CHAIN_WEIGHT = {
    size: CHAIN_10,
    /** The shackle the brake line's tied into, its pin through the ring. */
    shackle: SHACKLE_10,
    /** The ring: its middle's radius and its bar's radius (m), 110 mm inside. */
    ring: { r: 0.063, bar: 0.008 },
    /** How far either side of the ring's bottom the strands hang from it (rad). */
    spread: Math.PI / 3,
    /** The strands' lengths (m), longest first: it's at the bottom of the heap. */
    strands: [2.7, 2.63, 2.57, 2.5, 2.43, 2.37, 2.3, 2.23, 2.17, 2.1],
    /** The heap: a low cone `height` high at its middle and `radius` round its foot (m). */
    heap: { height: 0.3, radius: 0.34 },
    /** The strands' spirals in the heap: the hole up its middle they come up through, and how far apart their turns are. */
    hole: 0.06,
    pitch: 0.04,
};

/** Its weight (kg/m) and how much of it there is (kg). */
export const CHAIN_10_MASS = 2.2;
export const chainWeightMass = () =>
    CHAIN_10_MASS * CHAIN_WEIGHT.strands.reduce((a, b) => a + b, 0);

/**
 * How far below the shackle's crown (where the brake line's tied) the strands hang from: down the shackle to its pin,
 * the ring hanging on the pin, and the ring's bottom.
 */
export const RING_DROP =
    CHAIN_WEIGHT.shackle.length + 2 * (CHAIN_WEIGHT.ring.r - CHAIN_WEIGHT.ring.bar);

/** How high strand `j` leaves the heap, at the hole up its middle (above the ground). */
const leaves = (j: number) => {
    const { heap, hole, strands, size } = CHAIN_WEIGHT;
    return size.r + shell(j, strands.length) * heap.height * (1 - hole / heap.radius);
};
/** How much of the heap's height strand `j` of `n` lies at: the longest (first) lowest, the shortest over the top. */
const shell = (j: number, n: number) => (j + 1) / n;

/** How much of it hangs (kg) with the shackle's crown `height` off the ground. */
export function chainWeightHanging(height: number, weight = CHAIN_WEIGHT): number {
    const below = height - RING_DROP;
    const hanging = weight.strands.reduce(
        (sum, length, j) => sum + Math.min(length, Math.max(0, below - leaves(j))),
        0,
    );
    return CHAIN_10_MASS * hanging;
}

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

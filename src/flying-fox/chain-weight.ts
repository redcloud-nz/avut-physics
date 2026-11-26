import { CHAIN_10, SHACKLE_10 } from "@/rigging/hardware";

/**
 * The chain brake's weight as a fan off one ring, after Figure 50 of the book: the brake line tied into a shackle whose
 * pin goes through a big ring, and strands of chain of different lengths hung from the ring's bottom, heaped on the
 * ground under it. Each strand lies in the heap in a loose spiral out from its middle, the longest at the bottom and the
 * shortest over the top, so the heap's a low cone; as it's lifted the strands come up out of the heap's middle and the
 * rest stays put.
 *
 * Here: its size, and how much of it hangs as it's lifted, which the brake's physics reads (`chainWeightPull` in
 * `run.ts`); it's drawn from the same numbers (`rig/chain-weight.ts`). Ten strands 2.1 to 2.7 m long, 54 kg in
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
export const leaves = (j: number) => {
    const { heap, hole, strands, size } = CHAIN_WEIGHT;
    return size.r + shell(j, strands.length) * heap.height * (1 - hole / heap.radius);
};
/** How much of the heap's height strand `j` of `n` lies at: the longest (first) lowest, the shortest over the top. */
export const shell = (j: number, n: number) => (j + 1) / n;

/** How much of it hangs (kg) with the shackle's crown `height` off the ground. */
export function chainWeightHanging(height: number, weight = CHAIN_WEIGHT): number {
    const below = height - RING_DROP;
    const hanging = weight.strands.reduce(
        (sum, length, j) => sum + Math.min(length, Math.max(0, below - leaves(j))),
        0,
    );
    return CHAIN_10_MASS * hanging;
}

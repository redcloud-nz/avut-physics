import { vec3 } from "@/lib/vector3";
import { type Piece } from "@/scene/pieces";

import { groundY, LOG, TREE } from "./site";

/** The flying fox's ground drawn: its extent, and faces shaded by how dry it is. */

/** The ground: the whole site, from behind the tree to past the anchor and out past the guys. */
export const GROUND = { x0: TREE.x - 6, x1: LOG.x + 6, z: 15 };

/** How many shades the ground's patches come in, from grass to dry ground. */
const GROUND_SHADES = 6;

/** A ground shade's colour: grass mixed with dry ground, more of it the higher `k`. */
export const groundShade = (k: number) =>
    `color-mix(in oklab, var(--fox-ground-dry) ${Math.round((100 * k) / (GROUND_SHADES - 1))}%, var(--fox-ground))`;

/**
 * How dry the ground is at `x`, `z`, from 0 (grass) to 1 (bare): a few waves at odd angles added up, so it comes in
 * irregular patches a few metres across. It's the same every time, so the drawing doesn't change from one load to the
 * next.
 */
function dryness(x: number, z: number): number {
    const waves: [number, number, number, number][] = [
        [0.31, 0.17, 0.0, 1.0],
        [-0.13, 0.41, 1.7, 0.7],
        [0.52, -0.29, 4.1, 0.5],
        [0.07, 0.73, 2.9, 0.35],
        [0.89, 0.21, 0.6, 0.3],
    ];
    const total = waves.reduce((sum, wave) => sum + wave[3], 0);
    const v = waves.reduce(
        (sum, [kx, kz, phase, a]) => sum + a * Math.sin(kx * x + kz * z + phase),
        0,
    );
    return 0.5 + 0.5 * (v / total);
}

/**
 * The ground as faces: tiles 2 m square following its fall and dip, each one of a few shades from grass to dry ground,
 * so it isn't one flat colour.
 */
export function groundFaces(step = 2): Piece[] {
    const nx = Math.ceil((GROUND.x1 - GROUND.x0) / step);
    const nz = Math.ceil((2 * GROUND.z) / step);
    // Each corner's own shade too, in finer steps, for the 3D view to blend across the tile.
    const tint = (x: number, z: number) =>
        `color-mix(in oklab, var(--fox-ground-dry) ${Math.round(Math.min(1, Math.max(0, dryness(x, z))) * 25) * 4}%, var(--fox-ground))`;
    const xAt = (i: number) => GROUND.x0 + ((GROUND.x1 - GROUND.x0) * i) / nx;
    const zAt = (j: number) => -GROUND.z + (2 * GROUND.z * j) / nz;
    const faces: Piece[] = [];
    for (let i = 0; i < nx; i++)
        for (let j = 0; j < nz; j++) {
            const [a, b] = [xAt(i), xAt(i + 1)];
            const [c, d] = [zAt(j), zAt(j + 1)];
            const dry = dryness((a + b) / 2, (c + d) / 2);
            const k = Math.min(GROUND_SHADES - 1, Math.floor(dry * GROUND_SHADES));
            faces.push({
                kind: "face",
                points: [
                    vec3(a, groundY(a), c),
                    vec3(b, groundY(b), c),
                    vec3(b, groundY(b), d),
                    vec3(a, groundY(a), d),
                ],
                material: "deck",
                color: groundShade(k),
                shades: [tint(a, c), tint(b, c), tint(b, d), tint(a, d)],
            });
        }
    return faces;
}

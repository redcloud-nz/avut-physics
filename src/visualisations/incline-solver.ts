import { clamp } from "@/lib/math";

/*
 * A block on a slope: its weight split along and into the slope, held by static friction or sliding against kinetic
 * friction.
 */

export type Setup = {
    /** The slope's angle above level (radians). */
    angle: number;
    mass: number;
    /** Friction coefficients: static (to start sliding) and kinetic (while sliding). */
    muS: number;
    muK: number;
    /** Gravity (m/s²). */
    g: number;
};

export type Forces = {
    weight: number;
    /** The slope's push square to it, and the weight's part down it. */
    normal: number;
    along: number;
    /** Friction up the slope. */
    friction: number;
    /** Down the slope: the force left over, and the acceleration it gives. */
    net: number;
    accel: number;
    /** The kinetic coefficient used: μk, but no more than μs. */
    kinetic: number;
    /** The steepest slope static friction holds the block on (radians). */
    slipsAbove: number;
};

export type InclineResult =
    | { kind: "held"; f: Forces }
    | { kind: "sliding"; f: Forces }
    | { kind: "none"; reason: string };

export function solveIncline(s: Setup): InclineResult {
    if (!(s.mass > 0)) return { kind: "none", reason: "Give the block some mass." };
    if (s.muS < 0 || s.muK < 0)
        return { kind: "none", reason: "Friction coefficients can't be less than zero." };
    const angle = clamp(s.angle, 0, Math.PI / 2);
    const weight = s.mass * s.g;
    const normal = weight * Math.cos(angle);
    const along = weight * Math.sin(angle);
    // Kinetic friction is never more than static: once a block is sliding it doesn't grip harder.
    const kinetic = Math.min(s.muK, s.muS);
    const sliding = along > s.muS * normal;
    // Held, static friction takes whatever the weight's part down the slope needs.
    const friction = sliding ? kinetic * normal : along;
    const net = along - friction;
    const f = {
        weight,
        normal,
        along,
        friction,
        net,
        accel: net / s.mass,
        kinetic,
        slipsAbove: Math.atan(s.muS),
    };
    return sliding ? { kind: "sliding", f } : { kind: "held", f };
}

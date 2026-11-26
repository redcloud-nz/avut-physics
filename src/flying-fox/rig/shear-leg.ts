import { C } from "@/flying-fox/colors";
import { BAGGING_R, groundY, HAWSER_Z, SADDLE_Y, SHEAR_LEG, SPAR_X } from "@/flying-fox/site";
import { vec3, type Vector3 } from "@/lib/vector3";
import { roundBar } from "@/rigging/knots";
import { bar } from "@/rigging/rope";
import { type Piece } from "@/scene/pieces";
import { moved } from "@/scene/transforms";

import { ACROSS, guy, LASHING_R, picket, squareLashing, UP } from "./shared";

/** The timber H-frame shear leg at the bottom end, the saddles the hawsers run over, and its guys. */

/**
 * The two guys from the shear leg's upright on side `s` (±1): from its top, at 45° out to the front and back, 1.6 times
 * its height each way (Figure 34). Each loop's dropped over the upright's top and slides down onto the top spar's
 * square lashing, the second resting on the first where they cross.
 */
function shearLegGuys(s: number): Piece[] {
    const L = SHEAR_LEG;
    const g = groundY(L.x);
    const half = L.b / 2;
    const sparX = L.x + 2 * L.r;
    const out = 1.6 * L.top;
    const r = 0.006;
    // The lashing's outermost turn round the upright, above the spar.
    const lashingTop = g + L.spar + L.r + LASHING_R + 3 * 2 * LASHING_R + LASHING_R;
    // Above the lashing where it's round the upright, and clear of the spar.
    const clear = (q: Vector3) =>
        (Math.hypot(q.x - L.x, q.z - s * half) > L.r + 0.05 || q.y - r >= lashingTop) &&
        Math.hypot(q.x - sparX, q.y - (g + L.spar)) >= L.r + r;
    const settle = { clear, others: [] as Vector3[][] };
    const from = vec3(L.x, lashingTop + r, s * half);
    return [-1, 1].flatMap((f) =>
        guy(from, vec3(L.x + f * out, 0, s * (half + out)), r, C.guy, [roundBar(from, UP, L.r)], {
            settle,
        }),
    );
}

/**
 * The guys' loops at one of the shear leg's uprights on their own, for a close look: the upright's top, a short stub
 * of the top spar to its end past the upright, the square lashing where they cross, and each guy's rope from its
 * tail's end to a little way out from its knot.
 */
export function shearLegGuyLoops(): Piece[] {
    const L = SHEAR_LEG;
    const g = groundY(L.x);
    const half = L.b / 2;
    const sparX = L.x + 2 * L.r;
    const near = (q: Vector3) => Math.hypot(q.x - L.x, q.z - half) < 0.45;
    return [
        ...bar(vec3(L.x, g + L.spar - 0.4, half), vec3(L.x, g + L.top, half), L.r, C.spar, "log"),
        ...bar(
            vec3(sparX, g + L.spar, half - 0.4),
            vec3(sparX, g + L.spar, half + 0.4),
            L.r,
            C.spar,
            "log",
        ),
        ...squareLashing(
            vec3(L.x, g + L.spar, half),
            L.r,
            vec3(sparX, g + L.spar, half),
            L.r,
            UP,
            ACROSS,
        ),
        ...shearLegGuys(1).flatMap((p): Piece[] =>
            p.kind === "strand" && p.points.some(near)
                ? [{ ...p, points: p.points.filter(near) }]
                : [],
        ),
    ];
}

/** The H-frame shear leg at the bottom end, its lashings, bagging and guys. */
export function shearLeg(): Piece[] {
    const L = SHEAR_LEG;
    const pieces: Piece[] = [];
    const half = L.b / 2;
    for (const s of [-1, 1])
        pieces.push(
            ...bar(vec3(L.x, -0.05, s * half), vec3(L.x, L.top, s * half), L.r, C.spar, "log"),
        );
    const sparX = L.x + 2 * L.r;
    // The top spar on the anchor side of the uprights, so the hawsers push it onto them; the bottom one there too.
    pieces.push(
        ...bar(
            vec3(sparX, L.spar, -half - 0.4),
            vec3(sparX, L.spar, half + 0.4),
            L.r,
            C.spar,
            "log",
        ),
    );
    pieces.push(
        ...bar(
            vec3(sparX, L.lower, -half - 0.3),
            vec3(sparX, L.lower, half + 0.3),
            L.r,
            C.spar,
            "log",
        ),
    );
    // The diagonal brace, outermost as in the photo: from near the ground beside one upright, over the bottom spar,
    // up to the other upright two thirds of the way up, lying against it.
    const braceFoot = vec3(sparX + L.r + L.braceR, 0.15, -half + 0.25);
    const braceHead = vec3(L.x + L.r + L.braceR, L.braceTop, half);
    const braceDir = braceHead.sub(braceFoot).unit();
    pieces.push(
        ...bar(
            braceFoot.sub(braceDir.scale(0.1)),
            braceHead.add(braceDir.scale(0.15)),
            L.braceR,
            C.spar,
            "log",
        ),
    );
    // Lashed to the upright at its head, and to the bottom spar where it crosses it.
    pieces.push(
        ...squareLashing(vec3(L.x, L.braceTop, half), L.r, braceHead, L.braceR, UP, braceDir, 3),
    );
    const cross = braceFoot.lerp(braceHead, (L.lower - braceFoot.y) / (braceHead.y - braceFoot.y));
    pieces.push(
        ...squareLashing(vec3(sparX, L.lower, cross.z), L.r, cross, L.braceR, ACROSS, braceDir, 3),
    );
    // Square lashings where the spars cross the uprights (prusik-started at the top spar).
    for (const s of [-1, 1]) {
        for (const y of [L.spar, L.lower])
            pieces.push(
                ...squareLashing(
                    vec3(L.x, y, s * half),
                    L.r,
                    vec3(sparX, y, s * half),
                    L.r,
                    UP,
                    ACROSS,
                ),
            );
    }
    // Hessian bagging on the top spar where each hawser lies.
    for (const s of [-1, 1])
        pieces.push(
            ...bar(
                vec3(sparX, L.spar, s * HAWSER_Z - 0.11),
                vec3(sparX, L.spar, s * HAWSER_Z + 0.11),
                BAGGING_R,
                C.hessian,
                "sling",
            ),
        );
    // The frame's built on level ground; it stands on the ground at its uprights.
    const g = groundY(L.x);
    const frame = moved(pieces, vec3(0, g, 0));
    // A star picket at each upright's heel, on the anchor side, so it can't kick out.
    for (const s of [-1, 1])
        frame.push(...picket(vec3(L.x + L.r + 0.05, 0, s * (half - 0.12)), vec3(1, 0, 0)).pieces);
    for (const s of [-1, 1]) frame.push(...shearLegGuys(s));
    return frame;
}

/** Where a hawser comes down from the shear leg to the anchor: from the saddle to the bow shackle on its sling. */
export const SADDLE = (s: number) => vec3(SPAR_X, SADDLE_Y, s * HAWSER_Z);

/**
 * Where each sling round the log is, in the gaps between its six pickets (Figure 29, dual hawser and tension setup):
 * the hawsers' in the second and fourth gaps, the Tirfor's in the middle one.
 */
export const SLING_Z = 0.4;

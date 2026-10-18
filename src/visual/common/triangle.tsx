import { COLORS } from "@/articles/colors";
import { Arrow } from "@/components/diagram/svg";
import { vec2 } from "@/lib/vector2";
import { ink } from "@/visual/common/details";

/*
 * The worked example in pages' details: a rope pulling with 3 kN up and to the right, 1.8 kN across and 2.4 kN up,
 * drawn 40 units to the kN. The maths is written as in A Gentle Introduction to Rescue Physics: the rope's pull T, at
 * an angle θ from straight up, split into sideways x and up y.
 *
 * The pull starts at the bolt, `BOLT`; its sideways part runs to the square corner, `CORNER`, and its up part on to
 * the tip.
 */

export const T = ink(COLORS.pull, "T");
export const X = ink(COLORS.sideways, "x");
export const Y = ink(COLORS.redirect, "y");

const SCALE = 40;
export const BOLT = vec2(40, 150);
export const CORNER = BOLT.add(vec2(1.8 * SCALE, 0));
export const TIP = CORNER.add(vec2(0, -2.4 * SCALE));
export const PULL = TIP.sub(BOLT);
/** Square to the pull, pointing away from the corner. */
export const AWAY = vec2(PULL.y, -PULL.x).scale(1 / PULL.len());

/** The little square that marks a square corner, inside the triangle. */
function SquareCorner() {
    const s = 10;
    return (
        <polyline
            points={`${CORNER.x - s},${CORNER.y} ${CORNER.x - s},${CORNER.y - s} ${CORNER.x},${CORNER.y - s}`}
            fill="none"
            stroke="currentColor"
        />
    );
}

/** The pull and its parts, tip to tail. */
export function Triangle() {
    return (
        <>
            <SquareCorner />
            <Arrow from={BOLT} v={CORNER.sub(BOLT)} color={COLORS.sideways} dashed />
            <Arrow from={CORNER} v={TIP.sub(CORNER)} color={COLORS.redirect} dashed />
            <Arrow from={BOLT} v={PULL} color={COLORS.pull} width={3} />
            <circle cx={BOLT.x} cy={BOLT.y} r={4} fill="currentColor" />
        </>
    );
}

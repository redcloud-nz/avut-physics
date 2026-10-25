/**
 * An arrow showing where the rope goes next: a smooth curve through a few points, with a head at the last one.
 * Coordinates are rope diameters, as for the rope.
 */

import { vec2, type Vector2 } from "@/lib/vector2";

export type ArrowPoint = { x: number; y: number };

/**
 * An arrow through `points`, drawn behind the rope unless it's in `front`. With `frontTo`, it's in front of the rope as
 * far as that point and behind it after, for a move that goes over the rope and then under it.
 */
export type Arrow = { points: ArrowPoint[]; front?: boolean; frontTo?: number };

export const ARROW_COLOR = "#f8fafc";

/** How long the head is, and how wide the shaft (diameters). */
const HEAD = 1.1;
const SHAFT = 0.28;

/**
 * The arrow through `points` as a shaft's path data and its head's corners. The shaft is a Catmull–Rom curve
 * through the points, stopping where the head starts so its end doesn't show past the head's point.
 */
export function arrowShape(
    points: ArrowPoint[],
): { d: string; head: Vector2[]; upTo: (k: number) => string } | null {
    const p = points.map((q) => vec2(q.x, q.y));
    if (p.length < 2) return null;
    const n = p.length - 1;
    const u = p[n].sub(p[n - 1]).safeUnit(vec2(0, -1));
    const tip = p[n];
    const base = tip.sub(u.scale(Math.min(HEAD, tip.distanceTo(p[n - 1]))));
    const shaft = [...p.slice(0, n), base];
    const curves: string[] = [];
    for (let i = 0; i < n; i++) {
        const before = shaft[Math.max(0, i - 1)];
        const after = shaft[Math.min(n, i + 2)];
        const c1 = shaft[i].add(shaft[i + 1].sub(before).scale(1 / 6));
        const c2 = shaft[i + 1].sub(after.sub(shaft[i]).scale(1 / 6));
        curves.push(` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${shaft[i + 1].x} ${shaft[i + 1].y}`);
    }
    // The shaft as far as point k.
    const upTo = (k: number) => `M ${shaft[0].x} ${shaft[0].y}` + curves.slice(0, k).join("");
    const side = u.perp().scale(HEAD * 0.5);
    return { d: upTo(n), head: [tip, base.add(side), base.sub(side)], upTo };
}

export function TyingArrow(props: { points: ArrowPoint[]; color?: string; upTo?: number }) {
    const { points, color = ARROW_COLOR, upTo } = props;
    const shape = arrowShape(points);
    if (!shape) return null;
    const outline = "#0f172a";
    // Only the shaft as far as point `upTo`, with no head, where it's the part of an arrow in front of the rope.
    const d = upTo === undefined ? shape.d : shape.upTo(upTo);
    const head = upTo === undefined && shape.head.map((q) => `${q.x},${q.y}`).join(" ");
    return (
        <g strokeLinecap="round" strokeLinejoin="round">
            <path d={d} fill="none" stroke={outline} strokeWidth={SHAFT + 0.2} />
            {head && <polygon points={head} fill={outline} stroke={outline} strokeWidth={0.2} />}
            <path d={d} fill="none" stroke={color} strokeWidth={SHAFT} />
            {head && <polygon points={head} fill={color} />}
        </g>
    );
}

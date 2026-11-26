import type { OrbitCamera } from "@/lib/orbit-camera";
import type { Vector2 } from "@/lib/vector2";
import type { Vector3 } from "@/lib/vector3";

import { targetFit, type Target } from "./targets";

/** The targets' boxes in a flat view, faint and named, for a click to lock onto one. */

/** The targets' names over their boxes: how wide each letter is and how far apart lines are (SVG units). */
const NAME = { width: 6.7, line: 13 };

type Projection = { cam: OrbitCamera; toSvg: (p: Vector3) => Vector2; ppm: number };
type Box = { x: number; y: number; w: number; h: number };

/** A target's box in the drawing, as its corner and size (SVG units). */
function boxOf(t: Target, { cam, toSvg, ppm }: Projection): Box {
    const f = targetFit(t, cam);
    const c = toSvg(f.centre);
    const [w, h] = [f.width * ppm, f.height * ppm];
    return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

/**
 * Each target's box, and how high its name's written: just over its box, or higher, clear of the names already
 * written, where boxes are close together.
 */
function namedBoxes(targets: Target[], view: Projection) {
    const placed: { x0: number; x1: number; y: number }[] = [];
    return targets.map((t) => {
        const b = boxOf(t, view);
        const [x0, x1] = [b.x, b.x + t.label.length * NAME.width + 4];
        let nameY = b.y - 5;
        while (placed.some((p) => p.x0 < x1 && x0 < p.x1 && Math.abs(p.y - nameY) < NAME.line))
            nameY -= NAME.line;
        placed.push({ x0, x1, y: nameY });
        return { t, b, nameY };
    });
}

/** The smallest target's box under `at` (SVG units), if any. */
export function targetAt(targets: Target[], view: Projection, at: Vector2): Target | undefined {
    return targets
        .map((t) => ({ t, b: boxOf(t, view) }))
        .filter(({ b }) => at.x >= b.x && at.x <= b.x + b.w && at.y >= b.y && at.y <= b.y + b.h)
        .sort((p, q) => p.b.w * p.b.h - q.b.w * q.b.h)[0]?.t;
}

/** Each target's box, faint, with its name; brighter under the pointer. */
export function TargetBoxes({ targets, ...view }: Projection & { targets: Target[] }) {
    return namedBoxes(targets, view).map(({ t, b, nameY }) => (
        <g key={t.slug} className="cursor-pointer opacity-60 transition-opacity hover:opacity-100">
            <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={3}
                fill="var(--ink-muted)"
                fillOpacity={0.05}
                stroke="var(--ink-muted)"
                strokeWidth={1.2}
                strokeDasharray="5 4"
            />
            <text
                x={b.x + 2}
                y={nameY}
                fill="var(--ink-soft)"
                fontSize={11}
                fontWeight={600}
                className="font-mono"
                paintOrder="stroke"
                stroke="var(--halo)"
                strokeWidth={3}
                strokeLinejoin="round"
            >
                {t.label}
            </text>
        </g>
    ));
}

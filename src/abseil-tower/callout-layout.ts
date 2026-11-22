import { Segment } from "@/lib/segment";
import { vec2, type Vector2 } from "@/lib/vector2";
import type { Vector3 } from "@/lib/vector3";

import type { Material, Piece } from "./tower";

/** A label's box on the page (SVG units). */
export type Box = { x0: number; x1: number; y0: number; y1: number };

/** Something drawn that labels keep off: a stretch of it on the page, and how wide it's drawn there. */
export type Obstacle = { segment: Segment; width: number };

/** How far labels keep from what's drawn (SVG units). */
const MARGIN = 2;

/** The drawn pieces as obstacles on the page: rods and strands as their stretches, faces as their edges. */
export function obstaclesOf(
    pieces: Piece[],
    toSvg: (p: Vector3) => Vector2,
    ppm: number,
    minWidth: Partial<Record<Material, number>>,
): Obstacle[] {
    const out: Obstacle[] = [];
    for (const piece of pieces) {
        const width =
            piece.kind === "face" ? 0 : Math.max(2 * piece.r * ppm, minWidth[piece.material] ?? 0);
        const points =
            piece.kind === "rod"
                ? [piece.a, piece.b]
                : piece.kind === "face"
                  ? [...piece.points, piece.points[0]]
                  : piece.points;
        const flat = points.map(toSvg);
        for (const segment of Segment.along(flat)) out.push({ segment, width });
        // A face covers its inside too: its box, standing in for it.
        if (piece.kind === "face") {
            const xs = flat.map((p) => p.x);
            const ys = flat.map((p) => p.y);
            const [x0, x1, y0, y1] = [
                Math.min(...xs),
                Math.max(...xs),
                Math.min(...ys),
                Math.max(...ys),
            ];
            const cx = (x0 + x1) / 2;
            out.push({ segment: new Segment(vec2(cx, y0), vec2(cx, y1)), width: x1 - x0 });
        }
    }
    return out;
}

/** Whether `o`, drawn its width, comes within the margin of box `b`. */
function hits(o: Obstacle, b: Box): boolean {
    const pad = o.width / 2 + MARGIN;
    const e = { x0: b.x0 - pad, x1: b.x1 + pad, y0: b.y0 - pad, y1: b.y1 + pad };
    const inside = (p: Vector2) => p.x >= e.x0 && p.x <= e.x1 && p.y >= e.y0 && p.y <= e.y1;
    const { a, b: end } = o.segment;
    if (inside(a) || inside(end)) return true;
    const corners = [vec2(e.x0, e.y0), vec2(e.x1, e.y0), vec2(e.x1, e.y1), vec2(e.x0, e.y1)];
    return corners.some((c, i) => o.segment.crosses(new Segment(c, corners[(i + 1) % 4])));
}

/** Obstacles filed by the page's grid squares they cover, so a box only checks those near it. */
export class ObstacleGrid {
    private cells = new Map<string, Obstacle[]>();
    constructor(
        obstacles: Obstacle[],
        private size = 40,
    ) {
        for (const o of obstacles) {
            const { a, b } = o.segment;
            const pad = o.width / 2 + MARGIN;
            this.cover(
                {
                    x0: Math.min(a.x, b.x) - pad,
                    x1: Math.max(a.x, b.x) + pad,
                    y0: Math.min(a.y, b.y) - pad,
                    y1: Math.max(a.y, b.y) + pad,
                },
                (list) => list.push(o),
            );
        }
    }

    private cover(b: Box, each: (list: Obstacle[]) => void, make = true) {
        const s = this.size;
        const [i0, i1] = [Math.floor(b.x0 / s), Math.floor(b.x1 / s)];
        const [j0, j1] = [Math.floor(b.y0 / s), Math.floor(b.y1 / s)];
        // Something drawn far bigger than the page (a long rope zoomed right in) isn't filed square by square.
        if ((i1 - i0 + 1) * (j1 - j0 + 1) > 4000) return;
        for (let i = i0; i <= i1; i++)
            for (let j = j0; j <= j1; j++) {
                const key = `${i},${j}`;
                let list = this.cells.get(key);
                if (!list) {
                    if (!make) continue;
                    list = [];
                    this.cells.set(key, list);
                }
                each(list);
            }
    }

    /** Whether anything drawn comes near box `b`. */
    blocks(b: Box): boolean {
        let hit = false;
        const seen = new Set<Obstacle>();
        this.cover(
            b,
            (list) => {
                for (const o of list) {
                    if (hit || seen.has(o)) continue;
                    seen.add(o);
                    if (hits(o, b)) hit = true;
                }
            },
            false,
        );
        return hit;
    }
}

/**
 * Where to write a label `width` wide and `height` high for a point at `at`: beside it on its `right` side if it can,
 * otherwise the other, stepping further up and down and then further out until the box is clear of the other labels
 * (`taken`) and of what's drawn (`grid`). Falls back to the first place tried.
 */
export function placeLabel(
    at: Vector2,
    width: number,
    height: number,
    right: boolean,
    gap: number,
    taken: Box[],
    grid?: ObstacleGrid,
): { x: number; y: number; right: boolean; box: Box } {
    const boxAt = (x: number, y: number, r: boolean): Box => ({
        x0: r ? x - 2 : x - width,
        x1: r ? x + width : x + 2,
        y0: y - height / 2 - 1,
        y1: y + height / 2 + 1,
    });
    const free = (b: Box) =>
        !taken.some((p) => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0) &&
        !grid?.blocks(b);
    const step = height / 2 + 1;
    for (let out = 0; out < 6; out++)
        for (let k = 0; k <= 16; k++)
            for (const side of [right, !right]) {
                for (const dy of k === 0 ? [0] : [k * step, -k * step]) {
                    const x = side ? at.x + gap + out * 24 : at.x - gap - out * 24;
                    const y = at.y + dy;
                    const box = boxAt(x, y, side);
                    if (free(box)) return { x, y, right: side, box };
                }
            }
    const x = right ? at.x + gap : at.x - gap;
    return { x, y: at.y, right, box: boxAt(x, at.y, right) };
}

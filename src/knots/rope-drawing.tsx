/**
 * Draws a rope in SVG as a tube with an outline, its sheath's weave and a highlight along the top. Where one
 * strand passes over another, the upper one is drawn over the lower one.
 *
 * The whole rope is drawn first as one path. Then each stretch of it that overlaps another strand on the page
 * is drawn again, lowest first, so the higher strand of every overlap ends up on top. The stretches have square
 * ends and pick up the weave where the rope underneath has it, and their outlines stop just short of their ends
 * (the rope underneath already has the outline there), so they join it without a seam.
 */

import { arcLengths } from "@/lib/curve";
import { segmentGap } from "@/lib/geometry";
import type { Vector2 } from "@/lib/vector2";
import type { Vector3 } from "@/lib/vector3";

import type { Rope } from "./rope";

export type RopeColors = { body: string; weave: string; highlight: string; outline: string };

export const ROPE_COLORS: RopeColors = {
    body: "#f97316",
    weave: "#9a3412",
    highlight: "#fed7aa",
    outline: "#0f172a",
};

/** How many points along the rope go in each piece tested for overlaps. */
const PIECE = 2;

/** A stretch of the rope from point `from` to point `to`, and its average height. */
type Piece = { from: number; to: number; z: number };
/** A piece with its bounding box and how far along the rope its middle is, for finding overlaps. */
type Placed = Piece & { x0: number; x1: number; y0: number; y1: number; s: number };

/**
 * The stretches of the rope that overlap another strand on the page, lowest first. `flat` is the centreline on
 * the page and `width` the rope's drawn width there. Neighbouring pieces that overlap join into one stretch,
 * except where the rope goes from above the plane to below it (from over a strand to under one).
 */
function overlappingStretches(points: Vector3[], flat: Vector2[], width: number): Piece[] {
    const s = arcLengths(flat);
    const pieces: Placed[] = [];
    for (let from = 0; from < flat.length - 1; from += PIECE) {
        const to = Math.min(from + PIECE, flat.length - 1);
        const span = flat.slice(from, to + 1);
        const xs = span.map((p) => p.x);
        const ys = span.map((p) => p.y);
        pieces.push({
            from,
            to,
            z: points.slice(from, to + 1).reduce((sum, p) => sum + p.z, 0) / (to - from + 1),
            x0: Math.min(...xs),
            x1: Math.max(...xs),
            y0: Math.min(...ys),
            y1: Math.max(...ys),
            s: (s[from] + s[to]) / 2,
        });
    }
    // Pieces closer than this along the rope are its own neighbours, even round a tight bend.
    const neighbours = 2 * width;
    const overlaps = (a: Placed, b: Placed) => {
        if (Math.abs(a.s - b.s) < neighbours) return false;
        if (a.x0 - b.x1 > width || b.x0 - a.x1 > width) return false;
        if (a.y0 - b.y1 > width || b.y0 - a.y1 > width) return false;
        for (let i = a.from; i < a.to; i++)
            for (let j = b.from; j < b.to; j++)
                if (segmentGap(flat[i], flat[i + 1], flat[j], flat[j + 1]) < width) return true;
        return false;
    };
    const stretches: (Piece & { n: number })[] = [];
    for (const a of pieces.filter((a) => pieces.some((b) => overlaps(a, b)))) {
        const last = stretches[stretches.length - 1];
        if (last && last.to === a.from && last.z > 0 === a.z > 0) {
            last.z = (last.z * last.n + a.z) / (last.n + 1);
            last.n++;
            last.to = a.to;
        } else stretches.push({ from: a.from, to: a.to, z: a.z, n: 1 });
    }
    return stretches.map(({ from, to, z }) => ({ from, to, z })).sort((a, b) => a.z - b.z);
}

/**
 * One stretch of rope: outline, body, weave and highlight, the weave starting `offset` along its pattern. With
 * `trim`, the outline stops that far short of each end.
 */
function Stretch(props: {
    flat: Vector2[];
    width: number;
    offset: number;
    trim?: number;
    colors: RopeColors;
}) {
    const { flat, width: w, offset, trim = 0, colors } = props;
    const d = flat
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join("");
    const common = {
        d,
        fill: "none",
        strokeLinejoin: "round" as const,
        strokeLinecap: "butt" as const,
    };
    const length = arcLengths(flat)[flat.length - 1];
    return (
        <>
            <path
                {...common}
                stroke={colors.outline}
                strokeWidth={w * 1.25}
                strokeDasharray={trim > 0 ? `${length - 2 * trim} ${length}` : undefined}
                strokeDashoffset={trim > 0 ? -trim : undefined}
            />
            <path {...common} stroke={colors.body} strokeWidth={w} />
            <path
                {...common}
                stroke={colors.weave}
                strokeOpacity={0.3}
                strokeWidth={w * 0.8}
                strokeDasharray={`${w * 0.15} ${w * 0.2}`}
                strokeDashoffset={offset}
            />
            <path
                {...common}
                stroke={colors.highlight}
                strokeOpacity={0.55}
                strokeWidth={w * 0.22}
            />
        </>
    );
}

/** `rope` drawn through `toSvg`, which takes a point in metres to the page; `scale` is SVG units per metre. */
export function RopeDrawing(props: {
    rope: Rope;
    toSvg: (p: Vector3) => Vector2;
    scale: number;
    colors?: RopeColors;
}) {
    const { rope, toSvg, scale, colors = ROPE_COLORS } = props;
    const flat = rope.points.map(toSvg);
    const width = rope.diameter * scale;
    const s = arcLengths(flat);
    const stretches = overlappingStretches(rope.points, flat, width);
    return (
        <g>
            <Stretch flat={flat} width={width} offset={0} colors={colors} />
            {stretches.map(({ from, to }) => {
                // Reach one point further each way, so stretches next to each other overlap rather than meet.
                const a = Math.max(0, from - 1);
                const b = Math.min(flat.length - 1, to + 1);
                return (
                    <Stretch
                        key={from}
                        flat={flat.slice(a, b + 1)}
                        width={width}
                        offset={s[a]}
                        trim={(s[b] - s[a]) / (b - a)}
                        colors={colors}
                    />
                );
            })}
        </g>
    );
}

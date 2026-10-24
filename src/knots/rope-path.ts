/**
 * A rope written as SVG path data, in rope diameters (so a stroke 1 wide is the rope's thickness) with y down as
 * in SVG. It's a list of segments, each a few path commands carrying on from where the last one ended. A
 * segment marked `over` is drawn on top of everything else: mark the stretch of rope going over at each place
 * the rope crosses itself, and leave the rest plain.
 */

import { arcLengths } from "@/lib/curve";
import { segmentIntersection } from "@/lib/geometry";
import { pathPoints } from "@/lib/svg-path";
import type { Vector2 } from "@/lib/vector2";

export type Segment = { d: string; over?: boolean };
export type RopePath = Segment[];

/** A segment that goes under whatever crosses it, or crosses nothing. */
export const plain = (d: string): Segment => ({ d });
/** A segment that goes over whatever crosses it. */
export const over = (d: string): Segment => ({ d, over: true });

/** A segment laid out: where it starts, its points, and how far along the rope it starts and how long it is. */
export type LaidSegment = Segment & {
    from: Vector2;
    points: Vector2[];
    start: number;
    length: number;
};

/** The path's segments laid out one after another. The first must start with M. */
export function laySegments(path: RopePath): LaidSegment[] {
    const laid: LaidSegment[] = [];
    let s = 0;
    for (const segment of path) {
        const last = laid[laid.length - 1];
        const points = pathPoints(segment.d, last?.points[last.points.length - 1]);
        const length = arcLengths(points)[points.length - 1];
        laid.push({ ...segment, from: points[0], points, start: s, length });
        s += length;
    }
    return laid;
}

/** The whole rope's centreline, and for each of its points whether it's on a segment marked over. */
export function centreline(path: RopePath): { points: Vector2[]; over: boolean[] } {
    const points: Vector2[] = [];
    const isOver: boolean[] = [];
    laySegments(path).forEach((seg, k) => {
        // Each segment after the first starts where the last one ended; keep that point once.
        const own = k === 0 ? seg.points : seg.points.slice(1);
        points.push(...own);
        isOver.push(...own.map(() => !!seg.over));
    });
    return { points, over: isOver };
}

/** A place where the rope crosses itself, how far along it each strand passes, and which one goes over. */
export type Crossing = {
    at: Vector2;
    s: [number, number];
    /** 0 if the strand passing first goes over, 1 if the second does, null if neither or both do. */
    over: 0 | 1 | null;
};

/** Every place where the rope crosses itself, in the order the rope first reaches them. */
export function crossings(path: RopePath): Crossing[] {
    const { points, over } = centreline(path);
    const s = arcLengths(points);
    const found: Crossing[] = [];
    for (let i = 0; i < points.length - 1; i++)
        for (let j = i + 2; j < points.length - 1; j++) {
            const hit = segmentIntersection(points[i], points[i + 1], points[j], points[j + 1]);
            if (!hit) continue;
            const [a, b] = [over[i] && over[i + 1], over[j] && over[j + 1]];
            found.push({
                at: points[i].add(points[i + 1].sub(points[i]).scale(hit.t)),
                s: [s[i] + (s[i + 1] - s[i]) * hit.t, s[j] + (s[j + 1] - s[j]) * hit.u],
                over: a === b ? null : a ? 0 : 1,
            });
        }
    return found;
}

/** How long the rope is, along its centreline (diameters). */
export function ropeLength(path: RopePath): number {
    return laySegments(path).reduce((sum, seg) => sum + seg.length, 0);
}

/** Where the rope ends, and the way it's heading there. */
export function ropeEnd(path: RopePath): { at: Vector2; heading: Vector2 } {
    const [a, b] = centreline(path).points.slice(-2);
    return { at: b, heading: b.sub(a).unit() };
}

/**
 * The rope from its start to `length` along it. Whole segments are kept as written, and the one it ends partway
 * through becomes a line through its points up to there, keeping its over or under.
 */
export function firstPart(path: RopePath, length: number): RopePath {
    const part: RopePath = [];
    for (const [k, seg] of laySegments(path).entries()) {
        if (seg.start + seg.length <= length) {
            part.push(path[k]);
            continue;
        }
        const left = length - seg.start;
        if (left <= 0) break;
        const s = arcLengths(seg.points);
        const i = s.findIndex((at) => at > left);
        if (i < 0) {
            // Rounding: it ends at this segment's end.
            part.push(path[k]);
            break;
        }
        const end = seg.points[i - 1].add(
            seg.points[i].sub(seg.points[i - 1]).scale((left - s[i - 1]) / (s[i] - s[i - 1])),
        );
        const line = [...seg.points.slice(1, i), end].map((p) => `${p.x} ${p.y}`).join(" ");
        const d = k === 0 ? `M ${seg.from.x} ${seg.from.y} L ${line}` : `L ${line}`;
        part.push(seg.over ? over(d) : plain(d));
        break;
    }
    return part;
}

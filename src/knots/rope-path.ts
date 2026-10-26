/**
 * A rope written as SVG path data, in rope diameters (so a stroke 1 wide is the rope's thickness) with y down as
 * in SVG. It's a list of segments, each a few path commands carrying on from where the last one ended. A
 * segment marked `over` is drawn on top of everything else: mark the stretch of rope going over at each place
 * the rope crosses itself, and leave the rest plain.
 */

import { arcLengths } from "@/lib/curve";
import { Segment as LineSegment } from "@/lib/geometry";
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
    const pieces = LineSegment.along(points);
    const found: Crossing[] = [];
    for (let i = 0; i < pieces.length; i++)
        for (let j = i + 2; j < pieces.length; j++) {
            const hit = pieces[i].intersection(pieces[j]);
            if (!hit) continue;
            const [a, b] = [over[i] && over[i + 1], over[j] && over[j + 1]];
            found.push({
                at: pieces[i].at(hit.t),
                s: [s[i] + (s[i + 1] - s[i]) * hit.t, s[j] + (s[j + 1] - s[j]) * hit.u],
                over: a === b ? null : a ? 0 : 1,
            });
        }
    return found;
}

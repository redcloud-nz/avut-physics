import { pictureCrossings } from "@/knot-editor/crossing-geometry";
import { pictureGeometry, strandPosition } from "@/knot-editor/geometry";
import { strandSize, type Picture, type RopeColour } from "@/knot-editor/knot-file";
import { vec3, type Vector3 } from "@/lib/vector3";
import type { Piece, RigLabel } from "@/scene/pieces";

import { line } from "./rope";

/**
 * Knots in 3D, lifted from the knot editor's flat drawings (`src/knots/files/`). A drawing says where each rope runs
 * and, where two cross, which is on top. Lifted, each rope keeps its place in the drawing's plane and rises towards the
 * viewer where it's on top, or sinks where it's underneath, so at a crossing the two are a rope's thickness apart
 * (each half the two ropes' diameters added, from the plane), easing back to the plane over `EASE` diameters either
 * side. A dressed knot's strands lie nearly flat beside each other, so it's close to how one sits.
 */

/** How many of a rope's diameters either side of a crossing it eases back to the drawing's plane over. */
const EASE = 2;

/** A rope of a knot in 3D: its centreline (metres), how thick it is (metres) and its colour in the drawing. */
export type Rope3D = { points: Vector3[]; diameter: number; colour: RopeColour };

/**
 * The ropes of `picture` in 3D, in metres: x across the drawing, y up it (the drawing's y is down) and z towards the
 * viewer, with the drawing's origin at the origin.
 */
export function liftKnot(picture: Picture): Rope3D[] {
    const geometry = pictureGeometry(picture);
    const { crossings } = pictureCrossings(picture, geometry);
    // Each strand's crossings: how far along it, which way it's lifted and how far (millimetres).
    const lifts = picture.strands.map(() => [] as { s: number; by: number; ease: number }[]);
    for (const c of crossings) {
        if (c.over === undefined) continue;
        const [a, b] = c.pair.map(([i]) => i);
        const half = (strandSize(picture.strands[a]) + strandSize(picture.strands[b])) / 4;
        c.pair.forEach(([i], j) => {
            const size = strandSize(picture.strands[i]);
            lifts[i].push({ s: c.s[j], by: c.over === j ? half : -half, ease: EASE * size });
        });
    }
    const ropes: Rope3D[] = [];
    picture.strands.forEach((strand, i) => {
        if (strand.kind !== "rope") return;
        const g = geometry.strands[i];
        // A blend of the lifts near each point: each weighed by how near its crossing is (1 at it, easing to 0), and
        // averaged where they overlap, so two crossings close together don't stack.
        const depth = (s: number) => {
            let [sum, weight] = [0, 0];
            for (const l of lifts[i]) {
                const u = Math.abs(s - l.s) / l.ease;
                if (u >= 1) continue;
                const w = Math.cos((Math.PI / 2) * u) ** 2;
                sum += w * l.by;
                weight += w;
            }
            return sum / Math.max(1, weight);
        };
        const step = strand.diameter / 4;
        const n = Math.max(2, Math.ceil(g.length / step));
        const points = Array.from({ length: n + 1 }, (_, k) => {
            const s = (g.length * k) / n;
            const { segment, t } = strandPosition(g, s);
            const p = g.segments[segment].cubic.pointAt(t);
            return vec3(p.x / 1000, -p.y / 1000, depth(s) / 1000);
        });
        ropes.push({ points, diameter: strand.diameter / 1000, colour: strand.colour });
    });
    return ropes;
}

/**
 * A knot drawing's ropes and its bars as pieces, in the drawing's plane (x across, y up): each rope in its colour
 * (`color`, or the drawing's own), and each bar seen end on as a rod `barLength` long through the plane.
 */
export function knotPieces(
    picture: Picture,
    { color, barLength = 0.08, steel }: { color?: string; barLength?: number; steel: string },
): Piece[] {
    const pieces: Piece[] = [];
    for (const rope of liftKnot(picture))
        pieces.push(...line(rope.points, rope.diameter / 2, color ?? `var(--knot-${rope.colour})`));
    for (const prop of picture.props) {
        if (prop.kind !== "bar" || prop.length !== undefined) continue;
        const at = vec3(prop.x / 1000, -prop.y / 1000, 0);
        const half = vec3(0, 0, barLength / 2);
        pieces.push({
            kind: "rod",
            a: at.sub(half),
            b: at.add(half),
            r: prop.r / 1000,
            material: "steel",
            color: steel,
            capA: true,
            capB: true,
        });
    }
    return pieces;
}

/**
 * A rope split into its numbered segments (`seg`, each point's segment), coloured by turns so each shows, with its
 * number written on it: for talking about which parts of a knot to change.
 */
export function numberedRope(
    points: Vector3[],
    r: number,
    seg: number[],
    colors: [string, string],
): { pieces: Piece[]; labels: RigLabel[] } {
    const pieces: Piece[] = [];
    const labels: RigLabel[] = [];
    let from = 0;
    for (let i = 1; i <= points.length; i++) {
        if (i < points.length && seg[i] === seg[from]) continue;
        // Each run on to the next one's first point, so there's no gap between them.
        const run = points.slice(from, Math.min(i + 1, points.length));
        pieces.push(...line(run, r, colors[(seg[from] - 1) % 2]));
        let length = 0;
        for (let k = 1; k < run.length; k++) length += run[k].distanceTo(run[k - 1]);
        const dir = run.at(-1)!.sub(run[0]);
        labels.push({
            text: String(seg[from]),
            at: run[Math.floor(run.length / 2)],
            on: { along: dir.len() > 0 ? dir.unit() : vec3(1, 0, 0), length, r },
            size: 0.55,
        });
        from = i;
    }
    return { pieces, labels };
}

/** X, Y and Z arrows from `at`, `length` long, each labelled, for saying which way to move something. */
export function axes(at: Vector3, length: number): { pieces: Piece[]; labels: RigLabel[] } {
    const r = length / 14;
    const pieces: Piece[] = [];
    const labels: RigLabel[] = [];
    const each: [string, Vector3, string][] = [
        ["X", vec3(1, 0, 0), "var(--knot-red)"],
        ["Y", vec3(0, 1, 0), "var(--knot-green)"],
        ["Z", vec3(0, 0, 1), "var(--knot-blue)"],
    ];
    for (const [text, dir, color] of each) {
        const tip = at.add(dir.scale(length));
        pieces.push({
            kind: "rod",
            a: at,
            b: tip,
            r,
            material: "steel",
            color,
            capA: true,
            capB: true,
        });
        // The arrow's head: a fatter, short rod at its tip.
        pieces.push({
            kind: "rod",
            a: tip,
            b: tip.add(dir.scale(length * 0.15)),
            r: r * 2,
            material: "steel",
            color,
            capA: true,
            capB: true,
        });
        labels.push({
            text,
            at: at.add(dir.scale(length * 0.6)),
            on: { along: dir, length: length * 0.5, r },
        });
    }
    return { pieces, labels };
}

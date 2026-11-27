import { pictureCrossings } from "@/knot-editor/crossing-geometry";
import { pictureGeometry, placedPins, strandPosition } from "@/knot-editor/geometry";
import type { Picture } from "@/knot-editor/knot-file";
import type { Knot } from "@/knots";
import { middleLoop } from "@/knots/carabiner";
import { rad } from "@/lib/math";
import { lettered, type Pin3, type Segment3 } from "@/lib/rope-3d/pinned";
import { pointAt } from "@/lib/rope-3d/rope";
import { vec3 } from "@/lib/vector3";
import { liftKnot } from "@/rigging/knot-3d";
import { drawingCrossings } from "@/rigging/knot-crossings";

import type { Knot3dFile, Prop3 } from "./knot-file";

/**
 * A new 3D knot from a knot drawing's first rope: its pins and segments as they're drawn, with their numbers, each pin
 * raised or sunk as `liftKnot` lifts the rope there (rising where it's on top at a crossing, sinking where it's
 * underneath). One curve between two pins can't rise over one strand and sink under the next, so a pin's added at each
 * crossing and each pass in front of or behind a prop that's more than half a diameter from the segment's ends, the
 * segment's pieces lettered (19a, 19b). Pins holding an angle in the drawing hold it; the rest take their directions
 * from their neighbours, as in the drawing. Its bars come in as bars and its carabiners as the closed loop of their
 * rod's middle line. Further ropes aren't brought in.
 */
export function fromPicture(picture: Picture, name: string, from: string): Knot3dFile {
    const strand = picture.strands[0];
    if (strand?.kind !== "rope") throw new Error("The drawing's first strand isn't a rope.");
    const geometry = pictureGeometry(picture);
    const g = geometry.strands[0];
    const placed = placedPins(picture)[0];
    const [lifted] = liftKnot(picture);
    // The lifted rope's points are evenly along the drawn rope, so how high it is a distance along comes from them.
    const heights = lifted.points.map((p) => vec3(0, 0, p.z));
    const heightArc = lifted.points.map((_, i) => (g.length * i) / (lifted.points.length - 1));
    const height = (s: number) => pointAt(heights, heightArc, s).z;
    const at = (s: number) => {
        const { segment, t } = strandPosition(g, s);
        const p = g.segments[segment].cubic.pointAt(t);
        return vec3(p.x / 1000, -p.y / 1000, height(s));
    };

    // Where along the rope it crosses itself or passes a prop.
    const { crossings, passes } = pictureCrossings(picture, geometry);
    const marks: number[] = [];
    for (const c of crossings) {
        if (c.over === undefined) continue;
        c.pair.forEach(([i], j) => i === 0 && marks.push(c.s[j]));
    }
    for (const p of passes) if (p.side !== undefined && p.strand === 0) marks.push(p.s);
    marks.sort((a, b) => a - b);

    let nextId =
        Math.max(0, ...strand.pins.map((p) => p.id), ...strand.segments.map((s) => s.id)) + 1;
    const pins: Pin3[] = [];
    const segments: Segment3[] = [];
    const half = strand.diameter / 2;
    strand.pins.forEach((pin, k) => {
        const s = k < g.segments.length ? g.starts[k] : g.length;
        const angle = placed[k].angle;
        pins.push({
            id: pin.id,
            at: at(s),
            ...(angle !== undefined && {
                along: vec3(Math.cos(rad(angle)), -Math.sin(rad(angle)), 0),
            }),
        });
        if (k === g.segments.length) return;
        const [start, end] = [g.starts[k], g.starts[k] + g.segments[k].length];
        const inner = marks.filter((m) => m - start > half && end - m > half);
        const seg = strand.segments[k];
        const tension = g.segments[k].tension;
        inner.forEach((m, j) => {
            segments.push({
                id: j === 0 ? seg.id : nextId++,
                name: String(seg.id),
                tension: [j === 0 ? tension[0] : 1, 1],
            });
            pins.push({ id: nextId++, at: at(m) });
        });
        segments.push({
            id: inner.length ? nextId++ : seg.id,
            name: String(seg.id),
            tension: [inner.length ? 1 : tension[0], tension[1]],
        });
    });

    const props: Prop3[] = picture.props.map((prop, i) =>
        prop.kind === "bar"
            ? {
                  id: i + 1,
                  kind: "bar" as const,
                  at: vec3(prop.x / 1000, -prop.y / 1000, 0),
                  along: prop.length === undefined ? vec3(0, 0, 1) : vec3(1, 0, 0),
                  r: prop.r / 1000,
              }
            : {
                  id: i + 1,
                  kind: "carabiner" as const,
                  loop: middleLoop(prop).map((q) => vec3(q.x / 1000, -q.y / 1000, 0)),
                  r: prop.r / 1000,
              },
    );
    const d = strand.diameter / 1000;
    return {
        name,
        from,
        diameter: d,
        minBend: d,
        stiffness: 0.05,
        props,
        rope: { pins, segments: lettered(segments) },
        crossings: drawingCrossings(picture).map((c) => ({
            crossing: c.crossing + 1,
            over: c.over,
        })),
        knot: [],
        stages: [],
    };
}

/** A new 3D knot from one of the Rescue Knots drawings. */
export const fromDrawing = (knot: Knot): Knot3dFile =>
    fromPicture(
        knot.file.knot,
        knot.variant ? `${knot.name} ${knot.variant}` : knot.name,
        knot.slug,
    );

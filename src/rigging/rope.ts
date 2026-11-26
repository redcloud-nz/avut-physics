import { vec3, type Vector3 } from "@/lib/vector3";
import { rod, timber, type Material, type Strand } from "@/scene/pieces";
import { colored } from "@/scene/transforms";

/**
 * Rope, wire and plain steel as pieces: runs of rope or wire through points, round bars and sections, and the line a
 * rope hangs in between two points.
 */

/** The steel's colour, unless a piece gives its own. */
const STEEL = "var(--tower-steel)";

/** A straight round piece in a colour. */
export const bar = (
    a: Vector3,
    b: Vector3,
    r: number,
    color: string,
    material: Material = "steel",
) => colored(rod(a, b, r, material, 2), color);

/**
 * A square or rectangular steel section from `a` to `b`, `h` deep as near `up` as it can be, its long edges rounded as
 * a hollow section's are (a plate's left square).
 */
export const section = (a: Vector3, b: Vector3, up: Vector3, w: number, h: number, color = STEEL) =>
    colored(timber(a, b, up, w, h, "steel", true, Math.min(w, h) >= 0.03 ? STEEL_ROUND : 0), color);

/** How round a hollow steel section's long edges are. */
const STEEL_ROUND = 0.005;

/**
 * A run of rope or wire through `points`. Long runs are cut into strands of about `piece` points, for the sort. `cut`
 * says which of its ends (`a` the first, `b` the last) are cut ends of rope, squared off and fused.
 */
export function line(
    points: Vector3[],
    r: number,
    color: string,
    material: Material = "rope",
    cut: { a?: boolean; b?: boolean } = {},
): Strand[] {
    const piece = 12;
    const out: Strand[] = [];
    for (let i = 0; i < points.length - 1; i += piece) {
        const pts = points.slice(i, Math.min(points.length, i + piece + 1));
        out.push({
            kind: "strand",
            points: pts,
            r,
            material,
            color,
            capA: i === 0,
            capB: i + piece >= points.length - 1,
            ...(i === 0 && cut.a && { cutA: true }),
            ...(i + piece >= points.length - 1 && cut.b && { cutB: true }),
        });
    }
    return out;
}

/** Points along a hanging line from `a` to `b`, `sag` below the straight line between them at its middle. */
export function hanging(a: Vector3, b: Vector3, sag: number, n = 40): Vector3[] {
    return Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        return a.lerp(b, t).add(vec3(0, -4 * sag * t * (1 - t), 0));
    });
}

/** A level unit vector pointing from `a` towards `b`. */
export const towards = (a: Vector3, b: Vector3) => vec3(b.x - a.x, 0, b.z - a.z).unit();

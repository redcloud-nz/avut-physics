/**
 * SVG path data: numbers and points written for it, and paths read back as points, for measuring a path outside a
 * browser. Reading handles the absolute commands M, L, H, V, C and A (lines, cubic Béziers and elliptical arcs), the
 * ones worth writing by hand.
 */

import { Vector2 } from "./vector2";

/**
 * A coordinate or length as written in path data, rounded to 0.0001. Worked out along curves, its last digits can
 * differ between the server and the browser, and the page wouldn't then match as it hydrates.
 */
export const svgNumber = (value: number) => Math.round(value * 1e4) / 1e4;

/** A point as written in path data: its rounded x and y, separated by a space. */
export const svgPoint = (p: Vector2) => `${svgNumber(p.x)} ${svgNumber(p.y)}`;

/** How many numbers each command takes. */
const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, A: 7 };

/** The commands in `d`, each with its numbers. Repeated arguments after a command repeat it (after M, as L). */
function parse(d: string): { command: string; args: number[] }[] {
    const tokens = d.match(/[a-df-zA-DF-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
    const out: { command: string; args: number[] }[] = [];
    let i = 0;
    let command = "";
    while (i < tokens.length) {
        if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++];
        const arity = ARITY[command];
        if (arity === undefined)
            throw new Error(`Unsupported path command "${command}" in "${d}".`);
        const args = tokens.slice(i, i + arity).map(Number);
        if (args.length < arity || args.some(Number.isNaN))
            throw new Error(`"${command}" needs ${arity} numbers in "${d}".`);
        out.push({ command, args });
        i += arity;
        if (command === "M") command = "L";
    }
    return out;
}

/** Points along an SVG elliptical arc, by the conversion to centre form in the SVG specification (F.6.5). */
function arcPoints(from: Vector2, args: number[], step: number): Vector2[] {
    let [rx, ry] = [Math.abs(args[0]), Math.abs(args[1])];
    const phi = (args[2] * Math.PI) / 180;
    const [large, sweep] = [args[3] !== 0, args[4] !== 0];
    const to = new Vector2(args[5], args[6]);
    if (rx === 0 || ry === 0) return [to];
    const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
    const half = from.sub(to).scale(0.5);
    const x1 = cos * half.x + sin * half.y;
    const y1 = -sin * half.x + cos * half.y;
    // Radii too small to reach are scaled up until they just do.
    const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
    if (lambda > 1) [rx, ry] = [rx * Math.sqrt(lambda), ry * Math.sqrt(lambda)];
    const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
    const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
    const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
    const [cx1, cy1] = [(k * rx * y1) / ry, (-k * ry * x1) / rx];
    const mid = from.add(to).scale(0.5);
    const centre = new Vector2(cos * cx1 - sin * cy1 + mid.x, sin * cx1 + cos * cy1 + mid.y);
    const angle = (ux: number, uy: number) => Math.atan2(uy, ux);
    const start = angle((x1 - cx1) / rx, (y1 - cy1) / ry);
    let delta = angle((-x1 - cx1) / rx, (-y1 - cy1) / ry) - start;
    if (!sweep && delta > 0) delta -= 2 * Math.PI;
    if (sweep && delta < 0) delta += 2 * Math.PI;
    const n = Math.max(2, Math.ceil((Math.abs(delta) * Math.max(rx, ry)) / step));
    return Array.from({ length: n }, (_, j) => {
        const t = start + (delta * (j + 1)) / n;
        const [ex, ey] = [rx * Math.cos(t), ry * Math.sin(t)];
        return j === n - 1
            ? to
            : new Vector2(centre.x + cos * ex - sin * ey, centre.y + sin * ex + cos * ey);
    });
}

/**
 * Points along path data `d`, about `step` apart, starting from `from` (or from the path's own first M). The
 * corners of lines and the ends of curves are always among them.
 */
export function pathPoints(d: string, from?: Vector2, step = 0.05): Vector2[] {
    const points: Vector2[] = from ? [from] : [];
    let at = from;
    for (const { command, args } of parse(d)) {
        if (command === "M") {
            at = new Vector2(args[0], args[1]);
            points.push(at);
            continue;
        }
        if (!at) throw new Error(`The path "${d}" must start with M or be given a starting point.`);
        const a = at;
        let next: Vector2[];
        if (command === "C") {
            const [p1, p2, p3] = [0, 2, 4].map((k) => new Vector2(args[k], args[k + 1]));
            const rough = a.distanceTo(p1) + p1.distanceTo(p2) + p2.distanceTo(p3);
            const n = Math.max(2, Math.ceil(rough / step));
            next = Array.from({ length: n }, (_, j) => {
                const t = (j + 1) / n;
                const u = 1 - t;
                return a
                    .scale(u * u * u)
                    .add(p1.scale(3 * u * u * t))
                    .add(p2.scale(3 * u * t * t))
                    .add(p3.scale(t * t * t));
            });
        } else if (command === "A") next = arcPoints(a, args, step);
        else {
            const to =
                command === "H"
                    ? new Vector2(args[0], a.y)
                    : command === "V"
                      ? new Vector2(a.x, args[0])
                      : new Vector2(args[0], args[1]);
            const n = Math.max(1, Math.ceil(a.distanceTo(to) / step));
            next = Array.from({ length: n }, (_, j) => a.add(to.sub(a).scale((j + 1) / n)));
        }
        points.push(...next);
        at = next[next.length - 1];
    }
    return points;
}

/**
 * Changes to a pinned rope and its arrows, as the rope editor makes them: each returns a new rope and leaves the
 * old one alone. Positions and lengths are kept to hundredths of a diameter and angles to tenths of a degree, so
 * the saved steps stay readable.
 */

import { OVER_MATCH, type PinnedRope, type RopeShape } from "./pinned-rope";
import type { Crossing } from "./rope-path";
import type { Arrow, ArrowPoint } from "./tying-arrow";

const r2 = (v: number) => Math.round(v * 100) / 100;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Pin the rope at its point `node`, splitting the stretch (or the tail) it's on. Returns the new pin's index. */
export function addPin<R extends PinnedRope>(
    rope: R,
    shape: RopeShape,
    node: number,
): { rope: R; index: number } {
    const { points, s, pinNodes } = shape;
    const at = { x: r2(points[node].x), y: r2(points[node].y) };
    const k = pinNodes.findLastIndex((m) => m <= node);
    if (pinNodes[k] === node) return { rope, index: k };
    const before = r2(s[node] - s[pinNodes[k]]);
    const pins = [...rope.pins.slice(0, k + 1), at, ...rope.pins.slice(k + 1)];
    if (k === rope.pins.length - 1)
        return {
            rope: {
                ...rope,
                pins,
                lengths: [...rope.lengths, before],
                tail: r2(rope.tail - before),
            },
            index: k + 1,
        };
    const lengths = [
        ...rope.lengths.slice(0, k),
        before,
        r2(rope.lengths[k] - before),
        ...rope.lengths.slice(k + 1),
    ];
    return { rope: { ...rope, pins, lengths }, index: k + 1 };
}

/** Take pin `k` out, joining the rope either side of it into one stretch. The first pin, the rope's start, stays. */
export function removePin<R extends PinnedRope>(rope: R, k: number): R {
    if (k <= 0) return rope;
    const pins = rope.pins.filter((_, i) => i !== k);
    if (k === rope.pins.length - 1)
        return {
            ...rope,
            pins,
            lengths: rope.lengths.slice(0, -1),
            tail: r2(rope.tail + rope.lengths[k - 1]),
        };
    const lengths = [
        ...rope.lengths.slice(0, k - 1),
        r2(rope.lengths[k - 1] + rope.lengths[k]),
        ...rope.lengths.slice(k + 1),
    ];
    return { ...rope, pins, lengths };
}

/** Move pin `k`. */
export function movePin<R extends PinnedRope>(rope: R, k: number, x: number, y: number): R {
    return { ...rope, pins: rope.pins.map((p, i) => (i === k ? { ...p, x: r2(x), y: r2(y) } : p)) };
}

/** Hold the rope at pin `k` heading at `angle` (degrees), or let it head any way with `undefined`. */
export function setAngle<R extends PinnedRope>(rope: R, k: number, angle: number | undefined): R {
    return {
        ...rope,
        pins: rope.pins.map((p, i) => {
            if (i !== k) return p;
            if (angle !== undefined) return { ...p, angle: r1(((angle + 540) % 360) - 180) };
            const rest = { ...p };
            delete rest.angle;
            return rest;
        }),
    };
}

/** Set how much rope there is after pin `k`: to the next pin, or past the last one. */
export function setLengthAfter<R extends PinnedRope>(rope: R, k: number, length: number): R {
    if (k === rope.pins.length - 1) return { ...rope, tail: r2(Math.max(0, length)) };
    return { ...rope, lengths: rope.lengths.map((l, i) => (i === k ? r2(length) : l)) };
}

/** Swap which strand goes over at a crossing (or, where neither does yet, put the first one over). */
export function flipCrossing<R extends PinnedRope>(
    rope: R,
    crossing: Pick<Crossing, "s" | "over">,
): R {
    const top = crossing.over === 0 ? 1 : 0;
    const over = rope.over.filter((o) => crossing.s.every((s) => Math.abs(o - s) >= OVER_MATCH));
    return { ...rope, over: [...over, r2(crossing.s[top])].sort((a, b) => a - b) };
}

/** A rope that may carry arrows. */
type Arrowed = PinnedRope & { arrows?: Arrow[] };

/** The step with its arrows `arrows`, leaving the field out when there are none. */
function withArrows<R extends Arrowed>(rope: R, arrows: Arrow[]): R {
    const next: R = { ...rope, arrows };
    if (!arrows.length) delete (next as Arrowed).arrows;
    return next;
}

/** The step with arrow `a` changed by `edit`. */
function editArrow<R extends Arrowed>(rope: R, a: number, edit: (arrow: Arrow) => Arrow): R {
    return withArrows(
        rope,
        (rope.arrows ?? []).map((arrow, i) => (i === a ? edit(arrow) : arrow)),
    );
}

/** Add an arrow through `points`, behind the rope. Returns the new arrow's index. */
export function addArrow<R extends Arrowed>(
    rope: R,
    points: ArrowPoint[],
): { rope: R; index: number } {
    const arrows = rope.arrows ?? [];
    const rounded = points.map((p) => ({ x: r2(p.x), y: r2(p.y) }));
    return { rope: withArrows(rope, [...arrows, { points: rounded }]), index: arrows.length };
}

/** Take arrow `a` out. */
export function removeArrow<R extends Arrowed>(rope: R, a: number): R {
    return withArrows(
        rope,
        (rope.arrows ?? []).filter((_, i) => i !== a),
    );
}

/** Move point `j` of arrow `a`. */
export function moveArrowPoint<R extends Arrowed>(
    rope: R,
    a: number,
    j: number,
    x: number,
    y: number,
): R {
    return editArrow(rope, a, (arrow) => ({
        ...arrow,
        points: arrow.points.map((p, k) => (k === j ? { x: r2(x), y: r2(y) } : p)),
    }));
}

/**
 * Give arrow `a` one more point (carrying on past its head the way it points, as far as its last stretch) or,
 * with `more` false, one fewer (down to two).
 */
export function resizeArrow<R extends Arrowed>(rope: R, a: number, more: boolean): R {
    return editArrow(rope, a, (arrow) => {
        const { points } = arrow;
        if (!more) return points.length > 2 ? { ...arrow, points: points.slice(0, -1) } : arrow;
        const [p, q] = points.slice(-2);
        return { ...arrow, points: [...points, { x: r2(2 * q.x - p.x), y: r2(2 * q.y - p.y) }] };
    });
}

/** Draw arrow `a` in front of the rope, or behind it. */
export function setArrowFront<R extends Arrowed>(rope: R, a: number, front: boolean): R {
    return editArrow(rope, a, ({ points }) => (front ? { points, front } : { points }));
}

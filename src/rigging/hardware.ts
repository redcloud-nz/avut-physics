import { bisect } from "@/lib/numeric/roots";
import { vec3, type Vector3 } from "@/lib/vector3";
import { rod, type Face, type Piece } from "@/scene/pieces";

/**
 * Rigging hardware built from the tower's pieces: grooved sheaves, plates cut to shape with holes, bolts, carabiners,
 * and from them a trolley and a pulley. Sizes are typical of rated rescue and zip line gear, not any one maker's.
 */

/** A point in a plane: `u` and `v` along its two directions. */
type Flat = [number, number];

/** Where a part sits: its origin, two directions in its plane (`u`, `v`), and the way through it (`n`). */
export type Frame = { o: Vector3; u: Vector3; v: Vector3; n: Vector3 };

const at = (f: Frame, [a, b]: Flat, c = 0) =>
    f.o.add(f.u.scale(a)).add(f.v.scale(b)).add(f.n.scale(c));

/** A steel or alloy rod from `a` to `b`, in `color`, adding detail `fine` big. */
function part(a: Vector3, b: Vector3, r: number, color: string, fine?: number): Piece[] {
    return rod(a, b, r, "steel", 2).map((p) => ({
        ...p,
        color,
        toScale: true,
        ...(fine !== undefined && { fine }),
    }));
}

/** A circle's points, anticlockwise from `u`. */
export function circle(centre: Flat, r: number, n = 14): Flat[] {
    return Array.from({ length: n }, (_, i) => {
        const t = (2 * Math.PI * i) / n;
        return [centre[0] + r * Math.cos(t), centre[1] + r * Math.sin(t)];
    });
}

/** A smooth closed curve through `pts` (Catmull–Rom), `n` points per span. */
export function closedSmooth(pts: Flat[], n = 4): Flat[] {
    const out: Flat[] = [];
    const k = pts.length;
    for (let i = 0; i < k; i++) {
        const [p0, p1, p2, p3] = [pts[(i - 1 + k) % k], pts[i], pts[(i + 1) % k], pts[(i + 2) % k]];
        for (let j = 0; j < n; j++) {
            const t = j / n;
            const t2 = t * t;
            const t3 = t2 * t;
            const w = [-t3 + 2 * t2 - t, 3 * t3 - 5 * t2 + 2, -3 * t3 + 4 * t2 + t, t3 - t2];
            out.push([
                (w[0] * p0[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * p3[0]) / 2,
                (w[0] * p0[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * p3[1]) / 2,
            ]);
        }
    }
    return out;
}

/** Twice a loop's signed area: positive when it runs anticlockwise. */
const area2 = (loop: Flat[]) =>
    loop.reduce((s, [x, y], i) => {
        const [x2, y2] = loop[(i + 1) % loop.length];
        return s + x * y2 - x2 * y;
    }, 0);
const anticlockwise = (loop: Flat[]) => (area2(loop) < 0 ? [...loop].reverse() : loop);

/**
 * A flat plate `thick` thick, centred on its frame's plane: its two faces cut to `outline` with `holes` through them,
 * and its edges round the outline and the holes, which add only fine detail.
 */
export function plate(
    f: Frame,
    outline: Flat[],
    holes: Flat[][],
    thick: number,
    color: string,
): Face[] {
    const out = anticlockwise(outline);
    const ins = holes.map(anticlockwise);
    const side = (c: number) => (p: Flat) => at(f, p, c);
    const face = (c: number, normal: Vector3, flip: boolean): Face => {
        const order = (l: Flat[]) => (flip ? [...l].reverse() : l);
        return {
            kind: "face",
            points: order(out).map(side(c)),
            holes: ins.map((h) => order(h).map(side(c))),
            material: "steel",
            normal,
            color,
        };
    };
    const faces: Face[] = [face(thick / 2, f.n, false), face(-thick / 2, f.n.neg(), true)];
    // The edges: outward round the outline, into each hole round it.
    const edges = (loop: Flat[], outward: boolean) =>
        loop.forEach((p, i) => {
            const q = loop[(i + 1) % loop.length];
            const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
            const len = Math.hypot(dx, dy);
            const [nx, ny] = outward ? [dy / len, -dx / len] : [-dy / len, dx / len];
            faces.push({
                kind: "face",
                points: [
                    at(f, p, thick / 2),
                    at(f, q, thick / 2),
                    at(f, q, -thick / 2),
                    at(f, p, -thick / 2),
                ],
                material: "steel",
                normal: f.u.scale(nx).add(f.v.scale(ny)),
                color,
                fine: thick,
            } as Face);
        });
    edges(out, true);
    for (const h of ins) edges(h, false);
    return faces;
}

/**
 * A grooved sheave turning on `axle` at `centre`: its hub `width` wide, the groove's floor `groove` out from the axle
 * and its flanges `rim` out.
 */
export function sheave(
    centre: Vector3,
    axle: Vector3,
    groove: number,
    rim: number,
    width: number,
    color: string,
): Piece[] {
    const a = axle.unit();
    const half = width / 2;
    const flange = 0.0025;
    return [
        ...part(centre.sub(a.scale(half)), centre.add(a.scale(half)), groove, color),
        ...[-1, 1].flatMap((s) =>
            part(
                centre.add(a.scale(s * (half - flange))),
                centre.add(a.scale(s * half)),
                rim,
                color,
                rim - groove,
            ),
        ),
    ];
}

/** A bolt through `at` along `through`, `length` long between its head and nut. */
export function bolt(
    at: Vector3,
    through: Vector3,
    length: number,
    r: number,
    color: string,
): Piece[] {
    const d = through.unit();
    const half = length / 2;
    const head = 2 * r;
    return [
        ...part(at.sub(d.scale(half + 0.004)), at.add(d.scale(half + 0.004)), r, color, r),
        ...[-1, 1].flatMap((s) =>
            part(at.add(d.scale(s * half)), at.add(d.scale(s * (half + 0.004))), head, color, head),
        ),
    ];
}

/**
 * The CT triple-lock carabiners' centrelines, traced from photos (pixels, the photo's gate on the left), each round
 * from its spine, over the top bend to the gate's nose, down the gate to its hinge, and round the bottom bend back to
 * the spine. What it hangs from sits at `top` and what hangs from it at `bottom`, square below; `gate` is the gate's
 * line from its nose to its hinge, `sleeve` the stretch of it the locking sleeve covers, and `knurl` its gripped
 * middle. The D is wide at the top and narrow at the bottom, beside its straight spine, which loads sit against; the
 * oval is the same round both ends, loads sitting in the middle of each. `stretches` names its parts by the traced
 * points they run between (counting on round past the last to the first): its top and bottom bends, its gate, its spine.
 */
const CARABINER_SHAPES: Record<
    "d" | "oval",
    {
        loop: Flat[];
        top: Flat;
        bottom: Flat;
        width: number;
        gate: Flat[];
        sleeve: [number, number];
        knurl: [number, number];
        stretches: Record<CarabinerStretch, [number, number]>;
    }
> = {
    d: {
        loop: [
            [405, 420],
            [405, 330],
            [405, 240],
            [405, 150],
            [402, 80],
            [392, 44],
            [370, 26],
            [335, 28],
            [295, 42],
            [255, 60],
            [215, 84],
            [180, 112],
            [158, 145],
            [152, 175],
            [158, 240],
            [168, 310],
            [180, 380],
            [196, 440],
            [222, 478],
            [262, 500],
            [310, 507],
            [352, 500],
            [385, 478],
            [401, 452],
        ] as Flat[],
        top: [370, 26] as Flat,
        bottom: [370, 497] as Flat,
        width: 253,
        gate: [
            [152, 175],
            [196, 440],
        ] as Flat[],
        sleeve: [195, 385],
        knurl: [255, 335],
        stretches: { top: [4, 9], bottom: [17, 24], gate: [13, 17], spine: [0, 4] },
    },
    oval: {
        loop: [
            [395, 300],
            [395, 135],
            [387, 93],
            [362, 57],
            [326, 32],
            [284, 24],
            [242, 32],
            [206, 57],
            [181, 93],
            [173, 135],
            [173, 260],
            [173, 330],
            [173, 417],
            [181, 459],
            [206, 495],
            [242, 520],
            [284, 528],
            [326, 520],
            [362, 495],
            [387, 459],
            [395, 417],
        ] as Flat[],
        top: [284, 24] as Flat,
        bottom: [284, 528] as Flat,
        width: 222,
        gate: [
            [173, 160],
            [173, 420],
        ] as Flat[],
        sleeve: [195, 392],
        knurl: [268, 365],
        stretches: { top: [2, 8], bottom: [13, 19], gate: [9, 12], spine: [20, 22] },
    },
};

/**
 * A carabiner's named stretches: its top bend, its bottom bend, its gate and its spine. On the D, the top is its wide end
 * (a tight corner beside the spine, sloping across to the gate's nose) and the bottom its narrow end (one round bend);
 * on the oval, the two ends are alike.
 */
export type CarabinerStretch = "top" | "bottom" | "gate" | "spine";

/**
 * What a carabiner's connections are checked against: its bar's centreline (`loop`, closed, its last point its first),
 * the bar's radius, where the loads sit at its top and bottom ends, and its named stretches, each as the range of
 * `loop`'s indices it covers (`from` to `to`, counting on round past the end to the start).
 */
export type CarabinerFeatures = {
    loop: Vector3[];
    r: number;
    top: Vector3;
    bottom: Vector3;
    stretches: Record<CarabinerStretch, { from: number; to: number }>;
};

/** How many points the carabiner's loop has between each pair of its traced points. */
const CARABINER_STEPS = 6;

/** A closed smooth loop through `pts` (Catmull–Rom), `n` points between each pair. */
function closedLoop(pts: Flat[], n: number): Flat[] {
    const out: Flat[] = [];
    const at = (i: number) => pts[(i + pts.length) % pts.length];
    for (let i = 0; i < pts.length; i++) {
        const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
        for (let k = 0; k < n; k++) {
            const t = k / n;
            const [t2, t3] = [t * t, t * t * t];
            const c = (j: 0 | 1) =>
                0.5 *
                (2 * p1[j] +
                    (p2[j] - p0[j]) * t +
                    (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 +
                    (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3);
            out.push([c(0), c(1)]);
        }
    }
    return [...out, out[0]];
}

/**
 * A triple-lock carabiner, the CT D-shape or oval (`shape`), hanging from `top` (the middle of its bar where it hangs)
 * towards `down`, `length` on to the middle of its bar where things hang from it, its loop in the plane of `down` and
 * `across`: `width` across (by default in proportion to the photo), its gate on the `across` side behind its locking
 * sleeve (`sleeve`'s colour), its bar `r` thick. By default its loads sit where the photo's carabiner takes them, by its
 * spine; `settled`, it's hung between two loads and nothing else, so it turns until each sits in the bottom of its bend
 * and the two are in line along the pull; `centred`, it hangs as it's drawn but from the middle of its bottom bend, as on
 * a knot's loop with nothing on its other end.
 */
export function carabiner(...args: Parameters<typeof carabinerWith>): Piece[] {
    return carabinerWith(...args).pieces;
}

/** A carabiner as `carabiner` draws it, with its features for checking its connections. */
export function carabinerWith(
    top: Vector3,
    down: Vector3,
    across: Vector3,
    color: string,
    length = 0.11,
    {
        shape = "d",
        width,
        r = 0.005,
        sleeve = "var(--carabiner-sleeve)",
        through,
        settled = false,
        centred = false,
    }: {
        shape?: keyof typeof CARABINER_SHAPES;
        width?: number;
        r?: number;
        sleeve?: string;
        through?: number;
        settled?: boolean;
        centred?: boolean;
    } = {},
): { pieces: Piece[]; features: CarabinerFeatures } {
    const d = down.unit();
    const a = across.unit();
    const S = CARABINER_SHAPES[shape];
    const loop = closedLoop(S.loop, CARABINER_STEPS);
    // Metres per pixel across: `width` across, by default in proportion to the photo.
    const span = S.bottom[1] - S.top[1];
    let ku = (width ?? (length * S.width) / span) / S.width;
    // Where it hangs: by default where the photo's carabiner takes its loads. Passed `through` two plates that far
    // apart (where its bar bears on their holes' edges), it settles in contact with both: its bend level across them,
    // turned in its own plane until what hangs from it, sitting in the lowest point of its bottom bend, is straight
    // below the middle of the two.
    let pts = loop;
    let turn = (p: Flat): Flat => p;
    let [hangX, topY, bottomY] = [S.top[0], S.top[1], S.bottom[1]];
    if (through !== undefined) {
        const want = through / ku;
        const [cx, cy] = [(S.top[0] + S.bottom[0]) / 2, (S.top[1] + S.bottom[1]) / 2];
        const settle = (angle: number) => {
            const [c, sn] = [Math.cos(angle), Math.sin(angle)];
            const spin = ([x, y]: Flat): Flat => [
                cx + (x - cx) * c - (y - cy) * sn,
                cy + (x - cx) * sn + (y - cy) * c,
            ];
            const turned = loop.map(spin);
            const segments = turned.slice(1).map((q, i) => [turned[i], q] as const);
            // The bend's width at height `y`, over the top half.
            const across = (y: number) =>
                segments
                    .filter(([p, q]) => p[1] < cy && (p[1] - y) * (q[1] - y) <= 0 && p[1] !== q[1])
                    .map(([p, q]) => p[0] + ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]));
            let chord: { x: number; y: number } | undefined;
            for (let y = Math.min(...turned.map((q) => q[1])) + 0.25; y < cy; y += 0.25) {
                const xs = across(y);
                if (xs.length >= 2 && Math.max(...xs) - Math.min(...xs) >= want) {
                    chord = { x: (Math.max(...xs) + Math.min(...xs)) / 2, y };
                    break;
                }
            }
            const lowest = turned.reduce((m, q) => (q[1] > m[1] ? q : m));
            return { turned, spin, chord, lowest };
        };
        let best: ReturnType<typeof settle> | undefined;
        for (let deg = -40; deg <= 40; deg += 0.25) {
            const tried = settle((deg * Math.PI) / 180);
            if (!tried.chord) continue;
            const miss = Math.abs(tried.lowest[0] - tried.chord.x);
            if (!best?.chord || miss < Math.abs(best.lowest[0] - best.chord.x)) best = tried;
        }
        if (best?.chord) {
            pts = best.turned;
            turn = best.spin;
            [hangX, topY, bottomY] = [best.chord.x, best.chord.y, best.lowest[1]];
        }
    } else if (settled) {
        // Turned about the middle until its highest and lowest points (where each load sits) are one above the other.
        const [cx, cy] = [(S.top[0] + S.bottom[0]) / 2, (S.top[1] + S.bottom[1]) / 2];
        const spinBy = (angle: number) => {
            const [c, sn] = [Math.cos(angle), Math.sin(angle)];
            return ([x, y]: Flat): Flat => [
                cx + (x - cx) * c - (y - cy) * sn,
                cy + (x - cx) * sn + (y - cy) * c,
            ];
        };
        let angle = 0;
        let ends = { high: loop[0], low: loop[0] };
        for (let i = 0; i < 20; i++) {
            const turned = loop.map(spinBy(angle));
            const high = turned.reduce((m, q) => (q[1] < m[1] ? q : m));
            const low = turned.reduce((m, q) => (q[1] > m[1] ? q : m));
            ends = { high, low };
            const step = Math.atan2(low[0] - high[0], low[1] - high[1]);
            if (Math.abs(step) < 1e-6) break;
            angle += step;
        }
        turn = spinBy(angle);
        pts = loop.map(turn);
        [hangX, topY, bottomY] = [ends.high[0], ends.high[1], ends.low[1]];
    } else if (centred) {
        // Hanging as it's drawn, from the middle of its bottom bend (its lowest point) rather than where the photo's
        // took its loads, which is off to the spine's side: as a loop clipped through it with nothing pulling it sits.
        const low = loop.reduce((m, q) => (q[1] > m[1] ? q : m));
        [hangX, bottomY] = [low[0], low[1]];
    }
    const kv = length / (bottomY - topY);
    // Settled, it keeps its shape: `length` is between where its loads sit, and it's that much in proportion across.
    if (settled && width === undefined) ku = kv;
    const at = ([x, y]: Flat) => top.add(a.scale((hangX - x) * ku)).add(d.scale((y - topY) * kv));
    const body: Piece = {
        kind: "strand",
        points: pts.map(at),
        r,
        material: "steel",
        color,
        capA: false,
        capB: false,
        toScale: true,
    };
    // The gate's line, where the sleeve rides on it.
    const gate = (y: number) => {
        const [[x0, y0], [x1, y1]] = S.gate;
        return at(turn([x0 + ((x1 - x0) * (y - y0)) / (y1 - y0), y]));
    };
    const stretch = ([from, to]: [number, number]) => ({
        from: from * CARABINER_STEPS,
        to: to * CARABINER_STEPS,
    });
    return {
        pieces: [
            body,
            ...part(gate(S.sleeve[0]), gate(S.sleeve[1]), r * 1.55, sleeve, r),
            ...part(gate(S.knurl[0]), gate(S.knurl[1]), r * 1.75, sleeve, r),
        ],
        features: {
            loop: body.points,
            r,
            top: at([hangX, topY]),
            bottom: at([hangX, bottomY]),
            stretches: {
                top: stretch(S.stretches.top),
                bottom: stretch(S.stretches.bottom),
                gate: stretch(S.stretches.gate),
                spine: stretch(S.stretches.spine),
            },
        },
    };
}

/**
 * A forged lifting eye bolt, M12 to DIN 580 (metres): the eye's radius to its bar's middle and the bar's radius (54 mm
 * outside, 30 mm inside), how far the eye's middle is from the collar's face against the steel (53 mm to the eye's top),
 * the collar (30 mm across, its top flowing into the eye's bottom), and the thread.
 */
export const EYE_BOLT = {
    r: 0.021,
    bar: 0.006,
    centre: 0.026,
    collar: { r: 0.015, h: 0.01 },
    thread: { r: 0.006, length: 0.021 },
};
export type EyeBoltSize = typeof EYE_BOLT;

/** An M10 eye bolt to DIN 580: 45 mm outside its eye and 25 mm inside, 45 mm to the eye's top, a 25 mm collar. */
export const EYE_BOLT_M10: EyeBoltSize = {
    r: 0.0175,
    bar: 0.005,
    centre: 0.0225,
    collar: { r: 0.0125, h: 0.008 },
    thread: { r: 0.005, length: 0.018 },
};

/**
 * An M16 eye bolt to DIN 580, as Appendix E's platform stays hang from: 63 mm outside its eye and 35 mm inside, 62 mm
 * to the eye's top, a 35 mm collar.
 */
export const EYE_BOLT_M16: EyeBoltSize = {
    r: 0.0245,
    bar: 0.007,
    centre: 0.0305,
    collar: { r: 0.0175, h: 0.012 },
    thread: { r: 0.008, length: 0.027 },
};

/**
 * The eye of a bolt standing out towards `out`, turned into the plane of `out` and `toward`: those two directions in it,
 * square to each other (`o` out, `w` across), and the way through its hole (`m`).
 */
export function eyeFrame(out: Vector3, toward: Vector3): { o: Vector3; w: Vector3; m: Vector3 } {
    const o = out.unit();
    const side = toward.sub(o.scale(toward.dot(o)));
    // Pulled straight along it, the eye's turned any way at all.
    const any = Math.abs(o.z) < 0.9 ? vec3(0, 0, 1) : vec3(0, 1, 0);
    const w = side.len() > 1e-6 ? side.unit() : o.cross(any).unit();
    return { o, w, m: o.cross(w) };
}

/**
 * An eye bolt screwed into steel at `base` (the collar's face against it), standing out towards `out`, its eye turned
 * into the plane of `out` and `toward`. Returns its pieces and the eye's middle.
 */
export function eyeBolt(
    base: Vector3,
    out: Vector3,
    toward: Vector3,
    color: string,
    size: EyeBoltSize = EYE_BOLT,
): { pieces: Piece[]; eye: Vector3 } {
    const { o, w } = eyeFrame(out, toward);
    const { r, bar, collar, thread } = size;
    const eye = base.add(o.scale(size.centre));
    const points = Array.from({ length: 25 }, (_, i) => {
        const t = (2 * Math.PI * i) / 24;
        return eye.add(o.scale(r * Math.cos(t))).add(w.scale(r * Math.sin(t)));
    });
    const loop: Piece = {
        kind: "strand",
        points,
        r: bar,
        material: "steel",
        color,
        capA: false,
        capB: false,
        toScale: true,
    };
    return {
        pieces: [
            loop,
            // The collar, and its neck narrowing into the eye.
            ...part(base, base.add(o.scale(collar.h)), collar.r, color, collar.h),
            ...part(
                base.add(o.scale(collar.h)),
                base.add(o.scale(collar.h + 0.004)),
                collar.r * 0.73,
                color,
                0.004,
            ),
            ...part(base, base.sub(o.scale(thread.length)), thread.r, color),
        ],
        eye,
    };
}

/**
 * A rope tied straight round a bar, standing in for its knot until the knots are drawn: a turn round the bar at `at`
 * (on its middle line), which runs along `axis` and is `barR` thick, on the side the rope leaves towards `toward`.
 * Returns the turn's points and where the rope goes on from.
 */
export function tiedRound(
    at: Vector3,
    axis: Vector3,
    barR: number,
    toward: Vector3,
    ropeR: number,
): { turn: Vector3[]; from: Vector3 } {
    const a = axis.unit();
    const off = toward.sub(at);
    const w = off.sub(a.scale(off.dot(a))).unit();
    const n = a.cross(w);
    const around = barR + ropeR;
    const turn = Array.from({ length: 13 }, (_, i) => {
        const t = (2 * Math.PI * i) / 12;
        return at.add(w.scale(around * Math.cos(t))).add(n.scale(around * Math.sin(t)));
    });
    return { turn, from: at.add(w.scale(around)) };
}

/** A carabiner's wire thickness (radius) and width, as `carabiner` draws it by default. */
export const CARABINER_R = 0.005;
export const CARABINER_WIDTH = 0.06;

/** The way a rope leaves a sheave: its direction away, and where it touches the sheave. */
export type Lead = { dir: Vector3; at: Vector3 };

/**
 * Where a rope round a sheave at `centre` touches it, leaving towards `dir`, when the sheave's load is pulled the other
 * way from `away`: on the side the rope wraps round, `r` from the centre (the groove's radius plus the rope's).
 */
function touch(centre: Vector3, dir: Vector3, away: Vector3, r: number): Vector3 {
    const d = dir.unit();
    const side = away.sub(d.scale(away.dot(d))).unit();
    return centre.add(side.scale(r));
}

/** Points round a sheave at `centre` from `a` to `b` (both `r` out), the short way round. */
export function wrap(centre: Vector3, a: Vector3, b: Vector3, n = 8): Vector3[] {
    const [pa, pb] = [a.sub(centre), b.sub(centre)];
    const r = pa.len();
    return Array.from({ length: n + 1 }, (_, i) => {
        const p = pa.lerp(pb, i / n);
        return centre.add(p.unit().scale(r));
    });
}

/**
 * A rescue pulley: a sheave between two side plates, pear-shaped round it with a hole at the top for its carabiner.
 * Its rope leaves towards `toA` and `toB` (directions); it hangs the opposite way from their pull, so its plates lie
 * in their plane. Returns the pieces, where its rope touches the sheave each way, and where its carabiner reaches.
 */
export function pulley({
    centre,
    toA,
    toB,
    ropeR,
    colors,
    axleIfStraight = vec3(0, 0, 1),
}: {
    centre: Vector3;
    toA: Vector3;
    toB: Vector3;
    ropeR: number;
    colors: { plates: string; sheave: string; steel: string; carabiner: string };
    axleIfStraight?: Vector3;
}): { pieces: Piece[]; a: Vector3; b: Vector3; hook: Vector3; up: Vector3; axle: Vector3 } {
    const [da, db] = [toA.unit(), toB.unit()];
    const pull = da.add(db);
    const crossed = da.cross(db);
    const axle = crossed.len() > 1e-6 ? crossed.unit() : axleIfStraight.unit();
    const up = pull.len() > 1e-6 ? pull.neg().unit() : axle.cross(da).unit();
    const across = up.cross(axle).unit();
    const groove = 0.02;
    const rim = 0.026;
    const R = groove + ropeR;
    const f: Frame = { o: centre, u: across, v: up, n: axle };
    // The side plates: round the sheave, narrowing up to the carabiner's hole.
    const top = 0.052;
    const pear = closedSmooth(
        [
            [0, -0.034],
            [0.026, -0.024],
            [0.034, 0],
            [0.028, 0.026],
            [0.014, top + 0.006],
            [0, top + 0.014],
            [-0.014, top + 0.006],
            [-0.028, 0.026],
            [-0.034, 0],
            [-0.026, -0.024],
        ],
        4,
    );
    const hole = circle([0, top], 0.007, 12);
    const pieces: Piece[] = [];
    for (const s of [-1, 1])
        pieces.push(
            ...plate(
                { ...f, o: centre.add(axle.scale(s * 0.011)) },
                pear,
                [hole],
                0.004,
                colors.plates,
            ),
        );
    pieces.push(...sheave(centre, axle, groove, rim, 0.014, colors.sheave));
    pieces.push(...bolt(centre, axle, 0.026, 0.004, colors.steel));
    // The carabiner through the hole, reaching up to what it's clipped to.
    const hole0 = at(f, [0, top]);
    const length = 0.1;
    const hook = hole0.add(up.scale(length - 0.004));
    pieces.push(
        ...carabiner(hook, up.neg(), axle, colors.carabiner, length, { shape: "oval", r: 0.0045 }),
    );
    return {
        pieces,
        a: touch(centre, da, up, R),
        b: touch(centre, db, up, R),
        hook,
        up,
        axle,
    };
}

/**
 * The ISC Zip Speed (RP075) trolley's measurements (metres), taken off a side-on photo scaled to its data sheet's 206 mm
 * by 111 mm plates: along the wire (u, its bumper end towards +u) and up from it (v), the wire at the origin, for 50 mm
 * wheels on 11 mm wire. A lobe at the −u end carries the tow hole, and the pin at the +u end holds the bumper.
 */
const ZIP = {
    outline: [
        [0.1046, 0.029],
        [0.0972, 0.0383],
        [0.0898, 0.0417],
        [0.0788, 0.0455],
        [0.0715, 0.0502],
        [0.0604, 0.0519],
        [0.0383, 0.0519],
        [0.02, 0.0497],
        [0.0016, 0.0468],
        [-0.0132, 0.0497],
        [-0.0315, 0.0523],
        [-0.0499, 0.0531],
        [-0.0647, 0.0519],
        [-0.072, 0.0485],
        [-0.0794, 0.0421],
        [-0.0904, 0.0379],
        [-0.0978, 0.0315],
        [-0.1001, 0.026],
        [-0.1001, 0.0226],
        [-0.0978, 0.0158],
        [-0.0886, 0.0091],
        [-0.0752, 0.0023],
        [-0.072, -0.0007],
        [-0.0683, -0.0053],
        [-0.0647, -0.013],
        [-0.061, -0.0231],
        [-0.0573, -0.0312],
        [-0.0499, -0.0418],
        [-0.0389, -0.0486],
        [-0.0205, -0.0553],
        [0.0016, -0.0579],
        [0.0236, -0.0545],
        [0.0383, -0.049],
        [0.0531, -0.0371],
        [0.0604, -0.024],
        [0.0641, -0.0147],
        [0.0715, -0.0036],
        [0.0825, 0.0036],
        [0.0935, 0.0069],
        [0.1009, 0.0112],
        [0.1055, 0.0192],
        [0.1059, 0.0226],
    ] as Flat[],
    /** The rider's hole: a rounded five-sided hole, its point up. */
    main: [
        [-0.0132, -0.0281],
        [-0.0137, -0.0249],
        [-0.0137, -0.0211],
        [-0.0117, -0.0179],
        [-0.0085, -0.0154],
        [-0.005, -0.0129],
        [0, -0.0116],
        [0.005, -0.0129],
        [0.0085, -0.0154],
        [0.0117, -0.0179],
        [0.0132, -0.0215],
        [0.0132, -0.0247],
        [0.0132, -0.0281],
        [0.0123, -0.0313],
        [0.0111, -0.0343],
        [0.0095, -0.0374],
        [0.0072, -0.0406],
        [0.0039, -0.0436],
        [0, -0.0444],
        [-0.0039, -0.0436],
        [-0.0072, -0.0406],
        [-0.0095, -0.0374],
        [-0.0111, -0.0343],
        [-0.0124, -0.031],
    ] as Flat[],
    mainTop: [0, -0.0116] as Flat,
    tow: { at: [-0.083, 0.025] as Flat, r: 0.0078 },
    /** The holes below either side of the rider's: the bumper end's a little bigger. */
    lower: [
        { at: [0.0308, -0.0278] as Flat, r: 0.0086 },
        { at: [-0.0319, -0.0262] as Flat, r: 0.0075 },
    ],
    small: { at: [0.001, 0.018] as Flat, r: 0.003 },
    axles: [0.0372, -0.0372],
    /** The middle axle, a redundancy should a wheel's fail, above the wire. */
    middle: [0.001, 0.0347] as Flat,
    pin: [0.0874, 0.0251] as Flat,
    /** The wheels: 50 mm across, a deep groove. */
    groove: 0.0185,
    rim: 0.025,
    /** The plates: 4 mm thick, 31 mm across both. */
    plate: 0.004,
    across: 0.031,
};

/**
 * A curved slot round `centre`, between radii `r0` and `r1`, `half` radians either side of angle `mid`, its ends
 * rounded.
 */
function slot(centre: Flat, r0: number, r1: number, mid: number, half: number, n = 8): Flat[] {
    const around = (r: number, t: number): Flat => [
        centre[0] + r * Math.cos(t),
        centre[1] + r * Math.sin(t),
    ];
    const arc = (r: number, from: number, to: number) =>
        Array.from({ length: n + 1 }, (_, i) => around(r, from + ((to - from) * i) / n));
    // A half circle round each end, from one side of the slot to the other.
    const cap = (t: number, from: number) => {
        const [c, w] = [around((r0 + r1) / 2, t), (r1 - r0) / 2];
        return Array.from({ length: 5 }, (_, i): Flat => {
            const a = from + (Math.PI * (i + 1)) / 6;
            return [c[0] + w * Math.cos(a), c[1] + w * Math.sin(a)];
        });
    };
    return [
        ...arc(r1, mid - half, mid + half),
        ...cap(mid + half, mid + half),
        ...arc(r0, mid + half, mid - half),
        ...cap(mid - half, mid - half + Math.PI),
    ];
}

/**
 * A twin-sheave zip line trolley riding on a wire at `wire`, an ISC Zip Speed (RP075): two wheels on the wire between
 * alloy side plates, each showing through two curved windows, and a redundancy axle between them; a black bumper on the
 * pin at one end (towards `bumper`, along the wire), between the plates; a lobe with a tow hole at the other end; and
 * three holes below, the middle one five-sided for the rider's carabiner. `across` is through the plates.
 */
export function zipTrolley(
    wire: Vector3,
    bumper: Vector3,
    across: Vector3,
    wireR: number,
    colors: { plates: string; sheave: string; steel: string; bumper: string },
): {
    pieces: Piece[];
    /** The tow hole's middle, its radius, and the top of each hole below: the middle one, the bumper end's, the other. */
    tow: Vector3;
    towR: number;
    main: Vector3;
    bumperSide: Vector3;
    towSide: Vector3;
    frame: Frame;
    /** The gap between its plates' inner faces: a carabiner hanging from its holes' tops bears on their edges there. */
    gap: number;
} {
    const n = across.unit();
    const u = bumper.unit();
    const up = n.cross(u).unit();
    const f: Frame = { o: wire, u, v: up.y < 0 ? up.neg() : up, n };
    // The wheels sit on the wire, their groove's floor on it.
    const axleV = ZIP.groove + wireR;
    const axles: Flat[] = ZIP.axles.map((a) => [a, axleV]);
    const tilt = 0.44;
    const holes = [
        circle(ZIP.tow.at, ZIP.tow.r, 14),
        ...ZIP.lower.map((h) => circle(h.at, h.r, 14)),
        ZIP.main,
        circle(ZIP.small.at, ZIP.small.r, 8),
        // The wheels' windows, either side of each axle, tilted down.
        ...axles.flatMap((c) => [
            slot(c, 0.016, 0.025, -tilt, 0.55),
            slot(c, 0.016, 0.025, Math.PI + tilt, 0.55),
        ]),
    ];
    const pieces: Piece[] = [];
    const side = (ZIP.across - ZIP.plate) / 2;
    const gap = ZIP.across - 2 * ZIP.plate;
    for (const s of [-1, 1])
        pieces.push(
            ...plate(
                { ...f, o: at(f, [0, 0], s * side) },
                closedSmooth(ZIP.outline, 3),
                holes,
                ZIP.plate,
                colors.plates,
            ),
        );
    const through = ZIP.across + 0.002;
    for (const c of axles) {
        pieces.push(...sheave(at(f, c), n, ZIP.groove, ZIP.rim, gap - 0.003, colors.sheave));
        pieces.push(...bolt(at(f, c), n, through, 0.006, colors.steel));
    }
    // The middle axle, with its collar coloured for the wire it suits: black for 13 mm.
    pieces.push(...bolt(at(f, ZIP.middle), n, through, 0.005, colors.steel));
    pieces.push(
        ...part(at(f, ZIP.middle, -gap / 2), at(f, ZIP.middle, gap / 2), 0.0065, colors.bumper),
    );
    // The bumper: a block between the plates, on the pin, from just above the wire, its end square and standing a
    // little past the plates' ends, where it meets the brake blocks.
    pieces.push(...bolt(at(f, ZIP.pin), n, through, 0.005, colors.steel));
    const nose = 0.11;
    const [b0, b1] = [wireR + 0.002, 0.046];
    const bumperOutline: Flat[] = [
        [0.066, b0],
        [nose, b0],
        [nose, b1],
        [0.066, b1],
    ];
    pieces.push(...plate(f, bumperOutline, [circle(ZIP.pin, 0.005, 10)], gap, colors.bumper));
    return {
        pieces,
        tow: at(f, ZIP.tow.at),
        towR: ZIP.tow.r,
        main: at(f, ZIP.mainTop),
        bumperSide: at(f, [ZIP.lower[0].at[0], ZIP.lower[0].at[1] + ZIP.lower[0].r]),
        towSide: at(f, [ZIP.lower[1].at[0], ZIP.lower[1].at[1] + ZIP.lower[1].r]),
        frame: f,
        gap: ZIP.across - 2 * ZIP.plate,
    };
}

/**
 * A Petzl GRIGRI+ (an assisted-braking belay device), measured in pixels off Petzl's square-on product photo, its
 * carabiner hole at the left and the handle along the top, and scaled to about 115 mm long (Petzl doesn't give its
 * size; that's from a photo of one in use, about eleven 10 mm ropes long).
 */
// prettier-ignore
const GRIGRI_PX = {
    scale: 0.115 / 520,
    hole: { at: [95, 340] as Flat, r: 30 },
    /** The coloured side plate, the one that stays put. */
    fixed: [
        [30, 283],
        [40, 255],
        [50, 234],
        [60, 220],
        [70, 205],
        [80, 193],
        [90, 177],
        [100, 167],
        [110, 159],
        [120, 156],
        [150, 162],
        [200, 169],
        [250, 177],
        [300, 184],
        [330, 189],
        [350, 195],
        [370, 202],
        [390, 210],
        [410, 219],
        [430, 230],
        [450, 244],
        [470, 258],
        [490, 274],
        [500, 287],
        [510, 302],
        [515, 322],
        [510, 341],
        [500, 353],
        [480, 366],
        [460, 379],
        [440, 390],
        [420, 400],
        [400, 412],
        [380, 423],
        [360, 431],
        [340, 438],
        [320, 443],
        [300, 447],
        [250, 448],
        [200, 449],
        [180, 448],
        [160, 444],
        [140, 441],
        [120, 436],
        [100, 431],
        [80, 424],
        [60, 415],
        [40, 397],
        [30, 386],
        [24, 335],
    ] as Flat[],
    /** The side plate that swings open to load the rope: much the fixed one's shape, with a tail past the far end. */
    moving: [
        [30, 283], [40, 255], [50, 234], [60, 220], [70, 205], [80, 193], [90, 177], [100, 167], [110, 159],
        [120, 156], [150, 162], [200, 169], [250, 177], [300, 184], [350, 195], [400, 212], [450, 240], [490, 262],
        [520, 272], [534, 295], [530, 322], [515, 335], [500, 355], [460, 380], [400, 413], [340, 439], [300, 449],
        [200, 450], [140, 445], [100, 435], [60, 420], [40, 403], [30, 389], [24, 335],
    ] as Flat[],
    /**
     * A steel piece standing up from the moving plate at the hole's end, above the other plates (the grey lobe in the
     * front photo): the rope runs between it and the cam.
     */
    ramp: [
        [45, 205], [50, 159], [60, 142], [70, 130], [80, 122], [90, 115], [100, 110], [120, 105], [140, 106],
        [158, 116], [170, 140], [172, 200], [165, 250], [140, 265], [100, 252], [60, 228],
    ] as Flat[],
    /**
     * The cam: a big rounded block of steel in the middle, between the plates, turning on the central pin near its
     * lower right (as in a photo of one open). The rope wraps round it.
     */
    cam: [
        [240, 170], [325, 170], [348, 185], [352, 210], [352, 320], [340, 342], [318, 348], [240, 348],
        [218, 335], [212, 310], [212, 200], [220, 180],
    ] as Flat[],
    /**
     * The handle, on the back, outside the moving plate (from the back photo, turned over): a big rounded root on its
     * own axle just above the carabiner hole, and an arm reaching along the top to the far end.
     */
    handleAxle: { at: [125, 215] as Flat, r: 88, cap: 26 },
    handleArm: {
        top: [[530, 292], [500, 253], [450, 212], [400, 179], [350, 152], [300, 134], [250, 125], [200, 117]],
        bottom: [[240, 172], [300, 174], [350, 190], [400, 216], [450, 250], [490, 286], [512, 300], [526, 304]],
    } as { top: Flat[]; bottom: Flat[] },
    /** The cam's axle, and the pin at the far end holding the plates together. */
    pivot: [290, 290] as Flat,
    pin: [465, 320] as Flat,
    /**
     * The rope's way through: in at the top between the steel piece and the cam, down the cam's side by the hole, under
     * it, and up its far side and out.
     */
    rope: [
        [192, 100], [192, 180], [192, 260], [200, 320], [228, 365], [285, 377], [340, 368], [375, 335], [380, 270],
        [382, 215], [395, 180], [420, 160],
    ] as Flat[],
};

/**
 * A GRIGRI+ hanging from its carabiner hole at `hole`, the rope's loaded strand leaving its top towards `toLoad`, its
 * plates square to `across` (its coloured side that way). Returns its pieces, the rope's way through it (in at the
 * top, out at the far end), the direction the brake strand leaves, and the brake strand hanging `drop` below the way
 * out, curving over from that direction.
 */
export function grigri(
    hole: Vector3,
    toLoad: Vector3,
    across: Vector3,
    colors: { body: string; dark: string; handle: string; steel: string },
): {
    pieces: Piece[];
    rope: Vector3[];
    brakeOut: Vector3;
    holeR: number;
    /**
     * How far across it is over its two plates' outer faces: a carabiner pulling down through its hole bears on the
     * hole's bottom edges there.
     */
    width: number;
    brake: (drop: number) => Vector3[];
} {
    const G = GRIGRI_PX;
    const px = ([x, y]: Flat): Flat => [(x - G.hole.at[0]) * G.scale, (G.hole.at[1] - y) * G.scale];
    const n = across.unit();
    const d = toLoad.sub(n.scale(toLoad.dot(n))).unit();
    // Turned so the rope's way in at the top is straight up the load from the hole.
    const [eu, ev] = px(G.rope[0]);
    const t = Math.atan2(ev, eu);
    // The scene's axes are left-handed (x east, y up, z north), so seen from its coloured side (from `across`), `u`
    // runs to the right when `v` is `u` × `n`.
    const u = d.scale(Math.cos(t)).sub(d.cross(n).scale(Math.sin(t)));
    const f: Frame = { o: hole, u, v: u.cross(n), n };
    // The handle's outline: along the arm's top, round its root, and back along the arm's underside.
    const A = G.handleAxle;
    const root = Array.from({ length: 23 }, (_, i): Flat => {
        const a = ((70 + (260 * i) / 22) * Math.PI) / 180;
        return [A.at[0] + A.r * Math.cos(a), A.at[1] - A.r * Math.sin(a)];
    });
    const handle = [...G.handleArm.top, ...root, ...G.handleArm.bottom];
    const holeR = G.hole.r * G.scale;
    const holes = [circle([0, 0], holeR, 16)];
    // The plates either side of the rope's channel, and the handle outside the moving one.
    const gap = 0.014;
    const plateThick = 0.004;
    const side = gap / 2 + plateThick / 2;
    const pieces: Piece[] = [
        ...plate({ ...f, o: at(f, [0, 0], side) }, G.fixed.map(px), holes, plateThick, colors.body),
        ...plate(
            { ...f, o: at(f, [0, 0], -side) },
            G.moving.map(px),
            holes,
            plateThick,
            colors.dark,
        ),
        ...plate(
            { ...f, o: at(f, [0, 0], -side - plateThick / 2 - 0.004) },
            handle.map(px),
            [],
            0.006,
            colors.handle,
        ),
        // The handle's axle, its cap showing on the back only.
        ...part(
            at(f, px(A.at), -side),
            at(f, px(A.at), -side - plateThick / 2 - 0.008),
            A.cap * G.scale,
            colors.steel,
        ),
        // The cam between the plates on its axle, and the axle and the far pin through them.
        ...plate(f, G.cam.map(px), [], gap - 0.002, colors.steel),
        ...plate({ ...f, o: at(f, [0, 0], -gap / 4) }, G.ramp.map(px), [], gap / 2, colors.steel),
        ...bolt(at(f, px(G.pivot)), n, gap + 2 * plateThick, 0.0035, colors.steel),
        ...bolt(at(f, px(G.pin)), n, gap + 2 * plateThick, 0.003, colors.steel),
    ];
    const rope = G.rope.map((p) => at(f, px(p)));
    const out = rope.at(-1)!;
    const brakeOut = out.sub(rope.at(-2)!).unit();
    const brake = (drop: number) => {
        // Over a curve (a cubic Bézier) from the way out, out past the device's far end, to hanging straight down.
        const down = vec3(0, -1, 0);
        const level = vec3(brakeOut.x, 0, brakeOut.z).unit();
        const p1 = out.add(brakeOut.scale(0.04));
        const p2 = out.add(level.scale(0.06));
        const p3 = p2.add(down.scale(0.1));
        const curve = Array.from({ length: 10 }, (_, i) => {
            const t = (i + 1) / 10;
            const r = 1 - t;
            return out
                .scale(r ** 3)
                .add(p1.scale(3 * r * r * t))
                .add(p2.scale(3 * r * t * t))
                .add(p3.scale(t ** 3));
        });
        return [...curve, p3.add(down.scale(Math.max(drop - 0.1, 0.01)))];
    };
    return { pieces, rope, brakeOut, holeR, width: gap + 2 * plateThick, brake };
}

/** A hexagon nut on `axis` at `at` (the middle of its thickness): `across` its flats and `thick` thick. */
export function nut(
    at: Vector3,
    axis: Vector3,
    across: number,
    thick: number,
    color: string,
): Face[] {
    const n = axis.unit();
    const any = Math.abs(n.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0);
    const u = any.sub(n.scale(any.dot(n))).unit();
    const corner = across / Math.sqrt(3);
    return plate({ o: at, u, v: u.cross(n), n }, circle([0, 0], corner, 6), [], thick, color);
}

/**
 * The team's stop block (metres), from their drawing and a photo of one: two nylon halves `half` across, `long` along
 * the wire and `high`, split down the middle, the wire through a hole on the split halfway up. Four 10 mm brass bolts
 * stand through it, one in each half `bolt.in` from the split at each end `bolt.end` in from it, their heads and nuts
 * sunk flush in the top and bottom. Two eye bolts go across through both halves `eye.end` in from either end, one
 * `eye.high` up and the other as far down, their eyes lying flat and their nuts on the far side. The eyes are smaller
 * than an M10's to DIN 580, about 37 mm outside and 22 mm inside in the photo (`eye.size`).
 */
export const STOP_BLOCK = {
    half: 0.05,
    long: 0.1,
    high: 0.1,
    gap: 0.001,
    bolt: { in: 0.012, end: 0.016 },
    eye: {
        end: 0.025,
        high: 0.025,
        size: { ...EYE_BOLT_M10, r: 0.0147, bar: 0.0038, centre: 0.02 } as EyeBoltSize,
    },
    nut: { across: 0.017, thick: 0.008 },
};

/**
 * A stop block on the wire at `at`, its length along `along` and its top towards `up`. The high eye bolt's eye is on
 * the `inner` side, at the end towards `along`'s back (uphill, where the trolley meets the block); the low one's on the
 * other side at the other end. Returns its pieces and the two eyes' middles.
 */
export function stopBlock(
    at: Vector3,
    along: Vector3,
    up: Vector3,
    inner: Vector3,
    wireR: number,
    colors: { body: string; steel: string; brass: string },
): { pieces: Piece[]; inner: Vector3; outer: Vector3 } {
    const { half, long, high, gap, bolt: b, eye, nut: nt } = STOP_BLOCK;
    const d = along.unit();
    const vUp = up.sub(d.scale(up.dot(d))).unit();
    // Across, towards the inner side.
    const x = inner
        .sub(d.scale(inner.dot(d)))
        .sub(vUp.scale(inner.dot(vUp)))
        .unit();
    const p = (a: number, y: number, l: number) =>
        at.add(x.scale(a)).add(vUp.scale(y)).add(d.scale(l));
    const pieces: Piece[] = [];
    // The halves, each cut round half the wire's hole at the split.
    const hole = wireR + 0.0015;
    for (const s of [-1, 1]) {
        const edge = (s * gap) / 2;
        const notch: Flat[] = Array.from({ length: 9 }, (_, i) => {
            const t = -Math.PI / 2 + (Math.PI * i) / 8;
            return [edge + s * hole * Math.cos(t), hole * Math.sin(t)];
        });
        const outline: Flat[] = [
            [edge, -high / 2],
            [edge + s * half, -high / 2],
            [edge + s * half, high / 2],
            [edge, high / 2],
            ...notch.reverse(),
        ];
        const frame: Frame = { o: at, u: x, v: vUp, n: x.cross(vUp) };
        pieces.push(...plate(frame, outline, [], long, colors.body));
    }
    // The upright bolts' heads on top and their nuts underneath, sunk flush (just proud, so they show).
    for (const s of [-1, 1])
        for (const e of [-1, 1])
            for (const t of [-1, 1]) {
                const centre = p(
                    s * (gap / 2 + b.in),
                    t * (high / 2 - 0.0005),
                    e * (long / 2 - b.end),
                );
                pieces.push(
                    ...nut(centre, vUp, nt.across, 0.002, t > 0 ? colors.brass : colors.steel),
                );
            }
    // The eye bolts across, each eye lying flat, a nut on the far side.
    const side = gap / 2 + half;
    const eyes: Vector3[] = [];
    for (const [s, y, l] of [
        [1, eye.high, -(long / 2 - eye.end)],
        [-1, -eye.high, long / 2 - eye.end],
    ] as const) {
        const out = x.scale(s);
        const size = { ...eye.size, thread: { r: 0.005, length: 2 * side + nt.thick + 0.006 } };
        const bolt = eyeBolt(p(s * side, y, l), out, d, colors.steel, size);
        pieces.push(...bolt.pieces);
        pieces.push(
            ...nut(p(-s * (side + nt.thick / 2), y, l), x, nt.across, nt.thick, colors.steel),
        );
        eyes.push(bolt.eye);
    }
    return { pieces, inner: eyes[0], outer: eyes[1] };
}

/*
 * In-line hardware, built to hook together: each link from its near inside end (the inside of its hole at the end
 * towards the anchor) along `d`, lying in the plane square to `m`, and returning its far inside end. Two links pulled
 * apart meet where their insides touch, so the next link starts where the last one ends; each lies a quarter turn from
 * the last, as linked hardware does.
 */

/** A frame for a link: `d` along it, `w` across it in its plane, `m` square to its plane. */
function linkFrame(d: Vector3, m: Vector3) {
    const dd = d.unit();
    const mm = m.sub(dd.scale(m.dot(dd))).unit();
    return { d: dd, m: mm, w: mm.cross(dd) };
}

/**
 * A level frame for a line of hardware along `along`: `flat` square to the links that lie flat, `upright` square to
 * the ones that stand on edge between them.
 */
export function linkPlanes(along: Vector3): { flat: Vector3; upright: Vector3 } {
    const d = along.unit();
    const up = vec3(0, 1, 0);
    const flat = up.sub(d.scale(up.dot(d))).unit();
    return { flat, upright: d.cross(flat) };
}

/**
 * A strand of steel through `points`, true to size, open or (if its ends meet) closed; `shape` if it's a shape many
 * strands share (see `Strand`).
 */
function steelStrand(points: Vector3[], r: number, color: string, shape?: Vector3[]): Piece {
    return {
        kind: "strand",
        points,
        ...(shape && { shape }),
        r,
        material: "steel",
        color,
        capA: true,
        capB: true,
        toScale: true,
    };
}

/**
 * A 19 mm shackle (metres, after Crosby's G-209 and G-210): its body's and pin's radii, the inside width between its
 * ears and its inside length from the crown to the pin; a bow shackle's bow widens to `bow` inside.
 */
export const SHACKLE_19 = { body: 0.0095, pin: 0.0112, width: 0.032, length: 0.073, bow: 0.052 };
/**
 * A 6 mm D shackle (500 kg WLL), as on Appendix E's platform stays: its body 6.5 mm and pin 8 mm across, 12 mm between
 * its ears, 24 mm inside from the crown to the pin.
 */
export const SHACKLE_6: typeof SHACKLE_19 = {
    body: 0.00325,
    pin: 0.004,
    width: 0.012,
    length: 0.024,
    bow: 0.019,
};
/** A 3/8 in (10 mm) shackle, after Crosby's G-209: its pin 11.2 mm across, 16.8 mm between its ears, 36.6 mm inside. */
export const SHACKLE_10: typeof SHACKLE_19 = {
    body: 0.00475,
    pin: 0.0056,
    width: 0.0168,
    length: 0.0366,
    bow: 0.0269,
};

/**
 * A shackle, `kind` bow or D, its crown's inside at `near` and its pin across the far end, the pin's axis `m` × `d`
 * (so the link through the pin lies square to `w`). Its body is galvanised `color`, its screw pin painted `pinColor`:
 * a collar against one ear and a flat eye beyond it to turn it by, its threaded end just through the other ear.
 * Returns its pieces and the pin's inside face (its far end).
 */
export function shackle(
    kind: "bow" | "d",
    near: Vector3,
    d: Vector3,
    m: Vector3,
    color: string,
    pinColor: string,
    size = SHACKLE_19,
): { pieces: Piece[]; far: Vector3 } {
    const f = linkFrame(d, m);
    const { body: r, pin, width, length, bow } = size;
    const p = (u: number, v: number) => near.add(f.d.scale(u)).add(f.w.scale(v));
    const ear = width / 2 + r;
    const pinAt = length + pin;
    // The body's middle line, from one ear round the crown to the other.
    const pts: Vector3[] = [];
    if (kind === "d") {
        const rr = ear;
        pts.push(p(pinAt, ear));
        pts.push(p(pinAt - 0.4 * (pinAt + r - rr), ear));
        for (let i = 0; i <= 24; i++) {
            const t = Math.PI / 2 + (Math.PI * i) / 24;
            pts.push(p(-r + rr + rr * Math.cos(t), rr * Math.sin(t)));
        }
        pts.push(p(pinAt - 0.4 * (pinAt + r - rr), -ear));
        pts.push(p(pinAt, -ear));
    } else {
        // The bow: round, wider than the ears, its legs easing straight back into them.
        const rr = bow / 2 + r;
        const c = -r + rr;
        const open = Math.asin(Math.min(1, ear / rr)) + 0.25;
        pts.push(p(pinAt, ear));
        pts.push(p(pinAt - 0.012, ear + 0.0005));
        for (let i = 0; i <= 32; i++) {
            const t = open + ((2 * Math.PI - 2 * open) * i) / 32;
            pts.push(p(c + rr * Math.cos(t), rr * Math.sin(t)));
        }
        pts.push(p(pinAt - 0.012, -ear - 0.0005));
        pts.push(p(pinAt, -ear));
    }
    const pieces: Piece[] = [steelStrand(pts, r, color)];
    // The ears: thick bosses round the pin.
    const boss = r * 1.5;
    for (const s of [-1, 1])
        pieces.push(...part(p(pinAt, s * (ear - r)), p(pinAt, s * (ear + r)), boss, color, r));
    // The pin, from just through the far ear to its collar against the near one, then its flat eye.
    const face = ear + r;
    pieces.push(...part(p(pinAt, -face - 0.002), p(pinAt, face), pin, pinColor));
    pieces.push(...part(p(pinAt, face), p(pinAt, face + 0.003), pin * 1.4, pinColor, 0.003));
    const tab = { o: p(pinAt, face + 0.003), u: f.w, v: f.d, n: f.m };
    const long = 0.026 * (pin / SHACKLE_19.pin);
    const half = pin * 1.05;
    const outline: Flat[] = [
        [0, -pin],
        ...Array.from({ length: 9 }, (_, i): Flat => {
            const t = -Math.PI / 2 + (Math.PI * i) / 8;
            return [long - half + half * Math.cos(t), half * Math.sin(t)];
        }),
        [0, pin],
    ];
    pieces.push(
        ...plate(tab, outline, [circle([long - half, 0], half * 0.45, 12)], pin * 0.8, pinColor),
    );
    return { pieces, far: p(length, 0) };
}

/**
 * A 24 mm turnbuckle, eye to eye (metres), in proportion to a photo of a galvanised one with its rod 24 mm across: its
 * threaded rods' radius, its eyes (inside length and width, and the bar's radius round them), its forged frame (length
 * between its hexagon bosses, width, thickness, and the window through it), the bosses (across their flats and long),
 * how far each rod reaches into the window and how far it stands out of the frame, here wound partly out.
 */
export const TURNBUCKLE_24 = {
    rod: 0.012,
    eye: { length: 0.078, width: 0.049, bar: 0.011 },
    frame: { length: 0.36, width: 0.098, thick: 0.026, window: { long: 0.32, wide: 0.05 } },
    boss: { across: 0.05, long: 0.045 },
    into: 0.1,
    out: 0.06,
};

/**
 * A turnbuckle along `d`, its eyes in the plane square to `m`, the near eye's inside end at `near`. Its frame lies in
 * the eyes' plane too, unless `turned`, when it's turned a quarter round the rods from them (as it's free to, screwed
 * on): flat to `m`.
 */
export function turnbuckle(
    near: Vector3,
    d: Vector3,
    m: Vector3,
    color: string,
    {
        size = TURNBUCKLE_24,
        turned = false,
    }: { size?: typeof TURNBUCKLE_24; turned?: boolean } = {},
): { pieces: Piece[]; far: Vector3 } {
    const f = linkFrame(d, m);
    const { rod, eye, frame, boss, into, out } = size;
    const p = (u: number, v = 0) => near.add(f.d.scale(u)).add(f.w.scale(v));
    const pieces: Piece[] = [];
    // An eye: a rounded slot round its hole, from `u0` (its hole's inside end) along `dir`.
    const eyeAt = (u0: number, dir: number) => {
        const rr = eye.width / 2 + eye.bar;
        const straight = eye.length - eye.width;
        const c0 = u0 + dir * (eye.width / 2);
        const c1 = c0 + dir * straight;
        const pts: Vector3[] = [];
        for (let i = 0; i <= 10; i++) {
            const t = Math.PI / 2 + (Math.PI * i) / 10;
            pts.push(p(c0 + dir * rr * Math.cos(t), rr * Math.sin(t)));
        }
        for (let i = 0; i <= 10; i++) {
            const t = -Math.PI / 2 + (Math.PI * i) / 10;
            pts.push(p(c1 + dir * rr * Math.cos(t), rr * Math.sin(t)));
        }
        pts.push(pts[0]);
        pieces.push(steelStrand(pts, eye.bar, color));
        return u0 + dir * (eye.length + eye.bar);
    };
    const neck = eyeAt(0, 1);
    // Along the turnbuckle: each boss, and the frame between them.
    const boss0 = neck + out;
    const frame0 = boss0 + boss.long;
    const frame1 = frame0 + frame.length;
    const boss1 = frame1 + boss.long;
    const total = boss1 + out + eye.bar + eye.length;
    const window0 = frame0 + (frame.length - frame.window.long) / 2;
    const window1 = window0 + frame.window.long;
    // The rods, from each eye's neck through its boss and on into the window.
    pieces.push(...part(p(neck - 0.004), p(window0 + into), rod, color));
    pieces.push(...part(p(window1 - into), p(total - eye.length - eye.bar + 0.004), rod, color));
    // The bosses, hexagons round the rods.
    for (const u of [boss0, frame1])
        pieces.push(...nut(p(u + boss.long / 2), f.d, boss.across, boss.long, color));
    // The frame: flat, tapering from the bosses out to its full width, a long window through it.
    const [hb, hw] = [boss.across / 2, frame.width / 2];
    const taper = 0.06;
    const outline: Flat[] = [
        [0, -hb],
        [taper, -hw],
        [frame.length - taper, -hw],
        [frame.length, -hb],
        [frame.length, hb],
        [frame.length - taper, hw],
        [taper, hw],
        [0, hb],
    ];
    const r = frame.window.wide / 2;
    const w0 = window0 - frame0 + r;
    const w1 = window1 - frame0 - r;
    const slot: Flat[] = [
        ...Array.from({ length: 9 }, (_, i): Flat => {
            const t = -Math.PI / 2 + (Math.PI * i) / 8;
            return [w1 + r * Math.cos(t), r * Math.sin(t)];
        }),
        ...Array.from({ length: 9 }, (_, i): Flat => {
            const t = Math.PI / 2 + (Math.PI * i) / 8;
            return [w0 + r * Math.cos(t), r * Math.sin(t)];
        }),
    ];
    const face = turned ? { v: f.m, n: f.w.scale(-1) } : { v: f.w, n: f.m };
    pieces.push(...plate({ o: p(frame0), u: f.d, ...face }, outline, [slot], frame.thick, color));
    eyeAt(total, -1);
    return { pieces, far: p(total) };
}

/**
 * A heavy wire rope thimble for 11 mm wire (metres): its inside length from the crown to its point, its inside width
 * across the crown, its metal's thickness, and how far round the wire (radians, either way from its inside) the channel
 * hugs it before its flanges flare out.
 */
export const THIMBLE_11 = { length: 0.072, width: 0.034, web: 0.003, flange: 1.15 };

/**
 * A thimble with a wire's eye round it, its crown's inside at `near`, its point towards `d`, lying square to `m`.
 * Returns the thimble's pieces and the wire's path round it, from its point on one side round the crown to the point
 * on the other, the two `apart` either side of the middle (`side` is the way from the first to the second).
 */
export function thimble(
    near: Vector3,
    d: Vector3,
    m: Vector3,
    wireR: number,
    color: string,
    apart = wireR + 0.0005,
    size = THIMBLE_11,
): { pieces: Piece[]; wire: Vector3[]; side: Vector3 } {
    const f = linkFrame(d, m);
    const { length, width, web, flange } = size;
    // The teardrop `off` out from the inside, lifted `lift` off its plane: from the point round the crown and back to
    // the point, its two ends `ends` either side of the middle.
    const R = width / 2;
    const path = (off: number, lift: number, ends: number) => {
        const rr = R + off;
        const tip = length + off;
        const phi = Math.acos(Math.min(1, rr / (tip - R)));
        const q = (u: number, v: number) =>
            near.add(f.d.scale(u)).add(f.w.scale(v)).add(f.m.scale(lift));
        const pts: Vector3[] = [q(tip, -ends)];
        for (let i = 0; i <= 18; i++) {
            const a = -(Math.PI - phi) + (2 * (Math.PI - phi) * i) / 18;
            pts.push(q(R - rr * Math.cos(a), rr * Math.sin(a)));
        }
        pts.push(q(tip, ends));
        return pts;
    };
    const groove = web + wireR;
    // The channel's section, a line through the middle of its metal (out from the wire's middle, and across): hugging
    // the inside of the wire, then its flanges flaring out either side to thin flat edges past the wire's middle.
    const rho = wireR + web / 2;
    const half: Flat[] = Array.from({ length: 7 }, (_, k): Flat => {
        const t = (flange * k) / 6;
        return [-rho * Math.cos(t), rho * Math.sin(t)];
    });
    const [er, ez] = half[6];
    half.push([er + 0.0025, ez + 0.0018], [er + 0.0055, ez + 0.0025]);
    const section: Flat[] = [
        ...half
            .slice(1)
            .reverse()
            .map(([r, z]): Flat => [r, -z]),
        ...half,
    ];
    // Each section point moved `by` across the metal (positive towards the wire), along the section's normal there.
    const offset = (by: number): Flat[] =>
        section.map(([r, z], j) => {
            const [a, b] = [
                section[Math.max(j - 1, 0)],
                section[Math.min(j + 1, section.length - 1)],
            ];
            const [tr, tz] = [b[0] - a[0], b[1] - a[1]];
            const len = Math.hypot(tr, tz);
            return [r + (by * tz) / len, z - (by * tr) / len];
        });
    const centres = path(groove, 0, 0.0015);
    const sweep = ([r, z]: Flat) => path(groove + r, z, 0.0015);
    const pieces: Piece[] = [];
    // A surface between two lines across the section, swept round, facing away from the wire or towards it.
    const surface = (line: Flat[], outward: boolean) => {
        const grid = line.map(sweep);
        for (let j = 0; j + 1 < grid.length; j++)
            for (let i = 0; i + 1 < centres.length; i++) {
                const points = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
                const mid = points[0].lerp(points[2], 0.5);
                const n = points[1].sub(points[0]).cross(points[3].sub(points[0])).unit();
                const away = mid.sub(centres[i].lerp(centres[i + 1], 0.5)).dot(n) > 0;
                pieces.push({
                    kind: "face",
                    points,
                    material: "steel",
                    normal: away === outward ? n : n.neg(),
                    color,
                    toScale: true,
                });
            }
    };
    const [inner, outer] = [offset(web / 2), offset(-web / 2)];
    surface(inner, false);
    surface(outer, true);
    // The flanges' flat edges.
    surface([inner[0], outer[0]], true);
    surface([inner.at(-1)!, outer.at(-1)!], true);
    return { pieces, wire: path(groove, 0, apart), side: f.w };
}

/**
 * A double base (double throat) wire rope grip for 11 mm wire (metres), after a maker's drawing of one: a forged body
 * with a throat either side, a wire in each, and two U-bolts, staggered along the wires, each hooked over one wire with
 * its legs through the body and nutted on the far side. The body's web between the throats, each throat's half-width,
 * how far the body stands out either side of its middle (`lug`) and across (`wide`, half), and how long it is along the
 * wires; the U-bolts' legs (radius and how far either side of the middle), how far apart along the wires the two
 * U-bolts are, and their nuts.
 */
export const BASE_CLAMP = {
    web: 0.006,
    throat: 0.006,
    lug: 0.018,
    wide: 0.021,
    long: 0.032,
    leg: 0.0055,
    legAt: 0.012,
    stagger: 0.016,
    nut: { across: 0.017, thick: 0.009 },
};

/** How far each wire's middle is from a base clamp's middle, for a wire `wireR` thick. */
export const baseClampWire = (wireR: number, size = BASE_CLAMP) => size.web / 2 + wireR;

/**
 * A double base clamp at `at` (its body's middle, between the two wires), the wires along `d`, `side` the way from one
 * wire to the other, each wire `wireR` thick and lying `baseClampWire(wireR)` from the middle. All galvanised `color`.
 */
export function baseClamp(
    at: Vector3,
    d: Vector3,
    side: Vector3,
    wireR: number,
    color: string,
    size = BASE_CLAMP,
): Piece[] {
    const f = linkFrame(d, side);
    // Here `f.m` is the way between the wires and `f.w` across them both.
    const { web, throat, lug, wide, long, leg, legAt, stagger, nut: nt } = size;
    const pieces: Piece[] = [];
    // The body: an H across the wires, each throat's floor rounded to its wire.
    const floor = (s: number): Flat[] =>
        Array.from({ length: 9 }, (_, i) => {
            const t = Math.PI + (Math.PI * i) / 8;
            return [throat * Math.cos(t), s * (web / 2 + throat + throat * Math.sin(t))];
        });
    const outline: Flat[] = [
        [-wide, -lug],
        [-throat, -lug],
        ...floor(-1),
        [throat, -lug],
        [wide, -lug],
        [wide, lug],
        [throat, lug],
        ...floor(1).reverse(),
        [-throat, lug],
        [-wide, lug],
    ];
    pieces.push(...plate({ o: at, u: f.w, v: f.m, n: f.d }, outline, [], long, color));
    // The U-bolts: one hooked over each wire, its legs through the body, its nuts on the far side.
    const reach = lug + nt.thick + 0.005;
    for (const s of [-1, 1]) {
        const c = at.add(f.d.scale((s * stagger) / 2));
        const q = (w: number, m: number) => c.add(f.w.scale(w)).add(f.m.scale(s * m));
        const wire = baseClampWire(wireR, size);
        const pts = [q(legAt, -reach)];
        for (let i = 0; i <= 16; i++) {
            const t = (Math.PI * i) / 16;
            pts.push(q(legAt * Math.cos(t), wire + legAt * Math.sin(t)));
        }
        pts.push(q(-legAt, -reach));
        pieces.push(steelStrand(pts, leg, color));
        for (const k of [-1, 1])
            pieces.push(
                ...nut(q(k * legAt, -(lug + nt.thick / 2)), f.m, nt.across, nt.thick, color),
            );
    }
    return pieces;
}

/**
 * A forged hook with a latch (metres): its bar's radius, the inside radius of its bowl, its shank's length from the
 * bowl to the eye, and its eye's inside radius. Sizes for a 1.6 t Tirfor's anchor hook and its cable's hook.
 */
export const ANCHOR_HOOK = { r: 0.011, bowl: 0.022, shank: 0.07, eye: 0.014 };
export const CABLE_HOOK = { r: 0.008, bowl: 0.017, shank: 0.05, eye: 0.009 };

/**
 * A hook whose eye is round `eye` (a pin through it along `pin`), its shank and bowl out along `d` from it, the hook
 * lying in the plane square to `pin`. What it holds sits at the bottom of its bowl, round its bar there, which runs
 * square to `d` in its plane. Returns its pieces, the middle of its bar at the bottom of the bowl, and the way that bar
 * runs.
 */
export function hook(
    eye: Vector3,
    d: Vector3,
    pin: Vector3,
    color: string,
    size = ANCHOR_HOOK,
): { pieces: Piece[]; bar: Vector3; along: Vector3 } {
    const f = linkFrame(d.neg(), pin);
    // In the hook's plane: `u` back from the bowl's bottom towards the eye, `v` across.
    const { r, bowl, shank, eye: eyeR } = size;
    const rho = bowl + r;
    const toEye = rho + shank + eyeR + r;
    const bottom = eye.sub(f.d.scale(toEye));
    const p = (u: number, v: number) => bottom.add(f.d.scale(u)).add(f.w.scale(v));
    // The bowl round its middle `rho` up from the bottom, from the point round the bottom to the shank's side.
    const pts: Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
        const phi = -2.2 + (2.2 + Math.PI / 2) * (i / 20);
        pts.push(p(rho - rho * Math.cos(phi), rho * Math.sin(phi)));
    }
    // The shank easing back to the hook's middle line, then the eye round the pin.
    pts.push(p(rho + 0.45 * shank, 0.55 * rho), p(rho + shank, 0));
    const pieces: Piece[] = [steelStrand(pts, r, color)];
    const ring = Array.from({ length: 17 }, (_, i) => {
        const t = (2 * Math.PI * i) / 16;
        return eye
            .add(f.d.scale((eyeR + r) * Math.cos(t)))
            .add(f.w.scale((eyeR + r) * Math.sin(t)));
    });
    pieces.push(steelStrand(ring, r, color));
    // The latch: a thin spring across the throat from the shank to the point.
    const point = pts[0];
    pieces.push(
        steelStrand([p(rho + 0.6 * shank, 0.35 * rho), point.add(f.d.scale(r))], 0.0018, color),
    );
    return { pieces, bar: bottom, along: f.w };
}

/**
 * A Tirfor T-516D wire rope winch (metres, from Tractel's figures and in proportion to a photo of a T-508D): its alloy
 * body's length, height and thickness, the anchor pin's height and how far out from the body's end, the rope guide's
 * height, its handle's length closed and its radius.
 */
export const TIRFOR_516 = {
    long: 0.523,
    high: 0.2,
    thick: 0.127,
    pin: { high: 0.12, out: 0.03 },
    rope: 0.05,
    handle: { long: 0.65, r: 0.0125 },
};

/**
 * A Tirfor lying on its side with its anchor end at `anchor` (the bottom of that end, middle of its thickness), its
 * load end towards `along` and its top towards `up`. Returns its pieces, its anchor pin (and the pin's way), where the
 * rope comes out of its load end, and where its slack tail comes out by the anchor.
 */
export function tirfor(
    anchor: Vector3,
    along: Vector3,
    up: Vector3,
    colors: { body: string; steel: string; lever: string; grip: string; label: string },
    size = TIRFOR_516,
): { pieces: Piece[]; pin: Vector3; pinAlong: Vector3; ropeOut: Vector3; tailOut: Vector3 } {
    const { long: L, high: H, thick, pin, rope, handle } = size;
    const u = along.unit();
    const v = up.sub(u.scale(up.dot(u))).unit();
    const n = u.cross(v);
    const f: Frame = { o: anchor, u, v, n };
    const p = (a: number, b: number, c = 0) => at(f, [a, b], c);
    const pieces: Piece[] = [];
    // The body: low at the anchor end, rising to a hump where the levers are, sloping down to the load end.
    const outline: Flat[] = [
        [0, 0.03],
        [0.03, 0],
        [L - 0.03, 0],
        [L, 0.03],
        [L, 0.7 * H],
        [L - 0.07, 0.8 * H],
        [0.6 * L, 0.84 * H],
        [0.53 * L, H],
        [0.24 * L, H],
        [0.2 * L, 0.84 * H],
        [0.03, 0.8 * H],
        [0, 0.74 * H],
    ];
    pieces.push(...plate(f, outline, [], thick, colors.body));
    // Its side covers, standing a little proud, and a label on each.
    const inset: Flat[] = [
        [0.04, 0.03],
        [L - 0.04, 0.03],
        [L - 0.04, 0.66 * H],
        [0.04, 0.7 * H],
    ];
    for (const s of [-1, 1]) {
        const side: Frame = { ...f, o: anchor.add(n.scale(s * (thick / 2 + 0.002))) };
        pieces.push(...plate(side, inset, [], 0.004, colors.body));
        const label: Flat[] = [
            [0.08 * L, 0.12 * H],
            [0.3 * L, 0.12 * H],
            [0.3 * L, 0.5 * H],
            [0.08 * L, 0.5 * H],
        ];
        const front: Frame = { ...f, o: anchor.add(n.scale(s * (thick / 2 + 0.0045))) };
        pieces.push(...plate(front, label, [], 0.001, colors.label));
    }
    // The anchor pin, upright between two cheeks out from the anchor end, for the hook's eye.
    const pinAt = p(-pin.out, pin.high);
    for (const s of [-1, 1]) {
        const cheek: Frame = { o: anchor.add(v.scale(pin.high + s * 0.02)), u, v: n, n: v };
        const shape: Flat[] = [
            [0.01, -0.03],
            [-pin.out, -0.025],
            ...Array.from({ length: 9 }, (_, i): Flat => {
                const t = -Math.PI / 2 - (Math.PI * i) / 8;
                return [-pin.out + 0.025 * Math.cos(t), 0.025 * Math.sin(t)];
            }),
            [-pin.out, 0.025],
            [0.01, 0.03],
        ];
        pieces.push(...plate(cheek, shape, [], 0.008, colors.body));
    }
    pieces.push(...part(pinAt.sub(v.scale(0.03)), pinAt.add(v.scale(0.03)), 0.009, colors.steel));
    // The rope guide at the load end, and where the tail comes out by the anchor.
    pieces.push(...part(p(L - 0.005, rope), p(L + 0.03, rope), 0.018, colors.body, 0.03));
    // The forward lever's socket and its handle, closed, leaning back over the load end; the reverse lever's stub.
    const lean = u.scale(Math.cos(1.0)).add(v.scale(Math.sin(1.0)));
    const socket = p(0.4 * L, 0.95 * H);
    pieces.push(...part(socket, socket.add(lean.scale(0.09)), 0.02, colors.steel));
    pieces.push(...part(socket, socket.add(lean.scale(handle.long)), handle.r, colors.steel));
    pieces.push(
        ...part(
            socket.add(lean.scale(handle.long - 0.12)),
            socket.add(lean.scale(handle.long + 0.005)),
            handle.r + 0.004,
            colors.grip,
        ),
    );
    const back = u.scale(-Math.cos(1.2)).add(v.scale(Math.sin(1.2)));
    const stub = p(0.68 * L, 0.82 * H);
    pieces.push(...part(stub, stub.add(back.scale(0.08)), 0.015, colors.grip));
    // The release lever, yellow, on top by the load end.
    const release: Flat[] = [
        [0.86 * L, 0.72 * H],
        [0.92 * L, 0.72 * H],
        [0.97 * L, 0.98 * H],
        [0.93 * L, 1.0 * H],
    ];
    pieces.push(
        ...plate(
            { ...f, o: anchor.add(n.scale(thick / 2 - 0.015)) },
            release,
            [],
            0.012,
            colors.lever,
        ),
    );
    return {
        pieces,
        pin: pinAt,
        pinAlong: v,
        ropeOut: p(L + 0.03, rope),
        tailOut: p(-0.005, 0.3 * H),
    };
}

/**
 * A short link chain (metres): its wire's radius, and each link's inside length and width. 6 mm galvanised short link,
 * typical of hardware-store chain: 18.5 mm inside, 9 mm across inside (21 mm outside).
 */
export const CHAIN_6 = { r: 0.003, length: 0.0185, width: 0.009 };
/** 6 mm Grade 80 lifting chain (1200 kg WLL), as Appendix E's platform stays: 18 mm long and 7.8 mm across inside. */
export const CHAIN_G80_6: ChainSize = { r: 0.003, length: 0.018, width: 0.0078 };
/** 10 mm short link: 28 mm long and 14 mm across inside (34 mm outside), wide enough for a 3/8 in shackle's pin. */
export const CHAIN_10: ChainSize = { r: 0.005, length: 0.028, width: 0.014 };
export type ChainSize = typeof CHAIN_6;

/**
 * One chain link, its inside running from `near` along `d` for its inside length, lying in the plane of `d` and `m`:
 * two straight sides joined by a half round at each end. Returns its pieces and its far end's inside.
 */
export function chainLink(
    near: Vector3,
    d: Vector3,
    m: Vector3,
    color: string,
    size: ChainSize = CHAIN_6,
): { pieces: Piece[]; far: Vector3 } {
    const f = linkFrame(d, m);
    const shape = linkShape(size);
    const pts = shape.map((q) => near.add(f.d.scale(q.x)).add(f.m.scale(q.y)));
    return {
        pieces: [steelStrand(pts, size.r, color, shape)],
        far: near.add(f.d.scale(size.length)),
    };
}

/** Each size's link shape, made once so every link of a size shares it (and the 3D view builds it once). */
const LINK_SHAPES = new Map<string, Vector3[]>();

/**
 * A chain link's middle line about its own origin: its inside from the origin along x, in the x–y plane. Two straight
 * sides joined by a half round at each end, round each end on a half circle through the middle of the wire.
 */
function linkShape({ r, length, width }: ChainSize): Vector3[] {
    const key = `${r} ${length} ${width}`;
    const made = LINK_SHAPES.get(key);
    if (made) return made;
    const round = width / 2 + r;
    const [a, b] = [width / 2, length - width / 2];
    const n = 10;
    const pts: Vector3[] = [];
    for (let i = 0; i <= n; i++) {
        const t = -Math.PI / 2 + (Math.PI * i) / n;
        pts.push(vec3(b + round * Math.cos(t), round * Math.sin(t), 0));
    }
    for (let i = 0; i <= n; i++) {
        const t = Math.PI / 2 + (Math.PI * i) / n;
        pts.push(vec3(a + round * Math.cos(t), round * Math.sin(t), 0));
    }
    pts.push(pts[0]);
    LINK_SHAPES.set(key, pts);
    return pts;
}

/**
 * The points along `path` (a polyline) each a straight `step` on from the last, from its start for as far as it goes.
 */
export function stepsAlong(path: Vector3[], step: number): Vector3[] {
    const out = [path[0]];
    let here = path[0];
    let i = 1;
    while (i < path.length) {
        // The first point past `here` that's at least a step away (give or take rounding, so a path a whole number of
        // steps long ends on a step): the next point is on the segment leading to it.
        while (i < path.length && path[i].distanceTo(here) < step * (1 - 1e-9)) i++;
        if (i === path.length) break;
        const [a, b] = [path[i - 1], path[i]];
        const ab = b.sub(a);
        const ah = a.sub(here);
        // |a + t ab - here|² = step², for the t in [0, 1] past `a`.
        const [qa, qb, qc] = [ab.dot(ab), 2 * ab.dot(ah), ah.dot(ah) - step * step];
        const t = (-qb + Math.sqrt(Math.max(0, qb * qb - 4 * qa * qc))) / (2 * qa);
        here = a.add(ab.scale(t));
        out.push(here);
    }
    return out;
}

/** Where a chain link is: its inside's near end, the way along it, and a way in its plane square to that. */
export type LinkFrame = { near: Vector3; d: Vector3; m: Vector3 };

/**
 * Chain laid along `path`, from its start: each link's inside runs from one point a link's inside length along to the
 * next, where the next link's inside starts, so each link's end sits in the next one's. The links lie alternately in
 * the plane of the path and `face`, and square to it. Returns where each link is, and the inside of the last link's far
 * end (short of the path's end by less than a link).
 */
export function chainLinks(
    path: Vector3[],
    face: Vector3,
    size: ChainSize = CHAIN_6,
): { links: LinkFrame[]; end: Vector3 } {
    const joints = stepsAlong(path, size.length);
    const links: LinkFrame[] = [];
    for (let k = 0; k + 1 < joints.length; k++) {
        const d = joints[k + 1].sub(joints[k]).unit();
        const f = linkFrame(d, face);
        links.push({ near: joints[k], d, m: k % 2 ? f.w : f.m });
    }
    return { links, end: joints[joints.length - 1] };
}

/** The middle line of a chain link's wire, about its own origin: its inside from the origin along x, in the x–y plane. */
export function linkOutline(size: ChainSize = CHAIN_6): Vector3[] {
    return linkShape(size);
}

/** Chain laid along `path` (see `chainLinks`), as pieces: its links, the end, and how many links. */
export function chain(
    path: Vector3[],
    face: Vector3,
    color: string,
    size: ChainSize = CHAIN_6,
): { pieces: Piece[]; end: Vector3; links: number } {
    const { links, end } = chainLinks(path, face, size);
    return {
        pieces: links.flatMap((l) => chainLink(l.near, l.d, l.m, color, size).pieces),
        end,
        links: links.length,
    };
}

/**
 * How a chain or rope `length` long hangs between `a` and `b` (a catenary: no stretch, weight evenly along it), as
 * `n` + 1 points from `a` to `b`. The ends mustn't be one above the other.
 */
export function hangingPath(a: Vector3, b: Vector3, length: number, n = 400): Vector3[] {
    const ab = b.sub(a);
    const v = ab.y;
    const across = vec3(ab.x, 0, ab.z);
    const h = across.len();
    const along = across.scale(1 / h);
    // Its parameter c from √(L² − v²) = 2c sinh(h / 2c), which falls as c grows; taut if it's no longer than the chord.
    const span = Math.sqrt(Math.max(0, length * length - v * v));
    if (span <= h * (1 + 1e-9)) return [a, b];
    const [lo, hi] = bisect((c) => 2 * c * Math.sinh(h / (2 * c)) > span, 1e-4 * h, 1e4 * h, 200);
    const c = (lo + hi) / 2;
    // Where it's lowest, along from `a`, from v = 2c sinh(h / 2c) sinh((h / 2 − x0) / c).
    const x0 = h / 2 - c * Math.asinh(v / (2 * c * Math.sinh(h / (2 * c))));
    const y = (x: number) => c * (Math.cosh((x - x0) / c) - Math.cosh(x0 / c));
    return Array.from({ length: n + 1 }, (_, i) => {
        const x = (h * i) / n;
        return a.add(along.scale(x)).add(vec3(0, y(x), 0));
    });
}

/**
 * Metric bolt sizes (metres): the shank's radius, the head's and nut's width across their flats and how thick each is
 * (the nut a nylon-insert lock nut), and the flat washer under each, as Appendix E's tower is bolted with.
 */
export const M16 = {
    r: 0.008,
    across: 0.024,
    head: 0.01,
    nut: 0.02,
    washer: { r: 0.015, thick: 0.003 },
};
export const M12: typeof M16 = {
    r: 0.006,
    across: 0.018,
    head: 0.0075,
    nut: 0.015,
    washer: { r: 0.012, thick: 0.0025 },
};
export type BoltSize = typeof M16;

/**
 * A bolt `length` long (under its head) through `grip` of steel, from `face` (the near face) along `into`: a washer and
 * hex head on the near face, and a washer and lock nut on the far face, the thread standing out past the nut by
 * whatever the length leaves. Without `head`, it's the shank of an eye bolt whose collar sits on the near face: just
 * the shank through, and the washer and nut.
 */
export function throughBolt(
    face: Vector3,
    into: Vector3,
    grip: number,
    length: number,
    color: string,
    size: BoltSize = M16,
    head = true,
): Piece[] {
    const d = into.unit();
    const { r, across, washer } = size;
    const at = (t: number) => face.add(d.scale(t));
    const pieces: Piece[] = [];
    const disc = (from: number, to: number, radius: number) =>
        part(at(from), at(to), radius, color, to - from);
    // Under the head: its washer, then the head.
    const start = head ? -washer.thick : 0;
    if (head) {
        pieces.push(...disc(-washer.thick, 0, washer.r));
        pieces.push(...nut(at(-washer.thick - size.head / 2), d, across, size.head, color));
    }
    // The far face's washer and the nut.
    pieces.push(...disc(grip, grip + washer.thick, washer.r));
    pieces.push(...nut(at(grip + washer.thick + size.nut / 2), d, across, size.nut, color));
    // The shank, through it all and out past the nut.
    const end = Math.max(start + length, grip + washer.thick + size.nut + 0.002);
    pieces.push(...part(at(start), at(end), r, color, r));
    return pieces;
}

import { rod, timber, type Face, type Piece } from "@/abseil-tower/tower";
import { vec3, type Vector3 } from "@/lib/vector3";

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
 * A screwgate carabiner hanging from `top` (the middle of the bar at its top end) towards `down`, its loop in the plane
 * of `down` and `across`: an oval `length` long and `width` wide, its gate on the `across` side with its sleeve.
 */
export function carabiner(
    top: Vector3,
    down: Vector3,
    across: Vector3,
    color: string,
    length = 0.11,
    width = 0.06,
    r = 0.005,
): Piece[] {
    const d = down.unit();
    const a = across.unit();
    const end = width / 2;
    const straight = length - width;
    const pts: Vector3[] = [];
    // The top arc, the gate side down, the bottom arc, the spine side back up.
    const arc = (centre: Vector3, from: number, to: number) => {
        for (let i = 0; i <= 8; i++) {
            const t = from + ((to - from) * i) / 8;
            pts.push(centre.add(a.scale(end * Math.cos(t))).add(d.scale(-end * Math.sin(t))));
        }
    };
    const upper = top.add(d.scale(end));
    const lower = upper.add(d.scale(straight));
    arc(upper, Math.PI, 0);
    arc(lower, 0, -Math.PI);
    pts.push(pts[0]);
    const loop: Piece = {
        kind: "strand",
        points: pts,
        r,
        material: "steel",
        color,
        capA: false,
        capB: false,
        toScale: true,
    };
    const sleeveAt = upper.add(a.scale(end)).add(d.scale(straight * 0.3));
    return [loop, ...part(sleeveAt, sleeveAt.add(d.scale(straight * 0.45)), r * 1.7, color, r)];
}

/** A steel ring's radius (to its bar's middle) and its bar's. */
export const RING = { r: 0.025, bar: 0.005 };

/** A steel ring centred at `centre`, in the plane of `a` and `b`. */
export function ring(centre: Vector3, a: Vector3, b: Vector3, color: string): Piece[] {
    const [ua, ub] = [a.unit(), b.unit()];
    const points = Array.from({ length: 17 }, (_, i) => {
        const t = (2 * Math.PI * i) / 16;
        return centre.add(ua.scale(RING.r * Math.cos(t))).add(ub.scale(RING.r * Math.sin(t)));
    });
    return [
        {
            kind: "strand",
            points,
            r: RING.bar,
            material: "steel",
            color,
            capA: false,
            capB: false,
            toScale: true,
        },
    ];
}

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
    colors: { plates: string; sheave: string; steel: string };
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
    pieces.push(...carabiner(hook, up.neg(), axle, colors.steel, length, 0.055, 0.0045));
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
 * The trolley's side plates' outline (metres), measured off a photo of an ISC Zip Speed (RP075): along the wire (u, its
 * bumper end towards +u) and up from it (v), the wire at the origin. A lobe at the −u end carries the tow hole.
 */
const TOW_HOLE: Flat = [-0.089, 0.027];
const TROLLEY_OUTLINE: Flat[] = closedSmooth(
    [
        [0, -0.066],
        [0.03, -0.062],
        [0.055, -0.054],
        [0.08, -0.042],
        [0.098, -0.028],
        [0.104, -0.005],
        [0.104, 0.03],
        [0.098, 0.05],
        [0.085, 0.058],
        [0.05, 0.06],
        [0, 0.06],
        [-0.05, 0.059],
        [-0.07, 0.054],
        // Round the tow hole's lobe.
        ...[70, 110, 150, 190, 230, 270].map((deg): Flat => {
            const t = (deg * Math.PI) / 180;
            return [TOW_HOLE[0] + 0.021 * Math.cos(t), TOW_HOLE[1] + 0.021 * Math.sin(t)];
        }),
        [-0.08, 0.0],
        [-0.082, -0.02],
        [-0.07, -0.04],
        [-0.05, -0.054],
        [-0.03, -0.062],
    ],
    3,
);

/** A curved slot round `centre`, between radii `r0` and `r1`, `half` radians either side of angle `mid`. */
function slot(centre: Flat, r0: number, r1: number, mid: number, half: number, n = 8): Flat[] {
    const arc = (r: number, from: number, to: number) =>
        Array.from({ length: n + 1 }, (_, i): Flat => {
            const t = from + ((to - from) * i) / n;
            return [centre[0] + r * Math.cos(t), centre[1] + r * Math.sin(t)];
        });
    return [...arc(r1, mid - half, mid + half), ...arc(r0, mid + half, mid - half)];
}

/**
 * A twin-sheave zip line trolley riding on a wire at `wire`, after the ISC Zip Speed in the book's Figure 78 and the
 * user's photos: two sheaves on the wire between alloy side plates, each showing through two curved slots; a black
 * bumper at one end (towards `bumper`, along the wire) and a lobe with a tow hole at the other; and three holes below,
 * the middle one five-sided for the rider's carabiner. `across` is through the plates.
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
} {
    const n = across.unit();
    const u = bumper.unit();
    const up = n.cross(u).unit();
    const f: Frame = { o: wire, u, v: up.y < 0 ? up.neg() : up, n };
    const groove = 0.02;
    const axleV = groove + wireR;
    const axles: Flat[] = [
        [-0.042, axleV],
        [0.042, axleV],
    ];
    const lower: Flat[] = [
        [-0.037, -0.035],
        [0.037, -0.035],
    ];
    const lowerR = 0.01;
    const pentagon = closedSmooth(
        [
            [0, -0.022],
            [0.014, -0.031],
            [0.012, -0.05],
            [-0.012, -0.05],
            [-0.014, -0.031],
        ],
        2,
    );
    const towR = 0.011;
    const holes = [
        circle(TOW_HOLE, towR, 14),
        ...lower.map((c) => circle(c, lowerR, 14)),
        pentagon,
        circle([0.002, 0.016], 0.004, 8),
        // The sheaves' windows, either side of each axle.
        ...axles.flatMap((c) => [
            slot(c, 0.019, 0.025, 0, 0.7),
            slot(c, 0.019, 0.025, Math.PI, 0.7),
        ]),
    ];
    const pieces: Piece[] = [];
    for (const s of [-1, 1])
        pieces.push(
            ...plate(
                { ...f, o: at(f, [0, 0], s * 0.014) },
                TROLLEY_OUTLINE,
                holes,
                0.006,
                colors.plates,
            ),
        );
    for (const c of axles) {
        pieces.push(...sheave(at(f, c), n, groove, 0.027, 0.014, colors.sheave));
        pieces.push(...bolt(at(f, c), n, 0.034, 0.006, colors.steel));
    }
    pieces.push(...bolt(at(f, [0.004, 0.038]), n, 0.034, 0.005, colors.steel));
    pieces.push(...bolt(at(f, [0.085, 0.03]), n, 0.034, 0.005, colors.steel));
    // The bumper across the plates' end, above and below the wire.
    for (const [v0, v1] of [
        [-0.03, -0.008],
        [0.008, 0.045],
    ])
        pieces.push(
            ...timber(
                at(f, [0.096, (v0 + v1) / 2]),
                at(f, [0.118, (v0 + v1) / 2]),
                f.v,
                0.05,
                v1 - v0,
                "steel",
            ).map((p) => ({ ...p, color: colors.bumper })),
        );
    return {
        pieces,
        tow: at(f, TOW_HOLE),
        towR,
        main: at(f, [0, -0.022]),
        bumperSide: at(f, [lower[1][0], lower[1][1] + lowerR]),
        towSide: at(f, [lower[0][0], lower[0][1] + lowerR]),
        frame: f,
    };
}

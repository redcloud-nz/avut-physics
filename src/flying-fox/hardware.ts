import { rod, type Face, type Piece } from "@/abseil-tower/tower";
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
    return { pieces, rope, brakeOut, holeR, brake };
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

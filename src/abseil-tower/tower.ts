import { vec3, type Vector3 } from "@/lib/vector3";

/**
 * The Cracroft abseil tower, as described from memory and a few photos: every size here is an estimate. Scene
 * coordinates are metres with x east, y up and z north, the origin at the tower's south-west corner post on the ground.
 *
 * The pieces are laid out in a plan a quarter turn from that, with the boarded east face along its z = 0 side: the
 * plan's x runs north, its z west, and its origin is the south-east corner post. `towerPieces` turns them to the compass
 * at the end.
 */

/** What a piece is made of, which sets its colour. */
export type Material =
    | "log"
    | "rail"
    | "board"
    | "deck"
    | "steel"
    | "sling"
    | "rope"
    | "bucket"
    | "person";

/** Each material's colour, for a piece that doesn't give its own. */
export const MATERIAL_COLOR: Record<Material, string> = {
    log: "var(--tower-log)",
    rail: "var(--tower-rail)",
    board: "var(--tower-board)",
    deck: "var(--tower-deck)",
    steel: "var(--tower-steel)",
    sling: "var(--knot-yellow)",
    rope: "var(--knot-blue)",
    bucket: "var(--rig-black)",
    person: "var(--rig-person)",
};

/** How wide the gaps between boards are (metres); the flat views draw them no thinner than a pixel. */
export const JOINT_GAP = 0.01;

/** A round piece (a log, a rail or a pipe): a cylinder from `a` to `b`, drawn with a rounded end where `capA`/`capB`. */
export type Rod = {
    kind: "rod";
    a: Vector3;
    b: Vector3;
    r: number;
    material: Material;
    capA: boolean;
    capB: boolean;
    /** A colour in place of its material's (a rig's slings and ropes each have their own). */
    color?: string;
};

/**
 * A flat piece (a deck, boarding, a tread, or one side of a sawn timber): a convex polygon, with level board joints
 * `planks` apart if it has them. A side of a timber has its outward `normal`, so it's left out when it faces away, and
 * its edges drawn.
 */
export type Face = {
    kind: "face";
    points: Vector3[];
    material: Material;
    planks?: number;
    /** The way the boards' joints step across it (straight up unless given: level joints). */
    joints?: Vector3;
    normal?: Vector3;
    /** Its colour, where it isn't its material's. */
    color?: string;
    /** A short label written in its middle, drawn with it so what's in front of it covers both. */
    text?: string;
    /** Holes through it (a plate's), each a loop of points in its plane. */
    holes?: Vector3[][];
    /**
     * A colour at each corner (CSS, one per point), blended across the face in 3D, as for ground that shades smoothly
     * from grass to bare; the flat views keep to `color`.
     */
    shades?: string[];
};

/**
 * Where a piece is in the tower's shell, for the back-to-front sort: `layer` 1 is on one of its sides (railings, beams,
 * corner posts), 2 the boarding outside that, and 3 what sticks out past it (log ends, the outrigger), with
 * `out` the way that side faces. Pieces on a side facing the eye are drawn after everything inside, and those on a side
 * facing away before it. Pieces with no shell are inside.
 */
export type Shell = { out: Vector3; layer: number };

/**
 * A run of rope, tape or wire through `points`, drawn as one line so it bends without showing joins. It sorts as one
 * piece, so long or wrapping runs are split into a few strands.
 */
export type Strand = {
    kind: "strand";
    points: Vector3[];
    r: number;
    material: Material;
    color?: string;
    /** Whether each end is a real end, drawn rounded, or a join to the next strand, drawn so it doesn't show. */
    capA: boolean;
    capB: boolean;
    /**
     * Whether a real end is a cut end of rope, squared off and fused black as by a hot knife, rather than rounded.
     * Only the 3D view draws the difference.
     */
    cutA?: boolean;
    cutB?: boolean;
    /**
     * Flat tape, for the views that can draw it so: `layers` of it side by side, each `width` wide (lying `across`) and
     * `thickness` thick, fanned apart where they run round what they're on and gathered together at `gather` (a
     * carabiner), over the last `ramp` metres to it.
     */
    tape?: {
        width: number;
        thickness: number;
        across: Vector3;
        layers: number;
        gather: Vector3;
        ramp: number;
        /**
         * Its width and thickness at each point, in place of `width` and `thickness` (as where it bunches up), and the
         * way its width lies there, in place of `across` (as where it twists).
         */
        profile?: { width: number; thickness: number; across?: Vector3 }[];
    };
};

/**
 * Where a piece of a group sorts, for the back-to-front sort: the group's middle `at`, so the group sorts as one, then
 * `ahead` (a direction: the piece comes in front of the rest of its group when it faces the eye), then the piece's own
 * middle; `over` puts a piece over the rest of its group from every side. A railing's pieces are a group, so its posts
 * keep one order against its boards whatever their position, and a stair railing's newels cover its rails' ends.
 */
export type Group = {
    at: Vector3;
    ahead?: Vector3;
    over?: boolean;
    /** Other groups' middles it lies across too (a coil over two deck boards): it sorts with the nearest of them all. */
    across?: Vector3[];
};

export type Piece = (Rod | Face | Strand) & {
    shell?: Shell;
    group?: Group;
    /**
     * The size of the detail it adds (metres): a plate's edge, a bolt's head. The flat views leave it out when it would
     * be drawn too small to see.
     */
    fine?: number;
    /** Hardware: drawn its true size however far off, never thickened to stay visible as ropes and wire are. */
    toScale?: boolean;
};

/**
 * The centrelines of a tape strand's layers: side by side `across`, a little more than the tape's width apart where
 * they run round what they're on, closing in to almost touching at the carabiner they gather at.
 */
export function tapeLayers(p: Strand): Vector3[][] {
    if (!p.tape) return [p.points];
    const { width, layers, gather, ramp } = p.tape;
    const across = p.tape.across.unit();
    const pitch = width + 0.004;
    return Array.from({ length: layers }, (_, k) => {
        const slot = k - (layers - 1) / 2;
        return p.points.map((q) => {
            const spread = 0.15 + 0.85 * Math.min(1, q.distanceTo(gather) / ramp);
            return q.add(across.scale(slot * pitch * spread));
        });
    });
}

const S_OUT = vec3(-1, 0, 0);
const N_OUT = vec3(1, 0, 0);
const E_OUT = vec3(0, 0, -1);
const W_OUT = vec3(0, 0, 1);

/** `pieces` placed in the shell, on the side facing `out`, in `layer`. */
const onShell = <T extends Piece>(pieces: T[], out: Vector3, layer: number): T[] =>
    pieces.map((p) => ({ ...p, shell: { out, layer } }));

export const SIDE = 4.5;
/** The height of each level's deck above the ground at the east face. Level 0 is the ground. */
export const LEVELS = [0, 2.0, 4.5, 7.0, 9.5];
export const TOP = LEVELS[4];
/** The ground falls about a metre from the east face to the west face, towards the river. */
const FALL = 1.0;
/** The ground's height at `z` across the plan. */
const planGround = (z: number) => (-FALL * z) / SIDE;

export const LOG_R = 0.125;
const PIPE_R = 0.022;
const RAIL_HEIGHT = 1.0;
/** The boarding sits on the outside of the posts, and the east face's is this thick. */
const SKIN = LOG_R + 0.02;
/** How far the outrigger stands out from the west side. */
const OUTRIGGER = 1.0;
const BOARD_T = 0.05;
/** Where the A-frames' legs start, above the top deck: the corner posts end there. */
const A_FRAME_FOOT = 0.2;
/** Long pieces are cut into lengths no longer than this, so the back-to-front sort can put each in its place. */
const PIECE = 0.6;
const TILE = 1.2;

/** A rod cut into short lengths, rounded only at its two real ends. The rigs use it too. */
export function rod(
    a: Vector3,
    b: Vector3,
    r: number,
    material: Material,
    maxPiece = PIECE,
): Rod[] {
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / maxPiece));
    return Array.from({ length: n }, (_, i) => ({
        kind: "rod",
        a: a.lerp(b, i / n),
        b: a.lerp(b, (i + 1) / n),
        r,
        material,
        capA: i === 0,
        capB: i === n - 1,
    }));
}

/**
 * A sawn timber from `a` to `b` (the middles of its ends), `w` wide and `h` deep, its depth as near `up` as it can be:
 * its four long sides, and its two ends unless they're hidden (`ends` false). With `round`, its long edges are rounded
 * to that radius (as a steel section's are), each in a few narrow faces.
 */
export function timber(
    a: Vector3,
    b: Vector3,
    up: Vector3,
    w: number,
    h: number,
    material: Material,
    withEnds = true,
    round = 0,
): Face[] {
    const along = b.sub(a).unit();
    const v = up.sub(along.scale(up.dot(along))).unit();
    const s = along.cross(v).unit();
    // Its outline, anticlockwise from the corner at -s, -v: round each corner in `steps` faces, or square.
    const r = Math.min(round, w / 2, h / 2);
    const steps = r > 0 ? 3 : 0;
    const outline = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
    ].flatMap(([i, j], k) =>
        Array.from({ length: steps + 1 }, (_, m) => {
            const t = Math.PI * (1 + k / 2 + m / (2 * Math.max(steps, 1)));
            return [i * (w / 2 - r) + r * Math.cos(t), j * (h / 2 - r) + r * Math.sin(t)];
        }).slice(0, r > 0 ? steps + 1 : 1),
    );
    const at = (p: Vector3, [x, y]: number[]) => p.add(s.scale(x)).add(v.scale(y));
    const sides: Face[] = outline.map((P, k) => {
        const Q = outline[(k + 1) % outline.length];
        return {
            kind: "face",
            points: [at(a, P), at(b, P), at(b, Q), at(a, Q)],
            material,
            normal: s
                .scale(Q[1] - P[1])
                .sub(v.scale(Q[0] - P[0]))
                .unit(),
        };
    });
    const ends: Face[] = [
        { kind: "face", points: outline.map((P) => at(a, P)), material, normal: along.neg() },
        { kind: "face", points: outline.map((P) => at(b, P)), material, normal: along },
    ];
    return withEnds ? [...sides, ...ends] : sides;
}

const UP = vec3(0, 1, 0);

/** A parallelogram from `origin` along `u` and `v`, cut into tiles no bigger than `TILE` each way. */
export function panel(
    origin: Vector3,
    u: Vector3,
    v: Vector3,
    material: Material,
    planks?: Face["planks"],
): Face[] {
    const nu = Math.max(1, Math.ceil(u.len() / TILE));
    const nv = Math.max(1, Math.ceil(v.len() / TILE));
    const faces: Face[] = [];
    for (let i = 0; i < nu; i++)
        for (let j = 0; j < nv; j++) {
            const p = origin.add(u.scale(i / nu)).add(v.scale(j / nv));
            const du = u.scale(1 / nu);
            const dv = v.scale(1 / nv);
            faces.push({
                kind: "face",
                points: [p, p.add(du), p.add(du).add(dv), p.add(dv)],
                material,
                planks,
            });
        }
    return faces;
}

/** How far a deck runs out past the tower's sides, over its side beams. */
const DECK_OUT = 0.1;
/** The decks' boards run east–west, this wide: their joints step north, which is the plan's x. */
const DECK_BOARD = 0.12;
/** A level rectangle at height `y`, x from x0 to x1 and z from z0 to z1. */
/**
 * A rectangle of deck. It's a group of its own, by its middle, so what lies flat on it (a person's place) can sort
 * with it and come just after it from every side.
 */
const deckRect = (x0: number, x1: number, z0: number, z1: number, y: number): Face[] =>
    panel(vec3(x0, y, z0), vec3(x1 - x0, 0, 0), vec3(0, 0, z1 - z0), "deck", DECK_BOARD).map(
        (f) => ({
            ...f,
            joints: vec3(1, 0, 0),
            group: { at: vec3((x0 + x1) / 2, y, (z0 + z1) / 2) },
        }),
    );

/** A stair opening in a deck: x from x0 to x1, z from z0 to z1. */
type Opening = { x0: number; x1: number; z0: number; z1: number };

/**
 * A deck over the whole tower, with a hole for the stairs coming up through it. It sits on the side beams, level with
 * their tops, and runs out over them most of the way to their outer edges; a hole reaching a side runs out too.
 */
function deck(y: number, hole: Opening | null, past = DECK_OUT): Piece[] {
    const [lo, hi] = [-past, SIDE + past];
    const out = (v: number) => (v <= 0 ? lo : v >= SIDE ? hi : v);
    const rects: Rect[] = [];
    if (!hole) rects.push([lo, hi, lo, hi]);
    else {
        const [x0, x1, z0, z1] = [hole.x0, hole.x1, hole.z0, hole.z1].map(out);
        if (z0 > lo) rects.push([lo, hi, lo, z0]);
        if (z1 < hi) rects.push([lo, hi, z1, hi]);
        if (x0 > lo) rects.push([lo, x0, z0, z1]);
        if (x1 < hi) rects.push([x1, hi, z0, z1]);
    }
    return [
        ...rects.flatMap(([x0, x1, z0, z1]) => deckRect(x0, x1, z0, z1, y)),
        ...deckEdges(rects, y),
    ];
}

/** A deck rectangle by the plan: x from x0 to x1, z from z0 to z1. */
type Rect = [number, number, number, number];
/** How thick the decks' boards are. */
const DECK_T = 0.035;

/**
 * The edges of a deck made of `rects`, its boards' thickness deep: round its outside and its holes, but not where two of
 * its rectangles meet. Each sorts with its rectangle, in front of it from its side.
 */
function deckEdges(rects: Rect[], y: number): Piece[] {
    const faces: Piece[] = [];
    // Each rectangle's four edges: the line it's on (x = c, or z = c), its span along that line, and which way it faces.
    const edges = rects.flatMap(([x0, x1, z0, z1], k) => [
        { k, onX: true, c: x0, from: z0, to: z1, sign: -1 },
        { k, onX: true, c: x1, from: z0, to: z1, sign: 1 },
        { k, onX: false, c: z0, from: x0, to: x1, sign: -1 },
        { k, onX: false, c: z1, from: x0, to: x1, sign: 1 },
    ]);
    for (const e of edges) {
        // What's left once the stretches another rectangle's facing edge covers are taken off.
        let spans: [number, number][] = [[e.from, e.to]];
        for (const f of edges) {
            if (f.k === e.k || f.onX !== e.onX || f.sign !== -e.sign || Math.abs(f.c - e.c) > 1e-9)
                continue;
            spans = spans.flatMap(([a, b]): [number, number][] => {
                const [ca, cb] = [Math.max(a, f.from), Math.min(b, f.to)];
                if (cb <= ca) return [[a, b]];
                return [
                    [a, ca],
                    [cb, b],
                ].filter(([p, q]) => q - p > 1e-9) as [number, number][];
            });
        }
        const [x0, x1, z0, z1] = rects[e.k];
        const at = vec3((x0 + x1) / 2, y, (z0 + z1) / 2);
        const normal = e.onX ? vec3(e.sign, 0, 0) : vec3(0, 0, e.sign);
        const point = (t: number, h: number) => (e.onX ? vec3(e.c, h, t) : vec3(t, h, e.c));
        for (const [a, b] of spans) {
            const n = Math.max(1, Math.ceil((b - a) / TILE));
            for (let i = 0; i < n; i++) {
                const [p, q] = [a + ((b - a) * i) / n, a + ((b - a) * (i + 1)) / n];
                faces.push({
                    kind: "face",
                    points: [point(p, y), point(q, y), point(q, y - DECK_T), point(p, y - DECK_T)],
                    material: "deck",
                    normal,
                    group: { at, ahead: normal },
                });
            }
        }
    }
    return faces;
}

/**
 * One flight of stairs (or the ladder): from `foot` (the middle of its bottom step, on the lower level) going up
 * `rise` over `run` in direction `dir` (a unit vector across the ground), `width` wide.
 */
function flight(
    foot: Vector3,
    dir: Vector3,
    run: number,
    rise: number,
    width: number,
    ladder = false,
    /** A steel railing in place of timber, each side's rails turning at the top to reach a railing: where it is along
     * `across` on each side (the side `across` points from first). */
    steel?: [number, number],
): Piece[] {
    const across = vec3(dir.z, 0, -dir.x);
    const side = across.scale(width / 2);
    const head = foot.add(dir.scale(run)).add(vec3(0, rise, 0));
    const pieces: Piece[] = [];
    if (ladder)
        for (const s of [-1, 1])
            pieces.push(...rod(foot.add(side.scale(s)), head.add(side.scale(s)), 0.03, "rail"));
    else
        // A heavy stringer each side, the treads between them, and a railing above each stringer.
        for (const s of [-1, 1]) {
            const out = across.scale(s * (width / 2 + STRINGER_W / 2));
            const drop = vec3(0, -0.06, 0);
            pieces.push(
                ...timber(
                    foot.add(out).add(drop),
                    head.add(out).add(drop),
                    UP,
                    STRINGER_W,
                    STRINGER_D,
                    "rail",
                ),
            );
            const onTop = vec3(0, STRINGER_D / 2 - 0.06, 0);
            const [a, b] = [foot.add(out).add(onTop), head.add(out).add(onTop)];
            pieces.push(
                ...(steel
                    ? steelRailing(a, b, head.y, across, steel[s < 0 ? 0 : 1], s < 0)
                    : railing(a, b, across.scale(s), "ends")),
            );
        }
    const n = Math.round(rise / (ladder ? 0.28 : 0.22));
    for (let i = 1; i < n; i++) {
        const c = foot.lerp(head, i / n);
        if (ladder) pieces.push(...rod(c.sub(side), c.add(side), 0.016, "steel", 2));
        else {
            // A solid tread, its top at the step's height, so its front edge shows.
            const middle = c.add(dir.scale(TREAD.depth / 2)).add(vec3(0, -TREAD.t / 2, 0));
            pieces.push(
                ...timber(
                    middle.sub(side),
                    middle.add(side),
                    UP,
                    TREAD.depth,
                    TREAD.t,
                    "deck",
                    false,
                ),
            );
        }
    }
    return pieces;
}

/**
 * A stair's steel railing from `a` to `b` (along its stringer's top), to the deck at height `top`: a pipe post at its
 * foot, then a pipe handrail and a thin rail halfway down, up the stair until they're as high above the deck as above
 * the stair, where they turn level and run across to the railing beside the stair's head, at `reach` along `across`.
 */
function steelRailing(
    a: Vector3,
    b: Vector3,
    top: number,
    across: Vector3,
    reach: number,
    endPost: boolean,
): Piece[] {
    const lift = (h: number) => vec3(0, h, 0);
    const t = (top - a.y) / (b.y - a.y);
    const turn = a.lerp(b, t);
    const to = turn.add(across.scale(reach - turn.dot(across)));
    return [
        ...rod(a, a.add(lift(RAIL_HEIGHT)), PIPE_R, "steel"),
        // Where it reaches a timber railing, a post stands hard against it.
        ...(endPost
            ? rod(to.add(lift(-(to.y - top))), to.add(lift(RAIL_HEIGHT)), PIPE_R, "steel")
            : []),
        ...[
            [RAIL_HEIGHT, PIPE_R],
            [RAIL_HEIGHT / 2, 0.008],
        ].flatMap(([h, r]) => [
            ...rod(a.add(lift(h)), turn.add(lift(h)), r, "steel"),
            ...rod(turn.add(lift(h)), to.add(lift(h)), r, "steel"),
        ]),
    ];
}

const WEST = vec3(0, 0, 1);
const EAST = vec3(0, 0, -1);
const NORTH = vec3(1, 0, 0);

/**
 * The stairs, named by the direction a person faces going up: G to 1 is a ladder facing north beside the east side, 1
 * to 2 faces east beside the south side, 2 to 3 faces west beside the north side, and 3 to 4 faces west beside the south
 * side. Each opening runs back over its flight from where it comes out.
 */
const STAIR_WIDTH = 0.7;
const TREAD = { depth: 0.2, t: 0.04 };
const STRINGER_W = 0.06;
const STRINGER_D = 0.28;
/**
 * How far a flight's middle sits in from the side it runs beside: clear of the corner logs and the tower's railing by
 * a few centimetres, counting its stringer and the boards on the outside of its own railing.
 */
const STAIR_IN = LOG_R + STAIR_WIDTH / 2 + STRINGER_W / 2 + 0.045 + 0.03 + 0.05;
const LADDER_IN = LOG_R + 0.45 / 2 + 0.05;
const STAIRS = [
    { foot: vec3(2.4, LEVELS[0], LADDER_IN), dir: NORTH, run: 0.6, ladder: true },
    { foot: vec3(STAIR_IN, LEVELS[1], 3.3), dir: EAST, run: 2.0, ladder: false },
    { foot: vec3(SIDE - STAIR_IN, LEVELS[2], 1.2), dir: WEST, run: 2.0, ladder: false },
    { foot: vec3(STAIR_IN, LEVELS[3], 1.2), dir: WEST, run: 2.0, ladder: false },
];

const OPENINGS: Opening[] = STAIRS.map((s) => {
    const head = s.foot.add(s.dir.scale(s.run));
    const back = s.ladder ? 1.0 : s.run;
    const tail = head.sub(s.dir.scale(back));
    const half = STAIR_WIDTH / 2 + 0.15;
    const xs = [head.x, tail.x];
    const zs = [head.z, tail.z];
    return {
        x0: Math.min(...xs) - (s.dir.x === 0 ? half : 0),
        x1: Math.max(...xs) + (s.dir.x === 0 ? half : 0),
        z0: Math.min(...zs) - (s.dir.z === 0 ? half : 0),
        z1: Math.max(...zs) + (s.dir.z === 0 ? half : 0),
    };
});

/**
 * What's cut out of each deck from level 1 up, by the plan (x north, z west). Level 1's whole SE corner is open, from
 * the ladder's top south to the side and west to the foot of the stairs up to level 2. Level 2's stairwell runs on to
 * the west side, its SW corner open; level 3's runs on to the east side, its NE corner open. The top deck has just
 * the stairs' opening.
 */
const LADDER_TOP = STAIRS[0].foot.x + STAIRS[0].run;
const HOLES: Opening[] = [
    { x0: 0, x1: LADDER_TOP, z0: 0, z1: STAIRS[1].foot.z },
    { ...OPENINGS[1], x0: 0, z1: SIDE },
    { ...OPENINGS[2], z0: 0, x1: SIDE },
    OPENINGS[3],
];

/**
 * The railings round the cutouts, by the plan: each runs from the top of the stairs (or ladder) coming up to it, along
 * the cutout's edge, with its boards on the cutout's side. Level 1's runs west from the ladder's top, then south to
 * the stairs up to level 2.
 */
function cutoutRailings(): Piece[] {
    const free = LOG_R + 0.06;
    const ladderWest = STAIRS[0].foot.z + 0.45 / 2 + 0.08;
    const [l1, l2, l3] = HOLES;
    const stairNorth = STAIRS[1].foot.x + STAIR_WIDTH / 2 + STRINGER_W + 0.08;
    const y1 = LEVELS[1];
    return [
        ...railing(vec3(l1.x1, y1, ladderWest), vec3(l1.x1, y1, l1.z1), vec3(-1, 0, 0), "all"),
        ...railing(vec3(l1.x1, y1, l1.z1), vec3(stairNorth, y1, l1.z1), vec3(0, 0, -1), "all"),
        ...railing(
            vec3(l2.x1, LEVELS[2], STAIRS[1].foot.z - 2.0),
            vec3(l2.x1, LEVELS[2], SIDE - free),
            vec3(-1, 0, 0),
            "all",
        ),
        ...railing(
            vec3(l3.x0, LEVELS[3], STAIRS[2].foot.z + 2.0),
            vec3(l3.x0, LEVELS[3], free),
            vec3(1, 0, 0),
            "all",
        ),
    ];
}

/**
 * A stair railing's newel at each end: how wide it is (square), how far it stands above the top rail, and how far its
 * middle sits out towards the boards, so it covers both the rail's and the boards' ends.
 */
const NEWEL = { w: 0.16, above: 0.06, out: 0.03 };

/** The railings' sawn timbers: square posts, a deep top rail on them, and thin boards below it on the outside. */
const POST = 0.09;
const TOP_RAIL = { w: 0.09, h: 0.15 };
const BOARD = { w: 0.03, h: 0.1 };
const BOARD_HEIGHTS = [0.2, 0.42, 0.64];
/**
 * A side railing's boards: four, evenly spaced from just off the deck (the lowest is its kickboard) to under the top rail,
 * with the same gap between each and under the top rail.
 */
const SIDE_BOARDS = (() => {
    const [foot, under, n] = [0.01, RAIL_HEIGHT - TOP_RAIL.h, 4];
    const gap = (under - foot - n * BOARD.h) / n;
    return Array.from({ length: n }, (_, i) => foot + BOARD.h / 2 + i * (BOARD.h + gap));
})();
/** How far the top deck's railing stands out from the corner logs' middles: its boards just clear of the logs. */
const TOP_OUT = LOG_R + BOARD.w + POST / 2;
/** Where a steel post stands hard against the top deck's south railing, inside its boards (by the plan's x). */
const AGAINST_SOUTH = -TOP_OUT + POST / 2 + BOARD.w + PIPE_R;
/** How far in from the east side the top deck's east railing stands, its posts just inside the corner logs. */
const EAST_IN = LOG_R + POST / 2;

/**
 * A timber railing from `a` to `b` (where it stands, level for a deck or sloping up a stair), with `out` the side its
 * boards are on. A side's railing runs between the corner logs, so it has posts only `between` them; a stair's has a
 * post at each of its `ends` only; one standing free round a cutout in a deck has `all` of them.
 */
function railing(
    a: Vector3,
    b: Vector3,
    out: Vector3,
    posts: "between" | "ends" | "all" = "between",
    { inside = false }: { inside?: boolean } = {},
): Piece[] {
    const pieces: Piece[] = [];
    // Between corner logs, the rails stop at the logs' sides rather than running into them.
    if (posts === "between") {
        const inset = b
            .sub(a)
            .unit()
            .scale(LOG_R * 0.8);
        [a, b] = [a.add(inset), b.sub(inset)];
    }
    const lift = (h: number) => vec3(0, h, 0);
    // The railing sorts as one, from its middle; its boards in front of its posts from their side, its top rail on top.
    const middle = a.lerp(b, 0.5).add(lift(RAIL_HEIGHT / 2));
    const n = Math.max(1, Math.round(a.distanceTo(b) / 1.2));
    const at =
        posts === "ends"
            ? [0, n]
            : Array.from({ length: posts === "all" ? n + 1 : n - 1 }, (_, i) =>
                  posts === "all" ? i : i + 1,
              );
    for (const i of at) {
        const p = a.lerp(b, i / n);
        if (posts === "ends") {
            // A stair railing's end posts are newels: stouter, standing a little above the top rail with their tops
            // showing, and drawn over the rest of the railing so they hide its rails' ends.
            const centre = p.add(out.scale(NEWEL.out));
            pieces.push(
                ...timber(
                    centre,
                    centre.add(lift(RAIL_HEIGHT + NEWEL.above)),
                    out,
                    NEWEL.w,
                    NEWEL.w,
                    "rail",
                ).map((f) => ({ ...f, group: { at: middle, over: true } })),
            );
            continue;
        }
        // Its top is under the top rail and its foot on the deck, so only its sides show; but a corner post, where two
        // railings with their boards inside meet, rises flush with the top rails and its top shows.
        const corner = inside && posts === "all" && (i === 0 || i === n);
        const height = corner ? RAIL_HEIGHT : RAIL_HEIGHT - TOP_RAIL.h;
        pieces.push(
            ...timber(p, p.add(lift(height)), out, POST, POST, "rail", corner).map((f) => ({
                ...f,
                group: { at: middle, ...(corner && { over: true }) },
            })),
        );
    }
    const top = lift(RAIL_HEIGHT - TOP_RAIL.h / 2);
    // The rails' ends meet a log or a post, or are too small to matter, so they're left off.
    pieces.push(
        ...timber(a.add(top), b.add(top), UP, TOP_RAIL.w, TOP_RAIL.h, "rail", false).map((f) => ({
            ...f,
            group: { at: middle, ahead: UP },
        })),
    );
    // The boards are on the outside of the posts, or the inside (a side's railing); with posts at its ends too, the boards
    // inside stop at the end posts' inner faces, to meet the next side's.
    const toward = inside ? out.neg() : out;
    const face = toward.scale(POST / 2 + BOARD.w / 2);
    const trim =
        inside && posts === "all"
            ? b
                  .sub(a)
                  .unit()
                  .scale(POST / 2)
            : vec3(0, 0, 0);
    const board = (h: number, size: { w: number; h: number }) =>
        timber(
            a.add(trim).add(face).add(lift(h)),
            b.sub(trim).add(face).add(lift(h)),
            UP,
            size.w,
            size.h,
            "rail",
            false,
        ).map((f) => ({ ...f, group: { at: middle, ahead: toward } }));
    for (const h of inside ? SIDE_BOARDS : BOARD_HEIGHTS) pieces.push(...board(h, BOARD));
    return pieces;
}

/** Where board joints `spacing` apart cross a convex face, stepping across it along its `joints`, as pairs of points. */
export function plankLines(f: Face, spacing: number): [Vector3, Vector3][] {
    const dir = f.joints ?? UP;
    const hs = f.points.map((p) => p.dot(dir));
    const lines: [Vector3, Vector3][] = [];
    for (
        let h = Math.ceil(Math.min(...hs) / spacing + 1e-9) * spacing;
        h < Math.max(...hs) - 1e-9;
        h += spacing
    ) {
        const hits: Vector3[] = [];
        f.points.forEach((a, i) => {
            const j = (i + 1) % f.points.length;
            const [ha, hb] = [hs[i], hs[j]];
            if ((ha - h) * (hb - h) < 0) hits.push(a.lerp(f.points[j], (h - ha) / (hb - ha)));
        });
        if (hits.length === 2) lines.push([hits[0], hits[1]]);
    }
    return lines;
}

/** The tower, as pieces to draw. */
export function towerPieces(): Piece[] {
    return planPieces().map(toCompass);
}

/** A point in the plan, at its place by the compass. */
const pointToCompass = (p: Vector3) => vec3(SIDE - p.z, p.y, p.x);
/** A direction in the plan, turned to the compass. */
const dirToCompass = (v: Vector3) => vec3(-v.z, v.y, v.x);

function toCompass(p: Piece): Piece {
    const shell = p.shell && { ...p.shell, out: dirToCompass(p.shell.out) };
    const group = p.group && {
        at: pointToCompass(p.group.at),
        ahead: p.group.ahead && dirToCompass(p.group.ahead),
        over: p.group.over,
    };
    if (p.kind === "rod")
        return { ...p, a: pointToCompass(p.a), b: pointToCompass(p.b), shell, group };
    if (p.kind === "strand") return { ...p, points: p.points.map(pointToCompass), shell, group };
    return {
        ...p,
        points: p.points.map(pointToCompass),
        normal: p.normal && dirToCompass(p.normal),
        joints: p.joints && dirToCompass(p.joints),
        shell,
        group,
    };
}

/** The ground's height at a point by the compass: it falls about a metre from the east face to the west face. */
export const groundAt = (x: number) => planGround(SIDE - x);

/** The tower's pieces, laid out in the plan. */
function planPieces(): Piece[] {
    const pieces: Piece[] = [];
    const corners = [vec3(0, 0, 0), vec3(SIDE, 0, 0), vec3(SIDE, 0, SIDE), vec3(0, 0, SIDE)];
    const top = TOP + A_FRAME_FOOT;

    // Corner posts, ground to the A-frame legs' feet just above the top deck, cut at each level.
    for (const c of corners) {
        const heights = [planGround(c.z), ...LEVELS.slice(1), top];
        const diagonal = vec3(c.x - SIDE / 2, 0, c.z - SIDE / 2).unit();
        for (let i = 0; i + 1 < heights.length; i++)
            pieces.push(
                ...onShell(
                    rod(
                        vec3(c.x, heights[i], c.z),
                        vec3(c.x, heights[i + 1], c.z),
                        LOG_R,
                        "log",
                    ).map((p) => ({
                        ...p,
                        capA: i === 0 && p.capA,
                        capB: i === heights.length - 2 && p.capB,
                    })),
                    diagonal,
                    1,
                ),
            );
    }

    // Log beams round each level under its deck, from corner post to corner post, on their sides of the shell.
    for (const y of LEVELS.slice(1)) {
        // Their tops level with the deck, which sits on them.
        const by = y - LOG_R;
        const beam = (from: Vector3, to: Vector3, out: Vector3) =>
            onShell(
                rod(from, to, LOG_R, "log").map((r) => ({ ...r, capA: false, capB: false })),
                out,
                1,
            );
        pieces.push(...beam(vec3(0, by, 0), vec3(SIDE, by, 0), E_OUT));
        pieces.push(...beam(vec3(0, by, SIDE), vec3(SIDE, by, SIDE), W_OUT));
        pieces.push(...beam(vec3(0, by, 0), vec3(0, by, SIDE), S_OUT));
        pieces.push(...beam(vec3(SIDE, by, 0), vec3(SIDE, by, SIDE), N_OUT));
    }

    // Decks, with the stairs' openings and cutouts, and the railings round the cutouts.
    // The top deck runs out under its railing's boards, outside the corner logs.
    for (let i = 1; i < LEVELS.length; i++)
        pieces.push(...deck(LEVELS[i], HOLES[i - 1], LEVELS[i] === TOP ? TOP_OUT : DECK_OUT));
    pieces.push(...cutoutRailings());

    // Stairs.
    for (let i = 0; i < STAIRS.length; i++) {
        const s = STAIRS[i];
        pieces.push(
            ...flight(
                s.foot,
                s.dir,
                s.run,
                LEVELS[i + 1] - LEVELS[i],
                s.ladder ? 0.45 : STAIR_WIDTH,
                s.ladder,
                // The flight up to the top deck has a steel railing: its south side's turns to a post hard against the
                // tower's railing, and its north side's to the steel railing round the opening.
                i === STAIRS.length - 1 ? [AGAINST_SOUTH, OPENINGS[3].x1] : undefined,
            ),
        );
    }

    // The east face, boarded from the ground to the top deck: a layer of boards its thickness deep, outside and
    // inside, with their ends showing at each corner and their edge along the top.
    const planksAcross = 0.2;
    const across = vec3(SIDE + 2 * SKIN, 0, 0);
    const outside = vec3(-SKIN, 0, -SKIN - BOARD_T);
    const inside = vec3(-SKIN, 0, -SKIN);
    const east: Face[] = [];
    for (const at of [outside, inside])
        east.push(...panel(at, across, vec3(0, TOP, 0), "board", planksAcross));
    for (const x of [0, across.x])
        east.push(
            ...panel(
                outside.add(vec3(x, 0, 0)),
                vec3(0, 0, BOARD_T),
                vec3(0, TOP, 0),
                "board",
                planksAcross,
            ),
        );
    east.push(
        ...panel(outside.add(vec3(0, TOP, 0)), across, vec3(0, 0, BOARD_T), "board").map((f) => ({
            ...f,
            normal: vec3(0, 1, 0),
        })),
    );
    pieces.push(...onShell(east, E_OUT, 2));
    // The west face, boarded from its lower ground up to level 1.
    const westGround = planGround(SIDE);
    pieces.push(
        ...onShell(
            panel(
                vec3(-SKIN, westGround, SIDE + SKIN),
                vec3(SIDE + 2 * SKIN, 0, 0),
                vec3(0, LEVELS[1] - westGround, 0),
                "board",
                planksAcross,
            ),
            W_OUT,
            2,
        ),
    );
    // The ground floor's south and north sides, boarded (an assumption: the door suggests the ground floor is closed in).
    // The south side's doorway, beside the south-east corner, is left open: the boarding stops above it.
    const DOOR = { z0: 0.3, z1: 1.1, height: 1.9 };
    for (const x of [-SKIN, SIDE + SKIN]) {
        const strips = 6;
        const edges = Array.from({ length: strips + 1 }, (_, i) => (SIDE * i) / strips);
        if (x < 0) edges.push(DOOR.z0, DOOR.z1);
        edges.sort((a, b) => a - b);
        for (let i = 0; i + 1 < edges.length; i++) {
            const [z0, z1] = [edges[i], edges[i + 1]];
            if (z1 - z0 < 1e-9) continue;
            const doorway = x < 0 && z0 >= DOOR.z0 && z1 <= DOOR.z1;
            const foot = (z: number) => planGround(z) + (doorway ? DOOR.height : 0);
            pieces.push({
                kind: "face",
                points: [
                    vec3(x, foot(z0), z0),
                    vec3(x, foot(z1), z1),
                    vec3(x, LEVELS[1], z1),
                    vec3(x, LEVELS[1], z0),
                ],
                material: "board",
                planks: planksAcross,
                shell: { out: x < 0 ? S_OUT : N_OUT, layer: 2 },
            });
        }
    }

    // Railings round the levels' open sides, north, south and west, between the corner logs, with their boards inside
    // the posts.
    const side = { inside: true };
    for (const y of LEVELS.slice(1, 4)) {
        pieces.push(
            ...onShell(railing(vec3(0, y, 0), vec3(0, y, SIDE), S_OUT, "between", side), S_OUT, 1),
        );
        pieces.push(
            ...onShell(
                railing(vec3(SIDE, y, 0), vec3(SIDE, y, SIDE), N_OUT, "between", side),
                N_OUT,
                1,
            ),
        );
        pieces.push(
            ...onShell(
                railing(vec3(0, y, SIDE), vec3(SIDE, y, SIDE), W_OUT, "between", side),
                W_OUT,
                1,
            ),
        );
    }
    // The top deck's railing runs round its north, south and west sides outside the corner logs, which stop just above
    // it, and across its east side inside them, leaving a ledge of deck outside; with a post of its own at each corner.
    const [lo, hi] = [-TOP_OUT, SIDE + TOP_OUT];
    const round: [Vector3, Vector3, Vector3][] = [
        [vec3(lo, TOP, EAST_IN), vec3(lo, TOP, hi), S_OUT],
        [vec3(hi, TOP, EAST_IN), vec3(hi, TOP, hi), N_OUT],
        [vec3(lo, TOP, hi), vec3(hi, TOP, hi), W_OUT],
        [vec3(lo, TOP, EAST_IN), vec3(hi, TOP, EAST_IN), E_OUT],
    ];
    for (const [a, b, out] of round)
        pieces.push(...onShell(railing(a, b, out, "all", side), out, 2));

    // The steel railing round the stairs' opening on the top deck, open at its west end where the stairs come out.
    const o = OPENINGS[3];
    // Pipe rails at the top and halfway up, with thin ones between them and below.
    for (const [h, r] of [
        [0.25, 0.008],
        [0.5, PIPE_R],
        [0.75, 0.008],
        [RAIL_HEIGHT, PIPE_R],
    ]) {
        const up = (x: number, z: number) => vec3(x, TOP + h, z);
        pieces.push(...rod(up(o.x1, o.z0), up(o.x1, o.z1), r, "steel"));
        pieces.push(...rod(up(AGAINST_SOUTH, o.z0), up(o.x1, o.z0), r, "steel"));
    }
    // A post at each corner (its south-east one hard against the tower's railing), at the open end, and halfway along
    // its east–west side.
    for (const [x, z] of [
        [o.x1, o.z0],
        [o.x1, (o.z0 + o.z1) / 2],
        [o.x1, o.z1],
        [AGAINST_SOUTH, o.z0],
    ])
        pieces.push(...rod(vec3(x, TOP, z), vec3(x, TOP + RAIL_HEIGHT, z), PIPE_R, "steel"));

    // The overhead beam: two logs, one on the other, north–south across the middle of the top deck on an A-frame at
    // each end, the top one running a metre past each side. Four steel rods 1 m apart run down through both, standing 0.25 m above.
    const beamY = OVERHEAD.lowerY;
    const upperY = OVERHEAD.upperY;
    const mid = SIDE / 2;
    // Only the top log runs past the sides; the lower one stops at the A-frames.
    // Each log is cut at the rods, so each space is one length, its middle where its slings are: then a sling sorts
    // against the log it wraps rather than against a length off to one side.
    const through = (y: number, xs: number[]) =>
        xs.slice(1).flatMap((x, i) =>
            rod(vec3(xs[i], y, mid), vec3(x, y, mid), LOG_R, "log", 2).map((r) => ({
                ...r,
                capA: i === 0,
                capB: i === xs.length - 2,
            })),
        );
    pieces.push(...through(beamY, [0, ...OVERHEAD.rods, SIDE]));
    pieces.push(...through(upperY, [-1, 0, ...OVERHEAD.rods, SIDE, SIDE + 1]));
    // The plan's x is north, as the compass's z is.
    for (const x of OVERHEAD.rods) {
        pieces.push(
            ...rod(
                vec3(x, beamY - LOG_R - 0.03, mid),
                vec3(x, upperY + LOG_R + 0.25, mid),
                0.012,
                "steel",
            ),
        );
    }
    for (const x of [0, SIDE])
        for (const z of [0, SIDE])
            pieces.push(
                ...rod(
                    vec3(x, TOP + A_FRAME_FOOT, z),
                    vec3(x, beamY - LOG_R, mid),
                    LOG_R * 0.9,
                    "log",
                ),
            );

    // The west outrigger: a log the width of the west side, a metre out, level with the top deck's beams. The top
    // deck's south and north beams run on out and butt into it; there's no other bracing.
    const outY = WEST_EDGE.outrigger.y;
    const out = SIDE + OUTRIGGER;
    const outrigger: Rod[] = [];
    for (const x of [0, SIDE])
        outrigger.push(
            ...rod(vec3(x, outY, SIDE), vec3(x, outY, out - LOG_R), LOG_R, "log").map((r) => ({
                ...r,
                capA: false,
                capB: false,
            })),
        );
    outrigger.push(...rod(vec3(-0.15, outY, out), vec3(SIDE + 0.15, outY, out), LOG_R, "log"));
    pieces.push(...onShell(outrigger, W_OUT, 3));

    return pieces;
}

/**
 * The overhead beam, by the compass: it runs north–south at `x`, its lower log's middle at `lowerY` and its upper's at
 * `upperY`, both of radius `r`. The lower log runs the tower's width (z from 0 to `SIDE`), and the steel rods through
 * both stand at the `rods` z's, dividing it into five spaces numbered from the south. They're set out symmetrically:
 * the end spaces the same as the next ones in, and the middle space twice as wide.
 */
export const OVERHEAD = {
    x: SIDE / 2,
    lowerY: TOP + 2.3,
    upperY: TOP + 2.3 + 2 * LOG_R,
    r: LOG_R,
    rods: [-2, -1, 1, 2].map((k) => SIDE / 2 + (k * SIDE) / 6),
};

/** Where a space on the overhead beam runs, from the south: z from `z0` to `z1`. Spaces are numbered 1 to 5. */
export function overheadSpace(n: number): { z0: number; z1: number } {
    const bounds = [0, ...OVERHEAD.rods, SIDE];
    return { z0: bounds[n - 1], z1: bounds[n] };
}

/** The east side's edges a rope going over it rests on, by the compass: the top rail's top outer corner, then the top
 * outer corner of the east face's boarding below it. */
/**
 * The top deck's stair opening by the compass (x from `x0` to `x1`, z from `z0` to `z1`). The steel railing runs along
 * its north and east sides; the tower's south railing is on its south, and it's open to the west where the stairs come
 * out.
 */
export function topOpening(): { x0: number; x1: number; z0: number; z1: number } {
    const o = OPENINGS[3];
    const [a, b] = [pointToCompass(vec3(o.x0, 0, o.z0)), pointToCompass(vec3(o.x1, 0, o.z1))];
    return {
        x0: Math.min(a.x, b.x),
        x1: Math.max(a.x, b.x),
        z0: Math.min(a.z, b.z),
        z1: Math.max(a.z, b.z),
    };
}

/**
 * The west side's edges a rope going over it rests on, by the compass: the top rail's top outer corner, then the
 * outrigger log a metre out (its middle and radius). A rope dropping straight down the side instead hangs at `clear`,
 * just outside the level beams and the boarding from the ground to level 1.
 */
export const WEST_EDGE = {
    rail: { x: -TOP_OUT - TOP_RAIL.w / 2, y: TOP + RAIL_HEIGHT },
    outrigger: { x: -OUTRIGGER, y: TOP - LOG_R, r: LOG_R },
    clear: { x: -Math.max(SKIN + BOARD_T, TOP_OUT + TOP_RAIL.w / 2), y: TOP },
};

export const EAST_EDGE = {
    rail: { x: SIDE - EAST_IN + TOP_RAIL.w / 2, y: TOP + RAIL_HEIGHT },
    /** Where a rope leaves the side to hang down it, past the ledge outside the railing: the boarding's top edge or the
     * deck's, whichever's further out. */
    boarding: { x: SIDE + Math.max(SKIN + BOARD_T, TOP_OUT), y: TOP },
    /** The inside face of the top deck's east railing (its boards). */
    inside: SIDE - EAST_IN - POST / 2 - BOARD.w,
};

/**
 * One of a flight's two stringers, by the compass: the middles of its ends (`a` at the foot), and its width across and
 * depth. Flight 4 is the stairs up to level 4.
 */
export function stringer(
    flight: 1 | 2 | 3 | 4,
    side: "north" | "south",
): { a: Vector3; b: Vector3; w: number; h: number } {
    const s = STAIRS[flight - 1];
    const across = vec3(s.dir.z, 0, -s.dir.x);
    const head = s.foot
        .add(s.dir.scale(s.run))
        .add(vec3(0, LEVELS[flight] - LEVELS[flight - 1], 0));
    const drop = vec3(0, -0.06, 0);
    const [p, q] = [-1, 1].map((k) => {
        const out = across.scale(k * (STAIR_WIDTH / 2 + STRINGER_W / 2)).add(drop);
        return { a: pointToCompass(s.foot.add(out)), b: pointToCompass(head.add(out)) };
    });
    const north = p.a.z > q.a.z ? p : q;
    return { ...(side === "north" ? north : north === p ? q : p), w: STRINGER_W, h: STRINGER_D };
}

/** The ground round the tower, by the compass: a slope falling to the west, as one face. */
export const groundCorners = () => {
    const [x0, x1, z0, z1] = [-3, SIDE + 2.5, -2.5, SIDE + 2.5];
    return [
        vec3(x0, groundAt(x0), z0),
        vec3(x1, groundAt(x1), z0),
        vec3(x1, groundAt(x1), z1),
        vec3(x0, groundAt(x0), z1),
    ];
};

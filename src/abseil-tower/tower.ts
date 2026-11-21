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
    | "door"
    | "sling"
    | "rope"
    | "bucket";

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
    normal?: Vector3;
    /** Its colour, where it isn't its material's. */
    color?: string;
};

/**
 * Where a piece is in the tower's shell, for the back-to-front sort: `layer` 1 is on one of its sides (railings, beams,
 * corner posts), 2 the boarding outside that, and 3 what sticks out past it (log ends, the door, the outrigger), with
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
};

export type Piece = (Rod | Face | Strand) & { shell?: Shell };

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

const LOG_R = 0.125;
const PIPE_R = 0.022;
const RAIL_HEIGHT = 1.0;
/** The boarding sits on the outside of the posts, and the east face's is this thick. */
const SKIN = LOG_R + 0.02;
/** How far the outrigger stands out from the west side. */
const OUTRIGGER = 1.0;
const BOARD_T = 0.05;
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
 * its six sides.
 */
function timber(
    a: Vector3,
    b: Vector3,
    up: Vector3,
    w: number,
    h: number,
    material: Material,
): Face[] {
    const along = b.sub(a).unit();
    const v = up
        .sub(along.scale(up.dot(along)))
        .unit()
        .scale(h / 2);
    const s = along
        .cross(v)
        .unit()
        .scale(w / 2);
    const corner = (p: Vector3, i: number, j: number) => p.add(s.scale(i)).add(v.scale(j));
    const ring = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
    ];
    const sides: Face[] = ring.map(([i, j], k) => {
        const [i2, j2] = ring[(k + 1) % 4];
        const normal = s
            .scale(i + i2)
            .add(v.scale(j + j2))
            .unit();
        return {
            kind: "face",
            points: [corner(a, i, j), corner(b, i, j), corner(b, i2, j2), corner(a, i2, j2)],
            material,
            normal,
        };
    });
    const ends: Face[] = [
        {
            kind: "face",
            points: ring.map(([i, j]) => corner(a, i, j)),
            material,
            normal: along.neg(),
        },
        { kind: "face", points: ring.map(([i, j]) => corner(b, i, j)), material, normal: along },
    ];
    return [...sides, ...ends];
}

const UP = vec3(0, 1, 0);

/** A parallelogram from `origin` along `u` and `v`, cut into tiles no bigger than `TILE` each way. */
function panel(
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

/** A level rectangle at height `y`, x from x0 to x1 and z from z0 to z1. */
const deckRect = (x0: number, x1: number, z0: number, z1: number, y: number) =>
    panel(vec3(x0, y, z0), vec3(x1 - x0, 0, 0), vec3(0, 0, z1 - z0), "deck");

/** A stair opening in a deck: x from x0 to x1, z from z0 to z1. */
type Opening = { x0: number; x1: number; z0: number; z1: number };

/** A deck over the whole tower, with a hole for the stairs coming up through it. */
function deck(y: number, hole: Opening | null): Face[] {
    if (!hole) return deckRect(0, SIDE, 0, SIDE, y);
    const { x0, x1, z0, z1 } = hole;
    return [
        ...(z0 > 0 ? deckRect(0, SIDE, 0, z0, y) : []),
        ...(z1 < SIDE ? deckRect(0, SIDE, z1, SIDE, y) : []),
        ...(x0 > 0 ? deckRect(0, x0, z0, z1, y) : []),
        ...(x1 < SIDE ? deckRect(x1, SIDE, z0, z1, y) : []),
    ];
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
            pieces.push(
                ...railing(
                    foot.add(out).add(onTop),
                    head.add(out).add(onTop),
                    across.scale(s),
                    true,
                ),
            );
        }
    const n = Math.round(rise / (ladder ? 0.28 : 0.22));
    for (let i = 1; i < n; i++) {
        const c = foot.lerp(head, i / n);
        if (ladder) pieces.push(...rod(c.sub(side), c.add(side), 0.016, "steel", 2));
        else {
            const depth = dir.scale(0.2);
            pieces.push({
                kind: "face",
                points: [c.sub(side), c.add(side), c.add(side).add(depth), c.sub(side).add(depth)],
                material: "deck",
            });
        }
    }
    return pieces;
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
const STRINGER_W = 0.06;
const STRINGER_D = 0.28;
/**
 * How far a flight's middle sits in from the side it runs beside: clear of the corner logs and the tower's railing by
 * a few centimetres, counting its stringer and the boards on the outside of its own railing.
 */
const STAIR_IN = LOG_R + STAIR_WIDTH / 2 + STRINGER_W / 2 + 0.045 + 0.03 + 0.05;
const LADDER_IN = LOG_R + 0.45 / 2 + 0.05;
const STAIRS = [
    { foot: vec3(1.4, LEVELS[0], LADDER_IN), dir: NORTH, run: 0.6, ladder: true },
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

/** The railings' sawn timbers: square posts, a deep top rail on them, and thin boards below it on the outside. */
const POST = 0.09;
const TOP_RAIL = { w: 0.09, h: 0.15 };
const BOARD = { w: 0.03, h: 0.1 };
const BOARD_HEIGHTS = [0.2, 0.42, 0.64];

/**
 * A timber railing from `a` to `b` (where it stands, level for a deck or sloping up a stair), with `out` the side its
 * boards are on. A deck's railing runs between the corner logs, so it has posts only between them; a stair's has its
 * own `endPosts`.
 */
function railing(a: Vector3, b: Vector3, out: Vector3, endPosts = false): Piece[] {
    const pieces: Piece[] = [];
    // Between corner logs, the rails stop at the logs' sides rather than running into them.
    if (!endPosts) {
        const inset = b
            .sub(a)
            .unit()
            .scale(LOG_R * 0.8);
        [a, b] = [a.add(inset), b.sub(inset)];
    }
    const lift = (h: number) => vec3(0, h, 0);
    const n = Math.max(1, Math.round(a.distanceTo(b) / 1.2));
    for (let i = endPosts ? 0 : 1; i <= (endPosts ? n : n - 1); i++) {
        const p = a.lerp(b, i / n);
        pieces.push(...timber(p, p.add(lift(RAIL_HEIGHT - TOP_RAIL.h)), out, POST, POST, "rail"));
    }
    const top = lift(RAIL_HEIGHT - TOP_RAIL.h / 2);
    pieces.push(...timber(a.add(top), b.add(top), UP, TOP_RAIL.w, TOP_RAIL.h, "rail"));
    const face = out.scale(POST / 2 + BOARD.w / 2);
    for (const h of BOARD_HEIGHTS)
        pieces.push(
            ...timber(
                a.add(face).add(lift(h)),
                b.add(face).add(lift(h)),
                UP,
                BOARD.w,
                BOARD.h,
                "rail",
            ),
        );
    return pieces;
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
    if (p.kind === "rod") return { ...p, a: pointToCompass(p.a), b: pointToCompass(p.b), shell };
    if (p.kind === "strand") return { ...p, points: p.points.map(pointToCompass), shell };
    return {
        ...p,
        points: p.points.map(pointToCompass),
        normal: p.normal && dirToCompass(p.normal),
        shell,
    };
}

/** The ground's height at a point by the compass: it falls about a metre from the east face to the west face. */
export const groundAt = (x: number) => planGround(SIDE - x);

/** The tower's pieces, laid out in the plan. */
function planPieces(): Piece[] {
    const pieces: Piece[] = [];
    const corners = [vec3(0, 0, 0), vec3(SIDE, 0, 0), vec3(SIDE, 0, SIDE), vec3(0, 0, SIDE)];
    const top = TOP + RAIL_HEIGHT;

    // Corner posts, ground to the top railing, cut at each level.
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
        const by = y - LOG_R - 0.03;
        const beam = (from: Vector3, to: Vector3, out: Vector3) =>
            onShell(
                rod(from, to, LOG_R, "log").map((r) => ({ ...r, capA: false, capB: false })),
                out,
                1,
            );
        pieces.push(...beam(vec3(0, by, 0), vec3(SIDE, by, 0), E_OUT));
        pieces.push(...beam(vec3(0, by, SIDE), vec3(SIDE, by, SIDE), W_OUT));
        pieces.push(...beam(vec3(0, by - 0.05, 0), vec3(0, by - 0.05, SIDE), S_OUT));
        pieces.push(...beam(vec3(SIDE, by - 0.05, 0), vec3(SIDE, by - 0.05, SIDE), N_OUT));
    }

    // Decks, with the stairs' openings.
    for (let i = 1; i < LEVELS.length; i++) pieces.push(...deck(LEVELS[i], OPENINGS[i - 1]));

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
    for (const x of [-SKIN, SIDE + SKIN]) {
        const strips = 6;
        for (let i = 0; i < strips; i++) {
            const z0 = (SIDE * i) / strips;
            const z1 = (SIDE * (i + 1)) / strips;
            pieces.push({
                kind: "face",
                points: [
                    vec3(x, planGround(z0), z0),
                    vec3(x, planGround(z1), z1),
                    vec3(x, LEVELS[1], z1),
                    vec3(x, LEVELS[1], z0),
                ],
                material: "board",
                planks: planksAcross,
                shell: { out: x < 0 ? S_OUT : N_OUT, layer: 2 },
            });
        }
    }
    // The door, on the south side beside the south-east corner.
    pieces.push({
        kind: "face",
        points: [
            vec3(-SKIN - 0.01, 0, 0.3),
            vec3(-SKIN - 0.01, 0, 1.1),
            vec3(-SKIN - 0.01, 1.9, 1.1),
            vec3(-SKIN - 0.01, 1.9, 0.3),
        ].map((p) => vec3(p.x, p.y + planGround(p.z), p.z)),
        material: "door",
        shell: { out: S_OUT, layer: 3 },
    });

    // Railings round every level's open sides: north, south and west on every level, and east on the top deck.
    for (const y of LEVELS.slice(1)) {
        pieces.push(...onShell(railing(vec3(0, y, 0), vec3(0, y, SIDE), S_OUT), S_OUT, 1));
        pieces.push(...onShell(railing(vec3(SIDE, y, 0), vec3(SIDE, y, SIDE), N_OUT), N_OUT, 1));
        pieces.push(...onShell(railing(vec3(0, y, SIDE), vec3(SIDE, y, SIDE), W_OUT), W_OUT, 1));
        // The east face's boarding stops at the top deck, so only there does it need a railing.
        if (y === TOP)
            pieces.push(...onShell(railing(vec3(0, y, 0), vec3(SIDE, y, 0), E_OUT), E_OUT, 1));
    }

    // The steel railing round the stairs' opening on the top deck, open at its west end where the stairs come out.
    const o = OPENINGS[3];
    for (const h of [0.5, RAIL_HEIGHT]) {
        const up = (x: number, z: number) => vec3(x, TOP + h, z);
        pieces.push(...rod(up(o.x1, o.z0), up(o.x1, o.z1), PIPE_R, "steel"));
        pieces.push(...rod(up(o.x0, o.z0), up(o.x1, o.z0), PIPE_R, "steel"));
    }
    for (const [x, z] of [
        [o.x1, o.z0],
        [o.x1, o.z1],
        [o.x0 + 0.1, o.z0],
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
                ...rod(vec3(x, TOP + 0.2, z), vec3(x, beamY - LOG_R, mid), LOG_R * 0.9, "log"),
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
 * both stand at the `rods` z's, dividing it into five spaces numbered from the south.
 */
export const OVERHEAD = {
    x: SIDE / 2,
    lowerY: TOP + 2.3,
    upperY: TOP + 2.3 + 2 * LOG_R,
    r: LOG_R,
    rods: [-1.5, -0.5, 0.5, 1.5].map((k) => SIDE / 2 + k),
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
 * outrigger log a metre out (its middle and radius).
 */
export const WEST_EDGE = {
    rail: { x: -TOP_RAIL.w / 2, y: TOP + RAIL_HEIGHT },
    outrigger: { x: -OUTRIGGER, y: TOP - LOG_R - 0.08, r: LOG_R },
};

export const EAST_EDGE = {
    rail: { x: SIDE + TOP_RAIL.w / 2, y: TOP + RAIL_HEIGHT },
    boarding: { x: SIDE + SKIN + BOARD_T, y: TOP },
};

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

import { vec3, type Vector3 } from "@/lib/vector3";

/**
 * The abseil tower, as described from memory and a few photos: every size here is an estimate. Scene coordinates are
 * metres with x east, y up and z north, the origin at the tower's south-west corner post on the ground.
 */

/** What a piece is made of, which sets its colour. */
export type Material = "log" | "rail" | "board" | "deck" | "steel" | "door";

/** A round piece (a log, a rail or a pipe): a cylinder from `a` to `b`, drawn with a rounded end where `capA`/`capB`. */
export type Rod = {
    kind: "rod";
    a: Vector3;
    b: Vector3;
    r: number;
    material: Material;
    capA: boolean;
    capB: boolean;
};

/** A flat piece (a deck, boarding, a tread): a convex polygon, with level board joints `planks` apart if it has them. */
export type Face = {
    kind: "face";
    points: Vector3[];
    material: Material;
    planks?: number;
};

export type Piece = Rod | Face;

export const SIDE = 4.5;
/** The height of each level's deck above the ground at the south face. Level 0 is the ground. */
export const LEVELS = [0, 2.0, 4.5, 7.0, 9.5];
export const TOP = LEVELS[4];
/** The ground falls about a metre from the south face to the north face, towards the river. */
const FALL = 1.0;
export const groundAt = (z: number) => (-FALL * z) / SIDE;

const LOG_R = 0.125;
const RAIL_R = 0.035;
const PIPE_R = 0.022;
const RAIL_HEIGHT = 1.0;
/** How far log beams run past the corners. */
const OVERHANG = 0.35;
/** The boarding sits on the outside of the posts. */
const SKIN = LOG_R + 0.02;
/** Long pieces are cut into lengths no longer than this, so the back-to-front sort can put each in its place. */
const PIECE = 0.6;
const TILE = 1.2;

/** A rod cut into short lengths, rounded only at its two real ends. */
function rod(a: Vector3, b: Vector3, r: number, material: Material, maxPiece = PIECE): Rod[] {
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
    const side = vec3(dir.z, 0, -dir.x).scale(width / 2);
    const head = foot.add(dir.scale(run)).add(vec3(0, rise, 0));
    const pieces: Piece[] = [-1, 1].flatMap((s) =>
        rod(foot.add(side.scale(s)), head.add(side.scale(s)), ladder ? 0.03 : 0.04, "rail"),
    );
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

const NORTH = vec3(0, 0, 1);
const SOUTH = vec3(0, 0, -1);
const EAST = vec3(1, 0, 0);

/**
 * The stairs, named by the direction a person faces going up: G to 1 is a ladder facing east beside the south side, 1
 * to 2 faces south beside the west side, 2 to 3 faces north beside the east side, and 3 to 4 faces north beside the west
 * side. Each opening runs back over its flight from where it comes out.
 */
const STAIR_WIDTH = 0.7;
const STAIRS = [
    { foot: vec3(1.4, LEVELS[0], 0.55), dir: EAST, run: 0.6, ladder: true },
    { foot: vec3(0.55, LEVELS[1], 3.3), dir: SOUTH, run: 2.0, ladder: false },
    { foot: vec3(3.95, LEVELS[2], 1.2), dir: NORTH, run: 2.0, ladder: false },
    { foot: vec3(0.55, LEVELS[3], 1.2), dir: NORTH, run: 2.0, ladder: false },
];

export const OPENINGS: Opening[] = STAIRS.map((s) => {
    const head = s.foot.add(s.dir.scale(s.run));
    const back = s.ladder ? 1.0 : s.run;
    const tail = head.sub(s.dir.scale(back));
    const half = STAIR_WIDTH / 2 + 0.05;
    const xs = [head.x, tail.x];
    const zs = [head.z, tail.z];
    return {
        x0: Math.min(...xs) - (s.dir.x === 0 ? half : 0),
        x1: Math.max(...xs) + (s.dir.x === 0 ? half : 0),
        z0: Math.min(...zs) - (s.dir.z === 0 ? half : 0),
        z1: Math.max(...zs) + (s.dir.z === 0 ? half : 0),
    };
});

/** A timber railing from `a` to `b` (both at deck height): three rails, with posts between. */
function railing(a: Vector3, b: Vector3): Piece[] {
    const pieces: Piece[] = [];
    for (const h of [0.35, 0.65, RAIL_HEIGHT]) {
        const up = vec3(0, h, 0);
        pieces.push(...rod(a.add(up), b.add(up), RAIL_R, "rail"));
    }
    const posts = Math.max(1, Math.round(a.distanceTo(b) / 1.2));
    for (let i = 1; i < posts; i++) {
        const p = a.lerp(b, i / posts);
        pieces.push(...rod(p, p.add(vec3(0, RAIL_HEIGHT, 0)), 0.045, "rail"));
    }
    return pieces;
}

/** The tower, as pieces to draw. */
export function towerPieces(): Piece[] {
    const pieces: Piece[] = [];
    const corners = [vec3(0, 0, 0), vec3(SIDE, 0, 0), vec3(SIDE, 0, SIDE), vec3(0, 0, SIDE)];
    const top = TOP + RAIL_HEIGHT;

    // Corner posts, ground to the top railing, cut at each level.
    for (const c of corners) {
        const heights = [groundAt(c.z), ...LEVELS.slice(1), top];
        for (let i = 0; i + 1 < heights.length; i++)
            pieces.push(
                ...rod(
                    vec3(c.x, heights[i], c.z),
                    vec3(c.x, heights[i + 1], c.z),
                    LOG_R,
                    "log",
                ).map((p) => ({
                    ...p,
                    capA: i === 0 && p.capA,
                    capB: i === heights.length - 2 && p.capB,
                })),
            );
    }

    // Log beams round each level under its deck, their ends past the corners.
    for (const y of LEVELS.slice(1)) {
        const by = y - LOG_R - 0.03;
        for (const z of [0, SIDE])
            pieces.push(...rod(vec3(-OVERHANG, by, z), vec3(SIDE + OVERHANG, by, z), LOG_R, "log"));
        for (const x of [0, SIDE])
            pieces.push(
                ...rod(
                    vec3(x, by - 0.05, -OVERHANG),
                    vec3(x, by - 0.05, SIDE + OVERHANG),
                    LOG_R,
                    "log",
                ),
            );
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

    // The south face, boarded from the ground to the top deck.
    const planksAcross = 0.2;
    pieces.push(
        ...panel(
            vec3(-SKIN, 0, -SKIN),
            vec3(SIDE + 2 * SKIN, 0, 0),
            vec3(0, TOP, 0),
            "board",
            planksAcross,
        ),
    );
    // The north face, boarded from its lower ground up to level 1.
    const northGround = groundAt(SIDE);
    pieces.push(
        ...panel(
            vec3(-SKIN, northGround, SIDE + SKIN),
            vec3(SIDE + 2 * SKIN, 0, 0),
            vec3(0, LEVELS[1] - northGround, 0),
            "board",
            planksAcross,
        ),
    );
    // The ground floor's west and east sides, boarded (an assumption: the door suggests the ground floor is closed in).
    for (const x of [-SKIN, SIDE + SKIN]) {
        const strips = 6;
        for (let i = 0; i < strips; i++) {
            const z0 = (SIDE * i) / strips;
            const z1 = (SIDE * (i + 1)) / strips;
            pieces.push({
                kind: "face",
                points: [
                    vec3(x, groundAt(z0), z0),
                    vec3(x, groundAt(z1), z1),
                    vec3(x, LEVELS[1], z1),
                    vec3(x, LEVELS[1], z0),
                ],
                material: "board",
                planks: planksAcross,
            });
        }
    }
    // The door, on the west side beside the south-west corner.
    pieces.push({
        kind: "face",
        points: [
            vec3(-SKIN - 0.01, 0, 0.3),
            vec3(-SKIN - 0.01, 0, 1.1),
            vec3(-SKIN - 0.01, 1.9, 1.1),
            vec3(-SKIN - 0.01, 1.9, 0.3),
        ].map((p) => vec3(p.x, p.y + groundAt(p.z), p.z)),
        material: "door",
    });

    // Railings round every level's open sides: east, west and north on every level, and south on the top deck.
    for (const y of LEVELS.slice(1)) {
        pieces.push(...railing(vec3(0, y, 0), vec3(0, y, SIDE)));
        pieces.push(...railing(vec3(SIDE, y, 0), vec3(SIDE, y, SIDE)));
        pieces.push(...railing(vec3(0, y, SIDE), vec3(SIDE, y, SIDE)));
        // The south face's boarding stops at the top deck, so only there does it need a railing.
        if (y === TOP) pieces.push(...railing(vec3(0, y, 0), vec3(SIDE, y, 0)));
    }

    // The steel railing round the stairs' opening on the top deck, open at its north end where the stairs come out.
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

    // The overhead log: east–west across the middle of the top deck, a metre past each side, on an A-frame at each end.
    const beamY = TOP + 2.3;
    const mid = SIDE / 2;
    pieces.push(...rod(vec3(-1, beamY, mid), vec3(SIDE + 1, beamY, mid), LOG_R, "log"));
    for (const x of [0, SIDE])
        for (const z of [0, SIDE])
            pieces.push(
                ...rod(vec3(x, TOP + 0.2, z), vec3(x, beamY - LOG_R, mid), LOG_R * 0.9, "log"),
            );

    // The north outrigger: a log the width of the north side, a metre out at the top deck's height, on two arms.
    const armY = TOP - 0.1;
    const out = SIDE + 1.0;
    for (const x of [0, SIDE]) {
        pieces.push(...rod(vec3(x, armY, SIDE), vec3(x, armY, out + 0.15), LOG_R, "log"));
        pieces.push(
            ...rod(vec3(x, TOP - 1.6, SIDE), vec3(x, armY - LOG_R, out - 0.1), LOG_R * 0.8, "log"),
        );
    }
    pieces.push(
        ...rod(
            vec3(-0.3, armY + 2 * LOG_R, out),
            vec3(SIDE + 0.3, armY + 2 * LOG_R, out),
            LOG_R,
            "log",
        ),
    );

    return pieces;
}

/** The ground round the tower: a slope falling to the north, as one face. */
export const GROUND_EXTENT = { x0: -2.5, x1: SIDE + 2.5, z0: -2.5, z1: SIDE + 3 };
export const groundCorners = () => {
    const { x0, x1, z0, z1 } = GROUND_EXTENT;
    return [
        vec3(x0, groundAt(z0), z0),
        vec3(x1, groundAt(z0), z0),
        vec3(x1, groundAt(z1), z1),
        vec3(x0, groundAt(z1), z1),
    ];
};

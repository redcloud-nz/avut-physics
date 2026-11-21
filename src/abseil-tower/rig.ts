import { clamp } from "@/lib/math";
import { vec2, type Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import { basket, stackedLogs } from "./basket";
import {
    EAST_EDGE,
    groundAt,
    LEVELS,
    LOG_R,
    OVERHEAD,
    overheadSpace,
    SIDE,
    stringer,
    TOP,
    topOpening,
    WEST_EDGE,
    type Face,
    type Material,
    type Piece,
} from "./tower";

/**
 * A rig on the tower, as a list of items in the order they're put up. A sling on the overhead beam sits a measured
 * distance along it from its south end, and a rope hangs from what it's tied to.
 */

/** The colours rigging comes in. */
export type RigColor =
    | "yellow"
    | "blue"
    | "red"
    | "orange"
    | "green"
    | "dark-green"
    | "dark-red"
    | "purple"
    | "black"
    | "white"
    | "maroon"
    | "dark-blue";

/**
 * A sling round the overhead beam, both its ends clipped to one carabiner (a basket). `length` is its length laid flat
 * (m): a 2 m sling is a tied loop of 4 m of tape, and it's drawn as the doubled tape, one strand. It lines up with
 * whatever pulls on its carabiner, or hangs straight down if nothing does.
 */
export type Sling = {
    kind: "sling";
    id: string;
    /** How far along the overhead beam it sits (m), from the south end of its lower log, which is the tower's south side. */
    at: number;
    length: number;
    color: RigColor;
    configuration: "basket";
};

/**
 * A rope tied to an item's carabiner with a munter and two half hitches, running from there over the east side's
 * railing and down the east face, or over the west side's railing and either its outrigger or straight down the west side. Its
 * `spare` rope, if it has a bucket, drapes from the hitch into it. Two lines sharing a bucket are the two ends of one
 * rope.
 */
export type Rope = {
    kind: "rope";
    id: string;
    from: string;
    color: RigColor;
    route: "east-face" | "west-outrigger" | "west-face";
    /** How long the whole rope is (metres), for the legend: the drawing shows only as much of it as is rigged. */
    length: number;
    spare?: string;
    /** Where a fixed line stops short of the ground, a carabiner on its end: just below the outrigger. */
    end?: "below-outrigger";
};

/**
 * A rope bucket on the top deck: directly under the overhead beam beside the steel railing round the stairs, the
 * mirror image of another bucket across the tower's middle (from south to north), or east of the stairs' steel
 * railing in line with one of the beam's spaces, directly under the beam a distance along it from its south end (as a
 * sling's `at`), in one of the top deck's corners, or on the deck under a belay's prusiks (as near under them as it can
 * stand inside the railings).
 */
export type Bucket = {
    kind: "bucket";
    id: string;
    color: RigColor;
    place:
        | "by-stair-railing"
        | { mirrorOf: string }
        /** Due east of another bucket, in line with it across the tower, `east` metres east of the west side. */
        | { dueEastOf: string; east: number }
        | { eastOfStairsAt: 1 | 2 | 3 | 4 | 5 }
        | { underBeamAt: number }
        | { underBelay: string }
        | { inCorner: "NE" | "SE" | "SW" | "NW" }
        | OnDeck;
    /** How tall it is (m), if not the usual. */
    height?: number;
};

/**
 * A belay line: a load-release hitch (cord of colour `lrh`) on the item's carabiner, a second carabiner on it, and
 * tandem belay prusiks (cords of the two `tbp` colours, the upper first) from that gripping the rope. The rope runs through them over
 * the east side's top rail (or the west side's) and hangs just past it, ready for its abseiler. Its `spare`, if it has
 * a bucket, drapes from behind the prusiks into it.
 */
export type Belay = {
    kind: "belay";
    id: string;
    from: string;
    color: RigColor;
    lrh: RigColor;
    tbp: [RigColor, RigColor];
    /** How long the whole rope is (metres), for the legend. */
    length: number;
    route?: Rope["route"];
    /**
     * The abseil rope this belay crosses the rail beside, so its abseiler goes over at the same place: its sling's
     * legs, hitches and rope all angle along the beam towards it. Without one, it goes straight across.
     */
    beside?: string;
    /**
     * A belay run through a redirect instead of over a side: up to the carabiner on the end of the fixed line `via`,
     * through it and hanging `drop` metres down the far side.
     */
    redirect?: { via: string; drop: number };
    spare?: string;
};

/**
 * A sling wrapped round some other part of the tower, both ends on one carabiner: one of a flight's stringers (flight 4
 * is the stairs up to level 4), `up` metres along it from its foot, or one of the corner posts, `height` metres above
 * a level's deck. Like a basket round the beam, it lines up with whatever pulls on its carabiner.
 */
export type WrapSling = {
    kind: "wrap-sling";
    id: string;
    around:
        | { flight: 1 | 2 | 3 | 4; stringer: "north" | "south"; up: number }
        | { corner: "NE" | "SE" | "SW" | "NW"; level: 1 | 2 | 3 | 4; height: number };
    length: number;
    color: RigColor;
};

/** A place on a deck measured from the tower's sides (m): how far east of the west side and north of the south side. */
export type OnDeck = { east: number; north: number };

/**
 * Where someone stands while the rig's in use: a disc on a level's deck, labelled with their role. It's in a corner
 * (just inside its posts) or at a measured place.
 */
export type Person = {
    kind: "person";
    id: string;
    role: "Abseiler" | "Belayer" | "Edge" | "Supervisor" | "Photographer";
    place: ({ inCorner: "NE" | "SE" | "SW" | "NW" } | OnDeck) & { level: 1 | 2 | 3 | 4 };
};

export type RigItem = Sling | WrapSling | Rope | Bucket | Belay | Person;
export type Rig = { name: string; items: RigItem[] };

export const RIGS: Rig[] = [
    {
        name: "Two ropes, four lines: east face and west outrigger",
        items: [
            {
                kind: "sling",
                id: "sling-1",
                at: 1.45,
                length: 2,
                color: "red",
                configuration: "basket",
            },
            { kind: "bucket", id: "bucket-1", color: "black", place: "by-stair-railing" },
            {
                kind: "rope",
                id: "rope-1",
                from: "sling-1",
                color: "dark-blue",
                length: 60,
                route: "east-face",
                spare: "bucket-1",
            },
            // The second line mirrors the first, from south to north.
            {
                kind: "sling",
                id: "sling-2",
                at: 3.35,
                length: 2,
                color: "red",
                configuration: "basket",
            },
            {
                kind: "bucket",
                id: "bucket-2",
                color: "blue",
                place: { mirrorOf: "bucket-1" },
                height: 0.55,
            },
            {
                kind: "rope",
                id: "rope-2",
                from: "sling-2",
                color: "blue",
                length: 100,
                route: "east-face",
                spare: "bucket-2",
            },
            // The west lines. The first, in space 1 on a longer sling, goes over the outrigger, its spare in its own
            // bucket in the top deck's SW corner; the second, the other end of the space 4 rope sharing its bucket,
            // just drops past the railing.
            {
                kind: "sling",
                id: "sling-3",
                at: 0.175,
                length: 3,
                color: "green",
                configuration: "basket",
            },
            {
                kind: "rope",
                id: "rope-3",
                from: "sling-3",
                color: "dark-blue",
                length: 60,
                route: "west-outrigger",
                spare: "bucket-6",
            },
            { kind: "bucket", id: "bucket-6", color: "black", place: { inCorner: "SW" } },
            {
                kind: "sling",
                id: "sling-4",
                at: 3.2,
                length: 2,
                color: "red",
                configuration: "basket",
            },
            {
                kind: "rope",
                id: "rope-4",
                from: "sling-4",
                color: "blue",
                length: 100,
                route: "west-face",
                spare: "bucket-2",
            },
            // The belays, one at a time.
            {
                kind: "sling",
                id: "sling-5",
                at: 1.2,
                length: 2,
                color: "red",
                configuration: "basket",
            },
            // Due east of the next line's black bucket, and west of the white belay's prusiks, so its spare runs back
            // west into it.
            {
                kind: "bucket",
                id: "bucket-3",
                color: "yellow",
                place: { dueEastOf: "bucket-1", east: 2.95 },
            },
            {
                kind: "belay",
                id: "belay-1",
                from: "sling-5",
                color: "white",
                length: 30,
                lrh: "green",
                tbp: ["dark-red", "dark-green"],
                route: "east-face",
                beside: "rope-1",
                spare: "bucket-3",
            },
            {
                kind: "sling",
                id: "sling-6",
                at: 3.6,
                length: 2,
                color: "red",
                configuration: "basket",
            },
            {
                kind: "bucket",
                id: "bucket-4",
                color: "blue",
                // Between the two red belays' slings, clear of the light blue bucket to its south.
                place: { underBeamAt: 3.5 },
                height: 0.55,
            },
            {
                kind: "belay",
                id: "belay-2",
                from: "sling-6",
                color: "red",
                length: 100,
                lrh: "green",
                tbp: ["dark-red", "dark-green"],
                route: "east-face",
                beside: "rope-2",
                spare: "bucket-4",
            },
            // The other end of the same red rope, over the west side, sharing its bucket.
            {
                kind: "sling",
                id: "sling-7",
                at: 3.45,
                length: 2,
                color: "red",
                configuration: "basket",
            },
            {
                kind: "belay",
                id: "belay-3",
                from: "sling-7",
                color: "red",
                length: 100,
                lrh: "green",
                tbp: ["dark-red", "dark-green"],
                route: "west-outrigger",
                beside: "rope-4",
                spare: "bucket-4",
            },
            // A fixed line from space 1 over the outrigger, ending in a carabiner just below it.
            {
                kind: "sling",
                id: "sling-8",
                at: 0.375,
                length: 3,
                color: "green",
                configuration: "basket",
            },
            {
                kind: "rope",
                id: "rope-5",
                from: "sling-8",
                color: "maroon",
                length: 12,
                route: "west-outrigger",
                end: "below-outrigger",
            },
            // The belay for it, on level 3: a sling round the stairs' stringer, and its rope up through the redirect.
            {
                kind: "wrap-sling",
                id: "wrap-sling-1",
                around: { flight: 4, stringer: "north", up: 0.6 },
                length: 3,
                color: "green",
            },
            {
                kind: "belay",
                id: "belay-4",
                from: "wrap-sling-1",
                color: "white",
                length: 30,
                lrh: "green",
                tbp: ["dark-red", "dark-green"],
                redirect: { via: "rope-5", drop: 1 },
                spare: "bucket-5",
            },
            { kind: "bucket", id: "bucket-5", color: "yellow", place: { underBelay: "belay-4" } },
            // Where people stand.
            // The white belay's belayer, by its prusiks and bucket.
            {
                kind: "person",
                id: "person-1",
                role: "Belayer",
                // Beside the white belay's prusiks, just east of the stairs' steel railing.
                place: { east: 3.6, north: 1.05, level: 4 },
            },
            // The red belays' belayers, just north of their prusiks.
            {
                kind: "person",
                id: "person-2",
                role: "Belayer",
                place: { east: 3.4, north: 4.0, level: 4 },
            },
            {
                kind: "person",
                id: "person-3",
                role: "Belayer",
                place: { east: 1.05, north: 3.85, level: 4 },
            },
            // East side, against the railing in the middle.
            {
                kind: "person",
                id: "person-4",
                role: "Edge",
                place: { east: 4.15, north: 2.25, level: 4 },
            },
            // West side, against the railing in the middle.
            {
                kind: "person",
                id: "person-5",
                role: "Edge",
                place: { east: 0.35, north: 2.25, level: 4 },
            },
            // Just east of the middle, clear of the beam.
            {
                kind: "person",
                id: "person-6",
                role: "Supervisor",
                place: { east: 2.8, north: 2.25, level: 4 },
            },
            // SE: at the east railing, under its pair of ropes (the dark blue abseil and white belay).
            {
                kind: "person",
                id: "person-7",
                role: "Abseiler",
                place: { east: 4.15, north: 1.39, level: 4 },
            },
            // NW: at the west railing, under its pair of ropes (the light blue abseil and red belay).
            {
                kind: "person",
                id: "person-8",
                role: "Abseiler",
                place: { east: 0.35, north: 3.26, level: 4 },
            },
            // NE: at the east railing, under its pair of ropes (the light blue abseil and red belay).
            {
                kind: "person",
                id: "person-9",
                role: "Abseiler",
                place: { east: 4.15, north: 3.41, level: 4 },
            },
            {
                kind: "person",
                id: "person-10",
                role: "Photographer",
                place: { inCorner: "SE", level: 4 },
            },
            // The redirected belay's belayer on level 3, under the stairs up to level 4 by its prusiks and bucket.
            {
                kind: "person",
                id: "person-11",
                role: "Belayer",
                place: { east: 0.7, north: 0.6, level: 3 },
            },
        ],
    },
];

/** Each rig colour as drawn: the knot pages' colour of that name, or the rig's own for those they don't have. */
export const rigColor = (c: RigColor) =>
    OWN_COLORS.includes(c) ? `var(--rig-${c})` : `var(--knot-${c})`;
const OWN_COLORS: RigColor[] = ["black", "white", "dark-green", "dark-red", "maroon", "dark-blue"];
/** Colours dark enough that a label on them is written light. */
const DARK_COLORS: RigColor[] = ["black", "dark-green", "dark-red", "maroon", "dark-blue"];

/** Tape and rope, as round as they're drawn. */
const SLING_R = 0.0125;
const ROPE_R = 0.0055;
/** How far from an abseil rope a belay beside it crosses the rail. */
const BESIDE_GAP = 0.12;
/** A carabiner's length and width. */
const KRAB_L = 0.11;
const KRAB_W = 0.06;
const EAST = vec3(1, 0, 0);
/** The letter each role's disc is labelled with, which the legend spells out. */
const ROLE_LETTER: Record<Person["role"], string> = {
    Abseiler: "A",
    Belayer: "B",
    Edge: "E",
    Supervisor: "S",
    Photographer: "P",
};

/** The radius of the disc where a person stands. */
const PERSON_R = 0.25;
/** A rope bucket's radius and height, and how far it stands off the steel railing. */
const BUCKET_R = 0.18;
const BUCKET_H = 0.42;
const BUCKET_GAP = 0.06;

/** A run of rope or tape through `points`, with rounded ends unless it joins another there. */
const strand = (
    points: Vector3[],
    r: number,
    material: Material,
    color?: string,
    capA = true,
    capB = true,
): Piece => ({ kind: "strand", points, r, material, color, capA, capB });

/** A run cut into strands at the points numbered `cuts`, joined so the cuts don't show. */
const run = (
    points: Vector3[],
    cuts: number[],
    r: number,
    material: Material,
    color?: string,
): Piece[] => {
    const at = [0, ...cuts, points.length - 1];
    return at
        .slice(1)
        .map((end, i) =>
            strand(points.slice(at[i], end + 1), r, material, color, i === 0, i === at.length - 2),
        );
};

/**
 * A basket sling at `z`, of `length` laid flat, pulled towards `target` (a point in the beam's cross-section: x across,
 * y up), or straight down without one. A `slant` angles the pull along the beam: that far along it for each metre out
 * across. Its tape wraps the back of both logs and its legs meet at the carabiner, which
 * lies along the pull. Gives its pieces, where the carabiner's far end is for what clips to it, and the pull's
 * direction.
 */
function basketSling(
    z: number,
    length: number,
    target: Vector2 | null,
    color: string,
    slant = 0,
): { pieces: Piece[]; clip: Vector3; along: Vector3 } {
    const { x, lowerY, upperY } = OVERHEAD;
    const centre = vec2(x, (lowerY + upperY) / 2);
    const pull = target ? target.sub(centre).unit() : vec2(0, -1);
    const logs = stackedLogs(vec2(x, lowerY), vec2(x, upperY), OVERHEAD.r + SLING_R);
    // A sling is a tied loop of tape, so it goes round doubled: drawn as one strand, it's as long as it lies flat.
    const { clip, path } = basket(logs, centre, pull, length);
    // Angled along the beam, each point's carried along it in step with how far out along the pull it is.
    const at = (p: Vector2) => vec3(p.x, p.y, z + Math.max(0, p.sub(centre).dot(pull)) * slant);
    const loop = path.map(at);
    // Cut into its two legs and short runs round the logs, so each sorts by where it is: in front of the logs or behind.
    const cuts = [1];
    for (let i = 5; i < loop.length - 2; i += 4) cuts.push(i);
    cuts.push(loop.length - 2);
    // The carabiner: an oval along the pull, in the same plane, its near end where the legs meet.
    const along = vec3(pull.x, pull.y, slant).unit();
    const across = vec3(-pull.y, pull.x, 0);
    const krab = carabiner(at(clip), along, across);
    return {
        pieces: [...run(loop, cuts, SLING_R, "sling", color), krab.piece],
        clip: krab.far,
        along,
    };
}

/** A carabiner lying `along` a pull from `near`, flat in the plane with `across`: its oval, and where its far end is. */
function carabiner(near: Vector3, along: Vector3, across: Vector3): { piece: Piece; far: Vector3 } {
    const mid = near.add(along.scale(KRAB_L / 2));
    const oval = Array.from({ length: 17 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return mid
            .add(along.scale((KRAB_L / 2) * Math.cos(a)))
            .add(across.scale((KRAB_W / 2) * Math.sin(a)));
    });
    return { piece: strand(oval, 0.006, "steel"), far: mid.add(along.scale(KRAB_L / 2)) };
}

/** Where a rope pulls towards, in the overhead beam's cross-section: the outer corner of the top rail it goes over. */
const PULL: Record<Rope["route"], Vector2> = {
    "east-face": vec2(EAST_EDGE.rail.x, EAST_EDGE.rail.y + ROPE_R),
    "west-outrigger": vec2(WEST_EDGE.rail.x, WEST_EDGE.rail.y + ROPE_R),
    "west-face": vec2(WEST_EDGE.rail.x, WEST_EDGE.rail.y + ROPE_R),
};

/**
 * A label to draw at a point on the rig. One `on` a cylinder (its direction, length and radius) is written along it:
 * on it where it's drawn big enough, beside it otherwise.
 */
export type RigLabel = {
    at: Vector3;
    text: string;
    on?: { along: Vector3; length: number; r: number };
    /** Written light on a dark cylinder, not dark on a light one. */
    light?: boolean;
};

/** How a rope's tied to a carabiner (a munter and two half hitches), drawn as a short cylinder in the rope's colour. */
const HITCH = { text: "M+2HH", r: 0.055, length: 0.25 };

/**
 * Where a rope goes after the top rail, in the beam's cross-section at `z`. Over the east side: out over the edge of the
 * east face's boarding and straight down the face to the ground. Over the west side: down onto the outrigger log (where
 * it first touches it from the rail), round its top to its outer side and straight down to the lower ground there;
 * or, dropping straight past the railing, down the west side clear of its beams and boarding to the ground.
 */
function beyondRail(route: Rope["route"], z: number, end?: Rope["end"]): Vector3[] {
    if (route === "east-face") {
        const edge = vec3(EAST_EDGE.boarding.x + ROPE_R, EAST_EDGE.boarding.y, z);
        return [edge, vec3(edge.x, groundAt(edge.x) + 0.02, z)];
    }
    if (route === "west-face") {
        const edge = vec3(WEST_EDGE.clear.x - ROPE_R, WEST_EDGE.clear.y, z);
        return [edge, vec3(edge.x, groundAt(edge.x) + 0.02, z)];
    }
    const { x, y } = WEST_EDGE.outrigger;
    const r = WEST_EDGE.outrigger.r + ROPE_R;
    const rail = PULL["west-outrigger"];
    // From the rail the rope meets the log where the line from the rail just touches it, over its top.
    const away = rail.sub(vec2(x, y));
    const first = Math.atan2(away.y, away.x) + Math.acos(r / away.len());
    const n = 6;
    const round = Array.from({ length: n + 1 }, (_, i) => {
        const a = first + ((Math.PI - first) * i) / n;
        return vec3(x + r * Math.cos(a), y + r * Math.sin(a), z);
    });
    return [...round, end ? belowOutrigger(z) : vec3(x - r, groundAt(x - r) + 0.02, z)];
}

/** Where a fixed line over the outrigger ends: hanging down its outer side to just below it. */
function belowOutrigger(z: number): Vector3 {
    const { x, y, r } = WEST_EDGE.outrigger;
    return vec3(x - r - ROPE_R, y - r - 0.12, z);
}

/**
 * A rope from `clip` over a side: its hitch on the carabiner, lying `along` the pull, then across to the top rail, over
 * its outer corner and on (`beyondRail`). What's past the rail is outside the tower, so it sorts as outside that side
 * of the shell.
 */
function ropeOverSide(
    rope: Rope,
    clip: Vector3,
    along: Vector3,
): { pieces: Piece[]; labels: RigLabel[]; through?: Vector3 } {
    const { route, end } = rope;
    const endKrab =
        end &&
        carabiner(belowOutrigger(clip.z).sub(vec3(0, 0.01, 0)), vec3(0, -1, 0), vec3(0, 0, 1));
    const color = rigColor(rope.color);
    const hitch = clip.add(along.scale(HITCH.length));
    // The hitch starts a little back over the carabiner's end, round which it's tied.
    const tied = clip.sub(along.scale(0.02));
    const hitchPiece: Piece = {
        kind: "rod",
        a: tied,
        b: hitch,
        r: HITCH.r,
        material: "rope",
        color,
        capA: true,
        capB: true,
    };
    return {
        pieces: [
            hitchPiece,
            ...toGround(route, [hitch], color, end),
            // A fixed line's carabiner, hanging from its end flat against the side.
            ...(endKrab ? [{ ...endKrab.piece, shell: { out: EAST.neg(), layer: 3 } }] : []),
        ],
        labels: [
            {
                at: tied.lerp(hitch, 0.5),
                text: HITCH.text,
                on: { along, length: hitch.distanceTo(tied), r: HITCH.r },
                light: DARK_COLORS.includes(rope.color),
            },
        ],
        // A rope round the end carabiner bears on the inside of its lower end.
        through: endKrab ? endKrab.far.add(vec3(0, ROPE_R + 0.006, 0)) : undefined,
    };
}

/**
 * Rope from `from` (its points in order, up to where it leaves for the rail) across to the top rail, over its outer
 * corner and on down that side (`beyondRail`). What's past the rail is outside the tower, so it sorts as outside that
 * side of the shell.
 */
function toGround(
    route: Rope["route"],
    from: Vector3[],
    color: string,
    end?: Rope["end"],
): Piece[] {
    const last = from[from.length - 1];
    const z = last.z;
    const rail = vec3(PULL[route].x, PULL[route].y, z);
    // The last stretch to the rail sorts with what's outside, so the rail doesn't cover the rope lying on it.
    const nearRail = rail.sub(rail.sub(last).unit().scale(0.3));
    const outside = { out: route === "east-face" ? EAST : EAST.neg(), layer: 3 };
    // Past the rail it's cut where it lands on what it goes over (the boarding's edge, the outrigger) and where it leaves
    // for the long drop, so the stretch lying on each sorts against it, not by a long stretch's middle far off.
    // The stretch landing on what's below the rail joins the stretch lying on it, so it sorts there too.
    const beyond = beyondRail(route, z, end);
    const landing = beyond[0].add(
        rail
            .sub(beyond[0])
            .unit()
            .scale(Math.min(0.25, rail.distanceTo(beyond[0]) / 2)),
    );
    // And the start of the drop off it joins the stretch lying on it too.
    const [off, foot] = [beyond[beyond.length - 2] ?? landing, beyond[beyond.length - 1]];
    const leaving = off.add(
        foot
            .sub(off)
            .unit()
            .scale(Math.min(0.3, off.distanceTo(foot) / 2)),
    );
    const past = [nearRail, rail, landing, ...beyond.slice(0, -1), leaving, foot];
    const cuts = [0, 2, past.length - 2, past.length - 1].filter((c, i, cs) => cs.indexOf(c) === i);
    return [
        strand([...from, nearRail], ROPE_R, "rope", color, true, false),
        ...cuts.slice(1).map((c, i) => ({
            ...strand(
                past.slice(cuts[i], c + 1),
                ROPE_R,
                "rope",
                color,
                false,
                i === cuts.length - 2,
            ),
            shell: outside,
        })),
    ];
}

/** A load-release hitch, as it's drawn: a cylinder of cord, longer and thinner than a rope's hitch. */
const LRH = { text: "LRH", r: 0.035, length: 0.35 };
/** Tandem belay prusiks, drawn as one cylinder round the rope: its upper half one cord's colour, its lower the other's. */
const TBP = { text: "TBP", r: 0.03, length: 0.26, bands: 2, cordR: 0.0035 };
/** How far down past the top rail's outer corner a belay rope hangs, waiting for its abseiler, a carabiner on its end. */
const BELAY_DROP = 0.35;

/** A cylinder from `a` to `b` in `bands` bands of alternating colours, rounded only at its ends. */
function banded(a: Vector3, b: Vector3, r: number, colors: string[], bands: number): Piece[] {
    return Array.from({ length: bands }, (_, i) => ({
        kind: "rod",
        a: a.lerp(b, i / bands),
        b: a.lerp(b, (i + 1) / bands),
        r,
        material: "rope",
        color: colors[i % colors.length],
        capA: i === 0,
        capB: i === bands - 1,
    }));
}

/**
 * A belay's hitches from `clip`: the load-release hitch along the pull, a carabiner on its end, and the tandem prusiks
 * from that on the rope. Gives their pieces and labels, the prusiks' two ends (the rope goes on from the second), and
 * where the rope comes from behind them, for its spare.
 */
function belayHitches(
    belay: Belay,
    clip: Vector3,
    along: Vector3,
): { pieces: Piece[]; labels: RigLabel[]; tbpA: Vector3; tbpB: Vector3; back: Vector3 } {
    const color = rigColor(belay.color);
    const across = vec3(-along.y, along.x, 0).unit();
    const tied = clip.sub(along.scale(0.02));
    const lrhEnd = clip.add(along.scale(LRH.length));
    const lrh: Piece = {
        kind: "rod",
        a: tied,
        b: lrhEnd,
        r: LRH.r,
        material: "rope",
        color: rigColor(belay.lrh),
        capA: true,
        capB: true,
    };
    const krab = carabiner(lrhEnd.sub(along.scale(0.015)), along, across);
    // The rope runs just under the carabiner's end, the prusiks gripping it beyond, their loops back to the carabiner.
    const onRope = krab.far.add(along.scale(0.04)).sub(across.scale(0.03));
    const [tbpA, tbpB] = [
        onRope.add(along.scale(0.04)),
        onRope.add(along.scale(0.04 + TBP.length)),
    ];
    const tbpColors = belay.tbp.map(rigColor);
    const loops = tbpColors.map((c, i) =>
        strand(
            [krab.far.add(across.scale(0.008 * (i ? 1 : -1))), tbpA.add(along.scale(0.02))],
            TBP.cordR,
            "rope",
            c,
        ),
    );
    const back = onRope.sub(along.scale(0.04));
    return {
        pieces: [
            lrh,
            krab.piece,
            ...loops,
            ...banded(tbpA, tbpB, TBP.r, tbpColors, TBP.bands),
            // The rope goes into the prusiks at one end and out at the other, hidden inside them.
            strand([back, tbpA], ROPE_R, "rope", color),
        ],
        labels: [
            {
                at: tied.lerp(lrhEnd, 0.5),
                text: LRH.text,
                on: { along, length: lrhEnd.distanceTo(tied), r: LRH.r },
            },
            {
                at: tbpA.lerp(tbpB, 0.5),
                text: TBP.text,
                on: { along, length: TBP.length, r: TBP.r },
                light: true,
            },
        ],
        tbpA,
        tbpB,
        back,
    };
}

/**
 * A belay from `clip` over a side: its hitches (`belayHitches`), and the rope on from them to the rail and just over
 * it, ready for its abseiler.
 */
function belayOverSide(
    belay: Belay,
    route: Rope["route"],
    clip: Vector3,
    along: Vector3,
): { pieces: Piece[]; labels: RigLabel[]; back: Vector3 } {
    const color = rigColor(belay.color);
    const hitches = belayHitches(belay, clip, along);
    const { tbpB, back } = hitches;
    // Where the line on from the prusiks meets the rail, which is further along the beam if it's angled.
    const railZ = tbpB.z + ((PULL[route].x - tbpB.x) * along.z) / along.x;
    const rail = vec3(PULL[route].x, PULL[route].y, railZ);
    const out = route === "east-face" ? EAST : EAST.neg();
    // Over the rail's outer corner and a little way down, outside the tower.
    const hang = rail.add(out.scale(ROPE_R)).add(vec3(0, -BELAY_DROP, 0));
    const nearRail = rail.sub(rail.sub(tbpB).unit().scale(0.3));
    // A carabiner on the rope's end, hanging from it flat against the side, for the abseiler to clip in.
    const endKrab = carabiner(hang.sub(vec3(0, 0.01, 0)), vec3(0, -1, 0), vec3(0, 0, 1));
    return {
        pieces: [
            ...hitches.pieces,
            strand([tbpB, nearRail], ROPE_R, "rope", color, true, false),
            {
                ...strand([nearRail, rail, hang], ROPE_R, "rope", color, false, true),
                shell: { out, layer: 3 },
            },
            { ...endKrab.piece, shell: { out, layer: 3 } },
        ],
        labels: hitches.labels,
        back,
    };
}

/**
 * A belay from `clip` through a redirect: its hitches (`belayHitches`), then the rope on from them in a straight line
 * to the redirect's carabiner (`through`, the inside of its lower end), round it and hanging `drop` down the far side.
 * The redirect is out past the west side, so the rope sorts as outside it from where it leaves the tower.
 */
function belayRedirected(
    belay: Belay,
    clip: Vector3,
    along: Vector3,
    through: Vector3,
    drop: number,
): { pieces: Piece[]; labels: RigLabel[]; back: Vector3; under: Vector3 } {
    const color = rigColor(belay.color);
    const hitches = belayHitches(belay, clip, along);
    const { tbpB } = hitches;
    // Where it leaves the tower, a little past the west railing.
    const leave = tbpB.lerp(through, (tbpB.x - (WEST_EDGE.rail.x - 0.1)) / (tbpB.x - through.x));
    const round = through.add(vec3(-0.02, -0.02, 0));
    const end = round.add(vec3(0, -drop, 0));
    // A carabiner on the rope's end, for the abseiler to clip in.
    const endKrab = carabiner(end.sub(vec3(0, 0.01, 0)), vec3(0, -1, 0), vec3(0, 0, 1));
    const outside = { out: EAST.neg(), layer: 3 };
    return {
        pieces: [
            ...hitches.pieces,
            strand([tbpB, leave], ROPE_R, "rope", color, true, false),
            {
                ...strand([leave, through, round, end], ROPE_R, "rope", color, false, true),
                shell: outside,
            },
            { ...endKrab.piece, shell: outside },
        ],
        labels: hitches.labels,
        back: hitches.back,
        under: hitches.tbpA.lerp(tbpB, 0.5),
    };
}

/**
 * A sling wrapped round a stringer or a corner post, pulled towards `target` (or hanging straight down without one):
 * worked like a basket round the beam, in the plane across what it wraps that holds the pull, so its carabiner points
 * at the target. Gives its pieces, its carabiner's far end, and the direction from there to the target.
 */
function wrapSling(
    item: WrapSling,
    target: Vector3 | null,
): { pieces: Piece[]; clip: Vector3; along: Vector3 } {
    const up = vec3(0, 1, 0);
    const { around } = item;
    // What it wraps: its middle where the sling goes round, the way it runs, and its section.
    let centre: Vector3;
    let axis: Vector3;
    let section: { w: number; h: number } | { r: number };
    if ("corner" in around) {
        const x = around.corner.includes("E") ? SIDE : 0;
        const z = around.corner.includes("N") ? SIDE : 0;
        centre = vec3(x, LEVELS[around.level] + around.height, z);
        axis = up;
        section = { r: LOG_R };
    } else {
        const st = stringer(around.flight, around.stringer);
        axis = st.b.sub(st.a).unit();
        centre = st.a.add(axis.scale(around.up));
        section = { w: st.w, h: st.h };
    }
    const to = target ? target.sub(centre) : up.neg();
    // Across it in the sling's plane: a sawn timber's width, or for a round post square to the pull.
    const depth = up.sub(axis.scale(up.dot(axis))).unit();
    const s = ("r" in section ? axis.cross(to) : axis.cross(depth)).unit();
    // The sling lies in the plane across it that holds the pull, wrapping it at a slant: its section there is as wide as
    // it is, but longer along the pull, the more steeply the plane cuts across it.
    const w = to.sub(s.scale(to.dot(s))).unit();
    const slant = Math.max(Math.sqrt(1 - w.dot(axis) ** 2), 0.3);
    const outline =
        "r" in section
            ? Array.from({ length: 24 }, (_, i) => {
                  const a = (i / 24) * Math.PI * 2;
                  const r = section.r + SLING_R;
                  return vec2(r * Math.cos(a), (r / slant) * Math.sin(a));
              })
            : (() => {
                  const [half, long] = [section.w / 2 + SLING_R, (section.h / 2 + SLING_R) / slant];
                  return [
                      vec2(-half, -long),
                      vec2(half, -long),
                      vec2(half, long),
                      vec2(-half, long),
                  ];
              })();
    const pull = vec2(to.dot(s), to.dot(w)).unit();
    const { clip, path } = basket(outline, vec2(0, 0), pull, item.length);
    const at = (p: Vector2) => centre.add(s.scale(p.x)).add(w.scale(p.y));
    const loop = path.map(at);
    // Cut into short runs, so each sorts by where it is: in front of what it wraps or behind.
    const cuts = Array.from({ length: loop.length - 2 }, (_, i) => i + 1).filter(
        (i) => i === 1 || i === loop.length - 2 || i % 3 === 0,
    );
    const krab = carabiner(
        at(clip),
        s.scale(pull.x).add(w.scale(pull.y)),
        s.scale(-pull.y).add(w.scale(pull.x)),
    );
    return {
        pieces: [...run(loop, cuts, SLING_R, "sling", rigColor(item.color)), krab.piece],
        clip: krab.far,
        along: target ? target.sub(krab.far).unit() : up.neg(),
    };
}

/**
 * Where a bucket under the beam stands on the top deck: just north of the steel railing round the stairs, or across the
 * tower's middle from the bucket it mirrors.
 */
function bucketBase(bucket: Bucket, rig: Rig): Vector3 {
    const place = bucket.place;
    if (place === "by-stair-railing")
        return vec3(OVERHEAD.x, TOP, topOpening().z1 + BUCKET_R + BUCKET_GAP);
    if ("underBelay" in place)
        throw new Error("A bucket under a belay stands where its belay is laid out");
    if ("inCorner" in place) {
        const inside = LOG_R + BUCKET_R + 0.08;
        const x = place.inCorner.includes("E") ? SIDE - inside : inside;
        const z = place.inCorner.includes("N") ? SIDE - inside : inside;
        return vec3(x, TOP, z);
    }
    if ("north" in place) return vec3(place.east, TOP, place.north);
    if ("underBeamAt" in place) return vec3(OVERHEAD.x, TOP, place.underBeamAt);
    if ("eastOfStairsAt" in place) {
        const { z0, z1 } = overheadSpace(place.eastOfStairsAt);
        return vec3(topOpening().x1 + BUCKET_R + BUCKET_GAP, TOP, (z0 + z1) / 2);
    }
    const byOther = (id: string) => {
        const other = rig.items.find((i): i is Bucket => i.kind === "bucket" && i.id === id);
        if (!other || other === bucket) throw new Error(`No bucket ${id} to place by`);
        return bucketBase(other, rig);
    };
    if ("dueEastOf" in place) {
        const base = byOther(place.dueEastOf);
        return vec3(place.east, base.y, base.z);
    }
    const base = byOther(place.mirrorOf);
    return vec3(base.x, base.y, SIDE - base.z);
}

/**
 * A rope bucket standing at `base`: its sides and floor (open at the top, so its far side shows inside from above),
 * and the top coil of the rope in it.
 */
function bucketPieces(
    base: Vector3,
    color: string,
    ropeColor: string | null,
    height = BUCKET_H,
): Piece[] {
    const n = 16;
    const ring = (y: number, r: number) =>
        Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2;
            return base.add(vec3(r * Math.cos(a), y, r * Math.sin(a)));
        });
    const bottom = ring(0, BUCKET_R);
    const rim = ring(height, BUCKET_R);
    const sides: Face[] = bottom.map((p, i) => ({
        kind: "face",
        points: [p, bottom[(i + 1) % n], rim[(i + 1) % n], rim[i]],
        material: "bucket",
        color,
    }));
    const floor: Face = { kind: "face", points: bottom, material: "bucket", color };
    const coil = ropeColor
        ? [
              strand(
                  [...ring(height - 0.12, 0.12), ring(height - 0.12, 0.12)[0]],
                  ROPE_R,
                  "rope",
                  ropeColor,
              ),
          ]
        : [];
    return [floor, ...sides, ...coil];
}

/** Spare rope draping from `from` (the hitch) into the bucket at `base`, sagging a little, and down onto its coil. */
function drape(from: Vector3, base: Vector3, color: string, height = BUCKET_H): Piece[] {
    const into = base.add(vec3(0, height, 0));
    const sag = 0.25;
    const points = Array.from({ length: 13 }, (_, i) => {
        const t = i / 12;
        return from.lerp(into, t).add(vec3(0, -sag * 4 * t * (1 - t), 0));
    });
    points.push(base.add(vec3(0.12, height - 0.12, 0)));
    return run(points, [4, 8, 12], ROPE_R, "rope", color);
}

/** The rig laid out on the tower: its pieces to draw with the tower's, and its labels. */
export function layoutRig(rig: Rig, only?: Set<string>): { pieces: Piece[]; labels: RigLabel[] } {
    const pieces: Piece[] = [];
    const labels: RigLabel[] = [];
    const clips = new Map<string, { clip: Vector3; along: Vector3 }>();
    // Where each fixed line's end carabiner takes a rope round it, for belays redirected through it.
    const redirects = new Map<string, Vector3>();
    const heightOf = (id?: string) =>
        rig.items.find((i): i is Bucket => i.kind === "bucket" && i.id === id)?.height;
    // Buckets standing under a belay's prusiks are placed when it's laid out.
    const underBelay = (b: Bucket) => typeof b.place === "object" && "underBelay" in b.place;
    const buckets = new Map(
        rig.items
            .filter((i): i is Bucket => i.kind === "bucket" && !underBelay(i))
            .map((b) => [b.id, bucketBase(b, rig)]),
    );
    const slings = rig.items.filter((i): i is Sling => i.kind === "sling");
    const lineFrom = (id: string) =>
        rig.items.find(
            (i): i is Rope | Belay => (i.kind === "rope" || i.kind === "belay") && i.from === id,
        );
    for (const item of rig.items) {
        const [drawn, written] = [pieces.length, labels.length];
        layOut(item);
        // Everything's laid out, as one item can depend on another, but only those asked for are kept.
        if (only && !only.has(item.id)) {
            pieces.length = drawn;
            labels.length = written;
        }
    }
    return { pieces, labels };

    function layOut(item: RigItem) {
        if (item.kind === "sling") {
            const z = item.at;
            const rope = lineFrom(item.id);
            // A belay beside an abseil rope aims to cross the rail just to this side of it.
            const beside =
                rope?.kind === "belay" && rope.beside
                    ? rig.items.find((i): i is Rope => i.kind === "rope" && i.id === rope.beside)
                    : undefined;
            const theirs = beside && slings.find((s) => s.id === beside.from);
            let slant = 0;
            if (rope?.route && theirs) {
                const other = theirs.at;
                const aim = other + Math.sign(z - other) * BESIDE_GAP;
                const centre = vec2(OVERHEAD.x, (OVERHEAD.lowerY + OVERHEAD.upperY) / 2);
                slant = (aim - z) / PULL[rope.route].distanceTo(centre);
            }
            const s = basketSling(
                z,
                item.length,
                rope?.route ? PULL[rope.route] : null,
                rigColor(item.color),
                slant,
            );
            pieces.push(...s.pieces);
            clips.set(item.id, s);
        } else if (item.kind === "bucket") {
            if (underBelay(item)) return;
            const fed = rig.items.find(
                (i): i is Rope | Belay =>
                    (i.kind === "rope" || i.kind === "belay") && i.spare === item.id,
            );
            pieces.push(
                ...bucketPieces(
                    bucketBase(item, rig),
                    rigColor(item.color),
                    fed ? rigColor(fed.color) : null,
                    item.height,
                ),
            );
        } else if (item.kind === "wrap-sling") {
            const belay = rig.items.find(
                (i): i is Belay => i.kind === "belay" && i.from === item.id,
            );
            const via = belay?.redirect && redirects.get(belay.redirect.via);
            const s = wrapSling(item, via ?? null);
            pieces.push(...s.pieces);
            clips.set(item.id, s);
        } else if (item.kind === "person") {
            const { place } = item;
            const inside = LOG_R + PERSON_R + 0.05;
            const [x, z] =
                "inCorner" in place
                    ? [
                          place.inCorner.includes("E") ? SIDE - inside : inside,
                          place.inCorner.includes("N") ? SIDE - inside : inside,
                      ]
                    : [place.east, place.north];
            const centre = vec3(x, LEVELS[place.level] + 0.01, z);
            pieces.push({
                kind: "face",
                points: Array.from({ length: 24 }, (_, i) => {
                    const a = (i / 24) * Math.PI * 2;
                    return centre.add(vec3(Math.cos(a), 0, Math.sin(a)).scale(PERSON_R));
                }),
                material: "person",
                normal: vec3(0, 1, 0),
                text: ROLE_LETTER[item.role],
            });
        } else if (item.kind === "belay") {
            const from = clips.get(item.from);
            if (!from) return;
            const through = item.redirect && redirects.get(item.redirect.via);
            const belay: {
                pieces: Piece[];
                labels: RigLabel[];
                back: Vector3;
                under?: Vector3;
            } | null =
                item.redirect && through
                    ? belayRedirected(item, from.clip, from.along, through, item.redirect.drop)
                    : item.route
                      ? belayOverSide(item, item.route, from.clip, from.along)
                      : null;
            if (!belay) return;
            pieces.push(...belay.pieces);
            labels.push(...belay.labels);
            // A bucket for its spare standing on the deck under its prusiks.
            const below = rig.items.find(
                (i): i is Bucket =>
                    i.kind === "bucket" &&
                    i.id === item.spare &&
                    typeof i.place === "object" &&
                    "underBelay" in i.place,
            );
            if (below && belay.under) {
                const { under } = belay;
                const deck = Math.max(...LEVELS.filter((y) => y < under.y));
                // As near under them as it can stand, inside the corner posts and the railings between them.
                const inside = LOG_R + BUCKET_R + 0.05;
                const keep = (v: number) => clamp(v, inside, SIDE - inside);
                const base = vec3(keep(under.x), deck, keep(under.z));
                buckets.set(below.id, base);
                pieces.push(
                    ...bucketPieces(
                        base,
                        rigColor(below.color),
                        rigColor(item.color),
                        below.height,
                    ),
                );
            }
            const bucket = item.spare && buckets.get(item.spare);
            if (bucket)
                pieces.push(
                    ...drape(belay.back, bucket, rigColor(item.color), heightOf(item.spare)),
                );
        } else {
            const from = clips.get(item.from);
            if (!from) return;
            const rope = ropeOverSide(item, from.clip, from.along);
            if (rope.through) redirects.set(item.id, rope.through);
            pieces.push(...rope.pieces);
            labels.push(...rope.labels);
            const bucket = item.spare && buckets.get(item.spare);
            if (bucket)
                pieces.push(
                    ...drape(from.clip, bucket, rigColor(item.color), heightOf(item.spare)),
                );
        }
    }
}

/** A cylinder standing for a knot or hitch, as the legend shows it: its label, full name and colours. */
export type LegendCylinder = { text: string; name: string; colors: string[] };
/** A kind of item in the rig, whether it's tape or rope, and the colours it comes in. */
/** A role people have in the rig, and the letter on their discs. */
export type LegendPerson = { letter: string; name: string };
export type LegendLine = { name: string; look: "tape" | "rope"; colors: string[] };

/** What the drawing's cylinders and colours stand for, for the rig's legend. */
export function legend(rig: Rig): {
    cylinders: LegendCylinder[];
    lines: LegendLine[];
    people: LegendPerson[];
} {
    const ropes = rig.items.filter((i): i is Rope => i.kind === "rope");
    const belays = rig.items.filter((i): i is Belay => i.kind === "belay");
    const cylinders: LegendCylinder[] = [];
    if (ropes.length)
        cylinders.push({
            text: HITCH.text,
            name: "Munter and two half-hitches",
            colors: [rigColor(ropes[0].color)],
        });
    if (belays.length)
        cylinders.push(
            {
                text: LRH.text,
                name: "Load-release hitch",
                colors: [rigColor(belays[0].lrh)],
            },
            {
                text: TBP.text,
                name: "Tandem belay prusiks",
                colors: belays[0].tbp.map(rigColor),
            },
        );
    // A line for each length of sling and of rope, with every colour that length comes in.
    const byLength = (
        items: { length: number; color: RigColor }[],
        what: string,
        look: LegendLine["look"],
    ): LegendLine[] =>
        [...new Set(items.map((i) => i.length))]
            .sort((x, y) => x - y)
            .map((length) => {
                const colors = [
                    ...new Set(
                        items.filter((i) => i.length === length).map((i) => rigColor(i.color)),
                    ),
                ];
                return { name: `${length} m ${what}${colors.length > 1 ? "s" : ""}`, look, colors };
            });
    const slings = rig.items.filter(
        (i): i is Sling | WrapSling => i.kind === "sling" || i.kind === "wrap-sling",
    );
    const lines = [
        ...byLength(slings, "sling", "tape"),
        ...byLength([...ropes, ...belays], "rope", "rope"),
    ];
    // Each role someone has, in the order the roles are listed.
    const roles = new Set(rig.items.flatMap((i) => (i.kind === "person" ? [i.role] : [])));
    const people = (Object.keys(ROLE_LETTER) as Person["role"][])
        .filter((r) => roles.has(r))
        .map((name) => ({ letter: ROLE_LETTER[name], name }));
    return { cylinders, lines, people };
}

/**
 * The part of a rig on one side of the tower: the ropes and belays going over that side (a belay through a redirect
 * goes with the line it's redirected through), the slings they hang from and the buckets their spares go into.
 */
export function rigSide(rig: Rig, side: "east" | "west"): Set<string> {
    const ropes = rig.items.filter((i): i is Rope => i.kind === "rope");
    const sideOf = (route?: Rope["route"]) =>
        route === undefined ? undefined : route === "east-face" ? "east" : "west";
    const lines = rig.items.filter(
        (i): i is Rope | Belay =>
            (i.kind === "rope" || i.kind === "belay") &&
            (i.kind === "belay" && i.redirect
                ? sideOf(ropes.find((r) => r.id === i.redirect?.via)?.route)
                : sideOf(i.route)) === side,
    );
    // People are on every side's view.
    const people = rig.items.filter((i) => i.kind === "person").map((i) => i.id);
    return new Set([
        ...people,
        ...lines.flatMap((l) => [l.id, l.from, ...(l.spare ? [l.spare] : [])]),
    ]);
}

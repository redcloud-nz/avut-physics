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
 * A rig on the tower, as a list of items in the order they're put up. Positions come from the tower: a sling sits in
 * one of the overhead beam's five spaces (numbered from the south), and a rope hangs from what it's tied to.
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
    | "maroon";

/**
 * A sling round the overhead beam, both its ends clipped to one carabiner (a basket). `length` is its length laid flat
 * (m): a 2 m sling is a tied loop of 4 m of tape, and it's drawn as the doubled tape, one strand. It lines up with
 * whatever pulls on its carabiner, or hangs straight down if nothing does.
 */
export type Sling = {
    kind: "sling";
    id: string;
    space: 1 | 2 | 3 | 4 | 5;
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
    spare?: string;
    /** Where a fixed line stops short of the ground, a carabiner on its end: just below the outrigger. */
    end?: "below-outrigger";
};

/**
 * A rope bucket on the top deck: directly under the overhead beam beside the steel railing round the stairs, the
 * mirror image of another bucket across the tower's middle (from south to north), or east of the stairs' steel
 * railing in line with one of the beam's spaces, directly under one of its spaces, or on the deck under a belay's
 * prusiks (as near under them as it can stand inside the railings).
 */
export type Bucket = {
    kind: "bucket";
    id: string;
    color: RigColor;
    place:
        | "by-stair-railing"
        | { mirrorOf: string }
        | { eastOfStairsAt: 1 | 2 | 3 | 4 | 5 }
        | { underBeamAt: 1 | 2 | 3 | 4 | 5 }
        | { underBelay: string };
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
    route?: Rope["route"];
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

export type RigItem = Sling | WrapSling | Rope | Bucket | Belay;
export type Rig = { name: string; items: RigItem[] };

export const RIGS: Rig[] = [
    {
        name: "Two ropes, four lines: east face and west outrigger",
        items: [
            {
                kind: "sling",
                id: "sling-1",
                space: 2,
                length: 2,
                color: "purple",
                configuration: "basket",
            },
            { kind: "bucket", id: "bucket-1", color: "black", place: "by-stair-railing" },
            {
                kind: "rope",
                id: "rope-1",
                from: "sling-1",
                color: "blue",
                route: "east-face",
                spare: "bucket-1",
            },
            // The second line mirrors the first, from south to north.
            {
                kind: "sling",
                id: "sling-2",
                space: 4,
                length: 2,
                color: "purple",
                configuration: "basket",
            },
            { kind: "bucket", id: "bucket-2", color: "black", place: { mirrorOf: "bucket-1" } },
            {
                kind: "rope",
                id: "rope-2",
                from: "sling-2",
                color: "blue",
                route: "east-face",
                spare: "bucket-2",
            },
            // The west lines: the other ends of the same two ropes, sharing their buckets. The first goes over the
            // outrigger, the second just drops past the railing.
            {
                kind: "sling",
                id: "sling-3",
                space: 2,
                length: 2,
                color: "purple",
                configuration: "basket",
            },
            {
                kind: "rope",
                id: "rope-3",
                from: "sling-3",
                color: "blue",
                route: "west-outrigger",
                spare: "bucket-1",
            },
            {
                kind: "sling",
                id: "sling-4",
                space: 4,
                length: 2,
                color: "purple",
                configuration: "basket",
            },
            {
                kind: "rope",
                id: "rope-4",
                from: "sling-4",
                color: "blue",
                route: "west-face",
                spare: "bucket-2",
            },
            // The belays, one at a time.
            {
                kind: "sling",
                id: "sling-5",
                space: 1,
                length: 2,
                color: "purple",
                configuration: "basket",
            },
            { kind: "bucket", id: "bucket-3", color: "yellow", place: { eastOfStairsAt: 1 } },
            {
                kind: "belay",
                id: "belay-1",
                from: "sling-5",
                color: "white",
                lrh: "green",
                tbp: ["dark-red", "dark-green"],
                route: "east-face",
                spare: "bucket-3",
            },
            {
                kind: "sling",
                id: "sling-6",
                space: 5,
                length: 2,
                color: "purple",
                configuration: "basket",
            },
            { kind: "bucket", id: "bucket-4", color: "blue", place: { underBeamAt: 5 } },
            {
                kind: "belay",
                id: "belay-2",
                from: "sling-6",
                color: "red",
                lrh: "green",
                tbp: ["dark-red", "dark-green"],
                route: "east-face",
                spare: "bucket-4",
            },
            // The other end of the same red rope, over the west side, sharing its bucket.
            {
                kind: "sling",
                id: "sling-7",
                space: 5,
                length: 2,
                color: "purple",
                configuration: "basket",
            },
            {
                kind: "belay",
                id: "belay-3",
                from: "sling-7",
                color: "red",
                lrh: "green",
                tbp: ["dark-red", "dark-green"],
                route: "west-outrigger",
                spare: "bucket-4",
            },
            // A fixed line from space 1 over the outrigger, ending in a carabiner just below it.
            {
                kind: "sling",
                id: "sling-8",
                space: 1,
                length: 2,
                color: "purple",
                configuration: "basket",
            },
            {
                kind: "rope",
                id: "rope-5",
                from: "sling-8",
                color: "maroon",
                route: "west-outrigger",
                end: "below-outrigger",
            },
            // The belay for it, on level 3: a sling round the stairs' stringer, and its rope up through the redirect.
            {
                kind: "wrap-sling",
                id: "wrap-sling-1",
                around: { flight: 4, stringer: "north", up: 0.6 },
                length: 2,
                color: "yellow",
            },
            {
                kind: "belay",
                id: "belay-4",
                from: "wrap-sling-1",
                color: "white",
                lrh: "green",
                tbp: ["dark-red", "dark-green"],
                redirect: { via: "rope-5", drop: 1 },
                spare: "bucket-5",
            },
            { kind: "bucket", id: "bucket-5", color: "yellow", place: { underBelay: "belay-4" } },
        ],
    },
];

/** Each rig colour as drawn: the knot pages' colour of that name, or the rig's own for those they don't have. */
export const rigColor = (c: RigColor) =>
    OWN_COLORS.includes(c) ? `var(--rig-${c})` : `var(--knot-${c})`;
const OWN_COLORS: RigColor[] = ["black", "white", "dark-green", "dark-red", "maroon"];
/** Colours dark enough that a label on them is written light. */
const DARK_COLORS: RigColor[] = ["black", "dark-green", "dark-red", "maroon"];

/** Tape and rope, as round as they're drawn. */
const SLING_R = 0.0125;
const ROPE_R = 0.0055;
/** How far apart slings in one space sit. */
const SLING_GAP = 0.2;
/** A carabiner's length and width. */
const KRAB_L = 0.11;
const KRAB_W = 0.06;
const EAST = vec3(1, 0, 0);
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
 * y up), or straight down without one. Its tape wraps the back of both logs and its legs meet at the carabiner, which
 * lies along the pull. Gives its pieces, where the carabiner's far end is for what clips to it, and the pull's
 * direction.
 */
function basketSling(
    z: number,
    length: number,
    target: Vector2 | null,
    color: string,
): { pieces: Piece[]; clip: Vector3; along: Vector3 } {
    const { x, lowerY, upperY } = OVERHEAD;
    const centre = vec2(x, (lowerY + upperY) / 2);
    const pull = target ? target.sub(centre).unit() : vec2(0, -1);
    const logs = stackedLogs(vec2(x, lowerY), vec2(x, upperY), OVERHEAD.r + SLING_R);
    // A sling is a tied loop of tape, so it goes round doubled: drawn as one strand, it's as long as it lies flat.
    const { clip, path } = basket(logs, centre, pull, length);
    const at = (p: Vector2) => vec3(p.x, p.y, z);
    const loop = path.map(at);
    // Cut into its two legs and short runs round the logs, so each sorts by where it is: in front of the logs or behind.
    const cuts = [1];
    for (let i = 5; i < loop.length - 2; i += 4) cuts.push(i);
    cuts.push(loop.length - 2);
    // The carabiner: an oval along the pull, in the same plane, its near end where the legs meet.
    const along = vec3(pull.x, pull.y, 0);
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
    return [
        strand([...from, nearRail], ROPE_R, "rope", color, true, false),
        {
            ...strand(
                [nearRail, rail, ...beyondRail(route, z, end)],
                ROPE_R,
                "rope",
                color,
                false,
                true,
            ),
            shell: outside,
        },
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
    const rail = vec3(PULL[route].x, PULL[route].y, back.z);
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
    if ("underBeamAt" in place) {
        const { z0, z1 } = overheadSpace(place.underBeamAt);
        return vec3(OVERHEAD.x, TOP, (z0 + z1) / 2);
    }
    if ("eastOfStairsAt" in place) {
        const { z0, z1 } = overheadSpace(place.eastOfStairsAt);
        return vec3(topOpening().x1 + BUCKET_R + BUCKET_GAP, TOP, (z0 + z1) / 2);
    }
    const other = rig.items.find(
        (i): i is Bucket => i.kind === "bucket" && i.id === place.mirrorOf,
    );
    if (!other || other === bucket) throw new Error(`No bucket ${place.mirrorOf} to mirror`);
    const base = bucketBase(other, rig);
    return vec3(base.x, base.y, SIDE - base.z);
}

/**
 * A rope bucket standing at `base`: its sides and floor (open at the top, so its far side shows inside from above),
 * and the top coil of the rope in it.
 */
function bucketPieces(base: Vector3, color: string, ropeColor: string | null): Piece[] {
    const n = 16;
    const ring = (y: number, r: number) =>
        Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2;
            return base.add(vec3(r * Math.cos(a), y, r * Math.sin(a)));
        });
    const bottom = ring(0, BUCKET_R);
    const rim = ring(BUCKET_H, BUCKET_R);
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
                  [...ring(BUCKET_H - 0.12, 0.12), ring(BUCKET_H - 0.12, 0.12)[0]],
                  ROPE_R,
                  "rope",
                  ropeColor,
              ),
          ]
        : [];
    return [floor, ...sides, ...coil];
}

/** Spare rope draping from `from` (the hitch) into the bucket at `base`, sagging a little, and down onto its coil. */
function drape(from: Vector3, base: Vector3, color: string): Piece[] {
    const into = base.add(vec3(0, BUCKET_H, 0));
    const sag = 0.25;
    const points = Array.from({ length: 13 }, (_, i) => {
        const t = i / 12;
        return from.lerp(into, t).add(vec3(0, -sag * 4 * t * (1 - t), 0));
    });
    points.push(base.add(vec3(0.12, BUCKET_H - 0.12, 0)));
    return run(points, [4, 8, 12], ROPE_R, "rope", color);
}

/** The rig laid out on the tower: its pieces to draw with the tower's, and its labels. */
export function layoutRig(rig: Rig): { pieces: Piece[]; labels: RigLabel[] } {
    const pieces: Piece[] = [];
    const labels: RigLabel[] = [];
    const clips = new Map<string, { clip: Vector3; along: Vector3 }>();
    // Where each fixed line's end carabiner takes a rope round it, for belays redirected through it.
    const redirects = new Map<string, Vector3>();
    // Buckets standing under a belay's prusiks are placed when it's laid out.
    const underBelay = (b: Bucket) => typeof b.place === "object" && "underBelay" in b.place;
    const buckets = new Map(
        rig.items
            .filter((i): i is Bucket => i.kind === "bucket" && !underBelay(i))
            .map((b) => [b.id, bucketBase(b, rig)]),
    );
    // Slings sharing a space spread evenly across it, a little apart: those for lines over the west side to the south,
    // those over the east side to the north, and otherwise in the order they were put up.
    const route = (s: Sling) =>
        rig.items.find(
            (i): i is Rope | Belay => (i.kind === "rope" || i.kind === "belay") && i.from === s.id,
        )?.route;
    const southFirst = (s: Sling) =>
        route(s) === "west-outrigger" || route(s) === "west-face"
            ? 0
            : route(s) === "east-face"
              ? 2
              : 1;
    const slings = rig.items
        .filter((i): i is Sling => i.kind === "sling")
        .sort((a, b) => southFirst(a) - southFirst(b));
    for (const item of rig.items) {
        if (item.kind === "sling") {
            const mates = slings.filter((s) => s.space === item.space);
            const k = mates.indexOf(item) - (mates.length - 1) / 2;
            const { z0, z1 } = overheadSpace(item.space);
            const rope = rig.items.find(
                (i): i is Rope | Belay =>
                    (i.kind === "rope" || i.kind === "belay") && i.from === item.id,
            );
            const s = basketSling(
                (z0 + z1) / 2 + k * SLING_GAP,
                item.length,
                rope?.route ? PULL[rope.route] : null,
                rigColor(item.color),
            );
            pieces.push(...s.pieces);
            clips.set(item.id, s);
        } else if (item.kind === "bucket") {
            if (underBelay(item)) continue;
            const fed = rig.items.find(
                (i): i is Rope | Belay =>
                    (i.kind === "rope" || i.kind === "belay") && i.spare === item.id,
            );
            pieces.push(
                ...bucketPieces(
                    bucketBase(item, rig),
                    rigColor(item.color),
                    fed ? rigColor(fed.color) : null,
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
        } else if (item.kind === "belay") {
            const from = clips.get(item.from);
            if (!from) continue;
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
            if (!belay) continue;
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
                pieces.push(...bucketPieces(base, rigColor(below.color), rigColor(item.color)));
            }
            const bucket = item.spare && buckets.get(item.spare);
            if (bucket) pieces.push(...drape(belay.back, bucket, rigColor(item.color)));
        } else {
            const from = clips.get(item.from);
            if (!from) continue;
            const rope = ropeOverSide(item, from.clip, from.along);
            if (rope.through) redirects.set(item.id, rope.through);
            pieces.push(...rope.pieces);
            labels.push(...rope.labels);
            const bucket = item.spare && buckets.get(item.spare);
            if (bucket) pieces.push(...drape(from.clip, bucket, rigColor(item.color)));
        }
    }
    return { pieces, labels };
}

/** A cylinder standing for a knot or hitch, as the legend shows it: its label, full name and colours. */
export type LegendCylinder = { text: string; name: string; colors: string[] };
/** A kind of item in the rig, whether it's tape or rope, and the colours it comes in. */
export type LegendLine = { name: string; look: "tape" | "rope"; colors: string[] };

/** What the drawing's cylinders and colours stand for, for the rig's legend. */
export function legend(rig: Rig): { cylinders: LegendCylinder[]; lines: LegendLine[] } {
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
    const unique = (cs: RigColor[]) => [...new Set(cs.map(rigColor))];
    const allSlings = rig.items.filter(
        (i): i is Sling | WrapSling => i.kind === "sling" || i.kind === "wrap-sling",
    );
    const lengths = [...new Set(allSlings.map((i) => i.length))];
    const lines: LegendLine[] = [
        {
            name: `${lengths.join(" and ")} m slings`,
            look: "tape",
            colors: unique(allSlings.map((i) => i.color)),
        },
        {
            name: "Abseil ropes",
            look: "rope",
            colors: unique(ropes.filter((r) => !r.end).map((r) => r.color)),
        },
        {
            name: "Belay ropes",
            look: "rope",
            colors: unique([...belays, ...ropes.filter((r) => r.end)].map((i) => i.color)),
        },
    ];
    return { cylinders, lines: lines.filter((l) => l.colors.length) };
}

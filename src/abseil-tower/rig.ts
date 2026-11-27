import { convexHull, smallestCircle } from "@/lib/hull";
import { clamp } from "@/lib/math";
import { vec2, type Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";
import {
    CARABINER_R,
    carabinerWith as ctCarabiner,
    prusikMindingPulley,
    type CarabinerFeatures,
} from "@/rigging/hardware";
import type { Connection } from "@/rigging/interactions";
import {
    clearOf,
    figure8,
    loadReleaseHitch,
    munterTwoHalfHitches,
    stopper,
    tiedPrusik,
} from "@/rigging/knots";
import { basketedSlingWith, daisyChain, SLINGS, type TapeFeatures } from "@/rigging/slings";
import {
    type Face,
    type Group,
    type Material,
    type Piece,
    type RigLabel,
    type Strand,
} from "@/scene/pieces";
import { moved, posed } from "@/scene/transforms";

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
    | "dark-blue"
    | "mid-blue";

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
    /**
     * Where a rope stops short of the ground: a fixed line just below the outrigger, a carabiner on its end; or hanging
     * `drop` metres down the face from the edge it goes over, with or without a carabiner on its end.
     */
    end?: "below-outrigger" | { drop: number; carabiner: boolean };
    /** How it's tied to its carabiner: a munter and two half hitches (the default) or a figure 8 on a bight. */
    knot?: "M+2HH" | "F8OB";
    /**
     * Which side of its knot the elevation it shows in writes that knot's label, where the side of the drawing it's on
     * would crowd it.
     */
    labelSide?: "left" | "right";
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
    /**
     * Where its spare lies coiled on the deck on the way to its bucket, the middle of the coil (by the tower's sides).
     * Without one, it drapes straight into the bucket.
     */
    coil?: OnDeck;
    /**
     * Its load-release hitch's second carabiner turned half round about the pull, its spine on the other side, so the
     * prusiks' loops (always tied the same way round the rope) reach its bar on the spine side of the pulley.
     */
    flip?: boolean;
    /**
     * How far its prusiks are turned about the rope (radians, right-handed about the rope towards the abseiler), from
     * their legs heading level across it, so their loops line up with its carabiner as the others' do.
     */
    prusikTurn?: number;
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

/**
 * An edge person's safety line: their daisy chain (of colour `dc`) from the carabiner on the sling `from`, which is
 * pulled towards their harness, to them.
 */
export type SafetyLine = { kind: "safety"; id: string; from: string; person: string; dc: RigColor };

export type RigItem = Sling | WrapSling | Rope | Bucket | Belay | Person | SafetyLine;
/** A rig, with its `slug` for its page's address (`/abseil-towers/cracroft/<slug>`). */
export type Rig = { slug: string; name: string; items: RigItem[] };

export const RIGS: Rig[] = [
    {
        slug: "nzrt11",
        name: "NZRT11 4-system mixed rig",
        items: [
            {
                kind: "sling",
                id: "sling-1",
                at: 1.45,
                length: 2,
                color: "red",
                configuration: "basket",
            },
            // Clear of the beam to its east, so it shows from above, just north of the stairs' opening.
            { kind: "bucket", id: "bucket-1", color: "black", place: { east: 2.6, north: 1.47 } },
            {
                kind: "rope",
                id: "rope-1",
                from: "sling-1",
                color: "dark-blue",
                length: 60,
                route: "east-face",
                spare: "bucket-1",
                labelSide: "right",
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
            // Clear of the beam to its west, so it shows from above.
            {
                kind: "bucket",
                id: "bucket-2",
                color: "mid-blue",
                place: { east: 1.9, north: 3.05 },
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
                labelSide: "left",
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
                labelSide: "right",
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
                place: { dueEastOf: "bucket-1", east: 3.0 },
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
                coil: { east: 3.4, north: 1.6 },
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
                color: "mid-blue",
                // Clear of the beam to its west, north of the light blue ropes' bucket.
                place: { east: 1.9, north: 3.6 },
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
                coil: { east: 2.95, north: 3.5 },
                flip: true,
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
                coil: { east: 1.5, north: 3.4 },
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
                labelSide: "left",
            },
            // The belay for it, on level 3: a sling round the stairs' stringer, and its rope up through the redirect.
            {
                kind: "wrap-sling",
                id: "wrap-sling-1",
                // Low on the stringer, so the belay and its bucket sit east of its belayer and abseiler.
                around: { flight: 4, stringer: "north", up: 0.25 },
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
                coil: { east: 1.45, north: 1.25 },
                flip: true,
                prusikTurn: Math.PI / 2,
            },
            { kind: "bucket", id: "bucket-5", color: "yellow", place: { underBelay: "belay-4" } },
            // The photographer's two lines, so they can work over the east edge, each on its own green sling and tied
            // to its carabiner with a double figure 8: one between the two west lines' slings at the south end,
            // ending in a carabiner a metre down, and the other just north of them, hanging free two metres down.
            {
                kind: "sling",
                id: "sling-9",
                at: 0.275,
                length: 3,
                color: "green",
                configuration: "basket",
            },
            {
                kind: "rope",
                id: "rope-6",
                from: "sling-9",
                color: "maroon",
                length: 12,
                route: "east-face",
                knot: "F8OB",
                end: { drop: 1, carabiner: true },
            },
            {
                kind: "sling",
                id: "sling-10",
                at: 0.475,
                length: 3,
                color: "green",
                configuration: "basket",
            },
            {
                kind: "rope",
                id: "rope-7",
                from: "sling-10",
                color: "maroon",
                length: 12,
                route: "east-face",
                knot: "F8OB",
                end: { drop: 2, carabiner: false },
                labelSide: "right",
            },
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
                place: { east: 3.95, north: 2.25, level: 4 },
            },
            // The east edge person's safety line: a 3 m sling in the beam's middle space and a daisy chain to them.
            {
                kind: "sling",
                id: "sling-11",
                at: 2.2,
                length: 3,
                color: "green",
                configuration: "basket",
            },
            {
                kind: "safety",
                id: "safety-1",
                from: "sling-11",
                person: "person-4",
                dc: "dark-blue",
            },
            // SE: at the east railing, under its pair of ropes (the dark blue abseil and white belay).
            {
                kind: "person",
                id: "person-7",
                role: "Abseiler",
                place: { east: 3.95, north: 1.39, level: 4 },
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
                place: { east: 3.95, north: 3.41, level: 4 },
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
                place: { east: 0.92, north: 0.6, level: 3 },
            },
            // Its abseiler, against the west railing, under the rope to the redirect.
            {
                kind: "person",
                id: "person-12",
                role: "Abseiler",
                place: { east: 0.35, north: 0.6, level: 3 },
            },
        ],
    },
];

/** Each rig colour as drawn: the knot pages' colour of that name, or the rig's own for those they don't have. */
export const rigColor = (c: RigColor) =>
    OWN_COLORS.includes(c) ? `var(--rig-${c})` : `var(--knot-${c})`;
const OWN_COLORS: RigColor[] = [
    "black",
    "white",
    "dark-green",
    "dark-red",
    "maroon",
    "dark-blue",
    "mid-blue",
];
/** Colours dark enough that a label on them is written light. */
const DARK_COLORS: RigColor[] = ["black", "dark-green", "dark-red", "maroon", "dark-blue"];

/** The slings' flat tape: climbing slings, 25 mm, as on the flying fox. */
const SLING_T = SLINGS.climbing.thickness;
/** Rope, as round as it's drawn. */
const ROPE_R = 0.0055;
/** How far from an abseil rope a belay beside it crosses the rail. */
const BESIDE_GAP = 0.12;
/** A carabiner's length, from the middle of its top bar to the middle of its bottom bar. */
const KRAB_L = 0.11;
const EAST = vec3(1, 0, 0);
/** The letter each role's disc is labelled with, which the legend spells out. */
const ROLE_LETTER: Record<Person["role"], string> = {
    Abseiler: "A",
    Belayer: "B",
    Edge: "E",
    Supervisor: "S",
    Photographer: "P",
};

/** Each role's disc colour, a pastel that its dark letter reads on. */
const roleColor = (role: Person["role"]) => `var(--person-${role.toLowerCase()})`;

/** The radius of the disc where a person stands. */
const PERSON_R = 0.25;
/** A rope bucket's radius and height, and how far it stands off the steel railing. */
const BUCKET_R = 0.18;
const BUCKET_H = 0.42;
const BUCKET_GAP = 0.06;
/** How much narrower a bucket is at its foot than at its rim. */
const BUCKET_TAPER = 0.8;

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
 * across. It's a climbing sling as on the flying fox, doubled round the back of both logs, each leg's bight round the
 * top bar of its carabiner, which lies along the pull, flat in the plane of the pull and the beam. In 3D the carabiner
 * hangs settled between its loads, or `square` (as a munter's does), its spine along the pull. Gives its pieces, where
 * the carabiner's bottom bar is for what clips to it, and the pull's direction.
 */
function basketSling(
    z: number,
    length: number,
    target: Vector2 | null,
    color: string,
    slant = 0,
    face?: Vector3,
    knotted = false,
    square = false,
): {
    pieces: Piece[];
    clip: Vector3;
    along: Vector3;
    gate: Vector3;
    group?: Group;
    krab: CarabinerFeatures;
    tape: TapeFeatures;
    slingPull: Vector3;
} {
    const { x, lowerY, upperY } = OVERHEAD;
    const centre = vec2(x, (lowerY + upperY) / 2);
    const pull = target ? target.sub(centre).unit() : vec2(0, -1);
    const [lower, upper] = [vec2(x, lowerY), vec2(x, upperY)];
    // A sling is a tied loop of tape, so it goes round doubled: as long round as it lies flat.
    const { clip } = basket(
        stackedLogs(lower, upper, OVERHEAD.r + SLING_T / 2),
        centre,
        pull,
        length,
    );
    // Angled along the beam, the carabiner's carried along it in step with how far out along the pull it is.
    const near = vec3(clip.x, clip.y, z + clip.sub(centre).dot(pull) * slant);
    const along = vec3(pull.x, pull.y, slant).unit();
    const beam = vec3(0, 0, 1);
    const krab = carabiner(
        near,
        along,
        beam.sub(along.scale(beam.dot(along))).unit(),
        face,
        knotted ? "far" : undefined,
        face === undefined && !square,
    );
    const section = stackedLogs(lower, upper, OVERHEAD.r).map((p) => vec3(p.x, p.y, z));
    const up = beam.cross(vec3(pull.x, pull.y, 0));
    const { pieces: sling, tape } = basketedSlingWith(
        "climbing",
        vec3(centre.x, centre.y, z),
        section,
        near,
        CARABINER_R,
        up,
        beam,
        { color, stitched: false },
    );
    return {
        pieces: [
            ...(face && krab.group
                ? slingOnKrab(
                      sling,
                      near,
                      krab.pieces,
                      krab.group,
                      face,
                      vec3(centre.x, centre.y, z),
                  )
                : sling),
            ...krab.pieces,
        ],
        clip: krab.far,
        along,
        gate: krab.gate,
        group: krab.group,
        krab: krab.features,
        tape,
        slingPull: along.neg(),
    };
}

/** How near a sling's carabiner its tape draws over it in a flat view: its bights round the carabiner's bar. */
const SLING_OVER_KRAB = 0.03;
/** How far past a carabiner's bar a sling's tape ends in a flat view. */
const SLING_PAST_BAR = 0.007;

/**
 * A sling on a carabiner hanging from `near` as a flat view draws it: no bights round the carabiner's bar (what's within
 * `SLING_OVER_KRAB` of it), just its legs carried straight on to the bar and ending just past it all across the tape,
 * over the carabiner (`krab`, in its `group`), lying as the legs do from the `log` it's round. How far it goes is measured as it's seen, square to
 * `face`, the way towards the eye: legs coming towards the eye would otherwise end short of the bar.
 */
function slingOnKrab(
    sling: Strand[],
    near: Vector3,
    krab: Piece[],
    group: Group,
    face: Vector3,
    log: Vector3,
): Piece[] {
    const mid = (p: Strand) =>
        p.points.reduce((t, q) => t.add(q), vec3(0, 0, 0)).scale(1 / p.points.length);
    const onKrab = (p: Strand) => mid(p).distanceTo(near) < SLING_OVER_KRAB;
    const legs = sling.filter((p) => !onKrab(p));
    const bights = sling.filter(onKrab);
    const like = bights[0] ?? legs[0];
    if (!like?.tape) return sling;
    // Where the legs get to, coming from the `log` it's round, and the way their tape lies there: on the log's side of
    // the bar, not what's left of the bights round it.
    const up = log.sub(near).unit();
    const [leg, i] = legs
        .flatMap((p) => p.points.map((q, i) => [p, i] as const))
        .filter(([p, i]) => p.points[i].sub(near).dot(up) > SLING_OVER_KRAB)
        .reduce((m, c) =>
            c[0].points[c[1]].distanceTo(near) < m[0].points[m[1]].distanceTo(near) ? c : m,
        );
    const entry = leg.points[i];
    const n = face.unit();
    const toward = near.sub(entry);
    const seen = toward.sub(n.scale(toward.dot(n)));
    const down = seen.len() > 1e-6 ? seen.unit() : toward.unit();
    const at = leg.tape?.profile?.[i];
    const size = at ?? leg.tape ?? like.tape;
    const lying = at?.across ?? leg.tape?.across ?? like.tape.across;
    const across = lying.sub(down.scale(lying.dot(down))).unit();
    // Just past the bar wherever the tape's over it: the bend curves away from the middle, so further in at its edges.
    const half = size.width / 2;
    const under = krab
        .flatMap((p) => (p.kind === "strand" ? p.points : []))
        .filter((q) => {
            const d = q.sub(near);
            return Math.abs(d.dot(across)) <= half && d.dot(down) < KRAB_L / 3;
        })
        .map((q) => q.sub(near).dot(down));
    const end = near.add(down.scale(Math.max(0, ...under) + CARABINER_R + SLING_PAST_BAR));
    const band: Piece = {
        ...like,
        points: [entry, end],
        capA: false,
        capB: true,
        tape: {
            ...like.tape,
            width: size.width,
            thickness: size.thickness,
            across,
            layers: 1,
            gather: entry,
            profile: undefined,
        },
        group: { ...group, over: true, order: 6 },
    };
    return [...legs, band];
}

/**
 * A carabiner (the CT D, as on the flying fox) hanging from `near` by its narrow end (the middle of that end's bar),
 * lying `along` a pull, flat in the plane with `across`: the sling always goes to the narrow end, the rope to the wide
 * one. Its gate is on whichever side of it is lower, or on the `across` side when it hangs straight down. Gives its
 * pieces, the middle of its wide end's bar, where what clips to it hangs, and the way its gate faces.
 *
 * In a flat view it's laid `face` on to the eye (`face` the way towards it), lying along the pull as far as the view
 * shows it, and drawn as one group whatever the view: its body, its sleeve over that, and the grip over the sleeve.
 * Gives that group too, for a knot clipped to it to draw over it. With a knot tied round one end (`knotAt`), the gate's
 * side of that end's bend draws over the knot, so the bar passes over one side of the knot's bight and under the other,
 * as if it's clipped through.
 *
 * It's `settled` between two loads (by default in 3D), turned until each sits in the bottom of its bend, in line along
 * the pull. Unsettled (by default in a flat view, and on a rope's end with nothing clipped to it), it hangs unturned,
 * its spine along the pull, from the middle of its narrow end, and what clips to its wide end sits on that end's bar
 * straight along from there: drawn face on, a knot's loop then shows clipped through the middle of its end.
 */
function carabiner(
    near: Vector3,
    along: Vector3,
    across: Vector3,
    face?: Vector3,
    knotAt?: "near" | "far",
    settled = face === undefined,
): {
    pieces: Piece[];
    far: Vector3;
    gate: Vector3;
    group?: Group;
    features: CarabinerFeatures;
} {
    let down = along.unit();
    let gate = across.y > 1e-6 ? across.neg() : across;
    if (face) {
        const n = face.unit();
        const seen = down.sub(n.scale(down.dot(n)));
        down = seen.len() > 1e-3 ? seen.unit() : gate.sub(n.scale(gate.dot(n))).unit();
        const side = n.cross(down).unit();
        gate = side.dot(gate) < 0 ? side.neg() : side;
    }
    // `carabiner` hangs a D from its wide end (the photo's top), so it's hung from the far end, turned up. Its body comes
    // first, then the sleeve on its gate and the grip round the sleeve.
    const {
        pieces: [body, ...sleeve],
        features,
    } = ctCarabiner(near.add(down.scale(KRAB_L)), down.neg(), gate, "var(--tower-steel)", KRAB_L, {
        settled,
        centred: !settled,
    });
    // Unturned, the wide end's bar crosses the line along the pull from the narrow end's middle short of the far end.
    const far = settled ? near.add(down.scale(KRAB_L)) : wideBar(body, near, down);
    if (!face) return { pieces: [body, ...sleeve], far, gate, features };
    const group = { at: near.lerp(far, 0.5) };
    const sleeveR = Math.min(...sleeve.map((p) => (p.kind === "rod" ? p.r : Infinity)));
    // The end the knot's round, and the way into the carabiner from it.
    const [end, inward] = knotAt === "near" ? [near, down] : [far, down.neg()];
    const overKnot = (points: Vector3[]) => {
        const mid = points.reduce((t, q) => t.add(q), vec3(0, 0, 0)).scale(1 / points.length);
        return (
            knotAt !== undefined && mid.sub(end).dot(inward) < 0.015 && mid.sub(end).dot(gate) > 0
        );
    };
    return {
        pieces: [
            ...(body.kind === "strand"
                ? lengths(body.points).map((points) => ({
                      ...body,
                      points,
                      group: overKnot(points)
                          ? { ...group, over: true, order: 5 }
                          : { ...group, order: 1 },
                  }))
                : [{ ...body, group: { ...group, order: 1 } }]),
            ...sleeve.map((p) => ({
                ...p,
                group: { ...group, over: true, order: p.kind === "rod" && p.r > sleeveR ? 3 : 2 },
            })),
        ],
        far,
        gate,
        group,
        features,
    };
}

/**
 * Where a carabiner's body crosses the line from `near` on `down`, at its far end: the middle of its bar there, as near
 * as its points give it.
 */
function wideBar(body: Piece, near: Vector3, down: Vector3): Vector3 {
    if (body.kind !== "strand") return near.add(down.scale(KRAB_L));
    const off = (p: Vector3) =>
        p
            .sub(near)
            .sub(down.scale(p.sub(near).dot(down)))
            .len();
    const far = body.points.filter((p) => p.sub(near).dot(down) > KRAB_L / 2);
    const crossing = far.reduce((m, p) => (off(p) < off(m) ? p : m));
    return near.add(down.scale(crossing.sub(near).dot(down)));
}

/**
 * The narrowest rope and steel are drawn in the flat views (SVG units): their true width, in proportion with everything
 * else, but never thinner than a hairline, so they still show zoomed out.
 */
export const FLAT_HAIRLINE = { rope: 1.2, steel: 1 };

/** Where a rope pulls towards, in the overhead beam's cross-section: the outer corner of the top rail it goes over. */
const PULL: Record<Rope["route"], Vector2> = {
    "east-face": vec2(EAST_EDGE.rail.x, EAST_EDGE.rail.y + ROPE_R),
    "west-outrigger": vec2(WEST_EDGE.rail.x, WEST_EDGE.rail.y + ROPE_R),
    "west-face": vec2(WEST_EDGE.rail.x, WEST_EDGE.rail.y + ROPE_R),
};

/**
 * The drawn knots' labels, which knot labels turn on and off: a figure 8 on a bight where a rope's tied to its sling's
 * carabiner and on every rope's end that finishes in a carabiner, a figure 8 stopper on every other rope's end, a
 * munter and two half hitches, and a belay's load-release hitch.
 */
export const KNOT_LABELS = {
    bight: "F8OB",
    stopper: "F8",
    munter: "M+2HH",
    lrh: "LRH",
    tbp: "TBP",
    dc: "DC",
};
/** A munter and two half hitches' label, and the cylinder it's drawn as in 3D with knot labels on, in the rope's colour. */
const HITCH = { text: KNOT_LABELS.munter, r: 0.055, length: 0.25 };
const DOWN = vec3(0, -1, 0);
/**
 * The way an end carabiner's narrow bar runs, hanging off a side whose outside is `out`: turned half way out from the
 * side, so both it and the figure 8 clipped to it (which lies square to it) show in the elevations.
 */
const endBar = (out: Vector3) => out.add(vec3(0, 0, 1)).unit();
/**
 * A knot's rope in short pieces, so they sort among themselves in the flat views and its crossings show: open at its
 * start, where the rope runs into it, and capped at its tail's end.
 */
const knotRope = (rope: Vector3[], color: string): Piece[] =>
    lengths(rope).map((points, i, all) =>
        strand(points, ROPE_R, "rope", color, false, i === all.length - 1),
    );

/**
 * Points cut into short lengths of `n` steps, so a knot or a carabiner sorts piece by piece in the flat views: in front
 * of what it passes over and behind what it passes under. Each reaches a step into the next and the last, so they join
 * on a straight stretch both cover, and no seam shows across a bend whichever's drawn over the other.
 */
export function lengths(points: Vector3[], n = 4): Vector3[][] {
    const out: Vector3[][] = [];
    for (let i = 0; i < points.length - 1; i += n)
        out.push(points.slice(Math.max(0, i - 1), Math.min(points.length, i + n + 2)));
    return out;
}
/** How far a figure 8 stopper reaches down from where the rope goes into it. */
const STOPPER_DROP = -Math.min(...stopper(vec3(0, 0, 0), DOWN, ROPE_R).map((p) => p.y));

/** A drawn knot's label, at the middle of its rope: written beside it (the elevations) or on it (looking down). */
function knotLabel(
    rope: Vector3[],
    text: string,
    shell?: Piece["shell"],
    side?: RigLabel["side"],
): RigLabel {
    const at = rope.reduce((sum, p) => sum.add(p), vec3(0, 0, 0)).scale(1 / rope.length);
    return { at, text, shell, side };
}

/** The connection between a rope's end knot and the carabiner hanging from it, if it's drawn as it's tied. */
function endConnection(
    id: string,
    tail: { knot?: Vector3[]; hang: Vector3 },
    krab: { features: CarabinerFeatures } | false | undefined,
): Connection[] {
    if (!krab || !tail.knot) return [];
    return [
        {
            kind: "figure-8-on-carabiner",
            id: `${id}: the carabiner on its end`,
            arrangement: "end",
            carabiner: krab.features,
            knot: { rope: tail.knot, r: ROPE_R },
            pull: tail.hang.neg(),
        },
    ];
}

/**
 * The knot on a rope's end, which hangs straight down to `end`: with a carabiner hanging from `end` (its narrow end's
 * bar running along `bar`), a figure 8 on a bight round that bar; without one, a figure 8 stopper whose foot is at
 * `end`. It's outside the tower with the rope, in `shell`, and moved out from the side it hangs against (`shell.out`)
 * as far as it takes to stay clear of it: the rope hangs against the side, but a figure 8 is thicker. Drawn as it's
 * tied, or as a labelled `cylinder` from its top to its foot.
 *
 * In a flat view it's laid `face` on to the eye, and its carabiner with it; looking down on it, where it would hang
 * straight away from the eye, it's laid out level from the side instead, clear of it. Its pieces draw over its
 * carabiner's.
 *
 * Gives its pieces, where the rope goes into it, its label, where `end` was moved to, and the way its carabiner hangs
 * from there.
 */
function endKnot(
    end: Vector3,
    color: RigColor,
    shell: NonNullable<Piece["shell"]>,
    bar: Vector3 | undefined,
    cylinders: boolean,
    face?: Vector3,
): {
    pieces: Piece[];
    into: Vector3;
    label: RigLabel;
    at: Vector3;
    hang: Vector3;
    knot?: Vector3[];
} {
    const n = face?.unit();
    const seen = (v: Vector3) => (n ? v.sub(n.scale(v.dot(n))) : v);
    // Laid out level where it would hang straight away from the eye.
    const laid = n !== undefined && seen(DOWN).len() < 0.5;
    const hang = laid ? seen(shell.out).unit() : seen(DOWN).unit();
    const knot = bar && figure8(end, n ?? bar, CARABINER_R, end.sub(hang), ROPE_R);
    const drawn = knot
        ? knot.rope.reverse()
        : stopper(end.sub(hang.scale(STOPPER_DROP)), hang, ROPE_R);
    // Moved across so the rope goes straight into it: its standing part in line with where it hangs from.
    const lead = end.sub(drawn[0]);
    const across = lead.sub(hang.scale(lead.dot(hang)));
    const lateral = n ? across.sub(n.scale(across.dot(n))) : across;
    const tied = drawn.map((p) => p.add(lateral));
    // Clear of the side: laid out, past where it hangs; hanging, as far out as it reaches back into the side.
    const back = Math.max(...tied.map((p) => end.sub(p).dot(shell.out)));
    const shift = laid
        ? hang.scale((knot ? knot.reach : STOPPER_DROP) + 0.01)
        : shell.out.scale(Math.max(0, back));
    const rope = tied.map((p) => p.add(shift));
    const at = end.add(lateral).add(shift);
    const text = bar ? KNOT_LABELS.bight : KNOT_LABELS.stopper;
    const into = rope[0];
    // Face on, it draws over its carabiner, which hangs from `at` along `hang`.
    const group = n && { at: at.add(hang.scale(KRAB_L / 2)), over: true, order: 4 };
    // With knots as labelled cylinders, still drawn as it's tied, a cylinder round it: a figure 8's short of the
    // carabiner its loop goes round, which hangs from `at`.
    const around = cylinders
        ? enclosing(
              rope
                  .filter((q) => !bar || q.sub(at).dot(hang) < -(CARABINER_R + ROPE_R + 0.003))
                  .map((q) => ({ at: q, r: ROPE_R })),
              hang,
              text,
          )
        : undefined;
    return {
        pieces: [
            ...knotRope(rope, rigColor(color)).map((p) => ({
                ...p,
                shell,
                ...(group && { group }),
            })),
            ...(around
                ? banded(around.a, around.b, around.r, [rigColor(color)], 1).map((p) => ({
                      ...p,
                      shell,
                  }))
                : []),
        ],
        into,
        // Laid out with a carabiner on it, it's called out from past the carabiner's far end, clear of both.
        label: around
            ? onCylinder(around, text, DARK_COLORS.includes(color), { shell })
            : laid && bar
              ? { ...knotLabel(rope, text, shell), at: at.add(hang.scale(KRAB_L + 0.01)) }
              : knotLabel(rope, text, shell),
        at,
        hang,
        knot: knot ? rope : undefined,
    };
}

/** How far apart along the beam ropes sharing one carabiner sit. */
const SHARED_GAP = 0.1;

/**
 * Where a rope goes after the top rail, in the beam's cross-section at `z`. Over the east side: out over the edge of the
 * east face's boarding and straight down the face to the ground. Over the west side: down onto the outrigger log (where
 * it first touches it from the rail), round its top to its outer side and straight down to the lower ground there;
 * or, dropping straight past the railing, down the west side clear of its beams and boarding to the ground.
 */
function beyondRail(route: Rope["route"], z: number, end?: Rope["end"]): Vector3[] {
    // Straight down from where it leaves the side: to the ground, or as far as it hangs.
    const down = (edge: Vector3) =>
        typeof end === "object"
            ? vec3(edge.x, edge.y - end.drop, z)
            : vec3(edge.x, groundAt(edge.x) + 0.02, z);
    if (route === "east-face") {
        const edge = vec3(EAST_EDGE.boarding.x + ROPE_R, EAST_EDGE.boarding.y, z);
        return [edge, down(edge)];
    }
    if (route === "west-face") {
        const edge = vec3(WEST_EDGE.clear.x - ROPE_R, WEST_EDGE.clear.y, z);
        return [edge, down(edge)];
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
    if (end === "below-outrigger") return [...round, belowOutrigger(z)];
    return [...round, down(vec3(x - r, round[round.length - 1].y, z))];
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
    gate: Vector3,
    cylinders: boolean,
    face?: Vector3,
    krabGroup?: Group,
    krab?: CarabinerFeatures,
): {
    pieces: Piece[];
    labels: RigLabel[];
    through?: Vector3;
    connections: Connection[];
    /** Where the knot's tail ends, when it's drawn, and the way it's heading: the rest of the rope runs on from there. */
    tail?: { at: Vector3; heading: Vector3 };
} {
    const { route, end } = rope;
    const last = beyondRail(route, clip.z, end).at(-1)!;
    const out = route === "east-face" ? EAST : EAST.neg();
    const shell = { out, layer: 3 };
    // A carabiner on the end, hanging from its knot flat against the side.
    const across = endBar(out);
    const clipped = end === "below-outrigger" || (typeof end === "object" && end.carabiner);
    // Every end has a knot: a figure 8 for its carabiner, or a stopper.
    const tail = endKnot(last, rope.color, shell, clipped ? across : undefined, cylinders, face);
    const endKrab =
        clipped && carabiner(tail.at, tail.hang, across, face, "near", end === "below-outrigger");
    const color = rigColor(rope.color);
    // Tied to its sling's carabiner round its wide end with a figure 8 on a bight, lying towards the rail, or a munter
    // and two half hitches; with knots as cylinders, the munter's is still drawn as tied, a labelled cylinder round it
    // (and without its carabiner drawn as tied, along the pull from a little back over the end).
    let tied: {
        pieces: Piece[];
        from: Vector3[];
        label: RigLabel;
        tail?: { at: Vector3; heading: Vector3 };
    };
    const connections = endConnection(rope.id, tail, endKrab);
    if (rope.knot === "F8OB") {
        const rail = vec3(PULL[route].x, PULL[route].y, clip.z);
        // Face on in a flat view, over its carabiner.
        const tiedKnot = figure8(clip, face ?? gate, CARABINER_R, rail, ROPE_R);
        // In 3D its bight follows the carabiner's tight wide end, not the straight bar it's shaped round.
        const knot =
            krab && !face
                ? { ...tiedKnot, rope: clearOf(tiedKnot.rope, krab.loop, krab.r + ROPE_R) }
                : tiedKnot;
        if (krab && !cylinders)
            connections.push({
                kind: "figure-8-on-carabiner",
                id: `${rope.id}: tied to its sling's carabiner`,
                arrangement: "anchor",
                carabiner: krab,
                knot: { rope: knot.rope, r: ROPE_R },
                pull: rail.sub(clip).unit(),
            });
        const group = krabGroup && { ...krabGroup, over: true, order: 4 };
        // With knots as labelled cylinders, still drawn as it's tied, a cylinder round it short of the carabiner.
        const around = cylinders
            ? enclosing(
                  knot.rope
                      .filter((q) => !krab || clearOfLoops(q, [krab.loop], krab.r + ROPE_R + 0.003))
                      .map((q) => ({ at: q, r: ROPE_R })),
                  knot.end.sub(clip).unit(),
                  KNOT_LABELS.bight,
              )
            : undefined;
        tied = {
            pieces: [
                ...knotRope([...knot.rope].reverse(), color).map((p) => ({
                    ...p,
                    ...(group && { group }),
                })),
                ...(around ? banded(around.a, around.b, around.r, [color], 1) : []),
            ],
            from: [knot.end],
            label: around
                ? onCylinder(around, KNOT_LABELS.bight, DARK_COLORS.includes(rope.color), {
                      side: rope.labelSide,
                  })
                : knotLabel(knot.rope, KNOT_LABELS.bight, undefined, rope.labelSide),
        };
    } else if (krab) {
        // Face on in a flat view, as its carabiner is.
        const knot = munterTwoHalfHitches(krab);
        // Each length over the carabiner where it's on the eye's side of it, and under it where it's behind.
        const side = (p: Piece) =>
            face && krabGroup && p.kind === "strand"
                ? p.points
                      .reduce((t, q) => t.add(q), vec3(0, 0, 0))
                      .scale(1 / p.points.length)
                      .sub(krabGroup.at)
                      .dot(face)
                : 1;
        // With knots as labelled cylinders, still drawn as it's tied, a cylinder round it short of the carabiner.
        const around = cylinders
            ? enclosing(
                  knot.rope
                      .filter((q) => clearOfLoops(q, [krab.loop], krab.r + ROPE_R + 0.003))
                      .map((q) => ({ at: q, r: ROPE_R })),
                  along,
                  HITCH.text,
              )
            : undefined;
        tied = {
            pieces: [
                ...knotRope(knot.rope, color).map((p) => ({
                    ...p,
                    ...(krabGroup && {
                        group:
                            side(p) >= 0
                                ? { ...krabGroup, over: true, order: 4 }
                                : { ...krabGroup, order: 0 },
                    }),
                })),
                ...(around ? banded(around.a, around.b, around.r, [color], 1) : []),
            ],
            from: [knot.end],
            label: around
                ? onCylinder(around, HITCH.text, DARK_COLORS.includes(rope.color), {
                      side: rope.labelSide,
                  })
                : knotLabel(knot.rope, HITCH.text, undefined, rope.labelSide),
            tail: { at: knot.rope.at(-1)!, heading: knot.rope.at(-1)!.sub(knot.rope.at(-2)!) },
        };
    } else {
        const hitch = clip.add(along.scale(HITCH.length));
        const start = clip.sub(along.scale(0.02));
        tied = {
            pieces: [
                {
                    kind: "rod",
                    a: start,
                    b: hitch,
                    r: HITCH.r,
                    material: "rope",
                    color,
                    capA: true,
                    capB: true,
                },
            ],
            from: [hitch],
            label: {
                at: start.lerp(hitch, 0.5),
                text: HITCH.text,
                on: { along, length: hitch.distanceTo(start), r: HITCH.r },
                light: DARK_COLORS.includes(rope.color),
                side: rope.labelSide,
            },
        };
    }
    return {
        pieces: [
            ...tied.pieces,
            ...toGround(route, tied.from, color, end, tail.into),
            ...tail.pieces,
            ...(endKrab ? endKrab.pieces.map((p) => ({ ...p, shell })) : []),
        ],
        labels: [tail.label, tied.label],
        // A rope round a fixed line's end carabiner bears on the inside of its lower end.
        through:
            endKrab && end === "below-outrigger"
                ? endKrab.far.add(vec3(0, ROPE_R + CARABINER_R, 0))
                : undefined,
        connections,
        tail: tied.tail,
    };
}

/**
 * Rope from `from` (its points in order, up to where it leaves for the rail: from a knot, or the end of a hitch) across to
 * the top rail, over its outer corner and on down that side (`beyondRail`) to where it goes `into` the knot on its end.
 * What's past the rail is outside the tower, so it sorts as outside that side of the shell.
 */
function toGround(
    route: Rope["route"],
    from: Vector3[],
    color: string,
    end: Rope["end"],
    into: Vector3,
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
    // It goes into the top of the knot on its end.
    const [off, foot] = [beyond[beyond.length - 2] ?? landing, into];
    const leaving = off.add(
        foot
            .sub(off)
            .unit()
            .scale(Math.min(0.3, off.distanceTo(foot) / 2)),
    );
    const past = [nearRail, rail, landing, ...beyond.slice(0, -1), leaving, foot];
    // It's cut at the edge it goes over too, so the stretch lying across what's below the rail (the top deck's ledge
    // outside the east railing) sorts above the deck, apart from the drop.
    const cuts = [0, 2, 3, past.length - 2, past.length - 1].filter(
        (c, i, cs) => cs.indexOf(c) === i && c < past.length,
    );
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

/** A load-release hitch's label, and the cylinder it's drawn as in 3D with knot labels on: longer and thinner than a rope's hitch. */
const LRH = { text: KNOT_LABELS.lrh, r: 0.035, length: 0.35 };
/** A daisy chain's label. */
const DC = { text: KNOT_LABELS.dc };
/** How high above the deck a person's harness is, where their daisy chain clips in. */
const HARNESS_H = 1.0;

/** Where a person stands: the middle of their disc, just on their deck. */
function personCentre(person: Person): Vector3 {
    const { place } = person;
    const inside = LOG_R + PERSON_R + 0.05;
    // On the top deck the east railing stands in from the side.
    const east = place.level === 4 ? EAST_EDGE.inside - PERSON_R - 0.05 : SIDE - inside;
    const [x, z] =
        "inCorner" in place
            ? [
                  place.inCorner.includes("E") ? east : inside,
                  place.inCorner.includes("N") ? SIDE - inside : inside,
              ]
            : [place.east, place.north];
    return vec3(x, LEVELS[place.level] + 0.01, z);
}
/** How far the LRH's second carabiner is turned in its own plane, squaring the bar its pulley hangs from (radians). */
const LRH_TURN = (10 * Math.PI) / 180;

/**
 * Tandem belay prusiks, drawn as one cylinder round the rope: its upper half one cord's colour, its lower the other's.
 * Their pulley's plates are red.
 */
const TBP = {
    text: KNOT_LABELS.tbp,
    /** How far along the rope from the pulley's shoulders the prusiks reach, the second's end where the rope goes on. */
    length: 0.26,
    plates: "red" as RigColor,
    /** Their cord's radius: 8 mm cord. */
    cordR: 0.004,
    /** How far apart along the rope the two prusiks' middles are. */
    apart: 0.07,
    /**
     * Where the prusiks' loops go round the carabiner's bar, round it from the middle of the pulley towards the spine:
     * as tied in the knot file (from the lower's hitch), the upper's (just clear of the pulley's plate), and the
     * lower's (far enough on to clear the upper's).
     */
    tiedAt: 0.0265,
    upperAt: 0.0175,
    lowerAt: 0.0255,
    /** How much further out from the rope the lower prusik's loop bulges than as tied, to give the upper's room. */
    slack: 0.009,
    /** How much further down the rope (towards the abseiler) the lower prusik's loop bows than as tied. */
    sag: 0.01,
    /** How far the loops' legs are eased apart across the rope (the upper's to -Z, the lower's to +Z) at their middles. */
    nudge: 0.006,
    /** How far the upper prusik's lower leg is eased on to +Z beside the pulley's axle, and how far along the rope that reaches. */
    tuck: 0.004,
    tuckReach: 0.02,
    /** How much further out from the carabiner's bar the loops go round it than as tied. */
    clear: 0.0025,
    /** How far the lower prusik's wrap round the bar is canted outwards, away from the upper's (radians). */
    cant: (10 * Math.PI) / 180,
};

/** Arc lengths along `points` from the first, at each. */
function arcLengths(points: readonly Vector3[]): number[] {
    const out = [0];
    for (let k = 1; k < points.length; k++)
        out.push(out[k - 1] + points[k].distanceTo(points[k - 1]));
    return out;
}

/** The index of the point of `points` nearest `to`. */
function nearestIndex(points: readonly Vector3[], to: Vector3): number {
    return points.reduce((b, q, k) => (q.distanceTo(to) < points[b].distanceTo(to) ? k : b), 0);
}

/**
 * A prusik's loop as tied (`tied`, leg end to leg end), going round a carabiner's bar at `was`, hung instead round it at
 * `to` from the same hitch. Where it goes round the bar it's carried there, turned as the bar turns between the two, so
 * it wraps the bar the same; between there and the hitch it's turned and stretched or shrunk about where it leaves the
 * hitch, to reach; and at its legs' ends it's as tied, so it leaves the hitch as tied. Given `square`, the wrap is
 * turned on about the bar's middle to lie square to it (parallel to a pulley's side plates, `square` their normal).
 * It's eased `clear` further out from the bar all round. Then it's smoothed, except round the bar and at the legs' ends.
 */
function rehungLoop(
    tied: readonly Vector3[],
    was: { at: Vector3; along: Vector3 },
    to: { at: Vector3; along: Vector3 },
    square?: Vector3,
    clear = 0,
): Vector3[] {
    const turn = (v: Vector3, from: Vector3, onto: Vector3) => {
        const axis = from.cross(onto);
        return axis.len() > 1e-12 ? v.turned(axis.unit(), from.angleTo(onto)) : v;
    };
    const carried = (q: Vector3) => to.at.add(turn(q.sub(was.at), was.along, to.along));
    const tip = nearestIndex(tied, was.at);
    const lengths = arcLengths(tied);
    const total = lengths.at(-1)!;
    const inWrap = (k: number) => Math.abs(lengths[k] - lengths[tip]) < 0.1 * total;
    // The wrap's plane, by Newell's sum over its points as carried, turned to be square to `square`.
    const wrap = tied.filter((_, k) => inWrap(k)).map(carried);
    const centre = wrap.reduce((t, q) => t.add(q), vec3(0, 0, 0)).scale(1 / wrap.length);
    let normal = vec3(0, 0, 0);
    for (let k = 1; k < wrap.length; k++)
        normal = normal.add(wrap[k - 1].sub(centre).cross(wrap[k].sub(centre)));
    const onto = square && (normal.dot(square) < 0 ? square.neg() : square);
    // Then eased out from the bar's middle by `clear`, to clear it.
    const wrapped = (q: Vector3) => {
        const v = onto ? turn(carried(q).sub(to.at), normal, onto) : carried(q).sub(to.at);
        const out = v.sub(to.along.scale(v.dot(to.along)));
        return to.at.add(v).add(out.unit().scale(clear));
    };
    const base = tied[0].lerp(tied.at(-1)!, 0.5);
    const reach = tied[tip].sub(base);
    const reached = wrapped(tied[tip]).sub(base);
    const scaled = (q: Vector3) =>
        base.add(turn(q.sub(base), reach, reached).scale(reached.len() / reach.len()));
    const ease = (t: number) => {
        const u = Math.min(1, Math.max(0, t));
        return u * u * (3 - 2 * u);
    };
    const fromEnds = tied.map((_, k) =>
        ease(Math.min(lengths[k], total - lengths[k]) / (0.35 * total)),
    );
    const nearTip = tied.map((_, k) =>
        ease(1 - Math.abs(lengths[k] - lengths[tip]) / (0.2 * total)),
    );
    let loop = tied.map((q, k) => q.lerp(scaled(q).lerp(wrapped(q), nearTip[k]), fromEnds[k]));
    // Smoothed by repeatedly easing each point towards its neighbours' middle, held round the bar and at the ends.
    const free = tied.map((_, k) => fromEnds[k] * (1 - nearTip[k]));
    for (let pass = 0; pass < 200; pass++)
        loop = loop.map((q, k) =>
            k === 0 || k === loop.length - 1
                ? q
                : q.lerp(loop[k - 1].lerp(loop[k + 1], 0.5), 0.5 * free[k]),
        );
    return loop;
}

/**
 * A prusik's loop (`loop`, leg end to leg end, round a bar furthest along it) with `slack` more in it: each leg pushed
 * out from the rope (through `middle`, along `along`), and moved by `push` too, most halfway between the hitch and the
 * bar, not at all at either.
 */
function slackened(
    loop: readonly Vector3[],
    middle: Vector3,
    along: Vector3,
    slack: number,
    push: Vector3,
): Vector3[] {
    const arc = arcLengths(loop);
    const total = arc.at(-1)!;
    const tip = loop.reduce(
        (b, q, k) => (q.distanceTo(middle) > loop[b].distanceTo(middle) ? k : b),
        0,
    );
    return loop.map((q, k) => {
        const s = k <= tip ? arc[k] / arc[tip] : (total - arc[k]) / (total - arc[tip]);
        const off = q.sub(middle);
        const out = off.sub(along.scale(off.dot(along)));
        const bump = Math.sin(Math.PI * s) ** 2;
        return q.add(out.unit().scale(slack * bump)).add(push.scale(bump));
    });
}
/** How far down past the top rail's outer corner a belay rope hangs, waiting for its abseiler, a carabiner on its end. */
const BELAY_DROP = 0.35;

/** A belay's load-release hitch drawn as a labelled cylinder along the pull from `clip`, a carabiner on its end. */
function lrhCylinder(
    belay: Belay,
    clip: Vector3,
    along: Vector3,
    across: Vector3,
    face?: Vector3,
): {
    pieces: Piece[];
    label: RigLabel;
    far: Vector3;
    bar: Vector3;
    hangs: Vector3;
    onBar: (offset: number) => { at: Vector3; along: Vector3 };
} {
    const tied = clip.sub(along.scale(0.02));
    const lrhEnd = clip.add(along.scale(LRH.length));
    const krab = carabiner(lrhEnd.sub(along.scale(0.015)), along, across, face);
    return {
        pieces: [
            {
                kind: "rod",
                a: tied,
                b: lrhEnd,
                r: LRH.r,
                material: "rope",
                color: rigColor(belay.lrh),
                capA: true,
                capB: true,
            },
            ...krab.pieces,
        ],
        label: {
            at: tied.lerp(lrhEnd, 0.5),
            text: LRH.text,
            on: { along, length: lrhEnd.distanceTo(tied), r: LRH.r },
        },
        far: krab.far,
        bar: across,
        hangs: along,
        onBar: (offset) => ({ at: krab.far.add(across.scale(offset)), along: across }),
    };
}

/**
 * A belay's load-release hitch as it's tied, on the sling's carabiner (`krab`, hanging square): its cord and its second
 * carabiner, settled below. In a flat view, laid face on with the sling's carabiner, each carabiner draws as a group
 * (its body, its sleeve over that), and each short length of cord over the carabiner it's nearest where it's on the
 * eye's side of it, under it where it's behind. Gives its pieces, its label beside it, and the second carabiner's narrow
 * end, where the prusiks hang.
 */
function tiedLrh(
    belay: Belay,
    krab: CarabinerFeatures,
    face?: Vector3,
    krabGroup?: Group,
): {
    pieces: Piece[];
    label: RigLabel;
    far: Vector3;
    bar: Vector3;
    hangs: Vector3;
    onBar: (offset: number) => { at: Vector3; along: Vector3 };
    /** Its cord and the cord's radius, and its second carabiner's centreline. */
    cord: Vector3[];
    cordR: number;
    loop: Vector3[];
} {
    const color = rigColor(belay.lrh);
    const { cord, r, lower } = loadReleaseHitch(krab);
    // Hanging square, not settled: its narrow end's middle where the figure 8's loop holds it (where the settled one's
    // was), along the way it was tied.
    // Turned half round about the pull if it's flipped.
    const across = belay.flip ? lower.across.neg() : lower.across;
    const settled = ctCarabiner(lower.top, lower.down, across, "var(--tower-steel)", KRAB_L, {
        settled: true,
    });
    const square = ctCarabiner(lower.top, lower.down, across, "var(--tower-steel)", KRAB_L, {
        centred: true,
    });
    const shift = settled.features.bottom.sub(square.features.bottom);
    const pivot = settled.features.bottom;
    const axis = lower.down.unit();
    const n = lower.down.cross(across).unit();
    const shifted = square.features.loop.map((q) => q.add(shift));
    // Where the line straight down the pull from the figure 8's loop crosses its wide end.
    const offLine = (q: Vector3) => {
        const v = q.sub(pivot);
        return v.sub(axis.scale(v.dot(axis))).len();
    };
    const { from, to } = square.features.stretches.top;
    const crossing = (loop: Vector3[]) => {
        let k = from;
        for (let i = from; i <= to; i++) if (offLine(loop[i]) < offLine(loop[k])) k = i;
        return k;
    };
    // Turned a little in its own plane about the loop, the way that brings the bar there squarer to the pull.
    const k0 = crossing(shifted);
    const slope0 = shifted[k0 + 1].sub(shifted[k0 - 1]);
    const turn = Math.sign(n.dot(axis.cross(slope0)) * axis.dot(slope0)) * LRH_TURN;
    const turnPoint = (q: Vector3) => q.sub(pivot).turned(n, turn).add(pivot);
    const second = {
        pieces: posed(moved(moved(square.pieces, shift), pivot.neg()), {
            at: pivot,
            axis: n,
            angle: turn,
        }),
        features: { ...square.features, loop: shifted.map(turnPoint) },
    };
    const middle = (pts: readonly Vector3[]) =>
        pts.reduce((t, q) => t.add(q), vec3(0, 0, 0)).scale(1 / pts.length);
    const lengthsOf = lengths(cord).map((points, i, all) =>
        strand(points, r, "rope", color, i === 0, i === all.length - 1),
    );
    const label = knotLabel(cord, LRH.text);
    // The pulley hangs centred in its wide end, straight down the pull from the figure 8's loop, square to the pull:
    // its axle straight across, though the bar slopes a little there, which its eyes, centred on it, are wide enough
    // to take.
    const loop = second.features.loop;
    const k = crossing(loop);
    const far = loop[k];
    const slope = loop[k + 1].sub(loop[k - 1]);
    const bar = slope.sub(axis.scale(slope.dot(axis))).unit();
    const hangs = axis.neg();
    // Where along its bar, `offset` round it from where the pulley hangs towards the spine.
    const onBar = (offset: number) => {
        let j = k;
        for (let gone = 0; gone < offset && j > 1; j--) gone += loop[j].distanceTo(loop[j - 1]);
        return { at: loop[j], along: loop[j + 1].sub(loop[j - 1]).unit() };
    };
    if (!face || !krabGroup)
        return {
            pieces: [...second.pieces, ...lengthsOf],
            label,
            far,
            bar,
            hangs,
            onBar,
            cord,
            cordR: r,
            loop,
        };
    const group = { at: middle(second.features.loop) };
    const [body, ...sleeve] = second.pieces;
    const sleeveR = Math.min(...sleeve.map((p) => (p.kind === "rod" ? p.r : Infinity)));
    const groups = [krabGroup, group];
    return {
        pieces: [
            { ...body, group: { ...group, order: 1 } },
            ...sleeve.map((p) => ({
                ...p,
                group: { ...group, over: true, order: p.kind === "rod" && p.r > sleeveR ? 3 : 2 },
            })),
            ...lengthsOf.map((p) => {
                const at = p.kind === "strand" ? middle(p.points) : vec3(0, 0, 0);
                const near = groups.reduce((m, g) =>
                    g.at.distanceTo(at) < m.at.distanceTo(at) ? g : m,
                );
                return {
                    ...p,
                    group:
                        at.sub(near.at).dot(face) >= 0
                            ? { ...near, over: true, order: 4 }
                            : { ...near, order: 0 },
                };
            }),
        ],
        label,
        far,
        bar,
        hangs,
        onBar,
        cord,
        cordR: r,
        loop,
    };
}

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
 * How tall a knot cylinder's label is written (metres), on every cylinder alike: as the load-release hitch's was when
 * it was sized to fit its cylinder.
 */
const CYLINDER_FONT = 0.05;
/** The thinnest and shortest a cylinder can be to take its label at that height (as `KnotLabel` fits text to them). */
const cylinderAtLeast = (text: string) => ({
    r: CYLINDER_FONT / (0.7 * 2),
    length: (CYLINDER_FONT * text.length * 0.6) / 0.72,
});

/** Whether `q` is further than `d` from every point of each of `loops` (a carabiner's centreline), checking only near. */
function clearOfLoops(q: Vector3, loops: readonly (readonly Vector3[])[], d: number): boolean {
    return loops.every((loop) => {
        const box = loopBoxes.get(loop) ?? boxOf(loop);
        loopBoxes.set(loop, box);
        if (
            q.x < box.lo.x - d ||
            q.y < box.lo.y - d ||
            q.z < box.lo.z - d ||
            q.x > box.hi.x + d ||
            q.y > box.hi.y + d ||
            q.z > box.hi.z + d
        )
            return true;
        return loop.every((k) => k.distanceTo(q) > d);
    });
}
const loopBoxes = new WeakMap<readonly Vector3[], { lo: Vector3; hi: Vector3 }>();
const boxOf = (points: readonly Vector3[]) => ({
    lo: vec3(
        Math.min(...points.map((p) => p.x)),
        Math.min(...points.map((p) => p.y)),
        Math.min(...points.map((p) => p.z)),
    ),
    hi: vec3(
        Math.max(...points.map((p) => p.x)),
        Math.max(...points.map((p) => p.y)),
        Math.max(...points.map((p) => p.z)),
    ),
});

/** Pieces as points round them, for fitting a cylinder round them: a rod by rings round its ends. */
function partsOf(pieces: readonly Piece[]): { at: Vector3; r: number }[] {
    return pieces.flatMap((p) => {
        if (p.kind === "strand") return p.points.map((q) => ({ at: q, r: p.r }));
        if (p.kind === "face") return p.points.map((q) => ({ at: q, r: 0 }));
        const axis = p.b.sub(p.a).unit();
        const e1 = (Math.abs(axis.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0)).cross(axis).unit();
        const e2 = axis.cross(e1);
        return [p.a, p.b].flatMap((end) =>
            Array.from({ length: 12 }, (_, i) => {
                const t = (i / 12) * 2 * Math.PI;
                return {
                    at: end.add(e1.scale(p.r * Math.cos(t)).add(e2.scale(p.r * Math.sin(t)))),
                    r: 0,
                };
            }),
        );
    });
}

/**
 * The smallest cylinder that takes in every one of `parts` (each a point and how thick it is round it) and still has
 * room for `text` on it at `CYLINDER_FONT`: tried along `along` and tilted from it up to 25° (coarsely every way, then
 * finely round the best), its axis through the middle of the smallest circle round them square to it, and kept the one
 * with the least in it.
 */
function enclosing(
    parts: { at: Vector3; r: number }[],
    along: Vector3,
    text: string,
): { a: Vector3; b: Vector3; r: number } | undefined {
    if (!parts.length) return undefined;
    const least = cylinderAtLeast(text);
    const thickest = Math.max(...parts.map((p) => p.r));
    // Every third point is plenty: a cord's points are only a few millimetres apart.
    const some = parts.filter((_, i) => i % 3 === 0 || i === parts.length - 1);
    const u0 = along.unit();
    const side0 = (Math.abs(u0.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0)).cross(u0).unit();
    const tilted = (tilt: number, turn: number) =>
        u0.turned(side0.turned(u0, turn), (tilt * Math.PI) / 180);
    let best:
        | { a: Vector3; b: Vector3; r: number; volume: number; tilt: number; turn: number }
        | undefined;
    const tryWay = (tilt: number, turn: number) => {
        const u = tilted(tilt, turn);
        const e1 = (Math.abs(u.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0)).cross(u).unit();
        const e2 = u.cross(e1);
        const circle = smallestCircle(
            convexHull(some.map((p) => vec2(p.at.dot(e1), p.at.dot(e2)))),
        );
        const r = Math.max(circle.r + thickest, least.r);
        let lo = Infinity;
        let hi = -Infinity;
        for (const p of some) {
            const t = p.at.dot(u);
            lo = Math.min(lo, t - p.r);
            hi = Math.max(hi, t + p.r);
        }
        if (hi - lo < least.length)
            [lo, hi] = [(lo + hi - least.length) / 2, (lo + hi + least.length) / 2];
        const volume = r * r * (hi - lo);
        if (best && volume >= best.volume) return;
        const centre = e1.scale(circle.centre.x).add(e2.scale(circle.centre.y));
        best = { a: centre.add(u.scale(lo)), b: centre.add(u.scale(hi)), r, volume, tilt, turn };
    };
    // Coarsely every way up to 25° off, then finely round the best of those.
    tryWay(0, 0);
    for (const tilt of [10, 20]) for (let k = 0; k < 8; k++) tryWay(tilt, (k / 8) * 2 * Math.PI);
    const { tilt, turn } = best!;
    for (const dt of [-5, 0, 5])
        for (const dk of [-1, 0, 1])
            if (tilt + dt >= 0 && tilt + dt <= 25) tryWay(tilt + dt, turn + (dk * Math.PI) / 8);
    return best && { a: best.a, b: best.b, r: best.r };
}

/** A label written on a knot's cylinder, at `CYLINDER_FONT`. */
function onCylinder(
    c: { a: Vector3; b: Vector3; r: number },
    text: string,
    light: boolean,
    extra: Partial<RigLabel> = {},
): RigLabel {
    return {
        at: c.a.lerp(c.b, 0.5),
        text,
        on: { along: c.b.sub(c.a).unit(), length: c.a.distanceTo(c.b), r: c.r },
        light,
        font: CYLINDER_FONT,
        ...extra,
    };
}

/**
 * A belay's hitches from `clip`: the load-release hitch along the pull, a carabiner on its end, and the tandem prusiks
 * from that on the rope. With the sling's carabiner (`krab`, hanging square) and knots drawn as they're tied, the
 * load-release hitch is the one tied in /knot-editor-3d, moved and turned with that carabiner, its second carabiner
 * where it was tied; otherwise it's a labelled cylinder. Gives their pieces and labels, the prusiks' two ends (the rope
 * goes on from the second), and the rope from its spare round the pulley's sheave, given which way the spare lies.
 */
function belayHitches(
    belay: Belay,
    clip: Vector3,
    along: Vector3,
    cylinders: boolean,
    face?: Vector3,
    krab?: CarabinerFeatures,
    krabGroup?: Group,
): BelayHitches {
    const tied = belayHitchesAsTied(belay, clip, along, cylinders, face, krab, krabGroup);
    if (!face) return tied;
    // In an elevation, laid into the view as the parts viewer's flat view sees it from above, square to the rope: its
    // level up (as the prusiks' frame has it) towards the eye and the rope running straight down the page, turned
    // about where it hangs (`clip`). Looking down, it's seen that way already.
    if (Math.abs(face.unit().y) > 0.9) return tied;
    const x = along.unit();
    const y = vec3(0, 1, 0).sub(x.scale(x.y)).unit();
    const eye = face.unit();
    const down = vec3(0, -1, 0).sub(eye.scale(-eye.y)).unit();
    // Two turns: the rope onto straight down the page, then about it, its level up onto the eye.
    const first = x.cross(down);
    const one = first.len() > 1e-12 ? { axis: first.unit(), angle: x.angleTo(down) } : undefined;
    const y1 = one ? y.turned(one.axis, one.angle) : y;
    const two = { axis: down, angle: Math.atan2(y1.cross(eye).dot(down), y1.dot(eye)) };
    const turn = (v: Vector3) => {
        const v1 = one ? v.turned(one.axis, one.angle) : v;
        return v1.turned(two.axis, two.angle);
    };
    const unturn = (v: Vector3) => {
        const v1 = v.turned(two.axis, -two.angle);
        return one ? v1.turned(one.axis, -one.angle) : v1;
    };
    const point = (q: Vector3) => turn(q.sub(clip)).add(clip);
    const pose = (pieces: Piece[]): Piece[] => {
        const once = one
            ? posed(moved(pieces, clip.neg()), { at: vec3(0, 0, 0), ...one })
            : moved(pieces, clip.neg());
        return posed(once, { at: clip, ...two }).map((p) =>
            // Groups sort by their middles, which turning the pieces leaves be; the sling's carabiner's stays.
            p.group && p.group.at !== krabGroup?.at
                ? { ...p, group: { ...p.group, at: point(p.group.at) } }
                : p,
        );
    };
    return {
        pieces: pose(tied.pieces),
        labels: tied.labels.map((l) => ({ ...l, at: point(l.at) })),
        tbpA: point(tied.tbpA),
        tbpB: point(tied.tbpB),
        spare: (toward) => {
            const { pieces, from } = tied.spare(unturn(toward.sub(clip)).add(clip));
            return { pieces: pose(pieces), from: point(from) };
        },
        sheave: point(tied.sheave),
    };
}

type BelayHitches = {
    pieces: Piece[];
    labels: RigLabel[];
    tbpA: Vector3;
    tbpB: Vector3;
    spare: (toward: Vector3) => { pieces: Piece[]; from: Vector3 };
    sheave: Vector3;
};

/** A belay's hitches (`belayHitches`) as they're tied, before a flat view turns them to be seen from above. */
function belayHitchesAsTied(
    belay: Belay,
    clip: Vector3,
    along: Vector3,
    cylinders: boolean,
    face?: Vector3,
    krab?: CarabinerFeatures,
    krabGroup?: Group,
): BelayHitches {
    const color = rigColor(belay.color);
    const across = vec3(-along.y, along.x, 0).unit();
    const tied = krab ? tiedLrh(belay, krab, face, krabGroup) : undefined;
    const lrh = tied ?? lrhCylinder(belay, clip, along, across, face);
    // The pulley hangs from the carabiner's end, the rope round it: from the abseiler through the prusiks, which sit
    // against its plates' shoulders, round the sheave and off it towards the spare.
    const pulley = prusikMindingPulley({
        hang: lrh.far,
        bar: lrh.bar,
        along: lrh.hangs,
        barR: CARABINER_R,
        centred: true,
        ropeR: ROPE_R,
        colors: {
            plates: rigColor(TBP.plates),
            sheave: "var(--tower-steel)",
            steel: "var(--tower-steel)",
        },
    });
    const flip = pulley.side.y < 0;
    const upper = flip ? pulley.b : pulley.a;
    const sideUp = flip ? pulley.side.neg() : pulley.side;
    const toEye = pulley.along.neg();
    const R = upper.distanceTo(pulley.centre);
    // The part to the abseiler leaves the sheave along the pull, which may be a little out of the pulley's plane.
    const tbpA = upper.add(along.scale(pulley.shoulder + 0.004));
    const tbpB = tbpA.add(along.scale(TBP.length));
    const tbpColors = belay.tbp.map(rigColor);
    /**
     * The rope from the spare round the sheave and on through the prusiks: from the abseiler's side it goes round the
     * sheave's side nearest the eye and leaves it on a tangent towards `toward`, a little way. Gives its pieces and
     * where it's got to, from where the spare goes on.
     */
    const spare = (toward: Vector3): { pieces: Piece[]; from: Vector3 } => {
        // In the pulley's plane, round from the abseiler's side (angle 0) over the eye's side to where it leaves.
        const rel = toward.sub(pulley.centre);
        const [u, v] = [rel.dot(sideUp), rel.dot(toEye)];
        const dist = Math.max(Math.hypot(u, v), R * 1.001);
        let leave = Math.atan2(v, u) - Math.acos(R / dist);
        while (leave <= Math.PI / 2) leave += 2 * Math.PI;
        while (leave > (5 * Math.PI) / 2) leave -= 2 * Math.PI;
        const steps = Math.max(2, Math.ceil(leave / (Math.PI / 12)));
        const round = Array.from({ length: steps + 1 }, (_, i) => {
            const t = (leave * i) / steps;
            return pulley.centre
                .add(sideUp.scale(R * Math.cos(t)))
                .add(toEye.scale(R * Math.sin(t)));
        });
        const off = round[round.length - 1];
        const from = off.add(toward.sub(off).unit().scale(0.05));
        return {
            pieces: [strand([from, ...round.reverse(), tbpB], ROPE_R, "rope", color)],
            from,
        };
    };
    // The prusiks round the rope, one below the other, as tied in /knot-editor-3d: each one's legs heading
    // level across the rope, to the right looking down it from the pulley, and its loop on up through the
    // carabiner on the spine side of the pulley, each round the bar at its own place: the upper's nearer the
    // pulley, shorter and inside the lower's; the lower's further round, with a little more slack.
    const prusiks = tbpColors.map((c, i) => {
        const level = vec3(0, 1, 0)
            .sub(along.scale(along.y))
            .unit()
            .turned(along.unit(), belay.prusikTurn ?? 0);
        const middle = tbpA.add(along.scale(0.045 + i * TBP.apart));
        const { hitch, loop: tied } = tiedPrusik(middle, along, level);
        // Where the loop went round the bar as tied, from the lower's hitch, placed from this one's.
        const tiedOn = lrh.onBar(TBP.tiedAt);
        const was = {
            at: tiedOn.at.add(along.scale((i - 1) * TBP.apart)),
            along: tiedOn.along,
        };
        // The upper's wrap round the bar, beside the pulley, lies parallel to its side plates; the lower's sits next
        // to it, further round, canted outwards away from it.
        const on = lrh.onBar(i === 0 ? TBP.upperAt : TBP.lowerAt);
        const cant = lrh.bar.cross(lrh.hangs).unit();
        const square = i === 0 ? lrh.bar : lrh.bar.turned(cant, TBP.cant);
        const loop = rehungLoop(tied, was, on, square, TBP.clear);
        // Their legs eased apart across the rope (Z, square to it and its level Y), so they clear each other
        // between the hitches and the bar; the lower's with more slack, and bowed on down the rope.
        const z = along.cross(level).unit();
        const eased =
            i === 0
                ? slackened(loop, middle, along, 0, z.scale(-TBP.nudge))
                : slackened(
                      loop,
                      middle,
                      along,
                      TBP.slack,
                      along.scale(TBP.sag).add(z.scale(TBP.nudge)),
                  );
        // The upper's lower leg (further below the rope, Y) eased on towards +Z beside the pulley's axle, so
        // it sits more under its upper leg there: most level with the axle, fading out along the rope.
        const tip = eased.reduce(
            (b, q, k) => (q.distanceTo(middle) > eased[b].distanceTo(middle) ? k : b),
            0,
        );
        const besideAxle = (q: Vector3) =>
            Math.exp(-((q.sub(pulley.centre).dot(along) / TBP.tuckReach) ** 2));
        const lowness = (from: number, to: number) => {
            let sum = 0;
            let weight = 0;
            for (let k = from; k < to; k++) {
                const w = besideAxle(eased[k]);
                sum += eased[k].sub(middle).dot(level) * w;
                weight += w;
            }
            return sum / Math.max(weight, 1e-12);
        };
        const firstLower = lowness(0, tip) < lowness(tip, eased.length);
        const tucked =
            i === 0
                ? eased.map((q, k) =>
                      k < tip === firstLower ? q.add(z.scale(TBP.tuck * besideAxle(q))) : q,
                  )
                : eased;
        return strand([...hitch, ...tucked], TBP.cordR, "rope", c, false, false);
    });
    // With knots as labelled cylinders, each hitch is still drawn as it's tied, a cylinder in its colours round it
    // and labelled on it: the load-release hitch's round its cord, the prusiks' round them and the pulley, each along
    // the pull and stopping short of the carabiners.
    const krabLoops = [krab?.loop, tied?.loop].filter((l): l is Vector3[] => !!l);
    const clear = (q: Vector3, r: number) => clearOfLoops(q, krabLoops, CARABINER_R + r + 0.003);
    const lrhAround =
        cylinders && tied
            ? enclosing(
                  tied.cord.filter((q) => clear(q, 0)).map((q) => ({ at: q, r: tied.cordR })),
                  along,
                  LRH.text,
              )
            : undefined;
    const tbpAround = cylinders
        ? enclosing(
              partsOf([...prusiks, ...pulley.pieces]).filter((q) => clear(q.at, q.r)),
              along,
              TBP.text,
          )
        : undefined;
    return {
        pieces: [
            ...lrh.pieces,
            ...pulley.pieces,
            ...prusiks,
            ...(lrhAround
                ? banded(lrhAround.a, lrhAround.b, lrhAround.r, [rigColor(belay.lrh)], 1)
                : []),
            ...(tbpAround ? banded(tbpAround.a, tbpAround.b, tbpAround.r, tbpColors, 2) : []),
        ],
        labels: [
            lrhAround && !lrh.label.on
                ? onCylinder(lrhAround, LRH.text, DARK_COLORS.includes(belay.lrh))
                : lrh.label,
            tbpAround ? onCylinder(tbpAround, TBP.text, true) : knotLabel([tbpA, tbpB], TBP.text),
        ],
        tbpA,
        tbpB,
        spare,
        sheave: pulley.centre,
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
    cylinders: boolean,
    face?: Vector3,
    krab?: CarabinerFeatures,
    krabGroup?: Group,
): {
    pieces: Piece[];
    labels: RigLabel[];
    spare: (toward: Vector3) => { pieces: Piece[]; from: Vector3 };
    sheave: Vector3;
    connections: Connection[];
} {
    const color = rigColor(belay.color);
    const hitches = belayHitches(belay, clip, along, cylinders, face, krab, krabGroup);
    const { tbpB } = hitches;
    // Where the line on from the prusiks meets the rail, which is further along the beam if it's angled.
    const railZ = tbpB.z + ((PULL[route].x - tbpB.x) * along.z) / along.x;
    const rail = vec3(PULL[route].x, PULL[route].y, railZ);
    const out = route === "east-face" ? EAST : EAST.neg();
    // Over the rail's outer corner and a little way down, outside the tower.
    const hang = rail.add(out.scale(ROPE_R)).add(vec3(0, -BELAY_DROP, 0));
    const nearRail = rail.sub(rail.sub(tbpB).unit().scale(0.3));
    // A carabiner on the rope's end, hanging from its knot flat against the side, for the abseiler to clip in.
    const shell = { out, layer: 3 };
    const tail = endKnot(hang, belay.color, shell, endBar(out), cylinders, face);
    const endKrab = carabiner(tail.at, tail.hang, endBar(out), face, "near", false);
    return {
        pieces: [
            ...hitches.pieces,
            strand([tbpB, nearRail], ROPE_R, "rope", color, true, false),
            {
                ...strand([nearRail, rail, tail.into], ROPE_R, "rope", color, false, false),
                shell,
            },
            ...tail.pieces,
            ...endKrab.pieces.map((p) => ({ ...p, shell })),
        ],
        labels: [...hitches.labels, tail.label],
        spare: hitches.spare,
        sheave: hitches.sheave,
        connections: endConnection(belay.id, tail, endKrab),
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
    cylinders: boolean,
    face?: Vector3,
    krab?: CarabinerFeatures,
    krabGroup?: Group,
): {
    pieces: Piece[];
    labels: RigLabel[];
    spare: (toward: Vector3) => { pieces: Piece[]; from: Vector3 };
    sheave: Vector3;
    under: Vector3;
    connections: Connection[];
} {
    const color = rigColor(belay.color);
    const hitches = belayHitches(belay, clip, along, cylinders, face, krab, krabGroup);
    const { tbpB } = hitches;
    // Where it leaves the tower, a little past the west railing.
    const leave = tbpB.lerp(through, (tbpB.x - (WEST_EDGE.rail.x - 0.1)) / (tbpB.x - through.x));
    const round = through.add(vec3(-0.02, -0.02, 0));
    const end = round.add(vec3(0, -drop, 0));
    // A carabiner on the rope's end, hanging from its knot, for the abseiler to clip in.
    const outside = { out: EAST.neg(), layer: 3 };
    const tail = endKnot(end, belay.color, outside, endBar(outside.out), cylinders, face);
    const endKrab = carabiner(tail.at, tail.hang, endBar(outside.out), face, "near", false);
    return {
        pieces: [
            ...hitches.pieces,
            strand([tbpB, leave], ROPE_R, "rope", color, true, false),
            {
                ...strand([leave, through, round, tail.into], ROPE_R, "rope", color, false, false),
                shell: outside,
            },
            ...tail.pieces,
            ...endKrab.pieces.map((p) => ({ ...p, shell: outside })),
        ],
        labels: [...hitches.labels, tail.label],
        spare: hitches.spare,
        sheave: hitches.sheave,
        under: hitches.tbpA.lerp(tbpB, 0.5),
        connections: endConnection(belay.id, tail, endKrab),
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
): {
    pieces: Piece[];
    clip: Vector3;
    along: Vector3;
    gate: Vector3;
    krab: CarabinerFeatures;
    tape: TapeFeatures;
    slingPull: Vector3;
} {
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
                  const r = section.r + SLING_T / 2;
                  return vec2(r * Math.cos(a), (r / slant) * Math.sin(a));
              })
            : (() => {
                  const [half, long] = [
                      section.w / 2 + SLING_T / 2,
                      (section.h / 2 + SLING_T / 2) / slant,
                  ];
                  return [
                      vec2(-half, -long),
                      vec2(half, -long),
                      vec2(half, long),
                      vec2(-half, long),
                  ];
              })();
    const pull = vec2(to.dot(s), to.dot(w)).unit();
    const { clip } = basket(outline, vec2(0, 0), pull, item.length);
    const at = (p: Vector2) => centre.add(s.scale(p.x)).add(w.scale(p.y));
    // A climbing sling as on the beam, its carabiner flat in the plane of the pull and what it wraps.
    const pullDir = s.scale(pull.x).add(w.scale(pull.y));
    const flatTo = axis.sub(pullDir.scale(axis.dot(pullDir)));
    const krab = carabiner(
        at(clip),
        pullDir,
        flatTo.len() > 0.1 ? flatTo.unit() : s.scale(-pull.y).add(w.scale(pull.x)),
    );
    const wrapped =
        "r" in section
            ? section.r
            : [-1, 1].flatMap((i) =>
                  [-1, 1].map((j) =>
                      centre
                          .add(s.scale((i * section.w) / 2))
                          .add(depth.scale((i * j * section.h) / 2)),
                  ),
              );
    const { pieces: sling, tape } = basketedSlingWith(
        "climbing",
        centre,
        wrapped,
        at(clip),
        CARABINER_R,
        axis.cross(pullDir),
        axis,
        { color: rigColor(item.color), stitched: false },
    );
    return {
        pieces: [...sling, ...krab.pieces],
        clip: krab.far,
        along: target ? target.sub(krab.far).unit() : up.neg(),
        gate: krab.gate,
        krab: krab.features,
        tape,
        slingPull: pullDir.neg(),
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
    const n = 20;
    const ring = (y: number, r: number) =>
        Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2;
            return base.add(vec3(r * Math.cos(a), y, r * Math.sin(a)));
        });
    // Tapered, narrower at the bottom, so looking down its inside wall shows round its floor; with a rolled rim.
    const bottom = ring(0, BUCKET_R * BUCKET_TAPER);
    const rim = ring(height, BUCKET_R);
    const sides: Face[] = bottom.map((p, i) => ({
        kind: "face",
        points: [p, bottom[(i + 1) % n], rim[(i + 1) % n], rim[i]],
        material: "bucket",
        color,
    }));
    // Its floor's raised a touch off the deck, so it's drawn over the deck it stands on.
    const floor: Face = {
        kind: "face",
        points: ring(0.01, BUCKET_R * BUCKET_TAPER),
        material: "bucket",
        color,
    };
    const lip = strand([...rim, rim[0]], 0.014, "bucket", color);
    // The rope flaked into it, lying in a spiral a little below the rim.
    const coil = ropeColor
        ? [
              strand(
                  Array.from({ length: 3 * n + 1 }, (_, i) => {
                      const t = i / (3 * n);
                      const a = t * 3 * Math.PI * 2;
                      const r = 0.04 + 0.1 * t;
                      return base.add(vec3(r * Math.cos(a), height - 0.1, r * Math.sin(a)));
                  }),
                  ROPE_R,
                  "rope",
                  ropeColor,
              ),
          ]
        : [];
    return [floor, ...sides, ...coil, lip];
}

/** How big a coil of spare rope lying on a deck is: its outer and inner radius and how many times it goes round. */
const COIL = { outer: 0.2, inner: 0.12, turns: 2.25 };

/**
 * Spare rope from `from` (behind the prusiks) down to the deck at `centre`, round in a loose coil lying on it, and up
 * over the rim of the bucket at `base`. The coil's cut into short runs, so each sorts with the deck it lies on.
 */
function coiledDrape(
    from: Vector3,
    centre: Vector3,
    base: Vector3,
    color: string,
    height = BUCKET_H,
): Piece[] {
    const onDeck = centre.y + ROPE_R + 0.005;
    const flat = (v: Vector3) => vec3(v.x, 0, v.z);
    // It starts on the side facing the prusiks and ends on the side facing the bucket, winding inwards.
    const startAngle = Math.atan2(from.z - centre.z, from.x - centre.x);
    const endAngle = Math.atan2(base.z - centre.z, base.x - centre.x);
    const sweep =
        COIL.turns * 2 * Math.PI +
        ((((endAngle - startAngle) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) -
        2 * Math.PI;
    const steps = 48;
    const coil = Array.from({ length: steps + 1 }, (_, i) => {
        const t = i / steps;
        const a = startAngle + sweep * t;
        // In to the inner radius and back out, so it leaves from the outside towards the bucket.
        const r = COIL.inner + (COIL.outer - COIL.inner) * Math.abs(1 - 2 * t);
        return vec3(centre.x + r * Math.cos(a), onDeck, centre.z + r * Math.sin(a));
    });
    // Down from the prusiks, falling steeply at first and easing onto the deck.
    const landing = coil[0];
    const down = Array.from({ length: 8 }, (_, i) => {
        const t = i / 8;
        const across = flat(from).lerp(flat(landing), t);
        return vec3(across.x, landing.y + (from.y - landing.y) * (1 - t) ** 2, across.z);
    });
    // Up over the bucket's rim and down onto the coil in it.
    const leave = coil[coil.length - 1];
    const rim = base
        .add(flat(leave.sub(base)).unit().scale(BUCKET_R))
        .add(vec3(0, height + 0.03, 0));
    const up = Array.from({ length: 6 }, (_, i) => {
        const t = (i + 1) / 6;
        const across = flat(leave).lerp(flat(rim), t);
        return vec3(across.x, leave.y + (rim.y - leave.y) * Math.sin((t * Math.PI) / 2), across.z);
    });
    const points = [...down, ...coil, ...up, base.add(vec3(0.12, height - 0.12, 0))];
    // Cut so the stretches coming down onto the deck and leaving it are short pieces of their own, low enough to sort
    // with the deck too.
    const first = down.length;
    const cuts = [3, first - 2, first];
    for (let i = first + 4; i < first + steps; i += 4) cuts.push(i);
    cuts.push(first + steps, first + steps + 1, points.length - 3);
    return run(points, cuts, ROPE_R, "rope", color);
}

/** Spare rope draping from `from` (the hitch) into the bucket at `base`, sagging a little, and down onto its coil. */
function drape(
    from: Vector3,
    base: Vector3,
    color: string,
    height = BUCKET_H,
    leaving?: Vector3,
): Piece[] {
    const into = base.add(vec3(0, height, 0));
    const sag = 0.25;
    // Leaving `from` the way it's heading, when it's given: a curve that sets off that way, then sags into the bucket.
    const lead = leaving && from.add(leaving.unit().scale(0.15));
    const points = Array.from({ length: 13 }, (_, i) => {
        const t = i / 12;
        const line = lead
            ? from
                  .scale((1 - t) ** 2)
                  .add(lead.scale(2 * t * (1 - t)))
                  .add(into.scale(t * t))
            : from.lerp(into, t);
        return line.add(vec3(0, -sag * 4 * t * (1 - t) * (lead ? t : 1), 0));
    });
    points.push(base.add(vec3(0.12, height - 0.12, 0)));
    return run(points, [4, 8, 12], ROPE_R, "rope", color);
}

/**
 * The rig laid out on the tower: its pieces to draw with the tower's, and its labels. The figure 8s are drawn as they're
 * tied, or as labelled cylinders (`knotCylinders`) as the hitches are. For a flat view, its carabiners and knots are
 * laid `face` on to the eye (`face` the way towards it), so each shows its shape, and drawn in the order they're clipped
 * together whatever the view.
 */
export function layoutRig(
    rig: Rig,
    only?: Set<string>,
    { knotCylinders = false, face }: { knotCylinders?: boolean; face?: Vector3 } = {},
): { pieces: Piece[]; labels: RigLabel[]; connections: Connection[] } {
    const pieces: Piece[] = [];
    const labels: RigLabel[] = [];
    const connections: Connection[] = [];
    const clips = new Map<
        string,
        { clip: Vector3; along: Vector3; gate: Vector3; group?: Group; krab: CarabinerFeatures }
    >();
    /** The connection between a sling and its carabiner. */
    const onSling = (
        id: string,
        s: { krab: CarabinerFeatures; tape: TapeFeatures; slingPull: Vector3 },
    ): Connection => ({
        kind: "carabiner-on-sling",
        id: `${id}: its carabiner`,
        arrangement: "anchor",
        carabiner: s.krab,
        sling: s.tape,
        pull: s.slingPull,
    });
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
        const [drawn, written, connected] = [pieces.length, labels.length, connections.length];
        layOut(item);
        // Looking down, a line's labels go on the far side of it from the line it's paired with.
        const above = aboveItsPair(item);
        if (above !== undefined)
            for (let i = written; i < labels.length; i++)
                labels[i] = { ...labels[i], plan: above ? "above" : "below" };
        // Everything's laid out, as one item can depend on another, but only those asked for are kept.
        if (only && !only.has(item.id)) {
            pieces.length = drawn;
            labels.length = written;
            connections.length = connected;
        }
    }
    return { pieces, labels, connections };

    /**
     * Whether a line's labels go above it looking down (north) or below: a belay and the abseil rope it's beside are a
     * pair, as are two lines over the same side from slings close together along the beam, and the one further north
     * of a pair has its labels above. A line on its own has them above. Nothing else is a line.
     */
    function aboveItsPair(item: RigItem): boolean | undefined {
        if (item.kind === "safety") return true;
        if (item.kind !== "rope" && item.kind !== "belay") return undefined;
        const lines = rig.items.filter(
            (i): i is Rope | Belay => i.kind === "rope" || i.kind === "belay",
        );
        const at = (line: Rope | Belay) => slings.find((s) => s.id === line.from)?.at;
        const east = (line: Rope | Belay) => !line.route?.startsWith("west");
        const z = at(item);
        if (z === undefined) return true;
        const paired =
            lines.find(
                (l) =>
                    (item.kind === "belay" && l.id === item.beside) ||
                    (l.kind === "belay" && l.beside === item.id),
            ) ??
            lines
                .filter((l) => l !== item && east(l) === east(item) && at(l) !== undefined)
                .map((l) => ({ l, d: Math.abs(at(l)! - z) }))
                .filter(({ d }) => d < 0.4)
                .sort((a, b) => a.d - b.d)[0]?.l;
        const theirs = paired && at(paired);
        return theirs === undefined || z >= theirs;
    }

    /** Where a person stands (the middle of their disc, on their deck). */
    function personAt(id: string): Vector3 | undefined {
        const p = rig.items.find((i): i is Person => i.kind === "person" && i.id === id);
        return p && personCentre(p);
    }

    function layOut(item: RigItem) {
        if (item.kind === "safety") {
            // The daisy chain from the sling's carabiner straight to the person: its first loop round the
            // carabiner's bottom bar, and its last round a carabiner that clips in at their harness, over the middle
            // of where they stand.
            const from = clips.get(item.from);
            const harness = personAt(item.person)?.add(vec3(0, HARNESS_H, 0));
            if (!from || !harness) return;
            const along = harness.sub(from.clip).unit();
            const end = harness.sub(along.scale(KRAB_L));
            // The first loop's tape lies along the sling carabiner's bar, and the harness carabiner lies the way the
            // last loop's tape does.
            const { loop } = from.krab;
            const i = loop.reduce(
                (best, q, j) =>
                    q.distanceTo(from.clip) < loop[best].distanceTo(from.clip) ? j : best,
                0,
            );
            const bar = loop[Math.min(loop.length - 1, i + 1)].sub(loop[Math.max(0, i - 1)]);
            const across = bar.sub(along.scale(bar.dot(along))).unit();
            const chain = daisyChain(from.clip, end, across, CARABINER_R, {
                tape: rigColor("white"),
                edge: rigColor(item.dc),
                tab: rigColor("orange"),
                tack: "var(--daisy-tack)",
            });
            pieces.push(...chain.pieces, ...carabiner(end, along, chain.lastAcross, face).pieces);
            const around = knotCylinders
                ? enclosing(
                      partsOf(chain.pieces).filter((q) =>
                          clearOfLoops(q.at, [loop], CARABINER_R + q.r + 0.003),
                      ),
                      along,
                      DC.text,
                  )
                : undefined;
            if (around)
                pieces.push(...banded(around.a, around.b, around.r, [rigColor(item.dc)], 1));
            labels.push(
                around
                    ? onCylinder(around, DC.text, DARK_COLORS.includes(item.dc))
                    : knotLabel([from.clip, end], DC.text),
            );
            return;
        }
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
            // A safety line's sling is pulled towards its person's harness.
            const safety = rig.items.find(
                (i): i is SafetyLine => i.kind === "safety" && i.from === item.id,
            );
            const harness = safety && personAt(safety.person);
            const s = basketSling(
                z,
                item.length,
                harness
                    ? vec2(harness.x, harness.y + HARNESS_H)
                    : rope?.route
                      ? PULL[rope.route]
                      : null,
                rigColor(item.color),
                slant,
                face,
                rope?.kind === "rope" && rope.knot === "F8OB",
                // A munter's and a load-release hitch's carabiner hangs square, as they were tied.
                (rope?.kind === "rope" && rope.knot !== "F8OB") || rope?.kind === "belay",
            );
            pieces.push(...s.pieces);
            connections.push(onSling(item.id, s));
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
            connections.push(onSling(item.id, s));
            clips.set(item.id, s);
        } else if (item.kind === "person") {
            const centre = personCentre(item);
            pieces.push({
                kind: "face",
                points: Array.from({ length: 24 }, (_, i) => {
                    const a = (i / 24) * Math.PI * 2;
                    return centre.add(vec3(Math.cos(a), 0, Math.sin(a)).scale(PERSON_R));
                }),
                material: "person",
                color: roleColor(item.role),
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
                spare: (toward: Vector3) => { pieces: Piece[]; from: Vector3 };
                sheave: Vector3;
                under?: Vector3;
                connections: Connection[];
            } | null =
                item.redirect && through
                    ? belayRedirected(
                          item,
                          from.clip,
                          from.along,
                          through,
                          item.redirect.drop,
                          knotCylinders,
                          face,
                          from.krab,
                          from.group,
                      )
                    : item.route
                      ? belayOverSide(
                            item,
                            item.route,
                            from.clip,
                            from.along,
                            knotCylinders,
                            face,
                            from.krab,
                            from.group,
                        )
                      : null;
            if (!belay) return;
            pieces.push(...belay.pieces);
            labels.push(...belay.labels);
            connections.push(...belay.connections);
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
            // The rope leaves the pulley towards where it lands on the deck in its coil, or towards its bucket.
            const coil = item.coil && bucket && vec3(item.coil.east, bucket.y, item.coil.north);
            const toward = coil
                ? coil.add(
                      vec3(belay.sheave.x - coil.x, 0, belay.sheave.z - coil.z)
                          .unit()
                          .scale(COIL.outer),
                  )
                : bucket
                  ? bucket.add(vec3(0, heightOf(item.spare) ?? BUCKET_H, 0))
                  : belay.sheave.add(vec3(0, -1, 0));
            const spare = belay.spare(toward);
            pieces.push(...spare.pieces);
            if (bucket)
                pieces.push(
                    ...(coil
                        ? coiledDrape(
                              spare.from,
                              coil,
                              bucket,
                              rigColor(item.color),
                              heightOf(item.spare),
                          )
                        : drape(spare.from, bucket, rigColor(item.color), heightOf(item.spare))),
                );
        } else {
            const from = clips.get(item.from);
            if (!from) return;
            // Ropes sharing a carabiner sit side by side along it.
            const mates = rig.items.filter(
                (i): i is Rope => i.kind === "rope" && i.from === item.from,
            );
            const k = mates.indexOf(item) - (mates.length - 1) / 2;
            const rope = ropeOverSide(
                item,
                from.clip.add(vec3(0, 0, k * SHARED_GAP)),
                from.along,
                from.gate,
                knotCylinders,
                face,
                from.group,
                from.krab,
            );
            if (rope.through) redirects.set(item.id, rope.through);
            pieces.push(...rope.pieces);
            labels.push(...rope.labels);
            connections.push(...rope.connections);
            const bucket = item.spare && buckets.get(item.spare);
            if (bucket)
                pieces.push(
                    ...drape(
                        rope.tail?.at ?? from.clip,
                        bucket,
                        rigColor(item.color),
                        heightOf(item.spare),
                        rope.tail?.heading,
                    ),
                );
        }
    }
}

/** A cylinder standing for a knot or hitch, as the legend shows it: its label, full name and colours. */
export type LegendCylinder = {
    text: string;
    name: string;
    colors: string[];
    /** Its label's written light, as on a dark cylinder. */
    light: boolean;
};
/** A knot that's drawn as it's tied: its label and full name. */
export type LegendKnot = { text: string; name: string };
/** A kind of item in the rig, whether it's tape or rope, and the colours it comes in. */
/** A role people have in the rig, and the letter on their discs. */
export type LegendPerson = { letter: string; name: string; color: string };
export type LegendLine = { name: string; look: "tape" | "rope"; colors: string[] };

/** What the drawing's cylinders and colours stand for, for the rig's legend. */
export function legend(rig: Rig): {
    cylinders: LegendCylinder[];
    knots: LegendKnot[];
    lines: LegendLine[];
    people: LegendPerson[];
} {
    const ropes = rig.items.filter((i): i is Rope => i.kind === "rope");
    const belays = rig.items.filter((i): i is Belay => i.kind === "belay");
    const cylinders: LegendCylinder[] = [];
    const munter = ropes.filter((r) => r.knot !== "F8OB");
    // Figure 8s: ropes tied to their slings with one, and every rope or belay ending in a carabiner.
    const f8 = [
        ...ropes.filter(
            (r) =>
                r.knot === "F8OB" ||
                r.end === "below-outrigger" ||
                (typeof r.end === "object" && r.end.carabiner),
        ),
        ...belays,
    ];
    // The knots that are drawn, and their labels.
    const knots: LegendKnot[] = [];
    if (munter.length) knots.push({ text: HITCH.text, name: "Munter and two half-hitches" });
    if (f8.length) knots.push({ text: KNOT_LABELS.bight, name: "Figure 8 on a bight" });
    // Stoppers: every rope whose end has nothing clipped to it.
    const stopped = ropes.filter(
        (r) => r.end === undefined || (typeof r.end === "object" && !r.end.carabiner),
    );
    if (stopped.length) knots.push({ text: KNOT_LABELS.stopper, name: "Figure 8 stopper" });
    if (belays.length) knots.push({ text: LRH.text, name: "Load-release hitch" });
    if (belays.length) knots.push({ text: TBP.text, name: "Tandem belay prusiks + pulley" });
    const safety = rig.items.filter((i): i is SafetyLine => i.kind === "safety");
    if (safety.length) knots.push({ text: DC.text, name: "Daisy chain" });
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
        .map((name) => ({ letter: ROLE_LETTER[name], name, color: roleColor(name) }));
    return { cylinders, knots, lines, people };
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
    // A safety line goes with the side its person's on.
    const safety = rig.items.filter(
        (i): i is SafetyLine =>
            i.kind === "safety" &&
            rig.items.some(
                (p) =>
                    p.kind === "person" &&
                    p.id === i.person &&
                    (personCentre(p).x > SIDE / 2 ? "east" : "west") === side,
            ),
    );
    return new Set([
        ...people,
        ...safety.flatMap((l) => [l.id, l.from]),
        ...lines.flatMap((l) => [l.id, l.from, ...(l.spare ? [l.spare] : [])]),
    ]);
}

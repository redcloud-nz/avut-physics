import { vec2, type Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import { basket, stackedLogs } from "./basket";
import {
    EAST_EDGE,
    groundAt,
    OVERHEAD,
    overheadSpace,
    SIDE,
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
    | "purple"
    | "black"
    | "white";

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
 * railing and down the east face, or over the west side's railing and its outrigger and down the west side. Its
 * `spare` rope, if it has a bucket, drapes from the hitch into it. Two lines sharing a bucket are the two ends of one
 * rope.
 */
export type Rope = {
    kind: "rope";
    id: string;
    from: string;
    color: RigColor;
    route: "east-face" | "west-outrigger";
    spare?: string;
};

/**
 * A rope bucket on the top deck: directly under the overhead beam beside the steel railing round the stairs, the
 * mirror image of another bucket across the tower's middle (from south to north), or east of the stairs' steel
 * railing in line with one of the beam's spaces.
 */
export type Bucket = {
    kind: "bucket";
    id: string;
    color: RigColor;
    place: "by-stair-railing" | { mirrorOf: string } | { eastOfStairsAt: 1 | 2 | 3 | 4 | 5 };
};

/**
 * A belay line: a load-release hitch (cord of colour `lrh`) on the item's carabiner, a second carabiner on it, and
 * tandem belay prusiks (cords of the two `tbp` colours) from that gripping the rope. The rope runs through them over
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
    route: Rope["route"];
    spare?: string;
};

export type RigItem = Sling | Rope | Bucket | Belay;
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
                color: "red",
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
                color: "red",
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
            // The west lines: the other ends of the same two ropes, over the outrigger, sharing their buckets.
            {
                kind: "sling",
                id: "sling-3",
                space: 2,
                length: 2,
                color: "red",
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
                color: "red",
                configuration: "basket",
            },
            {
                kind: "rope",
                id: "rope-4",
                from: "sling-4",
                color: "blue",
                route: "west-outrigger",
                spare: "bucket-2",
            },
            // The belays, one at a time.
            {
                kind: "sling",
                id: "sling-5",
                space: 1,
                length: 2,
                color: "red",
                configuration: "basket",
            },
            { kind: "bucket", id: "bucket-3", color: "yellow", place: { eastOfStairsAt: 1 } },
            {
                kind: "belay",
                id: "belay-1",
                from: "sling-5",
                color: "white",
                lrh: "green",
                tbp: ["dark-green", "red"],
                route: "east-face",
                spare: "bucket-3",
            },
        ],
    },
];

/** Each rig colour as drawn: the knot pages' colour of that name, or the rig's own for those they don't have. */
export const rigColor = (c: RigColor) =>
    c === "black" || c === "white" || c === "dark-green" ? `var(--rig-${c})` : `var(--knot-${c})`;

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
 * it first touches it from the rail), round its top to its outer side and straight down to the lower ground there.
 */
function beyondRail(route: Rope["route"], z: number): Vector3[] {
    if (route === "east-face") {
        const edge = vec3(EAST_EDGE.boarding.x + ROPE_R, EAST_EDGE.boarding.y, z);
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
    return [...round, vec3(x - r, groundAt(x - r) + 0.02, z)];
}

/**
 * A rope from `clip` over a side: its hitch on the carabiner, lying `along` the pull, then across to the top rail, over
 * its outer corner and on (`beyondRail`). What's past the rail is outside the tower, so it sorts as outside that side
 * of the shell.
 */
function ropeOverSide(
    route: Rope["route"],
    clip: Vector3,
    along: Vector3,
    color: string,
): { pieces: Piece[]; labels: RigLabel[] } {
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
        pieces: [hitchPiece, ...toGround(route, [hitch], color)],
        labels: [
            {
                at: tied.lerp(hitch, 0.5),
                text: HITCH.text,
                on: { along, length: hitch.distanceTo(tied), r: HITCH.r },
            },
        ],
    };
}

/**
 * Rope from `from` (its points in order, up to where it leaves for the rail) across to the top rail, over its outer
 * corner and on down that side (`beyondRail`). What's past the rail is outside the tower, so it sorts as outside that
 * side of the shell.
 */
function toGround(route: Rope["route"], from: Vector3[], color: string): Piece[] {
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
                [nearRail, rail, ...beyondRail(route, z)],
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
/** Tandem belay prusiks, drawn as one cylinder round the rope in bands of their two cords' colours. */
const TBP = { text: "TBP", r: 0.03, length: 0.26, bands: 8, cordR: 0.0035 };
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
 * A belay from `clip`: the load-release hitch along the pull, a carabiner on its end, and the tandem prusiks from that
 * on the rope, which runs through them to the rail and just over it, ready for its abseiler. Gives its pieces, its
 * labels, and where the rope comes from behind the prusiks, for its spare.
 */
function belayOverSide(
    belay: Belay,
    clip: Vector3,
    along: Vector3,
): { pieces: Piece[]; labels: RigLabel[]; back: Vector3 } {
    const color = rigColor(belay.color);
    const across = vec3(-along.y, along.x, 0);
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
    const { route } = belay;
    const rail = vec3(PULL[route].x, PULL[route].y, back.z);
    const out = route === "east-face" ? EAST : EAST.neg();
    // Over the rail's outer corner and a little way down, outside the tower.
    const hang = rail.add(out.scale(ROPE_R)).add(vec3(0, -BELAY_DROP, 0));
    const nearRail = rail.sub(rail.sub(tbpB).unit().scale(0.3));
    // A carabiner on the rope's end, hanging from it flat against the side, for the abseiler to clip in.
    const endKrab = carabiner(hang.sub(vec3(0, 0.01, 0)), vec3(0, -1, 0), vec3(0, 0, 1));
    return {
        pieces: [
            lrh,
            krab.piece,
            ...loops,
            ...banded(tbpA, tbpB, TBP.r, tbpColors, TBP.bands),
            strand([back, tbpB, nearRail], ROPE_R, "rope", color, true, false),
            {
                ...strand([nearRail, rail, hang], ROPE_R, "rope", color, false, true),
                shell: { out, layer: 3 },
            },
            { ...endKrab.piece, shell: { out, layer: 3 } },
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
        back,
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
    const buckets = new Map(
        rig.items
            .filter((i): i is Bucket => i.kind === "bucket")
            .map((b) => [b.id, bucketBase(b, rig)]),
    );
    // Slings sharing a space spread evenly across it, a little apart, in the order they were put up.
    const slings = rig.items.filter((i): i is Sling => i.kind === "sling");
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
                rope ? PULL[rope.route] : null,
                rigColor(item.color),
            );
            pieces.push(...s.pieces);
            clips.set(item.id, s);
        } else if (item.kind === "bucket") {
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
        } else if (item.kind === "belay") {
            const from = clips.get(item.from);
            if (!from) continue;
            const belay = belayOverSide(item, from.clip, from.along);
            pieces.push(...belay.pieces);
            labels.push(...belay.labels);
            const bucket = item.spare && buckets.get(item.spare);
            if (bucket) pieces.push(...drape(belay.back, bucket, rigColor(item.color)));
        } else {
            const from = clips.get(item.from);
            if (!from) continue;
            const rope = ropeOverSide(item.route, from.clip, from.along, rigColor(item.color));
            pieces.push(...rope.pieces);
            labels.push(...rope.labels);
            const bucket = item.spare && buckets.get(item.spare);
            if (bucket) pieces.push(...drape(from.clip, bucket, rigColor(item.color)));
        }
    }
    return { pieces, labels };
}

const SIDE_NAMES: Record<Rope["route"], string> = {
    "east-face": "over the east railing and down the east face",
    "west-outrigger": "over the west railing and the outrigger, and down the west side",
};

/** A line describing an item, for the list beside the drawing. */
export function describe(item: RigItem, rig: Rig): string {
    const name = (c: RigColor) => c.replace("-", " ");
    const colour = name(item.color)[0].toUpperCase() + name(item.color).slice(1);
    if (item.kind === "sling")
        return `${colour} ${item.length} m sling, basket round the beam in space ${item.space}`;
    if (item.kind === "bucket") {
        const { place } = item;
        const where =
            place === "by-stair-railing"
                ? "under the beam beside the stairs' steel railing"
                : "mirrorOf" in place
                  ? "under the beam, mirroring the first across the tower's middle"
                  : `east of the stairs' steel railing, in line with space ${place.eastOfStairsAt}`;
        return `${colour} rope bucket on the top deck, ${where}`;
    }
    const from = rig.items.find((i) => i.id === item.from);
    const where =
        from?.kind === "sling" ? `the space ${from.space} sling's carabiner` : "its anchor";
    if (item.kind === "belay")
        return `${colour} belay rope through tandem belay prusiks (${item.tbp.map(name).join(" and ")}) on a ${name(item.lrh)} load-release hitch from ${where}, over the ${item.route === "east-face" ? "east" : "west"} railing and hanging just past it with a carabiner on its end, its spare draped into a bucket`;
    // A rope sharing its bucket with an earlier line is that line's rope's other end.
    const earlier = rig.items.slice(0, rig.items.indexOf(item));
    const pair = earlier.find(
        (i): i is Rope => i.kind === "rope" && !!i.spare && i.spare === item.spare,
    );
    const pairSling = pair && rig.items.find((i) => i.id === pair.from);
    const spare = item.spare && !pair ? `, its spare draped into a bucket` : "";
    const end =
        pair && pairSling?.kind === "sling"
            ? ` (the other end of the space ${pairSling.space} ${pair.route === "east-face" ? "east" : "west"} line's, sharing its bucket)`
            : "";
    return `${colour} rope${end} tied to ${where} (munter and two half hitches), ${SIDE_NAMES[item.route]}${spare}`;
}

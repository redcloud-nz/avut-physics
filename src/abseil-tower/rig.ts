import { vec2, type Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import { basket, stackedLogs } from "./basket";
import {
    EAST_EDGE,
    groundAt,
    OVERHEAD,
    overheadSpace,
    TOP,
    topOpening,
    type Face,
    type Material,
    type Piece,
} from "./tower";

/**
 * A rig on the tower, as a list of items in the order they're put up. Positions come from the tower: a sling sits in
 * one of the overhead beam's five spaces (numbered from the south), and a rope hangs from what it's tied to.
 */

/** The colours rigging comes in, each drawn in the knot pages' colour of that name (black in its own). */
export type RigColor = "yellow" | "blue" | "red" | "orange" | "green" | "purple" | "black";

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
 * railing and down the east face. Its `spare` rope, if it has a bucket, drapes from the hitch into it.
 */
export type Rope = {
    kind: "rope";
    id: string;
    from: string;
    color: RigColor;
    route: "east-face";
    spare?: string;
};

/** A rope bucket on the top deck, directly under the overhead beam, beside the steel railing round the stairs. */
export type Bucket = {
    kind: "bucket";
    id: string;
    color: RigColor;
    place: "under-beam";
};

export type RigItem = Sling | Rope | Bucket;
export type Rig = { name: string; items: RigItem[] };

export const RIGS: Rig[] = [
    {
        name: "East face, first pieces",
        items: [
            {
                kind: "sling",
                id: "sling-1",
                space: 2,
                length: 2,
                color: "red",
                configuration: "basket",
            },
            { kind: "bucket", id: "bucket-1", color: "black", place: "under-beam" },
            {
                kind: "rope",
                id: "rope-1",
                from: "sling-1",
                color: "blue",
                route: "east-face",
                spare: "bucket-1",
            },
        ],
    },
];

export const rigColor = (c: RigColor) => (c === "black" ? "var(--rig-black)" : `var(--knot-${c})`);

/** Tape and rope, as round as they're drawn. */
const SLING_R = 0.0125;
const ROPE_R = 0.0055;
/** How far apart slings in one space sit. */
const SLING_GAP = 0.07;
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
    const mid = at(clip).add(along.scale(KRAB_L / 2));
    const krab = Array.from({ length: 17 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return mid
            .add(along.scale((KRAB_L / 2) * Math.cos(a)))
            .add(across.scale((KRAB_W / 2) * Math.sin(a)));
    });
    return {
        pieces: [...run(loop, cuts, SLING_R, "sling", color), strand(krab, 0.006, "steel")],
        clip: mid.add(along.scale(KRAB_L / 2)),
        along,
    };
}

/** Where a rope over the east side pulls towards, in the overhead beam's cross-section: the top rail's outer corner. */
const EAST_PULL = vec2(EAST_EDGE.rail.x, EAST_EDGE.rail.y + ROPE_R);

/** A label to draw beside the rig, at a point on it. */
export type RigLabel = { at: Vector3; text: string };

/** How a rope's tied to a carabiner (a munter and two half hitches), drawn as a short cylinder in the rope's colour. */
const HITCH = { text: "M+2HH", r: 0.055, length: 0.18 };

/**
 * A rope from `clip` over the east side: its hitch on the carabiner, lying `along` the pull, then across to the top
 * rail, over its outer corner, out over the edge of the east face's boarding and straight down the face to the ground.
 * The part over the edge and down the face is outside the tower, so it sorts as outside the east side's shell.
 */
function eastFaceRope(
    clip: Vector3,
    along: Vector3,
    color: string,
): { pieces: Piece[]; labels: RigLabel[] } {
    const hitch = clip.add(along.scale(HITCH.length));
    const z = clip.z;
    const rail = vec3(EAST_EDGE.rail.x, EAST_EDGE.rail.y + ROPE_R, z);
    const edge = vec3(EAST_EDGE.boarding.x + ROPE_R, EAST_EDGE.boarding.y, z);
    const foot = vec3(edge.x, groundAt(edge.x) + 0.02, z);
    // The last stretch to the rail sorts with what's outside, so the rail doesn't cover the rope lying on it.
    const nearRail = rail.sub(rail.sub(hitch).unit().scale(0.3));
    const outside = { out: EAST, layer: 3 };
    // The hitch starts a little back over the carabiner's end, round which it's tied.
    const hitchPiece: Piece = {
        kind: "rod",
        a: clip.sub(along.scale(0.02)),
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
            strand([hitch, nearRail], ROPE_R, "rope", color, true, false),
            {
                ...strand([nearRail, rail, edge, foot], ROPE_R, "rope", color, false, true),
                shell: outside,
            },
        ],
        labels: [{ at: clip.lerp(hitch, 0.5), text: HITCH.text }],
    };
}

/** Where a bucket under the beam stands: on the top deck, just north of the steel railing round the stairs. */
function bucketBase(): Vector3 {
    return vec3(OVERHEAD.x, TOP, topOpening().z1 + BUCKET_R + BUCKET_GAP);
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
    }));
    const floor: Face = { kind: "face", points: bottom, material: "bucket" };
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
        rig.items.filter((i): i is Bucket => i.kind === "bucket").map((b) => [b.id, bucketBase()]),
    );
    // Slings sharing a space spread evenly across it, a little apart, in the order they were put up.
    const slings = rig.items.filter((i): i is Sling => i.kind === "sling");
    for (const item of rig.items) {
        if (item.kind === "sling") {
            const mates = slings.filter((s) => s.space === item.space);
            const k = mates.indexOf(item) - (mates.length - 1) / 2;
            const { z0, z1 } = overheadSpace(item.space);
            const loaded = rig.items.some((i) => i.kind === "rope" && i.from === item.id);
            const s = basketSling(
                (z0 + z1) / 2 + k * SLING_GAP,
                item.length,
                loaded ? EAST_PULL : null,
                rigColor(item.color),
            );
            pieces.push(...s.pieces);
            clips.set(item.id, s);
        } else if (item.kind === "bucket") {
            const fed = rig.items.find((i) => i.kind === "rope" && i.spare === item.id);
            pieces.push(
                ...bucketPieces(
                    bucketBase(),
                    rigColor(item.color),
                    fed ? rigColor(fed.color) : null,
                ),
            );
        } else {
            const from = clips.get(item.from);
            if (!from) continue;
            const rope = eastFaceRope(from.clip, from.along, rigColor(item.color));
            pieces.push(...rope.pieces);
            labels.push(...rope.labels);
            const bucket = item.spare && buckets.get(item.spare);
            if (bucket) pieces.push(...drape(from.clip, bucket, rigColor(item.color)));
        }
    }
    return { pieces, labels };
}

/** A line describing an item, for the list beside the drawing. */
export function describe(item: RigItem, rig: Rig): string {
    const colour = item.color[0].toUpperCase() + item.color.slice(1);
    if (item.kind === "sling")
        return `${colour} ${item.length} m sling, basket round the beam in space ${item.space}`;
    if (item.kind === "bucket")
        return `${colour} rope bucket on the top deck, under the beam beside the stairs' steel railing`;
    const from = rig.items.find((i) => i.id === item.from);
    const where =
        from?.kind === "sling" ? `the space ${from.space} sling's carabiner` : "its anchor";
    const spare = rig.items.find((i) => i.id === item.spare);
    const rest = spare ? `, its spare draped into the ${spare.color} bucket` : "";
    return `${colour} rope tied to ${where} (munter and two half hitches), over the east railing and down the east face${rest}`;
}

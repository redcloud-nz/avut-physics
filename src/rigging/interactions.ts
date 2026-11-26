import { piercings, segmentsNearest } from "@/lib/polyline3";
import type { Vector3 } from "@/lib/vector3";

import type { CarabinerFeatures, CarabinerStretch } from "./hardware";
import type { TapeFeatures } from "./slings";

/**
 * Interactions: how one part's feature meets another's, as a specification a scene's connections are checked against
 * (see docs/parts-model.md). A scene tags each connection with the kind of interaction it is and the features of the
 * two parts; `checkConnection` says where the parts as built don't meet as that kind says they should.
 *
 * Where on the carabiner the other part goes depends on the arrangement the carabiner's in, not just the two parts, so
 * each connection names its arrangement (`ARRANGEMENTS`).
 */
export type Connection = (
    | {
          kind: "carabiner-on-sling";
          sling: TapeFeatures;
      }
    | {
          kind: "figure-8-on-carabiner";
          /** The knot's rope, through its loop, and its radius. */
          knot: { rope: Vector3[]; r: number };
      }
) & {
    /** What the connection is, for its failures: where it is in the scene. */
    id: string;
    arrangement: Arrangement;
    carabiner: CarabinerFeatures;
    /** The way the other part pulls the carabiner, from the end it's on. */
    pull: Vector3;
};

export type InteractionKind = Connection["kind"];

/** A carabiner's two ends, where loads sit: see `CarabinerStretch`. */
export type CarabinerEnd = "top" | "bottom";

/**
 * The arrangements a carabiner is used in, and which end each of its connections goes on:
 *
 * - `anchor`: a sling, the carabiner and a figure 8 on a bight, as an anchor's carabiner: the sling on its narrow end
 *   (a D's bottom) and the knot on its wide end (the top), each pulling along its length, so the two pull opposite ways;
 * - `end`: a figure 8 on a bight and the carabiner hanging from it, as on a rope's end: the knot on its narrow end (the
 *   bottom), nothing on the other.
 */
export const ARRANGEMENTS = {
    anchor: { "carabiner-on-sling": "bottom", "figure-8-on-carabiner": "top" },
    end: { "figure-8-on-carabiner": "bottom" },
} satisfies Record<string, Partial<Record<InteractionKind, CarabinerEnd>>>;

export type Arrangement = keyof typeof ARRANGEMENTS;

/** One way a connection doesn't meet its interaction: which, the check it fails, and what was found. */
export type Failure = { id: string; kind: InteractionKind; check: string; found: string };

/** How far a part may sit off what it bears on, either way (m): touching, not through it. */
export const CONTACT_TOLERANCE = 0.0015;
/** How far a carabiner may lie off the line its loads pull along (radians): further, and it's cross-loaded. */
export const ALIGN_TOLERANCE = (10 * Math.PI) / 180;

/** Whether index `i` of a carabiner's loop is in its stretch `s`. */
function inStretch(c: CarabinerFeatures, s: CarabinerStretch, i: number): boolean {
    const n = c.loop.length - 1;
    const { from, to } = c.stretches[s];
    const [a, b, k] = [from % n, to % n, i % n];
    return a <= b ? k >= a && k <= b : k >= a || k <= b;
}

/** The stretch a loop index is in, for reporting: the first that holds it, or "between" them. */
function stretchAt(c: CarabinerFeatures, i: number): string {
    const all: CarabinerStretch[] = ["top", "bottom", "gate", "spine"];
    return all.find((s) => inStretch(c, s, i)) ?? "between its stretches";
}

/**
 * Where a rope or tape (`path`, its half thickness at each point `half`) comes nearest the carabiner's bar, as the gap
 * between their surfaces (negative where they overlap), and the carabiner's loop index there.
 */
function nearestGap(
    c: CarabinerFeatures,
    path: readonly Vector3[],
    half: (i: number) => number,
): { gap: number; index: number; at: Vector3 } {
    let best = { gap: Infinity, index: 0, at: c.loop[0] };
    for (let i = 0; i < path.length - 1; i++)
        for (let j = 0; j < c.loop.length - 1; j++) {
            const { s, t } = segmentsNearest(path[i], path[i + 1], c.loop[j], c.loop[j + 1]);
            const on = c.loop[j].lerp(c.loop[j + 1], t);
            const thick = half(i) + (half(i + 1) - half(i)) * s;
            const gap = path[i].lerp(path[i + 1], s).distanceTo(on) - c.r - thick;
            if (gap < best.gap) best = { gap, index: t < 0.5 ? j : j + 1, at: on };
        }
    return best;
}

const mm = (m: number) => `${(m * 1000).toFixed(1)} mm`;
const degrees = (rad: number) => `${((rad * 180) / Math.PI).toFixed(1)}°`;

/**
 * Where a connection doesn't meet its interaction (none when it does). Every kind checks that it's part of its
 * arrangement, and that the other part:
 *
 * - passes through the carabiner's inside, at the end its arrangement puts it on;
 * - bears on that end's bend: touching the bar there (within `CONTACT_TOLERANCE`), and nowhere into it;
 * - pulls the carabiner along its length (within `ALIGN_TOLERANCE`), so it's not cross-loaded.
 */
export function checkConnection(c: Connection): Failure[] {
    const failures: Failure[] = [];
    const fail = (check: string, found: string) =>
        failures.push({ id: c.id, kind: c.kind, check, found });
    const krab = c.carabiner;
    const ends: Partial<Record<InteractionKind, CarabinerEnd>> = ARRANGEMENTS[c.arrangement];
    const end = ends[c.kind];
    if (!end) {
        fail(`is part of the ${c.arrangement} arrangement`, "it isn't");
        return failures;
    }
    const [path, half] =
        c.kind === "carabiner-on-sling"
            ? [c.sling.points, (i: number) => c.sling.thickness[i] / 2]
            : [c.knot.rope, () => c.knot.r];

    const through = piercings(krab.loop, path);
    if (through.length === 0) fail("passes through the carabiner", "it doesn't");
    for (const { at } of through) {
        const index = nearestGap(krab, [at, at], () => 0).index;
        if (!inStretch(krab, end, index))
            fail(
                `passes through at the carabiner's ${end} end`,
                `nearest its ${stretchAt(krab, index)}`,
            );
    }

    const near = nearestGap(krab, path, half);
    if (near.gap < -CONTACT_TOLERANCE) fail("stays out of the bar", `${mm(-near.gap)} into it`);
    else if (near.gap > CONTACT_TOLERANCE) fail("bears on the bar", `${mm(near.gap)} off it`);
    if (!inStretch(krab, end, near.index))
        fail(`bears on the ${end} bend`, `bears on its ${stretchAt(krab, near.index)}`);

    // From the other end to the one this pulls on: along the pull.
    const [at, other] = end === "top" ? [krab.top, krab.bottom] : [krab.bottom, krab.top];
    const off = at.sub(other).angleTo(c.pull);
    if (off > ALIGN_TOLERANCE) fail("pulls along the carabiner", `${degrees(off)} off its length`);
    return failures;
}

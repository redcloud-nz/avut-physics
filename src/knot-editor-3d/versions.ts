import type { JsonObject, JsonValue } from "@/knot-editor/versions";
import { fitPinned } from "@/lib/rope-3d/pinned";
import { vec3, type Vector3 } from "@/lib/vector3";

/**
 * The 3D knot file's versions, and the upgrades from each to the next, as the 2D editor's (`src/knot-editor/versions.ts`).
 *
 * To change the format:
 *
 * 1. Bump `CURRENT_VERSION` by one.
 * 2. Add an upgrade to the end of `UPGRADES`, taking a file of the version before to the new one, as plain JSON. The
 *    checks (`knot-file.ts`) run only after the last upgrade, against the current types.
 * 3. Change the types, checks and writer in `knot-file.ts` to match.
 * 4. Add `samples/v<n>.json` for the new version, written by the editor. Earlier versions' samples are never edited:
 *    the tests open every one, so each upgrade stays proven.
 */

/** Takes a file from one version to the next, as plain JSON. */
export type Upgrade = (file: JsonObject) => JsonObject;

/** The version this editor reads and writes. */
export const CURRENT_VERSION = 2;

/** How far a version 1 rope fitted with pins may stray from its points (metres): too little to see. */
export const V1_FIT = 0.0001;

const listIn = (value: JsonValue | undefined) => (Array.isArray(value) ? value : []);
const pointIn = (value: JsonValue): Vector3 | undefined => {
    const [x, y, z] = listIn(value);
    return typeof x === "number" && typeof y === "number" && typeof z === "number"
        ? vec3(x, y, z)
        : undefined;
};
const json3 = (p: Vector3) => [p.x, p.y, p.z];

/**
 * Version 2 holds the rope as pins and segments (one cubic Bézier each) where version 1 held its points. A version 1
 * rope gets a pin at each segment's start and the rope's end, each holding the way the rope runs there, and each
 * segment the curve nearest its points, with pins added (its pieces lettered) wherever one curve strays more than a
 * tenth of a millimetre. Segments keep their numbers as names. The held segments go (tightening is done in stages
 * now, none of them run yet); the knot's segments stay.
 */
function toPins(file: JsonObject): JsonObject {
    const rope = (file.rope ?? {}) as JsonObject;
    const points = listIn(rope.points).map(pointIn);
    const counts = listIn(rope.segments).map((c) => (typeof c === "number" ? c : 0));
    if (points.some((p) => p === undefined) || points.length < 2 || !counts.length) return file;
    const pinAt = [0];
    for (const c of counts) pinAt.push(pinAt.at(-1)! + c);
    pinAt[pinAt.length - 1] = points.length - 1;
    const segments = counts.map((_, k) => ({
        id: k + 1,
        name: String(k + 1),
        tension: [1, 1] as [number, number],
    }));
    const { rope: pinned } = fitPinned(points as Vector3[], pinAt, segments, {
        tolerance: V1_FIT,
        nextId: counts.length + 1,
    });
    const rest = { ...file };
    delete rest.held;
    return {
        ...rest,
        version: 2,
        rope: {
            pins: pinned.pins.map((p) => ({
                id: p.id,
                at: json3(p.at),
                ...(p.along && { along: json3(p.along) }),
            })),
            segments: pinned.segments.map((s) => ({ id: s.id, name: s.name, tension: s.tension })),
        },
        stages: [],
    };
}

/** The upgrades in order: `UPGRADES[k]` takes a file from version k + 1 to version k + 2. */
export const UPGRADES: Upgrade[] = [toPins];

import type { JsonObject } from "@/knot-editor/versions";

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
export const CURRENT_VERSION = 1;

/** The upgrades in order: `UPGRADES[k]` takes a file from version k + 1 to version k + 2. */
export const UPGRADES: Upgrade[] = [];

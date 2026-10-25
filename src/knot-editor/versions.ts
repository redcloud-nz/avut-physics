/**
 * The knot file's versions, and the upgrades from each to the next.
 *
 * To change the format (a field added, renamed, moved or read differently):
 *
 * 1. Bump `CURRENT_VERSION` by one.
 * 2. Add an upgrade to the end of `UPGRADES`, taking a file of the version before to the new one. It works on plain
 *    JSON: old versions' shapes aren't kept as types, and the file's checks (`format.ts`) run only after the last
 *    upgrade, against the current types.
 * 3. Change the types, checks and writer in `format.ts` to match.
 * 4. Add `samples/v<n>.json` for the new version, written by the editor. The samples of earlier versions are never
 *    edited once their version is out: the tests open every one, so each upgrade stays proven.
 */

/** A value as JSON has it. */
export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
/** An object as JSON has it. */
export type JsonObject = { [key: string]: JsonValue };

/** Takes a file from one version to the next, as plain JSON. */
export type Upgrade = (file: JsonObject) => JsonObject;

/** The version this editor reads and writes. */
export const CURRENT_VERSION = 1;

/** The upgrades in order: `UPGRADES[k]` takes a file from version k + 1 to version k + 2. */
export const UPGRADES: Upgrade[] = [];

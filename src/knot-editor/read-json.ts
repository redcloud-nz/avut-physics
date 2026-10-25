/**
 * Reading a knot file's JSON against its types. Each reader takes the value and where it is in the file (as
 * "steps[2].picture.strands[0]"), and throws a `FileError` naming that place when the value isn't what it should be.
 */

import type { JsonObject, JsonValue } from "./versions";

/** Something wrong in a file, and where. */
export class FileError extends Error {
    constructor(
        readonly where: string,
        readonly problem: string,
    ) {
        super(where ? `${where}: ${problem}` : problem);
    }
}

/** Where a field or item is, below `at`. */
export const below = (at: string, key: string | number) =>
    typeof key === "number" ? `${at}[${key}]` : at ? `${at}.${key}` : key;

const describe = (value: JsonValue | undefined) =>
    value === undefined
        ? "missing"
        : value === null
          ? "null"
          : Array.isArray(value)
            ? "a list"
            : typeof value === "object"
              ? "an object"
              : JSON.stringify(value);

export function readObject(value: JsonValue | undefined, at: string): JsonObject {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new FileError(at, `should be an object, but is ${describe(value)}`);
    return value;
}

export function readList(value: JsonValue | undefined, at: string): JsonValue[] {
    if (!Array.isArray(value))
        throw new FileError(at, `should be a list, but is ${describe(value)}`);
    return value;
}

export function readNumber(value: JsonValue | undefined, at: string): number {
    if (typeof value !== "number" || !Number.isFinite(value))
        throw new FileError(at, `should be a number, but is ${describe(value)}`);
    return value;
}

/** A number greater than 0. */
export function readPositive(value: JsonValue | undefined, at: string): number {
    const n = readNumber(value, at);
    if (n <= 0) throw new FileError(at, `should be more than 0, but is ${n}`);
    return n;
}

/** A whole number, at least `least`. */
export function readCount(value: JsonValue | undefined, at: string, least: number): number {
    const n = readNumber(value, at);
    if (!Number.isInteger(n) || n < least)
        throw new FileError(at, `should be a whole number from ${least}, but is ${n}`);
    return n;
}

export function readString(value: JsonValue | undefined, at: string): string {
    if (typeof value !== "string")
        throw new FileError(at, `should be text, but is ${describe(value)}`);
    return value;
}

/** One of `options`. */
export function readChoice<T extends string>(
    value: JsonValue | undefined,
    at: string,
    options: readonly T[],
): T {
    if (typeof value !== "string" || !options.includes(value as T))
        throw new FileError(
            at,
            `should be one of ${options.map((o) => `"${o}"`).join(", ")}, but is ${describe(value)}`,
        );
    return value as T;
}

/** Refuses any field of `object` not among `known`. */
export function onlyFields(object: JsonObject, at: string, known: readonly string[]) {
    for (const key of Object.keys(object))
        if (!known.includes(key)) throw new FileError(at, `has an unknown field "${key}"`);
}

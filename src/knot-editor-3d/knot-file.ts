/**
 * The 3D knot file: one tightened knot, as the 3D knot editor opens and saves it, and as pages import it. Lengths are
 * in metres. A file names its format and version; an older one is upgraded as it's read (`versions.ts`), a newer one
 * refused, and every file is checked against the types below, with the reason given where it doesn't read.
 */
import {
    below,
    FileError,
    onlyFields,
    readChoice,
    readCount,
    readId,
    readList,
    readNumber,
    readObject,
    readPositive,
    readString,
} from "@/knot-editor/read-json";
import type { JsonObject, JsonValue } from "@/knot-editor/versions";
import { countsOf, segFromCounts, type Rope3, type RopeSetup } from "@/lib/rope-3d/rope";
import { vec3, type Vector3 } from "@/lib/vector3";

import { CURRENT_VERSION, UPGRADES, type Upgrade } from "./versions";

export const FORMAT = "avut-knot-3d";

/** A straight bar the knot's tied round: its axis through `at` along `along` (a unit vector), `r` in radius. */
export type BarProp = { id: number; kind: "bar"; at: Vector3; along: Vector3; r: number };

export type Knot3dFile = {
    name: string;
    /** The knot drawing it was started from (a slug in `src/knots/`), for reference only. */
    from?: string;
    diameter: number;
    /** The tightest the rope bends: the radius of its centreline round the bend. */
    minBend: number;
    /** How much the rope straightens each step as it settles, 0 to 1. */
    stiffness: number;
    props: BarProp[];
    rope: Rope3;
    /** The segments that stay put when the whole knot's tightened: its ends and the top of the loop. */
    held: number[];
    /** The knot's own segments, which shorten together when it's tightened. */
    knot: number[];
};

/** What the rope's engine needs to know of a file: the rope's make and the bars. */
export const setupOf = (file: Knot3dFile): RopeSetup => ({
    diameter: file.diameter,
    minBend: file.minBend,
    stiffness: file.stiffness,
    bars: file.props,
});

export type ReadResult =
    | { kind: "read"; file: Knot3dFile; upgradedFrom?: number }
    | { kind: "error"; reason: string };

/** A file's text, read, upgraded and checked. */
export function parseKnot3d(
    text: string,
    options?: { current: number; upgrades: Upgrade[] },
): ReadResult {
    let json: JsonValue;
    try {
        json = JSON.parse(text) as JsonValue;
    } catch (e) {
        return { kind: "error", reason: `This isn't JSON: ${(e as Error).message}` };
    }
    return readKnot3dJson(json, options);
}

/** A file already read as JSON (as a page imports one), upgraded and checked as `parseKnot3d` does. */
export function readKnot3dJson(
    json: JsonValue,
    { current, upgrades }: { current: number; upgrades: Upgrade[] } = {
        current: CURRENT_VERSION,
        upgrades: UPGRADES,
    },
): ReadResult {
    try {
        let file = readObject(json, "");
        if (file.format !== FORMAT)
            return {
                kind: "error",
                reason:
                    file.format === undefined
                        ? `This isn't a 3D knot file: it has no "format".`
                        : `This isn't a 3D knot file: its format is ${JSON.stringify(file.format)}, not "${FORMAT}".`,
            };
        const version = readCount(file.version, "version", 1);
        if (version > current)
            return {
                kind: "error",
                reason: `This file is version ${version}, newer than this editor reads (version ${current}).`,
            };
        for (let v = version; v < current; v++) file = upgrades[v - 1](structuredClone(file));
        return {
            kind: "read",
            file: readFile(file),
            ...(version < current && { upgradedFrom: version }),
        };
    } catch (e) {
        if (e instanceof FileError) return { kind: "error", reason: e.message };
        throw e;
    }
}

/**
 * A file a page imports, read with the same checks as the editor's, or an error naming it: a file that doesn't read
 * fails the build.
 */
export function knot3dFile(name: string, json: unknown): Knot3dFile {
    const read = readKnot3dJson(json as JsonValue);
    if (read.kind === "error") throw new Error(`${name} can't be read. ${read.reason}`);
    return read.file;
}

const FIELDS = [
    "format",
    "version",
    "name",
    "from",
    "diameter",
    "minBend",
    "stiffness",
    "props",
    "rope",
    "held",
    "knot",
] as const;

function readFile(json: JsonObject): Knot3dFile {
    onlyFields(json, "", FIELDS);
    const props = readList(json.props ?? [], "props").map((p, i) => readBar(p, below("props", i)));
    const ids = new Set<number>();
    props.forEach((p, i) => {
        if (ids.has(p.id))
            throw new FileError(below(below("props", i), "id"), `${p.id} is used twice`);
        ids.add(p.id);
    });
    const rope = readRope(json.rope, "rope");
    const count = countsOf(rope.seg).length;
    return {
        name: readString(json.name, "name"),
        ...(json.from !== undefined && { from: readString(json.from, "from") }),
        diameter: readPositive(json.diameter, "diameter"),
        minBend: readPositive(json.minBend, "minBend"),
        stiffness: readFraction(json.stiffness, "stiffness"),
        props,
        rope,
        held: readSegments(json.held ?? [], "held", count),
        knot: readSegments(json.knot ?? [], "knot", count),
    };
}

/** A number from 0 to 1. */
function readFraction(value: JsonValue | undefined, at: string): number {
    const n = readNumber(value, at);
    if (n < 0 || n > 1) throw new FileError(at, `should be from 0 to 1, but is ${n}`);
    return n;
}

function readPoint(value: JsonValue | undefined, at: string): Vector3 {
    const list = readList(value, at);
    if (list.length !== 3)
        throw new FileError(at, `should be [x, y, z], but has ${list.length} numbers`);
    const [x, y, z] = list.map((v, i) => readNumber(v, below(at, i)));
    return vec3(x, y, z);
}

function readBar(value: JsonValue, at: string): BarProp {
    const json = readObject(value, at);
    onlyFields(json, at, ["id", "kind", "at", "along", "r"]);
    readChoice(json.kind, below(at, "kind"), ["bar"]);
    const along = readPoint(json.along, below(at, "along"));
    if (along.len() < 1e-9)
        throw new FileError(below(at, "along"), "should have a direction, but is [0, 0, 0]");
    return {
        id: readId(json.id, below(at, "id")),
        kind: "bar",
        at: readPoint(json.at, below(at, "at")),
        along: along.unit(),
        r: readPositive(json.r, below(at, "r")),
    };
}

function readRope(value: JsonValue | undefined, at: string): Rope3 {
    const json = readObject(value, at);
    onlyFields(json, at, ["points", "segments"]);
    const points = readList(json.points, below(at, "points")).map((p, i) =>
        readPoint(p, below(below(at, "points"), i)),
    );
    if (points.length < 2)
        throw new FileError(below(at, "points"), `should have at least 2 points`);
    const counts = readList(json.segments, below(at, "segments")).map((c, i) =>
        readCount(c, below(below(at, "segments"), i), 1),
    );
    const total = counts.reduce((a, b) => a + b, 0);
    if (total !== points.length)
        throw new FileError(
            below(at, "segments"),
            `should share out the rope's ${points.length} points, but adds up to ${total}`,
        );
    return { points, seg: segFromCounts(counts) };
}

/** A list of segment numbers, each one of the rope's and none twice, in order. */
function readSegments(value: JsonValue, at: string, count: number): number[] {
    const list = readList(value, at).map((v, i) => readCount(v, below(at, i), 1));
    list.forEach((k, i) => {
        if (k > count)
            throw new FileError(below(at, i), `is segment ${k}, but the rope has ${count}`);
        if (list.indexOf(k) !== i) throw new FileError(below(at, i), `${k} is listed twice`);
    });
    return [...list].sort((a, b) => a - b);
}

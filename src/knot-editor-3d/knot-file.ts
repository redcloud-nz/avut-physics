/**
 * The 3D knot file: one knot, as the 3D knot editor opens and saves it, and as pages import it. Lengths are in metres.
 * A file names its format and version; an older one is upgraded as it's read (`versions.ts`), a newer one refused, and
 * every file is checked against the types below, with the reason given where it doesn't read.
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
import {
    nameParts,
    sampleRope,
    type Pin3,
    type PinnedRope,
    type Segment3,
} from "@/lib/rope-3d/pinned";
import type { RopeSetup } from "@/lib/rope-3d/rope";
import type { StageEnd } from "@/lib/rope-3d/stage";
import { vec3, type Vector3 } from "@/lib/vector3";

import { CURRENT_VERSION, UPGRADES, type Upgrade } from "./versions";

export const FORMAT = "avut-knot-3d";

/** A straight bar the knot's tied round: its axis through `at` along `along` (a unit vector), `r` in radius. */
export type BarProp = { id: number; kind: "bar"; at: Vector3; along: Vector3; r: number };
/** A carabiner the knot's tied round: its rod's middle line, closed (the last point back at the first), `r` in radius. */
export type CarabinerProp = { id: number; kind: "carabiner"; loop: Vector3[]; r: number };
export type Prop3 = BarProp | CarabinerProp;

/** A crossing of the drawing the knot was made from, met along its rope: which (from 1, as first met), and on top or not. */
export type DrawnCrossing = { crossing: number; over: boolean };

/**
 * A stage of tightening, as it was run: the segments (by id) it shortened, held and held straight (the rest slid),
 * how far it was to go (a fraction shorter) and how far it went, and how it ended.
 */
export type Stage = {
    shorten: number[];
    hold: number[];
    straight: number[];
    until?: number;
    reached: number;
    ended: StageEnd;
};

export type Knot3dFile = {
    name: string;
    /** The knot drawing it was started from (a slug in `src/knots/`, or a drawing file's name), for reference only. */
    from?: string;
    diameter: number;
    /** The tightest the rope bends: the radius of its centreline round the bend. */
    minBend: number;
    /** How much the rope straightens each step as it settles, 0 to 1. */
    stiffness: number;
    props: Prop3[];
    rope: PinnedRope;
    /** The drawing's crossings in order along the rope, to check the rope against while it lies near the drawing. */
    crossings?: DrawnCrossing[];
    /** The knot's own segments (by segment number), for pages that route the strands in and out of it. */
    knot: number[];
    /** The stages it's been tightened in, in order. */
    stages: Stage[];
};

/** What the rope's engine needs to know of a file: the rope's make, the bars and the carabiners. */
export const setupOf = (file: Knot3dFile): RopeSetup => ({
    diameter: file.diameter,
    minBend: file.minBend,
    stiffness: file.stiffness,
    bars: file.props.filter((p) => p.kind === "bar"),
    loops: file.props
        .filter((p) => p.kind === "carabiner")
        .map((p) => ({ points: p.loop, r: p.r })),
});

/** A segment's number, from its name ("19b" is 19). */
export const segmentNumber = (s: Segment3) => Number(nameParts(s.name).number) || 0;

/**
 * A file's rope as pages draw it: points about a quarter of a diameter apart, with each point's segment number (from
 * its name).
 */
export function knotRope(file: Knot3dFile): { points: Vector3[]; seg: number[] } {
    const { points, seg } = sampleRope(file.rope, file.diameter / 4);
    return { points, seg: seg.map((k) => segmentNumber(file.rope.segments[k])) };
}

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
    "crossings",
    "knot",
    "stages",
] as const;

function readFile(json: JsonObject): Knot3dFile {
    onlyFields(json, "", FIELDS);
    const props = readList(json.props ?? [], "props").map((p, i) => readProp(p, below("props", i)));
    const rope = readRope(json.rope, "rope");
    const ids = new Set<number>();
    const unique = (id: number, at: string) => {
        if (ids.has(id)) throw new FileError(at, `${id} is used twice`);
        ids.add(id);
    };
    props.forEach((p, i) => unique(p.id, below(below("props", i), "id")));
    const ropeIds = new Set<number>();
    rope.pins.forEach((p, i) => {
        const at = below(below("rope", "pins"), i);
        if (ropeIds.has(p.id)) throw new FileError(below(at, "id"), `${p.id} is used twice`);
        ropeIds.add(p.id);
    });
    rope.segments.forEach((s, i) => {
        const at = below(below("rope", "segments"), i);
        if (ropeIds.has(s.id)) throw new FileError(below(at, "id"), `${s.id} is used twice`);
        ropeIds.add(s.id);
    });
    return {
        name: readString(json.name, "name"),
        ...(json.from !== undefined && { from: readString(json.from, "from") }),
        diameter: readPositive(json.diameter, "diameter"),
        minBend: readPositive(json.minBend, "minBend"),
        stiffness: readFraction(json.stiffness, "stiffness"),
        props,
        rope,
        ...(json.crossings !== undefined && {
            crossings: readList(json.crossings, "crossings").map((c, i) =>
                readCrossing(c, below("crossings", i)),
            ),
        }),
        knot: readList(json.knot ?? [], "knot").map((k, i) => readCount(k, below("knot", i), 0)),
        stages: readList(json.stages ?? [], "stages").map((s, i) =>
            readStage(s, below("stages", i)),
        ),
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

function readDirection(value: JsonValue | undefined, at: string): Vector3 {
    const v = readPoint(value, at);
    if (v.len() < 1e-9) throw new FileError(at, "should have a direction, but is [0, 0, 0]");
    return v.unit();
}

function readProp(value: JsonValue, at: string): Prop3 {
    const json = readObject(value, at);
    const kind = readChoice(json.kind, below(at, "kind"), ["bar", "carabiner"]);
    if (kind === "bar") {
        onlyFields(json, at, ["id", "kind", "at", "along", "r"]);
        return {
            id: readId(json.id, below(at, "id")),
            kind: "bar",
            at: readPoint(json.at, below(at, "at")),
            along: readDirection(json.along, below(at, "along")),
            r: readPositive(json.r, below(at, "r")),
        };
    }
    onlyFields(json, at, ["id", "kind", "loop", "r"]);
    const loop = readList(json.loop, below(at, "loop")).map((p, i) =>
        readPoint(p, below(below(at, "loop"), i)),
    );
    if (loop.length < 4) throw new FileError(below(at, "loop"), "should have at least 4 points");
    return {
        id: readId(json.id, below(at, "id")),
        kind: "carabiner",
        loop,
        r: readPositive(json.r, below(at, "r")),
    };
}

function readPin(value: JsonValue, at: string): Pin3 {
    const json = readObject(value, at);
    onlyFields(json, at, ["id", "at", "along"]);
    return {
        id: readId(json.id, below(at, "id")),
        at: readPoint(json.at, below(at, "at")),
        ...(json.along !== undefined && { along: readDirection(json.along, below(at, "along")) }),
    };
}

function readSegment(value: JsonValue, at: string): Segment3 {
    const json = readObject(value, at);
    onlyFields(json, at, ["id", "name", "tension"]);
    const tension = readList(json.tension, below(at, "tension")).map((t, i) =>
        readPositive(t, below(below(at, "tension"), i)),
    );
    if (tension.length !== 2)
        throw new FileError(
            below(at, "tension"),
            `should be two numbers, but has ${tension.length}`,
        );
    return {
        id: readId(json.id, below(at, "id")),
        name: readString(json.name, below(at, "name")),
        tension: [tension[0], tension[1]],
    };
}

function readRope(value: JsonValue | undefined, at: string): PinnedRope {
    const json = readObject(value, at);
    onlyFields(json, at, ["pins", "segments"]);
    const pins = readList(json.pins, below(at, "pins")).map((p, i) =>
        readPin(p, below(below(at, "pins"), i)),
    );
    if (pins.length < 2) throw new FileError(below(at, "pins"), "should have at least 2 pins");
    const segments = readList(json.segments, below(at, "segments")).map((s, i) =>
        readSegment(s, below(below(at, "segments"), i)),
    );
    if (segments.length !== pins.length - 1)
        throw new FileError(
            below(at, "segments"),
            `should be one between each two pins (${pins.length - 1}), but has ${segments.length}`,
        );
    return { pins, segments };
}

function readCrossing(value: JsonValue, at: string): DrawnCrossing {
    const list = readList(value, at);
    if (list.length !== 2)
        throw new FileError(at, `should be [crossing, "over" or "under"], but has ${list.length}`);
    return {
        crossing: readCount(list[0], below(at, 0), 1),
        over: readChoice(list[1], below(at, 1), ["over", "under"]) === "over",
    };
}

/** A stage as it was run. Its segments may since have been joined into others, so their ids aren't checked. */
function readStage(value: JsonValue, at: string): Stage {
    const json = readObject(value, at);
    onlyFields(json, at, ["shorten", "hold", "straight", "until", "reached", "ended"]);
    const ids = (key: string) =>
        readList(json[key] ?? [], below(at, key)).map((v, i) =>
            readId(v, below(below(at, key), i)),
        );
    return {
        shorten: ids("shorten"),
        hold: ids("hold"),
        straight: ids("straight"),
        ...(json.until !== undefined && { until: readFraction(json.until, below(at, "until")) }),
        reached: readNumber(json.reached, below(at, "reached")),
        ended: readChoice(json.ended, below(at, "ended"), ["jammed", "far enough", "stopped"]),
    };
}

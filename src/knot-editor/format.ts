/**
 * The knot file: one knot, its finished picture and its tying steps, holding only what can't be worked out. The
 * format is described in `docs/knot-editor.md`; its versions and upgrades are in `versions.ts`.
 *
 * Coordinates are rope diameters with y down, as in SVG, and angles are degrees. Strands, segments and pins are
 * counted from 0 in the file.
 */

import type { Plugin } from "prettier";
import * as babel from "prettier/plugins/babel";
import * as estree from "prettier/plugins/estree";
import { format as prettierFormat } from "prettier/standalone";

import { MAX_TENSION, MIN_TENSION } from "@/lib/hobby";

import { kindOf, PROP_KIND_NAMES, PROP_KINDS, type Prop } from "./props";
import {
    below,
    FileError,
    onlyFields,
    readChoice,
    readCount,
    readList,
    readNumber,
    readObject,
    readPositive,
    readString,
} from "./read-json";
import {
    CURRENT_VERSION,
    UPGRADES,
    type JsonObject,
    type JsonValue,
    type Upgrade,
} from "./versions";

export type { Prop } from "./props";
export type { PassEntry, PassSide } from "./props";

/** What a knot file says it is. */
export const FORMAT = "avut-knot";

/** The colours a rope can be. Each is a set of tokens in `globals.css`. */
export const ROPE_COLOURS = ["orange", "green", "blue", "purple", "yellow"] as const;
export type RopeColour = (typeof ROPE_COLOURS)[number];

/** A point a strand passes through, and the way it runs through it (degrees), when it holds one. */
export type Pin = { x: number; y: number; angle?: number };

/**
 * The curve between two pins. `tension` shapes it, one at each end (1 by default). A locked segment holds its
 * `length` too, and `tension` is then the ratio the editor keeps while it scales them to meet that length.
 */
export type StrandSegment = { tension: [number, number]; length?: number };

type StrandShape = {
    /** At least two. */
    pins: Pin[];
    /** One fewer than the pins: segment k runs from pin k to pin k + 1. */
    segments: StrandSegment[];
};
export type Rope = StrandShape & { kind: "rope"; colour: RopeColour; name?: string };
export type Arrow = StrandShape & { kind: "arrow" };
/** A rope or an arrow: built and edited the same way, and drawn differently. */
export type Strand = Rope | Arrow;
export const STRAND_KINDS = ["rope", "arrow"] as const;

/** A segment of a picture: its strand, and which segment of that strand. */
export type SegmentRef = [strand: number, segment: number];

/** A pin of a picture: its strand, and which pin of that strand. */
export type PinRef = [strand: number, pin: number];

/**
 * Which of two segments is on top where they cross. `n` (from 1) says which of their crossings it is, counting along
 * whichever of the two comes first in the picture (the lower strand, then the lower segment). An entry naming one
 * segment twice is left by deleting the pin between two segments that crossed: it can't be matched, and is shown as
 * one to check until it's removed.
 */
export type CrossingEntry = { over: SegmentRef; under: SegmentRef; n: number };

/** The knot, or one of its steps, as drawn. Its view is worked out from what's in it. */
export type Picture = { strands: Strand[]; crossings: CrossingEntry[]; props: Prop[] };

/** A tying step. Numbers are typed, not counted, and repeat where a step is shown in more than one picture. */
export type Step = { number: number; instructions: string; picture: Picture };

export type KnotFile = {
    name: string;
    description?: string;
    about?: string;
    /** The finished knot. */
    knot: Picture;
    steps: Step[];
};

/** Whether two segment references are the same segment. */
export const sameSegment = (a: SegmentRef, b: SegmentRef) => a[0] === b[0] && a[1] === b[1];

/** Whether segment a comes before segment b in the picture's order. */
export const segmentBefore = (a: SegmentRef, b: SegmentRef) =>
    a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

/** A crossing's pair of segments in the picture's order: the one `n` counts along first. */
export const crossingPair = (entry: CrossingEntry): [SegmentRef, SegmentRef] =>
    segmentBefore(entry.over, entry.under) ? [entry.over, entry.under] : [entry.under, entry.over];

// Reading

export type ParseResult =
    | { kind: "ok"; file: KnotFile; upgradedFrom?: number }
    | { kind: "error"; reason: string };

/**
 * A knot file read from its text: its header checked, upgraded from its version to the current one, then checked
 * against the types. The reason for refusing one says where in the file the problem is.
 */
export function parseKnotFile(
    text: string,
    { current, upgrades }: { current: number; upgrades: Upgrade[] } = {
        current: CURRENT_VERSION,
        upgrades: UPGRADES,
    },
): ParseResult {
    let json: JsonValue;
    try {
        json = JSON.parse(text) as JsonValue;
    } catch (e) {
        return { kind: "error", reason: `This isn't JSON: ${(e as Error).message}` };
    }
    try {
        let file = readObject(json, "");
        if (file.format !== FORMAT)
            return {
                kind: "error",
                reason:
                    file.format === undefined
                        ? `This isn't a knot file: it has no "format".`
                        : `This isn't a knot file: its format is ${JSON.stringify(file.format)}, not "${FORMAT}".`,
            };
        const version = readCount(file.version, "version", 1);
        if (version > current)
            return {
                kind: "error",
                reason: `This file is version ${version}, newer than this editor reads (version ${current}).`,
            };
        for (let v = version; v < current; v++) {
            const upgrade = upgrades[v - 1];
            if (!upgrade) throw new FileError("", `there's no upgrade from version ${v}`);
            file = { ...upgrade(file), version: v + 1 };
        }
        return {
            kind: "ok",
            file: readFile(file),
            ...(version < current && { upgradedFrom: version }),
        };
    } catch (e) {
        if (e instanceof FileError) return { kind: "error", reason: e.message };
        throw e;
    }
}

function readFile(json: JsonObject): KnotFile {
    onlyFields(json, "", ["format", "version", "name", "description", "about", "knot", "steps"]);
    const file: KnotFile = {
        name: readString(json.name, "name"),
        knot: readPicture(json.knot, "knot"),
        steps: [],
    };
    if (json.description !== undefined)
        file.description = readString(json.description, "description");
    if (json.about !== undefined) file.about = readString(json.about, "about");
    if (json.steps !== undefined)
        file.steps = readList(json.steps, "steps").map((item, k) => {
            const at = below("steps", k);
            const step = readObject(item, at);
            onlyFields(step, at, ["number", "instructions", "picture"]);
            return {
                number: readCount(step.number, below(at, "number"), 1),
                instructions: readString(step.instructions, below(at, "instructions")),
                picture: readPicture(step.picture, below(at, "picture")),
            };
        });
    return file;
}

function readPicture(value: JsonValue | undefined, at: string): Picture {
    const json = readObject(value, at);
    onlyFields(json, at, ["strands", "crossings", "props"]);
    const strands = readList(json.strands, below(at, "strands")).map((s, k) =>
        readStrand(s, below(below(at, "strands"), k)),
    );
    const segmentAt = (value: JsonValue | undefined, where: string): SegmentRef => {
        const ref = readList(value, where);
        if (ref.length !== 2)
            throw new FileError(where, `should be [strand, segment], but has ${ref.length} items`);
        return checkSegment(
            [readCount(ref[0], below(where, 0), 0), readCount(ref[1], below(where, 1), 0)],
            strands,
            where,
        );
    };

    const crossings = readList(json.crossings, below(at, "crossings")).map(
        (item, k): CrossingEntry => {
            const where = below(below(at, "crossings"), k);
            const entry = readObject(item, where);
            onlyFields(entry, where, ["over", "under", "n"]);
            const over = segmentAt(entry.over, below(where, "over"));
            const under = segmentAt(entry.under, below(where, "under"));
            const n = entry.n === undefined ? 1 : readCount(entry.n, below(where, "n"), 1);
            return { over, under, n };
        },
    );
    crossings.forEach((entry, k) => {
        const [a, b] = crossingPair(entry);
        const first = crossings.findIndex((other) => {
            const [c, d] = crossingPair(other);
            return sameSegment(a, c) && sameSegment(b, d) && other.n === entry.n;
        });
        if (first < k)
            throw new FileError(
                below(below(at, "crossings"), k),
                `the same crossing as crossings[${first}] (the same segments, n ${entry.n})`,
            );
    });

    const props = readList(json.props ?? [], below(at, "props")).map((item, k) => {
        const where = below(below(at, "props"), k);
        const kind = readChoice(
            readObject(item, where).kind,
            below(where, "kind"),
            PROP_KIND_NAMES,
        );
        const prop = PROP_KINDS[kind].read(item, where);
        const passes = kindOf(prop).passes(prop);
        passes.forEach(([strand, segment, n], j) => {
            const passAt = below(below(where, "passes"), j);
            checkSegment([strand, segment], strands, passAt);
            const first = passes.findIndex(
                (p) => p[0] === strand && p[1] === segment && p[2] === n,
            );
            if (first < j)
                throw new FileError(
                    passAt,
                    `the same pass as passes[${first}] (the same segment, n ${n})`,
                );
        });
        return prop;
    });

    return { strands, crossings, props };
}

/** The reference, if it names a segment of one of the strands. */
function checkSegment(ref: SegmentRef, strands: Strand[], at: string): SegmentRef {
    const [s, k] = ref;
    if (s >= strands.length)
        throw new FileError(at, `names strand ${s}, but there are ${strands.length} strands`);
    if (k >= strands[s].segments.length)
        throw new FileError(
            at,
            `names segment ${k} of strand ${s}, which has ${strands[s].segments.length}`,
        );
    return ref;
}

function readStrand(value: JsonValue, at: string): Strand {
    const json = readObject(value, at);
    const kind = readChoice(json.kind, below(at, "kind"), STRAND_KINDS);
    onlyFields(
        json,
        at,
        kind === "rope"
            ? ["kind", "colour", "name", "pins", "segments"]
            : ["kind", "pins", "segments"],
    );
    const pins = readList(json.pins, below(at, "pins")).map((item, k): Pin => {
        const where = below(below(at, "pins"), k);
        const pin = readObject(item, where);
        onlyFields(pin, where, ["x", "y", "angle"]);
        return {
            x: readNumber(pin.x, below(where, "x")),
            y: readNumber(pin.y, below(where, "y")),
            ...(pin.angle !== undefined && { angle: readNumber(pin.angle, below(where, "angle")) }),
        };
    });
    const segments = readList(json.segments, below(at, "segments")).map(
        (item, k): StrandSegment => {
            const where = below(below(at, "segments"), k);
            const segment = readObject(item, where);
            onlyFields(segment, where, ["length", "tension"]);
            let tension: [number, number] = [1, 1];
            if (segment.tension !== undefined) {
                const pair = readList(segment.tension, below(where, "tension"));
                if (pair.length !== 2)
                    throw new FileError(
                        below(where, "tension"),
                        `should be two numbers, but has ${pair.length}`,
                    );
                tension = [0, 1].map((end) => {
                    const t = readNumber(pair[end], below(below(where, "tension"), end));
                    if (t < MIN_TENSION || t > MAX_TENSION)
                        throw new FileError(
                            below(below(where, "tension"), end),
                            `should be from ${MIN_TENSION} to ${MAX_TENSION}, but is ${t}`,
                        );
                    return t;
                }) as [number, number];
            }
            return {
                tension,
                ...(segment.length !== undefined && {
                    length: readPositive(segment.length, below(where, "length")),
                }),
            };
        },
    );
    if (pins.length < 2)
        throw new FileError(at, `has ${pins.length} pins, but a strand needs at least 2`);
    if (segments.length !== pins.length - 1)
        throw new FileError(
            at,
            `${pins.length} pins but ${segments.length} segments (there should be ${pins.length - 1})`,
        );
    if (kind === "arrow") return { kind, pins, segments };
    return {
        kind,
        colour: readChoice(json.colour, below(at, "colour"), ROPE_COLOURS),
        ...(json.name !== undefined && { name: readString(json.name, below(at, "name")) }),
        pins,
        segments,
    };
}

// Writing

/** A number as it's written: to 1e-4, as `rounded()` in `rope-drawing.tsx` rounds for drawing. */
const round = (value: number) => Math.round(value * 1e4) / 1e4 || 0;

/** Objects written with each field on its own line, however short: the file, its pictures, steps and strands. */
type Expanded = WeakSet<object>;

function writePicture(picture: Picture, expanded: Expanded): JsonObject {
    const json: JsonObject = {
        strands: picture.strands.map((strand) => {
            const out: JsonObject = {
                kind: strand.kind,
                ...(strand.kind === "rope" && {
                    colour: strand.colour,
                    ...(strand.name !== undefined && { name: strand.name }),
                }),
                pins: strand.pins.map((pin) => ({
                    x: pin.x,
                    y: pin.y,
                    ...(pin.angle !== undefined && { angle: pin.angle }),
                })),
                segments: strand.segments.map((segment) => ({
                    ...(segment.length !== undefined && { length: segment.length }),
                    ...((segment.tension[0] !== 1 || segment.tension[1] !== 1) && {
                        tension: [...segment.tension],
                    }),
                })),
            };
            expanded.add(out);
            return out;
        }),
        crossings: picture.crossings.map((entry) => ({
            over: [...entry.over],
            under: [...entry.under],
            ...(entry.n !== 1 && { n: entry.n }),
        })),
        ...(picture.props.length > 0 && {
            props: picture.props.map((prop) => kindOf(prop).write(prop)),
        }),
    };
    expanded.add(json);
    return json;
}

/** JSON text, with numbers rounded, compact except for the expanded objects (Prettier lays it out after). */
function stringify(value: JsonValue, expanded: Expanded): string {
    if (typeof value === "number") return JSON.stringify(round(value));
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((v) => stringify(v, expanded)).join(",")}]`;
    const fields = Object.entries(value).map(
        ([k, v]) => `${JSON.stringify(k)}:${stringify(v, expanded)}`,
    );
    return expanded.has(value) ? `{\n${fields.join(",\n")}\n}` : `{${fields.join(",")}}`;
}

/**
 * The file as text: the current version, fields in a fixed order, defaults left out (unset angles and names,
 * unlocked lengths, tensions of 1 at both ends, n of 1, and empty steps, props and passes), numbers rounded to 1e-4,
 * and laid out by Prettier with the repo's settings, so the commit hook leaves a saved file as it is.
 */
export async function writeKnotFile(file: KnotFile): Promise<string> {
    const expanded: Expanded = new WeakSet();
    const json: JsonObject = {
        format: FORMAT,
        version: CURRENT_VERSION,
        name: file.name,
        ...(file.description !== undefined && { description: file.description }),
        ...(file.about !== undefined && { about: file.about }),
        knot: writePicture(file.knot, expanded),
        ...(file.steps.length > 0 && {
            steps: file.steps.map((step) => {
                const out: JsonObject = {
                    number: step.number,
                    instructions: step.instructions,
                    picture: writePicture(step.picture, expanded),
                };
                expanded.add(out);
                return out;
            }),
        }),
    };
    expanded.add(json);
    return prettierFormat(stringify(json, expanded), {
        parser: "json",
        plugins: [babel, estree as Plugin],
        ...PRETTIER_OPTIONS,
    });
}

/** The repo's Prettier settings that lay out JSON (`.prettierrc`); a test checks they still match. */
export const PRETTIER_OPTIONS = { printWidth: 100, bracketSpacing: true, bracketSameLine: false };

/**
 * The knot file: one knot, its finished picture and its tying steps, holding only what can't be worked out. The
 * format is described in `docs/knot-editor.md`; its versions and upgrades are in `versions.ts`.
 *
 * Coordinates and sizes are millimetres with y down, as in SVG, and angles are degrees. Everything in a picture has an
 * id (see `ids.ts`), and references name things by id.
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
    readId,
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
export type { PassAt, PassEntry, PassSide } from "./props";

/** What a strand, segment, pin or prop is called in the file: a whole number from 1, unique in its picture. */
export type Id = number;

/** What a knot file says it is. */
export const FORMAT = "avut-knot";

/** The colours a rope can be. Each is a set of tokens in `globals.css`. */
export const ROPE_COLOURS = ["orange", "green", "blue", "purple", "yellow"] as const;
export type RopeColour = (typeof ROPE_COLOURS)[number];

/** A point a strand passes through, and the way it runs through it (degrees), when it holds one. */
export type FreePin = { id: Id; x: number; y: number; angle?: number };

/** Which side of its leader a linked pin is on, looking the way the leader runs. */
export type LinkSide = "left" | "right";
export const LINK_SIDES = ["left", "right"] as const;

/**
 * Where a linked pin is, from its leader (by id): beside it, at right angles to the way it runs, the two strands'
 * half-widths and `gap` (millimetres, 0 by default) apart, running the same way or, `reverse`, the other way. For
 * ropes run side by side.
 */
export type PinLink = { pin: Id; side: LinkSide; gap?: number; reverse?: true };
export type LinkedPin = { id: Id; link: PinLink };

/** A pin: free, where it's placed, or linked to another pin, its leader. */
export type Pin = FreePin | LinkedPin;

export const isLinked = (pin: Pin): pin is LinkedPin => "link" in pin;

/**
 * The curve between two pins. `tension` shapes it, one at each end (1 by default). A locked segment holds its
 * `length` too, and `tension` is then the ratio the editor keeps while it scales them to meet that length.
 */
export type StrandSegment = { id: Id; tension: [number, number]; length?: number };

type StrandShape = {
    id: Id;
    /** At least two. */
    pins: Pin[];
    /** One fewer than the pins: segment k runs from pin k to pin k + 1. */
    segments: StrandSegment[];
};
export type Rope = StrandShape & {
    kind: "rope";
    colour: RopeColour;
    /** How thick it is (millimetres). */
    diameter: number;
    name?: string;
};
export type Arrow = StrandShape & { kind: "arrow" };
/** A rope or an arrow: built and edited the same way, and drawn differently. */
export type Strand = Rope | Arrow;
export const STRAND_KINDS = ["rope", "arrow"] as const;

/** How big an arrow counts as wherever a strand's size is needed (millimetres): as thick as an 11 mm rope. */
export const ARROW_SIZE = 11;

/**
 * A strand's size (millimetres): a rope's diameter, or for an arrow, `ARROW_SIZE`. Sizes that go with a strand (how
 * tight it may bend, how far it's drawn over at a crossing, how wide it's drawn) are multiples of it.
 */
export const strandSize = (strand: Strand) =>
    strand.kind === "rope" ? strand.diameter : ARROW_SIZE;

/** A segment of a picture by where it is: its strand, and which segment of that strand (from 0). */
export type SegmentRef = [strand: number, segment: number];

/** A pin of a picture by where it is: its strand, and which pin of that strand (from 0). */
export type PinRef = [strand: number, pin: number];

/**
 * Which of two segments (by id) is on top where they cross. `n` (from 1) says which of their crossings it is,
 * counting along whichever of the two comes first in the picture (the lower strand, then the lower segment). An entry
 * naming one segment twice is left by deleting the pin between two segments that crossed: it can't be matched, and
 * is shown as one to check until it's removed.
 */
export type CrossingEntry = { over: Id; under: Id; n: number };

/** A crossing entry with its segments by where they are, as the editor matches and shows them. */
export type CrossingAt = { over: SegmentRef; under: SegmentRef; n: number };

/** The knot, or one of its steps, as drawn. Its view is worked out from what's in it. */
export type Picture = { strands: Strand[]; crossings: CrossingEntry[]; props: Prop[] };

/** A tying step. Numbers are typed, not counted, and repeat where a step is shown in more than one picture. */
export type Step = { number: number; instructions: string; picture: Picture };

/**
 * What the knot's page shows of every picture: one rectangle (millimetres, y down) shared by the knot and its steps,
 * so they line up as you step through them.
 */
export type Frame = { x: number; y: number; w: number; h: number };

export type KnotFile = {
    name: string;
    description?: string;
    about?: string;
    frame: Frame;
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
export const crossingPair = (entry: CrossingAt): [SegmentRef, SegmentRef] =>
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
    return readKnotJson(json, { current, upgrades });
}

/** A knot file already read as JSON (as a page imports one), checked and upgraded as `parseKnotFile` does. */
export function readKnotJson(
    json: JsonValue,
    { current, upgrades }: { current: number; upgrades: Upgrade[] } = {
        current: CURRENT_VERSION,
        upgrades: UPGRADES,
    },
): ParseResult {
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
    onlyFields(json, "", [
        "format",
        "version",
        "name",
        "description",
        "about",
        "frame",
        "knot",
        "steps",
    ]);
    const frame = readObject(json.frame, "frame");
    onlyFields(frame, "frame", ["x", "y", "w", "h"]);
    const file: KnotFile = {
        name: readString(json.name, "name"),
        frame: {
            x: readNumber(frame.x, "frame.x"),
            y: readNumber(frame.y, "frame.y"),
            w: readPositive(frame.w, "frame.w"),
            h: readPositive(frame.h, "frame.h"),
        },
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
    // Every id once in the picture, and each segment's for references to name.
    const seen = new Map<Id, string>();
    const once = (id: Id, where: string) => {
        const first = seen.get(id);
        if (first !== undefined)
            throw new FileError(where, `has id ${id}, which ${first} has already`);
        seen.set(id, where);
    };
    const segmentIds = new Set<Id>();
    strands.forEach((strand, i) => {
        const here = below(below(at, "strands"), i);
        once(strand.id, here);
        strand.pins.forEach((pin, k) => once(pin.id, below(below(here, "pins"), k)));
        strand.segments.forEach((segment, k) => {
            once(segment.id, below(below(here, "segments"), k));
            segmentIds.add(segment.id);
        });
    });
    const segmentId = (value: JsonValue | undefined, where: string): Id => {
        const id = readId(value, where);
        if (!segmentIds.has(id))
            throw new FileError(where, `names segment ${id}, which isn't in the picture`);
        return id;
    };

    const crossings = readList(json.crossings, below(at, "crossings")).map(
        (item, k): CrossingEntry => {
            const where = below(below(at, "crossings"), k);
            const entry = readObject(item, where);
            onlyFields(entry, where, ["over", "under", "n"]);
            const over = segmentId(entry.over, below(where, "over"));
            const under = segmentId(entry.under, below(where, "under"));
            const n = entry.n === undefined ? 1 : readCount(entry.n, below(where, "n"), 1);
            return { over, under, n };
        },
    );
    const samePair = (a: CrossingEntry, b: CrossingEntry) =>
        (a.over === b.over && a.under === b.under) || (a.over === b.under && a.under === b.over);
    crossings.forEach((entry, k) => {
        const first = crossings.findIndex((other) => samePair(entry, other) && other.n === entry.n);
        if (first < k)
            throw new FileError(
                below(below(at, "crossings"), k),
                `the same crossing as crossings[${first}] (the same segments, n ${entry.n})`,
            );
    });

    checkLinks(strands, at);

    const props = readList(json.props ?? [], below(at, "props")).map((item, k) => {
        const where = below(below(at, "props"), k);
        const kind = readChoice(
            readObject(item, where).kind,
            below(where, "kind"),
            PROP_KIND_NAMES,
        );
        const prop = PROP_KINDS[kind].read(item, where);
        once(prop.id, where);
        const passes = kindOf(prop).passes(prop);
        passes.forEach(([segment, n], j) => {
            const passAt = below(below(where, "passes"), j);
            segmentId(segment, below(passAt, 0));
            const first = passes.findIndex((p) => p[0] === segment && p[1] === n);
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

/**
 * Every link's leader is another pin of the picture, following leaders never comes back round, and a free pin that
 * leads holds an angle (its followers are placed across the way it runs).
 */
function checkLinks(strands: Strand[], at: string) {
    const pins = new Map<Id, Pin>();
    for (const strand of strands) for (const pin of strand.pins) pins.set(pin.id, pin);
    strands.forEach((strand, i) =>
        strand.pins.forEach((pin, k) => {
            if (!isLinked(pin)) return;
            const where = below(below(below(below(at, "strands"), i), "pins"), k);
            const leader = pins.get(pin.link.pin);
            if (!leader)
                throw new FileError(
                    below(below(where, "link"), "pin"),
                    `names pin ${pin.link.pin}, which isn't in the picture`,
                );
            if (leader === pin) throw new FileError(where, "is linked to itself");
            const seen = new Set([pin.id]);
            let next: Pin = leader;
            while (isLinked(next)) {
                if (seen.has(next.id)) throw new FileError(where, "is linked round in a loop");
                seen.add(next.id);
                next = pins.get(next.link.pin)!;
            }
            if (!isLinked(leader) && leader.angle === undefined)
                throw new FileError(
                    where,
                    `is linked to pin ${leader.id}, which holds no angle (a free pin that leads must)`,
                );
        }),
    );
}

function readLink(value: JsonValue | undefined, at: string): PinLink {
    const json = readObject(value, at);
    onlyFields(json, at, ["pin", "side", "gap", "reverse"]);
    const link: PinLink = {
        pin: readId(json.pin, below(at, "pin")),
        side: readChoice(json.side, below(at, "side"), LINK_SIDES),
    };
    if (json.gap !== undefined) {
        const gap = readNumber(json.gap, below(at, "gap"));
        if (gap < 0) throw new FileError(below(at, "gap"), `should be 0 or more, but is ${gap}`);
        link.gap = gap;
    }
    if (json.reverse !== undefined) {
        if (json.reverse !== true)
            throw new FileError(below(at, "reverse"), "should be true, or left out");
        link.reverse = true;
    }
    return link;
}

function readStrand(value: JsonValue, at: string): Strand {
    const json = readObject(value, at);
    const kind = readChoice(json.kind, below(at, "kind"), STRAND_KINDS);
    onlyFields(
        json,
        at,
        kind === "rope"
            ? ["id", "kind", "colour", "diameter", "name", "pins", "segments"]
            : ["id", "kind", "pins", "segments"],
    );
    const pins = readList(json.pins, below(at, "pins")).map((item, k): Pin => {
        const where = below(below(at, "pins"), k);
        const pin = readObject(item, where);
        if (pin.link !== undefined) {
            onlyFields(pin, where, ["id", "link"]);
            return {
                id: readId(pin.id, below(where, "id")),
                link: readLink(pin.link, below(where, "link")),
            };
        }
        onlyFields(pin, where, ["id", "x", "y", "angle"]);
        return {
            id: readId(pin.id, below(where, "id")),
            x: readNumber(pin.x, below(where, "x")),
            y: readNumber(pin.y, below(where, "y")),
            ...(pin.angle !== undefined && { angle: readNumber(pin.angle, below(where, "angle")) }),
        };
    });
    const segments = readList(json.segments, below(at, "segments")).map(
        (item, k): StrandSegment => {
            const where = below(below(at, "segments"), k);
            const segment = readObject(item, where);
            onlyFields(segment, where, ["id", "length", "tension"]);
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
                id: readId(segment.id, below(where, "id")),
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
    const id = readId(json.id, below(at, "id"));
    if (kind === "arrow") return { id, kind, pins, segments };
    return {
        id,
        kind,
        colour: readChoice(json.colour, below(at, "colour"), ROPE_COLOURS),
        diameter: readPositive(json.diameter, below(at, "diameter")),
        ...(json.name !== undefined && { name: readString(json.name, below(at, "name")) }),
        pins,
        segments,
    };
}

// Writing

/** A number as it's written: to 0.01 (a hundredth of a millimetre, for coordinates and sizes). */
const round = (value: number) => Math.round(value * 100) / 100 || 0;

/** Objects written with each field on its own line, however short: the file, its pictures, steps and strands. */
type Expanded = WeakSet<object>;

function writePicture(picture: Picture, expanded: Expanded): JsonObject {
    const json: JsonObject = {
        strands: picture.strands.map((strand) => {
            const out: JsonObject = {
                id: strand.id,
                kind: strand.kind,
                ...(strand.kind === "rope" && {
                    colour: strand.colour,
                    diameter: strand.diameter,
                    ...(strand.name !== undefined && { name: strand.name }),
                }),
                pins: strand.pins.map(
                    (pin): JsonObject =>
                        isLinked(pin)
                            ? {
                                  id: pin.id,
                                  link: {
                                      pin: pin.link.pin,
                                      side: pin.link.side,
                                      ...(pin.link.gap && { gap: pin.link.gap }),
                                      ...(pin.link.reverse && { reverse: true }),
                                  },
                              }
                            : {
                                  id: pin.id,
                                  x: pin.x,
                                  y: pin.y,
                                  ...(pin.angle !== undefined && { angle: pin.angle }),
                              },
                ),
                segments: strand.segments.map((segment) => ({
                    id: segment.id,
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
            over: entry.over,
            under: entry.under,
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
 * unlocked lengths, tensions of 1 at both ends, n of 1, and empty steps, props and passes), numbers rounded to 0.01,
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
        frame: { x: file.frame.x, y: file.frame.y, w: file.frame.w, h: file.frame.h },
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

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import * as prettier from "prettier";
import { describe, expect, it } from "vitest";

import {
    parseKnotFile,
    PRETTIER_OPTIONS,
    writeKnotFile,
    type KnotFile,
    type Picture,
} from "./format";
import { CURRENT_VERSION, UPGRADES, type JsonObject } from "./versions";

const SAMPLES = join(import.meta.dirname, "samples");

/** A picture using every field the format has. */
const PICTURE: Picture = {
    strands: [
        {
            kind: "rope",
            colour: "orange",
            diameter: 11,
            name: "Main line",
            pins: [
                { x: 0, y: 10, angle: -90 },
                { x: 0.5, y: 0 },
                { x: -3.25, y: -2.12 },
            ],
            segments: [{ tension: [1, 1], length: 10.5 }, { tension: [1.2, 0.8] }],
        },
        {
            kind: "rope",
            colour: "green",
            diameter: 6.5,
            pins: [
                { x: -5, y: 0 },
                { x: 5, y: 0, angle: 12.5 },
            ],
            segments: [{ tension: [1.5, 1.5], length: 10.2 }],
        },
        {
            kind: "arrow",
            pins: [
                { x: 2, y: 4 },
                { x: 2, y: -4 },
            ],
            segments: [{ tension: [1, 1] }],
        },
    ],
    crossings: [
        { over: [0, 0], under: [1, 0], n: 1 },
        { over: [2, 0], under: [1, 0], n: 1 },
        { over: [1, 0], under: [2, 0], n: 2 },
    ],
    props: [
        {
            kind: "bar",
            x: 0,
            y: 0,
            r: 1.6,
            length: 20,
            passes: [
                [0, 0, 1, "front"],
                [1, 0, 1, "behind"],
            ],
        },
        { kind: "bar", x: 6, y: 6, r: 1, passes: [] },
    ],
};

const FULL: KnotFile = {
    name: "Test knot",
    description: "A line or so.",
    about: "Longer text.\n\nOver two paragraphs.",
    frame: { x: -12.5, y: -10, w: 25, h: 20.25 },
    knot: PICTURE,
    steps: [
        { number: 1, instructions: "First.", picture: PICTURE },
        { number: 1, instructions: "First, continued.", picture: PICTURE },
        { number: 2, instructions: "Second.", picture: { strands: [], crossings: [], props: [] } },
    ],
};

const BARE: KnotFile = {
    name: "Bare",
    frame: { x: -5, y: -5, w: 10, h: 10 },
    knot: {
        strands: [
            {
                kind: "rope",
                colour: "orange",
                diameter: 11,
                pins: [
                    { x: 0, y: 0 },
                    { x: 3, y: 0 },
                ],
                segments: [{ tension: [1, 1] }],
            },
        ],
        crossings: [],
        props: [{ kind: "bar", x: 0, y: 2, r: 1, passes: [] }],
    },
    steps: [],
};

/** A written file read back as JSON, as loosely typed as `JSON.parse` gives it, for breaking it in tests. */
type Written = ReturnType<typeof JSON.parse>;

/** The written file as JSON, changed by `edit`, back to text. */
async function edited(file: KnotFile, edit: (json: Written) => void) {
    const json = JSON.parse(await writeKnotFile(file));
    edit(json);
    return JSON.stringify(json);
}

describe("writeKnotFile and parseKnotFile", () => {
    it("round-trips a full file exactly", async () => {
        const text = await writeKnotFile(FULL);
        const read = parseKnotFile(text);
        expect(read).toEqual({ kind: "ok", file: FULL });
        if (read.kind === "ok") expect(await writeKnotFile(read.file)).toBe(text);
    });

    it("starts with the format and version", async () => {
        const json = JSON.parse(await writeKnotFile(BARE));
        expect(Object.keys(json).slice(0, 2)).toEqual(["format", "version"]);
        expect(json.format).toBe("avut-knot");
        expect(json.version).toBe(CURRENT_VERSION);
    });

    it("leaves out what's unset or the default", async () => {
        const json = JSON.parse(await writeKnotFile(BARE));
        expect(Object.keys(json)).toEqual(["format", "version", "name", "frame", "knot"]);
        const strand = json.knot.strands[0];
        expect(Object.keys(strand)).toEqual(["kind", "colour", "diameter", "pins", "segments"]);
        expect(strand.pins[0]).toEqual({ x: 0, y: 0 });
        expect(strand.segments[0]).toEqual({});
        expect(json.knot.props[0]).toEqual({ kind: "bar", x: 0, y: 2, r: 1 });

        const full = JSON.parse(await writeKnotFile(FULL));
        expect(full.knot.strands[0].segments[0]).toEqual({ length: 10.5 });
        expect(full.knot.crossings[0]).toEqual({ over: [0, 0], under: [1, 0] });
        expect(full.knot.crossings[2]).toEqual({ over: [1, 0], under: [2, 0], n: 2 });
        expect(Object.keys(full.steps[2].picture)).toEqual(["strands", "crossings"]);
    });

    it("rounds numbers to 0.01", async () => {
        const file = structuredClone(BARE);
        file.knot.strands[0].pins[1] = { x: 1 / 3, y: -1e-9, angle: 45.0049 };
        const json = JSON.parse(await writeKnotFile(file));
        expect(json.knot.strands[0].pins[1]).toEqual({ x: 0.33, y: 0, angle: 45 });
    });

    it("lays the file out as the repo's Prettier does", async () => {
        const filepath = join(SAMPLES, "v1.json");
        const config = await prettier.resolveConfig(filepath);
        for (const file of [FULL, BARE]) {
            const text = await writeKnotFile(file);
            expect(await prettier.format(text, { ...config, filepath })).toBe(text);
        }
        // The writer's own settings are the repo's.
        for (const [key, value] of Object.entries(PRETTIER_OPTIONS))
            expect(config?.[key as keyof typeof config] ?? value).toBe(value);
    });

    it("refuses a bad file, saying where", async () => {
        const cases: [(json: Written) => void, string][] = [
            [(j) => (j.name = 3), "name: should be text"],
            [(j) => delete j.knot, "knot: should be an object"],
            [(j) => (j.extra = 1), 'has an unknown field "extra"'],
            [(j) => j.knot.strands[0].segments.pop(), "knot.strands[0]: 3 pins but 1 segments"],
            [
                (j) => (j.steps[1].picture.strands[2].pins = [{ x: 0, y: 0 }]),
                "steps[1].picture.strands[2]: has 1 pins",
            ],
            [
                (j) => (j.knot.strands[1].colour = "pink"),
                'knot.strands[1].colour: should be one of "orange"',
            ],
            [(j) => delete j.knot.strands[1].colour, "knot.strands[1].colour"],
            [
                (j) => (j.knot.strands[2].colour = "orange"),
                'knot.strands[2]: has an unknown field "colour"',
            ],
            [(j) => (j.knot.strands[0].kind = "string"), "knot.strands[0].kind"],
            [
                (j) => (j.knot.strands[0].pins[1].x = "1"),
                "knot.strands[0].pins[1].x: should be a number",
            ],
            [
                (j) => (j.knot.strands[0].segments[1].tension = [1, 9]),
                "segments[1].tension[1]: should be from 0.75",
            ],
            [
                (j) => (j.knot.strands[0].segments[0].length = 0),
                "segments[0].length: should be more than 0",
            ],
            [(j) => (j.knot.crossings[0].over = [3, 0]), "knot.crossings[0].over: names strand 3"],
            [
                (j) => (j.knot.crossings[0].under = [1, 1]),
                "knot.crossings[0].under: names segment 1 of strand 1",
            ],
            [
                (j) => (j.knot.crossings[2].n = 1),
                "knot.crossings[2]: the same crossing as crossings[1]",
            ],
            [
                (j) => (j.knot.crossings[0].n = 0),
                "knot.crossings[0].n: should be a whole number from 1",
            ],
            [(j) => (j.knot.props[0].kind = "tree"), "knot.props[0].kind"],
            [
                (j) => (j.knot.props[0].passes[1] = [0, 2, 1, "front"]),
                "knot.props[0].passes[1]: names segment 2",
            ],
            [(j) => (j.knot.props[0].passes[1][3] = "under"), "knot.props[0].passes[1][3]"],
            [
                (j) => (j.knot.props[0].passes[1] = [0, 0, 1, "behind"]),
                "the same pass as passes[0]",
            ],
            [
                (j) => (j.knot.props[1].passes = [[0, 0, 1, "front"]]),
                "knot.props[1]: a bar seen end on",
            ],
            [(j) => (j.knot.props[0].r = -1), "knot.props[0].r: should be more than 0"],
            [(j) => delete j.frame, "frame: should be an object"],
            [(j) => (j.frame.w = 0), "frame.w: should be more than 0"],
            [(j) => delete j.frame.h, "frame.h: should be a number"],
            [(j) => (j.frame.d = 1), 'frame: has an unknown field "d"'],
            [
                (j) => delete j.knot.strands[1].diameter,
                "knot.strands[1].diameter: should be a number",
            ],
            [
                (j) => (j.knot.strands[0].diameter = -2),
                "knot.strands[0].diameter: should be more than 0",
            ],
            [
                (j) => (j.knot.strands[2].diameter = 11),
                'knot.strands[2]: has an unknown field "diameter"',
            ],
            [(j) => (j.steps[0].number = 0), "steps[0].number: should be a whole number from 1"],
            [(j) => (j.steps[0].number = 1.5), "steps[0].number"],
            [(j) => delete j.steps[2].instructions, "steps[2].instructions: should be text"],
        ];
        for (const [edit, reason] of cases) {
            const read = parseKnotFile(await edited(FULL, edit));
            expect(read.kind, reason).toBe("error");
            if (read.kind === "error") expect(read.reason).toContain(reason);
        }
        expect(parseKnotFile("{ not json")).toMatchObject({
            kind: "error",
            reason: expect.stringContaining("JSON"),
        });
    });

    it("refuses a newer version, or another format, saying so", async () => {
        const newer = parseKnotFile(await edited(BARE, (j) => (j.version = CURRENT_VERSION + 1)));
        expect(newer).toEqual({
            kind: "error",
            reason: `This file is version ${CURRENT_VERSION + 1}, newer than this editor reads (version ${CURRENT_VERSION}).`,
        });
        const other = parseKnotFile(await edited(BARE, (j) => (j.format = "avut-rope")));
        expect(other).toMatchObject({
            kind: "error",
            reason: expect.stringContaining('"avut-rope"'),
        });
        const none = parseKnotFile(await edited(BARE, (j) => delete j.format));
        expect(none).toMatchObject({
            kind: "error",
            reason: expect.stringContaining('no "format"'),
        });
    });
});

describe("versions", () => {
    const samples = readdirSync(SAMPLES)
        .map((name) => ({ name, version: Number(/^v(\d+)\.json$/.exec(name)?.[1]) }))
        .filter((s) => s.version > 0);

    it("has an upgrade from each version to the next", () => {
        expect(UPGRADES).toHaveLength(CURRENT_VERSION - 1);
    });

    it("keeps a sample of every version", () => {
        expect(samples.map((s) => s.version).sort()).toEqual(
            Array.from({ length: CURRENT_VERSION }, (_, k) => k + 1),
        );
    });

    it("opens every sample, the current one coming back byte for byte", async () => {
        for (const { name, version } of samples) {
            const text = readFileSync(join(SAMPLES, name), "utf8");
            const read = parseKnotFile(text);
            expect(read.kind, name).toBe("ok");
            if (read.kind !== "ok") continue;
            if (version === CURRENT_VERSION) {
                expect(read.upgradedFrom).toBeUndefined();
                expect(await writeKnotFile(read.file)).toBe(text);
            } else expect(read.upgradedFrom).toBe(version);
        }
    });

    it("upgrades version 1 to millimetres, with 11 mm ropes and a frame round everything", () => {
        const text = readFileSync(join(SAMPLES, "v1.json"), "utf8");
        const old = JSON.parse(text);
        const read = parseKnotFile(text);
        expect(read).toMatchObject({ kind: "ok", upgradedFrom: 1 });
        if (read.kind !== "ok") return;
        const { file } = read;
        const pictures = [file.knot, ...file.steps.map((s) => s.picture)];
        const oldPictures = [old.knot, ...old.steps.map((s: Written) => s.picture)];
        pictures.forEach((picture, p) =>
            picture.strands.forEach((strand, i) => {
                const was = oldPictures[p].strands[i];
                if (strand.kind === "rope") expect(strand.diameter).toBe(11);
                strand.pins.forEach((pin, k) => {
                    expect(pin.x).toBeCloseTo(was.pins[k].x * 11, 9);
                    expect(pin.y).toBeCloseTo(was.pins[k].y * 11, 9);
                    expect(pin.angle).toBe(was.pins[k].angle);
                });
                strand.segments.forEach((segment, k) => {
                    const length = was.segments[k].length;
                    if (length === undefined) expect(segment.length).toBeUndefined();
                    else expect(segment.length).toBeCloseTo(length * 11, 9);
                    expect(segment.tension).toEqual(was.segments[k].tension ?? [1, 1]);
                });
            }),
        );
        expect(file.knot.props[0]).toMatchObject({ x: 0, y: 0, r: 17.6, length: 220 });
        expect(file.knot.props[0].passes).toEqual(old.knot.props[0].passes);

        // Whole centimetres, at least 30 mm clear of every pin and of the bar.
        const { frame } = file;
        for (const v of [frame.x, frame.y, frame.w, frame.h]) expect(Math.abs(v % 10)).toBe(0);
        for (const picture of pictures) {
            for (const strand of picture.strands)
                for (const pin of strand.pins) {
                    expect(pin.x - frame.x).toBeGreaterThanOrEqual(30);
                    expect(frame.x + frame.w - pin.x).toBeGreaterThanOrEqual(30);
                    expect(pin.y - frame.y).toBeGreaterThanOrEqual(30);
                    expect(frame.y + frame.h - pin.y).toBeGreaterThanOrEqual(30);
                }
        }
        expect(frame.x).toBeLessThanOrEqual(-110 - 30);
        expect(frame.x + frame.w).toBeGreaterThanOrEqual(110 + 30);
    });

    it("runs a file through the upgrades from its version", () => {
        const text = readFileSync(join(SAMPLES, "v1.json"), "utf8");
        const upgrade = (file: JsonObject) => ({ ...file, name: String(file.name).toUpperCase() });
        const read = parseKnotFile(text, { current: 3, upgrades: [...UPGRADES, upgrade] });
        expect(read).toMatchObject({ kind: "ok", upgradedFrom: 1 });
        if (read.kind === "ok") expect(read.file.name).toBe(JSON.parse(text).name.toUpperCase());
        // Without the last upgrade it can't be opened as version 3.
        expect(parseKnotFile(text, { current: 3, upgrades: UPGRADES })).toMatchObject({
            kind: "error",
            reason: expect.stringContaining("no upgrade from version 2"),
        });
    });
});

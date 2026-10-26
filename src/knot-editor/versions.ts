/**
 * The knot file's versions, and the upgrades from each to the next.
 *
 * To change the format (a field added, renamed, moved or read differently):
 *
 * 1. Bump `CURRENT_VERSION` by one.
 * 2. Add an upgrade to the end of `UPGRADES`, taking a file of the version before to the new one. It works on plain
 *    JSON: old versions' shapes aren't kept as types, and the file's checks (`knot-file.ts`) run only after the last
 *    upgrade, against the current types.
 * 3. Change the types, checks and writer in `knot-file.ts` to match.
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
export const CURRENT_VERSION = 3;

// The upgrades work on JSON as it comes, before it's checked: whatever isn't the shape they expect is passed over,
// for the checks to refuse after.

const numberIn = (value: JsonValue | undefined) => (typeof value === "number" ? value : undefined);
const listIn = (value: JsonValue | undefined) => (Array.isArray(value) ? value : []);
const objectIn = (value: JsonValue | undefined): JsonObject | undefined =>
    value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;

/** The knot's picture and every step's, as they're found. */
const picturesIn = (file: JsonObject) =>
    [objectIn(file.knot), ...listIn(file.steps).map((s) => objectIn(objectIn(s)?.picture))].filter(
        (p) => p !== undefined,
    );

/** Version 1's unit, a rope's diameter, in millimetres: the size its ropes are given. */
const V1_DIAMETER = 11;

/** How far clear of every pin and prop the frame given to a version 1 file is (millimetres). */
const V1_FRAME_CLEAR = 30;

/**
 * Version 2 is in millimetres, where version 1 was in rope diameters, and adds each rope's diameter and the knot's
 * frame. Every coordinate, locked length and prop size is scaled from diameters of 11 mm (a prop's numbers are all
 * places and sizes: version 1 has only the bar), every rope is 11 mm, and the frame is fitted round every pin and
 * prop of every picture, 30 mm clear (which allows for curves bulging past their pins), out to whole centimetres.
 */
function toMillimetres(file: JsonObject): JsonObject {
    const scaled = (value: JsonValue | undefined) => {
        const n = numberIn(value);
        return n === undefined ? value : n * V1_DIAMETER;
    };
    const xs: number[] = [];
    const ys: number[] = [];
    for (const picture of picturesIn(file)) {
        for (const strand of listIn(picture.strands).map(objectIn)) {
            if (!strand) continue;
            if (strand.kind === "rope") strand.diameter = V1_DIAMETER;
            for (const pin of listIn(strand.pins).map(objectIn)) {
                if (!pin) continue;
                [pin.x, pin.y] = [scaled(pin.x), scaled(pin.y)] as JsonValue[];
                const [x, y] = [numberIn(pin.x), numberIn(pin.y)];
                if (x === undefined || y === undefined) continue;
                xs.push(x);
                ys.push(y);
            }
            for (const segment of listIn(strand.segments).map(objectIn))
                if (segment?.length !== undefined) segment.length = scaled(segment.length)!;
        }
        for (const prop of listIn(picture.props).map(objectIn)) {
            if (!prop) continue;
            for (const [key, value] of Object.entries(prop))
                if (typeof value === "number") prop[key] = value * V1_DIAMETER;
            const [x, y, r] = [numberIn(prop.x), numberIn(prop.y), numberIn(prop.r) ?? 0];
            if (x === undefined || y === undefined) continue;
            const half = numberIn(prop.length) ?? 2 * r;
            xs.push(x - half / 2, x + half / 2);
            ys.push(y - r, y + r);
        }
    }
    const outTo = (value: number, way: 1 | -1) =>
        (way > 0 ? Math.ceil : Math.floor)((value + way * V1_FRAME_CLEAR) / 10) * 10;
    const [x0, x1, y0, y1] = xs.length
        ? [
              outTo(Math.min(...xs), -1),
              outTo(Math.max(...xs), 1),
              outTo(Math.min(...ys), -1),
              outTo(Math.max(...ys), 1),
          ]
        : [-150, 150, -100, 100];
    return { ...file, frame: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}

/**
 * Version 3 gives everything in a picture an id, and refers to segments by id. Everything is numbered in order across
 * the file, from 1 (each picture's strands, each with its pins and then its segments, then its props), so no two
 * things share an id: version 2 doesn't say which things in two steps are the same. Crossings' and passes' [strand,
 * segment] become the segment's id; one naming a segment that isn't there is left as it is, for the checks to refuse.
 */
function addIds(file: JsonObject): JsonObject {
    let next = 1;
    for (const picture of picturesIn(file)) {
        const segmentIds: number[][] = [];
        listIn(picture.strands).forEach((item, i, strands) => {
            const ids: number[] = [];
            segmentIds.push(ids);
            const found = objectIn(item);
            if (!found) return;
            const strand = withId(next++, found);
            strands[i] = strand;
            listIn(strand.pins).forEach((pin, k, pins) => {
                if (objectIn(pin)) pins[k] = withId(next++, objectIn(pin)!);
            });
            listIn(strand.segments).forEach((segment, k, segments) => {
                if (!objectIn(segment)) return;
                ids.push(next);
                segments[k] = withId(next++, objectIn(segment)!);
            });
        });
        const segmentId = (ref: JsonValue | undefined): JsonValue | undefined => {
            if (!Array.isArray(ref) || ref.length !== 2) return ref;
            const [s, k] = ref;
            return typeof s === "number" && typeof k === "number"
                ? (segmentIds[s]?.[k] ?? ref)
                : ref;
        };
        for (const entry of listIn(picture.crossings).map(objectIn)) {
            if (!entry) continue;
            entry.over = segmentId(entry.over)!;
            entry.under = segmentId(entry.under)!;
        }
        listIn(picture.props).forEach((item, p, props) => {
            const prop = objectIn(item);
            if (!prop) return;
            prop.passes = listIn(prop.passes).map((pass) =>
                Array.isArray(pass) && pass.length === 4
                    ? [segmentId([pass[0], pass[1]])!, pass[2], pass[3]]
                    : pass,
            );
            if (!listIn(prop.passes).length) delete prop.passes;
            props[p] = withId(next++, prop);
        });
    }
    return file;
}

/** The object with an id, as its first field. */
const withId = (id: number, object: JsonObject): JsonObject => ({ id, ...object });

/** The upgrades in order: `UPGRADES[k]` takes a file from version k + 1 to version k + 2. */
export const UPGRADES: Upgrade[] = [toMillimetres, addIds];

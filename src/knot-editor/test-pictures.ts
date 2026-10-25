/**
 * Pictures for tests, built as before ids: strands and props without ids, crossings and passes by where their
 * segments are. `testPicture` numbers everything by its place, so a test can work out any id, and turns the entries
 * into the ids they name. Only the tests use this.
 */

import type { CrossingAt, PassAt, Picture, Pin, Strand, StrandSegment } from "./format";
import { crossingsAt, passesAt, type Ids } from "./ids";
import type { BarProp } from "./props/bar";

/** The ids `testPicture` gives: strand i, its pin k and its segment k, and prop p. */
export const strandId = (i: number) => 1000 * (i + 1);
export const pinId = (i: number, k: number) => 1000 * (i + 1) + 1 + k;
export const segmentId = (i: number, k: number) => 1000 * (i + 1) + 500 + k;
export const propId = (p: number) => 100_000 + p;

/** A pin or segment as a test writes it, without an id. */
export type TestPin = Omit<Pin, "id">;
export type TestSegment = Omit<StrandSegment, "id">;

/** A strand as a test writes it: its id and its pins' and segments' are 0 until `testPicture` numbers them. */
export function testStrand(
    kind: "rope" | "arrow",
    pins: TestPin[],
    {
        colour = "orange",
        diameter = 1,
        segments,
    }: {
        colour?: "orange" | "green" | "blue";
        diameter?: number;
        segments?: TestSegment[];
    } = {},
): Strand {
    const shape = {
        id: 0,
        pins: pins.map((pin) => ({ id: 0, ...pin })),
        segments: (
            segments ?? pins.slice(1).map(() => ({ tension: [1, 1] as [number, number] }))
        ).map((segment) => ({ id: 0, ...segment })),
    };
    return kind === "rope" ? { kind, colour, diameter, ...shape } : { kind, ...shape };
}

/** A bar as a test writes it: no id, and its passes by where their segments are. */
export type TestBar = Omit<BarProp, "id" | "passes"> & { passes: PassAt[] };

/** The strands numbered by their places. */
export const numbered = (strands: Strand[]): Strand[] =>
    strands.map((strand, i) => ({
        ...strand,
        id: strandId(i),
        pins: strand.pins.map((pin, k) => ({ ...pin, id: pinId(i, k) })),
        segments: strand.segments.map((segment, k) => ({ ...segment, id: segmentId(i, k) })),
    }));

/** A picture of these strands, crossings and bars, everything numbered by its place. */
export function testPicture(
    strands: Strand[],
    crossings: CrossingAt[] = [],
    props: TestBar[] = [],
): Picture {
    const placed = numbered(strands);
    const id = ([i, k]: [number, number]) => segmentId(i, k);
    return {
        strands: placed,
        crossings: crossings.map((c) => ({ over: id(c.over), under: id(c.under), n: c.n })),
        props: props.map((bar, p) => ({
            ...bar,
            id: propId(p),
            passes: bar.passes.map(([i, k, n, side]) => [id([i, k]), n, side]),
        })),
    };
}

/** New ids for a test's edits, well clear of the ones `testPicture` gives. */
export function newIds(from = 900_000): Ids {
    let next = from;
    return () => next++;
}

/** A picture's crossing entries by where their segments are, as tests write them. */
export const entriesAt = (picture: Picture): CrossingAt[] => crossingsAt(picture);

/** A prop's passes by where their segments are, as tests write them. */
export const passesOf = (picture: Picture, p: number): PassAt[] => passesAt(picture, p);

/** A strand without its ids, to compare with one a test wrote. */
export const withoutIds = (strand: Strand) => ({
    ...strand,
    id: 0,
    pins: strand.pins.map((pin) => ({ ...pin, id: 0 })),
    segments: strand.segments.map((segment) => ({ ...segment, id: 0 })),
});

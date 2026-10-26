/** Passes: where a strand goes across a prop, in front of it or behind it, as a prop's `passes` list records them. */

import { below, FileError, readChoice, readCount, readId, readList } from "../read-json";
import type { JsonValue } from "../versions";

export const PASS_SIDES = ["front", "behind"] as const;
export type PassSide = (typeof PASS_SIDES)[number];

/**
 * One pass across a prop: the segment, by id, which of that segment's passes across the prop it is (`n`, from 1,
 * along the segment), and which side of the prop it goes.
 */
export type PassEntry = [segment: number, n: number, side: PassSide];

/** A pass entry with its segment by where it is (its strand, and which segment of it), as the editor matches them. */
export type PassAt = [strand: number, segment: number, n: number, side: PassSide];

/** A prop's `passes` list, each entry's shape checked (its references are checked with the rest of the picture). */
export function readPasses(value: JsonValue | undefined, at: string): PassEntry[] {
    return readList(value, at).map((item, k) => {
        const where = below(at, k);
        const entry = readList(item, where);
        if (entry.length !== 3)
            throw new FileError(
                where,
                `should be [segment, n, side], but has ${entry.length} items`,
            );
        return [
            readId(entry[0], below(where, 0)),
            readCount(entry[1], below(where, 1), 1),
            readChoice(entry[2], below(where, 2), PASS_SIDES),
        ];
    });
}

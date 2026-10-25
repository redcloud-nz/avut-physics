/**
 * Ids: every strand, segment, pin and prop in a picture has one, unique in the picture, and references in the file
 * (crossings, passes, links) name things by id. One counter runs across the file, so a picture copied into a step keeps
 * its ids and anything new gets an id no picture has. The counter isn't stored: it's worked out from the ids there.
 *
 * The editor matches crossings and passes, and shows them, by where their segments are; these turn one into the
 * other.
 */

import type {
    CrossingAt,
    CrossingEntry,
    Id,
    KnotFile,
    PassAt,
    PassEntry,
    Picture,
    SegmentRef,
} from "./format";
import { kindOf } from "./props";

/** Gives a new id each time it's called. */
export type Ids = () => Id;

/** The highest id in a picture, or 0 in one with nothing in it. */
export function highestId(picture: Picture): Id {
    let most = 0;
    for (const strand of picture.strands) {
        most = Math.max(most, strand.id);
        for (const pin of strand.pins) most = Math.max(most, pin.id);
        for (const segment of strand.segments) most = Math.max(most, segment.id);
    }
    for (const prop of picture.props) most = Math.max(most, prop.id);
    return most;
}

/**
 * New ids for a file: each above every id in it, counting up from there. The file's highest id is only looked for
 * when the first is asked for, as most edits make nothing new.
 */
export function idsFor(file: KnotFile): Ids {
    let next: number | undefined;
    return () => {
        next ??= Math.max(highestId(file.knot), ...file.steps.map((s) => highestId(s.picture))) + 1;
        return next++;
    };
}

/** Where each segment is, by id. */
export function segmentPlaces(picture: Picture): Map<Id, SegmentRef> {
    const places = new Map<Id, SegmentRef>();
    picture.strands.forEach((strand, i) =>
        strand.segments.forEach((segment, k) => places.set(segment.id, [i, k])),
    );
    return places;
}

/** The id of the segment at a place, if there's one there. */
export const segmentIdAt = (picture: Picture, [i, k]: SegmentRef): Id | undefined =>
    picture.strands[i]?.segments[k]?.id;

/** The picture's crossing entries by where their segments are (any naming a segment that's gone are left out). */
export function crossingsAt(picture: Picture, places = segmentPlaces(picture)): CrossingAt[] {
    return picture.crossings.flatMap((entry) => {
        const [over, under] = [places.get(entry.over), places.get(entry.under)];
        return over && under ? [{ over, under, n: entry.n }] : [];
    });
}

/** A crossing entry by where its segments are, as the picture holds it, by id (none if a segment isn't there). */
export function crossingEntry(picture: Picture, at: CrossingAt): CrossingEntry | undefined {
    const [over, under] = [segmentIdAt(picture, at.over), segmentIdAt(picture, at.under)];
    return over !== undefined && under !== undefined ? { over, under, n: at.n } : undefined;
}

/** A prop's passes by where their segments are (any naming a segment that's gone are left out). */
export function passesAt(picture: Picture, p: number, places = segmentPlaces(picture)): PassAt[] {
    const prop = picture.props[p];
    if (!prop) return [];
    return kindOf(prop)
        .passes(prop)
        .flatMap(([id, n, side]) => {
            const at = places.get(id);
            return at ? [[at[0], at[1], n, side] as PassAt] : [];
        });
}

/** A pass entry by where its segment is, as a prop holds it, by id (none if the segment isn't there). */
export function passEntry(picture: Picture, [i, k, n, side]: PassAt): PassEntry | undefined {
    const id = segmentIdAt(picture, [i, k]);
    return id === undefined ? undefined : [id, n, side];
}

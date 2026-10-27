/**
 * The knots for listing, each with its small drawing: on the list of knots, beside a knot's page on a wide screen, and
 * in the list a phone brings down from the page's title. The drawings are worked out where the page renders, on the
 * server (see `KnotDrawing`).
 */

import { KNOT_SECTIONS, KNOTS } from ".";
import { KnotDrawing, knotView, workedPicture } from "./knot-drawing";
import type { KnotContents } from "./knot-list";

/** The most room each knot's small drawing can have (pixels). */
const ROOM = { w: 144, h: 48 };

const DRAWN = new Map(
    KNOTS.map((knot) => {
        const worked = workedPicture(knot.file.knot);
        const ropes = knot.file.knot.strands.filter((strand) => strand.kind === "rope").length;
        return [knot.slug, { worked, view: knotView(worked, ropes > 1) }];
    }),
);

/** Each knot's drawing's width and height in the list (millimetres), turned where it's drawn on its side. */
const SIZES = KNOTS.map((knot) => {
    const { view } = DRAWN.get(knot.slug)!;
    return knot.turned ? { w: view.h, h: view.w } : { w: view.w, h: view.h };
});

/** Pixels per millimetre for every knot in the list: the most that still fits the biggest one in the room. */
const LIST_SCALE = Math.min(...SIZES.map((size) => Math.min(ROOM.w / size.w, ROOM.h / size.h)));

/** The box each knot's small drawing sits in (pixels): only as wide as the widest drawing, so none has space after it. */
const BOX = { w: Math.ceil(Math.max(...SIZES.map((size) => size.w)) * LIST_SCALE), h: ROOM.h };

/**
 * The knots in their sections, each drawn at the same size per millimetre, so their ropes look as thick, and starting
 * at its box's left, so the knots line up.
 */
export function knotContents(): KnotContents {
    return KNOT_SECTIONS.map((section) => ({
        title: section.title,
        knots: section.knots.map((knot) => ({
            href: `/knots/${knot.slug}`,
            name: knot.name,
            variant: knot.variant,
            drawing: (
                <div className="flex shrink-0 items-center" style={{ width: BOX.w, height: BOX.h }}>
                    <KnotDrawing
                        {...DRAWN.get(knot.slug)!}
                        turned={knot.turned}
                        label={null}
                        scale={LIST_SCALE}
                    />
                </div>
            ),
        })),
    }));
}

import type { Metadata } from "next";
import Link from "next/link";

import type { Picture } from "@/knot-editor/knot-file";
import { endsBothWays, fullName, KNOTS, KNOTS_PATH, KNOTS_TITLE } from "@/knots";
import { knotContents } from "@/knots/knot-contents";
import { KnotDrawing, knotView, workedPicture } from "@/knots/knot-drawing";
import { KnotsMenu } from "@/knots/knots-menu";
import {
    TERMINOLOGY_DESCRIPTION as DESCRIPTION,
    TERMS,
    TERMINOLOGY_TITLE as TITLE,
    type Term,
} from "@/knots/terminology";

const HREF = `${KNOTS_PATH}/terminology`;

/** The most room a term's picture can have (pixels). */
const ROOM = { w: 112, h: 144 };

/** A term's picture, from its own file or one of a knot's, and whether its ends run out of it both ways. */
function pictureOf(picture: NonNullable<Term["picture"]>): { shown: Picture; bothWays: boolean } {
    if ("file" in picture) return { shown: picture.file.knot, bothWays: false };
    const knot = KNOTS.find((k) => k.slug === picture.knot)!;
    const { file } = knot;
    const shown = picture.step === undefined ? file.knot : file.steps[picture.step].picture;
    return { shown, bothWays: endsBothWays(knot) };
}

/** Each term's picture, where it has one, worked out with its view: around the rope, as on the knots' pages. */
const PICTURES = new Map(
    TERMS.flatMap((term) => {
        if (!term.picture) return [];
        const { shown, bothWays } = pictureOf(term.picture);
        const worked = workedPicture(shown);
        return [[term.term, { worked, view: knotView(worked, bothWays) }]];
    }),
);

/** Pixels per millimetre for every term's picture: the most that still fits the biggest one in the room. */
const SCALE = Math.min(
    ...[...PICTURES.values()].map(({ view }) => Math.min(ROOM.w / view.w, ROOM.h / view.h)),
);

export const metadata: Metadata = {
    title: `${TITLE}, ${KNOTS_TITLE}`,
    description: DESCRIPTION,
    openGraph: { title: TITLE, description: DESCRIPTION, url: HREF, type: "website" },
};

/**
 * The words used about knots, each with what it means and, where there is one, a knot that shows it and a small picture
 * beside it. The pictures are all drawn at the same size per millimetre, so their ropes look as thick. Laid out like a
 * knot's page, so the list of knots is beside it on a wide screen and brought down from its title on a phone.
 */
export default function Page() {
    return (
        <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4 pb-10 lg:max-w-2xl">
            <KnotsMenu contents={knotContents()} current={HREF} />
            <h1 className="text-3xl leading-tight font-semibold text-ink-bright">{TITLE}</h1>
            <p className="text-ink-soft">{DESCRIPTION}</p>
            <dl className="flex flex-col gap-4">
                {TERMS.map((term) => {
                    const example = KNOTS.find((knot) => knot.slug === term.example);
                    const picture = PICTURES.get(term.term);
                    return (
                        <div
                            key={term.term}
                            className="grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto_1fr] gap-x-4 gap-y-1"
                        >
                            <dt className="col-start-1 font-semibold text-ink-strong">
                                {term.term}
                                {term.also && (
                                    <span className="font-normal text-ink-muted">
                                        {` (also ${term.also.join(", ")})`}
                                    </span>
                                )}
                            </dt>
                            <dd className="col-start-1 text-ink-soft">
                                {term.meaning}
                                {example && (
                                    <>
                                        {" "}
                                        <Link
                                            href={`${KNOTS_PATH}/${example.slug}`}
                                            className="text-link hover:text-highlight"
                                        >
                                            {`See the ${fullName(example).toLowerCase()}.`}
                                        </Link>
                                    </>
                                )}
                            </dd>
                            {picture && (
                                <dd className="col-start-2 row-span-3 row-start-1">
                                    <KnotDrawing
                                        {...picture}
                                        label={`${term.term}, drawn`}
                                        scale={SCALE}
                                    />
                                </dd>
                            )}
                        </div>
                    );
                })}
            </dl>
        </main>
    );
}

import type { Metadata } from "next";
import Link from "next/link";

import { KNOTS_DESCRIPTION as DESCRIPTION, KNOTS, KNOTS_TITLE as TITLE } from "@/knots";
import { KnotDrawing, knotView, workedPicture } from "@/knots/knot-drawing";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    openGraph: { title: TITLE, description: DESCRIPTION, url: "/knots", type: "website" },
};

/** The box each knot's small drawing sits in (pixels). */
const BOX = { w: 144, h: 48 };

const DRAWN = new Map(
    KNOTS.map((knot) => {
        const worked = workedPicture(knot.file.knot);
        const ropes = knot.file.knot.strands.filter((strand) => strand.kind === "rope").length;
        return [knot.slug, { worked, view: knotView(worked, ropes > 1) }];
    }),
);

/** Pixels per millimetre for every knot in the list: the most that still fits the biggest one in the box. */
const LIST_SCALE = Math.min(
    ...KNOTS.map((knot) => {
        const { view } = DRAWN.get(knot.slug)!;
        const [w, h] = knot.turned ? [view.h, view.w] : [view.w, view.h];
        return Math.min(BOX.w / w, BOX.h / h);
    }),
);

/**
 * The list of knots, each linking to its page, with a small drawing of it finished. The drawings are all at the same
 * size per millimetre, so their ropes look as thick, each starting at the box's left so the knots line up.
 */
export default function Page() {
    return (
        <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4 pb-10">
            <Link href="/" className="text-sm text-link hover:text-highlight">
                ← Physics Visualisations
            </Link>
            <h1 className="text-3xl leading-tight font-semibold text-ink-bright">{TITLE}</h1>
            <p className="text-ink-soft">{DESCRIPTION}</p>
            <ul className="flex flex-col gap-2">
                {KNOTS.map((knot) => {
                    return (
                        <li key={knot.slug}>
                            <Link
                                href={`/knots/${knot.slug}`}
                                className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 px-3 py-2 hover:border-action"
                            >
                                <span className="flex-1 font-medium text-ink-strong">
                                    {knot.name}
                                    {knot.variant && (
                                        <>
                                            {" "}
                                            <span className="block text-sm font-normal text-ink-muted">
                                                {knot.variant}
                                            </span>
                                        </>
                                    )}
                                </span>
                                <div
                                    className="flex shrink-0 items-center"
                                    style={{ width: BOX.w, height: BOX.h }}
                                >
                                    <KnotDrawing
                                        {...DRAWN.get(knot.slug)!}
                                        turned={knot.turned}
                                        label={null}
                                        scale={LIST_SCALE}
                                    />
                                </div>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </main>
    );
}

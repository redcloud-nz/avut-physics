import type { Metadata } from "next";
import Link from "next/link";

import { KNOTS_DESCRIPTION as DESCRIPTION, KNOTS, KNOTS_TITLE as TITLE } from "@/knots";
import { finished, TyingDrawing } from "@/knots/tying-drawing";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    openGraph: { title: TITLE, description: DESCRIPTION, url: "/knots", type: "website" },
};

/** The list of knots, each linking to its page, with a small drawing of it finished. */
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
                    const { step, view } = finished(knot.steps);
                    return (
                        <li key={knot.slug}>
                            <Link
                                href={`/knots/${knot.slug}`}
                                className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 px-3 py-2 hover:border-action"
                            >
                                <span className="flex-1 font-medium text-ink-strong">
                                    {knot.name}
                                </span>
                                <TyingDrawing
                                    step={step}
                                    view={view}
                                    turned={knot.turned}
                                    label={null}
                                    className="h-12 w-36 shrink-0"
                                />
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </main>
    );
}

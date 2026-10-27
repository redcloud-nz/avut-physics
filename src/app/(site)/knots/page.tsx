import type { Metadata } from "next";
import Link from "next/link";

import { KNOTS_DESCRIPTION as DESCRIPTION, KNOTS_TITLE as TITLE } from "@/knots";
import { knotContents } from "@/knots/knot-contents";
import { KnotList } from "@/knots/knot-list";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    openGraph: { title: TITLE, description: DESCRIPTION, url: "/knots", type: "website" },
};

/**
 * The list of knots in their families, each linking to its page, with a small drawing of it finished. On a wide screen
 * the list is in the column to the left already, so it's left out here, as is the link home.
 */
export default function Page() {
    return (
        <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4 pb-10 lg:max-w-2xl">
            <Link href="/" className="text-sm text-link hover:text-highlight lg:hidden">
                ← Physics Visualisations
            </Link>
            <h1 className="text-3xl leading-tight font-semibold text-ink-bright">{TITLE}</h1>
            <p className="text-ink-soft">{DESCRIPTION}</p>
            <nav aria-label={TITLE} className="lg:hidden">
                <KnotList contents={knotContents()} cards />
            </nav>
        </main>
    );
}

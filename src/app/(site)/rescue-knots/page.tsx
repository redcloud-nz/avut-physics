import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/SiteFooter";
import { KNOTS_DESCRIPTION as DESCRIPTION, KNOTS_PATH, KNOTS_TITLE as TITLE } from "@/knots";
import { knotContents } from "@/knots/knot-contents";
import { KnotList } from "@/knots/knot-list";
import { Share } from "@/visual/share";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    openGraph: { title: TITLE, description: DESCRIPTION, url: KNOTS_PATH, type: "website" },
};

/**
 * The knots' first page, laid out like the visual introduction's: what they are, a button to the first page in the
 * list, the list of knots in their families, each with a small drawing of it finished, and ways to pass the page on. On
 * a wide screen the list is in the column to the left already, so it's left out here, as is the link home, and the
 * link to the source goes at the foot of this column.
 */
export default function Page() {
    const contents = knotContents();
    return (
        <>
            <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4 pb-10 lg:max-w-2xl lg:pt-10">
                <Link href="/" className="text-sm text-link hover:text-highlight lg:hidden">
                    ← Physics Visualisations
                </Link>
                <h1 className="text-3xl leading-tight font-semibold text-ink-bright">{TITLE}</h1>
                <p className="text-ink-soft">{DESCRIPTION}</p>
                <Link
                    href={contents[0].knots[0].href}
                    className="rounded-xl bg-action py-2 text-center text-sm font-medium text-primary-foreground hover:bg-action-hover"
                >
                    Start
                </Link>
                <nav aria-label={TITLE} className="lg:hidden">
                    <KnotList contents={contents} cards />
                </nav>
                <Share title={TITLE} text={DESCRIPTION} path={KNOTS_PATH} />
            </main>
            <Footer />
        </>
    );
}

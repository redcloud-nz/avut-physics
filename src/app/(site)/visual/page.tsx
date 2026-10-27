import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/SiteFooter";
import { ContentsList } from "@/visual/contents";
import { CONTENTS, PAGES, SERIES } from "@/visual/pages";
import { SERIES_DESCRIPTION as DESCRIPTION } from "@/visual/series";
import { Share } from "@/visual/share";

export const metadata: Metadata = {
    title: SERIES,
    description: DESCRIPTION,
    openGraph: { title: SERIES, description: DESCRIPTION, url: "/visual", type: "website" },
};

export default function Page() {
    // On a wide screen the contents are in the column to the left, so this shows the series' picture instead, and the
    // link to the source goes at the foot of this column rather than under both.
    return (
        <>
            <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4 pb-10 lg:max-w-2xl lg:pt-10">
                <Link href="/" className="text-sm text-link hover:text-highlight lg:hidden">
                    ← Physics Visualisations
                </Link>
                {/* The picture a shared link shows. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- already a sized PNG, with nothing to optimise */}
                <img
                    src="/visual/preview.png"
                    alt=""
                    width={1200}
                    height={630}
                    className="hidden h-auto w-full rounded-xl border border-line-faint lg:block"
                />
                {/* Beside the picture it would say the same again, so there it's left to screen readers. */}
                <h1 className="text-3xl leading-tight font-semibold text-ink-bright lg:sr-only">
                    {SERIES}
                </h1>
                <Link
                    href={`/visual/${PAGES[0].slug}`}
                    className="rounded-xl bg-action py-2 text-center text-sm font-medium text-primary-foreground hover:bg-action-hover"
                >
                    Start
                </Link>
                <nav aria-label="Contents" className="text-ink lg:hidden">
                    <ContentsList contents={CONTENTS} />
                </nav>
                <Share title={SERIES} text={DESCRIPTION} path="/visual" />
            </main>
            <Footer />
        </>
    );
}

import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/SiteFooter";
import { CONTENTS, SERIES } from "@/pulley-systems/systems";
import { ContentsList } from "@/visual/contents";

export const metadata: Metadata = { title: SERIES, robots: { index: false } };

/** The list of systems, for a phone; on a wide screen they're in the column to the left as well. */
export default function Page() {
    return (
        <>
            <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4 pb-10 lg:max-w-2xl lg:pt-10">
                <Link href="/" className="text-sm text-link hover:text-highlight lg:hidden">
                    ← Physics Visualisations
                </Link>
                <h1 className="text-3xl leading-tight font-semibold text-ink-bright">{SERIES}</h1>
                <nav aria-label="Contents" className="text-ink">
                    <ContentsList contents={CONTENTS} />
                </nav>
            </main>
            <Footer />
        </>
    );
}

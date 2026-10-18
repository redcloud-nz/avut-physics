import type { Metadata } from "next";
import Link from "next/link";

import { PAGES, SERIES } from "@/visual/pages";
import { SERIES_DESCRIPTION as DESCRIPTION } from "@/visual/series";
import { Share } from "@/visual/share";

export const metadata: Metadata = {
    title: SERIES,
    description: DESCRIPTION,
    openGraph: { title: SERIES, description: DESCRIPTION, url: "/visual", type: "website" },
};

export default function Page() {
    return (
        <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4 pb-10">
            <Link href="/" className="text-sm text-sky-400 hover:text-sky-300">
                ← Physics Visualisations
            </Link>
            <h1 className="text-3xl leading-tight font-semibold text-slate-50">{SERIES}</h1>
            <Link
                href={`/visual/${PAGES[0].slug}`}
                className="rounded-xl bg-sky-500 py-2 text-center text-sm font-medium text-slate-950 hover:bg-sky-400"
            >
                Start
            </Link>
            <ol className="flex flex-col gap-1">
                {PAGES.map((p, i) => (
                    <li key={p.slug}>
                        <Link
                            href={`/visual/${p.slug}`}
                            className="flex gap-3 rounded-lg px-2 py-2 text-slate-200 hover:bg-slate-900"
                        >
                            <span className="w-5 shrink-0 text-right text-slate-500 tabular-nums">
                                {i + 1}
                            </span>
                            {p.name}
                        </Link>
                    </li>
                ))}
            </ol>
            <Share title={SERIES} text={DESCRIPTION} path="/visual" />
        </main>
    );
}

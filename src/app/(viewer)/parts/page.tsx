import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import PartsView from "@/parts/parts-view";

export const metadata: Metadata = {
    title: "Parts",
    description:
        "The rigging hardware and assemblies the visualisations are drawn with, one at a time in 3D and in flat views.",
};

/**
 * A workbench for the parts the visualisations are built from: not listed on the home page. The part's in the
 * address (`?part=<slug>`), so each can be linked to.
 */
export default function Page() {
    return (
        <main className="flex h-full flex-col">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                <Link href="/" className="text-sm text-link hover:text-highlight">
                    ← Physics Visualisations
                </Link>
                <h1 className="text-xl font-semibold tracking-tight text-ink-bright">Parts</h1>
            </div>
            {/* The part comes from the address, which is only known in the browser. */}
            <Suspense
                fallback={<div className="min-h-0 flex-1 border-t border-border bg-surface" />}
            >
                <PartsView />
            </Suspense>
        </main>
    );
}

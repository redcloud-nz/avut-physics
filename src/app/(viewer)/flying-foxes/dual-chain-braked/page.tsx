import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import FoxView from "@/flying-fox/fox-view";

const TITLE = "Dual-hawser flying fox";

export const metadata: Metadata = {
    title: `${TITLE}: chain-braked`,
    description:
        "A rigging plan for a dual-hawser flying fox with a chain-weight brake, set up to Scouts NSW's flying fox procedure on a made-up site falling towards the bottom end.",
};

/**
 * A dual-hawser flying fox with a chain-weight brake: a work in progress, not yet listed on the home page. It fills the
 * window, the drawing taking whatever room the title leaves. The view's in the address (`?view=side`, `overhead` or
 * `3d`), so each can be linked to.
 */
export default function Page() {
    return (
        <main className="flex h-full flex-col">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                <Link href="/" className="text-sm text-link hover:text-highlight">
                    ← Physics Visualisations
                </Link>
                <h1 className="text-xl font-semibold tracking-tight text-ink-bright">{TITLE}</h1>
                <p className="text-sm text-ink-muted">Chain-braked</p>
            </div>
            {/* The view comes from the address, which is only known in the browser. */}
            <Suspense
                fallback={<div className="min-h-0 flex-1 border-t border-border bg-surface" />}
            >
                <FoxView />
            </Suspense>
        </main>
    );
}

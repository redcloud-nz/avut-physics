import type { Metadata } from "next";
import Link from "next/link";

import TowerView from "@/abseil-tower/tower-view";

const TITLE = "Cracroft Abseil Tower";
const DESCRIPTION =
    "The Cracroft abseil tower in 3D, for planning rigs on it. Every size is an estimate.";

export const metadata: Metadata = { title: TITLE, description: DESCRIPTION };

/**
 * The Cracroft abseil tower in 3D: a work in progress, not yet listed on the home page. It fills the window, with the
 * drawing taking whatever room the title leaves, out to the window's edges.
 */
export default function Page() {
    return (
        <main className="flex h-full flex-col">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                <Link href="/" className="text-sm text-link hover:text-highlight">
                    ← Physics Visualisations
                </Link>
                <h1 className="text-xl font-semibold tracking-tight text-ink-bright">{TITLE}</h1>
            </div>
            <TowerView />
        </main>
    );
}

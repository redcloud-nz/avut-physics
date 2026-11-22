import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RIGS } from "@/abseil-tower/rig";
import TowerView from "@/abseil-tower/tower-view";

const TITLE = "Cracroft Abseil Tower";

export function generateStaticParams() {
    return RIGS.map((r) => ({ rig: r.slug }));
}

export async function generateMetadata(
    props: PageProps<"/abseil-towers/cracroft/[rig]">,
): Promise<Metadata> {
    const { rig: slug } = await props.params;
    const rig = RIGS.find((r) => r.slug === slug);
    if (!rig) return {};
    return {
        title: `${TITLE}: ${rig.name}`,
        description: `A rigging plan for the Cracroft abseil tower: ${rig.name}. Every size is an estimate.`,
    };
}

// Every rig is prerendered, and awaiting `params` outside a Suspense boundary keeps the 404 for one that isn't a rig.
export const instant = false;

/**
 * One rig on the Cracroft abseil tower: a work in progress, not yet listed on the home page. It fills the window, with
 * the drawing taking whatever room the title leaves, out to the window's edges. The view's in the address
 * (`?view=overhead`, `west`, `east` or `3d`), so each can be linked to.
 */
export default async function Page(props: PageProps<"/abseil-towers/cracroft/[rig]">) {
    const { rig: slug } = await props.params;
    const rig = RIGS.find((r) => r.slug === slug);
    if (!rig) notFound();
    return (
        <main className="flex h-full flex-col">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                <Link href="/" className="text-sm text-link hover:text-highlight">
                    ← Physics Visualisations
                </Link>
                <h1 className="text-xl font-semibold tracking-tight text-ink-bright">{TITLE}</h1>
                <p className="text-sm text-ink-muted">{rig.name}</p>
            </div>
            {/* The view comes from the address, which is only known in the browser. */}
            <Suspense
                fallback={<div className="min-h-0 flex-1 border-t border-border bg-surface" />}
            >
                <TowerView slug={rig.slug} />
            </Suspense>
        </main>
    );
}

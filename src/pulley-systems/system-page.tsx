"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { ContentsDrawer } from "@/visual/contents-drawer";

import { SystemDrawing } from "./drawing";
import { CONTENTS, SERIES, SYSTEMS, type Slug } from "./systems";

/**
 * One pulley system's page, filling the screen: its name, a line on what it is, and its drawing. On a phone, tapping
 * the series' name at the top brings the systems down from the top; on a wide screen they're beside the page already.
 */
export function SystemPage({ slug }: { slug: Slug }) {
    const [contents, setContents] = useState(false);
    const index = SYSTEMS.findIndex((s) => s.slug === slug);
    const system = SYSTEMS[index];
    return (
        <main className="mx-auto flex h-dvh w-full max-w-md min-w-0 flex-col gap-3 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] lg:max-w-4xl">
            <header className="flex text-xs text-ink-muted lg:hidden">
                <button
                    type="button"
                    onClick={() => setContents(true)}
                    aria-label={`${SERIES}: contents`}
                    className="flex min-w-0 items-center gap-1 hover:text-highlight"
                >
                    <span className="truncate">{SERIES}</span>
                    <ChevronDown className="size-3.5 shrink-0" aria-hidden />
                </button>
            </header>
            <h1 className="text-xl leading-tight font-semibold text-ink-bright">{system.name}</h1>
            <p className="text-ink-soft">{system.text}</p>
            <SystemDrawing slug={slug} />
            <ContentsDrawer
                open={contents}
                onOpenChange={setContents}
                series={SERIES}
                contents={CONTENTS}
                current={index}
            />
        </main>
    );
}

"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Pill } from "@/visual/card";

import { KNOTS_TITLE } from ".";
import { KnotList, type KnotContents } from "./knot-list";

/**
 * "Knots" at the top of a page among the knots, on a phone: tapping it brings the list of knots down over the page. A
 * wide screen has the list beside the page instead, so goes without it.
 */
export function KnotsMenu(props: {
    contents: KnotContents;
    /** The page it's on, to pick it out in the list. */
    current: string;
}) {
    const [open, setOpen] = useState(false);

    // Next keeps a page that's been left, hidden, for coming back to, and its effects are cleaned up as it's hidden:
    // leave it with the list put away.
    useEffect(() => () => setOpen(false), []);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={`${KNOTS_TITLE}: the list`}
                className="flex w-fit items-center gap-1 text-sm text-link hover:text-highlight lg:hidden"
            >
                {KNOTS_TITLE}
                <ChevronDown className="size-3.5 shrink-0" aria-hidden />
            </button>

            <Drawer open={open} onOpenChange={setOpen} direction="top">
                <DrawerContent
                    aria-describedby={undefined}
                    className="mx-auto max-h-[85dvh] max-w-md border-line-faint bg-surface pt-[env(safe-area-inset-top)] text-base text-ink-soft"
                >
                    <div className="panel-scroll flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pt-4 pb-2">
                        <DrawerTitle asChild>
                            <Link
                                href="/knots"
                                onClick={() => setOpen(false)}
                                className="text-base font-semibold text-ink-strong hover:text-highlight"
                            >
                                {KNOTS_TITLE}
                            </Link>
                        </DrawerTitle>
                        <KnotList
                            contents={props.contents}
                            current={props.current}
                            onFollow={() => setOpen(false)}
                        />
                        <Link
                            href="/"
                            onClick={() => setOpen(false)}
                            className="px-2 text-sm text-link hover:text-highlight"
                        >
                            ← Physics Visualisations
                        </Link>
                    </div>
                    <button
                        type="button"
                        aria-label="Hide the list"
                        onClick={() => setOpen(false)}
                        className="group flex h-7 w-full shrink-0 items-center justify-center"
                    >
                        <Pill className="bg-ghost group-hover:bg-indicator" />
                    </button>
                </DrawerContent>
            </Drawer>
        </>
    );
}

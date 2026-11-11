"use client";

import Link from "next/link";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

import { ContentsList, type Contents } from "./contents";

/**
 * A series' contents, brought down from the top of a phone's screen by tapping the series' name, with a link home
 * under them. Tapping the handle at the foot, or dragging it up, puts them away.
 */
export function ContentsDrawer(props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    series: string;
    contents: Contents;
    /** The page being read, by its number from 0. */
    current?: number;
}) {
    const close = () => props.onOpenChange(false);
    return (
        <Drawer open={props.open} onOpenChange={props.onOpenChange} direction="top">
            <DrawerContent
                aria-describedby={undefined}
                className="mx-auto max-h-[85dvh] max-w-md border-line-faint bg-surface pt-[env(safe-area-inset-top)] text-base text-ink-soft"
            >
                <div className="panel-scroll flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pt-4 pb-2">
                    <DrawerTitle className="text-base font-semibold text-ink-strong">
                        {props.series}
                    </DrawerTitle>
                    {/* Next keeps the page being left, hidden, for coming back to: leave it with its contents put
                        away. */}
                    <ContentsList
                        contents={props.contents}
                        current={props.current}
                        onFollow={close}
                    />
                    <Link
                        href="/"
                        onClick={close}
                        className="px-2 text-sm text-link hover:text-highlight"
                    >
                        ← Physics Visualisations
                    </Link>
                </div>
                <button
                    type="button"
                    aria-label="Hide the contents"
                    onClick={close}
                    className="group flex h-7 w-full shrink-0 items-center justify-center"
                >
                    <Pill className="bg-ghost group-hover:bg-indicator" />
                </button>
            </DrawerContent>
        </Drawer>
    );
}

/** The grab handle drawn on the button that puts the contents away. */
export function Pill(props: { className: string }) {
    return <span className={`h-1.5 w-10 rounded-full transition-colors ${props.className}`} />;
}

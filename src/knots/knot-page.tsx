"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useState, type ReactNode } from "react";

import { DialogOverlay } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Pill } from "@/visual/card";

import { KNOTS_TITLE, type KnotType } from ".";
import { KnotList, type KnotContents } from "./knot-list";
import { TyingSteps, type DrawnStep } from "./tying-steps";

/** A small label over the knot's name. */
const BADGE =
    "rounded-full border border-line-faint px-2.5 py-0.5 text-xs font-medium text-ink-muted";

/**
 * A knot's page: what type of knot it is and its ABOK number (badges over its name), what it's for, the knot finished,
 * and more on how it's used. Where the knot has steps, an Instructions button brings up tying it a step at a time: over
 * the whole page on a phone, in a dialog in the middle of a bigger screen. On a phone, tapping "Knots" at the top
 * brings the list of knots down over the page; a wide screen has the list beside the page instead.
 *
 * The drawings, the knot finished (`drawing`), each step's and the list's, come from the server, drawn there (see
 * `knot-drawing.tsx`), so the browser only shows them.
 */
export function KnotPage(props: {
    /** Where the page is (`/knots/<slug>`), to pick it out in the list of knots. */
    href: string;
    type: KnotType;
    /** Its number in The Ashley Book of Knots. */
    abok?: number;
    name: string;
    variant?: string;
    description?: string;
    about: string[];
    drawing: ReactNode;
    steps?: DrawnStep[];
    contents: KnotContents;
}) {
    const { name, variant, steps } = props;
    const [tying, setTying] = useState(false);
    const [listing, setListing] = useState(false);

    // Next keeps a page that's been left, hidden, for coming back to, and its effects are cleaned up as it's hidden:
    // leave it with the steps and the list put away, so coming back to the knot shows it finished.
    useEffect(
        () => () => {
            setTying(false);
            setListing(false);
        },
        [],
    );

    return (
        // Spaced like the list of knots, so the name and the line under it stay put going between them.
        <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4 pb-10 lg:max-w-2xl">
            <button
                type="button"
                onClick={() => setListing(true)}
                aria-label={`${KNOTS_TITLE}: the list`}
                className="flex w-fit items-center gap-1 text-sm text-link hover:text-highlight lg:hidden"
            >
                {KNOTS_TITLE}
                <ChevronDown className="size-3.5 shrink-0" aria-hidden />
            </button>
            {/* The name with the instructions' button beside it, as in a card's header. */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col items-start gap-2">
                    <div className="flex gap-2">
                        <span className={BADGE}>{props.type}</span>
                        {props.abok && (
                            <abbr
                                title="The Ashley Book of Knots"
                                className={`${BADGE} no-underline`}
                            >
                                {`ABOK #${props.abok}`}
                            </abbr>
                        )}
                    </div>
                    <h1 className="text-3xl leading-tight font-semibold text-ink-bright">
                        {name}
                        {/* The variant's line is kept on every knot, empty where there's none, so the page under it stays
                        put going between knots. */}
                        {variant ? (
                            <>
                                {" "}
                                <span className="block text-xl font-normal text-ink-muted">
                                    {variant}
                                </span>
                            </>
                        ) : (
                            <span className="block text-xl" aria-hidden>
                                {" "}
                            </span>
                        )}
                    </h1>
                </div>
                {steps && (
                    <button
                        type="button"
                        onClick={() => setTying(true)}
                        className="w-fit shrink-0 rounded-xl bg-action px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-action-hover"
                    >
                        Instructions
                    </button>
                )}
            </div>
            {props.description && <p className="text-ink-soft">{props.description}</p>}

            {props.drawing}

            {props.about.map((text, i) => (
                <p key={i} className="text-ink-soft">
                    {text}
                </p>
            ))}

            {steps && (
                <DialogPrimitive.Root open={tying} onOpenChange={setTying}>
                    <DialogPrimitive.Portal>
                        <DialogOverlay className="max-sm:hidden" />
                        {/* The whole screen on a phone; from `sm`, a card in the middle of the screen, over the page, and from `md` a wider
                            one with the rope beside the instructions. */}
                        <DialogPrimitive.Content
                            aria-describedby={undefined}
                            className="fixed inset-0 z-50 bg-background text-base outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(56rem,calc(100dvh-4rem))] sm:w-[calc(100%-2rem)] sm:max-w-md md:h-[min(44rem,calc(100dvh-4rem))] md:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:border-line-faint sm:bg-surface sm:data-open:zoom-in-95 sm:data-closed:zoom-out-95"
                        >
                            <TyingSteps
                                name={name}
                                variant={variant}
                                steps={steps}
                                onClose={() => setTying(false)}
                            />
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                </DialogPrimitive.Root>
            )}

            <Drawer open={listing} onOpenChange={setListing} direction="top">
                <DrawerContent
                    aria-describedby={undefined}
                    className="mx-auto max-h-[85dvh] max-w-md border-line-faint bg-surface pt-[env(safe-area-inset-top)] text-base text-ink-soft"
                >
                    <div className="panel-scroll flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pt-4 pb-2">
                        <DrawerTitle asChild>
                            <Link
                                href="/knots"
                                onClick={() => setListing(false)}
                                className="text-base font-semibold text-ink-strong hover:text-highlight"
                            >
                                {KNOTS_TITLE}
                            </Link>
                        </DrawerTitle>
                        <KnotList
                            contents={props.contents}
                            current={props.href}
                            onFollow={() => setListing(false)}
                        />
                        <Link
                            href="/"
                            onClick={() => setListing(false)}
                            className="px-2 text-sm text-link hover:text-highlight"
                        >
                            ← Physics Visualisations
                        </Link>
                    </div>
                    <button
                        type="button"
                        aria-label="Hide the list"
                        onClick={() => setListing(false)}
                        className="group flex h-7 w-full shrink-0 items-center justify-center"
                    >
                        <Pill className="bg-ghost group-hover:bg-indicator" />
                    </button>
                </DrawerContent>
            </Drawer>
        </main>
    );
}

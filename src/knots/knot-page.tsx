"use client";

import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useState } from "react";

import { KNOTS, KNOTS_TITLE } from ".";
import { finished, TyingDrawing } from "./tying-drawing";
import { TyingSteps } from "./tying-steps";

const FINISHED = new Map(KNOTS.map((knot) => [knot.slug, finished(knot.steps)]));

/**
 * A knot's page: what it's for, the knot finished, an Instructions button that brings up tying it a step at a time over
 * the page, and more on how it's used.
 */
export function KnotPage(props: { slug: string }) {
    const knot = KNOTS.find((knot) => knot.slug === props.slug)!;
    const knotted = FINISHED.get(props.slug)!;
    const [tying, setTying] = useState(false);

    // Next keeps a page that's been left, hidden, for coming back to, and its effects are cleaned up as it's hidden:
    // leave it with the steps put away, so coming back to the knot shows it finished.
    useEffect(() => () => setTying(false), []);

    return (
        // Spaced like the list of knots, so the link, the name and the line under it stay put going between them.
        <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4 pb-10">
            <Link href="/knots" className="text-sm text-link hover:text-highlight">
                ← {KNOTS_TITLE}
            </Link>
            {/* The name with the instructions' button beside it, as in a card's header. */}
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-3xl leading-tight font-semibold text-ink-bright">
                    {knot.name}
                </h1>
                <button
                    type="button"
                    onClick={() => setTying(true)}
                    className="w-fit shrink-0 rounded-xl bg-action px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-action-hover"
                >
                    Instructions
                </button>
            </div>
            <p className="text-ink-soft">{knot.description}</p>

            {/* Kept to a part of the screen, so the text stays in sight. */}
            <TyingDrawing
                step={knotted.step}
                view={knotted.view}
                className="mx-auto block h-[35dvh] max-h-80 min-h-40 w-full"
            />

            {knot.about.map((text, i) => (
                <p key={i} className="text-ink-soft">
                    {text}
                </p>
            ))}

            <DialogPrimitive.Root open={tying} onOpenChange={setTying}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Content
                        aria-describedby={undefined}
                        className="fixed inset-0 z-50 bg-background text-base outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
                    >
                        <TyingSteps
                            name={knot.name}
                            steps={knot.steps}
                            onClose={() => setTying(false)}
                        />
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        </main>
    );
}

"use client";

import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useState } from "react";

import { fullName, KNOTS, KNOTS_TITLE } from ".";
import { PAGE_SCALE, ropeView, TyingDrawing } from "./tying-drawing";
import { TyingSteps } from "./tying-steps";

const VIEWS = new Map(
    KNOTS.map((knot) => [knot.slug, ropeView(knot.drawing, knot.drawing.length > 1, knot.bar)]),
);

/**
 * A knot's page: what it's for, the knot finished, and more on how it's used. Where the knot has steps, an Instructions
 * button brings up tying it a step at a time over the page.
 */
export function KnotPage(props: { slug: string }) {
    const knot = KNOTS.find((knot) => knot.slug === props.slug)!;
    const view = VIEWS.get(props.slug)!;
    const { steps } = knot;
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
                    {knot.variant && (
                        <>
                            {" "}
                            <span className="block text-xl font-normal text-ink-muted">
                                {knot.variant}
                            </span>
                        </>
                    )}
                </h1>
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
            <p className="text-ink-soft">{knot.description}</p>

            {/* Drawn at the same size per rope diameter as every other knot, so their ropes all look as thick. */}
            <TyingDrawing
                step={{ ropes: knot.drawing }}
                bar={knot.bar}
                view={view}
                label={`${fullName(knot)}, finished`}
                scale={PAGE_SCALE}
                className="mx-auto block"
            />

            {knot.about.map((text, i) => (
                <p key={i} className="text-ink-soft">
                    {text}
                </p>
            ))}

            {steps && (
                <DialogPrimitive.Root open={tying} onOpenChange={setTying}>
                    <DialogPrimitive.Portal>
                        <DialogPrimitive.Content
                            aria-describedby={undefined}
                            className="fixed inset-0 z-50 bg-background text-base outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
                        >
                            <TyingSteps
                                name={fullName(knot)}
                                steps={steps}
                                onClose={() => setTying(false)}
                            />
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                </DialogPrimitive.Root>
            )}
        </main>
    );
}

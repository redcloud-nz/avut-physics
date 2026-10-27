import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The knots in their sections, each with its page and its small drawing (drawn on the server: see `knotContents`). Pages
 * that aren't knots, such as the terminology, have no drawing, and knots to come have neither page nor drawing.
 */
export type KnotContents = {
    title: string;
    knots: (
        | { href: string; name: string; variant?: string; drawing?: ReactNode }
        | { name: string; variant?: string; comingSoon: true }
    )[];
}[];

/**
 * A knot's name, with its variant under it: as tall as the small drawings' box (see `knotContents`), so every row is
 * the same height, with or without a drawing.
 */
const NAME = "flex min-h-12 flex-1 flex-col justify-center";

/**
 * The knots in their sections, each linking to its page with its name and small drawing. The sections have no headings
 * on the page (only their titles, for screen readers), and no more space between them than between their knots, so
 * every knot is the same distance from the next. As `cards` (on the list of knots) each knot is a bordered card;
 * otherwise (beside a knot's page, and in the list brought down from its title) they're closer together, with the knot
 * being looked at picked out. Knots to come are greyed out, marked coming soon, and lead nowhere.
 */
export function KnotList(props: {
    contents: KnotContents;
    cards?: boolean;
    /** The page being looked at, if it's a knot's. */
    current?: string;
    /** Called as a link is followed, before the page changes. */
    onFollow?: () => void;
}) {
    return (
        <div className={`flex flex-col ${props.cards ? "gap-2" : ""}`}>
            {props.contents.map((section) => (
                <section key={section.title} aria-label={section.title}>
                    <ul className={`flex flex-col ${props.cards ? "gap-2" : ""}`}>
                        {section.knots.map((knot) => {
                            if ("comingSoon" in knot)
                                return (
                                    <li
                                        key={knot.name}
                                        className={`flex items-center gap-3 text-ghost ${
                                            props.cards
                                                ? "rounded-xl border border-line-faint px-3 py-2"
                                                : "px-2 py-1"
                                        }`}
                                    >
                                        <span className={NAME}>{knot.name}</span>
                                        <span className="text-xs">Coming soon</span>
                                    </li>
                                );
                            const current = knot.href === props.current;
                            return (
                                <li key={knot.href}>
                                    <Link
                                        href={knot.href}
                                        aria-current={current ? "page" : undefined}
                                        onClick={props.onFollow}
                                        className={`flex items-center gap-3 ${
                                            props.cards
                                                ? "rounded-xl border border-border bg-surface/50 px-3 py-2 hover:border-action"
                                                : `rounded-lg px-2 py-1 hover:bg-surface-raised ${current ? "bg-surface-raised" : ""}`
                                        }`}
                                    >
                                        <span
                                            className={`${NAME} ${
                                                props.cards
                                                    ? "font-medium text-ink-strong"
                                                    : current
                                                      ? "text-highlight"
                                                      : ""
                                            }`}
                                        >
                                            {knot.name}
                                            {knot.variant && (
                                                <>
                                                    {" "}
                                                    <span
                                                        className={`block text-sm font-normal ${current ? "" : "text-ink-muted"}`}
                                                    >
                                                        {knot.variant}
                                                    </span>
                                                </>
                                            )}
                                        </span>
                                        {knot.drawing}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
}

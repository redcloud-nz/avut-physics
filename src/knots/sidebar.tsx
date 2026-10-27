"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { KNOTS_TITLE } from ".";
import { KnotList, type KnotContents } from "./knot-list";

/**
 * The knots down the left of a wide screen, held in place as the page beside it scrolls, and scrolled itself to keep
 * the knot being looked at in sight. Phones go without it: they bring the knots down from the page's title instead.
 */
export function Sidebar(props: { contents: KnotContents }) {
    const path = usePathname();
    const box = useRef<HTMLElement>(null);

    useEffect(() => {
        box.current?.querySelector("[aria-current=page]")?.scrollIntoView({ block: "nearest" });
    }, [path]);

    return (
        <aside
            ref={box}
            className="sticky top-0 hidden h-dvh w-80 shrink-0 flex-col gap-3 panel-scroll overflow-y-auto overscroll-contain border-r border-line-faint scroll-py-4 px-4 py-4 text-ink-soft lg:flex"
        >
            <Link href="/" className="px-2 text-sm text-link hover:text-highlight">
                ← Physics Visualisations
            </Link>
            <Link
                href="/knots"
                aria-current={path === "/knots" ? "page" : undefined}
                className="px-2 font-semibold text-ink-strong hover:text-highlight"
            >
                {KNOTS_TITLE}
            </Link>
            <nav aria-label={KNOTS_TITLE}>
                <KnotList contents={props.contents} current={path} />
            </nav>
        </aside>
    );
}

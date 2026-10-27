"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { ContentsList } from "./contents";
import { SERIES } from "./series";

/**
 * The series' contents down the left of a wide screen, held in place as the page beside it scrolls, and scrolled
 * itself to keep the page being read in sight. Phones go without it: they bring the contents down from the page's
 * title instead.
 */
export function Sidebar(props: { contents: { name: string; href: string }[] }) {
    const path = usePathname();
    const current = props.contents.findIndex((page) => page.href === path);
    const box = useRef<HTMLElement>(null);

    useEffect(() => {
        box.current?.querySelector("[aria-current=page]")?.scrollIntoView({ block: "nearest" });
    }, [path]);

    return (
        <aside
            ref={box}
            className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-3 panel-scroll overflow-y-auto overscroll-contain border-r border-line-faint scroll-py-4 px-4 py-4 text-ink-soft lg:flex"
        >
            <Link href="/" className="px-2 text-sm text-link hover:text-highlight">
                ← Physics Visualisations
            </Link>
            <Link
                href="/visual"
                aria-current={path === "/visual" ? "page" : undefined}
                className="px-2 font-semibold text-ink-strong hover:text-highlight"
            >
                {SERIES}
            </Link>
            <nav aria-label="Contents">
                <ContentsList
                    contents={props.contents}
                    current={current < 0 ? undefined : current}
                />
            </nav>
        </aside>
    );
}

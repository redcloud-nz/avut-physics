"use client";

import { usePathname } from "next/navigation";

/**
 * The link to the source at the foot of every page, except the visual introduction and the rescue knots. The visual
 * introduction's pages fill the screen, and its first page, like the knots', puts the link in its own column, beside
 * the contents on a wide screen; a knot's own page goes without it.
 */
export function SiteFooter() {
    const path = usePathname();
    if (path === "/visual" || path.startsWith("/visual/")) return null;
    if (path === "/rescue-knots" || path.startsWith("/rescue-knots/")) return null;
    return <Footer />;
}

/** The link to the source, pushed to the foot of the column it's in. */
export function Footer() {
    return (
        <footer className="mt-auto px-4 pb-6 text-center text-sm text-ghost print:hidden">
            <a href="https://github.com/redcloud-nz/avut-physics" className="hover:text-highlight">
                Source on GitHub
            </a>
        </footer>
    );
}

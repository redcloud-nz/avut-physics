"use client";

import { usePathname } from "next/navigation";

/** The link to the source at the foot of every page, except the visual introduction's own pages, which fill the screen. */
export function SiteFooter() {
    if (usePathname().startsWith("/visual/")) return null;
    return (
        <footer className="mt-auto px-4 pb-6 text-center text-sm text-ghost print:hidden">
            <a href="https://github.com/redcloud-nz/avut-physics" className="hover:text-highlight">
                Source on GitHub
            </a>
        </footer>
    );
}

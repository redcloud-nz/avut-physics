import type { ReactNode } from "react";

import { ScrollMemory } from "@/components/scroll-memory";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * The site's chrome round a page: the box the page scrolls in, the footer, and the memory of how far down each page
 * was. Used by the `(site)` layout and by the 404 page, which renders with only the root layout above it.
 */
export function SiteChrome({ children }: { children: ReactNode }) {
    return (
        <>
            {/* The page scrolls inside this box rather than the window, so its scrollbar can be styled everywhere. */}
            <div className="page-scroll flex h-full flex-col overflow-y-auto">
                {children}
                <SiteFooter />
            </div>
            <ScrollMemory />
        </>
    );
}

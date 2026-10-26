"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** How far down each page was last scrolled, by path. */
const saved = new Map<string, number>();

/**
 * The page scrolls inside `.page-scroll` (see `SiteChrome`), not the window, so the browser doesn't put its
 * scroll back on Back and Forward. This remembers how far down each page was and puts it back then.
 */
export function ScrollMemory() {
    const pathname = usePathname();
    const goingBack = useRef(false);
    useEffect(() => {
        const onPop = () => (goingBack.current = true);
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);
    useEffect(() => {
        const box = document.querySelector<HTMLElement>(".page-scroll");
        if (!box) return;
        // Next may render the page it goes back to before the popstate reaches the listener above, so whether this is
        // Back is only known a frame later, once the page has been laid out. Where it was is read now, before anything
        // scrolls the box.
        const top = saved.get(pathname) ?? 0;
        const frame = requestAnimationFrame(() => {
            if (!goingBack.current) return;
            goingBack.current = false;
            box.scrollTop = top;
        });
        // Leaving the page, Next scrolls the box to the top for the next one: by then the address has changed, and
        // that scroll isn't this page's.
        const save = () => {
            if (location.pathname === pathname) saved.set(pathname, box.scrollTop);
        };
        box.addEventListener("scroll", save, { passive: true });
        return () => {
            cancelAnimationFrame(frame);
            box.removeEventListener("scroll", save);
        };
    }, [pathname]);
    return null;
}

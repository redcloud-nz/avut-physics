"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** How far down each page was last scrolled, by path. */
const saved = new Map<string, number>();

/**
 * The page scrolls inside `.page-scroll` (see the root layout), not the window, so the browser doesn't put its
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
        if (goingBack.current) {
            goingBack.current = false;
            const top = saved.get(pathname) ?? 0;
            // Once the page has been laid out.
            requestAnimationFrame(() => (box.scrollTop = top));
        }
        // Leaving the page, Next scrolls the box to the top for the next one: by then the address has changed, and
        // that scroll isn't this page's.
        const save = () => {
            if (location.pathname === pathname) saved.set(pathname, box.scrollTop);
        };
        box.addEventListener("scroll", save, { passive: true });
        return () => box.removeEventListener("scroll", save);
    }, [pathname]);
    return null;
}

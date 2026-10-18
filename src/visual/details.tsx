"use client";

import { createContext, useContext, useEffect } from "react";
import { createPortal } from "react-dom";

/*
 * A page's details: more than its headline and figure, for readers who want it, in a panel that slides up from under
 * the page's buttons. A figure puts its details there with `Details`, so they can show the figure's live numbers.
 */

export const DetailsContext = createContext<{
    /** Where the details go, once the panel is on the page. */
    target: HTMLElement | null;
    /** Called with +1 as some details arrive and -1 as they go, so the page knows whether it has any. */
    count: (change: number) => void;
}>({ target: null, count: () => {} });

/** Puts `children` in the page's details panel. */
export function Details(props: { children: React.ReactNode }) {
    const { target, count } = useContext(DetailsContext);
    useEffect(() => {
        count(1);
        return () => count(-1);
    }, [count]);
    return target ? createPortal(props.children, target) : null;
}

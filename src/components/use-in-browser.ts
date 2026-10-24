import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Whether this render is in the browser: false on the server and while hydrating, true from then on. Solvers' last
 * few digits can differ between the server and the browser, and React doesn't patch attributes that differ when
 * it hydrates, so pages run their solvers and show results only once this is true.
 */
export function useInBrowser(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => true,
        () => false,
    );
}

/** A solver's result before the page is in the browser: no answer yet, and nothing to say about it. */
export const WAITING = { kind: "none", reason: "" } as const;

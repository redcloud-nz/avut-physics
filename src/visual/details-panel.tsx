"use client";

import { createContext, useContext, useState } from "react";

/*
 * Whether a wide screen's details column is open. It's held above the pages, so a reader who opens it keeps it open
 * from page to page until they close it.
 */

const DetailsPanel = createContext<[boolean, (open: boolean) => void]>([false, () => {}]);

export function DetailsPanelProvider(props: { children: React.ReactNode }) {
    const state = useState(false);
    return <DetailsPanel value={state}>{props.children}</DetailsPanel>;
}

export function useDetailsPanel() {
    return useContext(DetailsPanel);
}

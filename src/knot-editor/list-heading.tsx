"use client";

/** A heading over one of the left panel's lists, with a + button at its end to add to the list. */
import { Plus } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/** The + button: `wrap` puts it inside something that opens a menu instead, when there's a choice to make. */
export function ListHeading(props: {
    label: string;
    add: string;
    onAdd?: () => void;
    wrap?: (button: ReactNode) => ReactNode;
}) {
    const button = (
        <Button
            size="icon-xs"
            variant="ghost"
            aria-label={props.add}
            title={props.add}
            onClick={props.onAdd}
        >
            <Plus />
        </Button>
    );
    return (
        <div className="mt-3 mb-1 flex items-center text-xs tracking-wide text-ink-muted uppercase">
            <span className="mr-auto">{props.label}</span>
            {props.wrap ? props.wrap(button) : button}
        </div>
    );
}

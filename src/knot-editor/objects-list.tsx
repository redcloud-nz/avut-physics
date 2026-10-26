"use client";

/**
 * The list under the steps: the ropes, arrows and props in the picture shown, in the order they're drawn. Choosing one
 * selects it whole, to see and set its values in the panel, and right-clicking one opens its context menu. Its + adds
 * a rope, an arrow or a prop, as Insert does.
 */
import type { Dispatch, ReactNode } from "react";

import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ARROW_TOKENS, ROPE_TOKENS } from "./colours";
import type { MenuTarget } from "./drawing-menu";
import type { Picture } from "./format";
import { ListHeading } from "./list-heading";
import { COMMANDS, propCommand, shortcutLabel, type CommandId } from "./menus";
import { propName, strandName } from "./names";
import { PROP_KIND_NAMES } from "./props";
import type { EditorAction, Selection } from "./state";

/** What the + menu adds: a rope or an arrow, then each kind of prop, as the Insert menu lists them. */
const ADDS: (CommandId | null)[] = [
    "insertRope",
    "insertArrow",
    null,
    ...PROP_KIND_NAMES.map(propCommand),
];

/** A small square of a strand's colour, or an empty one for a prop. */
const swatch = (fill?: string) => (
    <span
        aria-hidden
        className="mr-2 inline-block size-2.5 rounded-sm border border-line align-middle"
        style={fill ? { background: fill } : undefined}
    />
);

export function ObjectsList(props: {
    picture: Picture;
    selection: Selection;
    dispatch: Dispatch<EditorAction>;
    /** Runs a command from the + menu, as the Insert menu does. */
    run: (id: CommandId) => void;
    /** The context menu's items for a rope, arrow or prop right-clicked in the list. */
    menu: (target: MenuTarget) => ReactNode;
}) {
    const { picture, selection, dispatch } = props;
    const item = (key: string, chosen: boolean, label: ReactNode, select: Selection) => {
        const choose = () => dispatch({ type: "select", selection: select });
        const target: MenuTarget =
            select.kind === "prop"
                ? { kind: "prop", index: select.prop }
                : { kind: "strand", strand: select.kind === "strand" ? select.strand : 0 };
        return (
            <ContextMenu key={key}>
                <ContextMenuTrigger asChild>
                    <button
                        type="button"
                        className={`block w-full truncate rounded px-2 py-0.5 text-left ${
                            chosen
                                ? "bg-surface-raised text-highlight"
                                : "text-ink hover:bg-surface"
                        }`}
                        onClick={choose}
                        onContextMenu={choose}
                    >
                        {label}
                    </button>
                </ContextMenuTrigger>
                <ContextMenuContent className="min-w-52">{props.menu(target)}</ContextMenuContent>
            </ContextMenu>
        );
    };
    const empty = picture.strands.length === 0 && picture.props.length === 0;
    return (
        <nav aria-label="Objects">
            <ListHeading
                label="Objects"
                add="Add an object"
                wrap={(button) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-40">
                            {ADDS.map((id, k) =>
                                id === null ? (
                                    <DropdownMenuSeparator key={k} />
                                ) : (
                                    <DropdownMenuItem key={id} onSelect={() => props.run(id)}>
                                        {COMMANDS[id].label}
                                        {COMMANDS[id].shortcut && (
                                            <DropdownMenuShortcut>
                                                {shortcutLabel(COMMANDS[id].shortcut)}
                                            </DropdownMenuShortcut>
                                        )}
                                    </DropdownMenuItem>
                                ),
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            />
            {picture.strands.map((strand, i) =>
                item(
                    `strand-${strand.id}`,
                    selection.kind === "strand" && selection.strand === i,
                    <>
                        {swatch(
                            strand.kind === "rope"
                                ? ROPE_TOKENS[strand.colour].body
                                : ARROW_TOKENS.fill,
                        )}
                        {strandName(strand, i)}
                    </>,
                    { kind: "strand", strand: i },
                ),
            )}
            {picture.props.map((prop, p) =>
                item(
                    `prop-${prop.id}`,
                    selection.kind === "prop" && selection.prop === p,
                    <>
                        {swatch()}
                        {propName(prop, p)}
                    </>,
                    { kind: "prop", prop: p },
                ),
            )}
            {empty && <p className="px-2 text-xs text-ink-muted">Nothing in this picture.</p>}
        </nav>
    );
}

"use client";

/**
 * The context menu: what can be done to the thing right-clicked, on the drawing or in the objects list. Right-clicking
 * selects the thing first (unless it's already selected), so the menu acts on what's highlighted, as the menu bar
 * does. Items that are commands come from the command table, with the same labels and shortcuts as the menu bar.
 */
import type { Dispatch, ReactNode } from "react";

import {
    ContextMenuCheckboxItem,
    ContextMenuItem,
    ContextMenuRadioGroup,
    ContextMenuRadioItem,
    ContextMenuSeparator,
    ContextMenuShortcut,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import type { Vector2 } from "@/lib/vector2";

import type { PictureCrossings } from "./crossing-geometry";
import {
    changeProp,
    deleteStrand,
    insertPin,
    linkPins,
    lockSegment,
    setCrossing,
    setPass,
    setPinAngle,
    setRopeColour,
    unlockSegment,
} from "./edits";
import type { PictureGeometry } from "./geometry";
import { isLinked, ROPE_COLOURS, type Picture, type PinRef, type SegmentRef } from "./knot-file";
import { COMMANDS, shortcutLabel, type CommandId } from "./menus";
import { strandName } from "./names";
import { kindOf, PROP_KIND_NAMES, PROP_KINDS, type PropKindName } from "./props";
import type { EditorAction, Selection } from "./state";

/** What was right-clicked. `before` is what was selected until then, for linking a pin to the one selected. */
export type MenuTarget =
    | { kind: "pin"; ref: PinRef; before: Selection }
    /** `t` is where along the segment's curve. */
    | { kind: "segment"; ref: SegmentRef; t: number }
    | { kind: "strand"; strand: number }
    | { kind: "prop"; index: number }
    /** By its place in `pictureCrossings`' lists. */
    | { kind: "crossing" | "pass"; index: number }
    /** `at` is where (millimetres). */
    | { kind: "background"; at: Vector2 };

const same = (a: PinRef, b: PinRef) => a[0] === b[0] && a[1] === b[1];

export function DrawingMenu(props: {
    target: MenuTarget;
    picture: Picture;
    geometry: PictureGeometry;
    crossings: PictureCrossings;
    enabled: Partial<Record<CommandId, boolean>>;
    checked: Partial<Record<CommandId, boolean>>;
    run: (id: CommandId) => void;
    dispatch: Dispatch<EditorAction>;
    /** Insert a rope or arrow, or a prop, centred here. */
    insertAt: (what: "rope" | "arrow" | PropKindName, at: Vector2) => void;
}) {
    const { target, picture, geometry, enabled, checked, run, dispatch } = props;
    const edit = (change: (q: Picture) => Picture) => dispatch({ type: "edit", edit: change });
    const select = (selection: Selection) => dispatch({ type: "select", selection });

    /** A command from the table, as the menu bar has it. */
    const command = (id: CommandId, label = COMMANDS[id].label) => {
        const c = COMMANDS[id];
        const shortcut = c.shortcut && (
            <ContextMenuShortcut>{shortcutLabel(c.shortcut)}</ContextMenuShortcut>
        );
        return c.toggle ? (
            <ContextMenuCheckboxItem
                key={id}
                checked={!!checked[id]}
                disabled={!enabled[id]}
                onCheckedChange={() => run(id)}
            >
                {label}
                {shortcut}
            </ContextMenuCheckboxItem>
        ) : (
            <ContextMenuItem key={id} disabled={!enabled[id]} onSelect={() => run(id)}>
                {label}
                {shortcut}
            </ContextMenuItem>
        );
    };
    const item = (label: string, action: () => void, disabled = false) => (
        <ContextMenuItem key={label} disabled={disabled} onSelect={action}>
            {label}
        </ContextMenuItem>
    );
    const strandItems = (i: number) => {
        const strand = picture.strands[i];
        if (!strand) return null;
        const noun = strand.kind === "rope" ? "Rope" : "Arrow";
        return (
            <>
                {strand.kind === "rope" && (
                    <ContextMenuSub>
                        <ContextMenuSubTrigger>Colour</ContextMenuSubTrigger>
                        <ContextMenuSubContent>
                            <ContextMenuRadioGroup
                                value={strand.colour}
                                onValueChange={(colour) =>
                                    edit((q) =>
                                        setRopeColour(
                                            q,
                                            i,
                                            colour as (typeof ROPE_COLOURS)[number],
                                        ),
                                    )
                                }
                            >
                                {ROPE_COLOURS.map((colour) => (
                                    <ContextMenuRadioItem key={colour} value={colour}>
                                        {colour[0].toUpperCase() + colour.slice(1)}
                                    </ContextMenuRadioItem>
                                ))}
                            </ContextMenuRadioGroup>
                        </ContextMenuSubContent>
                    </ContextMenuSub>
                )}
                {item(`Delete ${noun}`, () => {
                    edit((q) => deleteStrand(q, i).picture);
                })}
            </>
        );
    };
    const selectRope = (i: number) =>
        item(`Select ${picture.strands[i]?.kind === "arrow" ? "Arrow" : "Rope"}`, () =>
            select({ kind: "strand", strand: i }),
        );

    let items: ReactNode;
    if (target.kind === "pin") {
        const [i, k] = target.ref;
        const pin = picture.strands[i]?.pins[k];
        if (!pin) return null;
        const before = target.before;
        const leader =
            before.kind === "parts" && before.pins.length === 1 && !same(before.pins[0], target.ref)
                ? before.pins[0]
                : undefined;
        items = (
            <>
                {command("delete")}
                {item(
                    "Clear Angle",
                    () => edit((q) => setPinAngle(q, target.ref, undefined)),
                    isLinked(pin) || pin.angle === undefined,
                )}
                <ContextMenuSeparator />
                {item(
                    leader
                        ? `Link to ${strandName(picture.strands[leader[0]], leader[0])}, pin ${leader[1] + 1}`
                        : "Link to Selected Pin",
                    () => leader && edit((q) => linkPins(q, geometry, leader, target.ref)),
                    !leader,
                )}
                {command("unlink")}
                <ContextMenuSeparator />
                {selectRope(i)}
            </>
        );
    } else if (target.kind === "segment") {
        const [i, k] = target.ref;
        const segment = picture.strands[i]?.segments[k];
        if (!segment) return null;
        const locked = segment.length !== undefined;
        items = (
            <>
                {item("Add Pin Here", () => {
                    dispatch({
                        type: "edit",
                        edit: (q, ids) => insertPin(q, geometry, target.ref, target.t, ids),
                    });
                    select({ kind: "parts", pins: [[i, k + 1]], segments: [] });
                })}
                {item(locked ? "Unlock Length" : "Lock Length", () =>
                    edit((q) =>
                        locked
                            ? unlockSegment(q, geometry, target.ref)
                            : lockSegment(q, geometry, target.ref),
                    ),
                )}
                <ContextMenuSeparator />
                {selectRope(i)}
                {strandItems(i)}
            </>
        );
    } else if (target.kind === "strand") {
        items = strandItems(target.strand);
    } else if (target.kind === "prop") {
        const prop = picture.props[target.index];
        if (!prop) return null;
        const p = target.index;
        const choices = kindOf(prop)
            .fields(prop)
            .flatMap((field) => (field.kind === "choice" ? [field] : []));
        items = (
            <>
                {choices.map((field) => (
                    <ContextMenuSub key={field.label}>
                        <ContextMenuSubTrigger>{field.label}</ContextMenuSubTrigger>
                        <ContextMenuSubContent>
                            <ContextMenuRadioGroup
                                value={field.value}
                                onValueChange={(value) =>
                                    edit((q) => changeProp(q, p, (old) => field.set(old, value)))
                                }
                            >
                                {field.options.map((o) => (
                                    <ContextMenuRadioItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ContextMenuRadioItem>
                                ))}
                            </ContextMenuRadioGroup>
                        </ContextMenuSubContent>
                    </ContextMenuSub>
                ))}
                {choices.length > 0 && <ContextMenuSeparator />}
                {command("delete")}
            </>
        );
    } else if (target.kind === "crossing") {
        const c = props.crossings.crossings[target.index];
        if (!c) return null;
        const over = c.over === undefined ? 0 : c.over === 0 ? 1 : 0;
        items = item(c.over === undefined ? "Set Over and Under" : "Swap Over and Under", () =>
            edit((q) => setCrossing(q, c.pair, c.n, over)),
        );
    } else if (target.kind === "pass") {
        const pass = props.crossings.passes[target.index];
        if (!pass) return null;
        const side = pass.side === "front" ? "behind" : "front";
        items = item(side === "front" ? "Put in Front" : "Put Behind", () =>
            edit((q) => setPass(q, pass.prop, [pass.strand, pass.segment], pass.n, side)),
        );
    } else if (target.kind === "background") {
        const { at } = target;
        items = (
            <>
                {item("Rope Here", () => props.insertAt("rope", at))}
                {item("Arrow Here", () => props.insertAt("arrow", at))}
                {PROP_KIND_NAMES.map((kind) =>
                    item(`${PROP_KINDS[kind].label} Here`, () => props.insertAt(kind, at)),
                )}
                <ContextMenuSeparator />
                {command("selectAll")}
                {command("selectNone")}
                <ContextMenuSeparator />
                {command("grid")}
                {command("snap")}
            </>
        );
    }
    return <>{items}</>;
}

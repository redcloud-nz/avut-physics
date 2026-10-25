"use client";

/** Help > Shortcuts: every menu command's shortcut, from the table the menus use, and what the pointer does. */
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { COMMANDS, MENUS, shortcutLabel, type Command, type CommandId } from "./menus";

/** What a click, drag and double-click do on the drawing. */
const POINTER: [string, string][] = [
    ["Click a pin or segment", "Select it"],
    ["Shift-click", "Add it to the selection, or take it out"],
    ["Click the background", "Select nothing"],
    ["Drag a pin", "Move it, with the other pins selected"],
    ["Drag the knob on a pin's ring", "Hold the pin at that angle"],
    ["Double-click the knob", "Let the curve set the angle again"],
    ["Drag a square handle", "Set that end's tension (not on a locked segment)"],
    ["Double-click a segment", "Add a pin there"],
    ["Drag the background", "Pan"],
    ["Wheel or pinch", "Zoom about the pointer"],
];

function Rows(props: { rows: [string, string][] }) {
    return (
        <table className="w-full text-sm">
            <tbody>
                {props.rows.map(([what, key]) => (
                    <tr key={what} className="border-b border-line-faint last:border-0">
                        <td className="py-1 pr-4 text-ink">{what}</td>
                        <td className="py-1 text-right font-mono text-ink-muted">{key}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function ShortcutsDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const keys = MENUS.flatMap((menu) =>
        menu.items
            .flatMap((item): CommandId[] =>
                item === null ? [] : typeof item === "string" ? [item] : item.items,
            )
            .flatMap((id): [string, string][] => {
                const command: Command = COMMANDS[id];
                if (!command.shortcut) return [];
                const label = command.label.replace("…", "");
                // Out of its menu, a label like "Rope" says what it does with the menu's name.
                const what =
                    menu.name === "Insert"
                        ? `Insert ${label.toLowerCase()}`
                        : command.toggle
                          ? `Show or hide ${label.toLowerCase()}`
                          : label;
                return [[what, shortcutLabel(command.shortcut)]];
            }),
    );
    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Shortcuts</DialogTitle>
                    <DialogDescription>
                        While you&apos;re typing in a field, keys without ⌘ (Ctrl off a Mac) type
                        there, and so do undo, redo and select all.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6">
                    <Rows rows={keys} />
                    <Rows rows={POINTER} />
                </div>
            </DialogContent>
        </Dialog>
    );
}

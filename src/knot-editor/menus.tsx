"use client";

/**
 * The editor's commands: one table of every menu item, its shortcut and whether it's a toggle, from which the menu bar,
 * the shortcut handling and (later) the Help dialog are all drawn. Shortcuts are handled here and nowhere else.
 */
import { useEffect, useRef } from "react";

import {
    Menubar,
    MenubarCheckboxItem,
    MenubarContent,
    MenubarItem,
    MenubarLabel,
    MenubarMenu,
    MenubarSeparator,
    MenubarShortcut,
    MenubarSub,
    MenubarSubContent,
    MenubarSubTrigger,
    MenubarTrigger,
} from "@/components/ui/menubar";

import { PROP_KIND_NAMES, PROP_KINDS, type PropKindName } from "./props";

/**
 * A key, with ⌘ (Ctrl off a Mac), Shift and Option (Alt) as needed. `code` is the physical key (`KeyboardEvent.code`),
 * so Option doesn't turn the letter into another character.
 */
export type Shortcut = {
    code: string;
    label: string;
    mod?: boolean;
    shift?: boolean;
    alt?: boolean;
};

/**
 * `also` are more keys for the same command (the arrow keys, beside W, A, S and D). A `far` command's keys work with
 * Shift held too, for a bigger step.
 */
export type Command = {
    label: string;
    shortcut?: Shortcut;
    also?: Shortcut[];
    far?: boolean;
    toggle?: boolean;
};

/** How a command was asked for: `far` when it was a `far` command's key with Shift. */
export type RunOptions = { far?: boolean };

const letter = (l: string) => ({ code: `Key${l}`, label: l });
const arrow = (way: string, label: string) => ({ code: `Arrow${way}`, label });

/**
 * Every command but the props', with its shortcut if it has one. Inserting has none. Chrome keeps ⌘N, ⌘T and ⌘W for
 * itself, so New is ⌥⌘N.
 */
const BASE_COMMANDS = {
    new: { label: "New", shortcut: { ...letter("N"), mod: true, alt: true } },
    open: { label: "Open…", shortcut: { ...letter("O"), mod: true } },
    save: { label: "Save", shortcut: { ...letter("S"), mod: true } },
    saveAs: { label: "Save As…", shortcut: { ...letter("S"), mod: true, shift: true } },
    details: { label: "Knot Details…", shortcut: { ...letter("I"), mod: true } },
    undo: { label: "Undo", shortcut: { ...letter("Z"), mod: true } },
    redo: { label: "Redo", shortcut: { ...letter("Z"), mod: true, shift: true } },
    delete: { label: "Delete", shortcut: { code: "Backspace", label: "⌫" } },
    selectAll: { label: "Select All", shortcut: { ...letter("A"), mod: true } },
    selectNone: { label: "Select None", shortcut: { code: "Escape", label: "Esc" } },
    nextPin: { label: "Select Next Pin", shortcut: { code: "Tab", label: "⇥" } },
    previousPin: {
        label: "Select Previous Pin",
        shortcut: { code: "Tab", label: "⇥", shift: true },
    },
    moveUp: { label: "Up", shortcut: letter("W"), also: [arrow("Up", "↑")], far: true },
    moveLeft: { label: "Left", shortcut: letter("A"), also: [arrow("Left", "←")], far: true },
    moveDown: { label: "Down", shortcut: letter("S"), also: [arrow("Down", "↓")], far: true },
    moveRight: { label: "Right", shortcut: letter("D"), also: [arrow("Right", "→")], far: true },
    turnAnticlockwise: { label: "Turn Anticlockwise", shortcut: letter("Q"), far: true },
    turnClockwise: { label: "Turn Clockwise", shortcut: letter("E"), far: true },
    link: { label: "Link Pins", shortcut: letter("L") },
    unlink: { label: "Unlink", shortcut: { ...letter("L"), shift: true } },
    insertPin: { label: "Pin" },
    insertRope: { label: "Rope" },
    insertArrow: { label: "Arrow" },
    insertStep: { label: "Step" },
    zoomIn: { label: "Zoom In", shortcut: { code: "Equal", label: "=", mod: true } },
    zoomOut: { label: "Zoom Out", shortcut: { code: "Minus", label: "−", mod: true } },
    fit: { label: "Fit", shortcut: { code: "Digit0", label: "0", mod: true } },
    pinNumbers: { label: "Pin Numbers", toggle: true },
    handles: { label: "Handles", toggle: true },
    crossings: { label: "Crossings", toggle: true },
    bendWarnings: { label: "Bend Warnings", toggle: true },
    grid: { label: "Grid", shortcut: letter("G"), toggle: true },
    snap: { label: "Snap to Grid", shortcut: letter("F"), toggle: true },
    shortcuts: { label: "Shortcuts", shortcut: { code: "Slash", label: "?", shift: true } },
} satisfies Record<string, Command>;

/** Inserting a prop of a kind, as Insert > Prop lists them from the registry. */
export type PropCommandId = `prop:${PropKindName}`;
export const propCommand = (kind: PropKindName): PropCommandId => `prop:${kind}`;

export type CommandId = keyof typeof BASE_COMMANDS | PropCommandId;

export const COMMANDS: Record<CommandId, Command> = {
    ...BASE_COMMANDS,
    ...(Object.fromEntries(
        PROP_KIND_NAMES.map((kind) => [propCommand(kind), { label: PROP_KINDS[kind].label }]),
    ) as Record<PropCommandId, Command>),
};

/** A menu's item: a command, a separator (`null`), or a submenu of commands. */
export type MenuItem = CommandId | null | { submenu: string; items: CommandId[] };

/** The menus, their items in order. */
export const MENUS: { name: string; items: MenuItem[] }[] = [
    { name: "File", items: ["new", "open", null, "save", "saveAs", null, "details"] },
    {
        name: "Edit",
        items: [
            "undo",
            "redo",
            null,
            "delete",
            null,
            "selectAll",
            "selectNone",
            "nextPin",
            "previousPin",
            null,
            {
                submenu: "Move",
                items: [
                    "moveUp",
                    "moveLeft",
                    "moveDown",
                    "moveRight",
                    "turnAnticlockwise",
                    "turnClockwise",
                ],
            },
            null,
            "link",
            "unlink",
        ],
    },
    {
        name: "Insert",
        items: [
            "insertPin",
            "insertRope",
            "insertArrow",
            { submenu: "Prop", items: PROP_KIND_NAMES.map(propCommand) },
            null,
            "insertStep",
        ],
    },
    {
        name: "View",
        items: [
            "zoomIn",
            "zoomOut",
            "fit",
            null,
            "pinNumbers",
            "handles",
            "crossings",
            "bendWarnings",
            null,
            "grid",
            "snap",
        ],
    },
    { name: "Help", items: ["shortcuts"] },
];

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** A shortcut as shown beside its item: ⌥⇧⌘S on a Mac, Ctrl+Alt+Shift+S elsewhere. */
export function shortcutLabel(s: Shortcut, mac = isMac()): string {
    if (mac) return `${s.alt ? "⌥" : ""}${s.shift ? "⇧" : ""}${s.mod ? "⌘" : ""}${s.label}`;
    return [s.mod && "Ctrl", s.alt && "Alt", s.shift && "Shift", s.label].filter(Boolean).join("+");
}

/** Whether a key press is this shortcut; with `far`, held with Shift or not. */
function matches(s: Shortcut, e: KeyboardEvent, mac: boolean, far = false): boolean {
    const mod = mac ? e.metaKey : e.ctrlKey;
    const other = mac ? e.ctrlKey : e.metaKey;
    const code = s.code === "Backspace" && e.code === "Delete" ? "Backspace" : e.code;
    return (
        code === s.code &&
        mod === !!s.mod &&
        !other &&
        e.altKey === !!s.alt &&
        (far || e.shiftKey === !!s.shift)
    );
}

/** Inputs that take no typing (a slider, a checkbox), so the editor's keys still work with one focused. */
const NOT_TYPED = ["range", "checkbox", "radio", "button"];

/** Whether keys typed here belong to a field rather than the editor. */
const typing = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    !(target instanceof HTMLInputElement && NOT_TYPED.includes(target.type)) &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Keys a focused control uses itself: to move focus, close, or step its value. */
const CONTROL_KEYS = /^(Tab|Escape|Arrow\w+)$/;

/** Whether the key went to a control (a button, a slider, a menu item) rather than the page as a whole. */
const onControl = (target: EventTarget | null) =>
    target instanceof HTMLElement && target !== document.body;

/** Shortcuts a field being typed in keeps for itself: undoing and selecting its own text. */
const FIELD_COMMANDS: CommandId[] = ["undo", "redo", "selectAll"];

/**
 * Runs each command's shortcut. The browser's own action for a shortcut the editor takes (⌘S, ⌘O) is always
 * prevented, even while the command can't run, so ⌘S never saves the page itself. Plain keys, and undo, redo and
 * select all, are left to a field being typed in.
 */
export function useShortcuts(
    enabled: Partial<Record<CommandId, boolean>>,
    run: (id: CommandId, options?: RunOptions) => void,
) {
    const latest = useRef({ enabled, run });
    useEffect(() => {
        latest.current = { enabled, run };
    });
    useEffect(() => {
        const mac = isMac();
        const onKey = (e: KeyboardEvent) => {
            for (const [id, command] of Object.entries(COMMANDS) as [CommandId, Command][]) {
                const s = [command.shortcut ?? [], command.also ?? []]
                    .flat()
                    .find((key) => matches(key, e, mac, command.far));
                if (!s) continue;
                if (typing(e.target) && ((!s.mod && !s.alt) || FIELD_COMMANDS.includes(id))) return;
                // On a control (a button, a slider, a menu), Tab, Escape and the arrow keys are its own.
                if (CONTROL_KEYS.test(s.code) && onControl(e.target)) return;
                e.preventDefault();
                if (latest.current.enabled[id])
                    latest.current.run(id, command.far ? { far: e.shiftKey } : undefined);
                return;
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
}

/**
 * The menu bar. Items not enabled are greyed out; toggles show a tick when checked. A menu's note, when it has one, is
 * shown at its top (to say why its items can't be used).
 */
export function Menus(props: {
    enabled: Partial<Record<CommandId, boolean>>;
    checked: Partial<Record<CommandId, boolean>>;
    run: (id: CommandId) => void;
    notes?: Record<string, string>;
}) {
    const mac = isMac();
    const item = (id: CommandId) => {
        const command: Command = COMMANDS[id];
        const shortcut = command.shortcut && (
            <MenubarShortcut>{shortcutLabel(command.shortcut, mac)}</MenubarShortcut>
        );
        return command.toggle ? (
            <MenubarCheckboxItem
                key={id}
                checked={!!props.checked[id]}
                disabled={!props.enabled[id]}
                onCheckedChange={() => props.run(id)}
            >
                {command.label}
                {shortcut}
            </MenubarCheckboxItem>
        ) : (
            <MenubarItem key={id} disabled={!props.enabled[id]} onSelect={() => props.run(id)}>
                {command.label}
                {shortcut}
            </MenubarItem>
        );
    };
    return (
        <Menubar className="h-auto rounded-none border-0 bg-transparent p-0">
            {MENUS.map((menu) => (
                <MenubarMenu key={menu.name}>
                    <MenubarTrigger className="px-2 py-1">{menu.name}</MenubarTrigger>
                    <MenubarContent className="min-w-52">
                        {props.notes?.[menu.name] && (
                            <>
                                <MenubarLabel className="max-w-52 font-normal text-ink-muted">
                                    {props.notes[menu.name]}
                                </MenubarLabel>
                                <MenubarSeparator />
                            </>
                        )}
                        {menu.items.map((entry, k) =>
                            entry === null ? (
                                <MenubarSeparator key={k} />
                            ) : typeof entry === "string" ? (
                                item(entry)
                            ) : (
                                <MenubarSub key={entry.submenu}>
                                    <MenubarSubTrigger>{entry.submenu}</MenubarSubTrigger>
                                    <MenubarSubContent>{entry.items.map(item)}</MenubarSubContent>
                                </MenubarSub>
                            ),
                        )}
                    </MenubarContent>
                </MenubarMenu>
            ))}
        </Menubar>
    );
}

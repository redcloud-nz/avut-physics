/**
 * Opening and saving knot files on your computer, with the File System Access API (Chrome and Edge only). Nothing is
 * written by the server. A picker closed without choosing is nothing happening, not an error; a file that can't be
 * read, parsed or written is an error with the reason, for the editor to show.
 */

import { parseKnotFile, writeKnotFile, type KnotFile } from "./format";

/** Whether this browser can open and save files on the computer. */
export const canUseFiles = () =>
    typeof window !== "undefined" && !!window.showOpenFilePicker && !!window.showSaveFilePicker;

const PICKER = {
    id: "knot-files",
    types: [{ description: "Knot file", accept: { "application/json": [".json"] } }],
};

export type Opened = {
    kind: "opened";
    handle: FileSystemFileHandle;
    file: KnotFile;
    /** The version it was in, when it was upgraded on opening. */
    upgradedFrom?: number;
};
export type Saved = { kind: "saved"; handle: FileSystemFileHandle };
export type Cancelled = { kind: "cancelled" };
export type Failed = { kind: "error"; reason: string };

/** Whether the picker was closed without choosing a file. */
const cancelled = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

const reasonOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** One `.json` file, chosen and read. */
export async function openKnotFile(): Promise<Opened | Cancelled | Failed> {
    let handle: FileSystemFileHandle;
    try {
        [handle] = await window.showOpenFilePicker!({ ...PICKER, multiple: false });
    } catch (e) {
        return cancelled(e) ? { kind: "cancelled" } : { kind: "error", reason: reasonOf(e) };
    }
    let text: string;
    try {
        text = await (await handle.getFile()).text();
    } catch (e) {
        return { kind: "error", reason: `Couldn't read ${handle.name}: ${reasonOf(e)}` };
    }
    const read = parseKnotFile(text);
    if (read.kind === "error")
        return { kind: "error", reason: `${handle.name} can't be opened. ${read.reason}` };
    return {
        kind: "opened",
        handle,
        file: read.file,
        ...(read.upgradedFrom !== undefined && { upgradedFrom: read.upgradedFrom }),
    };
}

/** The file written to a handle (the one opened, or last saved to). */
export async function saveKnotFile(
    handle: FileSystemFileHandle,
    file: KnotFile,
): Promise<Saved | Failed> {
    try {
        const text = await writeKnotFile(file);
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        return { kind: "saved", handle };
    } catch (e) {
        return { kind: "error", reason: `Couldn't save ${handle.name}: ${reasonOf(e)}` };
    }
}

/** The file written to a new file chosen in the picker. */
export async function saveKnotFileAs(
    file: KnotFile,
    suggestedName: string,
): Promise<Saved | Cancelled | Failed> {
    let handle: FileSystemFileHandle;
    try {
        handle = await window.showSaveFilePicker!({ ...PICKER, suggestedName });
    } catch (e) {
        return cancelled(e) ? { kind: "cancelled" } : { kind: "error", reason: reasonOf(e) };
    }
    return saveKnotFile(handle, file);
}

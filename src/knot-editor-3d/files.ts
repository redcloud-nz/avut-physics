/**
 * Opening and saving 3D knot files on your computer with the File System Access API (Chrome and Edge only), as the 2D
 * editor does (`src/knot-editor/files.ts`). Nothing is written by the server. A picker closed without choosing is
 * nothing happening, not an error.
 */

import { parseKnot3d, type Knot3dFile } from "./knot-file";
import { writeKnot3d } from "./write-knot-file";

export { canUseFiles } from "@/knot-editor/files";

const PICKER = {
    id: "knot-3d-files",
    types: [{ description: "3D knot file", accept: { "application/json": [".json"] } }],
};

export type Opened = {
    kind: "opened";
    handle: FileSystemFileHandle;
    file: Knot3dFile;
    upgradedFrom?: number;
};
export type Saved = { kind: "saved"; handle: FileSystemFileHandle };
export type Cancelled = { kind: "cancelled" };
export type Failed = { kind: "error"; reason: string };

const cancelled = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
const reasonOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** One `.json` file, chosen and read. */
export async function openKnot3d(): Promise<Opened | Cancelled | Failed> {
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
    const read = parseKnot3d(text);
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
export async function saveKnot3d(
    handle: FileSystemFileHandle,
    file: Knot3dFile,
): Promise<Saved | Failed> {
    try {
        const text = await writeKnot3d(file);
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        return { kind: "saved", handle };
    } catch (e) {
        return { kind: "error", reason: `Couldn't save ${handle.name}: ${reasonOf(e)}` };
    }
}

/** The file written to a new file chosen in the picker. */
export async function saveKnot3dAs(
    file: Knot3dFile,
    suggestedName: string,
): Promise<Saved | Cancelled | Failed> {
    let handle: FileSystemFileHandle;
    try {
        handle = await window.showSaveFilePicker!({ ...PICKER, suggestedName });
    } catch (e) {
        return cancelled(e) ? { kind: "cancelled" } : { kind: "error", reason: reasonOf(e) };
    }
    return saveKnot3d(handle, file);
}

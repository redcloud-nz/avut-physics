/**
 * The editor's state: the file, which of its pictures is being edited, what's selected in it, the history for undo
 * and redo, and whether it's saved. Undo holds whole files: an edit makes a new file sharing everything it didn't
 * change, so keeping the old one is cheap. Each history entry also holds the picture being edited and the selection
 * at the time, so undo and redo show the picture they change and put the selection back.
 */

import type { Edited, Renumbering } from "./edits";
import type { KnotFile, Picture, PinRef, SegmentRef } from "./format";

/** The finished knot, or a step (by its place in the file's list). */
export type PictureId = "knot" | number;

/** Pins and segments (any number, of any strands), or one prop. */
export type Selection =
    | { kind: "parts"; pins: PinRef[]; segments: SegmentRef[] }
    | { kind: "prop"; prop: number };

export const NOTHING: Selection = { kind: "parts", pins: [], segments: [] };

type Snapshot = { file: KnotFile; picture: PictureId; selection: Selection };

export type EditorState = Snapshot & {
    /** The file on the computer it was opened from or last saved to; none until it's saved. */
    handle?: FileSystemFileHandle;
    /** The file's name, as shown in the title. */
    fileName: string;
    /** The file as last opened or saved; none when what's open has never been saved as it is. */
    savedFile?: KnotFile;
    undo: Snapshot[];
    redo: Snapshot[];
    /** Whether a drag is going on: its moves all belong to the one history entry it began with. */
    dragging: boolean;
    /** How many files have been opened or made, so the view can start afresh for each. */
    loads: number;
};

export type EditorAction =
    /** A file opened, or a new one. `saved` is false for a file that was upgraded on opening. */
    | {
          type: "load";
          file: KnotFile;
          handle?: FileSystemFileHandle;
          fileName: string;
          saved: boolean;
      }
    /** This file written to the handle (it may be older than the file now, if edits came while it saved). */
    | { type: "saved"; file: KnotFile; handle: FileSystemFileHandle; fileName: string }
    /** An edit to the picture being edited. */
    | { type: "edit"; edit: (picture: Picture) => Picture | Edited }
    | { type: "begin-drag" }
    | { type: "end-drag" }
    | { type: "undo" }
    | { type: "redo" }
    | { type: "select"; selection: Selection }
    | { type: "show"; picture: PictureId };

/** The state for a file just opened or made. */
export function loaded(
    file: KnotFile,
    fileName: string,
    { handle, saved = true }: { handle?: FileSystemFileHandle; saved?: boolean } = {},
): EditorState {
    return {
        file,
        picture: "knot",
        selection: NOTHING,
        ...(handle && { handle }),
        fileName,
        ...(saved && { savedFile: file }),
        undo: [],
        redo: [],
        dragging: false,
        loads: 0,
    };
}

export const isSaved = (state: EditorState) => state.file === state.savedFile;

export const pictureOf = (file: KnotFile, id: PictureId): Picture =>
    id === "knot" ? file.knot : file.steps[id].picture;

function withPicture(file: KnotFile, id: PictureId, picture: Picture): KnotFile {
    if (id === "knot") return { ...file, knot: picture };
    const steps = file.steps.slice();
    steps[id] = { ...steps[id], picture };
    return { ...file, steps };
}

/** The selection after an edit renumbered the pins and segments. */
function renumbered(selection: Selection, renumbering: Renumbering): Selection {
    if (selection.kind !== "parts") return selection;
    return {
        kind: "parts",
        pins: selection.pins.flatMap((ref) => {
            const to = renumbering.pin(ref);
            return to ? [to] : [];
        }),
        segments: selection.segments.flatMap((ref) => renumbering.segment(ref)),
    };
}

const snapshot = ({ file, picture, selection }: EditorState): Snapshot => ({
    file,
    picture,
    selection,
});

/**
 * The entry to go back to the state as it is, from undoing or redoing `entry`: it shows the picture `entry` changes,
 * even if another is shown now, with the selection only if it's in that picture.
 */
const returnTo = (state: EditorState, entry: Snapshot): Snapshot => ({
    file: state.file,
    picture: entry.picture,
    selection: state.picture === entry.picture ? state.selection : NOTHING,
});

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
    switch (action.type) {
        case "load":
            return { ...loaded(action.file, action.fileName, action), loads: state.loads + 1 };
        case "saved":
            return {
                ...state,
                handle: action.handle,
                fileName: action.fileName,
                savedFile: action.file,
            };
        case "edit": {
            const before = pictureOf(state.file, state.picture);
            const result = action.edit(before);
            const edited: Edited = "strands" in result ? { picture: result } : result;
            if (edited.picture === before) return state;
            return {
                ...state,
                file: withPicture(state.file, state.picture, edited.picture),
                selection: edited.renumbering
                    ? renumbered(state.selection, edited.renumbering)
                    : state.selection,
                // A drag's moves go into the entry it began with.
                undo: state.dragging ? state.undo : [...state.undo, snapshot(state)],
                redo: state.dragging ? state.redo : [],
            };
        }
        case "begin-drag":
            if (state.dragging) return state;
            return { ...state, dragging: true, undo: [...state.undo, snapshot(state)], redo: [] };
        case "end-drag": {
            if (!state.dragging) return state;
            // A drag that didn't move anything leaves no entry.
            const began = state.undo[state.undo.length - 1];
            return {
                ...state,
                dragging: false,
                undo: began?.file === state.file ? state.undo.slice(0, -1) : state.undo,
            };
        }
        case "undo": {
            const entry = state.undo[state.undo.length - 1];
            if (!entry || state.dragging) return state;
            return {
                ...state,
                ...entry,
                undo: state.undo.slice(0, -1),
                redo: [...state.redo, returnTo(state, entry)],
            };
        }
        case "redo": {
            const entry = state.redo[state.redo.length - 1];
            if (!entry || state.dragging) return state;
            return {
                ...state,
                ...entry,
                undo: [...state.undo, returnTo(state, entry)],
                redo: state.redo.slice(0, -1),
            };
        }
        case "select":
            return { ...state, selection: action.selection };
        case "show":
            return state.picture === action.picture
                ? state
                : { ...state, picture: action.picture, selection: NOTHING };
    }
}

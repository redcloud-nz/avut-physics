import { rad } from "@/lib/math";
import type { Play } from "@/lib/rope-3d/operations";
import { segmentCount, segmentMiddle } from "@/lib/rope-3d/rope";
import { vec3, type Vector3 } from "@/lib/vector3";

import type { Knot3dFile } from "./knot-file";

/**
 * The 3D knot editor's state: the file and its undo history, and the rope in play. Every edit (a whole drag, a whole
 * tightening) is one step to undo. What's in play isn't undone: it's what you're working on, not part of the file, and
 * it's in segment numbers, which every edit keeps.
 */
export type EditorState = {
    file: Knot3dFile;
    fileName: string;
    /** Whether the file's as it was last opened or saved. */
    saved: boolean;
    past: Knot3dFile[];
    future: Knot3dFile[];
    play: Play | null;
    /** Where the handle was when it was chosen, for its offset since. */
    origin: Vector3 | null;
    /** The segment last chosen, for choosing a range from it. */
    last: number | null;
};

/**
 * How a segment's chosen: `handle` (a click) makes it the handle, putting it in play on its own if it isn't already;
 * `toggle` (⌘- or Ctrl-click, or a click while choosing) puts it in play or takes it out; `range` (with Shift too)
 * puts in every segment between it and the last one chosen.
 */
export type ChooseMode = "handle" | "toggle" | "range";

export type Action =
    | { type: "load"; file: Knot3dFile; fileName: string; saved: boolean }
    | { type: "edit"; file: Knot3dFile }
    | { type: "undo" }
    | { type: "redo" }
    | { type: "choose"; seg: number; mode: ChooseMode }
    | { type: "choose-none" }
    | { type: "saved"; fileName: string };

/** The most edits kept to undo. */
const HISTORY = 100;

export function initialState(file: Knot3dFile, fileName: string): EditorState {
    return {
        file,
        fileName,
        saved: true,
        past: [],
        future: [],
        play: null,
        origin: null,
        last: null,
    };
}

/** The rope in play after choosing segment `seg` (`last` the one chosen before), or null for none. */
export function choose(
    play: Play | null,
    seg: number,
    mode: ChooseMode,
    last: number | null,
): Play | null {
    if (!play) return { from: seg, to: seg, handle: seg };
    const inPlay = seg >= play.from && seg <= play.to;
    if (mode === "handle")
        return inPlay ? { ...play, handle: seg } : { from: seg, to: seg, handle: seg };
    if (mode === "range") {
        const from = Math.min(play.from, seg, last ?? seg);
        const to = Math.max(play.to, seg, last ?? seg);
        return { ...play, from, to };
    }
    // Toggling: one not in play joins, filling any gap; one in play leaves, with whatever's beyond it from the handle.
    if (!inPlay) return { ...play, from: Math.min(play.from, seg), to: Math.max(play.to, seg) };
    if (play.from === play.to) return null;
    if (seg === play.from)
        return { ...play, from: seg + 1, handle: Math.max(play.handle, seg + 1) };
    if (seg === play.to) return { ...play, to: seg - 1, handle: Math.min(play.handle, seg - 1) };
    if (seg < play.handle) return { ...play, from: seg + 1 };
    return { ...play, to: seg - 1, handle: Math.min(play.handle, seg - 1) };
}

/** `play` if it still fits the file's rope, otherwise none. */
function fitted(play: Play | null, file: Knot3dFile): Play | null {
    return play && play.to <= segmentCount(file.rope) ? play : null;
}

export function reduce(state: EditorState, action: Action): EditorState {
    switch (action.type) {
        case "load":
            return { ...initialState(action.file, action.fileName), saved: action.saved };
        case "edit":
            return {
                ...state,
                file: action.file,
                saved: false,
                past: [...state.past, state.file].slice(-HISTORY),
                future: [],
                play: fitted(state.play, action.file),
            };
        case "undo": {
            const before = state.past.at(-1);
            if (!before) return state;
            return {
                ...state,
                file: before,
                saved: false,
                past: state.past.slice(0, -1),
                future: [state.file, ...state.future],
                play: fitted(state.play, before),
            };
        }
        case "redo": {
            const [next, ...rest] = state.future;
            if (!next) return state;
            return {
                ...state,
                file: next,
                saved: false,
                past: [...state.past, state.file],
                future: rest,
                play: fitted(state.play, next),
            };
        }
        case "choose": {
            const play = choose(state.play, action.seg, action.mode, state.last);
            const handleMoved = play?.handle !== state.play?.handle;
            return {
                ...state,
                play,
                last: action.seg,
                origin: !play
                    ? null
                    : handleMoved
                      ? segmentMiddle(state.file.rope, play.handle)
                      : state.origin,
            };
        }
        case "choose-none":
            return { ...state, play: null, origin: null, last: null };
        case "saved":
            return { ...state, saved: true, fileName: action.fileName };
    }
}

/**
 * Which way a W/A/S/D/R/F key moves the handle, with the view looking from compass bearing `azimuth` (degrees): W away
 * from the eye, S towards it, A and D to its left and right, each along whichever of X and Z is nearest that way, so
 * the move lies along an axis as the arrows' do; R up and F down.
 */
export function keyDirection(code: string, azimuth: number): Vector3 | null {
    if (code === "KeyR") return vec3(0, 1, 0);
    if (code === "KeyF") return vec3(0, -1, 0);
    const [s, c] = [Math.sin(rad(azimuth)), Math.cos(rad(azimuth))];
    // Level, away from the eye and to its right (the view's three.js coordinates turned back to the physics').
    const [forward, right] = [vec3(-s, 0, -c), vec3(-c, 0, s)];
    const way = {
        KeyW: forward,
        KeyS: forward.scale(-1),
        KeyD: right,
        KeyA: right.scale(-1),
    }[code];
    if (!way) return null;
    return Math.abs(way.x) >= Math.abs(way.z)
        ? vec3(Math.sign(way.x), 0, 0)
        : vec3(0, 0, Math.sign(way.z));
}

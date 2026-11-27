import { rad } from "@/lib/math";
import type { PinnedRope } from "@/lib/rope-3d/pinned";
import type { Role } from "@/lib/rope-3d/stage";
import { vec3, type Vector3 } from "@/lib/vector3";

import type { Knot3dFile } from "./knot-file";

/**
 * The 3D knot editor's state: the file and its undo history, what's picked (a pin or a segment, by id, so it survives
 * edits that add or take away pins), and how the segments are painted for tightening. Every edit (a drag, a nudge, a
 * stage kept) is one step to undo. What's picked and painted isn't undone: it's what you're working on, not the file.
 */
export type Picked = { kind: "pin" | "segment"; id: number } | null;

/** Shaping the rope by its pins, or painting segments and tightening. */
export type Mode = "shape" | "tighten";

export type EditorState = {
    file: Knot3dFile;
    fileName: string;
    /** Whether the file's as it was last opened or saved. */
    saved: boolean;
    past: Knot3dFile[];
    future: Knot3dFile[];
    picked: Picked;
    mode: Mode;
    /** Each painted segment's role, by id; the rest slide. */
    painting: ReadonlyMap<number, Role>;
    /** The segment last painted, for painting a run from it. */
    lastPainted: number | null;
};

export type Action =
    | { type: "load"; file: Knot3dFile; fileName: string; saved: boolean }
    | { type: "edit"; file: Knot3dFile }
    | { type: "undo" }
    | { type: "redo" }
    | { type: "pick"; picked: Picked }
    | { type: "mode"; mode: Mode }
    /** Segments (by id) painted with a role, or `null` to slide. */
    | { type: "paint"; ids: number[]; role: Role | null }
    | { type: "saved"; fileName: string };

/** The most edits kept to undo. */
const HISTORY = 100;

/** A rope's painting to start with: its two end segments held, so tightening doesn't draw them in. */
export function startPainting(rope: PinnedRope): Map<number, Role> {
    const out = new Map<number, Role>();
    out.set(rope.segments[0].id, "hold");
    out.set(rope.segments.at(-1)!.id, "hold");
    return out;
}

export function initialState(file: Knot3dFile, fileName: string): EditorState {
    return {
        file,
        fileName,
        saved: true,
        past: [],
        future: [],
        picked: null,
        mode: "shape",
        painting: startPainting(file.rope),
        lastPainted: null,
    };
}

/** `picked` if the file's rope still has it, otherwise nothing. */
function still(picked: Picked, file: Knot3dFile): Picked {
    if (!picked) return null;
    const list = picked.kind === "pin" ? file.rope.pins : file.rope.segments;
    return list.some((x) => x.id === picked.id) ? picked : null;
}

/** The segments (by id) from `from` to `to` along the rope, both included, in either order. */
export function segmentsBetween(rope: PinnedRope, from: number, to: number): number[] {
    const ids = rope.segments.map((s) => s.id);
    const [a, b] = [ids.indexOf(from), ids.indexOf(to)];
    if (a < 0 || b < 0) return [to];
    return ids.slice(Math.min(a, b), Math.max(a, b) + 1);
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
                picked: still(state.picked, action.file),
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
                picked: still(state.picked, before),
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
                picked: still(state.picked, next),
            };
        }
        case "pick":
            return { ...state, picked: action.picked };
        case "mode":
            return { ...state, mode: action.mode };
        case "paint": {
            const painting = new Map(state.painting);
            for (const id of action.ids)
                if (action.role) painting.set(id, action.role);
                else painting.delete(id);
            return { ...state, painting, lastPainted: action.ids.at(-1) ?? state.lastPainted };
        }
        case "saved":
            return { ...state, saved: true, fileName: action.fileName };
    }
}

/**
 * Which way a W/A/S/D/R/F key moves a pin, with the view looking from compass bearing `azimuth` (degrees): W away from
 * the eye, S towards it, A and D to its left and right, each along whichever of X and Z is nearest that way, so the
 * move lies along an axis as the arrows' do; R up and F down.
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

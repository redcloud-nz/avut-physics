/** What a scene's told about how it's keeping up: its frame rate falling short, or with room to spare. */
export type FrameRate = "short" | "spare";

/**
 * How finely a scene is drawn, chosen on the page or left to follow the frame rate (Auto). In 3D it sets how
 * many pixels each CSS pixel gets (the biggest cost on a phone's dense screen) and how round the ropes and rods are; in
 * the flat views, how small a detail can be before it's left out.
 */
export type Detail = "low" | "medium" | "high";
export type DetailChoice = "auto" | Detail;

export const DETAILS: Record<
    Detail,
    { label: string; dpr: number; sides: number; finePx: number }
> = {
    low: { label: "Low", dpr: 1, sides: 6, finePx: 4 },
    medium: { label: "Medium", dpr: 1.5, sides: 10, finePx: 1.5 },
    high: { label: "High", dpr: 2.5, sides: 16, finePx: 0.75 },
};

/** Where Auto starts, before it's seen how the device keeps up. */
export const AUTO_START: Detail = "medium";

const ORDER: Detail[] = ["low", "medium", "high"];

/** A step down when the frame rate's short, a step up when it has room to spare (no further than the ends). */
export function stepDetail(d: Detail, rate: FrameRate): Detail {
    const i = ORDER.indexOf(d) + (rate === "short" ? -1 : 1);
    return ORDER[Math.min(Math.max(i, 0), ORDER.length - 1)];
}

/** The frame rates (per second) Auto keeps between: below the first it steps down, above the second up. */
export const BOUNDS = { short: 45, spare: 58 };

/** How many times Auto may change direction (down then up, or up then down) before it stops, rather than flip forever. */
export const FLIPS = 4;

/**
 * Judges a run of frame times (milliseconds between frames): short of smooth, room to spare, or neither. Frames longer
 * than a quarter of a second are left out, as the page was idle or hidden rather than slow.
 */
export function judge(intervals: number[]): FrameRate | null {
    const busy = intervals.filter((dt) => dt > 0 && dt < 250);
    if (busy.length < 20) return null;
    const fps = 1000 / (busy.reduce((s, dt) => s + dt, 0) / busy.length);
    if (fps < BOUNDS.short) return "short";
    if (fps > BOUNDS.spare) return "spare";
    return null;
}

/** The choice kept between visits under `key` (one per scene), or Auto. */
export function loadChoice(key: string): DetailChoice {
    try {
        const v = localStorage.getItem(key);
        return v === "low" || v === "medium" || v === "high" || v === "auto" ? v : "auto";
    } catch {
        return "auto";
    }
}

export function saveChoice(key: string, c: DetailChoice) {
    try {
        localStorage.setItem(key, c);
    } catch {
        // Not kept, as in a private window; it's only a convenience.
    }
}

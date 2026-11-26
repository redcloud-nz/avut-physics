import { useCallback, useEffect, useRef, useState } from "react";

import { useInBrowser } from "@/components/use-in-browser";

import {
    AUTO_START,
    FLIPS,
    judge,
    loadChoice,
    saveChoice,
    stepDetail,
    type Detail,
    type DetailChoice,
    type FrameRate,
} from "./detail";

/**
 * How finely a scene's drawn: chosen on the page (and kept between visits under `storageKey`), or left to Auto, which
 * follows the frame rate. Auto gives up after a few changes of direction, rather than keep flipping between two levels.
 *
 * Give `onFrameRate` to the 3D view (it's set only while Auto's chosen), and call `poke` whenever a flat view moves, to
 * time how fast it redraws.
 */
export function useDetail(storageKey: string) {
    const inBrowser = useInBrowser();
    // The saved choice until one's made on the page (read once it's in the browser, where it's kept).
    const [picked, setPicked] = useState<DetailChoice | null>(null);
    const choice = picked ?? (inBrowser ? loadChoice(storageKey) : "auto");
    const choiceRef = useRef<DetailChoice>("auto");
    useEffect(() => {
        choiceRef.current = choice;
    }, [choice]);
    const choose = (c: DetailChoice) => {
        setPicked(c);
        saveChoice(storageKey, c);
    };
    const [auto, setAuto] = useState<Detail>(AUTO_START);
    const flips = useRef<{ last: FrameRate | null; count: number }>({ last: null, count: 0 });
    const onFrameRate = useCallback((rate: FrameRate) => {
        if (choiceRef.current !== "auto") return;
        const f = flips.current;
        if (f.count >= FLIPS) return;
        if (f.last && f.last !== rate) f.count++;
        f.last = rate;
        setAuto((d) => stepDetail(d, rate));
    }, []);
    // The flat views' frame rate, timed while they're being moved or zoomed (when they redraw).
    const watch = useRef({ busyUntil: 0, running: false, last: 0, intervals: [] as number[] });
    const poke = useCallback(() => {
        const w = watch.current;
        w.busyUntil = performance.now() + 300;
        if (w.running) return;
        w.running = true;
        w.last = performance.now();
        const tick = (t: number) => {
            w.intervals.push(t - w.last);
            w.last = t;
            if (w.intervals.length >= 40) {
                const rate = judge(w.intervals);
                w.intervals = [];
                if (rate) onFrameRate(rate);
            }
            if (t < w.busyUntil) requestAnimationFrame(tick);
            else w.running = false;
        };
        requestAnimationFrame(tick);
    }, [onFrameRate]);
    return {
        /** What's chosen: Auto or a level. */
        choice,
        choose,
        /** The level Auto's at now. */
        auto,
        /** The level it's drawn at. */
        detail: choice === "auto" ? auto : choice,
        onFrameRate: choice === "auto" ? onFrameRate : undefined,
        poke,
    };
}

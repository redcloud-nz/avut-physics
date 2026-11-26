import { useEffect, useRef, type RefObject } from "react";

import { vec2, type Vector2 } from "@/lib/vector2";

/** How far two fingers, or a trackpad's swipe, go sideways (pixels) to move on to the next target. */
const SWIPE = 60;

/**
 * Swiping sideways with two fingers over `box` moves on to the next target (or back), by calling `step` with 1 or −1:
 * on a trackpad, a sideways scroll, in any view; on a touch screen, two fingers moving together, only when `locked`
 * onto a target (otherwise they move the view). Each swipe moves one target, however far it goes. Nothing while
 * `standing` somewhere, where there's no next one.
 */
export function useTargetSwipe(
    box: RefObject<HTMLElement | null>,
    o: { step: (by: number) => void; locked: boolean; standing: boolean },
) {
    // The latest of these, for the events watched from outside React's.
    const latest = useRef(o);
    useEffect(() => {
        latest.current = o;
    });
    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const wheel = { sum: 0, last: 0, done: false };
        const onWheel = (e: WheelEvent) => {
            if (latest.current.standing) return;
            if (e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
            // Not to the 3D view's zoom, the drawing's, or the browser's back and forward.
            e.preventDefault();
            e.stopPropagation();
            // A pause ends one swipe, so its momentum doesn't carry on to another.
            if (e.timeStamp - wheel.last > 250) Object.assign(wheel, { sum: 0, done: false });
            wheel.last = e.timeStamp;
            wheel.sum += e.deltaX;
            if (!wheel.done && Math.abs(wheel.sum) > SWIPE) {
                wheel.done = true;
                latest.current.step(Math.sign(wheel.sum));
            }
        };
        const touches = new Map<number, Vector2>();
        let swipe: { mid: Vector2; spread: number; done: boolean } | null = null;
        const both = () => {
            const [a, b] = [...touches.values()];
            return { mid: a.mid(b), spread: a.distanceTo(b) };
        };
        const onDown = (e: PointerEvent) => {
            if (e.pointerType !== "touch") return;
            touches.set(e.pointerId, vec2(e.clientX, e.clientY));
            swipe = touches.size === 2 ? { ...both(), done: false } : null;
        };
        const onMove = (e: PointerEvent) => {
            if (!touches.has(e.pointerId)) return;
            touches.set(e.pointerId, vec2(e.clientX, e.clientY));
            if (!swipe || swipe.done || touches.size !== 2 || !latest.current.locked) return;
            const now = both();
            const d = now.mid.sub(swipe.mid);
            const spreading = Math.abs(now.spread / Math.max(swipe.spread, 1) - 1);
            if (Math.abs(d.x) > SWIPE && Math.abs(d.x) > 2 * Math.abs(d.y) && spreading < 0.25) {
                swipe.done = true;
                // Fingers moving left bring on the next, as turning a page.
                latest.current.step(d.x < 0 ? 1 : -1);
            }
        };
        const onUp = (e: PointerEvent) => {
            touches.delete(e.pointerId);
            if (touches.size < 2) swipe = null;
        };
        const opts = { capture: true };
        el.addEventListener("wheel", onWheel, { capture: true, passive: false });
        el.addEventListener("pointerdown", onDown, opts);
        el.addEventListener("pointermove", onMove, opts);
        el.addEventListener("pointerup", onUp, opts);
        el.addEventListener("pointercancel", onUp, opts);
        return () => {
            el.removeEventListener("wheel", onWheel, opts);
            el.removeEventListener("pointerdown", onDown, opts);
            el.removeEventListener("pointermove", onMove, opts);
            el.removeEventListener("pointerup", onUp, opts);
            el.removeEventListener("pointercancel", onUp, opts);
        };
    }, [box]);
}

"use client";

import { useEffect, useRef } from "react";

import { clamp } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";
import { Note, SVG } from "@/visual/frame";

/*
 * Forces on a bolt, drawn as arrows on a grid of 1 kN squares, for the pages on arrows.
 */

/** One kilonewton, in drawing units: a square of the grid. */
export const KN = 30;
export const ORIGIN = vec2(150, 150);

/** An arrow from the bolt to `tip`, in kilonewtons with up positive. */
export const kn = (tip: Vector2) => vec2((tip.x - ORIGIN.x) / KN, (ORIGIN.y - tip.y) / KN);
export const kNText = (v: number) => `${v.toFixed(1)} kN`;

/** What a tip says to a screen reader: where its arrow points, and how to move it. */
function tipLabel(i: number, count: number, f: Vector2) {
    const across = `${kNText(Math.abs(f.x))} ${f.x < 0 ? "left" : "right"}`;
    const up = `${kNText(Math.abs(f.y))} ${f.y < 0 ? "down" : "up"}`;
    return `${count > 1 ? `Arrow ${i + 1}` : "The arrow"}: ${across}, ${up}. Move its tip with the arrow keys.`;
}

/** How near a tip a touch has to start to drag it (half a square either way of the tip's own circle). */
const TOUCH_REACH = 14 + KN / 2;

/** How far in from the grid's edge a tip has to stay, so its arrowhead is drawn whole. */
const MARGIN = 12;

/** Whether a point is far enough inside the grid for an arrow ending there to be drawn whole. */
export const onGrid = (p: Vector2) =>
    p.x >= MARGIN && p.x <= 300 - MARGIN && p.y >= MARGIN && p.y <= 300 - MARGIN;

/**
 * Forces on a bolt, drawn on a grid of 1 kN squares, with arrow tips that can be dragged. A mouse drag moves whichever
 * tip is nearest where it starts; a touch has to start near a tip, so a swipe elsewhere still scrolls the page. Each
 * tip also takes focus and moves with the arrow keys. `children` draws the arrows from the tips. `fits` says whether
 * the arrows drawn from a set of tips all stay on the grid; a move that would take them off stops where they still
 * fit.
 */
export function DragGrid(props: {
    tips: Vector2[];
    onChange: (tips: Vector2[]) => void;
    label: string;
    fits?: (tips: Vector2[]) => boolean;
    children: React.ReactNode;
}) {
    const svg = useRef<SVGSVGElement>(null);
    const dragging = useRef<number | null>(null);
    // The tips as last drawn, for the touch listener below, which isn't redrawn with them.
    const tips = useRef(props.tips);
    useEffect(() => {
        tips.current = props.tips;
    });

    const toGrid = (clientX: number, clientY: number) => {
        const m = svg.current?.getScreenCTM();
        if (!m) return null;
        const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
        return vec2(p.x, p.y);
    };
    const nearest = (p: Vector2) => {
        const near = props.tips.map((t) => t.distanceTo(p));
        return near.indexOf(Math.min(...near));
    };

    /** Tip i moved towards p, snapped to tenths of a kilonewton, as far as the arrows still fit. */
    const moveTip = (i: number, p: Vector2) => {
        const snap = (v: number) =>
            Math.round(clamp(v, MARGIN, 300 - MARGIN) / (KN / 10)) * (KN / 10);
        const from = props.tips[i];
        // The tips with tip i moved a fraction `f` of the way from where it is to p.
        const at = (f: number) => {
            const q = from.add(p.sub(from).scale(f));
            return props.tips.map((t, j) => (j === i ? vec2(snap(q.x), snap(q.y)) : t));
        };
        const fits = props.fits ?? (() => true);
        if (fits(at(1))) return props.onChange(at(1));
        // Otherwise go as far towards p as still fits.
        let [lo, hi] = [0, 1];
        for (let n = 0; n < 20; n++) {
            const mid = (lo + hi) / 2;
            if (fits(at(mid))) lo = mid;
            else hi = mid;
        }
        if (lo > 0) props.onChange(at(lo));
    };
    const move = (e: React.PointerEvent) => {
        const p = toGrid(e.clientX, e.clientY);
        if (p && dragging.current !== null) moveTip(dragging.current, p);
    };

    // A touch starting near a tip drags it, so the page mustn't scroll; anywhere else it may. Only a listener that
    // isn't passive can stop the scroll, and React's are.
    useEffect(() => {
        const el = svg.current;
        if (!el) return;
        const onTouch = (e: TouchEvent) => {
            const m = el.getScreenCTM();
            const t = e.touches[0];
            if (!m || !t) return;
            const p = new DOMPoint(t.clientX, t.clientY).matrixTransform(m.inverse());
            if (tips.current.some((tip) => tip.distanceTo(vec2(p.x, p.y)) <= TOUCH_REACH))
                e.preventDefault();
        };
        el.addEventListener("touchstart", onTouch, { passive: false });
        return () => el.removeEventListener("touchstart", onTouch);
    }, []);

    return (
        <svg
            ref={svg}
            viewBox="0 0 300 300"
            className={`${SVG} select-none`}
            fontSize={14}
            role="group"
            aria-label={props.label}
            data-no-swipe
            onPointerDown={(e) => {
                const p = toGrid(e.clientX, e.clientY);
                if (!p) return;
                const i = nearest(p);
                if (e.pointerType === "touch" && props.tips[i].distanceTo(p) > TOUCH_REACH) return;
                dragging.current = i;
                e.currentTarget.setPointerCapture(e.pointerId);
                move(e);
            }}
            onPointerMove={move}
            onPointerUp={() => (dragging.current = null)}
            onPointerCancel={() => (dragging.current = null)}
        >
            {Array.from({ length: 11 }, (_, i) => (
                <g key={i} className="stroke-surface-raised">
                    <line x1={i * KN} y1={0} x2={i * KN} y2={300} />
                    <line x1={0} y1={i * KN} x2={300} y2={i * KN} />
                </g>
            ))}
            <Note at={vec2(KN / 2, 300 - KN / 2)}>1 kN</Note>
            {props.children}
            <circle cx={ORIGIN.x} cy={ORIGIN.y} r={5} fill="currentColor" />
            {props.tips.map((t, i) => {
                const f = kn(t);
                return (
                    <circle
                        key={i}
                        cx={t.x}
                        cy={t.y}
                        r={14}
                        fill="var(--ink-muted)"
                        opacity={0.2}
                        className="cursor-grab outline-none focus-visible:opacity-60"
                        tabIndex={0}
                        role="button"
                        data-arrow-keys
                        aria-label={tipLabel(i, props.tips.length, f)}
                        onKeyDown={(e) => {
                            const step = {
                                ArrowLeft: [-1, 0],
                                ArrowRight: [1, 0],
                                ArrowUp: [0, -1],
                                ArrowDown: [0, 1],
                            }[e.key];
                            if (!step) return;
                            e.preventDefault();
                            moveTip(i, t.add(vec2(step[0], step[1]).scale(KN / 10)));
                        }}
                    />
                );
            })}
        </svg>
    );
}

/** What to do with a drag grid, under it: drag the one arrow's tip, or `either` of two. */
export const dragHint = (either = false) => (
    <p className="text-center text-sm text-ink-muted">
        Drag {either ? "either" : "the"} arrow’s tip.
    </p>
);

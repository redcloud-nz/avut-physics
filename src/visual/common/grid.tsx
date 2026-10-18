import { useRef } from "react";

import { clamp } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";
import { Note, SVG } from "@/visual/frame";

/*
 * Pulls on a bolt, drawn as arrows on a grid of 1 kN squares, for the pages on arrows.
 */

/** One kilonewton, in drawing units: a square of the grid. */
export const KN = 30;
export const ORIGIN = vec2(150, 150);

/** An arrow from the bolt to `tip`, in kilonewtons with up positive. */
export const kn = (tip: Vector2) => vec2((tip.x - ORIGIN.x) / KN, (ORIGIN.y - tip.y) / KN);
export const kNText = (v: number) => `${v.toFixed(1)} kN`;

/**
 * Pulls on a bolt, drawn on a grid of 1 kN squares, with arrow tips that can be dragged. A drag moves whichever tip
 * is nearest where it starts. `children` draws the arrows from the tips.
 */
export function DragGrid(props: {
    tips: Vector2[];
    onChange: (tips: Vector2[]) => void;
    label: string;
    children: React.ReactNode;
}) {
    const svg = useRef<SVGSVGElement>(null);
    const dragging = useRef<number | null>(null);

    const point = (e: React.PointerEvent) => {
        const m = svg.current?.getScreenCTM();
        if (!m) return null;
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
        return vec2(p.x, p.y);
    };
    const move = (e: React.PointerEvent) => {
        const p = point(e);
        if (!p || dragging.current === null) return;
        // Snap to tenths of a kilonewton, and keep the tip on the grid.
        const snap = (v: number) => Math.round(clamp(v, 12, 288) / (KN / 10)) * (KN / 10);
        const i = dragging.current;
        props.onChange(props.tips.map((t, j) => (j === i ? vec2(snap(p.x), snap(p.y)) : t)));
    };

    return (
        <svg
            ref={svg}
            viewBox="0 0 300 300"
            className={`${SVG} touch-none select-none`}
            fontSize={14}
            role="img"
            aria-label={props.label}
            data-no-swipe
            onPointerDown={(e) => {
                const p = point(e);
                if (!p) return;
                const near = props.tips.map((t) => t.distanceTo(p));
                dragging.current = near.indexOf(Math.min(...near));
                e.currentTarget.setPointerCapture(e.pointerId);
                move(e);
            }}
            onPointerMove={move}
            onPointerUp={() => (dragging.current = null)}
            onPointerCancel={() => (dragging.current = null)}
        >
            {Array.from({ length: 11 }, (_, i) => (
                <g key={i} className="stroke-slate-800">
                    <line x1={i * KN} y1={0} x2={i * KN} y2={300} />
                    <line x1={0} y1={i * KN} x2={300} y2={i * KN} />
                </g>
            ))}
            <Note at={vec2(KN / 2, 300 - KN / 2)}>1 kN</Note>
            {props.children}
            <circle cx={ORIGIN.x} cy={ORIGIN.y} r={5} fill="currentColor" />
            {props.tips.map((t, i) => (
                <circle
                    key={i}
                    cx={t.x}
                    cy={t.y}
                    r={14}
                    fill="#94a3b8"
                    opacity={0.2}
                    className="cursor-grab"
                />
            ))}
        </svg>
    );
}

export const DRAG_HINT = (
    <p className="text-center text-sm text-slate-400">Drag the arrow’s tip.</p>
);

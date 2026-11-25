import { useEffect, useRef, useState } from "react";

import { clamp } from "@/lib/math";
import type { OrbitCamera } from "@/lib/orbit-camera";
import { vec2, type Vector2 } from "@/lib/vector2";
import type { Vector3 } from "@/lib/vector3";

/**
 * A flat view of a 3D scene (a side elevation, an overhead view), drawn in SVG and moved like a map: dragged to pan,
 * scrolled or pinched to zoom. The drawing fills its box, taking the box's shape, and is never smaller than `least`.
 */

/** How close a flat view is, and the scene point at the middle of the drawing. */
export type FlatFrame = { zoom: number; target: Vector3 };

/** A box to fit in the view: its middle, and how wide and high it is as the camera sees it (metres). */
export type Fit = { centre: Vector3; width: number; height: number };

export type FlatViewOptions = {
    /** Looking at the scene from (a camera made once, as in `useMemo`). */
    camera: OrbitCamera;
    /** The least room the drawing needs (SVG units); it widens or deepens past it to fill its box. */
    least: Vector2;
    /** SVG units per metre at zoom 1. */
    ppm: number;
    /** How far a view may zoom in, and the least zoom it may start at. */
    zoom: { most: number; leastStart: number };
    /** What the view starts fitted to. */
    fit: Fit;
    /** How far below the drawing's middle the view's middle is (SVG units). */
    drop?: number;
    /** How far out a view may zoom, in a drawing `size`: `zoom.leastStart` unless given. */
    leastZoom?: (size: Vector2) => number;
    /** Where the view's middle may go: `target` brought back within bounds. Anywhere unless given. */
    keepIn?: (target: Vector3) => Vector3;
    /** Zoom about the middle rather than the pointer, and pan only if `pan`: as when locked onto something. */
    locked?: { pan: boolean };
    /** The view goes back to its start whenever this changes (a different view, or a different thing locked onto). */
    resetKey: string;
    /** Told whenever the view's moved or zoomed, as for timing how fast it redraws. */
    onMove?: () => void;
    /** Told of a click (a press and release that barely moved), where it was in the drawing. */
    onClick?: (at: Vector2) => void;
};

/** How far a pointer may move (SVG units) and still count as a click rather than a drag. */
const CLICK = 6;

/** The point under `clientX`, `clientY` in `svg`'s own units. */
export function toDrawing(svg: SVGSVGElement, clientX: number, clientY: number): Vector2 {
    const m = svg.getScreenCTM();
    if (!m) return vec2(clientX, clientY);
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return vec2(p.x, p.y);
}

/** The drawing's size (SVG units) for a box `width` by `height` (pixels): at least `least`, in the box's shape. */
export function drawingSize(least: Vector2, width: number, height: number): Vector2 {
    const [W, H] = [least.x, least.y];
    if (width <= 0 || height <= 0) return vec2(W, H);
    return width / height > W / H ? vec2((H * width) / height, H) : vec2(W, (W * height) / width);
}

/** The zoom that fits `fit` in a drawing `size`, at `ppm` SVG units a metre, kept from `lo` to `hi`. */
export function zoomToFit(fit: Fit, size: Vector2, ppm: number, lo: number, hi: number): number {
    return clamp(Math.min(size.x / fit.width, size.y / fit.height) / ppm, lo, hi);
}

/** The middle of the view in a drawing `size`. */
const originOf = (size: Vector2, drop: number) => vec2(size.x / 2, size.y / 2 + drop);

type Gesture =
    | { kind: "pan"; at: Vector2; frame: FlatFrame }
    | { kind: "pinch"; mid: Vector2; spread: number; frame: FlatFrame };

/**
 * A flat view's state and its pointer and wheel handling. Give `boxRef` to the element the drawing fills, `svgRef` and
 * `handlers` to the `<svg>`, and draw with `toSvg` and `ppm`.
 */
export function useFlatView(o: FlatViewOptions) {
    const drop = o.drop ?? 0;
    const svgRef = useRef<SVGSVGElement>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState(o.least);
    // How the view's been moved from where it starts, for the view `key` names; another key starts afresh.
    const [moved, setMoved] = useState<{ key: string; frame: FlatFrame } | null>(null);

    const origin = originOf(size, drop);
    const startOf = (s: Vector2): FlatFrame => ({
        zoom: zoomToFit(o.fit, s, o.ppm, o.zoom.leastStart, o.zoom.most),
        target: o.fit.centre,
    });
    const start = startOf(size);
    const frame = moved?.key === o.resetKey ? moved.frame : start;
    const least = o.leastZoom ? o.leastZoom(size) : o.zoom.leastStart;
    const ppm = o.ppm * frame.zoom;
    const cam = o.camera;
    const toSvg = (p: Vector3): Vector2 => {
        const v = cam.project(p.sub(frame.target));
        return vec2(origin.x + v.x * ppm, origin.y - v.y * ppm);
    };

    /**
     * The frame that keeps the scene point that was under `from` (in `was`) under `to`, at `zoom`: zooming about a
     * point, panning, or both at once as in a pinch.
     */
    const reframe = (was: FlatFrame, from: Vector2, to: Vector2, zoom: number): FlatFrame => {
        const z = clamp(zoom, least, o.zoom.most);
        const inView = (s: Vector2, scale: number) =>
            vec2((s.x - origin.x) / scale, (origin.y - s.y) / scale);
        const [u, v] = [inView(from, o.ppm * was.zoom), inView(to, o.ppm * z)];
        const shift = cam.right.scale(u.x - v.x).add(cam.up.scale(u.y - v.y));
        const target = was.target.add(shift);
        return { zoom: z, target: o.keepIn ? o.keepIn(target) : target };
    };
    // The latest of all this for the wheel, which is listened to outside React's events. Its frame's updated as soon as
    // it's set, so wheel events arriving faster than it's drawn each carry on from the last.
    const latest = useRef({ frame, reframe, o });
    useEffect(() => {
        latest.current = { frame, reframe, o };
    });
    const setFrame = (f: FlatFrame) => {
        latest.current.frame = f;
        setMoved({ key: o.resetKey, frame: f });
    };

    // The drawing takes the shape of its box.
    useEffect(() => {
        const box = boxRef.current;
        if (!box) return;
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setSize(drawingSize(o.least, width, height));
        });
        observer.observe(box);
        return () => observer.disconnect();
        // The least size is fixed for a view.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Scrolling over the drawing zooms about the pointer, as does a trackpad pinch (a scroll with Ctrl). The page itself
    // never scrolls.
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const { frame, reframe, o } = latest.current;
            o.onMove?.();
            const at = o.locked ? null : toDrawing(svg, e.clientX, e.clientY);
            // A mouse wheel's notch is around 100 pixels (or 3 lines); a pinch's steps are much smaller.
            const delta = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
            const rate = e.ctrlKey ? 0.01 : 0.0025;
            const about = at ?? originOf(size, o.drop ?? 0);
            const next = reframe(frame, about, about, frame.zoom * Math.exp(-delta * rate));
            latest.current.frame = next;
            setMoved({ key: o.resetKey, frame: next });
        };
        svg.addEventListener("wheel", onWheel, { passive: false });
        return () => svg.removeEventListener("wheel", onWheel);
    }, [size]);

    // The pointers down on the drawing, where each is now (SVG units); what a drag or pinch started from; and where a
    // single pointer went down, to tell a click from a drag.
    const pointers = useRef(new Map<number, Vector2>());
    const gesture = useRef<Gesture | null>(null);
    const pressed = useRef<Vector2 | null>(null);
    const drag = (at: Vector2): Gesture => ({ kind: "pan", at, frame });
    const startPinch = () => {
        const [a, b] = [...pointers.current.values()];
        gesture.current = { kind: "pinch", mid: a.mid(b), spread: a.distanceTo(b), frame };
    };

    const handlers = {
        onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const at = toDrawing(e.currentTarget, e.clientX, e.clientY);
            pointers.current.set(e.pointerId, at);
            pressed.current = pointers.current.size === 1 ? at : null;
            if (pointers.current.size === 2) startPinch();
            else if (pointers.current.size > 2) return;
            else gesture.current = drag(at);
        },
        onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => {
            if (gesture.current) o.onMove?.();
            if (!pointers.current.has(e.pointerId)) return;
            const at = toDrawing(e.currentTarget, e.clientX, e.clientY);
            pointers.current.set(e.pointerId, at);
            const d = gesture.current;
            if (!d) return;
            if (d.kind === "pinch") {
                if (pointers.current.size !== 2) return;
                const [a, b] = [...pointers.current.values()];
                const zoom = d.frame.zoom * (a.distanceTo(b) / Math.max(d.spread, 1));
                // Locked onto something, it zooms about the middle and doesn't move.
                const [from, to] = o.locked ? [origin, origin] : [d.mid, a.mid(b)];
                setFrame(reframe(d.frame, from, to, zoom));
                return;
            }
            if (o.locked && !o.locked.pan) return;
            setFrame(reframe(d.frame, d.at, at, d.frame.zoom));
        },
        onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => {
            const at = toDrawing(e.currentTarget, e.clientX, e.clientY);
            const click =
                e.type === "pointerup" &&
                pressed.current !== null &&
                pressed.current.distanceTo(at) < CLICK;
            if (click) o.onClick?.(at);
            pressed.current = null;
            pointers.current.delete(e.pointerId);
            // Lifting one finger of a pinch carries on as a drag with the other, from where it is.
            const [rest] = [...pointers.current.entries()];
            gesture.current = null;
            if (pointers.current.size === 2) startPinch();
            else if (rest && e.pointerType === "touch") gesture.current = drag(rest[1]);
        },
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    };

    return {
        svgRef,
        boxRef,
        size,
        origin,
        frame,
        ppm,
        toSvg,
        least,
        /** Whether it's zoomed in or out as far as it goes. */
        nearest: frame.zoom >= o.zoom.most,
        furthest: frame.zoom <= least,
        zoomBy: (factor: number) => setFrame(reframe(frame, origin, origin, frame.zoom * factor)),
        reset: () => setMoved(null),
        handlers: { ...handlers, onPointerCancel: handlers.onPointerUp },
    };
}

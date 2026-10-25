"use client";

/**
 * The drawing in the middle of the editor: the picture being edited, with its handles, panned by dragging the
 * background and zoomed with the wheel (about the pointer) or the View menu.
 *
 * Pointer events are all handled here, on the SVG, from what they land on (`hitAt`). A drag reads the pointer from
 * its events and applies at most one change per animation frame, under one history entry from its begin to its end.
 * The pointer's position isn't kept in state, so a plain move re-renders nothing.
 */
import {
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type PointerEvent as ReactPointerEvent,
    type Ref,
} from "react";

import type { Cubic } from "@/lib/bezier";
import { clamp, deg } from "@/lib/math";
import { Vector2 } from "@/lib/vector2";

import { pictureCrossings, strandPaths } from "./crossing-geometry";
import { insertPin, movePin, setPinAngle, setTensions } from "./edits";
import type { Picture, PinRef, SegmentRef } from "./format";
import { pictureGeometry, type PictureGeometry } from "./geometry";
import { hitAt, PinHandle, PinTools, SegmentHandle } from "./handles";
import { PictureDrawing } from "./picture-drawing";
import { kindOf } from "./props";
import { NOTHING, type EditorAction, type Selection } from "./state";
import type { ReadoutStore } from "./status-bar";

/** The picture's geometry, worked out from the last picture's where it can be. */
export function useGeometry(picture: Picture): PictureGeometry {
    const [last, setLast] = useState(() => ({ picture, geometry: pictureGeometry(picture) }));
    if (last.picture === picture) return last.geometry;
    // Kept as state, set while rendering, as React allows for state that follows a prop.
    const next = { picture, geometry: pictureGeometry(picture, last.geometry) };
    setLast(next);
    return next.geometry;
}

const point = (p: Vector2) => `${Math.round(p.x * 1e4) / 1e4} ${Math.round(p.y * 1e4) / 1e4}`;
const curve = (c: Cubic) => `M ${point(c.p0)} C ${point(c.p1)} ${point(c.p2)} ${point(c.p3)}`;

/**
 * Warnings on the drawing: ropes' bends tighter than `TIGHTEST_BEND` shaded (when shown), and a red line along each
 * locked segment that can't meet its length.
 */
function Warnings(props: { geometry: PictureGeometry; bends: boolean }) {
    return props.geometry.strands.flatMap((strand, i) =>
        strand.segments.flatMap((seg, k) => [
            ...(props.bends ? seg.bends : []).map(([t0, t1], j) => (
                <path
                    key={`${i}-${k}-bend-${j}`}
                    d={curve(seg.cubic.between(t0, t1))}
                    fill="none"
                    stroke="var(--warning)"
                    strokeOpacity={0.55}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                />
            )),
            ...(seg.lock && seg.lock.kind !== "ok"
                ? [
                      <path
                          key={`${i}-${k}-lock`}
                          d={curve(seg.cubic)}
                          fill="none"
                          stroke="var(--danger)"
                          strokeWidth={0.45}
                          strokeLinecap="round"
                      />,
                  ]
                : []),
        ]),
    );
}

/** What the editor can ask of the canvas: the View menu's zooms, and where the middle of the view is. */
export type CanvasControls = {
    zoom(factor: number): void;
    fit(): void;
    centre(): Vector2;
};

/** Where the view is centred (diameters) and how big a diameter is drawn (pixels). */
type View = { cx: number; cy: number; scale: number };
type Size = { w: number; h: number };

/** How far round the picture the fitted view leaves (diameters), and how far the view zooms each way. */
const MARGIN = 3;
const [LEAST_SCALE, MOST_SCALE] = [1, 400];
/** How far (pixels) the pointer moves before a press becomes a drag. */
const DRAG = 3;

/** The view taking in every strand and prop. */
function fitted(picture: Picture, geometry: PictureGeometry, size: Size): View {
    const boxes = [
        ...geometry.strands.flatMap((strand) => strand.segments.map((seg) => seg.box)),
        ...picture.props.map((prop) => kindOf(prop).bounds(prop)),
    ];
    if (!boxes.length) return { cx: 0, cy: 0, scale: 20 };
    const x0 = Math.min(...boxes.map((b) => b.min.x)) - MARGIN;
    const x1 = Math.max(...boxes.map((b) => b.max.x)) + MARGIN;
    const y0 = Math.min(...boxes.map((b) => b.min.y)) - MARGIN;
    const y1 = Math.max(...boxes.map((b) => b.max.y)) + MARGIN;
    return {
        cx: (x0 + x1) / 2,
        cy: (y0 + y1) / 2,
        scale: clamp(Math.min(size.w / (x1 - x0), size.h / (y1 - y0)), LEAST_SCALE, MOST_SCALE),
    };
}

/** A drag under way. `from` is where it began (client pixels), and `moved` whether it's become a drag yet. */
type Gesture = { from: { x: number; y: number }; moved: boolean } & (
    | { kind: "pan"; view: View; additive: boolean }
    | { kind: "pins"; refs: PinRef[]; origins: Vector2[]; start: Vector2 }
    | { kind: "angle"; ref: PinRef; centre: Vector2 }
    | {
          kind: "tension";
          segment: SegmentRef;
          end: 0 | 1;
          pin: Vector2;
          direction: Vector2;
          tension: [number, number];
          distance: number;
      }
);

const same = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1];
const rounded = (v: number, step: number) => Math.round(v / step) * step;

export function Canvas(props: {
    picture: Picture;
    geometry: PictureGeometry;
    selection: Selection;
    dispatch: Dispatch<EditorAction>;
    show: { pinNumbers: boolean; handles: boolean; bendWarnings: boolean };
    /** Where the canvas puts the pointer's position and the zoom, for the status bar. */
    readouts: ReadoutStore;
    ref?: Ref<CanvasControls>;
}) {
    const { picture, geometry, selection, dispatch, show, readouts, ref } = props;
    const svg = useRef<SVGSVGElement>(null);
    const [size, setSize] = useState<Size | null>(null);
    const [view, setView] = useState<View | null>(null);

    const scale = view?.scale;
    useEffect(() => readouts.set({ scale }), [readouts, scale]);

    const latest = useRef({ picture, geometry, selection, view, size });
    useEffect(() => {
        latest.current = { picture, geometry, selection, view, size };
    });

    // The panel's size, and the view fitted to the picture once it's known.
    useEffect(() => {
        const element = svg.current!;
        const observer = new ResizeObserver(() => {
            const next = { w: element.clientWidth, h: element.clientHeight };
            setSize(next);
            setView((v) => v ?? fitted(latest.current.picture, latest.current.geometry, next));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            zoom: (factor) =>
                setView(
                    (v) => v && { ...v, scale: clamp(v.scale * factor, LEAST_SCALE, MOST_SCALE) },
                ),
            fit: () => {
                const { picture, geometry, size } = latest.current;
                if (size) setView(fitted(picture, geometry, size));
            },
            centre: () => {
                const v = latest.current.view;
                return v ? new Vector2(v.cx, v.cy) : Vector2.ZERO;
            },
        }),
        [],
    );

    // The wheel zooms about the pointer. It's listened for directly, since React's wheel listener can't stop the
    // page zooming on a pinch.
    useEffect(() => {
        const element = svg.current!;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = element.getBoundingClientRect();
            const [dx, dy] = [
                e.clientX - rect.left - rect.width / 2,
                e.clientY - rect.top - rect.height / 2,
            ];
            const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002));
            setView((v) => {
                if (!v) return v;
                const scale = clamp(v.scale * factor, LEAST_SCALE, MOST_SCALE);
                const [x, y] = [v.cx + dx / v.scale, v.cy + dy / v.scale];
                return { scale, cx: x - dx / scale, cy: y - dy / scale };
            });
        };
        element.addEventListener("wheel", onWheel, { passive: false });
        return () => element.removeEventListener("wheel", onWheel);
    }, []);

    const gesture = useRef<Gesture | null>(null);
    const pointer = useRef<{ x: number; y: number } | null>(null);
    const frame = useRef<number | null>(null);

    /** A point on the screen (client pixels) in the picture (diameters). */
    const toPicture = (x: number, y: number) => {
        const rect = svg.current!.getBoundingClientRect();
        const v = latest.current.view!;
        return new Vector2(
            v.cx + (x - rect.left - rect.width / 2) / v.scale,
            v.cy + (y - rect.top - rect.height / 2) / v.scale,
        );
    };

    /** The drag's change for where the pointer is now: one per animation frame at most. */
    const apply = () => {
        frame.current = null;
        const [g, p] = [gesture.current, pointer.current];
        if (!g || !p) return;
        if (!g.moved) {
            if (Math.hypot(p.x - g.from.x, p.y - g.from.y) < DRAG) return;
            g.moved = true;
            if (g.kind !== "pan") dispatch({ type: "begin-drag" });
        }
        if (g.kind === "pan") {
            const { view: v } = g;
            setView({
                ...v,
                cx: v.cx - (p.x - g.from.x) / v.scale,
                cy: v.cy - (p.y - g.from.y) / v.scale,
            });
            return;
        }
        const at = toPicture(p.x, p.y);
        if (g.kind === "pins") {
            const d = at.sub(g.start);
            dispatch({
                type: "edit",
                edit: (q) =>
                    g.refs.reduce(
                        (pic, ref, k) =>
                            movePin(
                                pic,
                                ref,
                                rounded(g.origins[k].x + d.x, 1e-3),
                                rounded(g.origins[k].y + d.y, 1e-3),
                            ),
                        q,
                    ),
            });
        } else if (g.kind === "angle") {
            const angle = rounded(deg(at.sub(g.centre).angle()), 0.1);
            dispatch({ type: "edit", edit: (q) => setPinAngle(q, g.ref, angle) });
        } else {
            const along = (g.end === 0 ? at.sub(g.pin) : g.pin.sub(at)).dot(g.direction);
            const t = rounded((g.tension[g.end] * g.distance) / Math.max(along, 1e-3), 0.01);
            const tension: [number, number] = g.end === 0 ? [t, g.tension[1]] : [g.tension[0], t];
            dispatch({ type: "edit", edit: (q) => setTensions(q, g.segment, tension) });
        }
    };

    const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
        if (e.button !== 0 || !latest.current.view) return;
        const { picture, geometry, selection } = latest.current;
        const parts = selection.kind === "parts" ? selection : { pins: [], segments: [] };
        const hit = hitAt(e.target);
        const from = { x: e.clientX, y: e.clientY };
        const select = (pins: PinRef[], segments: SegmentRef[]) =>
            dispatch({ type: "select", selection: { kind: "parts", pins, segments } });
        let next: Gesture | null = null;
        if (hit.kind === "pin") {
            const selected = parts.pins.some((r) => same(r, hit.ref));
            if (e.shiftKey) {
                select(
                    selected
                        ? parts.pins.filter((r) => !same(r, hit.ref))
                        : [...parts.pins, hit.ref],
                    parts.segments,
                );
                return;
            }
            if (!selected) select([hit.ref], []);
            const refs = selected ? parts.pins : [hit.ref];
            const origins = refs.map(([i, k]) => {
                const pin = picture.strands[i].pins[k];
                return new Vector2(pin.x, pin.y);
            });
            next = {
                kind: "pins",
                refs,
                origins,
                start: toPicture(from.x, from.y),
                from,
                moved: false,
            };
        } else if (hit.kind === "segment") {
            const selected = parts.segments.some((r) => same(r, hit.ref));
            if (e.shiftKey)
                select(
                    parts.pins,
                    selected
                        ? parts.segments.filter((r) => !same(r, hit.ref))
                        : [...parts.segments, hit.ref],
                );
            else select([], [hit.ref]);
            return;
        } else if (hit.kind === "ring") {
            const pin = picture.strands[hit.ref[0]].pins[hit.ref[1]];
            next = {
                kind: "angle",
                ref: hit.ref,
                centre: new Vector2(pin.x, pin.y),
                from,
                moved: false,
            };
        } else if (hit.kind === "tension") {
            const [i, k] = hit.ref;
            const seg = geometry.strands[i].segments[k];
            const pinIndex = hit.end === 0 ? k : k + 1;
            const pin = hit.end === 0 ? seg.cubic.p0 : seg.cubic.p3;
            const control = hit.end === 0 ? seg.cubic.p1 : seg.cubic.p2;
            next = {
                kind: "tension",
                segment: hit.ref,
                end: hit.end,
                pin,
                direction: geometry.strands[i].directions[pinIndex],
                tension: seg.tension,
                distance: control.distanceTo(pin),
                from,
                moved: false,
            };
        } else {
            next = {
                kind: "pan",
                view: latest.current.view,
                additive: e.shiftKey,
                from,
                moved: false,
            };
        }
        gesture.current = next;
        pointer.current = from;
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
        if (latest.current.view) readouts.set({ pointer: toPicture(e.clientX, e.clientY) });
        if (!gesture.current) return;
        pointer.current = { x: e.clientX, y: e.clientY };
        if (frame.current === null) frame.current = requestAnimationFrame(apply);
    };

    const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
        if (frame.current !== null) {
            cancelAnimationFrame(frame.current);
            apply();
        }
        const g = gesture.current;
        gesture.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        if (!g) return;
        if (g.moved && g.kind !== "pan") dispatch({ type: "end-drag" });
        // A click on the background clears the selection (shift-click leaves it).
        if (g.kind === "pan" && !g.moved && !g.additive)
            dispatch({ type: "select", selection: NOTHING });
    };

    const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
        const hit = hitAt(e.target);
        const { geometry } = latest.current;
        if (hit.kind === "segment") {
            const [i, k] = hit.ref;
            const { t } = geometry.strands[i].segments[k].cubic.nearest(
                toPicture(e.clientX, e.clientY),
            );
            dispatch({ type: "edit", edit: (q) => insertPin(q, geometry, [i, k], t) });
            dispatch({
                type: "select",
                selection: { kind: "parts", pins: [[i, k + 1]], segments: [] },
            });
        } else if (hit.kind === "ring") {
            dispatch({ type: "edit", edit: (q) => setPinAngle(q, hit.ref, undefined) });
        }
    };

    const paths = useMemo(
        () => strandPaths(picture, geometry, pictureCrossings(picture, geometry)).paths,
        [picture, geometry],
    );

    const parts = selection.kind === "parts" ? selection : { pins: [], segments: [] };
    const isPin = (i: number, k: number) => parts.pins.some((r) => r[0] === i && r[1] === k);
    const isSegment = (i: number, k: number) =>
        parts.segments.some((r) => r[0] === i && r[1] === k);

    const ready = view && size;
    const px = view ? 1 / view.scale : 1;
    return (
        <svg
            ref={svg}
            className="size-full touch-none select-none"
            viewBox={
                ready
                    ? `${view.cx - size.w / 2 / view.scale} ${view.cy - size.h / 2 / view.scale} ${size.w / view.scale} ${size.h / view.scale}`
                    : undefined
            }
            role="img"
            aria-label="The picture being edited"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => readouts.set({ pointer: undefined })}
            onDoubleClick={onDoubleClick}
        >
            {ready && (
                <>
                    <g pointerEvents="none">
                        <PictureDrawing picture={picture} geometry={geometry} paths={paths} />
                        <Warnings geometry={geometry} bends={show.bendWarnings} />
                    </g>
                    {geometry.strands.map((strand, i) =>
                        strand.segments.map(({ cubic }, k) => (
                            <SegmentHandle
                                key={`${i}-${k}`}
                                strand={i}
                                segment={k}
                                d={curve(cubic)}
                                selected={isSegment(i, k)}
                                px={px}
                            />
                        )),
                    )}
                    {picture.strands.map((strand, i) =>
                        strand.pins.map((pin, k) => (
                            <PinHandle
                                key={`${i}-${k}`}
                                strand={i}
                                pin={k}
                                x={pin.x}
                                y={pin.y}
                                angle={pin.angle}
                                selected={isPin(i, k)}
                                number={show.pinNumbers ? k + 1 : undefined}
                                px={px}
                            />
                        )),
                    )}
                    {show.handles &&
                        parts.pins.map(([i, k]) => {
                            const strand = picture.strands[i];
                            const pin = strand?.pins[k];
                            if (!pin) return null;
                            const shape = geometry.strands[i];
                            const tensions = [
                                ...(k > 0
                                    ? [
                                          {
                                              segment: k - 1,
                                              end: 1 as const,
                                              at: shape.segments[k - 1].cubic.p2,
                                          },
                                      ]
                                    : []),
                                ...(k < strand.segments.length
                                    ? [
                                          {
                                              segment: k,
                                              end: 0 as const,
                                              at: shape.segments[k].cubic.p1,
                                          },
                                      ]
                                    : []),
                            ].map(({ segment, end, at }) => ({
                                segment,
                                end,
                                x: at.x,
                                y: at.y,
                                locked: strand.segments[segment].length !== undefined,
                            }));
                            return (
                                <PinTools
                                    key={`${i}-${k}`}
                                    strand={i}
                                    pin={k}
                                    x={pin.x}
                                    y={pin.y}
                                    direction={deg(shape.directions[k].angle())}
                                    held={pin.angle !== undefined}
                                    tensions={tensions}
                                    px={px}
                                />
                            );
                        })}
                </>
            )}
        </svg>
    );
}

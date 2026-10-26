"use client";

/**
 * The drawing in the middle of the editor: the picture being edited, with its handles, panned by dragging the
 * background and zoomed with the wheel (about the pointer) or the View menu, and kept on the knot as `view.ts` says.
 *
 * Pointer events are all handled here, on the SVG, from what they land on (`hitAt`). A drag reads the pointer from
 * its events and applies at most one change per animation frame, under one history entry from its begin to its end.
 * The pointer's position isn't kept in state, so a plain move re-renders nothing.
 */
import {
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    type Dispatch,
    type PointerEvent as ReactPointerEvent,
    type Ref,
} from "react";

import type { Cubic } from "@/lib/bezier";
import { deg } from "@/lib/math";
import { Vector2 } from "@/lib/vector2";

import type { PictureCrossings, StrandPaths } from "./crossing-geometry";
import { crossingLetter, CrossingMarks, type Mark } from "./crossings";
import {
    changeProp,
    draggedFrame,
    insertPin,
    movePin,
    setCrossing,
    setFrame,
    setPass,
    setPinAngle,
    setTensions,
    type FrameSides,
} from "./edits";
import type { Frame, Picture, PinRef, Prop, SegmentRef } from "./format";
import { FrameDrawing, FrameHandles } from "./frame";
import { pictureGeometry, type PictureGeometry } from "./geometry";
import { snappedFrame, snappedMove, snapStep } from "./grid";
import { GridDrawing, GridNumbers } from "./grid-drawing";
import { hitAt, PinHandle, PinTools, SegmentHandle } from "./handles";
import { headOf, leaderOf, pinPlaces } from "./ids";
import { PictureDrawing } from "./picture-drawing";
import { kindOf } from "./props";
import { NOTHING, type EditorAction, type Selection } from "./state";
import type { ReadoutStore } from "./status-bar";
import { bounded, fitted, pictureBox, type Size, type View } from "./view";

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
 * locked segment that can't meet its length, each as wide as goes with its strand's size.
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
                    strokeWidth={1.8 * seg.size}
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
                          strokeWidth={0.45 * seg.size}
                          strokeLinecap="round"
                      />,
                  ]
                : []),
        ]),
    );
}

/**
 * What the editor can ask of the canvas: the View menu's zooms, the status bar's (to a scale, in pixels per
 * millimetre), and where the middle of the view is. Both zoom about the middle.
 */
export type CanvasControls = {
    zoom(factor: number): void;
    setScale(scale: number): void;
    fit(): void;
    centre(): Vector2;
};

/** What a drag rounds places to (millimetres). */
const DRAG_STEP = 0.1;
/** How far (pixels) the pointer moves before a press becomes a drag. */
const DRAG = 3;

/** A drag under way. `from` is where it began (client pixels), and `moved` whether it's become a drag yet. */
type Gesture = { from: { x: number; y: number }; moved: boolean } & (
    | { kind: "pan"; view: View; additive: boolean }
    /** `anchor` is the pin picked up, which snapping puts on the grid. */
    | { kind: "pins"; refs: PinRef[]; origins: Vector2[]; anchor: number; start: Vector2 }
    | { kind: "prop"; index: number; origin: Prop; start: Vector2 }
    | { kind: "frame"; sides: FrameSides; origin: Frame; start: Vector2 }
    /** `turn` is how far the pin turned runs from the pin whose ring it is (a linked pin turns its chain's head). */
    | { kind: "angle"; ref: PinRef; centre: Vector2; turn: number }
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
/** A value rounded to a step (0.1 or 0.01), written as it reads: 0.3, not 0.30000000000000004. */
const rounded = (v: number, step: number) => Math.round(v / step) / Math.round(1 / step);

export function Canvas(props: {
    picture: Picture;
    /** The knot's frame, the same for every picture. */
    frame: Frame;
    geometry: PictureGeometry;
    crossings: PictureCrossings;
    /** Each strand's path, and which crossings and passes are too close, from `strandPaths`. */
    drawn: StrandPaths;
    selection: Selection;
    dispatch: Dispatch<EditorAction>;
    show: {
        pinNumbers: boolean;
        handles: boolean;
        crossings: boolean;
        bendWarnings: boolean;
        grid: boolean;
        /** Whether drags snap to the grid (whether or not it's shown). */
        snap: boolean;
    };
    /** Where the canvas puts the pointer's position and the zoom, for the status bar. */
    readouts: ReadoutStore;
    ref?: Ref<CanvasControls>;
}) {
    const {
        picture,
        frame: knotFrame,
        geometry,
        crossings,
        drawn,
        selection,
        dispatch,
        show,
    } = props;
    const { readouts, ref } = props;
    const svg = useRef<SVGSVGElement>(null);
    const [size, setSize] = useState<Size | null>(null);
    const [view, setView] = useState<View | null>(null);

    const scale = view?.scale;
    useEffect(() => readouts.set({ scale }), [readouts, scale]);

    const snap = show.snap;
    const latest = useRef({ picture, knotFrame, geometry, crossings, selection, view, size, snap });
    useEffect(() => {
        latest.current = { picture, knotFrame, geometry, crossings, selection, view, size, snap };
    });

    /** A view kept on the knot (see `view.ts`), for the canvas at this size. */
    const keep = (v: View, at = latest.current.size) => {
        const { picture, geometry, knotFrame } = latest.current;
        return at ? bounded(v, pictureBox(picture, geometry, knotFrame), knotFrame, at) : v;
    };
    const keepRef = useRef(keep);
    useEffect(() => {
        keepRef.current = keep;
    });

    // The panel's size, and the view fitted to the picture once it's known (and kept on it as the size changes).
    useEffect(() => {
        const element = svg.current!;
        const observer = new ResizeObserver(() => {
            const next = { w: element.clientWidth, h: element.clientHeight };
            setSize(next);
            setView((v) => {
                if (v) return keepRef.current(v, next);
                const { picture, geometry, knotFrame } = latest.current;
                return fitted(pictureBox(picture, geometry, knotFrame), knotFrame, next);
            });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            zoom: (factor) =>
                setView((v) => v && keepRef.current({ ...v, scale: v.scale * factor })),
            setScale: (scale) => setView((v) => v && keepRef.current({ ...v, scale })),
            fit: () => {
                const { picture, geometry, knotFrame, size } = latest.current;
                if (size)
                    setView(fitted(pictureBox(picture, geometry, knotFrame), knotFrame, size));
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
                const scale = keepRef.current({ ...v, scale: v.scale * factor }).scale;
                const [x, y] = [v.cx + dx / v.scale, v.cy + dy / v.scale];
                return keepRef.current({ scale, cx: x - dx / scale, cy: y - dy / scale });
            });
        };
        element.addEventListener("wheel", onWheel, { passive: false });
        return () => element.removeEventListener("wheel", onWheel);
    }, []);

    const gesture = useRef<Gesture | null>(null);
    const pointer = useRef<{ x: number; y: number } | null>(null);
    const frame = useRef<number | null>(null);

    /** A point on the screen (client pixels) in the picture (millimetres). */
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
            setView(
                keep({
                    ...v,
                    cx: v.cx - (p.x - g.from.x) / v.scale,
                    cy: v.cy - (p.y - g.from.y) / v.scale,
                }),
            );
            return;
        }
        const at = toPicture(p.x, p.y);
        // Onto the finest lines drawn at the zoom the drag is made at.
        const { snap } = latest.current;
        const step = snapStep(latest.current.view!.scale);
        if (g.kind === "pins") {
            const pulled = at.sub(g.start);
            const d = snap ? snappedMove(g.origins[g.anchor], pulled, step) : pulled;
            dispatch({
                type: "edit",
                edit: (q) =>
                    g.refs.reduce(
                        (pic, ref, k) =>
                            movePin(
                                pic,
                                ref,
                                rounded(g.origins[k].x + d.x, DRAG_STEP),
                                rounded(g.origins[k].y + d.y, DRAG_STEP),
                            ),
                        q,
                    ),
            });
        } else if (g.kind === "prop") {
            const pulled = at.sub(g.start);
            const box = kindOf(g.origin).bounds(g.origin);
            const d = snap ? snappedMove(box.min.add(box.max).scale(0.5), pulled, step) : pulled;
            const by = new Vector2(rounded(d.x, DRAG_STEP), rounded(d.y, DRAG_STEP));
            const { index, origin } = g;
            dispatch({
                type: "edit",
                edit: (q) => changeProp(q, index, () => kindOf(origin).moved(origin, by)),
            });
        } else if (g.kind === "frame") {
            const d = at.sub(g.start);
            const by = new Vector2(rounded(d.x, DRAG_STEP), rounded(d.y, DRAG_STEP));
            const { sides, origin } = g;
            const dragged = draggedFrame(origin, sides, by);
            const moved = snap ? snappedFrame(dragged, sides, step) : dragged;
            const rect = {
                x: rounded(moved.x, DRAG_STEP),
                y: rounded(moved.y, DRAG_STEP),
                w: rounded(moved.w, DRAG_STEP),
                h: rounded(moved.h, DRAG_STEP),
            };
            dispatch({ type: "edit-file", edit: (f) => setFrame(f, rect) });
        } else if (g.kind === "angle") {
            const angle = rounded(deg(at.sub(g.centre).angle()) + g.turn, 0.1);
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
            // A linked pin is moved by moving the free pin heading its chain, which takes it along.
            const places = pinPlaces(picture);
            const heads = (selected ? parts.pins : [hit.ref]).map((r) =>
                headOf(picture, r, places),
            );
            const refs = heads.filter((r, k) => heads.findIndex((q) => same(q, r)) === k);
            const origins = refs.map(([i, k]) => {
                const pin = geometry.strands[i].pins[k];
                return new Vector2(pin.x, pin.y);
            });
            const picked = headOf(picture, hit.ref, places);
            next = {
                kind: "pins",
                refs,
                origins,
                anchor: refs.findIndex((r) => same(r, picked)),
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
        } else if (hit.kind === "crossing") {
            // A click sets an unset crossing with the pair's first segment on top, and swaps a set one.
            const c = latest.current.crossings.crossings[hit.index];
            if (c) {
                const over = c.over === undefined ? 0 : c.over === 0 ? 1 : 0;
                dispatch({ type: "edit", edit: (q) => setCrossing(q, c.pair, c.n, over) });
            }
            return;
        } else if (hit.kind === "pass") {
            // A click puts an unset pass in front, and swaps a set one.
            const pass = latest.current.crossings.passes[hit.index];
            if (pass) {
                const side = pass.side === "front" ? "behind" : "front";
                dispatch({
                    type: "edit",
                    edit: (q) => setPass(q, pass.prop, [pass.strand, pass.segment], pass.n, side),
                });
            }
            return;
        } else if (hit.kind === "prop") {
            const origin = picture.props[hit.index];
            if (!origin) return;
            dispatch({ type: "select", selection: { kind: "prop", prop: hit.index } });
            next = {
                kind: "prop",
                index: hit.index,
                origin,
                start: toPicture(from.x, from.y),
                from,
                moved: false,
            };
        } else if (hit.kind === "frame") {
            next = {
                kind: "frame",
                sides: hit.sides,
                origin: latest.current.knotFrame,
                start: toPicture(from.x, from.y),
                from,
                moved: false,
            };
        } else if (hit.kind === "ring") {
            // A linked pin's ring turns the free pin heading its chain, keeping how far apart they run.
            const pin = geometry.strands[hit.ref[0]].pins[hit.ref[1]];
            const head = headOf(picture, hit.ref);
            const headPin = geometry.strands[head[0]].pins[head[1]];
            const [own, led] = [pin.angle, headPin.angle];
            next = {
                kind: "angle",
                ref: head,
                centre: new Vector2(pin.x, pin.y),
                turn: own !== undefined && led !== undefined ? led - own : 0,
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
            dispatch({ type: "edit", edit: (q, ids) => insertPin(q, geometry, [i, k], t, ids) });
            dispatch({
                type: "select",
                selection: { kind: "parts", pins: [[i, k + 1]], segments: [] },
            });
        } else if (hit.kind === "ring") {
            dispatch({ type: "edit", edit: (q) => setPinAngle(q, hit.ref, undefined) });
        }
    };

    const crossingMarks: Mark[] = crossings.crossings.map((c, k) => ({
        at: c.at,
        status: c.status,
        tooClose: drawn.tooClose.includes(k),
        letter: crossingLetter(k),
    }));
    const passMarks: Mark[] = crossings.passes.map((p, k) => ({
        at: p.at,
        status: p.status,
        tooClose: drawn.tooClosePasses.includes(k),
    }));

    const parts = selection.kind === "parts" ? selection : { pins: [], segments: [] };
    const pinsById = pinPlaces(picture);
    const isPin = (i: number, k: number) => parts.pins.some((r) => r[0] === i && r[1] === k);
    const isSegment = (i: number, k: number) =>
        parts.segments.some((r) => r[0] === i && r[1] === k);

    const ready = view && size;
    const px = view ? 1 / view.scale : 1;
    const viewBox = ready
        ? {
              x: view.cx - size.w / 2 / view.scale,
              y: view.cy - size.h / 2 / view.scale,
              w: size.w / view.scale,
              h: size.h / view.scale,
          }
        : { x: 0, y: 0, w: 0, h: 0 };
    return (
        <svg
            ref={svg}
            className="size-full touch-none select-none"
            viewBox={ready ? `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}` : undefined}
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
                    {show.grid && <GridDrawing view={viewBox} px={px} />}
                    <g pointerEvents="none">
                        <PictureDrawing picture={picture} geometry={geometry} paths={drawn.paths} />
                        <Warnings geometry={geometry} bends={show.bendWarnings} />
                    </g>
                    <FrameDrawing frame={knotFrame} view={viewBox} px={px} />
                    {show.grid && <GridNumbers view={viewBox} px={px} />}
                    <FrameHandles frame={knotFrame} px={px} />
                    {picture.props.map((prop, p) => (
                        <path
                            key={p}
                            data-hit="prop"
                            data-ref={p}
                            className="cursor-move"
                            d={kindOf(prop).outline(prop)}
                            fill="transparent"
                        />
                    ))}
                    {selection.kind === "prop" && picture.props[selection.prop] && (
                        <path
                            d={kindOf(picture.props[selection.prop]).outline(
                                picture.props[selection.prop],
                            )}
                            fill="none"
                            stroke="var(--highlight)"
                            strokeWidth={2 * px}
                            strokeDasharray={`${6 * px} ${4 * px}`}
                            pointerEvents="none"
                        />
                    )}
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
                    <CrossingMarks
                        crossings={crossingMarks}
                        passes={passMarks}
                        shown={show.crossings}
                        px={px}
                    />
                    {geometry.strands.map((strand, i) =>
                        strand.pins.map((pin, k) => {
                            const leader = leaderOf(picture, [i, k], pinsById);
                            const led = leader && geometry.strands[leader[0]]?.pins[leader[1]];
                            return (
                                <PinHandle
                                    key={`${i}-${k}`}
                                    strand={i}
                                    pin={k}
                                    x={pin.x}
                                    y={pin.y}
                                    angle={pin.angle}
                                    selected={isPin(i, k)}
                                    number={show.pinNumbers ? k + 1 : undefined}
                                    leaderX={led?.x}
                                    leaderY={led?.y}
                                    px={px}
                                />
                            );
                        }),
                    )}
                    {show.handles &&
                        parts.pins.map(([i, k]) => {
                            const strand = picture.strands[i];
                            const shape = geometry.strands[i];
                            const pin = shape?.pins[k];
                            if (!strand || !pin) return null;
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

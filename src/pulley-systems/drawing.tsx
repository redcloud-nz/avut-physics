"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { svgNumber } from "@/lib/svg-path";
import { vec2 } from "@/lib/vector2";

import {
    DIAGRAMS,
    GRAB,
    heightOf,
    INSET,
    LEAD,
    MARGIN,
    PADDING,
    PER_METRE,
    ROPE,
    SCALE,
    SystemFigure,
    TALLEST,
    THUMB,
    Track,
    type Diagram,
} from "./figure";
import { SYSTEMS, type Slug } from "./systems";
import { PIN, trackOf } from "./track";

/** A pulley system drawn as it looks, with the team's rope's end to drag round its track to pull the rope in. */
export function SystemDrawing({ slug, tensions }: { slug: Slug; tensions?: boolean }) {
    const [pulled, setPulled] = useState(0);
    const svg = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState(false);
    const diagram: Diagram = DIAGRAMS[slug];
    const system = SYSTEMS.find((s) => s.slug === slug)!;
    // The drawing fills the box the page gives it, every diagram at the same scale: the room either side of it, in
    // drawing units, and how tall the box is, so the track can run round the box's edge, with room to spare below the
    // diagram. Until the box is measured, it takes the diagram's own shape.
    const [box, setBox] = useState<{ width: number; height: number } | null>(null);
    useEffect(() => {
        const el = svg.current;
        if (!el) return;
        const watch = new ResizeObserver(() => {
            const { width, height } = el.getBoundingClientRect();
            setBox({ width, height });
        });
        watch.observe(el);
        return () => watch.disconnect();
    }, []);
    const scale =
        box && Math.min(SCALE, box.width / (320 + 2 * MARGIN), box.height / (TALLEST + 2 * MARGIN));
    const spare = scale ? Math.max(0, box.width / scale - 2 * MARGIN - 320) : 0;
    const base = heightOf(diagram);
    const height = Math.max(base, scale ? box.height / scale - 2 * MARGIN : 0);
    // The whole drawing, the frame and the margin round it.
    const [x0, y0, across, down] = [
        -spare / 2 - MARGIN,
        -MARGIN,
        320 + spare + 2 * MARGIN,
        height + 2 * MARGIN,
    ];
    // The room below the diagram lets its load start lower, so there's more rope to pull in.
    const room = height - base;
    const rest = diagram.scene(0, room);
    // The team's rope's track (its pin stays put as the rope's pulled in), and where along it the rope's end is: as far
    // past its start as the rope's pulled in, but never so far it runs off the track's end.
    const track =
        rest.pin &&
        trackOf(rest.pin.x, rest.pin.edge ?? "bottom", x0, y0, x0 + across, y0 + down, INSET);
    // Down to the centimetre, as the rope's end steps.
    const max =
        Math.floor(
            Math.min(
                diagram.max * PER_METRE + room * diagram.gain,
                track ? track.length - LEAD - THUMB : Infinity,
            ),
        ) / PER_METRE;
    const amount = Math.min(pulled, max);
    const scene = diagram.scene(amount, room);
    const [start, finish] = [LEAD, LEAD + max * PER_METRE];
    const reach = start + amount * PER_METRE;
    const stops = scene.ropes.map((rope, r) =>
        track && scene.pin?.rope === r ? [...rope.stops, ...track.stops(reach)] : rope.stops,
    );
    // Drag the rope's end along its track: the nearest point on it to the pointer, within the rope there is to pull.
    const drag = (e: React.PointerEvent) => {
        const ctm = svg.current?.getScreenCTM();
        if (!dragging || !track || !ctm) return;
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
        setPulled(Math.round(track.nearest(vec2(p.x, p.y), start, finish) - start) / PER_METRE);
    };
    // Grabbing the rope's end, by its handle or the room round it.
    const grab = {
        onPointerDown: (e: React.PointerEvent<SVGCircleElement>) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
        },
        onPointerUp: () => setDragging(false),
        onPointerCancel: () => setDragging(false),
    };
    // A touch starting on the rope's end mustn't scroll the page, or the browser takes the touch over and the drag stops
    // there. Shapes inside an SVG ignore `touch-action`, so it's stopped as it starts instead, which needs a listener
    // that isn't passive.
    const holdTouch = useCallback((el: SVGGElement | null) => {
        if (!el) return;
        const hold = (e: TouchEvent) => e.preventDefault();
        el.addEventListener("touchstart", hold, { passive: false });
        return () => el.removeEventListener("touchstart", hold);
    }, []);
    const step = (by: number) =>
        setPulled(Math.min(Math.max(Math.round((amount + by) * 100) / 100, 0), max));
    return (
        <div className="flex min-h-105 flex-1">
            <svg
                ref={svg}
                viewBox={[x0, y0, across, down].map(svgNumber).join(" ")}
                className="h-full w-full overflow-visible text-ink-muted"
                role="group"
                aria-label={`${system.name}: ${system.text}`}
                onPointerMove={drag}
            >
                <SystemFigure
                    scene={scene}
                    rest={rest}
                    stops={stops}
                    spare={spare}
                    height={height}
                    tensions={tensions}
                    behind={track && <Track track={track} from={start} to={finish} />}
                >
                    {/* The pin the team's rope turns round, and its end, which is dragged along the track to pull it in. */}
                    {track && (
                        <>
                            {/* Solid, over the frame's edge it sits on. */}
                            <circle
                                cx={svgNumber(track.pin.x)}
                                cy={svgNumber(track.pin.y)}
                                r={PIN - ROPE / 2}
                                className="fill-surface"
                            />
                            <circle
                                cx={svgNumber(track.pin.x)}
                                cy={svgNumber(track.pin.y)}
                                r={PIN - ROPE / 2}
                                fill="currentColor"
                                fillOpacity={0.3}
                                stroke="currentColor"
                                strokeWidth={1.5}
                            />
                            {/*
                             * How much rope has come off the pin: across the rope from it (left of the rope rising to
                             * a pin at the top, right of the rope coming down to one at the foot), in the middle of the
                             * frame's padding on the pin's edge.
                             */}
                            <text
                                x={svgNumber(
                                    scene.pin?.edge === "top"
                                        ? track.pin.x - PIN - 6
                                        : track.pin.x + PIN + 6,
                                )}
                                y={svgNumber(
                                    scene.pin?.edge === "top" ? PADDING / 2 : height - PADDING / 2,
                                )}
                                dominantBaseline="central"
                                textAnchor={scene.pin?.edge === "top" ? "end" : "start"}
                                fontSize={8}
                                className="fill-ink-muted font-mono"
                                opacity={0.7}
                            >
                                {amount.toFixed(2)} m
                            </text>
                            {/* A finger on the rope's end drags it, not the page. */}
                            <g ref={holdTouch}>
                                {/* Room round it to grab it by, wide enough for a finger. */}
                                <circle
                                    cx={svgNumber(track.at(reach).x)}
                                    cy={svgNumber(track.at(reach).y)}
                                    r={GRAB}
                                    fill="none"
                                    pointerEvents="all"
                                    className={dragging ? "cursor-grabbing" : "cursor-grab"}
                                    {...grab}
                                />
                                <circle
                                    cx={svgNumber(track.at(reach).x)}
                                    cy={svgNumber(track.at(reach).y)}
                                    r={THUMB}
                                    className={`fill-action stroke-background outline-none focus-visible:stroke-ink ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                                    strokeWidth={1.5}
                                    tabIndex={0}
                                    role="slider"
                                    aria-label="Rope pulled in"
                                    aria-valuemin={0}
                                    aria-valuemax={max}
                                    aria-valuenow={amount}
                                    aria-valuetext={`${amount.toFixed(2)} m`}
                                    {...grab}
                                    onKeyDown={(e) => {
                                        const by = {
                                            ArrowUp: 0.05,
                                            ArrowRight: 0.05,
                                            ArrowDown: -0.05,
                                            ArrowLeft: -0.05,
                                            PageUp: 0.5,
                                            PageDown: -0.5,
                                            Home: -max,
                                            End: max,
                                        }[e.key];
                                        if (by === undefined) return;
                                        e.preventDefault();
                                        step(by);
                                    }}
                                />
                            </g>
                        </>
                    )}
                </SystemFigure>
            </svg>
        </div>
    );
}

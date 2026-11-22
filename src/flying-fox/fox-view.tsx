"use client";

import { Info, Minus, Plus, RotateCcw, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Loading3D from "@/abseil-tower/loading-3d";
import type { Piece } from "@/abseil-tower/tower";
import type { GLHandle, SceneConfig } from "@/abseil-tower/tower-gl";
import {
    Callouts,
    centreOf,
    PieceDrawing,
    StrandSwatch,
    toDrawing,
} from "@/abseil-tower/tower-view";
import { useInBrowser } from "@/components/use-in-browser";
import { clamp, rad } from "@/lib/math";
import { OrbitCamera } from "@/lib/orbit-camera";
import { svgNumber, svgPoints } from "@/lib/svg-path";
import { vec2, type Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import {
    DIP,
    FALL,
    foxLabels,
    foxLegend,
    foxPieces,
    GRADE,
    GROUND,
    groundFaces,
    groundShade,
    groundY,
    LOG,
    SPAN,
    TREE,
} from "./fox";

/** The WebGL view, loaded only when it's first shown, with a message while it loads. */
const SceneGL = dynamic(() => import("@/abseil-tower/tower-gl").then((m) => m.SceneGL), {
    ssr: false,
    loading: () => <Loading3D />,
});

/** The least room (SVG units) the drawing needs unzoomed; it widens or deepens past it to fill its box. */
const W = 1000;
const H = 600;
/** SVG units per metre unzoomed. */
const PPM = 8;
const MAX_ZOOM = 60;

/** The ground, as strips following its fall and dip. */
const GROUND_FACES = groundFaces();
/** A band of earth under the ground's far edge, so the side view shows the ground's shape: its fall and dip. */
const GROUND_BAND = (() => {
    const n = 60;
    const edge = Array.from({ length: n + 1 }, (_, i) => {
        const x = GROUND.x0 + ((GROUND.x1 - GROUND.x0) * i) / n;
        return vec3(x, groundY(x), GROUND.z);
    });
    return [...edge, ...edge.reverse().map((p) => p.add(vec3(0, -1.5, 0)))];
})();

/** The narrowest ropes and wire are drawn in the flat views (SVG units), however far out. */
const MIN_WIDTH = { rope: 4, steel: 3, sling: 5 };

/** The middle of the site, which the views start centred on. */
const MIDDLE = (() => {
    const x = (GROUND.x0 + GROUND.x1) / 2;
    return vec3(x, groundY(x) + 3.5, 0);
})();

/** The 3D scene: the whole site, seen from beside the launch. */
const SCENE: SceneConfig = {
    centre: vec3((TREE.x + LOG.x) / 2, groundY((TREE.x + LOG.x) / 2) + 2.5, 0),
    distance: 120,
    azimuth: 198,
    elevation: 18,
    maxDistance: 240,
    ground: GROUND_FACES,
    compass: [
        ["Top end", vec3(TREE.x - 3.5, groundY(TREE.x - 3.5), 0)],
        ["Bottom end", vec3(LOG.x + 4, groundY(LOG.x + 4), 0)],
    ],
    letter: 1.4,
    // Ropes and wire drawn a little thicker than they are, and never thinner than 2.5 pixels.
    minR: { steel: 0.012, rope: 0.012, sling: 0.015 },
    hairlines: 2.5,
    pivotToPointer: true,
    label: "The flying fox in 3D. Drag to turn it, scroll or pinch to zoom, and right-drag or drag with two fingers to move it.",
};

/** The 3D view's presets: from behind the launch, from the side, and from behind the landing. */
type ViewName = "top" | "side" | "bottom";
const VIEWS: Record<ViewName, { label: string; azimuth: number; elevation: number }> = {
    top: { label: "From the top", azimuth: 270, elevation: 15 },
    side: { label: "Side", azimuth: 180, elevation: 15 },
    bottom: { label: "From the bottom", azimuth: 90, elevation: 15 },
};

/** How close a flat view is, and the point it's centred on. */
type Frame = { zoom: number; target: Vector3 };
type Fit = { centre: Vector3; width: number; height: number };

type Mode = "3d" | "side" | "overhead";
const MODES: Record<
    Mode,
    { label: string; camera?: { azimuth: number; elevation: number }; fit?: Fit }
> = {
    "3d": { label: "3D" },
    side: {
        label: "Side elevation",
        camera: { azimuth: 180, elevation: 0 },
        fit: {
            centre: MIDDLE,
            width: GROUND.x1 - GROUND.x0 + 24,
            height: 13 + FALL,
        },
    },
    overhead: {
        label: "Overhead",
        camera: { azimuth: 180, elevation: 90 },
        fit: {
            centre: vec3(MIDDLE.x, groundY(MIDDLE.x), 0),
            width: GROUND.x1 - GROUND.x0 + 24,
            height: 2 * GROUND.z + 2,
        },
    },
};
const modeOf = (param: string | null): Mode =>
    param === "side" || param === "overhead" ? param : "3d";

/** The drawing's size (SVG units) for a box `width` by `height` (pixels): at least `W` by `H`, in the box's shape. */
function drawingSize(width: number, height: number): Vector2 {
    if (width <= 0 || height <= 0) return vec2(W, H);
    return width / height > W / H ? vec2((H * width) / height, H) : vec2(W, (W * height) / width);
}
const originOf = (size: Vector2) => vec2(size.x / 2, size.y / 2);

/** Where a flat view starts in a drawing `size`: as close as fits its box. */
function startOf(fit: Fit, size: Vector2): Frame {
    const zoom = clamp(Math.min(size.x / fit.width, size.y / fit.height) / PPM, 0.2, MAX_ZOOM);
    return { zoom, target: fit.centre };
}

/**
 * The frame that keeps the scene point that was under `from` (in `start`) under `to`, at `zoom`: zooming about a point,
 * panning, or both at once as in a pinch.
 */
function reframe(
    cam: OrbitCamera,
    origin: Vector2,
    start: Frame,
    from: Vector2,
    to: Vector2,
    zoom: number,
    least: number,
): Frame {
    const z = clamp(zoom, least, MAX_ZOOM);
    const inView = (s: Vector2, ppm: number) =>
        vec2((s.x - origin.x) / ppm, (origin.y - s.y) / ppm);
    const [u, v] = [inView(from, PPM * start.zoom), inView(to, PPM * z)];
    const shift = cam.right.scale(u.x - v.x).add(cam.up.scale(u.y - v.y));
    return { zoom: z, target: start.target.add(shift) };
}

/** The flying fox, in the view the page's address names (`?view=side` or `overhead`; 3D unless it names one). */
export default function FoxView() {
    const mode = modeOf(useSearchParams().get("view"));
    const setMode = (m: Mode) => {
        const url = new URL(window.location.href);
        url.searchParams.set("view", m);
        window.history.replaceState(null, "", url);
    };
    const pieces = useMemo(() => foxPieces(), []);
    const labels = useMemo(() => foxLabels(), []);
    const legend = foxLegend();
    const [moved, setMoved] = useState<Frame | null>(null);
    const [glView, setGlView] = useState<GLHandle | null>(null);
    const [glTurned, setGlTurned] = useState({ azimuth: 0, elevation: 0 });
    const onGlTurn = useCallback(
        (azimuth: number, elevation: number) => setGlTurned({ azimuth, elevation }),
        [],
    );
    const [legendOpen, setLegendOpen] = useState<boolean | null>(null);
    const inBrowser = useInBrowser();
    const svgRef = useRef<SVGSVGElement>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState(vec2(W, H));
    const origin = originOf(size);
    const pointers = useRef(new Map<number, Vector2>());
    const gesture = useRef<
        | { kind: "pan"; at: Vector2; frame: Frame }
        | { kind: "pinch"; mid: Vector2; spread: number; frame: Frame }
        | null
    >(null);

    const flat = MODES[mode].camera ?? MODES.side.camera!;
    const fit = MODES[mode].fit ?? MODES.side.fit!;
    const cam = new OrbitCamera(rad(flat.azimuth), rad(flat.elevation));
    const start = startOf(fit, size);
    // Zoomed out no further than the whole site.
    const least = start.zoom;
    const frame = moved ?? start;
    const ppm = PPM * frame.zoom;
    const toSvg = (p: Vector3): Vector2 => {
        const v = cam.project(p.sub(frame.target));
        return vec2(origin.x + v.x * ppm, origin.y - v.y * ppm);
    };

    useEffect(() => {
        const box = boxRef.current;
        if (!box) return;
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setSize(drawingSize(width, height));
        });
        observer.observe(box);
        return () => observer.disconnect();
    }, []);

    // Scrolling over the drawing zooms about the pointer, as does a trackpad pinch (a scroll with Ctrl).
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const at = toDrawing(svg, e.clientX, e.clientY);
            const delta = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
            const rate = e.ctrlKey ? 0.01 : 0.0025;
            setMoved((moved) => {
                const first = startOf(fit, size);
                const f = moved ?? first;
                return reframe(
                    new OrbitCamera(rad(flat.azimuth), rad(flat.elevation)),
                    originOf(size),
                    f,
                    at,
                    at,
                    f.zoom * Math.exp(-delta * rate),
                    first.zoom,
                );
            });
        };
        svg.addEventListener("wheel", onWheel, { passive: false });
        return () => svg.removeEventListener("wheel", onWheel);
    }, [flat.azimuth, flat.elevation, fit, size, mode]);

    // Back to front by each piece's middle; a section's sides facing away are left out.
    const sorted = pieces
        .filter((p) => p.kind !== "face" || !p.normal || p.normal.dot(cam.toward) > 0)
        .map((piece) => ({ piece, key: cam.depth(centreOf(piece)) }))
        .sort((a, b) => a.key - b.key);

    const drag = (at: Vector2): NonNullable<typeof gesture.current> => ({ kind: "pan", at, frame });
    const startPinch = () => {
        const [a, b] = [...pointers.current.values()];
        gesture.current = { kind: "pinch", mid: a.mid(b), spread: a.distanceTo(b), frame };
    };
    const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const at = toDrawing(e.currentTarget, e.clientX, e.clientY);
        pointers.current.set(e.pointerId, at);
        if (pointers.current.size === 2) startPinch();
        else if (pointers.current.size > 2) return;
        else gesture.current = drag(at);
    };
    const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        if (!pointers.current.has(e.pointerId)) return;
        const at = toDrawing(e.currentTarget, e.clientX, e.clientY);
        pointers.current.set(e.pointerId, at);
        const d = gesture.current;
        if (!d) return;
        if (d.kind === "pinch") {
            if (pointers.current.size !== 2) return;
            const [a, b] = [...pointers.current.values()];
            const zoom = d.frame.zoom * (a.distanceTo(b) / Math.max(d.spread, 1));
            setMoved(reframe(cam, origin, d.frame, d.mid, a.mid(b), zoom, least));
            return;
        }
        setMoved(reframe(cam, origin, d.frame, d.at, at, d.frame.zoom, least));
    };
    const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
        pointers.current.delete(e.pointerId);
        const [rest] = [...pointers.current.entries()];
        gesture.current = null;
        if (pointers.current.size === 2) startPinch();
        else if (rest && e.pointerType === "touch") gesture.current = drag(rest[1]);
    };

    const view = (Object.keys(VIEWS) as ViewName[]).find(
        (k) => VIEWS[k].azimuth === glTurned.azimuth && VIEWS[k].elevation === glTurned.elevation,
    );

    const diagram = (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${svgNumber(size.x)} ${svgNumber(size.y)}`}
            className="absolute inset-0 block h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
            role="img"
            aria-label={`The flying fox: ${MODES[mode].label}. Drag to move the view, and scroll or pinch to zoom.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(e) => e.preventDefault()}
        >
            {mode === "overhead" && (
                <g>
                    {GROUND_FACES.map((f, i) =>
                        f.kind === "face" ? (
                            <polygon
                                key={i}
                                points={svgPoints(f.points.map(toSvg))}
                                fill={f.color}
                                // The fill's own colour round each tile, so no hairline shows between them.
                                stroke={f.color}
                                strokeWidth={0.6}
                            />
                        ) : null,
                    )}
                </g>
            )}
            {mode === "side" && (
                <polygon points={svgPoints(GROUND_BAND.map(toSvg))} fill={groundShade(2)} />
            )}
            {inBrowser &&
                sorted.map((d, i) => (
                    <PieceDrawing
                        key={i}
                        piece={d.piece as Piece}
                        toSvg={toSvg}
                        ppm={ppm}
                        minWidth={MIN_WIDTH}
                    />
                ))}
            {inBrowser && (
                <Callouts labels={labels} toSvg={toSvg} ppm={ppm} middle={toSvg(MIDDLE).x} />
            )}
        </svg>
    );

    const zoomBy = (factor: number) =>
        mode === "3d"
            ? glView?.zoomBy(factor)
            : setMoved(reframe(cam, origin, frame, origin, origin, frame.zoom * factor, least));

    return (
        <div
            ref={boxRef}
            className="relative min-h-0 flex-1 overflow-hidden border-t border-border bg-surface"
        >
            {mode === "3d" ? (
                <SceneGL
                    scene={SCENE}
                    pieces={pieces}
                    labels={[]}
                    onReady={setGlView}
                    onTurn={onGlTurn}
                />
            ) : (
                diagram
            )}
            <button
                type="button"
                onClick={() => setLegendOpen(true)}
                aria-label="Show the legend"
                title="Legend"
                className={`absolute top-2 right-2 size-9 items-center justify-center rounded-lg border border-border bg-surface/90 text-ink-soft shadow-lg backdrop-blur transition-colors hover:bg-line-faint [&_svg]:size-4 ${
                    legendOpen === null ? "flex sm:hidden" : legendOpen ? "hidden" : "flex"
                }`}
            >
                <Info />
            </button>
            <section
                className={`absolute top-2 right-2 max-h-[calc(100%-1rem)] w-72 max-w-[calc(100%-1rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface/90 p-3 shadow-lg backdrop-blur ${
                    legendOpen === null ? "hidden sm:block" : legendOpen ? "block" : "hidden"
                }`}
            >
                <button
                    type="button"
                    onClick={() => setLegendOpen(false)}
                    aria-label="Hide the legend"
                    className="flex w-full items-center justify-between text-sm font-medium text-ink-strong"
                >
                    Legend
                    <X className="size-4 text-ink-soft" />
                </button>
                <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-soft">
                    {legend.map((l) => (
                        <li key={l.name} className="flex items-center gap-2">
                            <span className="flex w-16 shrink-0 flex-col">
                                <StrandSwatch color={l.color} look={l.look} />
                            </span>
                            {l.name}
                        </li>
                    ))}
                </ul>
                <p className="mt-3 border-t border-border pt-2 text-xs text-ink-muted">
                    Set up to Scouts NSW&rsquo;s flying fox procedure on a made-up site: the ground
                    is level round each end and falls {FALL} m between them (a{" "}
                    {Math.round(GRADE * 1000) / 10}% grade over the span), with a {DIP.depth} m dip
                    in the middle where the hawsers hang lowest. A {SPAN} m span with 5% sag. Sizes
                    the procedure doesn&rsquo;t give are estimates.
                </p>
            </section>
            <div className="absolute bottom-2 left-2 flex flex-wrap items-end gap-2">
                <div
                    role="group"
                    aria-label="View"
                    className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface/90 shadow-lg backdrop-blur"
                >
                    {(Object.keys(MODES) as Mode[]).map((m) => (
                        <button
                            key={m}
                            type="button"
                            aria-pressed={mode === m}
                            onClick={() => {
                                setMode(m);
                                setMoved(null);
                            }}
                            className={`px-3 py-1.5 text-left text-xs transition-colors ${
                                mode === m
                                    ? "bg-action text-primary-foreground"
                                    : "text-ink-soft hover:bg-line-faint"
                            }`}
                        >
                            {MODES[m].label}
                        </button>
                    ))}
                </div>
                {mode === "3d" && (
                    <div
                        role="group"
                        aria-label="Look at the flying fox"
                        className="flex overflow-hidden rounded-lg border border-border bg-surface/90 shadow-lg backdrop-blur"
                    >
                        {(Object.keys(VIEWS) as ViewName[]).map((k) => (
                            <button
                                key={k}
                                type="button"
                                aria-pressed={view === k}
                                onClick={() => glView?.look(VIEWS[k].azimuth, VIEWS[k].elevation)}
                                className={`px-2.5 py-1 text-xs transition-colors ${
                                    view === k
                                        ? "bg-action text-primary-foreground"
                                        : "text-ink-soft hover:bg-line-faint"
                                }`}
                            >
                                {VIEWS[k].label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="absolute right-2 bottom-2 flex flex-col overflow-hidden rounded-lg border border-border bg-surface/90 shadow-lg backdrop-blur">
                {[
                    {
                        label: "Zoom in",
                        icon: <Plus />,
                        onClick: () => zoomBy(1.4),
                        off: mode !== "3d" && frame.zoom >= MAX_ZOOM,
                    },
                    {
                        label: "Zoom out",
                        icon: <Minus />,
                        onClick: () => zoomBy(1 / 1.4),
                        off: mode !== "3d" && frame.zoom <= least,
                    },
                    {
                        label: "Show the whole view again",
                        icon: <RotateCcw />,
                        onClick: () => {
                            if (mode === "3d") return glView?.reset();
                            setMoved(null);
                        },
                        off: false,
                    },
                ].map((b) => (
                    <button
                        key={b.label}
                        type="button"
                        aria-label={b.label}
                        title={b.label}
                        onClick={b.onClick}
                        disabled={b.off}
                        className="flex size-9 items-center justify-center text-ink-soft transition-colors hover:bg-line-faint disabled:opacity-40 [&_svg]:size-4"
                    >
                        {b.icon}
                    </button>
                ))}
            </div>
        </div>
    );
}

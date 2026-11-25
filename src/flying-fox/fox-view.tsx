"use client";

import {
    Box,
    ChevronLeft,
    ChevronRight,
    Eye,
    Gauge,
    Info,
    Map as MapIcon,
    Minus,
    Move3d,
    PanelBottom,
    Plus,
    RotateCcw,
    X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ObstacleGrid, obstaclesOf } from "@/abseil-tower/callout-layout";
import Loading3D from "@/abseil-tower/loading-3d";
import type { Piece } from "@/abseil-tower/tower";
import type { FrameRate, GLHandle, SceneConfig } from "@/abseil-tower/tower-gl";
import {
    Callouts,
    nearness,
    PieceDrawing,
    StrandSwatch,
    toDrawing,
} from "@/abseil-tower/tower-view";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInBrowser } from "@/components/use-in-browser";
import { clamp, rad } from "@/lib/math";
import { OrbitCamera } from "@/lib/orbit-camera";
import { svgNumber, svgPoints } from "@/lib/svg-path";
import { vec2, type Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import {
    AUTO_START,
    DETAILS,
    judge,
    loadChoice,
    saveChoice,
    stepDetail,
    type Detail,
    type DetailChoice,
} from "./detail";
import {
    CLEARANCE,
    FALL,
    foxLabels,
    foxLegend,
    foxPieces,
    foxTargets,
    GRADE,
    GROUND,
    groundFaces,
    groundShade,
    groundY,
    LOG,
    RIDER,
    SPAN,
    TEST_LOAD,
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

/** The narrowest ropes and wire are drawn in the flat views (SVG units), however far out: just enough to pick out. */
const MIN_WIDTH = { rope: 2, steel: 1.5, sling: 3 };

/** The middle of the site, which the views start centred on. */
const MIDDLE = (() => {
    const x = (GROUND.x0 + GROUND.x1) / 2;
    return vec3(x, groundY(x) + 3.5, 0);
})();

/** The 3D scene: the whole site, seen from beside the launch. */
const SCENE: SceneConfig = {
    centre: vec3((TREE.x + LOG.x) / 2, groundY((TREE.x + LOG.x) / 2) + 2.5, 0),
    distance: 120,
    // The whole site, from behind the tree to past the anchor, with a little to spare.
    width: LOG.x - TREE.x + 10,
    azimuth: 198,
    elevation: 18,
    // Far enough out to fit the whole site across a phone held upright.
    maxDistance: 700,
    // Finer for 3D, where each tile's shaded smoothly from corner to corner rather than all one colour.
    ground: groundFaces(1),
    // No end labels on the ground: the tree and the shear leg show which end is which.
    compass: [],
    letter: 1.4,
    // Ropes and wire drawn their true size, in proportion with the hardware, and never thinner than 2.5 pixels.
    minR: {},
    hairlines: 2.5,
    pivotToPointer: true,
    // Turning about somewhere on the site, from no further out than half as far again as it starts.
    bounds: {
        lo: vec3(GROUND.x0, Math.min(groundY(GROUND.x0), groundY(GROUND.x1)) - 2, -GROUND.z),
        hi: vec3(GROUND.x1, groundY(TREE.x) + TREE.height + 5, GROUND.z),
    },
    zoomOut: 1.5,
    label: "The flying fox in 3D. Drag to turn it, scroll or pinch to zoom, and right-drag or drag with two fingers to move it.",
};

/** What the 3D view can lock onto, up the site from the tree to the log. */
const TARGETS = foxTargets();

/** How close a flat view is, and the point it's centred on. */
type Frame = { zoom: number; target: Vector3 };
type Fit = { centre: Vector3; width: number; height: number };

/** The look of the round-cornered buttons over the drawing, matching the zoom buttons. */
const CONTROL =
    "flex h-9 items-center justify-center rounded-lg border border-border bg-surface/90 text-ink-soft shadow-lg backdrop-blur transition-colors hover:bg-line-faint [&_svg]:size-4";

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

/** Each view's icon: a box for 3D, a profile for the side elevation, a map for overhead. */
const MODE_ICONS: Record<Mode, React.ReactNode> = {
    "3d": <Box />,
    side: <PanelBottom />,
    overhead: <MapIcon />,
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
    fit: Fit,
): Frame {
    const z = clamp(zoom, least, MAX_ZOOM);
    const inView = (s: Vector2, ppm: number) =>
        vec2((s.x - origin.x) / ppm, (origin.y - s.y) / ppm);
    const [u, v] = [inView(from, PPM * start.zoom), inView(to, PPM * z)];
    const shift = cam.right.scale(u.x - v.x).add(cam.up.scale(u.y - v.y));
    return { zoom: z, target: inFit(cam, fit, start.target.add(shift)) };
}

/** `target` kept inside the view's fit box, so the middle of the view never leaves the site. */
function inFit(cam: OrbitCamera, fit: Fit, target: Vector3): Vector3 {
    const d = target.sub(fit.centre);
    const [x, y] = [d.dot(cam.right), d.dot(cam.up)];
    const [cx, cy] = [
        clamp(x, -fit.width / 2, fit.width / 2),
        clamp(y, -fit.height / 2, fit.height / 2),
    ];
    return target.add(cam.right.scale(cx - x)).add(cam.up.scale(cy - y));
}

/** The flying fox, in the view the page's address names (`?view=side` or `overhead`; 3D unless it names one). */
export default function FoxView() {
    const params = useSearchParams();
    const mode = modeOf(params.get("view"));
    const setParam = (name: string, value: string | null) => {
        const url = new URL(window.location.href);
        if (value === null) url.searchParams.delete(name);
        else url.searchParams.set(name, value);
        window.history.replaceState(null, "", url);
    };
    const setMode = (m: Mode) => setParam("view", m);
    // What the 3D view's locked onto (`?focus=trolley-a`), or nothing to move freely.
    const focus = TARGETS.find((t) => t.slug === params.get("focus")) ?? null;
    // Through the targets in turn, round from the last to the first.
    const step = (by: number) => {
        const i = focus ? TARGETS.indexOf(focus) : by > 0 ? -1 : TARGETS.length;
        setParam("focus", TARGETS[(i + by + TARGETS.length) % TARGETS.length].slug);
    };
    const pieces = useMemo(() => foxPieces(), []);
    const labels = useMemo(() => foxLabels(), []);
    const legend = foxLegend();
    const [moved, setMoved] = useState<Frame | null>(null);
    const [glView, setGlView] = useState<GLHandle | null>(null);
    const [legendOpen, setLegendOpen] = useState<boolean | null>(null);
    const inBrowser = useInBrowser();
    // How finely it's drawn: chosen on the page, or left to Auto, which follows the frame rate. Auto gives up after a
    // few changes of direction, rather than keep flipping between two levels.
    // The saved choice until one's made on the page (read once it's in the browser, where it's kept).
    const [picked, setPicked] = useState<DetailChoice | null>(null);
    const choice = picked ?? (inBrowser ? loadChoice() : "auto");
    const choiceRef = useRef<DetailChoice>("auto");
    useEffect(() => {
        choiceRef.current = choice;
    }, [choice]);
    const choose = (c: DetailChoice) => {
        setPicked(c);
        saveChoice(c);
    };
    const [auto, setAuto] = useState<Detail>(AUTO_START);
    const flips = useRef<{ last: FrameRate | null; count: number }>({ last: null, count: 0 });
    const onFrameRate = useCallback((rate: FrameRate) => {
        if (choiceRef.current !== "auto") return;
        const f = flips.current;
        if (f.count >= 4) return;
        if (f.last && f.last !== rate) f.count++;
        f.last = rate;
        setAuto((d) => stepDetail(d, rate));
    }, []);
    const detail = choice === "auto" ? auto : choice;
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
                    fit,
                );
            });
        };
        const watched = (e: WheelEvent) => {
            poke();
            onWheel(e);
        };
        svg.addEventListener("wheel", watched, { passive: false });
        return () => svg.removeEventListener("wheel", watched);
    }, [flat.azimuth, flat.elevation, fit, size, mode, poke]);

    // Back to front by each piece's middle; a section's sides facing away are left out.
    // Fine detail (a plate's edge, a bolt's head) is left out where it would be too small to see.
    const sorted = pieces
        .filter((p) => p.fine === undefined || p.fine * ppm >= DETAILS[detail].finePx)
        .filter((p) => p.kind !== "face" || !p.normal || p.normal.dot(cam.toward) > 0)
        .map((piece) => ({ piece, key: nearness(piece, cam.toward) }))
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
        if (gesture.current) poke();
        if (!pointers.current.has(e.pointerId)) return;
        const at = toDrawing(e.currentTarget, e.clientX, e.clientY);
        pointers.current.set(e.pointerId, at);
        const d = gesture.current;
        if (!d) return;
        if (d.kind === "pinch") {
            if (pointers.current.size !== 2) return;
            const [a, b] = [...pointers.current.values()];
            const zoom = d.frame.zoom * (a.distanceTo(b) / Math.max(d.spread, 1));
            setMoved(reframe(cam, origin, d.frame, d.mid, a.mid(b), zoom, least, fit));
            return;
        }
        setMoved(reframe(cam, origin, d.frame, d.at, at, d.frame.zoom, least, fit));
    };
    const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
        pointers.current.delete(e.pointerId);
        const [rest] = [...pointers.current.entries()];
        gesture.current = null;
        if (pointers.current.size === 2) startPinch();
        else if (rest && e.pointerType === "touch") gesture.current = drag(rest[1]);
    };

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
                        depth={(p) => cam.depth(p)}
                    />
                ))}
            {inBrowser && (
                <Callouts
                    labels={labels}
                    toSvg={toSvg}
                    ppm={ppm}
                    middle={toSvg(MIDDLE).x}
                    avoid={
                        new ObstacleGrid(
                            obstaclesOf(
                                sorted.map((d) => d.piece as Piece),
                                toSvg,
                                ppm,
                                MIN_WIDTH,
                            ),
                        )
                    }
                />
            )}
        </svg>
    );

    const zoomBy = (factor: number) =>
        mode === "3d"
            ? glView?.zoomBy(factor)
            : setMoved(
                  reframe(cam, origin, frame, origin, origin, frame.zoom * factor, least, fit),
              );

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
                    focus={focus}
                    detail={{ dpr: DETAILS[detail].dpr, sides: DETAILS[detail].sides }}
                    onFrameRate={choice === "auto" ? onFrameRate : undefined}
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
                    {Math.round(GRADE * 1000) / 10}% grade over the span), with a hollow between
                    shaped to keep even a {RIDER.mass} kg rider&rsquo;s feet {CLEARANCE.ride * 100}{" "}
                    cm clear standing up, until the dismount zone, where they can&rsquo;t quite
                    stand. A {SPAN} m span, the hawsers tensioned to sag 5% with a {TEST_LOAD} kg
                    test load at the middle, and drawn unloaded. Sizes the procedure doesn&rsquo;t
                    give are estimates.
                </p>
            </section>
            <div className="absolute bottom-2 left-2 flex items-end gap-2">
                {/* What's shown, where from, and how finely: each a button opening its menu. */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={`View: ${MODES[mode].label}`}
                            title="View"
                            className={`${CONTROL} gap-1.5 px-2.5`}
                        >
                            {MODE_ICONS[mode]}
                            <span className="hidden text-xs sm:inline">{MODES[mode].label}</span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="min-w-44">
                        <DropdownMenuLabel>View</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                            value={mode}
                            onValueChange={(m) => {
                                setMode(m as Mode);
                                setMoved(null);
                            }}
                        >
                            {(Object.keys(MODES) as Mode[]).map((m) => (
                                <DropdownMenuRadioItem key={m} value={m}>
                                    {MODE_ICONS[m]}
                                    {MODES[m].label}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
                {mode === "3d" && (
                    // Back to the target before, from Free to the last.
                    <button
                        type="button"
                        aria-label="Look at the one before"
                        title="Previous"
                        onClick={() => step(-1)}
                        className={`${CONTROL} w-9`}
                    >
                        <ChevronLeft />
                    </button>
                )}
                {mode === "3d" && (
                    // Free to move about the site, or locked onto one thing on it: turning about it and zooming
                    // towards it.
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label={`Look at: ${focus?.label ?? "Free"}`}
                                title="Look at"
                                className={`${CONTROL} gap-1.5 px-2.5`}
                            >
                                {focus ? <Eye /> : <Move3d />}
                                <span className={`text-xs ${focus ? "" : "hidden sm:inline"}`}>
                                    {focus?.label ?? "Free"}
                                </span>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="start" className="min-w-52">
                            <DropdownMenuLabel>Look at</DropdownMenuLabel>
                            <DropdownMenuRadioGroup
                                value={focus?.slug ?? "free"}
                                onValueChange={(k) => setParam("focus", k === "free" ? null : k)}
                            >
                                <DropdownMenuRadioItem value="free">
                                    <Move3d />
                                    Free
                                </DropdownMenuRadioItem>
                                <DropdownMenuSeparator />
                                {TARGETS.map((t) => (
                                    <DropdownMenuRadioItem key={t.slug} value={t.slug}>
                                        {t.label}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                            <p className="max-w-52 px-1.5 pt-1 pb-1.5 text-xs text-ink-muted">
                                Locked onto something, the view turns about its middle and zooms
                                towards it. Free moves anywhere.
                            </p>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                {mode === "3d" && (
                    // On to the next target, from Free to the first.
                    <button
                        type="button"
                        aria-label="Look at the next one"
                        title="Next"
                        onClick={() => step(1)}
                        className={`${CONTROL} w-9`}
                    >
                        <ChevronRight />
                    </button>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={`Detail: ${choice === "auto" ? `Auto, ${DETAILS[auto].label}` : DETAILS[choice].label}`}
                            title="Detail"
                            className={`${CONTROL} w-9`}
                        >
                            <Gauge />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="min-w-52">
                        <DropdownMenuLabel>Detail</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                            value={choice}
                            onValueChange={(c) => choose(c as DetailChoice)}
                        >
                            {(["auto", "low", "medium", "high"] as DetailChoice[]).map((c) => (
                                <DropdownMenuRadioItem key={c} value={c}>
                                    {c === "auto"
                                        ? `Auto (now ${DETAILS[auto].label.toLowerCase()})`
                                        : DETAILS[c].label}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                        <p className="max-w-52 px-1.5 pt-1 pb-1.5 text-xs text-ink-muted">
                            Auto follows the frame rate: less detail if it stutters, more if
                            there&rsquo;s room.
                        </p>
                    </DropdownMenuContent>
                </DropdownMenu>
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
                        label:
                            mode === "3d" && focus
                                ? `Back to the start: ${focus.label}`
                                : "Show the whole view again",
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

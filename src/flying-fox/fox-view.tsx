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
    PersonStanding,
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
import {
    FOCUS_OUT,
    type FrameRate,
    type GLHandle,
    type SceneConfig,
} from "@/abseil-tower/tower-gl";
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
    drawnOverhead,
    FALL,
    foxLabels,
    foxLegend,
    foxPieces,
    foxStances,
    foxTargets,
    GRADE,
    GROUND,
    groundFaces,
    groundShade,
    groundY,
    LOG,
    onHawser,
    RIDER,
    SPAN,
    TEST_LOAD,
    TREE,
    TROLLEY_X,
    type FlatView,
    type FoxTarget,
} from "./fox";
import { RUN, sessionAt, simulateSession } from "./run";
import { RunClock } from "./run-clock";
import RunControls from "./run-controls";

/** The WebGL view, loaded only when it's first shown, with a message while it loads. */
const SceneGL = dynamic(() => import("@/abseil-tower/tower-gl").then((m) => m.SceneGL), {
    ssr: false,
    loading: () => <Loading3D />,
});

/** What moves through the timeline, in 3D, loaded with the WebGL view. */
const RunGL = dynamic(() => import("./run-gl"), { ssr: false });

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
    // The whole site, from behind the tree to past the anchor, with room to spare: the near end, at the tree, is drawn
    // bigger, as it's nearer.
    width: LOG.x - TREE.x + 35,
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
    // Out no further than it starts, where the whole site fits.
    zoomOut: 1,
    label: "The flying fox in 3D. Drag to turn it, scroll or pinch to zoom, and right-drag or drag with two fingers to move it.",
};

/** What the 3D view can lock onto, up the site from the tree to the log. */
const TARGETS = foxTargets();
/** Where the 3D view can stand and look round from. */
const STANCES = foxStances();

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

/**
 * What a flat view shows of `target`: the box round it as seen from `cam`, with some room round it, and never smaller
 * than a few metres across, so a small part still has some of what's round it.
 */
function targetFit(target: FoxTarget, cam: OrbitCamera): Fit {
    const [lo, hi] = [target.lo, target.hi];
    let [x, y] = [0, 0];
    for (const cx of [lo.x, hi.x])
        for (const cy of [lo.y, hi.y])
            for (const cz of [lo.z, hi.z]) {
                const d = vec3(cx, cy, cz).sub(target.centre);
                x = Math.max(x, Math.abs(d.dot(cam.right)));
                y = Math.max(y, Math.abs(d.dot(cam.up)));
            }
    return {
        centre: target.centre,
        width: Math.max(3 * x, 3),
        height: Math.max(3 * y, 3),
    };
}

/**
 * How far out a flat view may zoom: no further than the whole site, nor, locked onto a target, further than
 * `FOCUS_OUT` times as far out as it starts on it.
 */
function leastZoom(fit: Fit, siteFit: Fit, size: Vector2, locked: boolean): number {
    const site = startOf(siteFit, size).zoom;
    return locked ? Math.max(site, startOf(fit, size).zoom / FOCUS_OUT) : site;
}

/** The targets' names over their boxes: how wide each letter is and how far apart lines are (SVG units). */
const NAME = { width: 6.7, line: 13 };

/** How far a pointer may move (SVG units) and still count as a click rather than a drag. */
const CLICK = 6;
/** How far two fingers, or a trackpad's swipe, go sideways (pixels) to move on to the next target. */
const SWIPE = 60;

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
    // How a flat view's been zoomed and moved, from where it starts.
    const [moved, setMoved] = useState<Frame | null>(null);
    const setParams = (values: Record<string, string | null>) => {
        const url = new URL(window.location.href);
        for (const [name, value] of Object.entries(values)) {
            if (value === null) url.searchParams.delete(name);
            else url.searchParams.set(name, value);
        }
        window.history.replaceState(null, "", url);
    };
    const setParam = (name: string, value: string | null) => setParams({ [name]: value });
    const setMode = (m: Mode) => {
        setParam("view", m);
        setMoved(null);
    };
    // What every view's locked onto (`?target=trolley-a`), kept from view to view, or nothing to move freely.
    const target = TARGETS.find((t) => t.slug === params.get("target")) ?? null;
    // Where the 3D view stands, if anywhere (`?eye=loader`): only in 3D, and instead of a target.
    const stance =
        mode === "3d" ? (STANCES.find((e) => e.slug === params.get("eye")) ?? null) : null;
    const lockOn = (t: FoxTarget | null) => {
        setParams({ target: t?.slug ?? null, eye: null });
        setMoved(null);
    };
    const standAs = (slug: string) => setParams({ eye: slug, target: null });
    // Through the targets in turn, round from the last to the first.
    const step = (by: number) => {
        const i = target ? TARGETS.indexOf(target) : by > 0 ? -1 : TARGETS.length;
        lockOn(TARGETS[(i + by + TARGETS.length) % TARGETS.length]);
    };
    // For the swipes, which are watched from outside React's events.
    const stepRef = useRef(step);
    const lockedRef = useRef(false);
    const standingRef = useRef(false);
    useEffect(() => {
        stepRef.current = step;
        lockedRef.current = target !== null;
        standingRef.current = stance !== null;
    });
    // In 3D, what moves through the timeline is drawn apart from the rest (the hawsers, the trolleys, the return line
    // and the dynamic brake).
    const is3d = mode === "3d";
    const pieces = useMemo(() => foxPieces({ run: is3d }), [is3d]);
    // Both riders' runs, worked out once, and the clock they're played by.
    const session = useMemo(() => simulateSession(RUN), []);
    const clock = useMemo(() => new RunClock(session.length), [session]);
    // In 3D, each trolley's target follows the trolley.
    const focus = useMemo(() => {
        const side = target?.slug === "trolley-a" ? 1 : target?.slug === "trolley-b" ? -1 : 0;
        if (!target || !is3d || !side) return target;
        const start = onHawser(side > 0 ? TROLLEY_X.a : TROLLEY_X.b, side);
        const moving = () => {
            const s = sessionAt(session, clock.t);
            const q = side > 0 ? s.a : s.b;
            return vec3(q.x - start.x, q.y - start.y, 0);
        };
        return { ...target, moving };
    }, [target, is3d, session, clock]);
    const labels = useMemo(() => foxLabels(), []);
    const legend = foxLegend();
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
    const siteFit = MODES[mode].fit ?? MODES.side.fit!;
    const cam = new OrbitCamera(rad(flat.azimuth), rad(flat.elevation));
    // Locked onto a target, the view starts round it, and zooms about its middle.
    const fit = useMemo(
        () =>
            focus
                ? targetFit(focus, new OrbitCamera(rad(flat.azimuth), rad(flat.elevation)))
                : siteFit,
        [focus, flat.azimuth, flat.elevation, siteFit],
    );
    const start = startOf(fit, size);
    const least = leastZoom(fit, siteFit, size, focus !== null);
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
            // About the pointer, or about the middle when locked onto a target.
            const at = focus ? originOf(size) : toDrawing(svg, e.clientX, e.clientY);
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
                    leastZoom(fit, siteFit, size, focus !== null),
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
    }, [flat.azimuth, flat.elevation, fit, siteFit, size, mode, poke, focus]);

    // Swiping sideways with two fingers moves on to the next target (or back): on a trackpad, a sideways scroll, in
    // any view; on a touch screen, two fingers moving together, only when locked onto a target (otherwise they move
    // the view). Each swipe moves one target, however far it goes.
    useEffect(() => {
        const box = boxRef.current;
        if (!box) return;
        const wheel = { sum: 0, last: 0, done: false };
        const onWheel = (e: WheelEvent) => {
            // Not while standing somewhere, where there's no next one.
            if (standingRef.current) return;
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
                stepRef.current(Math.sign(wheel.sum));
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
            if (!swipe || swipe.done || touches.size !== 2 || !lockedRef.current) return;
            const now = both();
            const d = now.mid.sub(swipe.mid);
            const spreading = Math.abs(now.spread / Math.max(swipe.spread, 1) - 1);
            if (Math.abs(d.x) > SWIPE && Math.abs(d.x) > 2 * Math.abs(d.y) && spreading < 0.25) {
                swipe.done = true;
                // Fingers moving left bring on the next, as turning a page.
                stepRef.current(d.x < 0 ? 1 : -1);
            }
        };
        const onUp = (e: PointerEvent) => {
            touches.delete(e.pointerId);
            if (touches.size < 2) swipe = null;
        };
        const opts = { capture: true };
        box.addEventListener("wheel", onWheel, { capture: true, passive: false });
        box.addEventListener("pointerdown", onDown, opts);
        box.addEventListener("pointermove", onMove, opts);
        box.addEventListener("pointerup", onUp, opts);
        box.addEventListener("pointercancel", onUp, opts);
        return () => {
            box.removeEventListener("wheel", onWheel, opts);
            box.removeEventListener("pointerdown", onDown, opts);
            box.removeEventListener("pointermove", onMove, opts);
            box.removeEventListener("pointerup", onUp, opts);
            box.removeEventListener("pointercancel", onUp, opts);
        };
    }, []);

    // Back to front by each piece's middle; a section's sides facing away are left out, and what the overhead view
    // leaves out (the tree's branches).
    // Fine detail (a plate's edge, a bolt's head) is left out where it would be too small to see.
    const sorted = pieces
        .filter((p) => mode !== "overhead" || drawnOverhead(p))
        .filter((p) => p.fine === undefined || p.fine * ppm >= DETAILS[detail].finePx)
        .filter((p) => p.kind !== "face" || !p.normal || p.normal.dot(cam.toward) > 0)
        .map((piece) => ({ piece, key: nearness(piece, cam.toward) }))
        .sort((a, b) => a.key - b.key);

    const drag = (at: Vector2): NonNullable<typeof gesture.current> => ({ kind: "pan", at, frame });
    // Where a single pointer went down, to tell a click on a target's box from a drag.
    const pressed = useRef<Vector2 | null>(null);
    // Each target's box in the drawing, as its corner and size (SVG units).
    const boxOf = (t: FoxTarget) => {
        const f = targetFit(t, cam);
        const c = toSvg(f.centre);
        const [w, h] = [f.width * ppm, f.height * ppm];
        return { x: c.x - w / 2, y: c.y - h / 2, w, h };
    };
    // Each target's box, and how high its name's written: just over its box, or higher, clear of the names already
    // written, where boxes are close together.
    const namedBoxes = () => {
        const placed: { x0: number; x1: number; y: number }[] = [];
        return TARGETS.map((t) => {
            const b = boxOf(t);
            const [x0, x1] = [b.x, b.x + t.label.length * NAME.width + 4];
            let nameY = b.y - 5;
            while (placed.some((p) => p.x0 < x1 && x0 < p.x1 && Math.abs(p.y - nameY) < NAME.line))
                nameY -= NAME.line;
            placed.push({ x0, x1, y: nameY });
            return { t, b, nameY };
        });
    };
    // The smallest target's box under `at`, if any.
    const targetAt = (at: Vector2) =>
        TARGETS.map((t) => ({ t, b: boxOf(t) }))
            .filter(({ b }) => at.x >= b.x && at.x <= b.x + b.w && at.y >= b.y && at.y <= b.y + b.h)
            .sort((p, q) => p.b.w * p.b.h - q.b.w * q.b.h)[0]?.t;
    const startPinch = () => {
        const [a, b] = [...pointers.current.values()];
        gesture.current = { kind: "pinch", mid: a.mid(b), spread: a.distanceTo(b), frame };
    };
    const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const at = toDrawing(e.currentTarget, e.clientX, e.clientY);
        pointers.current.set(e.pointerId, at);
        pressed.current = pointers.current.size === 1 ? at : null;
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
            // Locked onto a target, it zooms about the middle and doesn't move.
            const [from, to] = focus ? [origin, origin] : [d.mid, a.mid(b)];
            setMoved(reframe(cam, origin, d.frame, from, to, zoom, least, fit));
            return;
        }
        if (focus) return;
        setMoved(reframe(cam, origin, d.frame, d.at, at, d.frame.zoom, least, fit));
    };
    const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
        // A click (not a drag) on a target's box in the free view locks onto it.
        const at = toDrawing(e.currentTarget, e.clientX, e.clientY);
        const click =
            e.type === "pointerup" &&
            pressed.current !== null &&
            pressed.current.distanceTo(at) < CLICK;
        if (!focus && click) {
            const t = targetAt(at);
            if (t) lockOn(t);
        }
        pressed.current = null;
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
            {/* Free, each target's box, faint, with its name: a click locks onto it. */}
            {inBrowser &&
                !focus &&
                namedBoxes().map(({ t, b, nameY }) => {
                    return (
                        <g
                            key={t.slug}
                            className="cursor-pointer opacity-60 transition-opacity hover:opacity-100"
                        >
                            <rect
                                x={b.x}
                                y={b.y}
                                width={b.w}
                                height={b.h}
                                rx={3}
                                fill="var(--ink-muted)"
                                fillOpacity={0.05}
                                stroke="var(--ink-muted)"
                                strokeWidth={1.2}
                                strokeDasharray="5 4"
                            />
                            <text
                                x={b.x + 2}
                                y={nameY}
                                fill="var(--ink-soft)"
                                fontSize={11}
                                fontWeight={600}
                                className="font-mono"
                                paintOrder="stroke"
                                stroke="var(--halo)"
                                strokeWidth={3}
                                strokeLinejoin="round"
                            >
                                {t.label}
                            </text>
                        </g>
                    );
                })}
            {/* Locked onto a target, what's part of it is labelled, as this view writes it. */}
            {inBrowser && focus && (
                <Callouts
                    labels={labels.filter(
                        (l) =>
                            l.target === focus.slug &&
                            (!l.views || l.views.includes(mode as FlatView)),
                    )}
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
            className="relative min-h-0 flex-1 overflow-hidden overscroll-x-none border-t border-border bg-surface"
        >
            {mode === "3d" ? (
                <SceneGL
                    scene={SCENE}
                    pieces={pieces}
                    labels={[]}
                    onReady={setGlView}
                    focus={focus}
                    stance={stance}
                    detail={{ dpr: DETAILS[detail].dpr, sides: DETAILS[detail].sides }}
                    onFrameRate={choice === "auto" ? onFrameRate : undefined}
                >
                    <RunGL
                        session={session}
                        setup={RUN}
                        clock={clock}
                        sides={DETAILS[detail].sides}
                    />
                </SceneGL>
            ) : (
                diagram
            )}
            {mode === "3d" && (
                <RunControls
                    session={session}
                    clock={clock}
                    className="absolute top-2 left-2 flex w-80 max-w-[calc(100%-4rem)] items-center gap-2 rounded-xl border border-border bg-surface/90 pr-3 shadow-lg backdrop-blur"
                />
            )}
            {/* Back to the target before, or on to the next, round from the last to the first: only on a target. */}
            {focus !== null &&
                [
                    {
                        by: -1,
                        label: "Look at the one before",
                        title: "Previous",
                        icon: <ChevronLeft />,
                    },
                    { by: 1, label: "Look at the next one", title: "Next", icon: <ChevronRight /> },
                ].map((b) => (
                    <button
                        key={b.by}
                        type="button"
                        aria-label={b.label}
                        title={b.title}
                        onClick={() => step(b.by)}
                        className={`absolute top-1/2 z-10 flex size-14 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft drop-shadow-[0_0_3px_var(--halo)] transition-colors hover:bg-surface/50 hover:text-ink-strong [&_svg]:size-11 ${
                            b.by < 0 ? "left-1" : "right-1"
                        }`}
                    >
                        {b.icon}
                    </button>
                ))}
            {/* The legend, or a button to show it, and under it how finely it's drawn. */}
            <div className="absolute top-2 right-2 flex max-h-[calc(100%-1rem)] max-w-[calc(100%-1rem)] flex-col items-end gap-2">
                <button
                    type="button"
                    onClick={() => setLegendOpen(true)}
                    aria-label="Show the legend"
                    title="Legend"
                    className={`${CONTROL} w-9 shrink-0 ${
                        legendOpen === null ? "flex sm:hidden" : legendOpen ? "hidden" : "flex"
                    }`}
                >
                    <Info />
                </button>
                <section
                    className={`min-h-0 w-72 max-w-full overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface/90 p-3 shadow-lg backdrop-blur ${
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
                        Set up to Scouts NSW&rsquo;s flying fox procedure on a made-up site: the
                        ground is level round each end and falls {FALL} m between them (a{" "}
                        {Math.round(GRADE * 1000) / 10}% grade over the span), with a hollow between
                        shaped to keep even a {RIDER.mass} kg rider&rsquo;s feet{" "}
                        {CLEARANCE.ride * 100} cm clear standing up, until the dismount zone, where
                        they can&rsquo;t quite stand. A {SPAN} m span, the hawsers tensioned to sag
                        5% with a {TEST_LOAD} kg test load at the middle, and drawn unloaded. Sizes
                        the procedure doesn&rsquo;t give are estimates.
                    </p>
                </section>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={`Detail: ${choice === "auto" ? `Auto, ${DETAILS[auto].label}` : DETAILS[choice].label}`}
                            title="Detail"
                            className={`${CONTROL} w-9 shrink-0`}
                        >
                            <Gauge />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="bottom" align="end" className="min-w-52">
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
            {/* What's shown: the 3D view or a flat one. */}
            <div className="absolute bottom-2 left-2">
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
                            onValueChange={(m) => setMode(m as Mode)}
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
            </div>
            {/* Free to move about the site, or locked onto one thing on it, in every view; or, in 3D, standing somewhere. */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={
                                stance
                                    ? `Standing as: ${stance.label}`
                                    : `Look at: ${focus?.label ?? "Free"}`
                            }
                            title="Look at"
                            className={`${CONTROL} gap-1.5 px-2.5 whitespace-nowrap`}
                        >
                            {stance ? <PersonStanding /> : focus ? <Eye /> : <Move3d />}
                            <span className="text-xs">
                                {stance?.label ?? focus?.label ?? "Free"}
                            </span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="center" className="min-w-52">
                        <DropdownMenuLabel>Look at</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                            value={stance ? `eye:${stance.slug}` : (focus?.slug ?? "free")}
                            onValueChange={(k) =>
                                k.startsWith("eye:")
                                    ? standAs(k.slice(4))
                                    : lockOn(TARGETS.find((t) => t.slug === k) ?? null)
                            }
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
                            {mode === "3d" && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel>Stand as</DropdownMenuLabel>
                                    {STANCES.map((e) => (
                                        <DropdownMenuRadioItem key={e.slug} value={`eye:${e.slug}`}>
                                            <PersonStanding />
                                            {e.label}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </>
                            )}
                        </DropdownMenuRadioGroup>
                        <p className="max-w-52 px-1.5 pt-1 pb-1.5 text-xs text-ink-muted">
                            Locked onto something, the view stays centred on it as it zooms (and
                            turns, in 3D). Swipe sideways with two fingers for the next one. Free
                            moves anywhere.
                            {mode === "3d" &&
                                " Standing somewhere, you look round from there: drag to turn, zoom to see further."}
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

"use client";

import { Info, Minus, Plus, RotateCcw, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Toggle } from "@/components/diagram/controls";
import { Label } from "@/components/diagram/svg";
import { useInBrowser } from "@/components/use-in-browser";
import { clamp, deg, rad } from "@/lib/math";
import { OrbitCamera } from "@/lib/orbit-camera";
import { svgNumber, svgPoints } from "@/lib/svg-path";
import { vec2, type Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import { placeLabel, type Box, type ObstacleGrid } from "./callout-layout";
import Loading3D from "./loading-3d";
import { layoutRig, legend, RIGS, rigSide, type RigLabel } from "./rig";
import {
    groundAt,
    groundCorners,
    LEVELS,
    OVERHEAD,
    plankLines,
    SIDE,
    tapeLayers,
    towerPieces,
    type Face,
    type Material,
    type Piece,
    type Rod,
} from "./tower";
import type { GLHandle } from "./tower-gl";

/** The WebGL view, loaded only when it's first shown, with a message while it loads. */
const TowerGL = dynamic(() => import("./tower-gl"), { ssr: false, loading: () => <Loading3D /> });

/** The least room (SVG units) the whole tower needs unzoomed. The drawing widens or deepens past it to fill its box. */
const W = 800;
const H = 1000;
/** SVG units per metre unzoomed: the same in every view, so the tower doesn't grow and shrink as it turns. */
const PPM = 60;
/** The point the camera turns about to start with. It sits in the middle of the drawing. */
const CENTRE = vec3(SIDE / 2, 5.4, SIDE / 2);

/** The drawing's size (SVG units) for a box `width` by `height` (pixels): at least `W` by `H`, in the box's shape. */
function drawingSize(width: number, height: number): Vector2 {
    if (width <= 0 || height <= 0) return vec2(W, H);
    return width / height > W / H ? vec2((H * width) / height, H) : vec2(W, (W * height) / width);
}
const originOf = (size: Vector2) => vec2(size.x / 2, size.y / 2 + 10);
const MAX_ZOOM = 8;

/** How close the view is, and the point it's centred on (which it turns about). */
type Frame = { zoom: number; target: Vector3 };
const WHOLE: Frame = { zoom: 1, target: CENTRE };

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
): Frame {
    const z = clamp(zoom, 1, MAX_ZOOM);
    const inView = (s: Vector2, ppm: number) =>
        vec2((s.x - origin.x) / ppm, (origin.y - s.y) / ppm);
    const [u, v] = [inView(from, PPM * start.zoom), inView(to, PPM * z)];
    const shift = cam.right.scale(u.x - v.x).add(cam.up.scale(u.y - v.y));
    return { zoom: z, target: start.target.add(shift) };
}

const COLOR: Record<Material, string> = {
    log: "var(--tower-log)",
    rail: "var(--tower-rail)",
    board: "var(--tower-board)",
    deck: "var(--tower-deck)",
    steel: "var(--tower-steel)",
    sling: "var(--knot-yellow)",
    rope: "var(--knot-blue)",
    bucket: "var(--rig-black)",
    person: "var(--rig-person)",
};
/** The narrowest some things are drawn (SVG units), however thin they are, so a rope never vanishes. */
const MIN_WIDTH: Partial<Record<Material, number>> = { sling: 4.5, rope: 3.5, steel: 1.6 };
const shade = (color: string, percent: number) =>
    `color-mix(in oklab, ${color} ${Math.round(percent)}%, black)`;

/** How wide the gaps between boards are (metres), drawn no thinner than a pixel. */
const JOINT_GAP = 0.01;

/** Where the light comes from: high in the north, as the sun is here. */
const LIGHT = vec3(0.3, 0.8, 0.5).unit();

/** The 3D view's compass presets: the bearing from the tower to the eye, and how far above level it looks down. */
type ViewName = "sw" | "se" | "ne" | "nw";
const VIEWS: Record<ViewName, { label: string; azimuth: number; elevation: number }> = {
    sw: { label: "SW", azimuth: 225, elevation: 25 },
    se: { label: "SE", azimuth: 135, elevation: 25 },
    ne: { label: "NE", azimuth: 45, elevation: 25 },
    nw: { label: "NW", azimuth: 315, elevation: 25 },
};

/**
 * How the tower's shown: drawn flat in SVG from straight above (north up) or level with it on one side, with only that
 * side's lines; or in 3D with WebGL, turned and tilted by dragging. Each flat view starts at its own frame, which the
 * reset button goes back to: a fixed one, or the closest that fits a box round a point.
 */
type Mode = "plan" | "west" | "east" | "3d";
type Start = Frame | { fit: { centre: Vector3; width: number; height: number } };
/** The elevations' box: levels 3 and 4 and the beam over them, the outrigger and the ropes just past the sides. */
const UPPER = (() => {
    const [bottom, top] = [LEVELS[3] - 0.8, OVERHEAD.upperY + OVERHEAD.r + 0.4];
    return {
        centre: vec3(SIDE / 2, (bottom + top) / 2, SIDE / 2),
        width: SIDE + 2.4,
        height: top - bottom,
    };
})();
/** The top deck, with a little room round it: the overhead view starts fitted to it. */
const TOP_DECK = {
    centre: vec3(SIDE / 2, LEVELS[4], SIDE / 2),
    width: SIDE + 0.7,
    height: SIDE + 0.7,
};
const MODES: Record<
    Mode,
    {
        label: string;
        camera?: { azimuth: number; elevation: number };
        start: Start;
        side?: "east" | "west";
    }
> = {
    plan: {
        label: "Overhead",
        camera: { azimuth: 180, elevation: 90 },
        start: { fit: TOP_DECK },
    },
    west: {
        label: "West elevation",
        camera: { azimuth: 270, elevation: 0 },
        start: { fit: UPPER },
        side: "west",
    },
    east: {
        label: "East elevation",
        camera: { azimuth: 90, elevation: 0 },
        start: { fit: UPPER },
        side: "east",
    },
    "3d": { label: "3D", start: WHOLE },
};

/** Each view's name in the page's address (`?view=`), so a view can be linked to. */
const VIEW_PARAM: Record<Mode, string> = {
    plan: "overhead",
    west: "west",
    east: "east",
    "3d": "3d",
};
const modeOf = (param: string | null): Mode =>
    (Object.keys(VIEW_PARAM) as Mode[]).find((m) => VIEW_PARAM[m] === param) ?? "3d";

/** Where a view starts, in a drawing `size` (SVG units). */
function startOf(start: Start, size: Vector2): Frame {
    if (!("fit" in start)) return start;
    const { centre, width, height } = start.fit;
    const zoom = clamp(Math.min(size.x / width, size.y / height) / PPM, 1, MAX_ZOOM);
    return { zoom, target: centre };
}

/**
 * A person's disc or rope coiled on a deck, put in the group of the deck rectangles it lies on and over them, so it's
 * drawn just after the nearest of them from every side. Anything else comes back as it is.
 */
function onDeck(piece: Piece, tower: Piece[]): Piece {
    // A person's disc, or a short run of rope lying on the deck or just coming off it (a coil and its ends).
    const ys = piece.kind === "rod" ? [] : piece.points.map((q) => q.y);
    const low =
        (piece.kind === "face" && piece.material === "person") ||
        (piece.kind === "strand" && Math.max(...ys) - Math.min(...ys) < 0.15);
    if (!low) return piece;
    // It's on the deck at its lowest point, over every rectangle its outline reaches.
    const pts = piece.points;
    const [x0, x1] = [Math.min(...pts.map((q) => q.x)), Math.max(...pts.map((q) => q.x))];
    const [z0, z1] = [Math.min(...pts.map((q) => q.z)), Math.max(...pts.map((q) => q.z))];
    const y = Math.min(...ys);
    const under = tower.filter((t) => {
        if (t.kind !== "face" || t.material !== "deck" || !t.group) return false;
        const xs = t.points.map((q) => q.x);
        const zs = t.points.map((q) => q.z);
        return (
            Math.abs(t.points[0].y - y) < 0.03 &&
            x1 >= Math.min(...xs) &&
            x0 <= Math.max(...xs) &&
            z1 >= Math.min(...zs) &&
            z0 <= Math.max(...zs)
        );
    });
    const [first, ...rest] = under.flatMap((t) => (t.group ? [t.group.at] : []));
    return first
        ? { ...piece, group: { at: first, over: true, across: rest.length ? rest : undefined } }
        : piece;
}

/** The highest point of a piece, for darkening what's below a level looked down on. */
function highest(p: Piece): number {
    if (p.kind === "rod") return Math.max(p.a.y, p.b.y) + p.r;
    return Math.max(...p.points.map((q) => q.y));
}

/** How a face's colour is shaded: lit faces brighter, those edge on to the light darker. */
function faceShade(f: Face): number {
    const [p0, p1, , p3] = f.points;
    const n = f.normal ?? p1.sub(p0).cross(p3.sub(p0)).unit();
    return 55 + 45 * Math.abs(n.dot(LIGHT));
}

/** The tower with the rig `slug` on it, in the view the page's address names (3D unless it names another). */
export default function TowerView({ slug }: { slug: string }) {
    const mode = modeOf(useSearchParams().get("view"));
    // Changing view changes the address in place, so it can be shared.
    const setMode = (m: Mode) => {
        const url = new URL(window.location.href);
        url.searchParams.set("view", VIEW_PARAM[m]);
        window.history.replaceState(null, "", url);
    };
    const { side } = MODES[mode];
    // The flat views' camera (the 3D view has its own).
    const camera = MODES[mode].camera ?? MODES.plan.camera!;
    const plan = mode === "plan";
    // Looking straight down, what's well below the level looked at is drawn darker, so openings in its deck show.
    const below = plan ? LEVELS[4] - 0.3 : undefined;
    const { azimuth, elevation } = camera;
    const rig = RIGS.find((r) => r.slug === slug) ?? RIGS[0];
    const laid = useMemo(() => layoutRig(rig, side ? rigSide(rig, side) : undefined), [rig, side]);
    // Where people stand, shown only when asked for, as they crowd the rigging.
    const [showPeople, setShowPeople] = useState(false);
    const pieces = useMemo(() => {
        const tower = towerPieces();
        const rigging = laid.pieces.filter((p) => showPeople || p.material !== "person");
        return [...tower, ...rigging.map((p) => onDeck(p, tower))];
    }, [laid, showPeople]);
    // Where the view's been moved to, or where it starts until it's moved.
    const [moved, setMoved] = useState<Frame | null>(null);
    // The WebGL view keeps its own camera: the page reaches it through this, and it says which way it's looking.
    const [glView, setGlView] = useState<GLHandle | null>(null);
    const [glTurned, setGlTurned] = useState({ azimuth: 0, elevation: 0 });
    const onGlTurn = useCallback(
        (azimuth: number, elevation: number) => setGlTurned({ azimuth, elevation }),
        [],
    );
    // Whether the legend's open: until it's toggled, open on wide screens and closed on phones, where it'd cover the
    // tower.
    const [legendOpen, setLegendOpen] = useState<boolean | null>(null);
    // The drawing's last digits can differ between the server and the browser, so it's drawn only in the browser.
    const inBrowser = useInBrowser();
    const svgRef = useRef<SVGSVGElement>(null);
    /** The box the drawing fills, which it matches in shape. */
    const boxRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState(vec2(W, H));
    const origin = originOf(size);
    /** The pointers down on the drawing, where each is now (SVG units). */
    const pointers = useRef(new Map<number, Vector2>());
    /** What a drag or pinch started from: panning, or a pinch (two touches). */
    const gesture = useRef<
        | { kind: "pan"; at: Vector2; frame: Frame }
        | { kind: "pinch"; mid: Vector2; spread: number; frame: Frame }
        | null
    >(null);

    const cam = new OrbitCamera(rad(azimuth), rad(elevation));
    const start = startOf(MODES[mode].start, size);
    const frame = moved ?? start;
    const ppm = PPM * frame.zoom;
    const toSvg = (p: Vector3): Vector2 => {
        const v = cam.project(p.sub(frame.target));
        return vec2(origin.x + v.x * ppm, origin.y - v.y * ppm);
    };

    // The drawing takes the shape of its box, so the tower stays the same size as the window changes shape.
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

    // Scrolling over the drawing zooms about the pointer, as does a trackpad pinch (which comes as a scroll with Ctrl).
    // The page itself never scrolls.
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const at = toDrawing(svg, e.clientX, e.clientY);
            // A mouse wheel's notch is around 100 pixels (or 3 lines); a pinch's steps are much smaller.
            const delta = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
            const rate = e.ctrlKey ? 0.01 : 0.0025;
            setMoved((moved) => {
                const f = moved ?? startOf(MODES[mode].start, size);
                return reframe(
                    new OrbitCamera(rad(azimuth), rad(elevation)),
                    originOf(size),
                    f,
                    at,
                    at,
                    f.zoom * Math.exp(-delta * rate),
                );
            });
        };
        svg.addEventListener("wheel", onWheel, { passive: false });
        return () => svg.removeEventListener("wheel", onWheel);
    }, [azimuth, elevation, size, mode]);

    // Back to front, by each piece's middle, except that the tower's shell comes first: what's on a side facing the eye
    // is drawn after everything inside it, and what's on a side facing away before (see `Shell`). Looking straight
    // down, every side is edge on, and height alone sets the order. A timber's sides
    // facing away are left out, being behind its others.
    const shown = (p: Piece) => p.kind !== "face" || !p.normal || p.normal.dot(cam.toward) > 0;
    const sortKey = (p: Piece) => {
        // A group's pieces sort together by its middle, then those facing the eye with `ahead` first, then by their own.
        const own = cam.depth(centreOf(p));
        const depth = p.group
            ? Math.max(...[p.group.at, ...(p.group.across ?? [])].map((q) => cam.depth(q))) +
              (p.group.ahead ? Math.sign(p.group.ahead.dot(cam.toward)) * 0.01 : 0) +
              (p.group.over ? 0.02 : 0) +
              own * 1e-4
            : own;
        if (!p.shell || plan) return depth;
        return depth + (p.shell.out.dot(cam.toward) > 0 ? 1 : -1) * p.shell.layer * 100;
    };
    // A label sorts just after the nearer end of the cylinder it's written on (or its point, without one), so it's
    // drawn over its own cylinder but under whatever's in front of it.
    const labelKey = (l: RigLabel) => {
        const half = l.on ? l.on.along.scale(l.on.length / 2) : vec3(0, 0, 0);
        const depth = Math.max(cam.depth(l.at.add(half)), cam.depth(l.at.sub(half))) + 0.01;
        if (!l.shell || plan) return depth;
        return depth + (l.shell.out.dot(cam.toward) > 0 ? 1 : -1) * l.shell.layer * 100;
    };
    // Looking down, labels are written on what they name, among the pieces; in the elevations they're written beside it,
    // over everything (see `Callouts`).
    const sorted: ({ piece: Piece } | { label: RigLabel })[] = [
        ...pieces.filter(shown).map((piece) => ({ piece, key: sortKey(piece) })),
        ...(plan ? laid.labels : [])
            // Looking straight down, what's under the top deck is hidden, so its labels are too.
            .filter((l) => below === undefined || l.at.y >= below)
            .map((label) => ({ label, key: labelKey(label) })),
    ].sort((a, b) => a.key - b.key);

    const view = (Object.keys(VIEWS) as ViewName[]).find(
        (k) => VIEWS[k].azimuth === glTurned.azimuth && VIEWS[k].elevation === glTurned.elevation,
    );

    // A drag moves the view, as on a map.
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
            setMoved(reframe(cam, origin, d.frame, d.mid, a.mid(b), zoom));
            return;
        }
        setMoved(reframe(cam, origin, d.frame, d.at, at, d.frame.zoom));
    };
    const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
        pointers.current.delete(e.pointerId);
        // Lifting one finger of a pinch carries on as a drag with the other, from where it is.
        const [rest] = [...pointers.current.entries()];
        gesture.current = null;
        if (pointers.current.size === 2) startPinch();
        else if (rest && e.pointerType === "touch") gesture.current = drag(rest[1]);
    };

    const compass: [string, Vector3][] = [
        ["N", vec3(SIDE / 2, groundAt(SIDE / 2), SIDE + 1.8)],
        ["S", vec3(SIDE / 2, groundAt(SIDE / 2), -1.8)],
        ["E", vec3(SIDE + 1.8, groundAt(SIDE + 1.8), SIDE / 2)],
        ["W", vec3(-2.2, groundAt(-2.2), SIDE / 2)],
    ];

    const diagram = (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${svgNumber(size.x)} ${svgNumber(size.y)}`}
            className="absolute inset-0 block h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
            role="img"
            aria-label={`The Cracroft abseil tower: ${MODES[mode].label}. Drag to move the view, and scroll or pinch to zoom.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(e) => e.preventDefault()}
        >
            <polygon points={svgPoints(groundCorners().map(toSvg))} fill="var(--tower-ground)" />
            {compass
                // Level with the tower, the two straight towards and away from the eye would sit on one spot.
                .filter(([, p]) => {
                    const away = vec3(p.x - SIDE / 2, 0, p.z - SIDE / 2).unit();
                    return Math.abs(away.dot(cam.toward)) < 0.95;
                })
                .map(([name, p]) => (
                    <Label key={name} at={toSvg(p)} color="var(--ink-muted)">
                        {name}
                    </Label>
                ))}
            {inBrowser &&
                sorted.map((d, i) =>
                    "piece" in d ? (
                        <PieceDrawing
                            key={i}
                            piece={d.piece}
                            toSvg={toSvg}
                            ppm={ppm}
                            dim={below !== undefined && highest(d.piece) < below ? 0.55 : 1}
                        />
                    ) : (
                        <RigLabelDrawing key={i} label={d.label} toSvg={toSvg} ppm={ppm} />
                    ),
                )}
            {inBrowser && !plan && (
                <Callouts
                    labels={laid.labels}
                    toSvg={toSvg}
                    ppm={ppm}
                    middle={toSvg(vec3(SIDE / 2, 0, SIDE / 2)).x}
                />
            )}
        </svg>
    );

    const zoomBy = (factor: number) =>
        mode === "3d"
            ? glView?.zoomBy(factor)
            : setMoved(reframe(cam, origin, frame, origin, origin, frame.zoom * factor));
    const key = legend(rig);

    // Laid out like a map: the drawing fills the box, with the legend over its top right, the views bottom left and
    // zoom bottom right.
    return (
        <div
            ref={boxRef}
            className="relative min-h-0 flex-1 overflow-hidden border-t border-border bg-surface"
        >
            {mode === "3d" ? (
                <TowerGL
                    pieces={pieces}
                    labels={laid.labels}
                    onReady={setGlView}
                    onTurn={onGlTurn}
                />
            ) : (
                diagram
            )}
            {/* Closed, the legend is just an info button. */}
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
                className={`absolute top-2 right-2 max-h-[calc(100%-1rem)] w-64 max-w-[calc(100%-1rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface/90 p-3 shadow-lg backdrop-blur ${
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
                {
                    <div className="mt-2 flex flex-col gap-2">
                        <h3 className="text-xs font-medium text-ink-strong">Rigging</h3>
                        <ul className="flex flex-col gap-1.5 text-xs text-ink-soft">
                            {key.cylinders.map((c) => (
                                <li key={c.text} className="flex items-center gap-2">
                                    <CylinderSwatch
                                        text={c.text}
                                        colors={c.colors}
                                        light={c.light}
                                    />
                                    <span>{c.name}</span>
                                </li>
                            ))}
                        </ul>
                        <ul className="flex flex-col gap-1 text-xs text-ink-soft">
                            {key.lines.map((l) => (
                                <li key={l.name} className="flex items-center gap-2">
                                    <span className="flex w-16 shrink-0 flex-col gap-1">
                                        {l.colors.map((c) => (
                                            <StrandSwatch key={c} color={c} look={l.look} />
                                        ))}
                                    </span>
                                    {l.name}
                                </li>
                            ))}
                        </ul>
                        {key.people.length > 0 && (
                            <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
                                <h3 className="text-xs font-medium text-ink-strong">People</h3>
                                <Toggle
                                    label="Show"
                                    checked={showPeople}
                                    onChange={setShowPeople}
                                />
                            </div>
                        )}
                        {showPeople && key.people.length > 0 && (
                            <ul className="flex flex-col gap-1 text-xs text-ink-soft">
                                {key.people.map((p) => (
                                    <li key={p.letter} className="flex items-center gap-2">
                                        <span className="flex w-16 shrink-0 justify-center">
                                            <PersonSwatch letter={p.letter} color={p.color} />
                                        </span>
                                        {p.name}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                }
            </section>
            {/* The views, and beside them along the bottom the 3D views' compass presets. */}
            <div className="absolute bottom-2 left-2 flex items-end gap-2">
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
                        aria-label="View the 3D tower from"
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
                        off: mode !== "3d" && frame.zoom <= 1,
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

export function centreOf(piece: Piece): Vector3 {
    if (piece.kind === "rod") return piece.a.lerp(piece.b, 0.5);
    // A strand by its middle along its length would do better, but its points' average is near enough.
    return piece.points.reduce((s, p) => s.add(p), vec3(0, 0, 0)).scale(1 / piece.points.length);
}

/**
 * How near a piece comes to the eye looking along `toward` (the larger, the nearer), for drawing back to front: its
 * middle, and for a rod, the side of it facing the eye, so a thin rod inside a thick one (an axle in its wheel) is
 * drawn before it.
 */
export function nearness(piece: Piece, toward: Vector3): number {
    const middle = centreOf(piece).dot(toward);
    if (piece.kind !== "rod") return middle;
    const along = piece.b.sub(piece.a);
    const len = along.len();
    const across = len > 0 ? Math.sqrt(Math.max(0, 1 - (along.dot(toward) / len) ** 2)) : 1;
    return middle + piece.r * across;
}

const MONO = "var(--font-geist-mono), monospace";

/** A legend's short length of tape or rope: a flat band for tape, a thinner cord for rope. */
export function StrandSwatch({ color, look }: { color: string; look: "tape" | "rope" }) {
    const [w, h] = [64, 9];
    const thick = look === "tape" ? 6 : 3.5;
    const line = { x1: thick / 2 + 1, x2: w - thick / 2 - 1, y1: h / 2, y2: h / 2 };
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="block">
            {/* A faint light edge, so a dark rope still shows on the dark card. */}
            <line
                {...line}
                stroke="var(--line)"
                strokeWidth={thick + 3}
                strokeLinecap={look === "tape" ? "butt" : "round"}
            />
            <line
                {...line}
                stroke={`color-mix(in oklab, ${color} 40%, black)`}
                strokeWidth={thick + 1.5}
                strokeLinecap={look === "tape" ? "butt" : "round"}
            />
            <line
                {...line}
                stroke={color}
                strokeWidth={thick}
                strokeLinecap={look === "tape" ? "butt" : "round"}
            />
        </svg>
    );
}

/** A legend's cylinder: a short pill in its colours (split along its length if two), its label on it. */
/** A legend's person: their pale disc with its letter. */
function PersonSwatch({ letter, color }: { letter: string; color: string }) {
    const d = 20;
    return (
        <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} aria-hidden className="shrink-0">
            <circle cx={d / 2} cy={d / 2} r={d / 2 - 1} fill={color} />
            <text
                x={d / 2}
                y={d / 2}
                fill="var(--rig-on-rope)"
                fontSize={11}
                fontWeight={600}
                fontFamily={MONO}
                textAnchor="middle"
                dominantBaseline="central"
            >
                {letter}
            </text>
        </svg>
    );
}

function CylinderSwatch({
    text,
    colors,
    light,
}: {
    text: string;
    colors: string[];
    light: boolean;
}) {
    const [w, h] = [64, 20];
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
            <defs>
                <clipPath id={`pill-${text}`}>
                    <rect x={1} y={1} width={w - 2} height={h - 2} rx={(h - 2) / 2} />
                </clipPath>
            </defs>
            <g clipPath={`url(#pill-${text})`}>
                {colors.map((c, i) => (
                    <rect
                        key={i}
                        x={(i * w) / colors.length}
                        y={0}
                        width={w / colors.length}
                        height={h}
                        fill={c}
                    />
                ))}
            </g>
            <rect
                x={1}
                y={1}
                width={w - 2}
                height={h - 2}
                rx={(h - 2) / 2}
                fill="none"
                stroke="var(--rig-on-rope)"
                strokeOpacity={0.5}
            />
            <text
                x={w / 2}
                y={h / 2 + 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10.5}
                fontWeight={600}
                fontFamily={MONO}
                fill={light ? "var(--ink-bright)" : "var(--rig-on-rope)"}
                {...(light && {
                    paintOrder: "stroke",
                    stroke: "var(--rig-on-rope)",
                    strokeWidth: 2.5,
                    strokeLinejoin: "round",
                })}
            >
                {text}
            </text>
        </svg>
    );
}
/** A monospaced character's width, as a fraction of the font size. */
const MONO_WIDTH = 0.6;

/**
 * A rig label. One on a cylinder is written along it, reading left to right: on it, sized to fit, where the cylinder's
 * drawn big enough to hold it legibly, and just beside it otherwise.
 */
function RigLabelDrawing({
    label,
    toSvg,
    ppm,
}: {
    label: RigLabel;
    toSvg: (p: Vector3) => Vector2;
    ppm: number;
}) {
    const at = toSvg(label.at);
    const halo = { paintOrder: "stroke", stroke: "var(--halo)", strokeWidth: 4 } as const;
    const { on } = label;
    const ends = on && [-0.5, 0.5].map((t) => toSvg(label.at.add(on.along.scale(t * on.length))));
    const span = ends && ends[1].sub(ends[0]);
    // Seen end on, the cylinder has no direction on the page to write along, so it's written beside it, but only once
    // it's drawn big enough to pick out.
    if (on && span && span.len() < 12 && 2 * on.r * ppm < 8) return null;
    if (!on || !span || span.len() < 12)
        return (
            <text
                x={at.x + 10}
                y={at.y + 12}
                fill="var(--ink-strong)"
                fontSize={13}
                fontFamily={MONO}
                dominantBaseline="hanging"
                {...halo}
            >
                {label.text}
            </text>
        );
    const turn = Math.atan2(span.y, span.x);
    // Turned to read left to right, never upside down.
    const upright = Math.abs(turn) > Math.PI / 2 ? turn + Math.PI : turn;
    const rotate = `rotate(${svgNumber(deg(upright))} ${svgNumber(at.x)} ${svgNumber(at.y)})`;
    const thick = 2 * on.r * ppm;
    const fits = Math.min(0.7 * thick, (0.72 * span.len()) / (label.text.length * MONO_WIDTH));
    if (fits >= 8)
        return (
            <text
                x={at.x}
                y={at.y}
                transform={rotate}
                fill={label.light ? "var(--ink-bright)" : "var(--rig-on-rope)"}
                {...(label.light && {
                    paintOrder: "stroke",
                    stroke: "var(--rig-on-rope)",
                    strokeWidth: fits * 0.25,
                    strokeLinejoin: "round",
                })}
                fontSize={fits}
                fontFamily={MONO}
                fontWeight={600}
                textAnchor="middle"
                dominantBaseline="central"
            >
                {label.text}
            </text>
        );
    // Too small to read, it's still written on, tiny, so every knot's named: zoom in to read it.
    return (
        <text
            x={at.x}
            y={at.y}
            transform={rotate}
            fill={label.light ? "var(--ink-bright)" : "var(--rig-on-rope)"}
            fontSize={Math.max(fits, 2)}
            fontFamily={MONO}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="central"
        >
            {label.text}
        </text>
    );
}

/** The elevations' labels: their size (SVG units), and the gap between a label and its knot. */
const CALLOUT = { font: 11, gap: 14, line: 14 };

/**
 * The elevations' labels, written level on the background beside what they name, with a short leader to it from its
 * middle. Each goes
 * out to the side of the tower its knot is on (`middle` is where the tower's middle is drawn, so panning never moves a
 * label across), unless its knot says otherwise, and moves down past any already written there.
 */
export function Callouts({
    labels,
    toSvg,
    ppm,
    middle,
    avoid,
}: {
    labels: RigLabel[];
    toSvg: (p: Vector3) => Vector2;
    ppm: number;
    middle: number;
    /** What's drawn, for the labels to keep off too, searching round their knots for a clear place. */
    avoid?: ObstacleGrid;
}) {
    const placed: Box[] = [];
    const overlaps = (b: Box) =>
        placed.some((p) => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0);
    const items = labels
        .map((label) => ({ label, at: toSvg(label.at) }))
        .sort((a, b) => a.at.y - b.at.y)
        .map(({ label, at }) => {
            const right = label.side ? label.side === "right" : at.x >= middle;
            const width = label.text.length * MONO_WIDTH * CALLOUT.font + 4;
            // Clear of the knot's side as it's drawn, however close the view.
            const gap = CALLOUT.gap + (label.on ? label.on.r * ppm : 0);
            const x = right ? at.x + gap : at.x - gap;
            const box = (y: number): Box => ({
                x0: right ? x - 2 : x - width,
                x1: right ? x + width : x + 2,
                y0: y - CALLOUT.font / 2 - 1,
                y1: y + CALLOUT.font / 2 + 1,
            });
            if (avoid) {
                const spot = placeLabel(at, width, CALLOUT.font, right, gap, placed, avoid);
                placed.push(spot.box);
                return { label, at, x: spot.x, y: spot.y, right: spot.right };
            }
            let y = at.y;
            for (let tries = 0; tries < 40 && overlaps(box(y)); tries++) y += CALLOUT.line / 2;
            placed.push(box(y));
            return { label, at, x, y, right };
        });
    return (
        <g>
            {items.map(({ at, x, y, right }, i) => (
                <line
                    key={`l${i}`}
                    x1={at.x}
                    y1={at.y}
                    x2={right ? x - 2 : x + 2}
                    y2={y}
                    stroke="var(--ink-muted)"
                    strokeWidth={1}
                />
            ))}
            {items.map(({ label, x, y, right }, i) => (
                <text
                    key={`t${i}`}
                    x={x}
                    y={y}
                    fill="var(--ink-strong)"
                    fontSize={CALLOUT.font}
                    fontFamily={MONO}
                    fontWeight={600}
                    textAnchor={right ? "start" : "end"}
                    dominantBaseline="central"
                    paintOrder="stroke"
                    stroke="var(--halo)"
                    strokeWidth={3}
                    strokeLinejoin="round"
                >
                    {label.text}
                </text>
            ))}
        </g>
    );
}

/** Where a point on the screen is in the drawing's SVG units. */
export function toDrawing(svg: SVGSVGElement, clientX: number, clientY: number): Vector2 {
    const m = svg.getScreenCTM();
    if (!m) return vec2(clientX, clientY);
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return vec2(p.x, p.y);
}

export function PieceDrawing({
    piece,
    toSvg,
    ppm,
    dim = 1,
    minWidth = MIN_WIDTH,
    depth,
}: {
    piece: Piece;
    toSvg: (p: Vector3) => Vector2;
    ppm: number;
    /** How near a point is to the eye (the larger, the nearer), for a true-size rod to show its nearer end. */
    depth?: (p: Vector3) => number;
    /** How bright it's drawn, darker for what's below the level looked down on. */
    dim?: number;
    /** The narrowest each material's drawn (SVG units), if not the tower's. */
    minWidth?: Partial<Record<Material, number>>;
}) {
    const own = piece.color || COLOR[piece.material];
    const color = dim < 1 ? shade(own, dim * 100) : own;
    if (piece.kind === "face") {
        const fill = shade(color, faceShade(piece));
        return (
            <g>
                {piece.holes?.length ? (
                    // Its holes cut out: each loop a subpath, filled even-odd.
                    <path
                        d={[piece.points, ...piece.holes]
                            .map((loop) => `M${svgPoints(loop.map(toSvg))}Z`)
                            .join("")}
                        fill={fill}
                        fillRule="evenodd"
                        stroke={piece.normal ? shade(color, 40) : fill}
                        strokeWidth={piece.normal ? 0.7 : 0.8}
                        strokeLinejoin="round"
                    />
                ) : (
                    <polygon
                        points={svgPoints(piece.points.map(toSvg))}
                        fill={fill}
                        stroke={piece.normal ? shade(color, 40) : fill}
                        strokeWidth={piece.normal ? 0.7 : 0.8}
                        strokeLinejoin="round"
                    />
                )}
                {piece.planks &&
                    plankLines(piece, piece.planks).map(([a, b], i) => {
                        const [p, q] = [toSvg(a), toSvg(b)];
                        return (
                            <line
                                key={i}
                                x1={p.x}
                                y1={p.y}
                                x2={q.x}
                                y2={q.y}
                                stroke={shade(color, 30)}
                                strokeWidth={Math.max(1, JOINT_GAP * ppm)}
                            />
                        );
                    })}
                {piece.text &&
                    (() => {
                        // Dark on the pale face, sized to a person's disc.
                        const at = toSvg(centreOf(piece));
                        return (
                            <text
                                x={at.x}
                                y={at.y}
                                fill="var(--rig-on-rope)"
                                fontSize={clamp(0.5 * ppm * 0.55, 9, 40)}
                                fontWeight={600}
                                fontFamily={MONO}
                                textAnchor="middle"
                                dominantBaseline="central"
                            >
                                {piece.text}
                            </text>
                        );
                    })()}
            </g>
        );
    }
    if (piece.kind === "strand") {
        // Tape is drawn as its flat layers, each its width wide; rope and wire as round as they are.
        const w = piece.tape
            ? Math.max(piece.tape.width * ppm, 1.5)
            : Math.max(2 * piece.r * ppm, minWidth[piece.material] ?? 0);
        return (
            <g>
                {tapeLayers(piece).map((layer, k) => (
                    <StrandLine
                        key={k}
                        pts={layer.map(toSvg)}
                        w={w}
                        color={color}
                        capA={piece.capA}
                        capB={piece.capB}
                        square={!!piece.tape}
                    />
                ))}
            </g>
        );
    }
    const a = toSvg(piece.a);
    const b = toSvg(piece.b);
    if (piece.toScale)
        return (
            <Cylinder
                piece={piece}
                a={a}
                b={b}
                r={Math.max(piece.r * ppm, (minWidth[piece.material] ?? 0) / 2)}
                ppm={ppm}
                color={color}
                depth={depth}
            />
        );
    const w = Math.max(2 * piece.r * ppm, minWidth[piece.material] ?? 0);
    const outline = w > 3;
    // A round end only where the rod really ends: between its lengths the joins must not show.
    const ends = (cap: boolean, p: Vector2) =>
        cap && (
            <circle
                cx={p.x}
                cy={p.y}
                r={w / 2 + (outline ? 1 : 0)}
                fill={outline ? shade(color, 45) : color}
            />
        );
    const endFills = (cap: boolean, p: Vector2) =>
        cap && outline && <circle cx={p.x} cy={p.y} r={w / 2 - 0.5} fill={color} />;
    // The outline is two lines along the rod's sides, so a length's outline never crosses the one before it. The fill
    // runs a little past each join so no hairline shows there.
    const along = b.sub(a).safeUnit(vec2(1, 0));
    const side = along.perp().scale(w / 2 + 0.25);
    const past = along.scale(0.6);
    const fa = piece.capA ? a : a.sub(past);
    const fb = piece.capB ? b : b.add(past);
    const edge = (s: number) => {
        const [p, q] = [a.add(side.scale(s)), b.add(side.scale(s))];
        return (
            <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={shade(color, 45)} strokeWidth={1.5} />
        );
    };
    return (
        <g>
            {ends(piece.capA, a)}
            {ends(piece.capB, b)}
            {endFills(piece.capA, a)}
            {endFills(piece.capB, b)}
            <line
                x1={fa.x}
                y1={fa.y}
                x2={fb.x}
                y2={fb.y}
                stroke={color}
                strokeWidth={outline ? w - 0.5 : w}
            />
            {outline && edge(1)}
            {outline && edge(-1)}
        </g>
    );
}

/**
 * A true-size rod (a part of some hardware) as the solid it is: a cylinder with flat ends, each end an ellipse as it's
 * seen at an angle, the nearer one drawn over its side.
 */
function Cylinder({
    piece,
    a,
    b,
    r,
    ppm,
    color,
    depth,
}: {
    piece: Rod;
    a: Vector2;
    b: Vector2;
    /** Its radius as drawn (SVG units). */
    r: number;
    ppm: number;
    color: string;
    depth?: (p: Vector3) => number;
}) {
    const length = piece.a.distanceTo(piece.b) * ppm;
    const shown = a.distanceTo(b);
    // How round its ends look: the sine of the angle between the rod and the page.
    const open = Math.sqrt(Math.max(0, 1 - (shown / Math.max(length, 1e-9)) ** 2));
    const along = b.sub(a).safeUnit(vec2(1, 0));
    const across = along.perp().scale(r);
    const edge = shade(color, 45);
    const end = (p: Vector2, key: string) => (
        <ellipse
            key={key}
            cx={p.x}
            cy={p.y}
            rx={Math.max(r * open, 0.01)}
            ry={r}
            transform={`rotate(${svgNumber(deg(Math.atan2(along.y, along.x)))} ${svgNumber(p.x)} ${svgNumber(p.y)})`}
            fill={shade(color, 85)}
            stroke={edge}
            strokeWidth={r > 1.5 ? 0.7 : 0}
        />
    );
    const nearB = depth ? depth(piece.b) > depth(piece.a) : true;
    const [far, near] = nearB ? [a, b] : [b, a];
    return (
        <g>
            {end(far, "far")}
            <polygon
                points={svgPoints([a.add(across), b.add(across), b.sub(across), a.sub(across)])}
                fill={color}
            />
            {r > 1.5 &&
                [1, -1].map((s) => {
                    const [p, q] = [a.add(across.scale(s)), b.add(across.scale(s))];
                    return (
                        <line
                            key={s}
                            x1={p.x}
                            y1={p.y}
                            x2={q.x}
                            y2={q.y}
                            stroke={edge}
                            strokeWidth={0.7}
                        />
                    );
                })}
            {end(near, "near")}
        </g>
    );
}

/**
 * One line of rope or tape through `pts` (SVG units), `w` wide with a dark edge. Where it joins another strand its ends
 * are cut square, with the fill running a little past so no line shows across the join; real ends are rounded, or
 * square for tape.
 */
function StrandLine({
    pts,
    w,
    color,
    capA,
    capB,
    square,
}: {
    pts: Vector2[];
    w: number;
    color: string;
    capA: boolean;
    capB: boolean;
    square: boolean;
}) {
    const n = pts.length - 1;
    const past = (end: Vector2, next: Vector2) =>
        end.add(end.sub(next).safeUnit(vec2(0, 0)).scale(0.8));
    const fillPts = [
        capA ? pts[0] : past(pts[0], pts[1]),
        ...pts.slice(1, n),
        capB ? pts[n] : past(pts[n], pts[n - 1]),
    ];
    const cut = {
        fill: "none",
        strokeLinecap: "butt",
        strokeLinejoin: square ? "miter" : "round",
    } as const;
    const caps = square ? [] : [capA && pts[0], capB && pts[n]].filter((p): p is Vector2 => !!p);
    // A closed loop (a ring, a carabiner) is drawn as one, so it joins round where it starts and ends.
    if (!capA && !capB && n > 2 && pts[0].distanceTo(pts[n]) < 1e-3) {
        const d = `M${svgPoints(pts.slice(0, n))}Z`;
        return (
            <g>
                <path {...cut} d={d} stroke={shade(color, 40)} strokeWidth={w + 2} />
                <path {...cut} d={d} stroke={color} strokeWidth={w} />
            </g>
        );
    }
    return (
        <g>
            <polyline
                {...cut}
                points={svgPoints(pts)}
                stroke={shade(color, 40)}
                strokeWidth={w + 2}
            />
            {caps.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={w / 2 + 1} fill={shade(color, 40)} />
            ))}
            <polyline {...cut} points={svgPoints(fillPts)} stroke={color} strokeWidth={w} />
            {caps.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={w / 2} fill={color} />
            ))}
        </g>
    );
}

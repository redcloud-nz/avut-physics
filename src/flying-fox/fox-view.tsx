"use client";

import { Box, Eye, Map as MapIcon, Move3d, PanelBottom, PersonStanding } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { OVERLAY_CONTROL } from "@/components/overlay-control";
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
import { drawnOverhead } from "@/flying-fox/rig/shared";
import { rad } from "@/lib/math";
import { OrbitCamera } from "@/lib/orbit-camera";
import { svgNumber, svgPoints } from "@/lib/svg-path";
import { vec2, type Vector2 } from "@/lib/vector2";
import { vec3 } from "@/lib/vector3";
import { setAddressParams } from "@/scene/address";
import { ObstacleGrid, obstaclesOf } from "@/scene/callout-layout";
import { DETAILS } from "@/scene/detail";
import Loading3D from "@/scene/loading-3d";
import { Callouts, nearness, PieceDrawing, StrandSwatch } from "@/scene/piece-svg";
import type { Piece } from "@/scene/pieces";
import { FOCUS_OUT, type GLHandle, type SceneConfig } from "@/scene/scene-gl";
import { targetAt, TargetBoxes } from "@/scene/target-boxes";
import { inBox, inFit, targetFit, type Target } from "@/scene/targets";
import { useDetail } from "@/scene/use-detail";
import { useFlatView, zoomToFit, type Fit } from "@/scene/use-flat-view";
import { useTargetSwipe } from "@/scene/use-target-swipe";
import { DetailMenu, LegendPanel, StepButtons, ZoomButtons } from "@/scene/viewer-controls";

import { foxPieces } from "./fox";
import { GROUND, groundFaces, groundShade } from "./ground";
import { foxLabels, foxLegend, type FlatView } from "./labels";
import { RUN, sessionAt, simulateSession } from "./run";
import { RunClock } from "./run-clock";
import RunControls from "./run-controls";
import { FALL, groundY, LOG, onHawser, TREE, TROLLEY_X } from "./site";
import { foxStances, foxTargets } from "./targets";

/** The WebGL view, loaded only when it's first shown, with a message while it loads. */
const SceneGL = dynamic(() => import("@/scene/scene-gl").then((m) => m.SceneGL), {
    ssr: false,
    loading: () => <Loading3D />,
});

/** What moves through the timeline, in 3D, loaded with the WebGL view. */
const RunGL = dynamic(() => import("./run-gl"), { ssr: false });

/** The least room (SVG units) the drawing needs unzoomed; it widens or deepens past it to fill its box. */
const LEAST = vec2(1000, 600);
/** SVG units per metre unzoomed. */
const PPM = 8;
/** How far in the flat views zoom, and the least zoom they start at. */
const ZOOM = { most: 60, leastStart: 0.2 };

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

/** Where the detail chosen on the page is kept between visits. */
const DETAIL_KEY = "flying-fox:detail";

/** What the 3D view can lock onto, up the site from the tree to the log. */
const TARGETS = foxTargets();
/** Where the 3D view can stand and look round from. */
const STANCES = foxStances();

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

/**
 * How far out a flat view may zoom: no further than the whole site, nor, locked onto a target, further than
 * `FOCUS_OUT` times as far out as it starts on it.
 */
function leastZoom(fit: Fit, siteFit: Fit, size: Vector2, locked: boolean): number {
    const site = zoomToFit(siteFit, size, PPM, ZOOM.leastStart, ZOOM.most);
    return locked
        ? Math.max(site, zoomToFit(fit, size, PPM, ZOOM.leastStart, ZOOM.most) / FOCUS_OUT)
        : site;
}

/** The flying fox, in the view the page's address names (`?view=side` or `overhead`; 3D unless it names one). */
export default function FoxView() {
    const params = useSearchParams();
    const mode = modeOf(params.get("view"));
    const setParams = setAddressParams;
    const setMode = (m: Mode) => setParams({ view: m });
    // What every view's locked onto (`?target=trolley-a`), kept from view to view, or nothing to move freely.
    const target = TARGETS.find((t) => t.slug === params.get("target")) ?? null;
    // Where the 3D view stands, if anywhere (`?eye=loader`): only in 3D, and instead of a target.
    const stance =
        mode === "3d" ? (STANCES.find((e) => e.slug === params.get("eye")) ?? null) : null;
    const lockOn = (t: Target | null) => setParams({ target: t?.slug ?? null, eye: null });
    const standAs = (slug: string) => setParams({ eye: slug, target: null });
    // Through the targets in turn, round from the last to the first.
    const step = (by: number) => {
        const i = target ? TARGETS.indexOf(target) : by > 0 ? -1 : TARGETS.length;
        lockOn(TARGETS[(i + by + TARGETS.length) % TARGETS.length]);
    };
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
    const legend = useMemo(() => foxLegend(), []);
    const [glView, setGlView] = useState<GLHandle | null>(null);
    const inBrowser = useInBrowser();
    const { choice, choose, auto, detail, onFrameRate, poke } = useDetail(DETAIL_KEY);
    const flat = MODES[mode].camera ?? MODES.side.camera!;
    const siteFit = MODES[mode].fit ?? MODES.side.fit!;
    const cam = useMemo(
        () => new OrbitCamera(rad(flat.azimuth), rad(flat.elevation)),
        [flat.azimuth, flat.elevation],
    );
    // Locked onto a target, the view starts round it, zooms about its middle, and is panned only if it may be.
    const fit = useMemo(() => (focus ? targetFit(focus, cam) : siteFit), [focus, cam, siteFit]);
    const view = useFlatView({
        camera: cam,
        least: LEAST,
        ppm: PPM,
        zoom: ZOOM,
        fit,
        leastZoom: (size) => leastZoom(fit, siteFit, size, focus !== null),
        keepIn: (t) => (focus?.pan ? inBox(focus.pan, t) : inFit(cam, fit, t)),
        locked: focus ? { pan: !!focus.pan } : undefined,
        resetKey: `${mode}|${target?.slug ?? ""}`,
        onMove: poke,
        // A click (not a drag) on a target's box in the free view locks onto it.
        onClick: (at) => {
            const t = focus ? undefined : targetAt(TARGETS, { cam, toSvg, ppm }, at);
            if (t) lockOn(t);
        },
    });
    const { boxRef, svgRef, size, ppm, toSvg } = view;
    useTargetSwipe(boxRef, { step, locked: target !== null, standing: stance !== null });

    // Back to front by each piece's middle; a section's sides facing away are left out, and what the overhead view
    // leaves out (the tree's branches).
    // Fine detail (a plate's edge, a bolt's head) is left out where it would be too small to see, and what's off screen.
    // None in 3D, where the flat drawing isn't shown.
    const sorted = (mode === "3d" ? [] : pieces)
        .filter(view.onScreen)
        .filter((p) => mode !== "overhead" || drawnOverhead(p))
        .filter((p) => p.fine === undefined || p.fine * ppm >= DETAILS[detail].finePx)
        .filter((p) => p.kind !== "face" || !p.normal || p.normal.dot(cam.toward) > 0)
        .map((piece) => ({ piece, key: nearness(piece, cam.toward) }))
        .sort((a, b) => a.key - b.key);

    const diagram = (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${svgNumber(size.x)} ${svgNumber(size.y)}`}
            className="absolute inset-0 block h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
            role="img"
            aria-label={`The flying fox: ${MODES[mode].label}. Drag to move the view, and scroll or pinch to zoom.`}
            {...view.handlers}
        >
            {mode === "overhead" && (
                <g>
                    {GROUND_FACES.map((f, i) =>
                        f.kind === "face" && view.onScreen(f) ? (
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
            {inBrowser && !focus && (
                <TargetBoxes targets={TARGETS} cam={cam} toSvg={toSvg} ppm={ppm} />
            )}
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
        mode === "3d" ? glView?.zoomBy(factor) : view.zoomBy(factor);

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
                    onFrameRate={onFrameRate}
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
            {focus !== null && <StepButtons onStep={step} />}
            {/* The legend, or a button to show it, and under it how finely it's drawn. */}
            <div className="absolute top-2 right-2 flex max-h-[calc(100%-1rem)] max-w-[calc(100%-1rem)] flex-col items-end gap-2">
                <LegendPanel>
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
                </LegendPanel>
                <DetailMenu choice={choice} onChoose={choose} auto={auto} />
            </div>
            {/* What's shown: the 3D view or a flat one. */}
            <div className="absolute bottom-2 left-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={`View: ${MODES[mode].label}`}
                            title="View"
                            className={`${OVERLAY_CONTROL} gap-1.5 px-2.5`}
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
                            className={`${OVERLAY_CONTROL} gap-1.5 px-2.5 whitespace-nowrap`}
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
            <ZoomButtons
                onZoom={zoomBy}
                onReset={() => (mode === "3d" ? glView?.reset() : view.reset())}
                nearest={mode !== "3d" && view.nearest}
                furthest={mode !== "3d" && view.furthest}
                resetLabel={
                    mode === "3d" && focus
                        ? `Back to the start: ${focus.label}`
                        : "Show the whole view again"
                }
            />
        </div>
    );
}

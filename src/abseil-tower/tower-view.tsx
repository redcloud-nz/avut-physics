"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { Toggle } from "@/components/diagram/controls";
import { Label } from "@/components/diagram/svg";
import { useInBrowser } from "@/components/use-in-browser";
import { rad } from "@/lib/math";
import { OrbitCamera } from "@/lib/orbit-camera";
import { svgNumber, svgPoints } from "@/lib/svg-path";
import { vec2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";
import { setAddressParams } from "@/scene/address";
import Loading3D from "@/scene/loading-3d";
import {
    Callouts,
    CylinderSwatch,
    flatDepth,
    PersonSwatch,
    PieceDrawing,
    RigLabelDrawing,
    StrandSwatch,
} from "@/scene/piece-svg";
import { type Piece, type RigLabel } from "@/scene/pieces";
import type { GLHandle } from "@/scene/scene-gl";
import { useFlatView, type Fit } from "@/scene/use-flat-view";
import { LegendPanel, ZoomButtons } from "@/scene/viewer-controls";

import { FLAT_HAIRLINE, KNOT_LABELS, layoutRig, legend, RIGS, rigSide } from "./rig";
import { groundAt, groundCorners, LEVELS, OVERHEAD, SIDE, towerPieces } from "./tower";

/** The WebGL view, loaded only when it's first shown, with a message while it loads. */
const TowerGL = dynamic(() => import("./tower-gl"), { ssr: false, loading: () => <Loading3D /> });

/** The least room (SVG units) the whole tower needs unzoomed. The drawing widens or deepens past it to fill its box. */
const LEAST = vec2(800, 1000);
/** SVG units per metre unzoomed: the same in every view, so the tower doesn't grow and shrink as it turns. */
const PPM = 60;
/**
 * How far the flat views zoom in, and the least zoom they start at (and may zoom out to): in far enough to see a knot
 * on a carabiner, about fifteen times as close as the top deck's first shown.
 */
const ZOOM = { most: 40, leastStart: 1 };
/** How far below the drawing's middle the view's middle is (SVG units). */
const DROP = 10;

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
        fit?: Fit;
        side?: "east" | "west";
    }
> = {
    plan: {
        label: "Overhead",
        camera: { azimuth: 180, elevation: 90 },
        fit: TOP_DECK,
    },
    west: {
        label: "West elevation",
        camera: { azimuth: 270, elevation: 0 },
        fit: UPPER,
        side: "west",
    },
    east: {
        label: "East elevation",
        camera: { azimuth: 90, elevation: 0 },
        fit: UPPER,
        side: "east",
    },
    "3d": { label: "3D" },
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

/** The tower with the rig `slug` on it, in the view the page's address names (3D unless it names another). */
export default function TowerView({ slug }: { slug: string }) {
    const mode = modeOf(useSearchParams().get("view"));
    // Changing view changes the address in place, so it can be shared.
    const setMode = (m: Mode) => setAddressParams({ view: VIEW_PARAM[m] });
    const { side } = MODES[mode];
    // The flat views' camera (the 3D view has its own).
    const camera = MODES[mode].camera ?? MODES.plan.camera!;
    const plan = mode === "plan";
    // Looking straight down, what's well below the level looked at is drawn darker, so openings in its deck show.
    const below = plan ? LEVELS[4] - 0.3 : undefined;
    const { azimuth, elevation } = camera;
    const rig = RIGS.find((r) => r.slug === slug) ?? RIGS[0];
    // The figure 8s are drawn as they're tied, so their labels can be turned off. In 3D, where labels are written on
    // cylinders, the knots are drawn as labelled cylinders while their labels are on.
    const [showKnotLabels, setShowKnotLabels] = useState(false);
    const knotCylinders = mode === "3d" && showKnotLabels;
    const cam = useMemo(() => new OrbitCamera(rad(azimuth), rad(elevation)), [azimuth, elevation]);
    // In the flat views the carabiners and knots are laid face on to the eye, so each shows its shape.
    const face = mode === "3d" ? undefined : cam.toward;
    const laid = useMemo(
        () => layoutRig(rig, side ? rigSide(rig, side) : undefined, { knotCylinders, face }),
        [rig, side, knotCylinders, face],
    );
    // Where people stand, shown only when asked for, as they crowd the rigging.
    const [showPeople, setShowPeople] = useState(false);
    const labels = useMemo(() => {
        const knotLabels = new Set(Object.values(KNOT_LABELS));
        return laid.labels.filter((l) => showKnotLabels || !knotLabels.has(l.text));
    }, [laid, showKnotLabels]);
    const pieces = useMemo(() => {
        const tower = towerPieces();
        const rigging = laid.pieces.filter((p) => showPeople || p.material !== "person");
        return [...tower, ...rigging.map((p) => onDeck(p, tower))];
    }, [laid, showPeople]);
    // The WebGL view keeps its own camera: the page reaches it through this, and it says which way it's looking.
    const [glView, setGlView] = useState<GLHandle | null>(null);
    const [glTurned, setGlTurned] = useState({ azimuth: 0, elevation: 0 });
    const onGlTurn = useCallback(
        (azimuth: number, elevation: number) => setGlTurned({ azimuth, elevation }),
        [],
    );
    // The drawing's last digits can differ between the server and the browser, so it's drawn only in the browser.
    const inBrowser = useInBrowser();
    // A flat view, moved like a map; changing view starts it afresh.
    const flatView = useFlatView({
        camera: cam,
        least: LEAST,
        ppm: PPM,
        zoom: ZOOM,
        fit: MODES[mode].fit ?? TOP_DECK,
        drop: DROP,
        resetKey: mode,
    });
    const { boxRef, svgRef, liveRef, size, ppm, toSvg } = flatView;

    // Back to front, by each piece's middle, except that the tower's shell comes first: what's on a side facing the eye
    // is drawn after everything inside it, and what's on a side facing away before (see `Shell`). Looking straight
    // down, every side is edge on, and height alone sets the order. A timber's sides
    // facing away are left out, being behind its others, and what's off screen.
    const shown = (p: Piece) =>
        (p.kind !== "face" || !p.normal || p.normal.dot(cam.toward) > 0) && flatView.onScreen(p);
    const sortKey = (p: Piece) => flatDepth(p, cam.toward, plan);
    // A label sorts just after the nearer end of the cylinder it's written on (or its point, without one), so it's
    // drawn over its own cylinder but under whatever's in front of it.
    const labelKey = (l: RigLabel) => {
        const half = l.on ? l.on.along.scale(l.on.length / 2) : vec3(0, 0, 0);
        const depth = Math.max(cam.depth(l.at.add(half)), cam.depth(l.at.sub(half))) + 0.01;
        if (!l.shell || plan) return depth;
        return depth + (l.shell.out.dot(cam.toward) > 0 ? 1 : -1) * l.shell.layer * 100;
    };
    // Looking straight down, what's under the top deck is hidden, so its labels are too.
    const planLabels = labels.filter((l) => below === undefined || l.at.y >= below);
    // Looking down, labels are written on the cylinders they name, among the pieces, and the drawn knots' beside them;
    // in the elevations they're all written beside what they name, over everything (see `Callouts`). None in 3D, where
    // the flat drawing isn't shown.
    const sorted: ({ piece: Piece } | { label: RigLabel })[] = [
        ...(mode === "3d" ? [] : pieces)
            .filter(shown)
            .map((piece) => ({ piece, key: sortKey(piece) })),
        ...(plan ? planLabels.filter((l) => l.on) : []).map((label) => ({
            label,
            key: labelKey(label),
        })),
    ].sort((a, b) => a.key - b.key);

    const view = (Object.keys(VIEWS) as ViewName[]).find(
        (k) => VIEWS[k].azimuth === glTurned.azimuth && VIEWS[k].elevation === glTurned.elevation,
    );

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
            {...flatView.handlers}
        >
            {/* All of it, so a wheel zoom can be shown at once by scaling it (see `useFlatView`). */}
            <g ref={liveRef}>
                <polygon
                    points={svgPoints(groundCorners().map(toSvg))}
                    fill="var(--tower-ground)"
                />
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
                                minWidth={FLAT_HAIRLINE}
                                thinEdges
                            />
                        ) : (
                            <RigLabelDrawing key={i} label={d.label} toSvg={toSvg} ppm={ppm} />
                        ),
                    )}
                {inBrowser && (
                    <Callouts
                        labels={plan ? planLabels.filter((l) => !l.on) : labels}
                        toSvg={toSvg}
                        ppm={ppm}
                        middle={toSvg(vec3(SIDE / 2, 0, SIDE / 2)).x}
                        lookingDown={plan}
                    />
                )}
            </g>
        </svg>
    );

    const zoomBy = (factor: number) =>
        mode === "3d" ? glView?.zoomBy(factor) : flatView.zoomBy(factor);
    const key = legend(rig);

    // Laid out like a map: the drawing fills the box, with the legend over its top right, the views bottom left and
    // zoom bottom right.
    return (
        <div
            ref={boxRef}
            className="relative min-h-0 flex-1 overflow-hidden border-t border-border bg-surface"
        >
            {mode === "3d" ? (
                <TowerGL pieces={pieces} labels={labels} onReady={setGlView} onTurn={onGlTurn} />
            ) : (
                diagram
            )}
            {/* The legend, or a button to show it. */}
            <div className="absolute top-2 right-2 flex max-h-[calc(100%-1rem)] max-w-[calc(100%-1rem)] flex-col items-end">
                <LegendPanel className="w-64">
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
                        {key.knots.length > 0 && (
                            <div className="mt-1 flex flex-col gap-1.5 border-t border-border pt-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-medium text-ink-strong">Knots</h3>
                                    <Toggle
                                        label="Labels"
                                        checked={showKnotLabels}
                                        onChange={setShowKnotLabels}
                                    />
                                </div>
                                <ul className="flex flex-col gap-1.5 text-xs text-ink-soft">
                                    {key.knots.map((k) => (
                                        <li key={k.text} className="flex items-center gap-2">
                                            <span className="w-16 shrink-0 text-center font-mono text-[0.65rem] font-semibold text-ink-strong">
                                                {k.text}
                                            </span>
                                            <span>{k.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
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
                </LegendPanel>
            </div>
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
                            onClick={() => setMode(m)}
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
            <ZoomButtons
                onZoom={zoomBy}
                onReset={() => (mode === "3d" ? glView?.reset() : flatView.reset())}
                nearest={mode !== "3d" && flatView.nearest}
                furthest={mode !== "3d" && flatView.furthest}
            />
        </div>
    );
}

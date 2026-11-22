"use client";

import { ChevronDown, Gauge, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import Loading3D from "@/abseil-tower/loading-3d";
import type { Piece } from "@/abseil-tower/tower";
import type { GLHandle, SceneConfig } from "@/abseil-tower/tower-gl";
import { centreOf, PieceDrawing } from "@/abseil-tower/tower-view";
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
import { DETAILS, type Detail } from "@/flying-fox/detail";
import { rad } from "@/lib/math";
import { OrbitCamera } from "@/lib/orbit-camera";
import { svgNumber } from "@/lib/svg-path";
import { vec2, type Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import { GROUPS, partOf, PARTS, type Part } from "./catalogue";

const SceneGL = dynamic(() => import("@/abseil-tower/tower-gl").then((m) => m.SceneGL), {
    ssr: false,
    loading: () => <Loading3D />,
});

/** The look of the round-cornered buttons over the drawing. */
const CONTROL =
    "flex h-9 items-center justify-center rounded-lg border border-border bg-surface/90 text-ink-soft shadow-lg backdrop-blur transition-colors hover:bg-line-faint [&_svg]:size-4";

/** The flat views beside the 3D one: square on from the front, the side and above. */
const FLATS = [
    { label: "Front", azimuth: 180, elevation: 0 },
    { label: "Side", azimuth: 90, elevation: 0 },
    { label: "Top", azimuth: 180, elevation: 90 },
];

/** Every point a piece is drawn through. */
const pointsOf = (p: Piece): Vector3[] => (p.kind === "rod" ? [p.a, p.b] : p.points);

/** The box round the pieces: its middle, and how big it is across its longest side (metres). */
function bounds(pieces: Piece[]): { centre: Vector3; size: number } {
    const all = pieces.flatMap(pointsOf);
    const lo = vec3(
        Math.min(...all.map((p) => p.x)),
        Math.min(...all.map((p) => p.y)),
        Math.min(...all.map((p) => p.z)),
    );
    const hi = vec3(
        Math.max(...all.map((p) => p.x)),
        Math.max(...all.map((p) => p.y)),
        Math.max(...all.map((p) => p.z)),
    );
    const d = hi.sub(lo);
    return { centre: lo.lerp(hi, 0.5), size: Math.max(d.x, d.y, d.z, 0.01) };
}

/** A scale bar's length (metres): a round 1, 2 or 5 times a power of ten, about `about` long. */
function roundLength(about: number): number {
    const p = 10 ** Math.floor(Math.log10(about));
    const k = about / p;
    return (k >= 5 ? 5 : k >= 2 ? 2 : 1) * p;
}
const lengthText = (m: number) =>
    m >= 1 ? `${m} m` : m >= 0.01 ? `${Math.round(m * 100)} cm` : `${Math.round(m * 1000)} mm`;

/**
 * The parts the visualisations are built from, one at a time: turned in 3D, and drawn square on from the front, the side
 * and above as the flat views draw them, to refine each on its own. The part's in the address (`?part=<slug>`).
 */
export default function PartsView() {
    const part = partOf(useSearchParams().get("part"));
    const [slug, setSlug] = useState(part.slug);
    const shown = partOf(slug);
    const choose = (s: string) => {
        setSlug(s);
        const url = new URL(window.location.href);
        url.searchParams.set("part", s);
        window.history.replaceState(null, "", url);
    };
    const [detail, setDetail] = useState<Detail>("high");
    const pieces = useMemo(() => shown.pieces(), [shown]);
    const box = useMemo(() => bounds(pieces), [pieces]);
    const [glView, setGlView] = useState<GLHandle | null>(null);
    const scene: SceneConfig = useMemo(
        () => ({
            centre: box.centre,
            distance: (box.size / 2 / Math.tan(rad(15))) * 1.4,
            azimuth: 145,
            elevation: 20,
            maxDistance: box.size * 12,
            minDistance: box.size * 0.3,
            below: true,
            ground: [],
            compass: [],
            letter: 0,
            minR: {},
            label: `${shown.name} in 3D. Drag to turn it, scroll or pinch to zoom, and right-drag or drag with two fingers to move it.`,
        }),
        [box, shown],
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col border-t border-border bg-surface lg:flex-row">
            <div className="relative min-h-0 flex-[3] lg:flex-[2]">
                <SceneGL
                    key={shown.slug}
                    scene={scene}
                    pieces={pieces}
                    labels={[]}
                    onReady={setGlView}
                    onTurn={() => {}}
                    detail={{ dpr: DETAILS[detail].dpr, sides: DETAILS[detail].sides }}
                />
                <div className="absolute top-2 left-2 flex max-w-[calc(100%-1rem)] items-start gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button type="button" className={`${CONTROL} gap-1.5 px-2.5 text-sm`}>
                                {shown.name}
                                <ChevronDown />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-56">
                            <DropdownMenuRadioGroup value={shown.slug} onValueChange={choose}>
                                {GROUPS.map((g, i) => (
                                    <div key={g}>
                                        {i > 0 && <DropdownMenuSeparator />}
                                        <DropdownMenuLabel>{g}</DropdownMenuLabel>
                                        {PARTS.filter((p) => p.group === g).map((p) => (
                                            <DropdownMenuRadioItem key={p.slug} value={p.slug}>
                                                {p.name}
                                            </DropdownMenuRadioItem>
                                        ))}
                                    </div>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <p className="absolute right-2 bottom-2 left-24 text-right text-xs text-ink-muted">
                    {shown.about}
                </p>
                <div className="absolute bottom-2 left-2 flex gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label={`Detail: ${DETAILS[detail].label}`}
                                title="Detail"
                                className={`${CONTROL} w-9`}
                            >
                                <Gauge />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="start" className="min-w-44">
                            <DropdownMenuLabel>Detail</DropdownMenuLabel>
                            <DropdownMenuRadioGroup
                                value={detail}
                                onValueChange={(d) => setDetail(d as Detail)}
                            >
                                {(Object.keys(DETAILS) as Detail[]).map((d) => (
                                    <DropdownMenuRadioItem key={d} value={d}>
                                        {DETAILS[d].label}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                        type="button"
                        aria-label="Show the whole part again"
                        title="Show the whole part again"
                        onClick={() => glView?.reset()}
                        className={`${CONTROL} w-9`}
                    >
                        <RotateCcw />
                    </button>
                </div>
            </div>
            <div className="flex min-h-0 flex-[2] border-t border-border lg:flex-1 lg:flex-col lg:border-t-0 lg:border-l">
                {FLATS.map((f) => (
                    <FlatView key={f.label} part={shown} pieces={pieces} view={f} detail={detail} />
                ))}
            </div>
        </div>
    );
}

/** One flat view of the part, fitted to its box, with a scale bar. */
function FlatView({
    part,
    pieces,
    view,
    detail,
}: {
    part: Part;
    pieces: Piece[];
    view: (typeof FLATS)[number];
    detail: Detail;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState(vec2(300, 200));
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) setSize(vec2(width, height));
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    const inBrowser = useInBrowser();
    const cam = new OrbitCamera(rad(view.azimuth), rad(view.elevation));
    // Fitted to what this view sees of the part, with room round it.
    const flat = pieces.flatMap(pointsOf).map((p) => cam.project(p));
    const [x0, x1] = [Math.min(...flat.map((p) => p.x)), Math.max(...flat.map((p) => p.x))];
    const [y0, y1] = [Math.min(...flat.map((p) => p.y)), Math.max(...flat.map((p) => p.y))];
    const room = 28;
    const ppm = Math.min(
        (size.x - 2 * room) / Math.max(x1 - x0, 1e-3),
        (size.y - 2 * room) / Math.max(y1 - y0, 1e-3),
    );
    const mid = vec2((x0 + x1) / 2, (y0 + y1) / 2);
    const toSvg = (p: Vector3): Vector2 => {
        const v = cam.project(p);
        return vec2(size.x / 2 + (v.x - mid.x) * ppm, size.y / 2 - (v.y - mid.y) * ppm);
    };
    const sorted = pieces
        .filter((p) => p.fine === undefined || p.fine * ppm >= DETAILS[detail].finePx)
        .filter((p) => p.kind !== "face" || !p.normal || p.normal.dot(cam.toward) > 0)
        .map((piece) => ({ piece, key: cam.depth(centreOf(piece)) }))
        .sort((a, b) => a.key - b.key);
    const bar = roundLength((size.x * 0.25) / ppm);
    return (
        <div
            ref={ref}
            className="relative min-h-0 min-w-0 flex-1 border-border not-first:border-l lg:not-first:border-t lg:not-first:border-l-0"
        >
            <svg
                viewBox={`0 0 ${svgNumber(size.x)} ${svgNumber(size.y)}`}
                className="absolute inset-0 block h-full w-full"
                role="img"
                aria-label={`${part.name}, from the ${view.label.toLowerCase()}`}
            >
                {inBrowser &&
                    sorted.map((d, i) => (
                        <PieceDrawing
                            key={i}
                            piece={d.piece}
                            toSvg={toSvg}
                            ppm={ppm}
                            minWidth={{}}
                            depth={(p) => cam.depth(p)}
                        />
                    ))}
                <g
                    transform={`translate(${svgNumber(size.x - 12 - bar * ppm)} ${svgNumber(size.y - 12)})`}
                >
                    <line
                        x1={0}
                        x2={bar * ppm}
                        y1={0}
                        y2={0}
                        stroke="var(--ink-muted)"
                        strokeWidth={1.5}
                    />
                    {[0, bar * ppm].map((x) => (
                        <line
                            key={x}
                            x1={x}
                            x2={x}
                            y1={-4}
                            y2={0}
                            stroke="var(--ink-muted)"
                            strokeWidth={1.5}
                        />
                    ))}
                    <text
                        x={(bar * ppm) / 2}
                        y={-6}
                        textAnchor="middle"
                        fontSize={11}
                        fill="var(--ink-muted)"
                    >
                        {lengthText(bar)}
                    </text>
                </g>
            </svg>
            <span className="absolute top-1.5 left-2 text-xs text-ink-muted">{view.label}</span>
        </div>
    );
}

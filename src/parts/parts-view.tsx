"use client";

import { ChevronDown, Eye, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { OVERLAY_CONTROL } from "@/components/overlay-control";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { rad } from "@/lib/math";
import { boundsOf, vec3, type Vector3 } from "@/lib/vector3";
import { DETAILS, type Detail } from "@/scene/detail";
import Loading3D from "@/scene/loading-3d";
import type { Piece } from "@/scene/pieces";
import type { GLHandle, SceneConfig } from "@/scene/scene-gl";
import { DetailMenu } from "@/scene/viewer-controls";

import { GROUPS, partOf, PARTS } from "./catalogue";
import { FLATS, FlatView, pointsOf } from "./flat-view";

const SceneGL = dynamic(() => import("@/scene/scene-gl").then((m) => m.SceneGL), {
    ssr: false,
    loading: () => <Loading3D />,
});

/** The view's turns aren't followed here; one function for good, as a new one each render would rerun the view's setup. */
const ignoreTurn = () => {};

/** Where the 3D view can look from: a bearing and a height (degrees). */
const LOOKS = [
    { label: "Three-quarter", azimuth: 145, elevation: 20 },
    ...FLATS,
    { label: "Back", azimuth: 0, elevation: 0 },
    { label: "Below", azimuth: 180, elevation: -89 },
];

/** The box round the pieces: its middle, and how big it is across its longest side (metres). */
function bounds(pieces: Piece[]): { centre: Vector3; size: number } {
    const { lo, hi } = boundsOf(pieces.flatMap(pointsOf));
    const d = hi.sub(lo);
    return { centre: lo.lerp(hi, 0.5), size: Math.max(d.x, d.y, d.z, 0.01) };
}

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
    const labels = useMemo(() => shown.labels?.() ?? [], [shown]);
    const box = useMemo(() => bounds(pieces), [pieces]);
    const [glView, setGlView] = useState<GLHandle | null>(null);
    const scene: SceneConfig = useMemo(
        () => ({
            centre: box.centre,
            distance: (box.size / 2 / Math.tan(rad(15))) * 1.4,
            azimuth: 145,
            elevation: 20,
            maxDistance: box.size * 12,
            // Out to twice as far as it starts, turning about somewhere on the part.
            zoomOut: 2,
            bounds: {
                lo: box.centre.sub(vec3(1, 1, 1).scale(box.size * 0.6)),
                hi: box.centre.add(vec3(1, 1, 1).scale(box.size * 0.6)),
            },
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
                    labels={labels}
                    onReady={setGlView}
                    onTurn={ignoreTurn}
                    detail={DETAILS[detail]}
                />
                <div className="absolute top-2 left-2 flex max-w-[calc(100%-1rem)] items-start gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className={`${OVERLAY_CONTROL} gap-1.5 px-2.5 text-sm`}
                            >
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
                <p className="absolute right-2 bottom-2 left-36 text-right text-xs text-ink-muted">
                    {shown.about}
                </p>
                <div className="absolute bottom-2 left-2 flex gap-2">
                    <DetailMenu
                        choice={detail}
                        onChoose={(d) => setDetail(d as Detail)}
                        side="top"
                        align="start"
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label="Look at the part from"
                                title="Look from"
                                className={`${OVERLAY_CONTROL} w-9`}
                            >
                                <Eye />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="start" className="min-w-44">
                            <DropdownMenuLabel>Look from</DropdownMenuLabel>
                            {LOOKS.map((l) => (
                                <DropdownMenuItem
                                    key={l.label}
                                    onSelect={() => glView?.look(l.azimuth, l.elevation)}
                                >
                                    {l.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                        type="button"
                        aria-label="Show the whole part again"
                        title="Show the whole part again"
                        onClick={() => glView?.reset()}
                        className={`${OVERLAY_CONTROL} w-9`}
                    >
                        <RotateCcw />
                    </button>
                </div>
            </div>
            <div className="flex min-h-0 flex-[2] border-t border-border lg:flex-1 lg:flex-col lg:border-t-0 lg:border-l">
                {FLATS.map((f) => (
                    <FlatView
                        key={f.label}
                        name={shown.name}
                        pieces={pieces}
                        labels={labels}
                        view={f}
                        detail={detail}
                    />
                ))}
            </div>
        </div>
    );
}

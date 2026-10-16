"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { RawValues, Readout, Slider, VisualisationLayout } from "@/components/diagram/controls";
import { Arrow, Label } from "@/components/diagram/svg";
import { Separator } from "@/components/ui/separator";
import { G } from "@/lib/constants";
import { deg } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";
import { vec3, type Vector3 } from "@/lib/vector3";

import { FourPointLowerNotes } from "./four-point-lower-notes";
import { maxRope, minRope, solveLower } from "./four-point-lower-solver";

const COLORS = {
    rope: "#818cf8",
    bar: "#facc15",
    contact: "#34d399",
};

const MAX_ARROW = 200;
const BAR_LENGTH = 2;
/** A basket stretcher's width. */
const BAR_WIDTH = 0.6;
const BAR_THICKNESS = 0.08;
/** Turn on to show a card of the inputs and solver output, for copying problem cases. */
const SHOW_RAW_VALUES = false;
/** Shown in place of a value that doesn't apply. */
const NONE = "—";

/** The drawings' width in SVG units; their heights follow from the setup. */
const W = 800;
/** Room round the drawings: beyond the belays, below the slot's bottom and above the belays. */
const MARGIN = 0.4;

/**
 * A four-point lower: a 2 m stretcher lowered level down a slot on four ropes, one from each corner to a hard belay.
 * The belays stand in a rectangle round the slot, the stretcher centred under them. Drawn twice: end on, looking
 * along the slot, and from above.
 */
export default function FourPointLower() {
    const [rope, setRope] = useState(4);
    const [barMass, setBarMass] = useState(80);
    const [slotDepth, setSlotDepth] = useState(3);
    const [slotWidth, setSlotWidth] = useState(1.2);
    const [belaySpacing, setBelaySpacing] = useState(3);
    const [anchorUp, setAnchorUp] = useState(0.5);
    const [anchorBack, setAnchorBack] = useState(3);

    const barWeight = barMass * G;
    const setup = useMemo(
        () => ({
            slotDepth,
            slotWidth,
            anchorUp,
            anchorBack,
            belaySpacing,
            barLength: BAR_LENGTH,
            barWidth: BAR_WIDTH,
            barWeight,
        }),
        [slotDepth, slotWidth, anchorUp, anchorBack, belaySpacing, barWeight],
    );
    // The rope runs from just long enough for the stretcher to sit level with the floor, to long enough for it to
    // land on the slot's bottom (rounded up to the slider's precision).
    const ropeMin = Math.ceil(minRope(setup) * 100) / 100;
    const ropeMax = Math.ceil(maxRope(setup) * 100) / 100;
    const ropeLength = Math.min(Math.max(rope, ropeMin), ropeMax);
    const sol = useMemo(() => solveLower({ ...setup, rope: ropeLength }), [setup, ropeLength]);
    // The solver's last few digits can differ between the server and the browser, which would make hydration
    // fail, so results are only shown once running in the browser.
    const inBrowser = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );
    const view = inBrowser && sol.kind === "lowered" ? sol.l : null;

    // --- Drawing ---
    const k = 160 / Math.max(barWeight, 1); // px per newton
    const force = (f: Vector2) => vec2(f.x * k, -f.y * k).clampLen(MAX_ARROW);
    const tag = (name: string, f: Vector2) => (f.len() * k > MAX_ARROW ? `${name} ≫` : name);

    // Both views share a scale across the slot, spanning just past the belays either side. They depend only on the
    // setup, not the rope, so they stay still while that slider moves.
    const halfSpan = slotWidth / 2 + anchorBack + MARGIN;
    const PPM = W / (2 * halfSpan); // SVG units per metre
    const edgeX = slotWidth / 2;
    const anchorX = edgeX + anchorBack;

    // End on: x across the slot, y up from its bottom.
    const endH = Math.round((slotDepth + anchorUp + 2 * MARGIN) * PPM);
    const endOn = (p: Vector3 | Vector2): Vector2 =>
        vec2(W / 2 + p.x * PPM, endH - (MARGIN + p.y) * PPM);
    // From above: x across the slot, z along it, the head (z > 0) at the top.
    const halfLong = Math.max(belaySpacing, BAR_LENGTH) / 2 + MARGIN;
    const planH = Math.round(2 * halfLong * PPM);
    const above = (p: Vector3): Vector2 => vec2(W / 2 + p.x * PPM, planH / 2 - p.z * PPM);

    /** Each of the four mirror images of a point on the x > 0, z > 0 side. */
    const mirrors = (p: Vector3) =>
        [
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
        ].map(([sx, sz]) => vec3(p.x * sx, p.y, p.z * sz));
    const polyline = (pts: Vector2[], key?: string | number) => (
        <polyline
            key={key}
            points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={view?.ropeTaut ? "#cbd5e1" : "#94a3b8"}
            strokeWidth={1.5}
            strokeDasharray={view?.ropeTaut ? undefined : "5 5"}
            strokeLinejoin="round"
        />
    );

    const floorTop = endOn(vec2(0, slotDepth)).y;
    const bottom = endOn(vec2(0, 0)).y;
    const endOnView = (
        <svg viewBox={`0 0 ${W} ${endH}`} className="block h-auto w-full">
            <line x1={0} y1={bottom} x2={W} y2={bottom} stroke="#475569" strokeWidth={1.5} />
            {[-1, 1].map((side) => {
                const x0 = side < 0 ? 0 : endOn(vec2(edgeX, 0)).x;
                const x1 = side < 0 ? endOn(vec2(-edgeX, 0)).x : W;
                const post = endOn(vec2(side * anchorX, slotDepth + anchorUp));
                return (
                    <g key={side}>
                        <rect
                            x={x0}
                            y={floorTop}
                            width={x1 - x0}
                            height={bottom - floorTop}
                            fill="#1e293b"
                            stroke="#475569"
                        />
                        <line
                            x1={post.x}
                            y1={floorTop}
                            x2={post.x}
                            y2={post.y}
                            stroke="#475569"
                            strokeWidth={4}
                            strokeLinecap="round"
                        />
                        <circle cx={post.x} cy={post.y} r={3.5} fill="#cbd5e1" />
                    </g>
                );
            })}
            {view && (
                <>
                    {[1, -1].map((side) =>
                        polyline(
                            [
                                view.anchor,
                                ...(view.edgeCrossing ? [view.edgeCrossing] : []),
                                view.corner,
                            ]
                                .map((p) => vec3(p.x * side, p.y, p.z))
                                .map(endOn),
                            side,
                        ),
                    )}
                    <line
                        x1={endOn(vec2(-BAR_WIDTH / 2, view.height)).x}
                        y1={endOn(vec2(0, view.height)).y}
                        x2={endOn(vec2(BAR_WIDTH / 2, view.height)).x}
                        y2={endOn(vec2(0, view.height)).y}
                        stroke="#a16207"
                        strokeWidth={BAR_THICKNESS * PPM}
                        strokeLinecap="round"
                    />
                    <Arrow
                        from={endOn(vec2(0, view.height))}
                        v={force(vec2(0, -barWeight))}
                        color={COLORS.bar}
                        label="W"
                    />
                    {view.ropeTaut &&
                        [1, -1].map((side) => {
                            const t = vec2(view.pull.x * side, view.pull.y);
                            return (
                                <Arrow
                                    key={side}
                                    from={endOn(vec2(view.corner.x * side, view.height))}
                                    v={force(t)}
                                    color={COLORS.rope}
                                    label={tag("T", t)}
                                    width={2}
                                />
                            );
                        })}
                    {!view.ropeTaut && (
                        <Arrow
                            from={endOn(vec2(0, 0))}
                            v={force(vec2(0, view.ground))}
                            color={COLORS.contact}
                            label={tag("N", vec2(0, view.ground))}
                            width={2}
                        />
                    )}
                </>
            )}
            <Caption>End on, looking along the slot</Caption>
        </svg>
    );

    const belays = mirrors(vec3(anchorX, 0, belaySpacing / 2)).map(above);
    const planView = (
        <svg viewBox={`0 0 ${W} ${planH}`} className="block h-auto w-full">
            <rect x={0} y={0} width={W} height={planH} fill="#1e293b" />
            <rect
                x={above(vec3(-edgeX, 0, 0)).x}
                y={0}
                width={slotWidth * PPM}
                height={planH}
                fill="#0f172a"
                stroke="#475569"
            />
            <polygon
                points={[belays[0], belays[2], belays[3], belays[1]]
                    .map((p) => `${p.x},${p.y}`)
                    .join(" ")}
                fill="none"
                stroke="#64748b"
                strokeDasharray="4 4"
            />
            <rect
                x={above(vec3(-BAR_WIDTH / 2, 0, 0)).x}
                y={above(vec3(0, 0, BAR_LENGTH / 2)).y}
                width={BAR_WIDTH * PPM}
                height={BAR_LENGTH * PPM}
                fill="#a16207"
                fillOpacity={0.5}
                stroke="#a16207"
                strokeWidth={2}
            />
            {view &&
                [0, 1, 2, 3].map((i) =>
                    polyline(
                        [
                            mirrors(view.anchor)[i],
                            ...(view.edgeCrossing ? [mirrors(view.edgeCrossing)[i]] : []),
                            mirrors(view.corner)[i],
                        ].map(above),
                        i,
                    ),
                )}
            {belays.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={5} fill="#cbd5e1" />
            ))}
            <Label at={above(vec3(0, 0, BAR_LENGTH / 2)).add(vec2(0, -12))} color={COLORS.bar}>
                head
            </Label>
            <Caption>From above</Caption>
        </svg>
    );

    const notice =
        inBrowser && sol.kind === "none"
            ? { title: "No balanced position for these settings", detail: sol.reason }
            : null;
    /** A pull along or across the stretcher from a pair of ropes, pulling it apart. */
    const apart = (f: number) =>
        !view?.ropeTaut || Math.abs(f) < 0.5 ? NONE : `${f.toFixed(0)} N`;

    return (
        <VisualisationLayout
            diagram={
                <div className="relative flex flex-col gap-4 p-4">
                    {notice && (
                        <div className="absolute inset-x-4 top-6 text-center text-sm text-amber-400">
                            <p className="font-medium">{notice.title}</p>
                            <p className="mx-auto mt-1 max-w-md text-amber-400/80">
                                {notice.detail}
                            </p>
                        </div>
                    )}
                    {endOnView}
                    <Slider
                        label="Rope length"
                        value={ropeLength}
                        min={ropeMin}
                        max={ropeMax}
                        step={0.05}
                        unit="m"
                        digits={2}
                        onChange={setRope}
                    />
                    {planView}
                </div>
            }
            controls={(more) => (
                <>
                    <Slider
                        label="Slot depth"
                        value={slotDepth}
                        min={2}
                        max={6}
                        step={0.1}
                        unit="m"
                        onChange={setSlotDepth}
                    />
                    <Slider
                        label="Slot width"
                        value={slotWidth}
                        min={0.8}
                        max={3}
                        step={0.05}
                        unit="m"
                        digits={2}
                        onChange={setSlotWidth}
                    />
                    <Slider
                        label="Head to foot belays"
                        value={belaySpacing}
                        min={BAR_LENGTH}
                        max={6}
                        step={0.05}
                        unit="m"
                        digits={2}
                        onChange={setBelaySpacing}
                    />
                    <Slider
                        label="Stretcher mass"
                        value={barMass}
                        min={1}
                        max={200}
                        step={1}
                        unit="kg"
                        digits={0}
                        onChange={setBarMass}
                    />
                    <Separator />
                    {more(
                        <>
                            <Slider
                                label="Belay height"
                                value={anchorUp}
                                min={0.1}
                                max={2}
                                step={0.05}
                                unit="m"
                                digits={2}
                                onChange={setAnchorUp}
                            />
                            <Slider
                                label="Belay setback from the edge"
                                value={anchorBack}
                                min={0.5}
                                max={5}
                                step={0.05}
                                unit="m"
                                digits={2}
                                onChange={setAnchorBack}
                            />
                        </>,
                    )}
                </>
            )}
            readouts={
                <>
                    <Readout
                        label="Stretcher below the floor"
                        value={view ? `${(slotDepth - view.height).toFixed(2)} m` : NONE}
                    />
                    <Readout
                        label="Tension, each rope T"
                        value={
                            !view ? NONE : view.ropeTaut ? `${view.tension.toFixed(0)} N` : "slack"
                        }
                        color={COLORS.rope}
                    />
                    <Readout
                        label="  as a share of the weight"
                        value={
                            view?.ropeTaut
                                ? `${((100 * view.tension) / barWeight).toFixed(0)}%`
                                : NONE
                        }
                        color={COLORS.rope}
                    />
                    <Readout
                        label="Rope's angle from vertical"
                        value={view?.ropeTaut ? `${deg(view.angle).toFixed(0)}°` : NONE}
                        color={COLORS.rope}
                    />
                    <Readout
                        label="Rope on slot's edge"
                        value={
                            view?.ropeTaut && view.edgeCrossing
                                ? `${view.onEdge.len().toFixed(0)} N`
                                : NONE
                        }
                        color={COLORS.rope}
                    />
                    <Readout
                        label="Across the stretcher, each end"
                        value={apart(view?.pull.x ?? 0)}
                        color={COLORS.rope}
                    />
                    <Readout
                        label="Along the stretcher, each side"
                        value={apart(view?.pull.z ?? 0)}
                        color={COLORS.rope}
                    />
                    <Readout label="Stretcher weight" value={`${barWeight.toFixed(0)} N`} />
                </>
            }
            footer={
                <div className="flex flex-col gap-4">
                    <FourPointLowerNotes />
                    {SHOW_RAW_VALUES && (
                        <RawValues
                            title="Raw values"
                            data={{ inputs: { ...setup, rope: ropeLength }, result: sol }}
                        />
                    )}
                </div>
            }
        />
    );
}

/** A view's caption, in its top left corner. */
function Caption({ children }: { children: React.ReactNode }) {
    return (
        <text
            x={12}
            y={22}
            fill="#94a3b8"
            fontSize={14}
            fontFamily="var(--font-geist-mono), monospace"
        >
            {children}
        </text>
    );
}

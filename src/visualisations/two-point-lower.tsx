"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import {
    RawValues,
    Readout,
    Slider,
    Toggle,
    VisualisationLayout,
} from "@/components/diagram/controls";
import { Arrow, Label } from "@/components/diagram/svg";
import { Separator } from "@/components/ui/separator";
import { G } from "@/lib/constants";
import { deg } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";

import { TwoPointLowerNotes } from "./two-point-lower-notes";
import { maxRope, minRope, solveLower, TEAM_HEIGHT } from "./two-point-lower-solver";

const COLORS = {
    line: "var(--pull)",
    rope: "var(--rope-tension)",
    bar: "var(--mass)",
    component: "var(--ink-muted)",
    contact: "var(--contact)",
    team: "var(--team)",
};

const MAX_ARROW = 200;
const BAR_LENGTH = 2;
const BAR_THICKNESS = 0.08;
const MAX_ANCHOR_UP = 2;
/** Turn on to show a card of the inputs and solver output, for copying problem cases. */
const SHOW_RAW_VALUES = false;
/** Shown in place of a value that doesn't apply. */
const NONE = "—";

/** The drawing's width in SVG units; its height follows from the setup. */
const W = 800;
const BELOW_GROUND = 0.4;
const ABOVE_TOP = 0.3;
/** Room past the team, so their marker and label fit. */
const PAST_TEAM = 0.4;

/**
 * A two-point lower: a 2 m stretcher lowered over a wall on a rope from an anchor behind its top, with a line
 * from its other end to a ground team out in front, who pull it with a steady force to keep it off the wall.
 * The stretcher settles where its energy is lowest, resting on the wall, its edge or the ground where it
 * touches them.
 */
export default function TwoPointLower() {
    const [rope, setRope] = useState(3);
    const [barMass, setBarMass] = useState(80);
    const [wallHeight, setWallHeight] = useState(4);
    const [anchorUp, setAnchorUp] = useState(0.5);
    const [anchorBack, setAnchorBack] = useState(2);
    const [teamDistance, setTeamDistance] = useState(6);
    const [teamPull, setTeamPull] = useState(200);
    const [showComponents, setShowComponents] = useState(false);

    const barWeight = barMass * G;
    const setup = useMemo(
        () => ({
            wallHeight,
            anchorUp,
            anchorBack,
            teamDistance,
            teamPull,
            barLength: BAR_LENGTH,
            barWeight,
        }),
        [wallHeight, anchorUp, anchorBack, teamDistance, teamPull, barWeight],
    );
    // The rope runs from just long enough for the stretcher, lying on the wall top, to reach its edge, to long
    // enough for it to lie on the ground just short of the team (rounded to the slider's precision).
    const ropeMin = Math.ceil(minRope(setup) * 100) / 100;
    const ropeMax = Math.floor(maxRope({ ...setup, rope: 0 }) * 100) / 100;
    const ropeLength = Math.min(Math.max(rope, ropeMin), ropeMax);
    const sol = useMemo(() => solveLower({ ...setup, rope: ropeLength }), [setup, ropeLength]);
    // The solver's last few digits differ between the server and the browser, which would make hydration
    // fail, so results are only shown once running in the browser.
    const inBrowser = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );

    // --- Drawing ---
    const k = 110 / Math.max(barWeight, 1); // px per newton
    const force = (f: Vector2) => vec2(f.x * k, -f.y * k).clampLen(MAX_ARROW);
    const tag = (name: string, f: Vector2) => (f.len() * k > MAX_ARROW ? `${name} ≫` : name);

    // The wall is drawn just thick enough to carry the rope's anchor on its back edge (only its face and top
    // matter to the physics). The drawing spans from the back of the wall to just past the team, and from just
    // below the ground to above the anchor. It depends only on the setup, not the rope, so it stays still while
    // that slider moves.
    const PPM = W / (anchorBack + teamDistance + PAST_TEAM); // SVG units per metre
    const H = Math.round((wallHeight + anchorUp + ABOVE_TOP + BELOW_GROUND) * PPM);
    const origin = vec2(anchorBack * PPM, H - BELOW_GROUND * PPM); // the base of the wall's face
    /** World (metres, y up) → SVG (y down). */
    const toSvg = (p: Vector2): Vector2 => vec2(origin.x + p.x * PPM, origin.y - p.y * PPM);

    const O = toSvg(Vector2.ZERO);
    const wallS = toSvg(vec2(0, wallHeight));
    const anchorS = toSvg(vec2(-anchorBack, wallHeight + anchorUp));
    const teamFootS = toSvg(vec2(teamDistance, 0));
    const teamS = toSvg(vec2(teamDistance, TEAM_HEIGHT));

    const scene = (
        <>
            <line x1={0} y1={O.y} x2={W} y2={O.y} stroke="var(--line)" strokeWidth={1.5} />
            <rect
                x={O.x - anchorBack * PPM}
                y={wallS.y}
                width={anchorBack * PPM}
                height={wallHeight * PPM}
                fill="var(--surface-raised)"
                stroke="var(--line)"
            />
            {/* post holding the rope's anchor */}
            <line
                x1={anchorS.x}
                y1={wallS.y}
                x2={anchorS.x}
                y2={anchorS.y}
                stroke="var(--line)"
                strokeWidth={4}
                strokeLinecap="round"
            />
            <circle cx={anchorS.x} cy={anchorS.y} r={3.5} fill="var(--ink-soft)" />
            {/* the ground team, holding the line at their hands */}
            <line
                x1={teamFootS.x}
                y1={teamFootS.y}
                x2={teamS.x}
                y2={teamS.y}
                stroke={COLORS.team}
                strokeWidth={3}
                strokeLinecap="round"
            />
            <circle cx={teamS.x} cy={teamS.y} r={5} fill={COLORS.team} />
            <Label at={teamFootS.add(vec2(0, 20))} color={COLORS.team}>
                team
            </Label>
        </>
    );

    const cableLine = (pts: Vector2[], taut: boolean) => (
        <polyline
            points={pts
                .map(toSvg)
                .map((p) => `${p.x},${p.y}`)
                .join(" ")}
            fill="none"
            stroke={taut ? "var(--ink-soft)" : "var(--ink-muted)"}
            strokeWidth={1.5}
            strokeDasharray={taut ? undefined : "5 5"}
            strokeLinejoin="round"
        />
    );
    /** A pull on the stretcher, with its x/y components when they're shown. */
    const tensionArrow = (name: "T₁" | "T₂", at: Vector2, t: Vector2, color: string) => (
        <>
            <Arrow from={at} v={force(t)} color={color} label={tag(name, t)} width={2} />
            {showComponents && (
                <>
                    <Arrow
                        from={at}
                        v={force(vec2(t.x, 0))}
                        color={COLORS.component}
                        dashed
                        width={1.5}
                        label={`${name}x`}
                    />
                    <Arrow
                        from={at}
                        v={force(vec2(0, t.y))}
                        color={COLORS.component}
                        dashed
                        width={1.5}
                        label={`${name}y`}
                    />
                </>
            )}
        </>
    );

    let diagram: React.ReactNode = scene;
    if (sol.kind === "lowered") {
        const l = sol.l;
        const end1S = toSvg(l.barEnd1);
        const end2S = toSvg(l.barEnd2);
        const ropePath = [l.anchor, ...(l.wrapEdge ? [l.wrapEdge] : []), l.barEnd1];
        const linePath = [l.team, ...(l.lineEdge ? [l.lineEdge] : []), l.barEnd2];
        const lineTaut = l.t2.len() > 1e-6;
        diagram = (
            <>
                {scene}
                {cableLine(ropePath, l.ropeTaut)}
                {cableLine(linePath, lineTaut)}
                {!l.ropeTaut && (
                    <Label
                        at={toSvg(ropePath.at(-2)!).add(end1S).scale(0.5).add(vec2(0, -14))}
                        color="var(--ink-muted)"
                    >
                        slack
                    </Label>
                )}
                <line
                    x1={end1S.x}
                    y1={end1S.y}
                    x2={end2S.x}
                    y2={end2S.y}
                    stroke="var(--timber)"
                    strokeWidth={BAR_THICKNESS * PPM}
                    strokeLinecap="round"
                />
                <Arrow
                    from={toSvg(l.barEnd1.add(l.barEnd2).scale(0.5))}
                    v={force(vec2(0, -barWeight))}
                    color={COLORS.bar}
                    label="W"
                />
                {l.ropeTaut && tensionArrow("T₁", end1S, l.t1, COLORS.rope)}
                {lineTaut && tensionArrow("T₂", end2S, l.t2, COLORS.line)}
                {l.contacts.map((c, i) => (
                    <Arrow
                        key={i}
                        from={toSvg(c.point)}
                        v={force(c.force)}
                        color={COLORS.contact}
                        label={tag("N", c.force)}
                        width={2}
                    />
                ))}
            </>
        );
    }

    // The readouts always show the same rows, so the panel doesn't jump as the arrangement changes.
    const view = inBrowser && sol.kind === "lowered" ? sol.l : null;
    /** The rope's push on the wall's edge as it wraps over it: its tension, pulling both ways round the edge. */
    const ropeOnEdge =
        view?.wrapEdge && view.ropeTaut
            ? view.anchor
                  .sub(view.wrapEdge)
                  .unit()
                  .add(view.barEnd1.sub(view.wrapEdge).unit())
                  .scale(view.t1.len())
            : null;
    // How far the stretcher hangs out from the wall's face, once it's over the edge and below the wall top.
    const nearest = view ? Math.min(view.barEnd1.x, view.barEnd2.x) : -1;
    const clearance =
        view && nearest > -1e-6 && Math.min(view.barEnd1.y, view.barEnd2.y) < wallHeight
            ? Math.max(0, nearest)
            : null;
    const notice =
        inBrowser && sol.kind === "none"
            ? { title: "No balanced position for these settings", detail: sol.reason }
            : null;

    const sumForces = (surface: string) => {
        const cs = view?.contacts.filter((c) => c.surface === surface) ?? [];
        return cs.length ? cs.reduce((sum, c) => sum.add(c.force), Vector2.ZERO) : null;
    };
    const tensionReadouts = (name: "T₁" | "T₂", what: string, t: Vector2 | null, color: string) => (
        <>
            <Readout
                label={`Tension, ${what} ${name}`}
                value={!view ? NONE : t && t.len() > 1e-6 ? `${t.len().toFixed(0)} N` : "slack"}
                color={color}
            />
            {showComponents && (
                <Readout
                    label={`  ${name}x, ${name}y`}
                    value={t && t.len() > 1e-6 ? `${t.x.toFixed(0)}, ${t.y.toFixed(0)} N` : NONE}
                    color={COLORS.component}
                />
            )}
        </>
    );

    return (
        <VisualisationLayout
            diagram={
                <div className="relative flex flex-col gap-4 p-4">
                    {notice && (
                        <div className="absolute inset-x-4 top-6 text-center text-sm text-warning">
                            <p className="font-medium">{notice.title}</p>
                            <p className="mx-auto mt-1 max-w-md text-warning/80">{notice.detail}</p>
                        </div>
                    )}
                    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
                        {inBrowser ? diagram : scene}
                    </svg>
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
                </div>
            }
            controls={(more) => (
                <>
                    <Slider
                        label="Wall height"
                        value={wallHeight}
                        min={2}
                        max={6}
                        step={0.1}
                        unit="m"
                        onChange={setWallHeight}
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
                    <Slider
                        label="Ground team's pull"
                        value={teamPull}
                        min={10}
                        max={1000}
                        step={10}
                        unit="N"
                        digits={0}
                        onChange={setTeamPull}
                    />
                    <Separator />
                    {more(
                        <>
                            <Slider
                                label="Anchor height"
                                value={anchorUp}
                                min={0.1}
                                max={MAX_ANCHOR_UP}
                                step={0.05}
                                unit="m"
                                digits={2}
                                onChange={setAnchorUp}
                            />
                            <Slider
                                label="Anchor setback"
                                value={anchorBack}
                                min={2}
                                max={5}
                                step={0.05}
                                unit="m"
                                digits={2}
                                onChange={setAnchorBack}
                            />
                            <Slider
                                label="Ground team's distance"
                                value={teamDistance}
                                min={4}
                                max={10}
                                step={0.1}
                                unit="m"
                                onChange={setTeamDistance}
                            />
                        </>,
                    )}
                    <Toggle
                        label="Show x/y components"
                        checked={showComponents}
                        onChange={setShowComponents}
                    />
                </>
            )}
            readouts={
                <>
                    <Readout
                        label="Stretcher tilt"
                        value={view ? `${Math.abs(deg(view.tilt)).toFixed(1)}°` : NONE}
                    />
                    <Readout
                        label="Clearance from wall"
                        value={clearance !== null ? `${clearance.toFixed(2)} m` : NONE}
                    />
                    {tensionReadouts("T₁", "rope", view?.t1 ?? null, COLORS.rope)}
                    {tensionReadouts("T₂", "line", view?.t2 ?? null, COLORS.line)}
                    <Readout
                        label="Team holding the end"
                        value={view ? (view.teamHolding ? "yes" : "no") : NONE}
                        color={COLORS.team}
                    />
                    <Readout
                        label="Rope on wall's edge"
                        value={ropeOnEdge ? `${ropeOnEdge.len().toFixed(0)} N` : NONE}
                        color={COLORS.rope}
                    />
                    {(["ground", "wall", "top", "edge"] as const).map((surface) => {
                        const f = sumForces(surface);
                        return (
                            <Readout
                                key={surface}
                                label={`${{ ground: "Ground", wall: "Wall", top: "Wall top", edge: "Wall's edge" }[surface]} on stretcher N`}
                                value={f ? `${f.len().toFixed(0)} N` : NONE}
                                color={COLORS.contact}
                            />
                        );
                    })}
                    <Readout label="Stretcher weight" value={`${barWeight.toFixed(0)} N`} />
                </>
            }
            footer={
                <div className="flex flex-col gap-4">
                    <TwoPointLowerNotes />
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

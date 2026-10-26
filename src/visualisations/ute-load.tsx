"use client";

import { useMemo, useState } from "react";

import {
    Choice,
    NONE,
    Notice,
    Readout,
    Select,
    Slider,
    VisualisationLayout,
} from "@/components/diagram/controls";
import { Arrow, Label } from "@/components/diagram/svg";
import { Separator } from "@/components/ui/separator";
import { readout } from "@/lib/format";
import { polylinePath } from "@/lib/svg-path";
import { vec2 } from "@/lib/vector2";

import { UteLoadNotes } from "./ute-load-notes";
import {
    CAB,
    checksFor,
    DIESEL,
    layoutFor,
    NEAR,
    solveLoads,
    TARE_FUEL,
    type Check,
    type Load,
} from "./ute-load-solver";
import { FITOUTS, uteFor, UTES } from "./ute-load-vehicles";

const COLORS = {
    load: "var(--mass)",
    ok: "var(--ok)",
    near: "var(--caution)",
    over: "var(--danger)",
    trailer: "var(--ink-muted)",
    body: "var(--line-faint)",
    outline: "var(--ghost)",
};

const statusOf = (c: Check) =>
    c.value > c.limit ? "over" : c.value >= NEAR * c.limit ? "near" : "ok";
const statusColor = (c: Check) => COLORS[statusOf(c)];
/** The status in words, so it isn't shown by colour alone; nothing while within the rating. */
const STATUS_WORDS = { over: "over", near: "nearly at", ok: null };

const CHECK_LABELS: Record<Check["key"], string> = {
    gvm: "Gross vehicle mass (GVM)",
    frontAxle: "Front axle",
    rearAxle: "Rear axle",
    gcm: "Gross combination mass (GCM)",
    towing: "Trailer (braked towing)",
    towBall: "Tow ball download",
};

type Fitout = keyof typeof FITOUTS | "custom";

/** The drawing's width in SVG units, and the span of the world it shows (metres from the front axle). */
const W = 800;
const X_MIN = -1.3;
const X_MAX = 9.5;
const ABOVE = 2.5;
const BELOW = 2.0;
/** SVG units per kilogram, for the axle and tow ball arrows. */
const PX_PER_KG = 0.07;

/** The ute's outline, in metres: ground at 0. */
const WHEEL = 0.39;
const SILL = 0.55;
const BONNET = 1.12;
const ROOF = 1.82;
const TUB_TOP = 1.15;
const CANOPY_TOP = 1.8;
/** Where the windscreen meets the bonnet, back from the front axle. */
const SCREEN_BASE = 0.55;

/** The trailer drawn behind: its drawbar, box and axle (metres back from the tow ball). */
const DRAWBAR = 1.3;
const BOX = 2.6;
const BOX_TOP = 1.3;
const BOX_BOTTOM = 0.55;

/**
 * A loaded dual-cab ute, side on, with the share of its weight on each axle and how close each total comes to
 * its rating.
 */
export default function UteLoad() {
    const [uteKey, setUteKey] = useState(UTES[0].key);
    const [crew, setCrew] = useState(4);
    const [crewMass, setCrewMass] = useState(100);
    const [fuel, setFuel] = useState(100);
    const [cargo, setCargo] = useState(150);
    const [cargoAt, setCargoAt] = useState(50);
    const [trailer, setTrailer] = useState(0);
    const [ballPct, setBallPct] = useState(10);
    const [fitout, setFitout] = useState<Fitout>("rescue");
    const [masses, setMasses] = useState<Record<keyof typeof FITOUTS.bare, number>>({
        ...FITOUTS.rescue,
    });
    const ute = uteFor(uteKey);
    const [frontShareOverride, setFrontShareOverride] = useState<number | null>(null);
    const frontShare = frontShareOverride ?? ute.unladenFrontShare;

    const lay = layoutFor(ute);
    const frontSeats = Math.min(crew, 2);
    const rearSeats = crew - frontSeats;
    const loads: Load[] = useMemo(
        () => [
            { label: "bullbar, winch", mass: masses.front, x: lay.frontFitout },
            { label: "plates", mass: masses.underbody, x: CAB.underbody },
            { label: "roof, radios", mass: masses.cab, x: CAB.roof },
            { label: "front seats", mass: frontSeats * crewMass, x: CAB.frontSeat },
            { label: "rear seats", mass: rearSeats * crewMass, x: CAB.rearSeat },
            {
                label: "fuel",
                mass: ((fuel / 100) * ute.fuelTank - TARE_FUEL) * DIESEL,
                x: CAB.fuelTank,
            },
            { label: "canopy, drawers", mass: masses.tub, x: (lay.tubStart + lay.tubEnd) / 2 },
            {
                label: "cargo",
                mass: cargo,
                x: lay.tubStart + (cargoAt / 100) * (lay.tubEnd - lay.tubStart),
            },
        ],
        [
            masses,
            lay.frontFitout,
            lay.tubStart,
            lay.tubEnd,
            frontSeats,
            rearSeats,
            crewMass,
            fuel,
            ute.fuelTank,
            cargo,
            cargoAt,
        ],
    );
    const setup = {
        wheelbase: ute.wheelbase,
        unladen: ute.tare,
        unladenFrontShare: frontShare,
        loads,
        trailer,
        ballShare: ballPct / 100,
        ballBehindRearAxle: lay.ball - ute.wheelbase,
    };
    const sol = solveLoads(setup);
    const view = sol.kind === "loaded" ? sol.l : null;
    const checks = view ? checksFor(setup, view, ute) : [];
    const checkFor = (key: Check["key"]) => checks.find((c) => c.key === key);

    const setFitoutMass = (key: keyof typeof masses) => (v: number) => {
        setMasses({ ...masses, [key]: v });
        setFitout("custom");
    };
    const chooseFitout = (f: Fitout) => {
        setFitout(f);
        if (f !== "custom") setMasses({ ...FITOUTS[f] });
    };
    const chooseUte = (key: string) => {
        setUteKey(key);
        setFrontShareOverride(null);
    };

    // --- Drawing ---
    const PPM = W / (X_MAX - X_MIN);
    const H = Math.round((ABOVE + BELOW) * PPM);
    /** World (metres back from the front axle, y up) → SVG (x right, y down). */
    const toSvg = (x: number, y: number) => vec2((x - X_MIN) * PPM, (ABOVE - y) * PPM);
    const path = (pts: [number, number][]) =>
        polylinePath(
            pts.map(([x, y]) => toSvg(x, y)),
            true,
        );
    const ground = toSvg(0, 0).y;

    const cabBack = lay.tubStart - 0.1;
    const body = path([
        [lay.frontBumper, SILL],
        [lay.frontBumper, BONNET - 0.1],
        [lay.frontBumper + 0.15, BONNET],
        [SCREEN_BASE, BONNET],
        [SCREEN_BASE + 0.7, ROOF],
        [cabBack - 0.1, ROOF],
        [cabBack, ROOF - 0.1],
        [cabBack, TUB_TOP],
        [lay.rearBumper, TUB_TOP],
        [lay.rearBumper, SILL],
    ]);
    const wheel = (x: number) => {
        const c = toSvg(x, WHEEL);
        return (
            <g key={x}>
                <circle
                    cx={c.x}
                    cy={c.y}
                    r={WHEEL * PPM}
                    fill="var(--surface)"
                    stroke={COLORS.outline}
                    strokeWidth={6}
                />
                <circle cx={c.x} cy={c.y} r={WHEEL * PPM * 0.45} fill={COLORS.outline} />
            </g>
        );
    };
    const ballS = toSvg(lay.ball, SILL);
    const trailerFront = lay.ball + DRAWBAR;
    const trailerAxle = trailerFront + BOX * 0.55;

    /** An upward arrow under an axle, for the load it carries, coloured by how close it is to its rating. */
    const axleArrow = (x: number, load: number, check: Check | undefined) => {
        const v = vec2(0, -load * PX_PER_KG);
        const tip = toSvg(x, 0);
        return (
            <g>
                <Arrow
                    from={tip.sub(v)}
                    v={v}
                    color={check ? statusColor(check) : COLORS.ok}
                    width={3}
                />
                <Label
                    at={tip.sub(v).add(vec2(0, 14))}
                    color={check ? statusColor(check) : COLORS.ok}
                >
                    {readout.mass(load)}
                </Label>
            </g>
        );
    };

    const crewLabel = crew ? `${crew} × ${crewMass} kg` : null;
    const diagram = (
        <>
            <line x1={0} y1={ground} x2={W} y2={ground} stroke="var(--line)" strokeWidth={1.5} />
            {trailer > 0 && (
                <g opacity={0.8}>
                    <line
                        x1={ballS.x}
                        y1={ballS.y}
                        x2={toSvg(trailerFront, BOX_BOTTOM + 0.1).x}
                        y2={toSvg(trailerFront, BOX_BOTTOM + 0.1).y}
                        stroke={COLORS.trailer}
                        strokeWidth={4}
                    />
                    <path
                        d={path([
                            [trailerFront, BOX_BOTTOM],
                            [trailerFront, BOX_TOP],
                            [trailerFront + BOX, BOX_TOP],
                            [trailerFront + BOX, BOX_BOTTOM],
                        ])}
                        fill="var(--surface-raised)"
                        stroke={COLORS.trailer}
                    />
                    <circle
                        cx={toSvg(trailerAxle, 0.3).x}
                        cy={toSvg(trailerAxle, 0.3).y}
                        r={0.3 * PPM}
                        fill="var(--surface)"
                        stroke={COLORS.trailer}
                        strokeWidth={5}
                    />
                    <Label
                        at={toSvg(trailerFront + BOX / 2, (BOX_TOP + BOX_BOTTOM) / 2)}
                        color={COLORS.trailer}
                    >
                        {`trailer ${trailer} kg`}
                    </Label>
                </g>
            )}
            <path d={body} fill={COLORS.body} stroke={COLORS.outline} strokeWidth={1.5} />
            {masses.tub >= 60 && (
                <path
                    d={path([
                        [lay.tubStart - 0.05, TUB_TOP],
                        [lay.tubStart - 0.05, CANOPY_TOP],
                        [lay.rearBumper - 0.05, CANOPY_TOP],
                        [lay.rearBumper - 0.05, TUB_TOP],
                    ])}
                    fill="none"
                    stroke={COLORS.outline}
                    strokeDasharray="5 4"
                />
            )}
            {/* tub floor */}
            <line
                x1={toSvg(lay.tubStart, SILL + 0.1).x}
                y1={toSvg(lay.tubStart, SILL + 0.1).y}
                x2={toSvg(lay.tubEnd, SILL + 0.1).x}
                y2={toSvg(lay.tubEnd, SILL + 0.1).y}
                stroke={COLORS.outline}
                strokeDasharray="3 3"
            />
            {wheel(0)}
            {wheel(ute.wheelbase)}
            <circle cx={ballS.x} cy={ballS.y} r={4} fill="var(--ink-soft)" />
            {/* the empty ute's centre of mass */}
            <circle
                cx={toSvg(ute.wheelbase * (1 - frontShare), 0.85).x}
                cy={toSvg(ute.wheelbase * (1 - frontShare), 0.85).y}
                r={6}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={1.5}
            />
            <Label
                at={toSvg(ute.wheelbase * (1 - frontShare), 0.85).add(vec2(0, 18))}
                color="var(--ink)"
            >
                {`empty ${ute.tare} kg`}
            </Label>
            {loadMarkers()}
            {view && axleArrow(0, view.front, checkFor("frontAxle"))}
            {view && axleArrow(ute.wheelbase, view.rear, checkFor("rearAxle"))}
            {view && view.ball > 0 && (
                <Arrow
                    from={ballS.add(vec2(0, -view.ball * PX_PER_KG - 8))}
                    v={vec2(0, view.ball * PX_PER_KG)}
                    color={checkFor("towBall") ? statusColor(checkFor("towBall")!) : COLORS.ok}
                    label={readout.mass(view.ball)}
                    width={2.5}
                />
            )}
            {crewLabel && (
                <Label
                    at={toSvg((CAB.frontSeat + CAB.rearSeat) / 2, ROOF + 0.35)}
                    color={COLORS.load}
                >
                    {crewLabel}
                </Label>
            )}
        </>
    );

    /** Each added load, as a dot where its mass sits. */
    function loadMarkers() {
        const heights: Record<string, number> = {
            "bullbar, winch": 0.75,
            plates: SILL - 0.05,
            "roof, radios": ROOF,
            "front seats": 0.95,
            "rear seats": 0.95,
            fuel: SILL + 0.05,
            "canopy, drawers": 1.0,
            cargo: SILL + 0.25,
        };
        return loads
            .filter((l) => Math.round(l.mass) > 0)
            .map((l) => {
                const at = toSvg(l.x, heights[l.label]);
                const r = Math.max(3, Math.sqrt(l.mass) * 0.9);
                return (
                    <circle
                        key={l.label}
                        cx={at.x}
                        cy={at.y}
                        r={r}
                        fill={COLORS.load}
                        fillOpacity={0.75}
                    >
                        <title>{`${l.label}: ${readout.mass(l.mass)}`}</title>
                    </circle>
                );
            });
    }

    const pct = (c: Check) => (c.limit > 0 ? (100 * c.value) / c.limit : 0);
    const gauges = (
        <div className="flex flex-col gap-2">
            {(view ? checks : []).map((c) => (
                <div key={c.key} className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between gap-2">
                        <span className="text-ink-soft">{CHECK_LABELS[c.key]}</span>
                        <span
                            className="font-mono whitespace-nowrap"
                            style={{ color: statusColor(c) }}
                        >
                            {STATUS_WORDS[statusOf(c)] && (
                                <span className="font-sans">{STATUS_WORDS[statusOf(c)]} </span>
                            )}
                            {Math.round(c.value)} / {c.limit} kg
                        </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${Math.min(100, pct(c))}%`,
                                backgroundColor: statusColor(c),
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );

    const gvm = checkFor("gvm");
    const room = gvm ? gvm.limit - gvm.value : null;
    const towLimit = Math.min(ute.towing, ute.gcm - ute.gvm);

    return (
        <VisualisationLayout
            diagram={
                <div className="relative flex flex-col gap-4 p-4">
                    {sol.kind === "none" && (
                        <Notice title="No balance for these settings" detail={sol.reason} />
                    )}
                    <svg
                        viewBox={`0 0 ${W} ${H}`}
                        className="block h-auto w-full"
                        role="img"
                        aria-label="The ute side on, with its loads and the weight on each axle"
                    >
                        {diagram}
                    </svg>
                    {gauges}
                </div>
            }
            controls={(more) => (
                <>
                    <Select
                        label="Ute"
                        value={ute.key}
                        groups={[{ options: UTES.map((u) => ({ value: u.key, label: u.label })) }]}
                        onChange={chooseUte}
                    />
                    <Slider
                        label="Crew"
                        value={crew}
                        min={0}
                        max={5}
                        step={1}
                        digits={0}
                        onChange={setCrew}
                    />
                    <Slider
                        label="Cargo in the tub"
                        value={cargo}
                        min={0}
                        max={1000}
                        step={5}
                        unit="kg"
                        digits={0}
                        onChange={setCargo}
                    />
                    <Slider
                        label="Trailer, loaded"
                        value={trailer}
                        min={0}
                        max={3500}
                        step={50}
                        unit="kg"
                        digits={0}
                        onChange={setTrailer}
                    />
                    <Separator />
                    <Choice
                        label="Fit-out"
                        value={fitout}
                        options={[
                            { value: "bare", label: "Bare" },
                            { value: "rescue", label: "Rescue" },
                            { value: "custom", label: "Custom" },
                        ]}
                        onChange={chooseFitout}
                    />
                    {more(
                        <>
                            <Slider
                                label="Fuel"
                                value={fuel}
                                min={0}
                                max={100}
                                step={5}
                                unit="%"
                                digits={0}
                                onChange={setFuel}
                            />
                            <Slider
                                label="Each crew member, with gear"
                                value={crewMass}
                                min={50}
                                max={150}
                                step={1}
                                unit="kg"
                                digits={0}
                                onChange={setCrewMass}
                            />
                            <Slider
                                label="Cargo's position (front to tailgate)"
                                value={cargoAt}
                                min={0}
                                max={100}
                                step={5}
                                unit="%"
                                digits={0}
                                onChange={setCargoAt}
                            />
                            <Slider
                                label="Tow ball share of trailer"
                                value={ballPct}
                                min={0}
                                max={15}
                                step={0.5}
                                unit="%"
                                digits={1}
                                disabled={trailer === 0}
                                onChange={setBallPct}
                            />
                            <Slider
                                label="Bullbar, winch, lights (front)"
                                value={masses.front}
                                min={0}
                                max={200}
                                step={1}
                                unit="kg"
                                digits={0}
                                onChange={setFitoutMass("front")}
                            />
                            <Slider
                                label="Light bar, radios, sirens (cab)"
                                value={masses.cab}
                                min={0}
                                max={100}
                                step={1}
                                unit="kg"
                                digits={0}
                                onChange={setFitoutMass("cab")}
                            />
                            <Slider
                                label="Canopy and drawers (tub)"
                                value={masses.tub}
                                min={0}
                                max={400}
                                step={1}
                                unit="kg"
                                digits={0}
                                onChange={setFitoutMass("tub")}
                            />
                            <Slider
                                label="Bash plates (underbody)"
                                value={masses.underbody}
                                min={0}
                                max={80}
                                step={1}
                                unit="kg"
                                digits={0}
                                onChange={setFitoutMass("underbody")}
                            />
                            <Slider
                                label="Empty ute's weight on front axle"
                                value={frontShare * 100}
                                min={45}
                                max={70}
                                step={0.5}
                                unit="%"
                                digits={1}
                                onChange={(v) => setFrontShareOverride(v / 100)}
                            />
                        </>,
                    )}
                </>
            )}
            readouts={
                <>
                    <Readout
                        label="Room left under GVM"
                        value={room !== null ? readout.mass(room) : NONE}
                        color={gvm ? statusColor(gvm) : undefined}
                    />
                    <Readout label="Front axle" value={view ? readout.mass(view.front) : NONE} />
                    <Readout label="Rear axle" value={view ? readout.mass(view.rear) : NONE} />
                    <Readout
                        label="Weight on the front"
                        value={view ? readout.percent(view.frontShare) : NONE}
                    />
                    <Readout
                        label="Tow ball on rear axle"
                        value={view && view.ball > 0 ? readout.mass(view.ballOnRear) : NONE}
                    />
                    <Readout
                        label="  lifted off front axle"
                        value={view && view.ball > 0 ? readout.mass(view.ballOffFront) : NONE}
                    />
                    <Readout label="Heaviest trailer at full GVM" value={`${towLimit} kg`} />
                </>
            }
            footer={<UteLoadNotes ute={ute} />}
        />
    );
}

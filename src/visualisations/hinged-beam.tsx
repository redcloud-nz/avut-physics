"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AngleArc, Arrow, Label, add, deg, len, scale, vec, type Vec } from "@/components/diagram/svg";
import { RawValues, Readout, Slider, Toggle, VisualisationLayout } from "@/components/diagram/controls";
import { minWallCable, solve } from "./hinged-beam-solver";

const COLORS = {
  tensionBeam: "#38bdf8",
  tensionWall: "#818cf8",
  weight: "#f97316",
  bar: "#facc15",
  hinge: "#f472b6",
  component: "#94a3b8",
  contact: "#34d399",
};

const G = 9.81;
const MAX_ARROW = 200;
const BAR_LENGTH = 2;
/** The beam, and the cable's attachment point on it, must reach at least this far past the wall height. */
const MIN_CLEARANCE = 0.1;
/** The beams' thicknesses set how close they come when the hanging beam rests on the main beam. */
const BEAM_THICKNESS = 0.1;
const BAR_THICKNESS = 0.08;
const MAX_BEAM_LENGTH = 7;
const MAX_WALL_HEIGHT = 6;
const MAX_ANCHOR_UP = 2;
const MAX_ANCHOR_BACK = 5;
/** Turn on to show a card of the inputs and solver output, for copying problem cases. */
const SHOW_RAW_VALUES = false;
/** Shown in place of a value that doesn't apply. */
const NONE = "—";

/** The drawing's width in SVG units; its height follows from the setup. */
const W = 800;
const BELOW_GROUND = 0.4;
const ABOVE_TOP = 0.3;

/** Clamp an arrow's drawn length so very large forces stay on screen. */
const clampLen = (v: Vec) => {
  const l = len(v);
  return l > MAX_ARROW ? scale(v, MAX_ARROW / l) : v;
};

/**
 * Beam hinged at the base of a wall. A second, 2 m beam hangs from two cables: one from the wall to
 * one end, one from the other end to the main beam. Everything settles where the energy is lowest.
 * If the hanging beam would cross the main beam, it rests against it instead, hinged where they touch.
 * The wall cable is anchored above and behind the top of the wall (wrapping over the wall's edge when it has
 * to); the beam and the cable's attachment on it reach past the wall height.
 */
export default function HingedBeam() {
  const [wallCable, setWallCable] = useState(3);
  const [beamCable, setBeamCable] = useState(1);
  const [beamLength, setBeamLength] = useState(5);
  const [beamMass, setBeamMass] = useState(20);
  const [barMass, setBarMass] = useState(40);
  const [wallHeight, setWallHeight] = useState(4);
  const [attachDistance, setAttachDistance] = useState(5);
  const [anchorUp, setAnchorUp] = useState(0.5);
  const [anchorBack, setAnchorBack] = useState(2);
  const [showComponents, setShowComponents] = useState(false);

  const round = (v: number) => Math.round(v * 10) / 10;
  const minBeam = round(wallHeight + MIN_CLEARANCE);

  // Raising the wall pushes the beam length and attachment point up so they stay past the wall height.
  const changeWallHeight = (h: number) => {
    const min = round(h + MIN_CLEARANCE);
    setWallHeight(h);
    setBeamLength((l) => Math.max(l, min));
    setAttachDistance((a) => Math.max(a, min));
  };
  // Shortening the beam pulls the attachment point in with it.
  const changeBeamLength = (l: number) => {
    setBeamLength(l);
    setAttachDistance((a) => Math.min(a, l));
  };

  const beamWeight = beamMass * G;
  const barWeight = barMass * G;
  const setup = useMemo(
    () => ({
      wallHeight,
      anchorUp,
      anchorBack,
      beamCable,
      beamLength,
      attachDistance,
      barLength: BAR_LENGTH,
      touchGap: (BEAM_THICKNESS + BAR_THICKNESS) / 2,
      beamThickness: BEAM_THICKNESS,
      beamWeight,
      barWeight,
    }),
    [wallHeight, anchorUp, anchorBack, beamCable, beamLength, attachDistance, beamWeight, barWeight],
  );
  // The wall cable is never shorter than the length that just brings the hanging beam, lying on the
  // wall top, to the edge (rounded up to the slider's precision).
  const minCable = Math.ceil(minWallCable({ ...setup, wallCable: 0 }) * 100) / 100;
  const cable = Math.max(wallCable, minCable);
  const sol = useMemo(() => solve({ ...setup, wallCable: cable }), [setup, cable]);
  // The solver's last few digits differ between the server and the browser, which would make hydration
  // fail, so results are only shown once running in the browser.
  const inBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // --- Drawing ---
  const k = 110 / Math.max(beamWeight + barWeight, 1); // px per newton
  const force = (f: Vec) => clampLen(vec(f.x * k, -f.y * k));
  const tag = (name: string, f: Vec) => (len(f) * k > MAX_ARROW ? `${name} ≫` : name);

  // The wall is drawn just thick enough to carry the cable anchor on its back edge (only its face and top
  // matter to the physics). The drawing spans from the back of the wall to the tip of the beam lying flat,
  // and from just below the ground to the highest point the beam or the cable anchor can reach. It depends
  // only on the setup, not the wall cable, so the drawing stays still while that slider moves.
  const PPM = W / (anchorBack + beamLength + BEAM_THICKNESS / 2); // SVG units per metre
  const H = Math.round((Math.max(beamLength, wallHeight + anchorUp) + ABOVE_TOP + BELOW_GROUND) * PPM);
  const origin = vec(anchorBack * PPM, H - BELOW_GROUND * PPM); // hinge, at the base of the wall's front face
  /** World (metres, y up) → SVG (y down). */
  const toSvg = (p: Vec): Vec => vec(origin.x + p.x * PPM, origin.y - p.y * PPM);

  const O = toSvg(vec(0, 0));
  const wallS = toSvg(vec(0, wallHeight));
  const anchorS = toSvg(vec(-anchorBack, wallHeight + anchorUp));

  const ground = (
    <>
      <line x1={0} y1={O.y} x2={W} y2={O.y} stroke="#475569" strokeWidth={1.5} />
      <rect
        x={O.x - anchorBack * PPM}
        y={wallS.y}
        width={anchorBack * PPM}
        height={wallHeight * PPM}
        fill="#1e293b"
        stroke="#475569"
      />
      {/* post holding the cable anchor */}
      <line
        x1={anchorS.x}
        y1={wallS.y}
        x2={anchorS.x}
        y2={anchorS.y}
        stroke="#475569"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <circle cx={anchorS.x} cy={anchorS.y} r={3.5} fill="#cbd5e1" />
    </>
  );

  const cablePath = (pts: Vec[]) =>
    pts
      .map(toSvg)
      .map((p) => `${p.x},${p.y}`)
      .join(" ");
  const beamLine = (phi: number) => {
    const tipS = toSvg(scale(vec(Math.cos(phi), Math.sin(phi)), beamLength));
    const angle = deg(phi);
    return (
      <>
        <line
          x1={O.x}
          y1={O.y}
          x2={tipS.x}
          y2={tipS.y}
          stroke="#64748b"
          strokeWidth={BEAM_THICKNESS * PPM}
          strokeLinecap="round"
        />
        <circle cx={O.x} cy={O.y} r={7} fill="#0f172a" stroke="#cbd5e1" strokeWidth={2} />
        {angle > 0.05 && (
          <AngleArc center={O} radius={46} startDeg={0} sweepDeg={-angle} label={`${angle.toFixed(1)}°`} />
        )}
      </>
    );
  };
  const barLine = (a: Vec, b: Vec) => (
    <line
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      stroke="#a16207"
      strokeWidth={BAR_THICKNESS * PPM}
      strokeLinecap="round"
    />
  );
  const hingeArrows = (R: Vec) => (
    <>
      <Arrow from={O} v={force(R)} color={COLORS.hinge} label={tag("R", R)} />
      {showComponents && (
        <>
          <Arrow from={O} v={force(vec(R.x, 0))} color={COLORS.component} dashed width={1.5} label="Rx" />
          <Arrow from={O} v={force(vec(0, R.y))} color={COLORS.component} dashed width={1.5} label="Ry" />
        </>
      )}
    </>
  );
  const hingeReadouts = (R: Vec | null) => (
    <>
      <Readout label="Hinge force R" value={R ? `${len(R).toFixed(0)} N` : NONE} color={COLORS.hinge} />
      {showComponents && (
        <Readout
          label="  Rx, Ry"
          value={R ? `${R.x.toFixed(0)}, ${R.y.toFixed(0)} N` : NONE}
          color={COLORS.component}
        />
      )}
      <Readout label="  R direction" value={R ? `${deg(Math.atan2(R.y, R.x)).toFixed(1)}° above horizontal` : NONE} />
    </>
  );
  /** A cable's pull on the hanging beam, with its x/y components when they're shown. */
  const tensionArrow = (name: "T₁" | "T₂", at: Vec, t: Vec, color: string) => (
    <>
      <Arrow from={at} v={force(t)} color={color} label={tag(name, t)} width={2} />
      {showComponents && (
        <>
          <Arrow from={at} v={force(vec(t.x, 0))} color={COLORS.component} dashed width={1.5} label={`${name}x`} />
          <Arrow from={at} v={force(vec(0, t.y))} color={COLORS.component} dashed width={1.5} label={`${name}y`} />
        </>
      )}
    </>
  );
  /** `t` is null when there's no solution; `slack` when the cable carries nothing. */
  const tensionReadouts = (name: "T₁" | "T₂", cable: string, t: Vec | "slack" | null, color: string) => (
    <>
      <Readout
        label={`Tension, ${cable} cable ${name}`}
        value={t === "slack" ? "slack" : t ? `${len(t).toFixed(0)} N` : NONE}
        color={color}
      />
      {showComponents && (
        <Readout
          label={`  ${name}x, ${name}y`}
          value={t && t !== "slack" ? `${t.x.toFixed(0)}, ${t.y.toFixed(0)} N` : NONE}
          color={COLORS.component}
        />
      )}
    </>
  );
  const wallOnBeamArrow = (w: { point: Vec; force: Vec } | null) =>
    w && (
      <Arrow from={toSvg(w.point)} v={force(w.force)} color={COLORS.contact} label={tag("N wall", w.force)} width={2} />
    );

  let diagram: React.ReactNode;
  if (sol.kind === "raised") {
    const eq = sol.eq;
    const attachS = toSvg(eq.beamAttach);
    const end1S = toSvg(eq.barEnd1);
    const end2S = toSvg(eq.barEnd2);
    const barCentreS = toSvg(scale(add(eq.barEnd1, eq.barEnd2), 0.5));

    diagram = (
      <>
        {ground}
        {/* cables */}
        <polyline
          points={cablePath([eq.anchor, ...(eq.wrapEdge ? [eq.wrapEdge] : []), eq.barEnd1])}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <line x1={end2S.x} y1={end2S.y} x2={attachS.x} y2={attachS.y} stroke="#cbd5e1" strokeWidth={1.5} />

        {beamLine(eq.phi)}
        {barLine(end1S, end2S)}

        {/* forces on the hanging beam */}
        <Arrow from={barCentreS} v={force(vec(0, -barWeight))} color={COLORS.bar} label="W" />
        {tensionArrow("T₁", end1S, eq.t1, COLORS.tensionWall)}
        {tensionArrow("T₂", end2S, eq.t2, COLORS.tensionBeam)}
        {eq.contacts.map((c) => (
          <Arrow
            key={c.surface}
            from={toSvg(c.point)}
            v={force(c.force)}
            color={COLORS.contact}
            label={tag("N", c.force)}
            width={2}
          />
        ))}

        {/* forces on the main beam */}
        {wallOnBeamArrow(eq.wallOnBeam)}
        {hingeArrows(eq.hinge)}
      </>
    );
  } else if (sol.kind === "hinged") {
    const h = sol.h;
    const end1S = toSvg(h.barEnd1);
    const end2S = toSvg(h.barEnd2);
    const attachS = toSvg(h.beamAttach);
    const wallPath = [h.anchor, ...(h.wrapEdge ? [h.wrapEdge] : []), h.barEnd1].map(toSvg);
    const last = wallPath.length - 1;

    diagram = (
      <>
        {ground}
        <polyline
          points={wallPath.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={h.cableTaut ? "#cbd5e1" : "#94a3b8"}
          strokeWidth={1.5}
          strokeDasharray={h.cableTaut ? undefined : "5 5"}
          strokeLinejoin="round"
        />
        {!h.cableTaut && (
          <Label at={add(scale(add(wallPath[last - 1], wallPath[last]), 0.5), vec(0, -14))} color="#94a3b8">
            slack
          </Label>
        )}
        <line x1={end2S.x} y1={end2S.y} x2={attachS.x} y2={attachS.y} stroke="#cbd5e1" strokeWidth={1.5} />
        {beamLine(h.phi)}
        {barLine(end1S, end2S)}

        <Arrow
          from={toSvg(scale(add(h.barEnd1, h.barEnd2), 0.5))}
          v={force(vec(0, -barWeight))}
          color={COLORS.bar}
          label="W"
        />
        {h.cableTaut && tensionArrow("T₁", end1S, h.t1, COLORS.tensionWall)}
        {/* Drawn like the raised case: the main beam's force on the hanging beam stands in for the beam cable. */}
        {tensionArrow("T₂", end2S, h.support, COLORS.tensionBeam)}
        {h.barContact && (
          <Arrow
            from={toSvg(h.barContact.point)}
            v={force(h.barContact.force)}
            color={COLORS.contact}
            label={tag("N", h.barContact.force)}
            width={2}
          />
        )}
        {wallOnBeamArrow(h.wallOnBeam)}
        {h.hinge && hingeArrows(h.hinge)}
      </>
    );
  } else {
    diagram = (
      <>
        {ground}
        <circle cx={O.x} cy={O.y} r={7} fill="#0f172a" stroke="#cbd5e1" strokeWidth={2} />
      </>
    );
  }

  // The readouts always show the same rows, so the panel doesn't jump as the arrangement changes.
  const view = !inBrowser
    ? null
    : sol.kind === "raised"
      ? {
          phi: sol.eq.phi,
          tilt: Math.atan2(sol.eq.barEnd2.y - sol.eq.barEnd1.y, sol.eq.barEnd2.x - sol.eq.barEnd1.x),
          t1: sol.eq.t1 as Vec | "slack",
          t2: sol.eq.t2,
          hinge: sol.eq.hinge as Vec | null,
          wallOnBeam: sol.eq.wallOnBeam,
          contacts: sol.eq.contacts,
        }
      : sol.kind === "hinged"
        ? {
            phi: sol.h.phi,
            tilt: sol.h.angle,
            t1: sol.h.cableTaut ? sol.h.t1 : ("slack" as const),
            t2: sol.h.support,
            hinge: sol.h.hinge,
            wallOnBeam: sol.h.wallOnBeam,
            contacts: sol.h.barContact ? [sol.h.barContact] : [],
          }
        : null;

  return (
    <VisualisationLayout
      diagram={
        <div className="relative flex flex-col gap-4 p-4">
          {inBrowser && sol.kind === "none" && (
            <div className="absolute inset-x-4 top-6 text-center text-sm text-amber-400">
              <p className="font-medium">No balanced position for these settings</p>
              <p className="mx-auto mt-1 max-w-md text-amber-400/80">{sol.reason}</p>
            </div>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
            {inBrowser ? diagram : ground}
          </svg>
          <Slider
            label="Cable: wall → hanging beam"
            value={cable}
            min={minCable}
            max={10}
            step={0.05}
            unit="m"
            digits={2}
            onChange={setWallCable}
          />
        </div>
      }
      controls={
        <>
          <Slider
            label="Cable: hanging beam → beam"
            value={beamCable}
            min={0.1}
            max={1}
            step={0.05}
            unit="m"
            digits={2}
            onChange={setBeamCable}
          />
          <Slider
            label="Wall height"
            value={wallHeight}
            min={2}
            max={MAX_WALL_HEIGHT}
            step={0.1}
            unit="m"
            onChange={changeWallHeight}
          />
          <Slider
            label="Cable anchor above wall"
            value={anchorUp}
            min={0.1}
            max={MAX_ANCHOR_UP}
            step={0.05}
            unit="m"
            digits={2}
            onChange={setAnchorUp}
          />
          <Slider
            label="Cable anchor back from wall face"
            value={anchorBack}
            min={2}
            max={MAX_ANCHOR_BACK}
            step={0.05}
            unit="m"
            digits={2}
            onChange={setAnchorBack}
          />
          <Slider
            label="Beam length"
            value={beamLength}
            min={minBeam}
            max={MAX_BEAM_LENGTH}
            step={0.1}
            unit="m"
            onChange={changeBeamLength}
          />
          <Slider
            label="Cable attachment from hinge"
            value={attachDistance}
            min={minBeam}
            max={beamLength}
            step={0.1}
            unit="m"
            onChange={setAttachDistance}
          />
          <Slider
            label="Beam mass"
            value={beamMass}
            min={1}
            max={100}
            step={1}
            unit="kg"
            digits={0}
            onChange={setBeamMass}
          />
          <Slider
            label={`Hanging beam mass (${BAR_LENGTH} m)`}
            value={barMass}
            min={1}
            max={200}
            step={1}
            unit="kg"
            digits={0}
            onChange={setBarMass}
          />
          <Toggle label="Show x/y components" checked={showComponents} onChange={setShowComponents} />
        </>
      }
      readouts={
        <>
          <Readout label="Beam angle" value={view ? `${deg(view.phi).toFixed(1)}°` : NONE} />
          <Readout label="Hanging beam tilt" value={view ? `${Math.abs(deg(view.tilt)).toFixed(1)}°` : NONE} />
          {tensionReadouts("T₁", "wall", view?.t1 ?? null, COLORS.tensionWall)}
          {tensionReadouts("T₂", "beam", view?.t2 ?? null, COLORS.tensionBeam)}
          {hingeReadouts(view?.hinge ?? null)}
          <Readout
            label="Wall's edge on main beam N"
            value={view?.wallOnBeam ? `${len(view.wallOnBeam.force).toFixed(0)} N` : NONE}
            color={COLORS.contact}
          />
          {(["ground", "wall", "top", "edge"] as const).map((surface) => {
            const f = view?.contacts.find((c) => c.surface === surface)?.force;
            return (
              <Readout
                key={surface}
                label={`${{ ground: "Ground", wall: "Wall", top: "Wall top", edge: "Wall's edge" }[surface]} on hanging beam N`}
                value={f ? `${len(f).toFixed(0)} N` : NONE}
                color={COLORS.contact}
              />
            );
          })}
          <Readout label="Total weight" value={`${(beamWeight + barWeight).toFixed(0)} N`} />
        </>
      }
      footer={
        SHOW_RAW_VALUES && (
          <RawValues
            title="Raw values"
            data={{
              inputs: {
                wallCable: cable,
                beamCable,
                wallHeight,
                anchorUp,
                anchorBack,
                beamLength,
                attachDistance,
                beamMass,
                barMass,
              },
              minWallCable: minCable,
              result: sol,
            }}
          />
        )
      }
    />
  );
}

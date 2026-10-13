"use client";

import { useMemo, useState } from "react";
import { AngleArc, Arrow, Label, add, deg, len, scale, vec, type Vec } from "@/components/diagram/svg";
import { Readout, Slider, Toggle, VisualisationLayout } from "@/components/diagram/controls";
import { solve } from "./hinged-beam-solver";

const COLORS = {
  tensionBeam: "#38bdf8",
  tensionWall: "#818cf8",
  weight: "#f97316",
  bar: "#facc15",
  hinge: "#f472b6",
  component: "#94a3b8",
  contact: "#34d399",
};

const W = 800;
const H = 480;
const G = 9.81;
const PPM = 50; // pixels per metre (fixed so the drawing doesn't rescale as sliders move)
const ORIGIN = vec(290, H - 90); // hinge, at the base of the wall's front face
const MAX_ARROW = 200;
const BAR_LENGTH = 2;
/** The beam, and the cable's attachment point on it, must reach at least this far past the wall height. */
const MIN_CLEARANCE = 0.1;
const WALL_THICKNESS = 5;

/** World (metres, y up) → SVG (pixels, y down). */
const toSvg = (p: Vec): Vec => vec(ORIGIN.x + p.x * PPM, ORIGIN.y - p.y * PPM);

/** Clamp an arrow's drawn length so very large forces stay on screen. */
const clampLen = (v: Vec) => {
  const l = len(v);
  return l > MAX_ARROW ? scale(v, MAX_ARROW / l) : v;
};

/**
 * Beam hinged at the base of a wall. A second, 2 m beam hangs from two cables: one from the wall to
 * one end, one from the other end to the main beam. Everything settles where the energy is lowest.
 * Once the main beam is down, the hanging beam simply rests on top of it, held up only by the wall cable.
 * The wall cable is anchored above and behind the top of the wall (wrapping over the wall's edge when it has
 * to); the beam and the cable's attachment on it reach past the wall height.
 */
export default function HingedBeam() {
  const [wallCable, setWallCable] = useState(2);
  const [beamCable, setBeamCable] = useState(1);
  const [beamLength, setBeamLength] = useState(5);
  const [beamMass, setBeamMass] = useState(20);
  const [barMass, setBarMass] = useState(40);
  const [wallHeight, setWallHeight] = useState(4);
  const [attachDistance, setAttachDistance] = useState(5);
  const [anchorUp, setAnchorUp] = useState(0.5);
  const [anchorBack, setAnchorBack] = useState(1);
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
  const sol = useMemo(
    () =>
            solve({
        wallHeight,
        anchorUp,
        anchorBack,
        wallCable,
        beamCable,
        beamLength,
        attachDistance,
        barLength: BAR_LENGTH,
        beamWeight,
        barWeight,
      }),
    [wallHeight, anchorUp, anchorBack, wallCable, beamCable, beamLength, attachDistance, beamWeight, barWeight],
  );

  // --- Drawing ---
  const k = 110 / Math.max(beamWeight + barWeight, 1); // px per newton
  const force = (f: Vec) => clampLen(vec(f.x * k, -f.y * k));
  const tag = (name: string, f: Vec) => (len(f) * k > MAX_ARROW ? `${name} ≫` : name);

  const O = toSvg(vec(0, 0));
  const wallS = toSvg(vec(0, wallHeight));
  const anchorS = toSvg(vec(-anchorBack, wallHeight + anchorUp));

  const ground = (
    <>
      <line x1={20} y1={O.y} x2={W - 20} y2={O.y} stroke="#475569" strokeWidth={1.5} />
      <rect
        x={O.x - WALL_THICKNESS * PPM}
        y={wallS.y}
        width={WALL_THICKNESS * PPM}
        height={wallHeight * PPM}
        fill="#1e293b"
        stroke="#475569"
      />
      {/* post holding the cable anchor */}
      <line x1={anchorS.x} y1={wallS.y} x2={anchorS.x} y2={anchorS.y} stroke="#475569" strokeWidth={4} strokeLinecap="round" />
      <circle cx={anchorS.x} cy={anchorS.y} r={3.5} fill="#cbd5e1" />
    </>
  );

  const cablePath = (pts: Vec[]) =>
    pts
      .map(toSvg)
      .map((p) => `${p.x},${p.y}`)
      .join(" ");
  const banner = (text: string) => (
    <Label at={vec(W / 2 + 40, 40)} color="#fbbf24">
      {text}
    </Label>
  );

  let diagram: React.ReactNode;
  if (sol.kind === "raised") {
    const eq = sol.eq;
    const angle = deg(eq.phi);
    const dir = vec(Math.cos(eq.phi), Math.sin(eq.phi));
    const tipS = toSvg(scale(dir, beamLength));
    const centreS = toSvg(scale(dir, beamLength / 2));
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

        {/* main beam */}
        <line x1={O.x} y1={O.y} x2={tipS.x} y2={tipS.y} stroke="#64748b" strokeWidth={12} strokeLinecap="round" />
        <circle cx={O.x} cy={O.y} r={7} fill="#0f172a" stroke="#cbd5e1" strokeWidth={2} />
        <AngleArc center={O} radius={46} startDeg={0} sweepDeg={-angle} label={`${angle.toFixed(1)}°`} />

        {/* hanging beam */}
        <line x1={end1S.x} y1={end1S.y} x2={end2S.x} y2={end2S.y} stroke="#a16207" strokeWidth={9} strokeLinecap="round" />

        {/* forces on the hanging beam */}
        <Arrow from={barCentreS} v={force(vec(0, -barWeight))} color={COLORS.bar} label="W hanging" />
        <Arrow from={end1S} v={force(eq.t1)} color={COLORS.tensionWall} label={tag("T₁", eq.t1)} width={2} />
        <Arrow from={end2S} v={force(eq.t2)} color={COLORS.tensionBeam} label={tag("T₂", eq.t2)} width={2} />
        {eq.contact && (
          <Arrow from={toSvg(eq.contact.point)} v={force(eq.contact.force)} color={COLORS.contact} label={tag("N", eq.contact.force)} width={2} />
        )}

        {/* forces on the main beam */}
        <Arrow from={centreS} v={force(vec(0, -beamWeight))} color={COLORS.weight} label="W beam" />
        <Arrow from={attachS} v={force(eq.cableOnBeam)} color={COLORS.tensionBeam} label={tag("T₂", eq.cableOnBeam)} />
        <Arrow from={O} v={force(eq.hinge)} color={COLORS.hinge} label={tag("R", eq.hinge)} />
        {showComponents && (
          <>
            <Arrow from={attachS} v={force(vec(eq.cableOnBeam.x, 0))} color={COLORS.component} dashed width={1.5} label="Tx" />
            <Arrow from={attachS} v={force(vec(0, eq.cableOnBeam.y))} color={COLORS.component} dashed width={1.5} label="Ty" />
            <Arrow from={O} v={force(vec(eq.hinge.x, 0))} color={COLORS.component} dashed width={1.5} label="Rx" />
            <Arrow from={O} v={force(vec(0, eq.hinge.y))} color={COLORS.component} dashed width={1.5} label="Ry" />
          </>
        )}
      </>
    );
  } else if (sol.kind === "resting") {
    // Main beam flat on the ground; the hanging beam rests on top of it (drawn lifted by the beams' thickness).
    const r = sol.rest;
    const onTop = (p: Vec) => add(toSvg(p), vec(0, -10));
    const tipS = toSvg(vec(beamLength, 0));
    const end1S = onTop(r.barEnd1);
    const end2S = onTop(r.barEnd2);
    const wallPath = [...[r.anchor, ...(r.wrapEdge ? [r.wrapEdge] : [])].map(toSvg), end1S];
    const last = wallPath.length - 1;

    diagram = (
      <>
        {ground}
        <polyline
          points={wallPath.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={r.cableTaut ? "#cbd5e1" : "#94a3b8"}
          strokeWidth={1.5}
          strokeDasharray={r.cableTaut ? undefined : "5 5"}
          strokeLinejoin="round"
        />
        {!r.cableTaut && (
          <Label at={add(scale(add(wallPath[last - 1], wallPath[last]), 0.5), vec(0, -14))} color="#94a3b8">
            slack
          </Label>
        )}
        <line x1={O.x} y1={O.y} x2={tipS.x} y2={tipS.y} stroke="#64748b" strokeWidth={12} strokeLinecap="round" />
        <circle cx={O.x} cy={O.y} r={7} fill="#0f172a" stroke="#cbd5e1" strokeWidth={2} />
        <line x1={end1S.x} y1={end1S.y} x2={end2S.x} y2={end2S.y} stroke="#a16207" strokeWidth={9} strokeLinecap="round" />

        <Arrow from={onTop(scale(add(r.barEnd1, r.barEnd2), 0.5))} v={force(vec(0, -barWeight))} color={COLORS.bar} label="W hanging" />
        {r.cableTaut && <Arrow from={end1S} v={force(r.t1)} color={COLORS.tensionWall} label={tag("T₁", r.t1)} width={2} />}
        <Arrow from={onTop(r.supportAt)} v={force(r.support)} color={COLORS.contact} label={tag(r.cableTaut || r.end1Contact ? "F" : "N", r.support)} width={2} />
        {r.end1Contact && (
          <Arrow
            from={end1S}
            v={force(r.end1Contact.force)}
            color={COLORS.contact}
            label={tag(r.end1Contact.surface === "wall" ? "N wall" : "N ground", r.end1Contact.force)}
            width={2}
          />
        )}
        {banner("The main beam rests on the ground")}
      </>
    );
  } else {
    diagram = (
      <>
        {ground}
        <circle cx={O.x} cy={O.y} r={7} fill="#0f172a" stroke="#cbd5e1" strokeWidth={2} />
        {banner("No balanced position for these settings")}
      </>
    );
  }

  return (
    <VisualisationLayout
      diagram={
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
          {diagram}
        </svg>
      }
      controls={
        <>
          <Slider label="Cable: wall → hanging beam" value={wallCable} min={0.2} max={10} step={0.05} unit="m" digits={2} onChange={setWallCable} />
          <Slider label="Cable: hanging beam → beam" value={beamCable} min={0.1} max={1} step={0.05} unit="m" digits={2} onChange={setBeamCable} />
          <Slider label="Wall height" value={wallHeight} min={2} max={5} step={0.1} unit="m" onChange={changeWallHeight} />
          <Slider label="Cable anchor above wall" value={anchorUp} min={0.1} max={2} step={0.05} unit="m" digits={2} onChange={setAnchorUp} />
          <Slider
            label="Cable anchor back from wall face"
            value={anchorBack}
            min={0.5}
            max={WALL_THICKNESS}
            step={0.05}
            unit="m"
            digits={2}
            onChange={setAnchorBack}
          />
          <Slider label="Beam length" value={beamLength} min={minBeam} max={7} step={0.1} unit="m" onChange={changeBeamLength} />
          <Slider
            label="Cable attachment from hinge"
            value={attachDistance}
            min={minBeam}
            max={beamLength}
            step={0.1}
            unit="m"
            onChange={setAttachDistance}
          />
          <Slider label="Beam mass" value={beamMass} min={1} max={100} step={1} unit="kg" digits={0} onChange={setBeamMass} />
          <Slider label={`Hanging beam mass (${BAR_LENGTH} m)`} value={barMass} min={1} max={200} step={1} unit="kg" digits={0} onChange={setBarMass} />
          <Toggle label="Show x/y components" checked={showComponents} onChange={setShowComponents} />
        </>
      }
      readouts={
        sol.kind === "raised" ? (
          <>
            <Readout label="Beam angle" value={`${deg(sol.eq.phi).toFixed(1)}°`} />
            <Readout
              label="Hanging beam tilt"
              value={`${Math.abs(deg(Math.atan2(sol.eq.barEnd2.y - sol.eq.barEnd1.y, sol.eq.barEnd2.x - sol.eq.barEnd1.x))).toFixed(1)}°`}
            />
            <Readout label="Tension, wall cable T₁" value={`${len(sol.eq.t1).toFixed(0)} N`} color={COLORS.tensionWall} />
            <Readout label="Tension, beam cable T₂" value={`${len(sol.eq.t2).toFixed(0)} N`} color={COLORS.tensionBeam} />
            <Readout
              label="  On beam Tx, Ty"
              value={`${sol.eq.cableOnBeam.x.toFixed(0)}, ${sol.eq.cableOnBeam.y.toFixed(0)} N`}
              color={COLORS.component}
            />
            <Readout label="Hinge force R" value={`${len(sol.eq.hinge).toFixed(0)} N`} color={COLORS.hinge} />
            <Readout label="  Rx, Ry" value={`${sol.eq.hinge.x.toFixed(0)}, ${sol.eq.hinge.y.toFixed(0)} N`} color={COLORS.component} />
            <Readout
              label="  R direction"
              value={`${deg(Math.atan2(sol.eq.hinge.y, sol.eq.hinge.x)).toFixed(1)}° above horizontal`}
            />
            {sol.eq.contact && (
              <Readout
                label={sol.eq.contact.force.y > 0 ? "Ground on hanging beam N" : "Wall on hanging beam N"}
                value={`${len(sol.eq.contact.force).toFixed(0)} N`}
                color={COLORS.contact}
              />
            )}
            <Readout label="Total weight" value={`${(beamWeight + barWeight).toFixed(0)} N`} />
          </>
        ) : sol.kind === "resting" ? (
          <>
            <p className="text-sm text-amber-400">{sol.reason}</p>
            <Readout label="Hanging beam angle" value={`${deg(sol.rest.angle).toFixed(1)}°`} />
            <Readout
              label="Tension, wall cable T₁"
              value={sol.rest.cableTaut ? `${len(sol.rest.t1).toFixed(0)} N` : "slack"}
              color={COLORS.tensionWall}
            />
            <Readout
              label={sol.rest.cableTaut || sol.rest.end1Contact ? "Force at fixed end F" : "Main beam supports N"}
              value={`${len(sol.rest.support).toFixed(0)} N`}
              color={COLORS.contact}
            />
            {sol.rest.end1Contact && (
              <Readout
                label={sol.rest.end1Contact.surface === "wall" ? "Wall on hanging beam" : "Ground on hanging beam"}
                value={`${len(sol.rest.end1Contact.force).toFixed(0)} N`}
                color={COLORS.contact}
              />
            )}
            <Readout label="Hanging beam weight" value={`${barWeight.toFixed(0)} N`} />
            <p className="text-xs text-slate-400">
              With the main beam on the ground, the hanging beam&apos;s end is fixed on top of it (or just above, if
              the wall cable couldn&apos;t reach otherwise); the main beam and the short cable between the beams are
              left out.
              {sol.rest.cableTaut
                ? " The wall cable holds the other end up."
                : sol.rest.end1Contact?.surface === "wall"
                  ? " The wall cable goes slack and the hanging beam leans against the wall."
                  : sol.rest.end1Contact
                    ? " The wall cable goes slack and the hanging beam's other end rests on the ground."
                    : " The wall cable is long enough that it goes slack and the hanging beam lies flat."}
            </p>
          </>
        ) : (
          <p className="text-sm text-amber-400">{sol.reason}</p>
        )
      }
    />
  );
}

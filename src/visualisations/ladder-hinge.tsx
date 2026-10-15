"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AngleArc, Arrow, Label } from "@/components/diagram/svg";
import { G } from "@/lib/constants";
import { clamp, deg } from "@/lib/math";
import { Vector2, vec2 } from "@/lib/vector2";
import { Separator } from "@/components/ui/separator";
import { Choice, RawValues, Readout, Slider, Toggle, VisualisationLayout } from "@/components/diagram/controls";
import { solveHeld, solveLevel } from "./ladder-hinge-held";
import { LadderHingeNotes } from "./ladder-hinge-notes";
import { minWallCable, phiMax, solve } from "./ladder-hinge-solver";

const COLORS = {
  tensionBeam: "#38bdf8",
  tensionWall: "#818cf8",
  weight: "#f97316",
  bar: "#facc15",
  hinge: "#f472b6",
  component: "#94a3b8",
  contact: "#34d399",
  hold: "#a3e635",
};

type LadderMode = "free" | "level";

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
/** Over how many degrees the team brings the ladder from where it settles by itself to level. */
const UNDERRUN_OVER = 7.5;
/** The steepest the ground team holds the ladder (degrees). */
const MAX_TEAM_ANGLE = 60;
/** How well the ladder's foot grips the ground (rubber feet on a hard surface). */
const FOOT_FRICTION = 0.5;
/** Shown in place of a value that doesn't apply. */
const NONE = "—";

/** The drawing's width in SVG units; its height follows from the setup. */
const W = 800;
const BELOW_GROUND = 0.4;
const ABOVE_TOP = 0.3;

/** The total of some contact forces, or null if there are none. */
const sumForces = (contacts: { force: Vector2 }[]) =>
  contacts.length ? contacts.reduce((sum, c) => sum.add(c.force), Vector2.ZERO) : null;

/**
 * A ladder hinged at the base of a wall, with a 2 m stretcher hanging from it: a rope from the wall holds one
 * end, and an attachment from the other end runs to the ladder. Everything settles where the energy is lowest.
 * If the stretcher would cross the ladder, it rests against it instead, hinged where they touch.
 * Alternatively a ground team holds the ladder at a set angle, and the stretcher settles for that angle.
 * The rope is anchored above and behind the top of the wall (wrapping over the wall's edge when it has
 * to); the ladder and the cable's attachment on it reach past the wall height.
 *
 * In the code the ladder is the main beam, the stretcher is the hanging beam (or bar), the rope is the
 * wall cable and the attachment is the beam cable.
 */
export default function LadderHinge() {
  const [wallCable, setWallCable] = useState(3);
  const [beamCable, setBeamCable] = useState(0.25);
  const [beamLength, setBeamLength] = useState(6.4);
  const [beamMass, setBeamMass] = useState(30);
  const [barMass, setBarMass] = useState(80);
  const [wallHeight, setWallHeight] = useState(4);
  /** How far along the ladder past the wall height the attachment is. */
  const [attachAbove, setAttachAbove] = useState(0.5);
  const [anchorUp, setAnchorUp] = useState(0.5);
  const [anchorBack, setAnchorBack] = useState(2);
  const [showComponents, setShowComponents] = useState(false);
  /** Whether the ladder finds its own angle, or a ground team holds it at whatever angle keeps the stretcher level. */
  const [ladderMode, setLadderMode] = useState<LadderMode>("free");
  /** Keeping it level, the team only takes hold of the ladder once it's below this angle (degrees). */
  const [takeHoldBelow, setTakeHoldBelow] = useState(45);

  const round = (v: number) => Math.round(v * 10) / 10;
  const minBeam = round(wallHeight + MIN_CLEARANCE);

  // The attachment keeps its height above the wall as the wall moves. Raising the wall pushes the ladder
  // length up so it stays past the wall height, and the attachment comes down if the ladder no longer
  // reaches it; shortening the ladder does the same.
  const changeWallHeight = (h: number) => {
    const l = Math.max(beamLength, round(h + MIN_CLEARANCE));
    setWallHeight(h);
    setBeamLength(l);
    setAttachAbove((a) => Math.min(a, round(l - h)));
  };
  const changeBeamLength = (l: number) => {
    setBeamLength(l);
    setAttachAbove((a) => Math.min(a, round(l - wallHeight)));
  };
  const attachDistance = Math.min(beamLength, wallHeight + attachAbove);

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
  // Steeper than this, a team's push at shoulder height is almost along the ladder: it barely turns it, and
  // it lifts or drags the ladder's foot before it does.
  const maxTakeHold = Math.min(MAX_TEAM_ANGLE, Math.floor(deg(phiMax({ ...setup, wallCable: cable })) * 2) / 2);
  const level = useMemo(
    () => (ladderMode === "level" ? solveLevel({ ...setup, wallCable: cable }) : null),
    [ladderMode, setup, cable],
  );
  // Until the angle that would level the stretcher is below the cutoff, the team leaves the ladder alone. Then
  // they take hold where it settles by itself and bring it round to level over the next few degrees.
  const levelPhi = level?.result.kind === "held" ? level.result.h.phi : null;
  const underrun =
    levelPhi === null
      ? 0
      : clamp((Math.min(takeHoldBelow, maxTakeHold) - deg(levelPhi)) / UNDERRUN_OVER, 0, 1);
  const needFree = underrun < 1;
  const free = useMemo(() => (needFree ? solve({ ...setup, wallCable: cable }) : null), [needFree, setup, cable]);
  const freePhi = free?.kind === "raised" ? free.eq.phi : free?.kind === "hinged" ? free.h.phi : null;
  const easing = useMemo(
    () =>
      underrun > 0 && underrun < 1 && freePhi !== null && levelPhi !== null
        ? solveHeld({ ...setup, wallCable: cable }, freePhi + underrun * (levelPhi - freePhi))
        : null,
    [underrun, freePhi, levelPhi, setup, cable],
  );
  const sol = underrun >= 1 || (underrun > 0 && !easing) ? level!.result : (easing ?? free!);
  const levelled = underrun >= 1 ? level : null;
  // The solver's last few digits differ between the server and the browser, which would make hydration
  // fail, so results are only shown once running in the browser.
  const inBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // --- Drawing ---
  const k = 110 / Math.max(beamWeight + barWeight, 1); // px per newton
  const force = (f: Vector2) => vec2(f.x * k, -f.y * k).clampLen(MAX_ARROW);
  const tag = (name: string, f: Vector2) => (f.len() * k > MAX_ARROW ? `${name} ≫` : name);

  // The wall is drawn just thick enough to carry the cable anchor on its back edge (only its face and top
  // matter to the physics). The drawing spans from the back of the wall to the tip of the beam lying flat,
  // and from just below the ground to the highest point the beam or the cable anchor can reach. It depends
  // only on the setup, not the wall cable, so the drawing stays still while that slider moves.
  const PPM = W / (anchorBack + beamLength + BEAM_THICKNESS / 2); // SVG units per metre
  const H = Math.round((Math.max(beamLength, wallHeight + anchorUp) + ABOVE_TOP + BELOW_GROUND) * PPM);
  const origin = vec2(anchorBack * PPM, H - BELOW_GROUND * PPM); // hinge, at the base of the wall's front face
  /** World (metres, y up) → SVG (y down). */
  const toSvg = (p: Vector2): Vector2 => vec2(origin.x + p.x * PPM, origin.y - p.y * PPM);

  const O = toSvg(Vector2.ZERO);
  const wallS = toSvg(vec2(0, wallHeight));
  const anchorS = toSvg(vec2(-anchorBack, wallHeight + anchorUp));

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

  const cablePath = (pts: Vector2[]) =>
    pts
      .map(toSvg)
      .map((p) => `${p.x},${p.y}`)
      .join(" ");
  const beamLine = (phi: number) => {
    const tipS = toSvg(Vector2.fromAngle(phi, beamLength));
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
  const barLine = (a: Vector2, b: Vector2) => (
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
  const hingeArrows = (R: Vector2) => (
    <>
      <Arrow from={O} v={force(R)} color={COLORS.hinge} label={tag("R", R)} />
      {showComponents && (
        <>
          <Arrow from={O} v={force(vec2(R.x, 0))} color={COLORS.component} dashed width={1.5} label="Rx" />
          <Arrow from={O} v={force(vec2(0, R.y))} color={COLORS.component} dashed width={1.5} label="Ry" />
        </>
      )}
    </>
  );
  const hingeReadouts = (R: Vector2 | null) => (
    <>
      <Readout label="Force on ladder's foot R" value={R ? `${R.len().toFixed(0)} N` : NONE} color={COLORS.hinge} />
      {showComponents && (
        <Readout
          label="  Rx, Ry"
          value={R ? `${R.x.toFixed(0)}, ${R.y.toFixed(0)} N` : NONE}
          color={COLORS.component}
        />
      )}
      <Readout label="  R direction" value={R ? `${deg(Math.atan2(R.y, R.x)).toFixed(1)}°` : NONE} />
    </>
  );
  /** A cable's pull on the hanging beam, with its x/y components when they're shown. */
  const tensionArrow = (name: "T₁" | "T₂", at: Vector2, t: Vector2, color: string) => (
    <>
      <Arrow from={at} v={force(t)} color={color} label={tag(name, t)} width={2} />
      {showComponents && (
        <>
          <Arrow from={at} v={force(vec2(t.x, 0))} color={COLORS.component} dashed width={1.5} label={`${name}x`} />
          <Arrow from={at} v={force(vec2(0, t.y))} color={COLORS.component} dashed width={1.5} label={`${name}y`} />
        </>
      )}
    </>
  );
  /** `t` is null when there's no solution; `slack` when the cable carries nothing. */
  const tensionReadouts = (name: "T₁" | "T₂", cable: string, t: Vector2 | "slack" | null, color: string) => (
    <>
      <Readout
        label={`Tension, ${cable} ${name}`}
        value={t === "slack" ? "slack" : t ? `${t.len().toFixed(0)} N` : NONE}
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
  const wallOnBeamArrow = (w: { point: Vector2; force: Vector2 } | null) =>
    w && (
      <Arrow from={toSvg(w.point)} v={force(w.force)} color={COLORS.contact} label={tag("N wall", w.force)} width={2} />
    );

  let diagram: React.ReactNode;
  if (sol.kind === "raised") {
    const eq = sol.eq;
    const attachS = toSvg(eq.beamAttach);
    const end1S = toSvg(eq.barEnd1);
    const end2S = toSvg(eq.barEnd2);
    const barCentreS = toSvg(eq.barEnd1.add(eq.barEnd2).scale(0.5));

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
        <Arrow from={barCentreS} v={force(vec2(0, -barWeight))} color={COLORS.bar} label="W" />
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
        {eq.hinge && hingeArrows(eq.hinge)}
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
          <Label at={wallPath[last - 1].add(wallPath[last]).scale(0.5).add(vec2(0, -14))} color="#94a3b8">
            slack
          </Label>
        )}
        <line
          x1={end2S.x}
          y1={end2S.y}
          x2={attachS.x}
          y2={attachS.y}
          stroke={h.beamCableTaut ? "#cbd5e1" : "#94a3b8"}
          strokeWidth={1.5}
          strokeDasharray={h.beamCableTaut ? undefined : "5 5"}
        />
        {beamLine(h.phi)}
        {barLine(end1S, end2S)}

        <Arrow
          from={toSvg(h.barEnd1.add(h.barEnd2).scale(0.5))}
          v={force(vec2(0, -barWeight))}
          color={COLORS.bar}
          label="W"
        />
        {h.cableTaut && tensionArrow("T₁", end1S, h.t1, COLORS.tensionWall)}
        {h.t2.len() > 1e-6 && tensionArrow("T₂", end2S, h.t2, COLORS.tensionBeam)}
        {h.beamPush.len() > 1e-6 && (
          <Arrow
            from={toSvg(h.supportAt)}
            v={force(h.beamPush)}
            color={COLORS.contact}
            label={tag("N", h.beamPush)}
            width={2}
          />
        )}
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
  } else if (sol.kind === "held") {
    const h = sol.h;
    const end1S = toSvg(h.barEnd1);
    const end2S = toSvg(h.barEnd2);
    const cableLine = (pts: Vector2[], taut: boolean) => (
      <polyline
        points={cablePath(pts)}
        fill="none"
        stroke={taut ? "#cbd5e1" : "#94a3b8"}
        strokeWidth={1.5}
        strokeDasharray={taut ? undefined : "5 5"}
        strokeLinejoin="round"
      />
    );

    diagram = (
      <>
        {ground}
        {cableLine([h.anchor, ...(h.wrapEdge ? [h.wrapEdge] : []), h.barEnd1], h.ropeTaut)}
        {cableLine([h.beamAttach, ...(h.attachVia ? [h.attachVia] : []), h.barEnd2], h.attachmentTaut)}
        {beamLine(h.phi)}
        {barLine(end1S, end2S)}

        <Arrow
          from={toSvg(h.barEnd1.add(h.barEnd2).scale(0.5))}
          v={force(vec2(0, -barWeight))}
          color={COLORS.bar}
          label="W"
        />
        {h.ropeTaut && tensionArrow("T₁", end1S, h.t1, COLORS.tensionWall)}
        {h.attachmentTaut && tensionArrow("T₂", end2S, h.t2, COLORS.tensionBeam)}
        {h.contacts.map((c, i) => (
          <Arrow
            key={i}
            from={toSvg(c.point)}
            v={force(c.force)}
            color={COLORS.contact}
            label={tag("N", c.force)}
            width={2}
          />
        ))}

        {/* forces on the ladder */}
        {h.hold && (
          <>
            <circle cx={toSvg(h.hold.point).x} cy={toSvg(h.hold.point).y} r={4} fill={COLORS.hold} />
            <Arrow
              from={toSvg(h.hold.point)}
              v={force(h.hold.force)}
              color={COLORS.hold}
              label={tag("F team", h.hold.force)}
              width={2}
            />
          </>
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
          t1: sol.eq.t1 as Vector2 | "slack",
          t2: sol.eq.t2 as Vector2 | "slack",
          hinge: sol.eq.hinge as Vector2 | null,
          wallOnBeam: sol.eq.wallOnBeam,
          beamPush: null as Vector2 | null,
          contacts: sol.eq.contacts,
        }
      : sol.kind === "hinged"
        ? {
            phi: sol.h.phi,
            tilt: sol.h.angle,
            t1: sol.h.cableTaut ? sol.h.t1 : ("slack" as const),
            t2: sol.h.t2.len() > 1e-6 ? sol.h.t2 : ("slack" as const),
            hinge: sol.h.hinge,
            wallOnBeam: sol.h.wallOnBeam,
            beamPush: sol.h.beamPush,
            contacts: sol.h.barContact ? [sol.h.barContact] : [],
          }
        : sol.kind === "held"
          ? {
              phi: sol.h.phi,
              tilt: sol.h.tilt,
              t1: sol.h.ropeTaut ? sol.h.t1 : ("slack" as const),
              t2: sol.h.attachmentTaut ? sol.h.t2 : ("slack" as const),
              hinge: sol.h.hinge,
              wallOnBeam: sol.h.wallOnBeam,
              beamPush: sumForces(sol.h.contacts.filter((c) => c.surface === "ladder")),
              contacts: sol.h.contacts,
            }
          : null;
  const hold = inBrowser && sol.kind === "held" ? sol.h.hold : null;
  /** Positive when the team holds the ladder up, negative when it pulls it down (shown with its sign). */
  const holdPush = hold ? hold.force.y : 0;
  // The ladder's foot only sits in the corner: the ground can push it up and the wall push it out, but
  // neither can hold it down, and only the ground's grip stops it sliding away from the wall.
  const footTolerance = 1e-3 * (beamWeight + barWeight);
  const foot = view?.hinge;
  const footProblem = !foot
    ? null
    : foot.y < -footTolerance
      ? "Its foot would lift off the ground: it would need pinning down at the base."
      : foot.x < -FOOT_FRICTION * foot.y - footTolerance
        ? "Its foot would slide away from the wall: the ground's grip isn't enough to hold it."
        : null;
  const notice = !inBrowser
    ? null
    : sol.kind === "none"
      ? { title: "No balanced position for these settings", detail: sol.reason }
      : levelled && !levelled.level && levelled.result.kind === "held"
        ? {
            title: "The team can\u2019t hold the stretcher level here",
            detail: `${levelled.reason} Shown with the ladder held at the angle that would level it.`,
          }
        : footProblem
          ? { title: "The ladder wouldn\u2019t stay put", detail: footProblem }
          : null;

  return (
    <VisualisationLayout
      diagram={
        <div className="relative flex flex-col gap-4 p-4">
          {notice && (
            <div className="absolute inset-x-4 top-6 text-center text-sm text-amber-400">
              <p className="font-medium">{notice.title}</p>
              <p className="mx-auto mt-1 max-w-md text-amber-400/80">{notice.detail}</p>
            </div>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
            {inBrowser ? diagram : ground}
          </svg>
          <Slider
            label="Rope length"
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
      controls={(more) => (
        <>
          <Choice
            label="Ladder Angle"
            value={ladderMode}
            options={[
              { value: "free", label: "Auto" },
              { value: "level", label: "Underrun" },
            ]}
            onChange={setLadderMode}
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
            label="Attachment height"
            value={attachAbove}
            min={MIN_CLEARANCE}
            max={round(beamLength - wallHeight)}
            step={0.1}
            unit="m"
            onChange={setAttachAbove}
          />
          <Separator />
          {more(
            <>
              <Slider
                label="Attachment length"
                value={beamCable}
                min={0.1}
                max={1}
                step={0.05}
                unit="m"
                digits={2}
                onChange={setBeamCable}
              />
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
                max={MAX_ANCHOR_BACK}
                step={0.05}
                unit="m"
                digits={2}
                onChange={setAnchorBack}
              />
              <Slider
                label="Ladder length"
                value={beamLength}
                min={minBeam}
                max={MAX_BEAM_LENGTH}
                step={0.1}
                unit="m"
                onChange={changeBeamLength}
              />
              <Slider
                label="Ladder mass"
                value={beamMass}
                min={1}
                max={100}
                step={1}
                unit="kg"
                digits={0}
                onChange={setBeamMass}
              />
              <Slider
                label="Team Underruns below"
                value={Math.min(takeHoldBelow, maxTakeHold)}
                min={0}
                max={maxTakeHold}
                step={0.5}
                unit="°"
                disabled={ladderMode !== "level"}
                onChange={setTakeHoldBelow}
              />
            </>,
          )}
          <Toggle label="Show x/y components" checked={showComponents} onChange={setShowComponents} />
        </>
      )}
      readouts={
        <>
          <Readout label="Ladder angle" value={view ? `${deg(view.phi).toFixed(1)}°` : NONE} />
          <Readout label="Stretcher tilt" value={view ? `${Math.abs(deg(view.tilt)).toFixed(1)}°` : NONE} />
          {tensionReadouts("T₁", "rope", view?.t1 ?? null, COLORS.tensionWall)}
          {tensionReadouts("T₂", "attachment", view?.t2 ?? null, COLORS.tensionBeam)}
          {hingeReadouts(view?.hinge ?? null)}
          <Readout label="Ground team's hold F" value={hold ? `${holdPush.toFixed(0)} N` : NONE} color={COLORS.hold} />
          <Readout
            label="Wall's edge on ladder N"
            value={view?.wallOnBeam ? `${view.wallOnBeam.force.len().toFixed(0)} N` : NONE}
            color={COLORS.contact}
          />
          <Readout
            label="Ladder on stretcher N"
            value={view?.beamPush ? `${view.beamPush.len().toFixed(0)} N` : NONE}
            color={COLORS.contact}
          />
          {(["ground", "wall", "top", "edge"] as const).map((surface) => {
            const f = sumForces(view?.contacts.filter((c) => c.surface === surface) ?? []);
            return (
              <Readout
                key={surface}
                label={`${{ ground: "Ground", wall: "Wall", top: "Wall top", edge: "Wall's edge" }[surface]} on stretcher N`}
                value={f ? `${f.len().toFixed(0)} N` : NONE}
                color={COLORS.contact}
              />
            );
          })}
          <Readout label="Total weight" value={`${(beamWeight + barWeight).toFixed(0)} N`} />
        </>
      }
      footer={
        <div className="flex flex-col gap-4">
          <LadderHingeNotes />
          {SHOW_RAW_VALUES && (
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
          )}
        </div>
      }
    />
  );
}

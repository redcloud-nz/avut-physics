"use client";

import { useDeferredValue, useMemo, useState, useSyncExternalStore } from "react";
import { Arrow, Label, add, deg, len, scale, vec, type Vec } from "@/components/diagram/svg";
import { Separator } from "@/components/ui/separator";
import { RawValues, Readout, Select, Slider, Toggle, VisualisationLayout } from "@/components/diagram/controls";
import { EDGES, SURFACES, edgeFor, footingFor, type Edge, type Footing } from "./body-belay-surfaces";
import { BodyBelayNotes } from "./body-belay-notes";
import { WAIST_HEIGHT, solveBelay, type Belayed, type Belayer, type V3 } from "./body-belay-solver";
import { TEAM_HEIGHT } from "./two-point-lower-solver";

const COLORS = {
  line: "#38bdf8",
  rope: "#818cf8",
  bar: "#facc15",
  component: "#94a3b8",
  contact: "#34d399",
  team: "#a3e635",
  belayer: "#fb923c",
  slipping: "#f87171",
};

const G = 9.81;
const MAX_ARROW = 200;
const BAR_LENGTH = 2;
const BAR_THICKNESS = 0.08;
/** Room either side of the belayers in the plan view. */
const BESIDE_BELAYERS = 0.8;
/** The belayer's height, for drawing them (their shoulders and head carry on up their body from their waist). */
const BELAYER_HEIGHT = 1.75;
const SHOULDER_HEIGHT = 1.45;
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
/** Room behind the belayer's feet, so they can lean back into it. */
const BEHIND_BELAYER = 1.8;

/** Clamp an arrow's drawn length so very large forces stay on screen. */
const clampLen = (v: Vec) => {
  const l = len(v);
  return l > MAX_ARROW ? scale(v, MAX_ARROW / l) : v;
};

/** A point seen side on: its sideways place along the wall dropped. */
const side = (p: V3): Vec => vec(p.x, p.y);
const mirror = (p: V3): V3 => ({ ...p, z: -p.z });

/**
 * A body-belayed two-point lower: the two-point lower with no anchor, the stretcher held on two ropes, each round
 * the waist of a belayer standing on the wall top, side by side. They lean back against the ropes' pull, and the
 * page shows whether their feet grip well enough to hold them there. A second drawing shows the ropes from above,
 * opening into a V as the belayers stand further apart.
 */
export default function BodyBelay(props: { maths?: React.ReactNode }) {
  const [barMass, setBarMass] = useState(90);
  const [wallHeight, setWallHeight] = useState(4);
  const [belayerMass, setBelayerMass] = useState(80);
  const [footing, setFooting] = useState<Footing>("painted-steel-dry");
  const [edge, setEdge] = useState<Edge>("steel");
  const [belayerBack, setBelayerBack] = useState(3);
  const [gap, setGap] = useState(2);
  const [teamDistance, setTeamDistance] = useState(6);
  const [teamPull, setTeamPull] = useState(200);
  const [showComponents, setShowComponents] = useState(false);

  const barWeight = barMass * G;
  const belayerWeight = belayerMass * G;
  const { grip, label: footingLabel } = footingFor(footing);
  const edgeFriction = edgeFor(edge).friction;
  const setup = useMemo(
    () => ({
      wallHeight,
      belayerBack,
      gap,
      belayerWeight,
      grip,
      edgeFriction,
      teamDistance,
      teamPull,
      barLength: BAR_LENGTH,
      barWeight,
    }),
    [wallHeight, belayerBack, gap, belayerWeight, grip, edgeFriction, teamDistance, teamPull, barWeight],
  );
  // Working out the belayers' lean takes a handful of solves, so the sliders move first and the drawing follows.
  const input = useDeferredValue(setup);
  const sol = useMemo(() => solveBelay(input), [input]);
  // The solver's last few digits differ between the server and the browser, which would make hydration
  // fail, so results are only shown once running in the browser.
  const inBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // --- Drawing ---
  const k = 110 / Math.max(barWeight, 1); // px per newton
  const force = (f: Vec) => clampLen(vec(f.x * k, -f.y * k));
  const tag = (name: string, f: Vec) => (len(f) * k > MAX_ARROW ? `${name} ≫` : name);

  // The wall is drawn just deep enough for the belayer to lean back on it (only its face and top matter to the
  // physics). The drawing spans from the back of the wall to just past the team, and from just below the
  // ground to above the belayer's head. It depends only on the setup, so it stays still as the stretcher moves.
  const back = belayerBack + BEHIND_BELAYER;
  const PPM = W / (back + teamDistance + PAST_TEAM); // SVG units per metre
  const H = Math.round((wallHeight + BELAYER_HEIGHT + ABOVE_TOP + BELOW_GROUND) * PPM);
  const origin = vec(back * PPM, H - BELOW_GROUND * PPM); // the base of the wall's face
  /** World (metres, y up) → SVG (y down). */
  const toSvg = (p: Vec): Vec => vec(origin.x + p.x * PPM, origin.y - p.y * PPM);

  const O = toSvg(vec(0, 0));
  const wallS = toSvg(vec(0, wallHeight));
  const teamFootS = toSvg(vec(teamDistance, 0));
  const teamS = toSvg(vec(teamDistance, TEAM_HEIGHT));

  const scene = (
    <>
      <line x1={0} y1={O.y} x2={W} y2={O.y} stroke="#475569" strokeWidth={1.5} />
      <rect
        x={O.x - back * PPM}
        y={wallS.y}
        width={back * PPM}
        height={wallHeight * PPM}
        fill="#1e293b"
        stroke="#475569"
      />
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
      <Label at={add(teamFootS, vec(0, 20))} color={COLORS.team}>
        team
      </Label>
    </>
  );

  const cableLine = (pts: Vec[], taut: boolean) => (
    <polyline
      points={pts
        .map(toSvg)
        .map((p) => `${p.x},${p.y}`)
        .join(" ")}
      fill="none"
      stroke={taut ? "#cbd5e1" : "#94a3b8"}
      strokeWidth={1.5}
      strokeDasharray={taut ? undefined : "5 5"}
      strokeLinejoin="round"
    />
  );
  /** A pull on the stretcher, with its x/y components when they're shown. */
  const tensionArrow = (name: string, at: Vec, t: Vec, color: string) => (
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

  /** A belayer seen side on, leaning back from their feet (the other stands behind them, a mirror image). */
  const belayerFigure = (b: Pick<Belayer, "lean" | "facing">, color: string) => {
    const feet = vec(-belayerBack, wallHeight);
    // Their lean is partly sideways, away from the middle, which side on doesn't show.
    const up = vec(-Math.sin(b.lean) * b.facing.x, Math.cos(b.lean));
    const along = (h: number) => toSvg(add(feet, scale(up, h)));
    const [f, w, sh, head] = [along(0), along(WAIST_HEIGHT), along(SHOULDER_HEIGHT), along(BELAYER_HEIGHT - 0.12)];
    return (
      <g stroke={color} strokeWidth={4} strokeLinecap="round" fill="none">
        <line x1={f.x} y1={f.y} x2={sh.x} y2={sh.y} />
        <circle cx={head.x} cy={head.y} r={0.12 * PPM} fill={color} stroke="none" />
        <circle cx={w.x} cy={w.y} r={3.5} fill="#cbd5e1" stroke="none" />
      </g>
    );
  };

  let diagram: React.ReactNode = (
    <>
      {scene}
      {belayerFigure({ lean: 0, facing: { x: 1, z: 0 } }, COLORS.belayer)}
    </>
  );
  if (sol.kind === "belayed") {
    const { l, b } = sol;
    const belayerColor = b.holds ? COLORS.belayer : COLORS.slipping;
    const feetS = toSvg(side(b.feet));
    const waistS = toSvg(side(b.waist));
    const end1S = toSvg(l.barEnd1);
    const end2S = toSvg(l.barEnd2);
    const ropePath = [l.anchor, ...(l.wrapEdge ? [l.wrapEdge] : []), l.barEnd1];
    const linePath = [l.team, ...(l.lineEdge ? [l.lineEdge] : []), l.barEnd2];
    const lineTaut = len(l.t2) > 1e-6;
    diagram = (
      <>
        {scene}
        {belayerFigure(b, belayerColor)}
        <Label at={add(toSvg(vec(-belayerBack, wallHeight)), vec(0, 16))} color={belayerColor}>
          ×2
        </Label>
        {cableLine(ropePath, l.ropeTaut)}
        {cableLine(linePath, lineTaut)}
        {!l.ropeTaut && (
          <Label at={add(scale(add(toSvg(ropePath.at(-2)!), end1S), 0.5), vec(0, -14))} color="#94a3b8">
            slack
          </Label>
        )}
        <line
          x1={end1S.x}
          y1={end1S.y}
          x2={end2S.x}
          y2={end2S.y}
          stroke="#a16207"
          strokeWidth={BAR_THICKNESS * PPM}
          strokeLinecap="round"
        />
        <Arrow
          from={toSvg(scale(add(l.barEnd1, l.barEnd2), 0.5))}
          v={force(vec(0, -barWeight))}
          color={COLORS.bar}
          label="W"
        />
        {l.ropeTaut && tensionArrow("2 ropes", end1S, l.t1, COLORS.rope)}
        {lineTaut && tensionArrow("T₂", end2S, l.t2, COLORS.line)}
        <Arrow from={waistS} v={force(vec(0, -belayerWeight))} color={belayerColor} label="Wb" />
        {l.ropeTaut && (
          <Arrow from={waistS} v={force(side(b.pull))} color={COLORS.rope} label={tag("T₁", side(b.pull))} width={2} />
        )}
        <Arrow
          from={feetS}
          v={force(side(b.ground))}
          color={COLORS.contact}
          label={tag("R", side(b.ground))}
          width={2}
        />
        {showComponents && (
          <>
            <Arrow from={feetS} v={force(vec(0, b.ground.y))} color={COLORS.component} dashed width={1.5} label="N" />
            <Arrow from={feetS} v={force(vec(b.ground.x, 0))} color={COLORS.component} dashed width={1.5} label="F" />
          </>
        )}
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

  // Seen from above: x across exactly as in the side view, so the two line up, and z (along the wall) up the
  // page at the same scale. It's tall enough for the belayers however far apart they stand.
  const planPpm = PPM;
  const planH = Math.round((gap + 2 * BESIDE_BELAYERS) * planPpm);
  const toPlan = (p: { x: number; z: number }): Vec => vec(origin.x + p.x * planPpm, planH / 2 - p.z * planPpm);
  const planView = (r: Belayed | null) => {
    const face = toPlan({ x: 0, z: 0 });
    const team = toPlan({ x: teamDistance, z: 0 });
    const ropes = r
      ? [r.b, { ...r.b, feet: mirror(r.b.feet), waist: mirror(r.b.waist) }].map((b, i) => {
          const crossing = r.edgeCrossing && (i === 0 ? r.edgeCrossing : mirror(r.edgeCrossing));
          const pts = [b.waist, ...(crossing ? [crossing] : []), { x: r.l.barEnd1.x, z: 0 }].map(toPlan);
          const feet = toPlan(b.feet);
          const waist = toPlan(b.waist);
          const color = r.b.holds ? COLORS.belayer : COLORS.slipping;
          return (
            <g key={i}>
              <polyline
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />
              <line
                x1={feet.x}
                y1={feet.y}
                x2={waist.x}
                y2={waist.y}
                stroke={color}
                strokeWidth={4}
                strokeLinecap="round"
              />
              <circle cx={waist.x} cy={waist.y} r={0.12 * planPpm} fill={color} />
            </g>
          );
        })
      : null;
    const end1 = r && toPlan({ x: r.l.barEnd1.x, z: 0 });
    const end2 = r && toPlan({ x: r.l.barEnd2.x, z: 0 });
    return (
      <>
        <rect x={0} y={0} width={face.x} height={planH} fill="#1e293b" />
        <line x1={face.x} y1={0} x2={face.x} y2={planH} stroke="#475569" strokeWidth={1.5} />
        <PlanText at={vec(8, planH - 14)} color="#94a3b8" anchor="start">
          wall top
        </PlanText>
        {end1 && end2 && (
          <>
            <line x1={end2.x} y1={end2.y} x2={team.x} y2={team.y} stroke="#cbd5e1" strokeWidth={1.5} />
            <line
              x1={end1.x}
              y1={end1.y}
              x2={end2.x}
              y2={end2.y}
              stroke="#a16207"
              strokeWidth={Math.max(BAR_THICKNESS * planPpm, 4)}
              strokeLinecap="round"
            />
          </>
        )}
        <circle cx={team.x} cy={team.y} r={5} fill={COLORS.team} />
        {ropes}
        {r && end1 && (
          <PlanText at={add(end1, vec(14, -14))} color={COLORS.rope} anchor="start">
            {`${deg(r.ropeAngle).toFixed(0)}° between ropes`}
          </PlanText>
        )}
      </>
    );
  };

  // The readouts always show the same rows, so the panel doesn't jump as the arrangement changes.
  const view = inBrowser && sol.kind === "belayed" ? sol.l : null;
  const belayed = inBrowser && sol.kind === "belayed" ? sol : null;
  const belayer = belayed?.b ?? null;
  /** Each rope's push on the wall's edge as it wraps over it: its tension either side, pulling both ways round it. */
  const ropeOnEdge = (() => {
    const c = belayed?.edgeCrossing;
    if (!belayed || !c || belayed.tension <= 0) return null;
    const out = (p: V3) => {
      const d = { x: p.x - c.x, y: p.y - c.y, z: p.z - c.z };
      const l = Math.hypot(d.x, d.y, d.z);
      return { x: d.x / l, y: d.y / l, z: d.z / l };
    };
    const [a, b] = [out(belayed.b.waist), out({ x: belayed.l.barEnd1.x, y: belayed.l.barEnd1.y, z: 0 })];
    const [t, u] = [belayed.tension, belayed.loadTension];
    return Math.hypot(t * a.x + u * b.x, t * a.y + u * b.y, t * a.z + u * b.z);
  })();
  // How far the stretcher hangs out from the wall's face, once it's over the edge and below the wall top.
  const nearest = view ? Math.min(view.barEnd1.x, view.barEnd2.x) : -1;
  const clearance =
    view && nearest > -1e-6 && Math.min(view.barEnd1.y, view.barEnd2.y) < wallHeight ? Math.max(0, nearest) : null;
  const notice = !inBrowser
    ? null
    : sol.kind === "none"
      ? { title: "No balanced position for these settings", detail: sol.reason }
      : !sol.b.holds
        ? {
            title: "The belayers would slide towards the edge",
            detail: `Their feet need a grip of ${sol.b.gripNeeded.toFixed(2)} to hold, more than the ${grip.toFixed(2)} of ${footingLabel}.`,
          }
        : null;

  // With the rope just past the edge, the stretcher hangs over it: it only touches the ground, on the lowest
  // walls, and the line is always at the team's steady pull, so neither the other surfaces nor T₂ get a row.
  const onGround = view?.contacts.filter((c) => c.surface === "ground") ?? [];
  const groundOnStretcher = onGround.length ? onGround.reduce((sum, c) => add(sum, c.force), vec(0, 0)) : null;
  /** Both ropes' pull on the stretcher together (their sideways pulls cancel). */
  const pullReadouts = (t: Vec | null) => (
    <>
      <Readout
        label="Ropes' pull on stretcher"
        value={!view ? NONE : t && len(t) > 1e-6 ? `${len(t).toFixed(0)} N` : "slack"}
        color={COLORS.rope}
      />
      {showComponents && (
        <Readout
          label="  x, y"
          value={t && len(t) > 1e-6 ? `${t.x.toFixed(0)}, ${t.y.toFixed(0)} N` : NONE}
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
            <div className="absolute inset-x-4 top-6 text-center text-sm text-amber-400">
              <p className="font-medium">{notice.title}</p>
              <p className="mx-auto mt-1 max-w-md text-amber-400/80">{notice.detail}</p>
            </div>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
            {inBrowser ? diagram : scene}
          </svg>
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">From above</h3>
            <svg viewBox={`0 0 ${W} ${planH}`} className="block h-auto w-full">
              {planView(belayed)}
            </svg>
          </div>
        </div>
      }
      controls={(more) => (
        <>
          <Slider label="Wall height" value={wallHeight} min={2} max={6} step={0.1} unit="m" onChange={setWallHeight} />
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
            label="Each belayer's mass"
            value={belayerMass}
            min={40}
            max={150}
            step={1}
            unit="kg"
            digits={0}
            onChange={setBelayerMass}
          />
          <Slider label="Gap between belayers" value={gap} min={0} max={6} step={0.1} unit="m" onChange={setGap} />
          <Select
            label="Footing"
            value={footing}
            groups={(["dry", "wet"] as const).map((w) => ({
              label: w === "dry" ? "Dry" : "Wet",
              options: SURFACES.map((s) => ({
                value: `${s.key}-${w}` as Footing,
                label: `${w === "dry" ? "Dry" : "Wet"} ${s.label.toLowerCase()} (${s[w].toFixed(2)})`,
              })),
            }))}
            onChange={setFooting}
          />
          <Select
            label="Wall's edge"
            value={edge}
            groups={[{ options: EDGES.map((e) => ({ value: e.key, label: `${e.label} (${e.friction.toFixed(2)})` })) }]}
            onChange={setEdge}
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
                label="Belayers' setback"
                value={belayerBack}
                min={2}
                max={5}
                step={0.05}
                unit="m"
                digits={2}
                onChange={setBelayerBack}
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
          <Toggle label="Show x/y components" checked={showComponents} onChange={setShowComponents} />
        </>
      )}
      readouts={
        <>
          <Readout
            label="Each rope's length"
            value={belayed ? `${belayed.rope.toFixed(2)} m` : NONE}
            color={COLORS.rope}
          />
          <Readout
            label="Angle between ropes"
            value={belayed ? `${deg(belayed.ropeAngle).toFixed(1)}°` : NONE}
            color={COLORS.rope}
          />
          <Readout
            label="Each rope's turn over edge"
            value={belayed ? `${deg(belayed.wrap).toFixed(0)}°` : NONE}
            color={COLORS.rope}
          />
          <Readout
            label="Rope tension at stretcher"
            value={belayed ? (belayed.loadTension > 1e-6 ? `${belayed.loadTension.toFixed(0)} N` : "slack") : NONE}
            color={COLORS.rope}
          />
          <Readout
            label="Rope tension at belayer T₁"
            value={belayed ? (belayed.tension > 1e-6 ? `${belayed.tension.toFixed(0)} N` : "slack") : NONE}
            color={COLORS.rope}
          />
          <Readout
            label="Each belayer's footing"
            value={belayer ? (belayer.holds ? "holds" : "slides") : NONE}
            color={belayer && !belayer.holds ? COLORS.slipping : COLORS.belayer}
          />
          <Readout
            label="Each belayer's lean"
            value={belayer ? `${deg(belayer.lean).toFixed(1)}°` : NONE}
            color={COLORS.belayer}
          />
          <Readout
            label="Grip needed"
            value={belayer ? belayer.gripNeeded.toFixed(2) : NONE}
            color={belayer && !belayer.holds ? COLORS.slipping : COLORS.belayer}
          />
          <Readout
            label="Footing safety factor"
            value={belayer ? `${Number.isFinite(belayer.safety) ? belayer.safety.toFixed(2) : "∞"} : 1` : NONE}
            color={belayer && !belayer.holds ? COLORS.slipping : COLORS.belayer}
          />
          <Readout
            label="Ground on each belayer R"
            value={belayer ? `${len(belayer.ground).toFixed(0)} N` : NONE}
            color={COLORS.contact}
          />
          {showComponents && (
            <Readout
              label="  N, F"
              value={
                belayer
                  ? `${belayer.ground.y.toFixed(0)}, ${Math.hypot(belayer.ground.x, belayer.ground.z).toFixed(0)} N`
                  : NONE
              }
              color={COLORS.component}
            />
          )}
          <Readout label="Each belayer's weight" value={`${belayerWeight.toFixed(0)} N`} />
          <Separator />
          <Readout label="Stretcher tilt" value={view ? `${Math.abs(deg(view.tilt)).toFixed(1)}°` : NONE} />
          <Readout label="Clearance from wall" value={clearance !== null ? `${clearance.toFixed(2)} m` : NONE} />
          {pullReadouts(view?.t1 ?? null)}
          <Readout
            label="Each rope on wall's edge"
            value={ropeOnEdge !== null ? `${ropeOnEdge.toFixed(0)} N` : NONE}
            color={COLORS.rope}
          />
          <Readout
            label="Ground on stretcher N"
            value={groundOnStretcher ? `${len(groundOnStretcher).toFixed(0)} N` : NONE}
            color={COLORS.contact}
          />
          <Readout label="Stretcher weight" value={`${barWeight.toFixed(0)} N`} />
        </>
      }
      footer={
        <div className="flex flex-col gap-4">
          <BodyBelayNotes />
          {props.maths}
          {SHOW_RAW_VALUES && <RawValues title="Raw values" data={{ inputs: input, result: sol }} />}
        </div>
      }
    />
  );
}

/** A label on the plan view, lined up at its start or end rather than centred. */
function PlanText(props: { at: Vec; color: string; anchor: "start" | "end"; children: React.ReactNode }) {
  return (
    <text
      x={props.at.x}
      y={props.at.y}
      fill={props.color}
      fontSize={14}
      fontFamily="var(--font-geist-mono), monospace"
      textAnchor={props.anchor}
      dominantBaseline="middle"
      paintOrder="stroke"
      stroke="#0f172a"
      strokeWidth={4}
    >
      {props.children}
    </text>
  );
}

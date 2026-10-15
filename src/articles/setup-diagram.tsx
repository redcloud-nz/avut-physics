import { DEFAULTS, arrangement } from "@/articles/standing-body-belays-figures";

/*
 * The lower, seen side on and drawn to scale from the solver's arrangement for the common case, holding still.
 * Drawn in `currentColor` and its tints, so it prints in black on white.
 */

type P = { x: number; y: number };

/** How tall the people are drawn (m), as on the body belay page. */
const PERSON_HEIGHT = 1.75;

// The scene's extent, in metres: the wall's face at x = 0, the ground at y = 0.
const LEFT = -4.8;
const RIGHT = 4.8;
const TOP = 5.0;
const BOTTOM = -0.8;
/** SVG user units per metre. */
const S = 50;
const W = (RIGHT - LEFT) * S;
const H = (TOP - BOTTOM) * S;

const X = (x: number) => (x - LEFT) * S;
const Y = (y: number) => (TOP - y) * S;
const pt = (p: P) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`;
const along = (from: P, to: P, d: number): P => {
  const l = Math.hypot(to.x - from.x, to.y - from.y);
  return { x: from.x + ((to.x - from.x) * d) / l, y: from.y + ((to.y - from.y) * d) / l };
};

/** A straight-bodied person from `feet` towards `toward`, with their hands at `hands`. */
function Person(props: { feet: P; toward: P; hands: P }) {
  const head = along(props.feet, props.toward, PERSON_HEIGHT - 0.12);
  const shoulder = along(props.feet, props.toward, 1.45);
  return (
    <g stroke="currentColor" strokeWidth={3} strokeLinecap="round" fill="none">
      <line x1={X(props.feet.x)} y1={Y(props.feet.y)} x2={X(shoulder.x)} y2={Y(shoulder.y)} />
      <line x1={X(shoulder.x)} y1={Y(shoulder.y)} x2={X(props.hands.x)} y2={Y(props.hands.y)} strokeWidth={2} />
      <circle cx={X(head.x)} cy={Y(head.y)} r={0.12 * S} fill="currentColor" stroke="none" />
    </g>
  );
}

/** A labelled distance from `a` to `b`, with its label `dy` units below (or above, if negative) its middle. */
function Dimension(props: { a: P; b: P; label: string; dy?: number; anchor?: "start" | "middle" }) {
  const mid = { x: (props.a.x + props.b.x) / 2, y: (props.a.y + props.b.y) / 2 };
  return (
    <g>
      <line
        x1={X(props.a.x)}
        y1={Y(props.a.y)}
        x2={X(props.b.x)}
        y2={Y(props.b.y)}
        stroke="currentColor"
        strokeWidth={1}
        markerStart="url(#dimension-end)"
        markerEnd="url(#dimension-end)"
      />
      <text
        x={X(mid.x) + (props.anchor === "start" ? 6 : 0)}
        y={Y(mid.y) + (props.dy ?? 16)}
        textAnchor={props.anchor ?? "middle"}
        fill="currentColor"
      >
        {props.label}
      </text>
    </g>
  );
}

export function SetupDiagram() {
  const a = arrangement({ edgeFriction: 0 });
  const { l, b } = a;
  const wall = DEFAULTS.wallHeight;
  const feet = { x: b.feet.x, y: b.feet.y };
  const waist = l.anchor;
  const rope = [waist, ...(l.wrapEdge ? [l.wrapEdge] : []), l.barEnd1];
  const line = [l.barEnd2, ...(l.lineEdge ? [l.lineEdge] : []), l.team];
  const teamFeet = { x: l.team.x + 0.35, y: 0 };
  const stretcherMid = { x: (l.barEnd1.x + l.barEnd2.x) / 2, y: (l.barEnd1.y + l.barEnd2.y) / 2 };

  return (
    <figure className="flex flex-col gap-2 print:break-inside-avoid">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full text-slate-400"
        fontSize={14}
        role="img"
        aria-labelledby="setup-caption"
      >
        <defs>
          <marker
            id="dimension-end"
            viewBox="0 0 10 10"
            refX={5}
            refY={5}
            markerWidth={8}
            markerHeight={8}
            orient="auto"
          >
            <path d="M5,0 L5,10" stroke="currentColor" strokeWidth={1.5} />
          </marker>
        </defs>

        {/* The container and the ground. */}
        <rect
          x={X(LEFT)}
          y={Y(wall)}
          width={X(0) - X(LEFT)}
          height={Y(0) - Y(wall)}
          fill="currentColor"
          opacity={0.08}
        />
        <path
          d={`M${pt({ x: LEFT, y: wall })} L${pt({ x: 0, y: wall })} L${pt({ x: 0, y: 0 })}`}
          stroke="currentColor"
          strokeWidth={2}
          fill="none"
        />
        <line x1={X(LEFT)} x2={X(RIGHT)} y1={Y(0)} y2={Y(0)} stroke="currentColor" strokeWidth={2} />
        <circle cx={X(0)} cy={Y(wall)} r={0.07 * S} fill="currentColor" />

        {/* The rope and the ground team's line. */}
        <g className="text-sky-400 print:text-black" stroke="currentColor" strokeWidth={2} fill="none">
          <polyline points={rope.map(pt).join(" ")} />
          <polyline points={line.map(pt).join(" ")} strokeDasharray="6 4" />
        </g>

        {/* The stretcher. */}
        <line
          x1={X(l.barEnd1.x)}
          y1={Y(l.barEnd1.y)}
          x2={X(l.barEnd2.x)}
          y2={Y(l.barEnd2.y)}
          className="text-slate-100 print:text-black"
          stroke="currentColor"
          strokeWidth={7}
          strokeLinecap="round"
        />

        {/* The people: one belayer (the other is beside them, hidden behind), and the ground team. */}
        <g className="text-slate-200 print:text-black">
          <Person feet={feet} toward={waist} hands={along(waist, rope[1], 0.35)} />
          <Person feet={teamFeet} toward={{ x: teamFeet.x + 0.25, y: 1 }} hands={l.team} />
        </g>

        {/* Dimensions. */}
        <Dimension
          a={{ x: LEFT + 0.4, y: 0 }}
          b={{ x: LEFT + 0.4, y: wall }}
          label={`${wall} m`}
          dy={5}
          anchor="start"
        />
        <Dimension a={{ x: feet.x, y: wall - 0.35 }} b={{ x: 0, y: wall - 0.35 }} label={`${DEFAULTS.belayerBack} m`} />
        <Dimension a={{ x: 0, y: -0.3 }} b={{ x: l.team.x, y: -0.3 }} label={`${DEFAULTS.teamDistance} m`} />

        {/* Labels. */}
        <g fill="currentColor" className="text-slate-300 print:text-black">
          <text x={X(-3.3)} y={Y(4.75)}>
            Two belayers, {DEFAULTS.belayerMass} kg each,
          </text>
          <text x={X(-3.3)} y={Y(4.75) + 17}>
            side by side, {DEFAULTS.gap} m apart
          </text>
          <text x={X(stretcherMid.x) + 22} y={Y(stretcherMid.y) - 6}>
            Stretcher, 2 m long,
          </text>
          <text x={X(stretcherMid.x) + 22} y={Y(stretcherMid.y) + 11}>
            {DEFAULTS.stretcherMass} kg with the casualty
          </text>
          <text x={X(RIGHT) - 4} y={Y(2.85)} textAnchor="end">
            Ground team,
          </text>
          <text x={X(RIGHT) - 4} y={Y(2.85) + 17} textAnchor="end">
            {DEFAULTS.teamPull} N pull
          </text>
        </g>
      </svg>
      <figcaption id="setup-caption" className="text-sm text-slate-400">
        <strong className="font-medium text-slate-300">Figure 1.</strong> The lower, held still just after the stretcher
        has gone over the edge, when the ropes carry the most, side on and to scale. The second belayer stands beside
        the first, hidden behind them. Each rope runs from a belayer’s waist, over the roof’s edge, to the stretcher’s
        head; the dashed line runs from its foot to the ground team.
      </figcaption>
    </figure>
  );
}

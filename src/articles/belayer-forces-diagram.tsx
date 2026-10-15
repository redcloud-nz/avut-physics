import { Arrow, vec } from "@/components/diagram/svg";
import { DEFAULTS, arrangement } from "@/articles/standing-body-belays-figures";

/*
 * The forces on one belayer in the common case, holding still, to scale in the plane of their rope: their weight,
 * the rope's pull, the ground's push up and the grip of their boots. Drawn in `currentColor` and its tints, so it
 * prints in black on white.
 */

const G = 9.81;

/** SVG user units per metre of the belayer, and per newton of force. */
const PER_METRE = 100;
const PER_NEWTON = 0.1;
/** Where their feet are. */
const FEET = vec(230, 250);
const BODY = 1.75;
const WAIST = 1;
const SHOULDER = 1.45;

/** A force in newtons, to the nearest 10. */
const newtons = (x: number) => `${Math.round(x / 10) * 10} N`;

export function BelayerForcesDiagram() {
  const b = arrangement({ edgeFriction: 0 }).b;
  const weight = DEFAULTS.belayerMass * G;
  const up = b.ground.y;
  const grip = Math.hypot(b.ground.x, b.ground.z);
  const most = DEFAULTS.grip * up;
  // The rope's pull, seen in its own plane: towards the edge as hard as the boots grip, and a little down.
  const pull = vec(grip, -b.pull.y);
  const tension = Math.hypot(pull.x, pull.y);

  // Their body leans back, away from the edge (to the right), in line with the ground's push.
  const along = (d: number) =>
    vec(FEET.x - d * PER_METRE * Math.sin(b.lean), FEET.y - d * PER_METRE * Math.cos(b.lean));
  const waist = along(WAIST);
  const shoulder = along(SHOULDER);
  const head = along(BODY - 0.12);
  const ropeEnd = vec(waist.x + pull.x * PER_NEWTON, waist.y + pull.y * PER_NEWTON);

  const heel = vec(FEET.x - 8, FEET.y);
  const gripY = FEET.y + 8;
  const mostY = FEET.y + 26;

  return (
    <figure className="flex flex-col gap-2 print:break-inside-avoid">
      <svg
        viewBox="0 70 480 290"
        className="w-full text-slate-400"
        fontSize={14}
        role="img"
        aria-labelledby="forces-caption"
      >
        {/* The ground. */}
        <rect x={0} y={FEET.y} width={480} height={110} fill="currentColor" opacity={0.08} />
        <line x1={0} x2={480} y1={FEET.y} y2={FEET.y} stroke="currentColor" strokeWidth={2} />
        <text x={470} y={FEET.y - 10} textAnchor="end" fill="currentColor">
          Towards the edge →
        </text>

        {/* The belayer. */}
        <g className="text-slate-200 print:text-black" stroke="currentColor" strokeLinecap="round" fill="none">
          <line x1={FEET.x} y1={FEET.y} x2={shoulder.x} y2={shoulder.y} strokeWidth={3} />
          <line x1={shoulder.x} y1={shoulder.y} x2={waist.x + 18} y2={waist.y + 5} strokeWidth={2} />
          <circle cx={head.x} cy={head.y} r={12} fill="currentColor" stroke="none" />
        </g>

        {/* The forces. */}
        <g className="text-sky-400 print:text-black">
          <Arrow from={waist} v={vec(pull.x * PER_NEWTON, pull.y * PER_NEWTON)} color="currentColor" />
          <Arrow from={waist} v={vec(0, weight * PER_NEWTON)} color="currentColor" />
          <Arrow from={vec(heel.x, heel.y + up * PER_NEWTON)} v={vec(0, -up * PER_NEWTON)} color="currentColor" />
          <Arrow from={vec(FEET.x + grip * PER_NEWTON, gripY)} v={vec(-grip * PER_NEWTON, 0)} color="currentColor" />
          <Arrow
            from={vec(FEET.x + most * PER_NEWTON, mostY)}
            v={vec(-most * PER_NEWTON, 0)}
            color="currentColor"
            dashed
            width={1.5}
          />
        </g>

        {/* Their labels. */}
        <g fill="currentColor" className="text-slate-300 print:text-black">
          <text x={ropeEnd.x + 10} y={ropeEnd.y - 4}>
            Rope pulls, {newtons(tension)}
          </text>
          <text x={waist.x - 10} y={waist.y + (weight * PER_NEWTON) / 2 + 20} textAnchor="end">
            Weight,
          </text>
          <text x={waist.x - 10} y={waist.y + (weight * PER_NEWTON) / 2 + 37} textAnchor="end">
            {newtons(weight)}
          </text>
          <text x={heel.x - 10} y={heel.y + 60} textAnchor="end">
            Ground pushes up, {newtons(up)}
          </text>
          <text x={FEET.x + most * PER_NEWTON + 12} y={gripY + 5}>
            Boots must grip, {newtons(grip)}
          </text>
          <text x={FEET.x + most * PER_NEWTON + 12} y={mostY + 5}>
            Most they can grip, {newtons(most)}
          </text>
        </g>
      </svg>
      <figcaption id="forces-caption" className="text-sm text-slate-400">
        <strong className="font-medium text-slate-300">Figure 2.</strong> The forces on one belayer, holding still, to
        scale, seen from the side, square on to their rope. The ground pushes up with their weight plus the rope’s
        downward pull. Their boots must grip as hard as the rope pulls towards the edge: on dry painted steel, that
        takes about {Math.round((100 * grip) / most)}% of the grip they have, and on wet painted steel more than all of
        it.
      </figcaption>
    </figure>
  );
}

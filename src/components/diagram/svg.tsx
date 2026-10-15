/** Small SVG primitives for physics diagrams. Coordinates are SVG user units (y points down). */

import { rad } from "@/lib/math";
import { Vector2 } from "@/lib/vector2";

/** An arrow from `from` along vector `v`, with an optional label just past the tip. */
export function Arrow({
  from,
  v,
  color,
  label,
  dashed = false,
  width = 2.5,
}: {
  from: Vector2;
  v: Vector2;
  color: string;
  label?: string;
  dashed?: boolean;
  width?: number;
}) {
  const l = v.len();
  if (l < 1) return null;
  const u = v.scale(1 / l);
  const head = Math.min(12, l * 0.4);
  const tip = from.add(v);
  const base = tip.add(u.scale(-head));
  const perp = u.perp();
  const p1 = base.add(perp.scale(head * 0.45));
  const p2 = base.add(perp.scale(-head * 0.45));
  const labelPos = tip.add(u.scale(14));

  return (
    <g color={color}>
      <line
        x1={from.x}
        y1={from.y}
        x2={base.x}
        y2={base.y}
        stroke="currentColor"
        strokeWidth={width}
        strokeDasharray={dashed ? "6 4" : undefined}
      />
      <polygon points={`${tip.x},${tip.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`} fill="currentColor" />
      {label && <Label at={labelPos} color={color}>{label}</Label>}
    </g>
  );
}

/** A circular arc marking an angle at `center`, from `startDeg` sweeping `sweepDeg` (clockwise, SVG convention). */
export function AngleArc({
  center,
  radius,
  startDeg,
  sweepDeg,
  label,
  color = "#94a3b8",
}: {
  center: Vector2;
  radius: number;
  startDeg: number;
  sweepDeg: number;
  label?: string;
  color?: string;
}) {
  const a0 = rad(startDeg);
  const a1 = rad(startDeg + sweepDeg);
  const p0 = center.add(Vector2.fromAngle(a0, radius));
  const p1 = center.add(Vector2.fromAngle(a1, radius));
  const mid = rad(startDeg + sweepDeg / 2);
  const labelPos = center.add(Vector2.fromAngle(mid, radius + 16));
  const largeArc = Math.abs(sweepDeg) > 180 ? 1 : 0;
  const sweep = sweepDeg > 0 ? 1 : 0;

  return (
    <g>
      <path
        d={`M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${p1.x} ${p1.y}`}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
      />
      {label && <Label at={labelPos} color={color}>{label}</Label>}
    </g>
  );
}

export function Label({ at, color = "#e2e8f0", children }: { at: Vector2; color?: string; children: React.ReactNode }) {
  return (
    <text
      x={at.x}
      y={at.y}
      fill={color}
      fontSize={14}
      fontFamily="var(--font-geist-mono), monospace"
      textAnchor="middle"
      dominantBaseline="middle"
      paintOrder="stroke"
      stroke="#0f172a"
      strokeWidth={4}
    >
      {children}
    </text>
  );
}

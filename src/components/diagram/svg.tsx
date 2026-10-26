/** Small SVG primitives for physics diagrams. Coordinates are SVG user units (y points down). */

import { rad } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";

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
            <polygon
                points={`${tip.x},${tip.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
                fill="currentColor"
            />
            {label && (
                <Label at={labelPos} color={color}>
                    {label}
                </Label>
            )}
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
    color = "var(--ink-muted)",
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
            {label && (
                <Label at={labelPos} color={color}>
                    {label}
                </Label>
            )}
        </g>
    );
}

export function Label({
    at,
    color = "var(--ink)",
    children,
}: {
    at: Vector2;
    color?: string;
    children: React.ReactNode;
}) {
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
            stroke="var(--halo)"
            strokeWidth={4}
        >
            {children}
        </text>
    );
}

/**
 * Where a point in the physics (metres, y up) is drawn: `ppm` SVG units per metre from `origin` (the SVG point for
 * the physics' origin), flipped so up is up.
 */
export const worldToSvg =
    (origin: Vector2, ppm: number) =>
    (p: Vector2): Vector2 =>
        vec2(origin.x + p.x * ppm, origin.y - p.y * ppm);

/**
 * How forces are drawn: `k` SVG units per newton, flipped so up is up, and cut short at `max`. `tag` marks the name of
 * a force whose arrow is cut short with ≫.
 */
export function forceScale(k: number, max: number) {
    return {
        force: (f: Vector2) => vec2(f.x * k, -f.y * k).clampLen(max),
        tag: (name: string, f: Vector2) => (f.len() * k > max ? `${name} ≫` : name),
    };
}

/** A rope through `points` (SVG units): solid when taut, dashed when slack. */
export function Cable(props: { points: Vector2[]; taut: boolean }) {
    return (
        <polyline
            points={props.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={props.taut ? "var(--ink-soft)" : "var(--ink-muted)"}
            strokeWidth={1.5}
            strokeDasharray={props.taut ? undefined : "5 5"}
            strokeLinejoin="round"
        />
    );
}

/** A rope's pull `t` (newtons) at `at`, drawn by `scale`, with its x and y parts dashed when `parts` is on. */
export function Pull(props: {
    name: string;
    at: Vector2;
    t: Vector2;
    color: string;
    scale: ReturnType<typeof forceScale>;
    parts: boolean;
    partsColor: string;
}) {
    const { name, at, t, scale } = props;
    return (
        <>
            <Arrow
                from={at}
                v={scale.force(t)}
                color={props.color}
                label={scale.tag(name, t)}
                width={2}
            />
            {props.parts && (
                <>
                    <Arrow
                        from={at}
                        v={scale.force(vec2(t.x, 0))}
                        color={props.partsColor}
                        dashed
                        width={1.5}
                        label={`${name}x`}
                    />
                    <Arrow
                        from={at}
                        v={scale.force(vec2(0, t.y))}
                        color={props.partsColor}
                        dashed
                        width={1.5}
                        label={`${name}y`}
                    />
                </>
            )}
        </>
    );
}

import { COLORS } from "@/articles/colors";
import { Arrow } from "@/components/diagram/svg";
import { vec2 } from "@/lib/vector2";
import { GHOST, Note, SVG } from "@/visual/frame";

/** Drawing units to the metre, and to the kilonewton for the rope's pull. */
const PER_M = 45;
const PER_KN = 9;
const X = 120;
const TOP = 70;

/**
 * A falling load stopped by a rope from an anchor at the top: where it started (faint), the fall, and the distance
 * the stop took, with the rope's pull on it at the bottom. Heights are in metres below the anchor; `start` can be
 * negative, above it.
 */
export function FallDrawing(props: {
    start: number;
    fall: number;
    stop: number;
    /** The rope's pull at the bottom, in kilonewtons. */
    force: number;
    /** What the stop's distance is called. */
    stopName: string;
}) {
    const y = (m: number) => TOP + m * PER_M;
    const caught = props.start + props.fall;
    const bottom = caught + props.stop;
    // The pull's arrow, as long as there's room above the load for; past that, it stops and says so.
    const room = y(bottom) + 13 - 8;
    const arrow = Math.min(props.force * PER_KN, room);
    const box = (m: number, ghost: boolean) => (
        <rect
            x={X - 16}
            y={y(m)}
            width={32}
            height={26}
            fill={ghost ? "none" : "currentColor"}
            stroke={ghost ? GHOST : "none"}
            strokeDasharray={ghost ? "4 4" : undefined}
        />
    );
    // Brackets beside the drop, for the fall and the stop.
    const bracket = (from: number, to: number, color: string, name: string) =>
        to - from > 0.02 && (
            <g>
                <line
                    x1={X + 40}
                    y1={y(from)}
                    x2={X + 40}
                    y2={y(to)}
                    stroke={color}
                    strokeWidth={3}
                />
                {[from, to].map((m) => (
                    <line
                        key={m}
                        x1={X + 34}
                        y1={y(m)}
                        x2={X + 46}
                        y2={y(m)}
                        stroke={color}
                        strokeWidth={2}
                    />
                ))}
                <Note at={vec2(X + 54, y((from + to) / 2))} anchor="start">
                    {name}
                </Note>
            </g>
        );
    return (
        <svg
            viewBox="0 0 320 300"
            className={SVG}
            fontSize={15}
            role="img"
            aria-label={`A load that fell ${props.fall.toFixed(1)} m, then took ${props.stopName} of ${props.stop.toFixed(2)} m to stop, with the rope's pull on it.`}
        >
            <line x1={X - 50} y1={TOP} x2={X + 50} y2={TOP} stroke="currentColor" opacity={0.6} />
            <circle cx={X} cy={TOP} r={4} fill="currentColor" />
            <line
                x1={X}
                y1={TOP}
                x2={X}
                y2={y(bottom)}
                stroke="currentColor"
                strokeWidth={2}
                opacity={0.8}
            />
            {props.fall > 0.02 && box(props.start, true)}
            {bracket(props.start, caught, GHOST, "fall")}
            {bracket(caught, bottom, COLORS.load, props.stopName)}
            {box(bottom, false)}
            <Arrow
                from={vec2(X - 30, y(bottom) + 13)}
                v={vec2(0, -arrow)}
                color={COLORS.pull}
                width={3}
            />
            {props.force * PER_KN > room && (
                <Note at={vec2(X - 24, 16)} anchor="start">
                    off the scale
                </Note>
            )}
        </svg>
    );
}

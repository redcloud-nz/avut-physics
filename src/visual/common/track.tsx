import { Tag } from "@/articles/gentle-introduction-figures";
import { Arrow } from "@/components/diagram/svg";
import { vec2 } from "@/lib/vector2";
import { GHOST, Note, SVG } from "@/visual/frame";

export const VELOCITY = "var(--velocity)";

/**
 * A box moving along a track measured in metres, at `time` into its run: where it is and its velocity (an arrow,
 * `arrow` drawing units per m/s), with a dashed mark and a fainter arrow where it was after each whole second.
 */
export function Track(props: {
    time: number;
    length: number;
    position: (t: number) => number;
    velocity: (t: number) => number;
    arrow: number;
    label: string;
}) {
    const ground = 130;
    const side = 26;
    const at = (t: number) => 20 + (props.position(t) / props.length) * 270;
    const mark = (m: number) => 20 + (m / props.length) * 270;
    const lane = ground - side - 12;
    const seconds = Array.from({ length: Math.floor(props.time + 1e-9) }, (_, i) => i + 1);
    const x = at(props.time);
    const v = props.velocity(props.time);
    return (
        <svg
            viewBox="0 0 345 165"
            className={SVG}
            fontSize={14}
            role="img"
            aria-label={props.label}
        >
            <line x1={0} y1={ground} x2={345} y2={ground} stroke="currentColor" />
            {Array.from({ length: props.length + 1 }, (_, m) => (
                <line
                    key={m}
                    x1={mark(m)}
                    y1={ground}
                    x2={mark(m)}
                    y2={ground + (m % 5 ? 4 : 8)}
                    stroke="currentColor"
                />
            ))}
            {Array.from({ length: props.length / 5 + 1 }, (_, i) => i * 5).map((m) => (
                <Note key={m} at={vec2(mark(m), ground + 20)}>
                    {m === props.length ? `${m} m` : m}
                </Note>
            ))}
            {seconds.map((s) => (
                <g key={s}>
                    <rect
                        x={at(s) - side / 2}
                        y={ground - side}
                        width={side}
                        height={side}
                        fill="none"
                        stroke={GHOST}
                        strokeDasharray="3 3"
                    />
                    <g opacity={0.45}>
                        <Arrow
                            from={vec2(at(s), lane)}
                            v={vec2(props.velocity(s) * props.arrow, 0)}
                            color={VELOCITY}
                            width={2}
                        />
                    </g>
                    <Note at={vec2(at(s), lane - 14)}>{s} s</Note>
                </g>
            ))}
            <rect
                x={x - side / 2}
                y={ground - side}
                width={side}
                height={side}
                rx={3}
                fill="currentColor"
            />
            <Arrow from={vec2(x, lane)} v={vec2(v * props.arrow, 0)} color={VELOCITY} />
            <Tag at={vec2(x + (v * props.arrow) / 2, lane - 34)} color={VELOCITY}>
                {v.toFixed(1)} m/s
            </Tag>
        </svg>
    );
}

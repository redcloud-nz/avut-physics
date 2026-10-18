import { COLORS } from "@/articles/colors";
import { Arrow } from "@/components/diagram/svg";
import { vec2, type Vector2 } from "@/lib/vector2";
import { Letter } from "@/visual/common/details";

/*
 * One pulley and the pulls on it, for pages' details: hung from the anchor with the rope over it (both parts pulling
 * it down), or clipped to the load with the rope under it (both parts pulling it up). The one drawing turned over, so
 * the two read as the same idea.
 */

const H = 260;
const C = vec2(130, 110);
const R = 30;
/** Drawn length of a pull of T. */
const LEN = 42;

/** A name in the drawing, in the labels' type, set from `at` as `anchor` says. */
function Tag(props: {
    at: Vector2;
    color: string;
    anchor?: "start" | "middle" | "end";
    children: React.ReactNode;
}) {
    return (
        <text
            x={props.at.x}
            y={props.at.y}
            fill={props.color}
            fontFamily="var(--font-geist-mono), monospace"
            textAnchor={props.anchor ?? "middle"}
            dominantBaseline="middle"
        >
            {props.children}
        </text>
    );
}

export function PulleyForces(props: { on: "anchor" | "load" }) {
    const anchor = props.on === "anchor";
    // Laid out hung from the anchor; on the load, turned over top to bottom.
    const f = (x: number, y: number) => vec2(x, anchor ? y : H - y);
    const down = anchor ? 1 : -1;
    const c = f(C.x, C.y);
    const left = C.x - R;
    const right = C.x + R;
    const mount = f(C.x, 22);
    const ends = { left: f(left, 236), right: f(right, 236) };
    const T = (x: number, label: React.ReactNode) => (
        <>
            <Arrow from={f(x, C.y + 14)} v={vec2(0, down * LEN)} color={COLORS.pull} width={3} />
            <Letter at={f(x + (x < C.x ? -14 : 14), C.y + 14 + LEN / 2)} color={COLORS.pull}>
                {label}
            </Letter>
        </>
    );
    return (
        <svg
            viewBox={`20 0 220 ${H}`}
            className="mx-auto w-full max-w-60 text-slate-400"
            fontSize={14}
            role="img"
            aria-label={
                anchor
                    ? "A pulley hung from the anchor, the rope over it. Both of the rope's parts pull the pulley down with T, so the anchor pulls it up with 2T."
                    : "A pulley clipped to the load, the rope under it. Both of the rope's parts pull the pulley up with T, and the load pulls it down with W, so W is 2T."
            }
        >
            <line
                x1={mount.x}
                y1={mount.y}
                x2={c.x}
                y2={c.y}
                stroke="currentColor"
                strokeWidth={3}
                opacity={0.5}
            />
            {(["left", "right"] as const).map((side) => {
                const e = ends[side];
                const x = side === "left" ? left : right;
                const s = f(x, C.y);
                return (
                    <line
                        key={side}
                        x1={s.x}
                        y1={s.y}
                        x2={e.x}
                        y2={e.y}
                        stroke="currentColor"
                        strokeWidth={2}
                        opacity={0.8}
                    />
                );
            })}
            <circle
                cx={c.x}
                cy={c.y}
                r={R - 1}
                className="fill-slate-950"
                stroke="currentColor"
                strokeWidth={1.5}
            />
            <path
                d={`M ${f(left, C.y).x} ${f(left, C.y).y} A ${R} ${R} 0 0 ${anchor ? 1 : 0} ${f(right, C.y).x} ${f(right, C.y).y}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                opacity={0.8}
            />
            <circle cx={c.x} cy={c.y} r={3} fill="currentColor" />

            {anchor ? (
                <>
                    <circle cx={mount.x} cy={mount.y} r={5} fill="currentColor" />
                    <Tag at={mount.add(vec2(0, -12))} color="#94a3b8">
                        Anchor
                    </Tag>
                    <rect
                        x={ends.left.x - 14}
                        y={ends.left.y}
                        width={28}
                        height={18}
                        fill="currentColor"
                    />
                    <Tag at={ends.left.add(vec2(-24, 9))} color="#94a3b8" anchor="end">
                        Load
                    </Tag>
                </>
            ) : (
                <>
                    <rect
                        x={mount.x - 30}
                        y={mount.y - 4}
                        width={60}
                        height={18}
                        fill="currentColor"
                    />
                    <Tag at={mount.add(vec2(38, 5))} color="#94a3b8" anchor="start">
                        Load
                    </Tag>
                    <circle cx={ends.left.x} cy={ends.left.y} r={5} fill="currentColor" />
                    <Tag at={ends.left.add(vec2(-10, 0))} color="#94a3b8" anchor="end">
                        Anchor
                    </Tag>
                </>
            )}
            <Tag at={ends.right.add(vec2(10, 0))} color={COLORS.pull} anchor="start">
                Pull
            </Tag>

            {T(left, "T")}
            {T(right, "T")}
            {anchor ? (
                <>
                    <Arrow from={c} v={vec2(0, -2 * LEN)} color={COLORS.redirect} width={3} />
                    <Letter at={c.add(vec2(18, -LEN - 6))} color={COLORS.redirect}>
                        2T
                    </Letter>
                </>
            ) : (
                <>
                    <Arrow from={c} v={vec2(0, 2 * LEN)} color={COLORS.load} width={3} />
                    <Letter at={c.add(vec2(16, LEN + 6))} color={COLORS.load}>
                        W
                    </Letter>
                </>
            )}
        </svg>
    );
}

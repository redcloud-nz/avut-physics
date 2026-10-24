import { DEFAULTS, FIGURES } from "@/articles/standing-body-belays-figures";
import { linearScale } from "@/lib/math";
import { vec2, type Vector2 } from "@/lib/vector2";

/*
 * The lower, seen side on and drawn to scale from the solver's arrangement for the common case, holding still.
 * Drawn in `currentColor` and its tints, so it prints in black on white.
 */

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

const X = linearScale([LEFT, RIGHT], [0, W]);
const Y = linearScale([TOP, BOTTOM], [0, H]);
const pt = (p: Vector2) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`;
/** The point `d` from `from` towards `to`. */
const along = (from: Vector2, to: Vector2, d: number) => from.add(to.sub(from).unit().scale(d));

/** A straight-bodied person from `feet` towards `toward`, with their hands at `hands`. */
function Person(props: { feet: Vector2; toward: Vector2; hands: Vector2 }) {
    const head = along(props.feet, props.toward, PERSON_HEIGHT - 0.12);
    const shoulder = along(props.feet, props.toward, 1.45);
    return (
        <g stroke="currentColor" strokeWidth={3} strokeLinecap="round" fill="none">
            <line x1={X(props.feet.x)} y1={Y(props.feet.y)} x2={X(shoulder.x)} y2={Y(shoulder.y)} />
            <line
                x1={X(shoulder.x)}
                y1={Y(shoulder.y)}
                x2={X(props.hands.x)}
                y2={Y(props.hands.y)}
                strokeWidth={2}
            />
            <circle cx={X(head.x)} cy={Y(head.y)} r={0.12 * S} fill="currentColor" stroke="none" />
        </g>
    );
}

/** A labelled distance from `a` to `b`, with its label `dy` units below (or above, if negative) its middle. */
function Dimension(props: {
    a: Vector2;
    b: Vector2;
    label: string;
    dy?: number;
    anchor?: "start" | "middle";
}) {
    const mid = props.a.add(props.b).scale(0.5);
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
    const s = FIGURES.scene;
    const at = (p: { x: number; y: number }) => vec2(p.x, p.y);
    const l = {
        anchor: at(s.anchor),
        wrapEdge: s.wrapEdge && at(s.wrapEdge),
        barEnd1: at(s.barEnd1),
        barEnd2: at(s.barEnd2),
        lineEdge: s.lineEdge && at(s.lineEdge),
        team: at(s.team),
    };
    const wall = DEFAULTS.wallHeight;
    const feet = at(s.feet);
    const waist = l.anchor;
    const rope = [waist, ...(l.wrapEdge ? [l.wrapEdge] : []), l.barEnd1];
    const line = [l.barEnd2, ...(l.lineEdge ? [l.lineEdge] : []), l.team];
    const teamFeet = vec2(l.team.x + 0.35, 0);
    const stretcherMid = l.barEnd1.add(l.barEnd2).scale(0.5);

    return (
        <figure className="flex flex-col gap-2 print:break-inside-avoid">
            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full text-ink-muted"
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
                    d={`M${pt(vec2(LEFT, wall))} L${pt(vec2(0, wall))} L${pt(vec2(0, 0))}`}
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="none"
                />
                <line
                    x1={X(LEFT)}
                    x2={X(RIGHT)}
                    y1={Y(0)}
                    y2={Y(0)}
                    stroke="currentColor"
                    strokeWidth={2}
                />
                <circle cx={X(0)} cy={Y(wall)} r={0.07 * S} fill="currentColor" />

                {/* The rope and the ground team's line. */}
                <g
                    className="text-figure-accent print:text-black"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="none"
                >
                    <polyline points={rope.map(pt).join(" ")} />
                    <polyline points={line.map(pt).join(" ")} strokeDasharray="6 4" />
                </g>

                {/* The stretcher. */}
                <line
                    x1={X(l.barEnd1.x)}
                    y1={Y(l.barEnd1.y)}
                    x2={X(l.barEnd2.x)}
                    y2={Y(l.barEnd2.y)}
                    className="text-ink-strong print:text-black"
                    stroke="currentColor"
                    strokeWidth={7}
                    strokeLinecap="round"
                />

                {/* The people: one belayer (the other is beside them, hidden behind), and the ground team. */}
                <g className="text-ink print:text-black">
                    <Person feet={feet} toward={waist} hands={along(waist, rope[1], 0.35)} />
                    <Person feet={teamFeet} toward={vec2(teamFeet.x + 0.25, 1)} hands={l.team} />
                </g>

                {/* Dimensions. */}
                <Dimension
                    a={vec2(LEFT + 0.4, 0)}
                    b={vec2(LEFT + 0.4, wall)}
                    label={`${wall} m`}
                    dy={5}
                    anchor="start"
                />
                <Dimension
                    a={vec2(feet.x, wall - 0.35)}
                    b={vec2(0, wall - 0.35)}
                    label={`${DEFAULTS.belayerBack} m`}
                />
                <Dimension
                    a={vec2(0, -0.3)}
                    b={vec2(l.team.x, -0.3)}
                    label={`${DEFAULTS.teamDistance} m`}
                />

                {/* Labels. */}
                <g fill="currentColor" className="text-ink-soft print:text-black">
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
            <figcaption id="setup-caption" className="text-sm text-ink-muted">
                <strong className="font-medium text-ink-soft">Figure 1.</strong> The lower, held
                still just after the stretcher has gone over the edge, when the ropes carry the
                most, side on and to scale. The second belayer stands beside the first, hidden
                behind them. Each rope runs from a belayer’s waist, over the roof’s edge, to the
                stretcher’s head; the dashed line runs from its foot to the ground team.
            </figcaption>
        </figure>
    );
}

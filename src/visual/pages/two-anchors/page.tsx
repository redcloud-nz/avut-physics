import { COLORS } from "@/articles/colors";
import { AngleArc, Arrow, Label } from "@/components/diagram/svg";
import { Eq } from "@/components/tex";
import { rad } from "@/lib/math";
import { svgPoints } from "@/lib/svg-path";
import { vec2, Vector2 } from "@/lib/vector2";
import { ink, Letter, r, Section, Var } from "@/visual/common/details";
import { T, Y } from "@/visual/common/triangle";
import { GHOST } from "@/visual/frame";
import type { VisualPage } from "@/visual/pages";

import { TwoAnchorsFigure } from "./figure";

const W = ink(COLORS.load, "W");

/**
 * The even rig, 90° between the ropes, with each rope's pull split into its parts tip to tail and the mirror line
 * down the middle.
 */
function MirrorDrawing() {
    const load = 100;
    const theta = rad(45);
    const m = vec2(150, 190);
    const pull = load / (2 * Math.cos(theta));
    const sides = [-1, 1].map((s) => {
        const along = vec2(s * Math.sin(theta), -Math.cos(theta));
        return {
            s,
            anchor: m.add(along.scale(150)),
            corner: m.add(vec2(s * pull * Math.sin(theta), 0)),
            tip: m.add(along.scale(pull)),
            along,
        };
    });
    return (
        <svg
            viewBox="40 55 220 245"
            className="mx-auto w-full max-w-64 text-ink-muted"
            role="img"
            aria-label="Two ropes from a master point up to two anchors, each pulling with T at θ from straight up, split into a sideways part x and an up part y. A mirror line runs straight up through the master point; the two x parts point opposite ways, and the two y parts together hold the load W."
        >
            <line
                x1={m.x}
                y1={70}
                x2={m.x}
                y2={300}
                stroke={GHOST}
                strokeDasharray="2 4"
                strokeWidth={1.5}
            />
            <Label at={vec2(m.x, 64)} color={GHOST}>
                mirror
            </Label>
            {sides.map((side) => (
                <g key={side.s}>
                    <line
                        x1={m.x}
                        y1={m.y}
                        x2={side.anchor.x}
                        y2={side.anchor.y}
                        stroke="currentColor"
                        strokeWidth={2}
                        opacity={0.5}
                    />
                    <circle cx={side.anchor.x} cy={side.anchor.y} r={4} fill="currentColor" />
                    <AngleArc center={m} radius={34} startDeg={-90} sweepDeg={side.s * 45} />
                    <Letter
                        at={m.add(Vector2.fromAngle(rad(-90 + side.s * 22.5), 48))}
                        color="var(--ink)"
                    >
                        θ
                    </Letter>
                    <Arrow from={m} v={side.corner.sub(m)} color={COLORS.sideways} dashed />
                    <Arrow
                        from={side.corner}
                        v={side.tip.sub(side.corner)}
                        color={COLORS.redirect}
                        dashed
                    />
                    <Arrow from={m} v={side.tip.sub(m)} color={COLORS.pull} width={3} />
                    <Letter
                        at={side.tip.add(vec2(side.s * 4, -18)).add(side.along.scale(4))}
                        color={COLORS.pull}
                    >
                        T
                    </Letter>
                    <Letter at={vec2((m.x + side.corner.x) / 2, m.y + 14)} color={COLORS.sideways}>
                        x
                    </Letter>
                    <Letter
                        at={vec2(side.corner.x + side.s * 14, (side.corner.y + side.tip.y) / 2)}
                        color={COLORS.redirect}
                    >
                        y
                    </Letter>
                </g>
            ))}
            <Arrow from={m} v={vec2(0, load)} color={COLORS.load} />
            <Letter at={vec2(m.x + 14, m.y + load - 10)} color={COLORS.load}>
                W
            </Letter>
            <circle cx={m.x} cy={m.y} r={4} fill="currentColor" />
        </svg>
    );
}

/** Plot area of the curves: θ from 0° to 90° across, and 0 to 1 up. */
const PLOT = { left: 40, right: 280, top: 20, bottom: 150 };
const at = (thetaDeg: number, value: number) =>
    vec2(
        PLOT.left + (thetaDeg / 90) * (PLOT.right - PLOT.left),
        PLOT.bottom - value * (PLOT.bottom - PLOT.top),
    );

function Curve(props: { f: (theta: number) => number; color: string }) {
    const pts = Array.from({ length: 46 }, (_, i) => at(2 * i, props.f(rad(2 * i))));
    return <polyline points={svgPoints(pts)} fill="none" stroke={props.color} strokeWidth={2.5} />;
}

/** cos θ and sin θ from 0° to 90°, with 60°, where cos θ is ½, marked. */
function CurvesDrawing() {
    const magic = at(60, 0.5);
    return (
        <svg
            viewBox="0 5 300 210"
            className="mx-auto w-full max-w-80 text-ink-muted"
            role="img"
            aria-label="The curves of cos θ and sin θ for θ from 0° to 90°. cos θ starts at 1 and falls to 0; sin θ does the opposite. At θ = 60°, which is ropes 120° apart, cos θ is exactly one half."
        >
            <line
                x1={PLOT.left}
                y1={PLOT.bottom}
                x2={PLOT.right}
                y2={PLOT.bottom}
                stroke="currentColor"
                opacity={0.6}
            />
            <line
                x1={PLOT.left}
                y1={PLOT.top}
                x2={PLOT.left}
                y2={PLOT.bottom}
                stroke="currentColor"
                opacity={0.6}
            />
            {[
                [0.5, "½"],
                [1, "1"],
            ].map(([v, name]) => (
                <g key={name}>
                    <line
                        x1={PLOT.left}
                        y1={at(0, Number(v)).y}
                        x2={PLOT.right}
                        y2={at(0, Number(v)).y}
                        stroke={GHOST}
                        strokeDasharray="2 4"
                    />
                    <Label at={vec2(PLOT.left - 14, at(0, Number(v)).y)} color="var(--ink-muted)">
                        {name}
                    </Label>
                </g>
            ))}
            <Label at={vec2(PLOT.left - 14, PLOT.bottom)} color="var(--ink-muted)">
                0
            </Label>
            <line
                x1={magic.x}
                y1={PLOT.top}
                x2={magic.x}
                y2={PLOT.bottom}
                stroke={COLORS.load}
                strokeOpacity={0.6}
                strokeDasharray="2 4"
            />
            {[0, 30, 60, 90].map((t) => (
                <g key={t}>
                    <Label at={vec2(at(t, 0).x, PLOT.bottom + 14)} color="var(--ink-muted)">
                        {`${t}°`}
                    </Label>
                    <Label at={vec2(at(t, 0).x, PLOT.bottom + 34)} color={GHOST}>
                        {`${2 * t}°`}
                    </Label>
                </g>
            ))}
            <text
                x={160}
                y={PLOT.bottom + 54}
                fontSize={12}
                fill={GHOST}
                textAnchor="middle"
                dominantBaseline="middle"
            >
                top: θ from straight up · below: ropes apart
            </text>
            <Curve f={Math.cos} color={COLORS.redirect} />
            <Curve f={Math.sin} color={COLORS.sideways} />
            <Label at={at(12, 0.8)} color={COLORS.redirect}>
                cos θ
            </Label>
            <Label at={at(42, 0.35)} color={COLORS.sideways}>
                sin θ
            </Label>
            <circle cx={magic.x} cy={magic.y} r={4.5} fill={COLORS.load} />
        </svg>
    );
}

function TwoAnchorsMore() {
    return (
        <>
            <Section title="A mirror down the middle">
                <MirrorDrawing />
                <p>
                    With the anchors level and the master point in the middle, the rig is a mirror:
                    fold it along the line straight up through the master point and one side lands
                    on the other. So both ropes pull just as hard, <Var color={COLORS.pull}>T</Var>,
                    and lean the same angle <em>θ</em> from straight up.
                </p>
                <p>
                    Split each rope’s pull into its parts, as on Splitting arrows. The sideways
                    parts <Var color={COLORS.sideways}>x</Var> are mirror images: the same size,
                    pointing opposite ways, so they cancel. The up parts{" "}
                    <Var color={COLORS.redirect}>y</Var> are the same size too, and together they
                    hold the load <Var color={COLORS.load}>W</Var>, so each is half of it:
                </p>
                <Eq tex={r`2${Y} = ${W} \qquad ${Y} = ${T}\cos\theta`} />
                <p>Put together:</p>
                <Eq tex={r`${T} = \frac{${W}}{2\cos\theta}`} />
            </Section>
            <Section title="Why 120° is the magic number">
                <CurvesDrawing />
                <p>
                    cos <em>θ</em> is how big the up part is, as a fraction of the rope’s pull, and
                    sin <em>θ</em> how big the sideways part is. They’re at right angles, so the two
                    don’t add up to 1. Hanging straight (<em>θ</em> = 0°) all of it goes up. As the
                    rope leans, less and less does, slowly at first and then faster, until lying
                    flat (<em>θ</em> = 90°) none of it does.
                </p>
                <p>
                    Each rope’s up part still has to be half the load, so as cos <em>θ</em> shrinks,{" "}
                    <Var color={COLORS.pull}>T</Var> has to grow to make up for it. At <em>θ</em> =
                    60°, cos <em>θ</em> is exactly ½: only half of each rope’s pull goes up, so to
                    give half the load each rope has to pull with all of it.
                </p>
                <Eq
                    tex={r`\cos 60^\circ = \tfrac12 \qquad\text{so}\qquad ${T} = \frac{${W}}{2 \times \tfrac12} = ${W}`}
                />
                <p>
                    Each rope 60° from straight up puts them 120° apart. Wider than that, each
                    anchor holds more than the whole load. By then each rope’s sideways part is much
                    bigger than its up part (sin 60° is about 0.87, against cos 60° = ½), and it
                    goes into straining against the other anchor.
                </p>
            </Section>
            <Section title="In practice">
                <p>
                    Keep the ropes under about 90° apart where you can: each then holds about 71% of
                    the load. Treat 120° as the widest you’d accept.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "two-anchors",
    name: "Two anchors",
    title: "Spread anchors hold more",
    description:
        "Two anchors share a load through one master point, each rope’s up part holding half. Spread them and each rope leans, adding a sideways part, so each holds more than half. At 120° apart, each holds the whole load.",
    text: (
        <>
            Two anchors share a load through one master point, each rope’s up part{" "}
            <Var color={COLORS.redirect}>y</Var> holding half. Spread them and each rope leans,
            adding a sideways part <Var color={COLORS.sideways}>x</Var>, so each holds more than
            half. At 120° apart, each holds the whole load.
        </>
    ),
    Figure: TwoAnchorsFigure,
    More: TwoAnchorsMore,
};

export default page;

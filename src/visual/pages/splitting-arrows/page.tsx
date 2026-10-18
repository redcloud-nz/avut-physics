import { COLORS } from "@/articles/colors";
import { AngleArc, Arrow, Label } from "@/components/diagram/svg";
import { Eq } from "@/components/tex";
import { deg, rad } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";
import { ink, Letter, r, Section, Var } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { SplitFigure } from "./figure";

/*
 * The maths is written as in A Gentle Introduction to Rescue Physics: a pull T at an angle θ from straight up, split
 * into sideways x and up y.
 */

const T = ink(COLORS.pull, "T");
const X = ink(COLORS.sideways, "x");
const Y = ink(COLORS.redirect, "y");

/*
 * The worked example: a 3 kN pull up and to the right, 2.4 kN across and 1.8 kN up, drawn 40 units to the kN. It
 * starts at the bolt, `BOLT`; its sideways part runs to the square corner, `CORNER`, and its up part on to the tip.
 */
const SCALE = 40;
const BOLT = vec2(40, 150);
const CORNER = BOLT.add(vec2(2.4 * SCALE, 0));
const TIP = CORNER.add(vec2(0, -1.8 * SCALE));
const PULL = TIP.sub(BOLT);
/** Square to the pull, pointing away from the corner. */
const AWAY = vec2(PULL.y, -PULL.x).scale(1 / PULL.len());

/** The little square that marks a square corner, inside the triangle. */
function SquareCorner() {
    const s = 10;
    return (
        <polyline
            points={`${CORNER.x - s},${CORNER.y} ${CORNER.x - s},${CORNER.y - s} ${CORNER.x},${CORNER.y - s}`}
            fill="none"
            stroke="currentColor"
        />
    );
}

/** The pull and its parts, tip to tail. */
function Triangle() {
    return (
        <>
            <SquareCorner />
            <Arrow from={BOLT} v={CORNER.sub(BOLT)} color={COLORS.sideways} />
            <Arrow from={CORNER} v={TIP.sub(CORNER)} color={COLORS.redirect} />
            <Arrow from={BOLT} v={PULL} color={COLORS.pull} width={3} />
            <circle cx={BOLT.x} cy={BOLT.y} r={4} fill="currentColor" />
        </>
    );
}

/** The pull T at θ from straight up, and its parts x and y meeting at a square corner. */
function PartsDrawing() {
    // θ sits inside the triangle at the tip, between the pull and its up part, so it's the pull's angle from straight
    // up. On screen the up part runs down from the tip at 90°, and the pull back to the bolt is clockwise of it.
    const back = deg(Math.atan2(-PULL.y, -PULL.x));
    return (
        <svg
            viewBox="10 64 180 111"
            className="mx-auto w-full max-w-64 text-slate-400"
            role="img"
            aria-label="A pull T split into a horizontal part x and a vertical part y that meet at a square corner, with θ the angle between T and y"
        >
            <AngleArc center={TIP} radius={26} startDeg={90} sweepDeg={back - 90} />
            <Letter at={TIP.add(Vector2.fromAngle(rad((back + 90) / 2), 40))} color="#e2e8f0">
                θ
            </Letter>
            <Triangle />
            <Letter at={BOLT.add(PULL.scale(0.5)).add(AWAY.scale(14))} color={COLORS.pull}>
                T
            </Letter>
            <Letter at={vec2((BOLT.x + CORNER.x) / 2, BOLT.y + 14)} color={COLORS.sideways}>
                x
            </Letter>
            <Letter at={vec2(CORNER.x + 14, (CORNER.y + TIP.y) / 2)} color={COLORS.redirect}>
                y
            </Letter>
        </svg>
    );
}

/** A square on one side of the triangle, from `a` to `b` and out along `out`, with its area in it. */
function SideSquare(props: {
    a: Vector2;
    b: Vector2;
    out: Vector2;
    color: string;
    name: string;
    area: string;
}) {
    const pts = [props.a, props.b, props.b.add(props.out), props.a.add(props.out)];
    const centre = props.a.add(props.b).scale(0.5).add(props.out.scale(0.5));
    return (
        <>
            <polygon
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={props.color}
                fillOpacity={0.12}
                stroke={props.color}
                strokeOpacity={0.5}
            />
            <Label at={centre.add(vec2(0, -9))} color={props.color}>
                <tspan fontStyle="italic" fontSize={16}>
                    {props.name}
                </tspan>
                <tspan fontSize={16}>²</tspan>
            </Label>
            <Label at={centre.add(vec2(0, 10))} color={props.color}>
                {props.area}
            </Label>
        </>
    );
}

/** The triangle with a square on each side: the two small squares together have the big one's area. */
function SquaresDrawing() {
    const x = CORNER.sub(BOLT);
    const y = TIP.sub(CORNER);
    return (
        <svg
            viewBox="-42 -28 260 284"
            className="mx-auto w-full max-w-64 text-slate-400"
            role="img"
            aria-label="A square on each side of the triangle: the squares on x and y, 5.76 and 3.24, together make the square on T, 9"
        >
            <SideSquare
                a={BOLT}
                b={CORNER}
                out={vec2(0, x.len())}
                color={COLORS.sideways}
                name="x"
                area="5.76"
            />
            <SideSquare
                a={CORNER}
                b={TIP}
                out={vec2(y.len(), 0)}
                color={COLORS.redirect}
                name="y"
                area="3.24"
            />
            <SideSquare
                a={TIP}
                b={BOLT}
                out={AWAY.scale(PULL.len())}
                color={COLORS.pull}
                name="T"
                area="9"
            />
            <Triangle />
        </svg>
    );
}

function SplittingArrowsMore() {
    return (
        <>
            <Section title="Working out the parts">
                <PartsDrawing />
                <p>
                    Call the pull <Var color={COLORS.pull}>T</Var>, for tension. Its parts{" "}
                    <Var color={COLORS.sideways}>x</Var> and <Var color={COLORS.redirect}>y</Var>{" "}
                    meet at a square corner, marked with the little square, and <em>θ</em> is the
                    angle between <Var color={COLORS.pull}>T</Var> and its up part: how far the pull
                    leans from straight up. The sine and cosine of <em>θ</em>, numbers a calculator
                    gives, split <Var color={COLORS.pull}>T</Var> between them:
                </p>
                <Eq tex={r`${X} = ${T} \sin\theta \qquad ${Y} = ${T} \cos\theta`} />
                <p>For a 3 kN pull at 53° from straight up:</p>
                <Eq
                    tex={r`${X} = ${ink(COLORS.pull, "3")} \times \sin 53^\circ = ${ink(COLORS.sideways, r`2.4\,\text{kN}`)}`}
                />
                <Eq
                    tex={r`${Y} = ${ink(COLORS.pull, "3")} \times \cos 53^\circ = ${ink(COLORS.redirect, r`1.8\,\text{kN}`)}`}
                />
            </Section>
            <Section
                title={
                    <>
                        If you already have <em>x</em> and <em>y</em>
                    </>
                }
            >
                <p>
                    Going the other way, the parts give you the pull. They’re the short sides of a
                    triangle with a square corner, and the pull is its long side. Draw a square on
                    each side, and the two small squares together have exactly the area of the big
                    one. That’s Pythagoras’ rule:
                </p>
                <SquaresDrawing />
                <Eq tex={r`${X}^2 + ${Y}^2 = ${T}^2`} />
                <Eq
                    tex={r`${ink(COLORS.sideways, "2.4")}^2 + ${ink(COLORS.redirect, "1.8")}^2 = 5.76 + 3.24 = 9 = ${ink(COLORS.pull, "3")}^2`}
                />
                <p>
                    So the pull is <Var color={COLORS.pull}>T</Var> = √9 = 3 kN. The parts add up to
                    more than that (2.4 + 1.8 = 4.2), but they pull at right angles, so together
                    they only make 3 kN.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "splitting-arrows",
    name: "Splitting arrows",
    title: "Any arrow splits into two",
    text: (
        <>
            Any pull can be split into a horizontal part, written <em>x</em>, and a vertical part,
            written <em>y</em>. Level and upright pulls are much easier to reason about than
            slanting ones, and tip to tail the two parts pull just the same as the arrow.
        </>
    ),
    Figure: SplitFigure,
    More: SplittingArrowsMore,
};

export default page;

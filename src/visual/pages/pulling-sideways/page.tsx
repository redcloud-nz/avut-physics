import { COLORS } from "@/articles/colors";
import { Label } from "@/components/diagram/svg";
import { Eq } from "@/components/tex";
import { svgPoints } from "@/lib/svg-path";
import { vec2, Vector2 } from "@/lib/vector2";
import { ink, r, Section, Var } from "@/visual/common/details";
import { AWAY, BOLT, CORNER, PULL, T, TIP, Triangle, X, Y } from "@/visual/common/triangle";
import type { VisualPage } from "@/visual/pages";

import { PullingSidewaysFigure } from "./figure";

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
    const centre = props.a.mid(props.b).add(props.out.scale(0.5));
    return (
        <>
            <polygon
                points={svgPoints(pts)}
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
            viewBox="-66 -28 284 260"
            className="mx-auto w-full max-w-64 text-ink-muted"
            role="img"
            aria-label="A square on each side of the triangle: the squares on x and y, 3.24 and 5.76, together make the square on T, 9"
        >
            <SideSquare
                a={BOLT}
                b={CORNER}
                out={vec2(0, x.len())}
                color={COLORS.sideways}
                name="x"
                area="3.24"
            />
            <SideSquare
                a={CORNER}
                b={TIP}
                out={vec2(y.len(), 0)}
                color={COLORS.redirect}
                name="y"
                area="5.76"
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

function PullingSidewaysMore() {
    return (
        <Section title="Working out the rope’s pull">
            <p>
                Say the load weighs 2.4 kN (about 240 kg) and the tag line pulls it sideways with
                1.8 kN. The rope’s pull has to have an up part <Var color={COLORS.redirect}>y</Var>{" "}
                of 2.4 kN and a sideways part <Var color={COLORS.sideways}>x</Var> of 1.8 kN.
                They’re the short sides of a triangle with a square corner, and the rope’s pull{" "}
                <Var color={COLORS.pull}>T</Var> is its long side.
            </p>
            <p>
                Draw a square on each side, and the two small squares together have exactly the area
                of the big one. That’s Pythagoras’ rule:
            </p>
            <SquaresDrawing />
            <Eq tex={r`${X}^2 + ${Y}^2 = ${T}^2`} />
            <Eq
                tex={r`${ink(COLORS.sideways, "1.8")}^2 + ${ink(COLORS.redirect, "2.4")}^2 = 3.24 + 5.76 = 9 = ${ink(COLORS.pull, "3")}^2`}
            />
            <p>
                So the rope pulls with <Var color={COLORS.pull}>T</Var> = √9 = 3 kN. The parts add
                up to more than that (1.8 + 2.4 = 4.2), but they’re at right angles, so together
                they only make 3 kN. Still, that’s more than the load weighs.
            </p>
            <p>
                A real tag line pulls much less than this, but usually from below, so it adds to the
                main line’s load as well as pulling it sideways.
            </p>
        </Section>
    );
}

const page: VisualPage = {
    slug: "pulling-sideways",
    name: "Pulling sideways",
    title: "Two parts make a slanting pull",
    description:
        "A tag line pulls the load sideways, so the rope holds a sideways part as well as the up part. Tip to tail, they make the rope’s pull, which is more than the load weighs once the tag line pulls.",
    text: (
        <>
            A tag line pulls the load sideways, so the rope holds a sideways part{" "}
            <Var color={COLORS.sideways}>x</Var> as well as the up part{" "}
            <Var color={COLORS.redirect}>y</Var>. Tip to tail, they make the rope’s pull{" "}
            <Var color={COLORS.pull}>T</Var>, which is more than the load weighs once the tag line
            pulls.
        </>
    ),
    Figure: PullingSidewaysFigure,
    More: PullingSidewaysMore,
};

export default page;

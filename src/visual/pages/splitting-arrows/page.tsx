import { COLORS } from "@/articles/colors";
import { AngleArc } from "@/components/diagram/svg";
import { Eq } from "@/components/tex";
import { deg, rad } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";
import { ink, Letter, r, Section, Var } from "@/visual/common/details";
import { AWAY, BOLT, CORNER, PULL, T, TIP, Triangle, X, Y } from "@/visual/common/triangle";
import type { VisualPage } from "@/visual/pages";

import { SplitFigure } from "./figure";

/** The pull T at θ from straight up, and its parts x and y meeting at a square corner. */
function PartsDrawing() {
    // θ sits inside the triangle at the tip, between the pull and its up part, so it's the pull's angle from straight
    // up. On screen the up part runs down from the tip at 90°, and the pull back to the bolt is clockwise of it.
    const back = deg(Math.atan2(-PULL.y, -PULL.x));
    return (
        <svg
            viewBox="20 40 130 140"
            className="mx-auto w-full max-w-48 text-slate-400"
            role="img"
            aria-label="A pull T split into a sideways part x and an up part y that meet at a square corner, with θ the angle between T and y"
        >
            <AngleArc center={TIP} radius={30} startDeg={90} sweepDeg={back - 90} />
            <Letter at={TIP.add(Vector2.fromAngle(rad((back + 90) / 2), 44))} color="#e2e8f0">
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

function SplittingArrowsMore() {
    return (
        <>
            <Section title="Working out the parts">
                <PartsDrawing />
                <p>
                    Take a rope pulling with <Var color={COLORS.pull}>T</Var>, for tension. Its
                    parts <Var color={COLORS.sideways}>x</Var> and{" "}
                    <Var color={COLORS.redirect}>y</Var> meet at a square corner, marked with the
                    little square, and <em>θ</em> is the angle between{" "}
                    <Var color={COLORS.pull}>T</Var> and its up part: how far the rope leans from
                    straight up. The sine and cosine of <em>θ</em>, numbers a calculator gives,
                    split <Var color={COLORS.pull}>T</Var> between them:
                </p>
                <Eq tex={r`${X} = ${T} \sin\theta \qquad ${Y} = ${T} \cos\theta`} />
                <p>For a 3 kN pull at 37° from straight up:</p>
                <Eq
                    tex={r`${X} = ${ink(COLORS.pull, "3")} \times \sin 37^\circ = ${ink(COLORS.sideways, r`1.8\,\text{kN}`)}`}
                />
                <Eq
                    tex={r`${Y} = ${ink(COLORS.pull, "3")} \times \cos 37^\circ = ${ink(COLORS.redirect, r`2.4\,\text{kN}`)}`}
                />
                <p>Going the other way, from the parts back to the pull, is on the next page.</p>
            </Section>
            <Section title="Real rigs aren’t flat">
                <p>
                    These pages draw every rig flat, as if it were on the page. Real ones often
                    aren’t: anchors set at different depths in a rock face, a redirect pulling the
                    rope out from the cliff, the legs of a tripod.
                </p>
                <p>
                    Nothing new is needed for them. A force can also point in towards the cliff or
                    out from it, so it splits into three parts rather than two: sideways{" "}
                    <Var color={COLORS.sideways}>x</Var>, up and down{" "}
                    <Var color={COLORS.redirect}>y</Var>, and in and out <em>z</em>. Each part has
                    to balance on its own, just as <Var color={COLORS.sideways}>x</Var> and{" "}
                    <Var color={COLORS.redirect}>y</Var> do on the flat pages.
                </p>
                <p>
                    It matters because an angle you can’t see from in front still counts. Two anchor
                    ropes that look close together from the front can be far apart seen from the
                    side, and then each holds more than it seems to.
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
            Any force splits into a sideways part <Var color={COLORS.sideways}>x</Var> and an up
            part <Var color={COLORS.redirect}>y</Var>. They’re easier to work with than a slanting
            force, and tip to tail they add back up to it.
        </>
    ),
    Figure: SplitFigure,
    More: SplittingArrowsMore,
};

export default page;

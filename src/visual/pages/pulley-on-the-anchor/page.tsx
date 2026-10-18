import { COLORS } from "@/articles/colors";
import { Eq } from "@/components/tex";
import { ink, r, Section, Var } from "@/visual/common/details";
import { PulleyForces } from "@/visual/common/pulley-forces";
import { T } from "@/visual/common/triangle";
import type { VisualPage } from "@/visual/pages";

import { RedirectHaulFigure } from "./figure";

const W = ink(COLORS.load, "W");
const HOLDS = ink(COLORS.redirect, r`\text{anchor}`);

function PulleyOnTheAnchorMore() {
    return (
        <>
            <Section title="What a pulley is">
                <p>
                    A pulley is a wheel for a rope to run round, on an axle between two side plates.
                    It hangs by a sling or a karabiner through the side plates. As the rope runs,
                    the wheel turns with it, so the rope doesn’t rub on anything. Rescue pulleys
                    turn on bearings, so they turn easily even under a big load.
                </p>
                <p>
                    A rope pulls along itself, and just as hard all along, as far as anything that
                    grips it. Round a pulley, nothing grips the rope: the wheel turns with it. So
                    the rope pulls just as hard on both sides. You pull with{" "}
                    <Var color={COLORS.pull}>T</Var> and the load end pulls with{" "}
                    <Var color={COLORS.pull}>T</Var> too. All the pulley changes is which way the
                    rope goes.
                </p>
                <p>
                    That’s for a perfect pulley. A real one keeps a little of the pull for itself,
                    as Pulley friction shows, but for now we’ll leave that out.
                </p>
            </Section>
            <Section title="Why the anchor holds twice the load">
                <PulleyForces on="anchor" />
                <p>
                    Look at the pulley on its own and what pulls on it. The rope goes over the
                    wheel, so both its parts pull the pulley down: the load’s side with{" "}
                    <Var color={COLORS.pull}>T</Var> and your side with{" "}
                    <Var color={COLORS.pull}>T</Var>.
                </p>
                <p>
                    The pulley doesn’t move, so the pulls on it add up to nothing, as on
                    Equilibrium. The only other thing pulling on it is its sling, so the anchor has
                    to pull up with both parts together:
                </p>
                <Eq tex={r`${HOLDS} = ${T} + ${T} = 2${T}`} />
                <p>
                    To hold the load, you pull with all of it, <Var color={COLORS.pull}>T</Var> ={" "}
                    <Var color={COLORS.load}>W</Var>, so:
                </p>
                <Eq tex={r`${HOLDS} = 2${W}`} />
                <p>For the 1.2 kN load, you pull with 1.2 kN, and the anchor holds 2.4 kN.</p>
                <p>
                    Seen from the anchor, that makes sense. It’s holding up the load, and it’s also
                    what you’re pulling against. Without the pulley, you’d be pulling on the anchor
                    yourself.
                </p>
                <p>
                    That’s with the rope doubled straight back, which is the most an anchor pulley
                    can feel. Turn the rope through less, and the two parts pull partly against each
                    other, so the anchor holds less, as on Redirects.
                </p>
            </Section>
            <Section title="Why it doesn’t make the work easier">
                <p>
                    Every metre of rope you pull in comes from the load’s side, so the load moves a
                    metre too. You pull as hard as the load weighs, for as far as it moves. All
                    you’ve gained is the direction: pulling down, or along the ground, is easier
                    than lifting.
                </p>
                <p>
                    It’s still part of most haul systems. Pulleys that move with the load are what
                    share the pull out, and the next pages show how.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "pulley-on-the-anchor",
    name: "Pulley on the anchor",
    title: "A pulley on the anchor only turns the rope",
    text: "You still pull with the whole load, and the load moves as far as the rope does. The anchor holds both parts.",
    Figure: RedirectHaulFigure,
    More: PulleyOnTheAnchorMore,
};

export default page;

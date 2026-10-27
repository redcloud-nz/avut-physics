import { COLORS } from "@/articles/colors";
import { Eq } from "@/components/tex";
import { ink, r, Section, Var } from "@/visual/common/details";
import { PulleyForces } from "@/visual/common/pulley-forces";
import { T } from "@/visual/common/triangle";
import type { VisualPage } from "@/visual/pages";

import { TwoToOneFigure } from "./figure";

const W = ink(COLORS.load, "W");

function TwoToOneMore() {
    return (
        <>
            <Section title="The same pulley, turned over">
                <PulleyForces on="load" />
                <p>
                    This is the pulley from Pulley on the anchor, turned over. Clipped to the load
                    with the rope under it, both parts of the rope pull it up, each with{" "}
                    <Var color={COLORS.pull}>T</Var>. The load pulls it down with{" "}
                    <Var color={COLORS.load}>W</Var>. While it’s held still, or moving steadily,
                    those balance:
                </p>
                <Eq tex={r`2${T} = ${W} \qquad\text{so}\qquad ${T} = \frac{${W}}{2}`} />
                <p>
                    One part is tied to the anchor and the other is you, so each holds half the
                    load. On the anchor, the pulley’s doubling made the anchor hold more. Here, it
                    makes the load get more than you put in.
                </p>
            </Section>
            <Section title="Twice the rope">
                <p>
                    Lift the load 1 m and the pulley comes up 1 m with it. Both parts of the rope
                    run between the pulley and something that stays put: the anchor and your hands.
                    So both get 1 m shorter. The rope can’t get shorter overall, so those 2 m have
                    to go somewhere: through your hands.
                </p>
            </Section>
            <Section title="Nothing for free">
                <p>
                    How hard you pull times how far is the work you do. Here it’s the same as the
                    work done lifting the load:
                </p>
                <Eq
                    tex={r`\underbrace{\frac{${W}}{2} \times 2\,\text{m}}_\text{you} = \underbrace{${W} \times 1\,\text{m}}_\text{the load}`}
                />
                <p>
                    Half the pull through twice the distance is the same work. Every pulley system
                    trades like this: it can make the pull smaller only by making the distance
                    longer, by the same amount. That amount is the advantage. Pulleys don’t make the
                    work any less; friction makes it a little more.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "2-to-1",
    name: "2:1",
    title: "A pulley on the load halves the pull",
    text: "Two parts of the rope share the load, so you pull half: a 2:1. That ratio is the system’s mechanical advantage. The price: you pull in 2 m of rope for every metre the load moves.",
    Figure: TwoToOneFigure,
    More: TwoToOneMore,
};

export default page;

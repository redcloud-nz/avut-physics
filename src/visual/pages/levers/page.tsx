import { COLORS } from "@/articles/colors";
import { Eq } from "@/components/tex";
import { ink, r, Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { LeversFigure } from "./figure";

const W = ink(COLORS.load, "W");
const F = ink(COLORS.pull, "F");

function LeversMore() {
    return (
        <>
            <Section title="Turning force">
                <p>
                    A force on a lever turns it about the pivot, and how hard it turns it depends on
                    both the force and how far from the pivot it pushes. Force times distance is the
                    turning force, or moment. The lever stays still when the two sides turn it
                    equally hard, the load one way and your push the other:
                </p>
                <Eq
                    tex={r`${W} \times a = ${F} \times b \qquad\text{so}\qquad ${F} = ${W}\,\frac{a}{b}`}
                />
                <p>
                    With the pivot 0.5 m from 100 kg on a 2 m bar, <em>b</em> is 1.5 m, so you push
                    with a third of the load: 0.33 kN. The pivot holds both, the load and your push.
                </p>
            </Section>
            <Section title="The same trade as pulleys">
                <p>
                    Push your end down 30 cm and, with the pivot a quarter of the way along, the
                    load comes up 10 cm. As on 2:1, the push is smaller by just as much as the
                    distance is longer. A lever with <em>b</em> three times <em>a</em> is a 3:1.
                </p>
            </Section>
            <Section title="Anchors are levers too">
                <p>
                    A rope tied round a tree or a post turns it about its base, just as a push turns
                    a lever about its pivot. The higher the rope, the further from the base it
                    pulls, and the harder it turns the tree out of the ground. Tie low.
                </p>
                <p>
                    A picket driven into the ground works the same way: pull it near the top and it
                    levers itself out, pull it at the ground and it holds far more.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "levers",
    name: "Levers",
    title: "A lever trades distance for force",
    text: "Push on the long side of a lever and the short side lifts more. Each side’s force times its distance from the pivot comes out the same.",
    Figure: LeversFigure,
    More: LeversMore,
};

export default page;

import { COLORS } from "@/articles/colors";
import { Eq } from "@/components/tex";
import { ink, r, Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { WeightFigure } from "./figure";

const W = ink(COLORS.load, "W");

function WeightMore() {
    return (
        <>
            <Section title="Gravity is really 9.81">
                <p>
                    At the Earth’s surface, something dropped speeds up by 9.81 m/s every second.
                    This is written <em>g</em> = 9.81 m/s². It changes a little from place to place:
                    about 9.78 at the equator and 9.83 at the poles.
                </p>
                <p>
                    Weight is force, so it follows force’s rule, mass times acceleration, with
                    gravity’s acceleration:
                </p>
                <Eq tex={r`${W} = m \times g`} />
                <Eq
                    tex={r`100\,\text{kg} \times 9.81\,\text{m/s}^2 = ${ink(COLORS.load, r`981\,\text{N}`)}`}
                />
            </Section>
            <Section title="Why round it to 10">
                <p>
                    Times 10 is easy in your head, and 9.81 is close enough to 10 for rescue work:
                    rounding makes every load about 2% heavier than it is, which errs on the safe
                    side. So 100 kg weighs about 1000 N, and this page’s figure works with 10.
                </p>
                <Eq
                    tex={r`100\,\text{kg} \times 10\,\text{m/s}^2 = ${ink(COLORS.load, r`1000\,\text{N}`)}`}
                />
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "weight",
    name: "Weight",
    title: "10 kg weighs about 100 N",
    text: "Weight is the force of gravity on a mass. Gravity speeds falling things up by about 10 m/s every second, so it pulls on every kilogram with about 10 N.",
    Figure: WeightFigure,
    More: WeightMore,
};

export default page;

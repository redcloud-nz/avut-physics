import { COLORS } from "@/articles/colors";
import { Eq } from "@/components/tex";
import { ink, r, Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { ForceFigure } from "./figure";

const F = ink(COLORS.pull, "F");

function ForceMore() {
    return (
        <>
            <Section title="Force is mass times acceleration">
                <p>
                    How much a push speeds something up depends on how hard you push and how much
                    there is to move. Newton put it as one rule: force is mass times acceleration.
                </p>
                <Eq tex={r`${F} = m \times a`} />
                <p>
                    Push 100 kg with 100 N on smooth ice, and it speeds up by 1 m/s every second.
                    Push twice as much mass just as hard, and it speeds up half as fast.
                </p>
                <Eq
                    tex={r`a = \frac{${F}}{m} = \frac{${ink(COLORS.pull, r`100\,\text{N}`)}}{100\,\text{kg}} = 1\,\text{m/s}^2`}
                />
            </Section>
            <Section title="What a newton is">
                <p>
                    “Metres per second, every second” is written m/s² (metres per second per
                    second). A newton is just enough force to speed 1 kg up by 1 m/s²:
                </p>
                <Eq tex={r`1\,\text{N} = 1\,\text{kg} \times 1\,\text{m/s}^2`} />
                <p>
                    So a newton is built from kilograms, metres and seconds, and any force can be
                    worked out from a mass and how fast it speeds up.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "force",
    name: "Force",
    title: "A force is a push or a pull",
    text: "Forces are measured in newtons (N). One newton speeds 1 kg up by 1 m/s every second, so on smooth ice, 100 N does that to a 100 kg load.",
    Figure: ForceFigure,
    More: ForceMore,
};

export default page;

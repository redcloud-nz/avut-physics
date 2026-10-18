import { COLORS } from "@/articles/colors";
import { Eq } from "@/components/tex";
import { ink, r, Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { ShockLoadingFigure } from "./figure";

const W = ink(COLORS.load, "W");
const F = ink(COLORS.pull, "F");

function ShockLoadingMore() {
    return (
        <>
            <Section title="Working out the pull">
                <p>
                    As the load falls, gravity speeds it up. To stop it, the rope has to take all
                    that speed away again, and it’s gravity’s work that has to be undone: the weight
                    times the whole distance it went down, the fall <em>h</em> and the stop{" "}
                    <em>d</em>. The rope does that by pulling with <em>F</em> over the stop’s
                    distance:
                </p>
                <Eq
                    tex={r`${F} \times d = ${W} \times (h + d) \qquad\text{so}\qquad ${F} = ${W}\left(1 + \frac{h}{d}\right)`}
                />
                <p>
                    What matters is the fall compared with the stop. A 1 m fall stopped over 20 cm
                    pulls with 6 times the load’s weight; stopped over 5 cm, 21 times.
                </p>
                <p>
                    This takes the stop as even all the way. A real stop builds up and dies away, so
                    its peak is higher than this. With no fall there’s no speed to take away, so
                    this gives just the weight; the next page shows a real rope still pulls harder
                    for a moment.
                </p>
            </Section>
            <Section title="How hard is too hard">
                <p>
                    Fall-arrest gear for people working at height is designed to keep the pull on a
                    person to about 6 kN: more than that starts to injure. The figure turns its pull
                    pink past 6 kN. Gear is stronger than people, but a 22 kN rating is soon used
                    up: a 1 m fall stopped over 5 cm takes 21 kN on 100 kg. A two-person rescue
                    load, 200 kg, pulls twice as hard as the figure shows.
                </p>
            </Section>
            <Section title="What a belay is tested for">
                <p>
                    Rescue belays are tested for exactly this. In a common test, 200 kg is dropped 1
                    m onto 3 m of rope, and the belay has to stop it within about 1 m more, pulling
                    less than 15 kN. The belay lets the rope slip a little, stretching out the stop
                    as the slider does.
                </p>
            </Section>
            <Section title="Keep slack out of the system">
                <p>
                    Every bit of slack is a fall waiting to happen. Keep ropes snug to the load,
                    take in slack as you go, and avoid anything that lets the load drop before the
                    rope catches it.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "shock-loading",
    name: "Shock loading",
    title: "Falling doesn’t hurt; stopping does",
    text: "A falling load speeds up. The rope has to take all that speed away, and the shorter the distance it has to do it in, the harder it pulls.",
    Figure: ShockLoadingFigure,
    More: ShockLoadingMore,
};

export default page;

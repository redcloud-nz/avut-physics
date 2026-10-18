import { Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { FiveToOneFigure } from "./figure";

function FiveToOneMore() {
    return (
        <>
            <Section title="Two double pulleys">
                <p>
                    In practice, a 5:1 is two double pulleys: two wheels side by side on one axle.
                    One hangs from the anchor and one is clipped to the load. The rope’s end ties to
                    the load’s double, to a small attachment point at its bottom called the becket.
                    Then the rope goes up and down, round one wheel at each end, then the other.
                </p>
                <p>
                    The drawing pulls each double apart into two wheels, so you can see the rope’s
                    path and count its parts. Side by side on one axle, the wheels do just the same
                    job.
                </p>
            </Section>
            <Section title="Tied to the load, or to the anchor">
                <p>
                    Tie the rope’s end to the anchor’s double instead, and the part from the anchor
                    down to the first wheel no longer gets shorter as the load comes up. Four parts
                    are left to count: a 4:1. Tied to the load, a system’s advantage is an odd
                    number; tied to the anchor, an even one.
                </p>
            </Section>
            <Section title="The cost">
                <p>
                    You pull in 5 m of rope for each metre the load comes up, so it’s slow, and a
                    long haul needs a lot of rope. Each wheel also takes its share of friction: with
                    good pulleys, a 5:1 gives about 4:1. Pulley friction shows how that adds up.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "5-to-1",
    name: "5:1",
    title: "Back and forth: 5:1",
    text: "Tie the rope to the load and run it up and down round two pulleys on the anchor and two on the load. Five parts of rope pull the load, so you pull a fifth. It’s a pair of double pulleys, drawn apart so you can see each wheel.",
    Figure: FiveToOneFigure,
    More: FiveToOneMore,
};

export default page;

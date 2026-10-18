import { Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { CountingFigure } from "./figure";

function CountingMore() {
    return (
        <>
            <Section title="Why counting works">
                <p>
                    Hold your hands still and let the rope run through them. Lift the load 1 m, and
                    every part of rope with one end on the load, or on a pulley or grab moving with
                    it, gets 1 m shorter. Every other part runs between two things that stay put, so
                    it keeps its length.
                </p>
                <p>
                    The rope as a whole can’t get any shorter, so all the rope those parts gave up
                    comes out through your hands. With 3 parts getting shorter, you pull in 3 m for
                    each metre the load comes up. As on 2:1, the pull goes down by as much as the
                    distance goes up, so you pull a third: 3:1.
                </p>
            </Section>
            <Section title="What not to count">
                <p>
                    A part between two things that don’t move doesn’t count, however much rope runs
                    along it. That’s why the 2:1 ↓ is still a 2:1: its extra part runs from a pulley
                    on the anchor to your hands, so it just turns the pull round.
                </p>
                <p>
                    The part to your hands does count when it comes off a pulley on the load, as on
                    the 2:1 and the 5:1. It gets shorter as the pulley comes towards you.
                </p>
            </Section>
            <Section title="Where it goes wrong">
                <p>
                    Counting works for simple systems, where the pulleys that move all move with the
                    load. In a compound system, one system pulls on another’s rope, so some pulleys
                    move but not as far as the load does. Count the 6:1 on the next page this way
                    and you get 3: the 2:1 on its haul line moves with the Z-rig’s rope, not the
                    load, so the count misses it. For those, use the T method.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "counting",
    name: "Counting rope parts",
    title: "Count the parts that get shorter",
    text: "In a simple system, count the parts of rope that get shorter as the load comes up. That’s the advantage.",
    Figure: CountingFigure,
    More: CountingMore,
};

export default page;

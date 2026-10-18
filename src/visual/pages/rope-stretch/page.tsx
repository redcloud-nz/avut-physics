import { COLORS } from "@/articles/colors";
import { Eq } from "@/components/tex";
import { ink, r, Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { RopeStretchFigure } from "./figure";

const W = ink(COLORS.load, "W");

function RopeStretchMore() {
    return (
        <>
            <Section title="Rope as a spring">
                <p>
                    Rope makers give a static rope’s stretch as its elongation between 50 kg and 150
                    kg: hang 50 kg on it, then 150 kg, and see how much longer it gets, as a share
                    of its length. The standard for static rope (EN 1891) allows at most 5%, and
                    rescue ropes are typically around 3 to 4%. That’s the slider.
                </p>
                <p>
                    Going from 50 kg to 150 kg adds 1 kN, so the elongation is the stretch for each
                    kilonewton. The figure treats the rope as a spring, which stretches the same for
                    every extra kilonewton: twice the pull, twice the stretch. Its pull grows as it
                    stretches, so it starts gently and is hardest at the bottom, where the load
                    stops.
                </p>
                <p>
                    At the bottom, the rope’s stretch has taken up all of gravity’s work, the weight
                    times the fall <em>h</em> and the stretch. A spring’s work is half its final
                    pull times its stretch, and that gives the pull:
                </p>
                <Eq
                    tex={r`F = ${W} + \sqrt{${W}^2 + 2\,${W}\,k\,h} \qquad k = \frac{1}{\text{stretch} \times L}`}
                />
                <p>
                    Even with no fall at all, a load let go suddenly onto a rope that’s just come
                    tight pulls with twice its weight for a moment.
                </p>
            </Section>
            <Section title="Fall factor">
                <p>
                    A longer rope stretches further for the same pull, so it catches more softly. In
                    the formula, <em>k</em> goes down as the rope’s length <em>L</em> goes up, and
                    the pull depends only on the fall divided by the rope’s length: the fall factor.
                    A 1 m fall on 2 m of rope pulls as hard as a 2 m fall on 4 m. The worst falls
                    are long ones on short ropes, near the anchor.
                </p>
            </Section>
            <Section title="Static and dynamic rope">
                <p>
                    Rescue ropes are low-stretch (often called static or semi-static): they stretch
                    only a few percent, so the load doesn’t bounce and every metre hauled lifts the
                    load. That’s why they catch falls hard. Climbing ropes are dynamic, made to
                    stretch much more to catch a climber’s fall softly.
                </p>
                <p>
                    Dynamic ropes are described differently: their static elongation, with 80 kg
                    hung on them, typically 6 to 10%, and their impact force, the pull in a hard
                    test fall with 80 kg. Stretching 8% for 0.8 kN is 10% for each kilonewton, the
                    far end of the slider.
                </p>
                <p>
                    Real ropes aren’t perfect springs: they get stiffer as they stretch, lose some
                    of the work as heat, and stretch less each time they’re loaded. Treat the
                    figure’s numbers as a guide, not a rating.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "rope-stretch",
    name: "Rope stretch",
    title: "Stretchy rope catches softer",
    text: "A rope that stretches stops a fall over a longer distance, so it pulls less hard. Static rescue rope stretches little, so even a short fall onto it hits hard.",
    Figure: RopeStretchFigure,
    More: RopeStretchMore,
};

export default page;

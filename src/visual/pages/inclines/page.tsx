import { COLORS } from "@/articles/colors";
import { Eq } from "@/components/tex";
import { ink, r, Section, Var } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { InclinesFigure } from "./figure";

const W = ink(COLORS.load, "W");

function InclinesMore() {
    return (
        <>
            <Section title="Splitting the weight">
                <p>
                    The weight <Var color={COLORS.load}>W</Var> pulls straight down. Split it, as on
                    Splitting arrows, but along the slope and straight into it rather than sideways
                    and up. The two parts meet at a square corner, and the angle between the weight
                    and the part into the ground is the slope’s angle <em>θ</em>.
                </p>
                <Eq tex={r`\text{along} = ${W}\sin\theta \qquad \text{into} = ${W}\cos\theta`} />
                <p>
                    The ground pushes back against the part into it, so the rope only has to hold
                    the part along the slope. At 30°, sin <em>θ</em> is ½, so the rope holds half
                    the load.
                </p>
            </Section>
            <Section title="Steep slopes hold most of it">
                <p>
                    Like cos on Two anchors, sin starts slowly: a gentle slope of 10° puts only 17%
                    of the load on the rope. But by 45° it’s 71%, and at 60° 87%. Past about 60°,
                    the rope is holding nearly the whole load, and the slope is doing little more
                    than steering it.
                </p>
                <p>
                    That’s without friction. On a real slope the ground grips the load too, as the
                    next page shows.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "inclines",
    name: "Inclines",
    title: "On a slope, the rope holds only part of the load",
    text: "Part of the load’s weight pulls it down the slope, and the rest presses it into the ground. The rope only holds the part down the slope: half the load at 30°.",
    Figure: InclinesFigure,
    More: InclinesMore,
};

export default page;

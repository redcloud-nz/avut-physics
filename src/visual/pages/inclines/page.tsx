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
                <p>
                    The two parts meet at a square corner, so they add like arrows, not like
                    numbers: at 30° they’re 50% and 87% of the weight.
                </p>
            </Section>
            <Section title="Steep slopes hold most of it">
                <p>
                    Unlike cos on Two anchors, sin rises quickly at first and then levels off: a
                    gentle slope of 10° already puts 17% of the load on the rope, 45° puts 71%, and
                    60° puts 87%. Past about 60°, the rope is holding most of the load, and the
                    slope is doing little more than steering it.
                </p>
                <p>
                    That’s without friction. On a real slope the ground grips the load too, as the
                    next page shows.
                </p>
            </Section>
            <Section title="Rig for the whole load anyway">
                <p>
                    A slope can steepen along the way, and the load can come off the ground over a
                    step or a lip. Then the rope holds all of it, so rig as if the load might hang
                    free.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "inclines",
    name: "Inclines",
    title: "On a slope, the rope holds only part of the load",
    text: "Part of the load’s weight pulls it down the slope, and another part presses it into the ground. They’re at right angles, so as on Pulling sideways they add up to more than the weight. The rope only holds the part down the slope: half the load at 30°.",
    Figure: InclinesFigure,
    More: InclinesMore,
};

export default page;

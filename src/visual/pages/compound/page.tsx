import { Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { SixToOneFigure } from "./figure";

function CompoundMore() {
    return (
        <Section title="More isn’t always better">
            <p>
                A big advantage makes it easy to pull far harder than you mean to. On a 6:1, three
                people pulling 0.3 kN each put over 5 kN on the load (about 4.5 kN once friction
                takes its share), and hardly feel it. If the load snags on an edge, that’s what the
                system and the patient take. Use the least advantage that does the job, and stop if
                hauling suddenly gets hard.
            </p>
        </Section>
    );
}

const page: VisualPage = {
    slug: "compound",
    name: "Compound systems",
    title: "Compound systems multiply",
    text: "A 2:1 pulling on the Z-rig’s haul line doubles your pull, and the Z-rig triples that: 6:1.",
    Figure: SixToOneFigure,
    More: CompoundMore,
};

export default page;

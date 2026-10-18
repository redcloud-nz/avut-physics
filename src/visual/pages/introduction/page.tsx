import { Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { ControlsFigure } from "./figure";

function IntroductionMore() {
    return (
        <Section title="More, if you want it">
            <p>
                Some pages have more in this drawer: the maths behind an idea, say, or the reasoning
                in full. You don’t need it to follow along, so skip it whenever you like.
            </p>
            <p>Drag this back down, or tap the page behind it, to put it away.</p>
        </Section>
    );
}

const page: VisualPage = {
    slug: "introduction",
    name: "Introduction",
    title: "One idea per page",
    text: "Each page has one idea: a sentence or two, and a picture to play with. Here’s how to get around.",
    Figure: ControlsFigure,
    More: IntroductionMore,
};

export default page;

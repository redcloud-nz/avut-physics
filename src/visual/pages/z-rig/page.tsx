import { Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { ZRigFigure } from "./figure";

function ZRigMore() {
    return (
        <Section title="What’s left out">
            <p>
                A real Z-rig also has a progress capture at the anchor pulley, to hold the load
                while you slide the rope grab back down for the next pull, and a separate belay
                line. They’re left out here to keep the rope’s path clear.
            </p>
        </Section>
    );
}

const page: VisualPage = {
    slug: "z-rig",
    name: "Z-rig",
    title: "The Z-rig: 3:1",
    text: "The main line runs up round a pulley on the anchor, then back down round a travelling pulley on a rope grab (green) on the main line. Three parts of rope pull the load, so you pull a third.",
    Figure: ZRigFigure,
    More: ZRigMore,
};

export default page;

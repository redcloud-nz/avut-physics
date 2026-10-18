import type { VisualPage } from "@/visual/pages";

import { SideLoadFigure } from "./figure";

const page: VisualPage = {
    slug: "side-load",
    name: "Side loading",
    title: "Pull to one side, and the far anchor takes it",
    text: "With pre-equalised legs, a main line pulling right loads the left anchor. Past 30°, the right leg goes slack.",
    Figure: SideLoadFigure,
};

export default page;

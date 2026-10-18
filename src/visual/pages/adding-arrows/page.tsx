import type { VisualPage } from "@/visual/pages";

import { AddingFigure } from "./figure";

const page: VisualPage = {
    slug: "adding-arrows",
    name: "Adding arrows",
    title: "Arrows add tip to tail",
    text: "To add up forces, draw each arrow from the tip of the one before. The arrow from the start to the last tip is all of them together, whichever order you add them in.",
    Figure: AddingFigure,
};

export default page;

import type { VisualPage } from "@/visual/pages";

import { ArrowsFigure } from "./figure";

const page: VisualPage = {
    slug: "arrows",
    name: "Arrows",
    title: "We draw forces as arrows",
    text: "A force has a size and a direction, and so does an arrow. The longer the arrow, the bigger the force, and it points the way the force acts.",
    Figure: ArrowsFigure,
};

export default page;

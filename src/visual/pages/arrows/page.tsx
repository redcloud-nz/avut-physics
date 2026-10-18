import type { VisualPage } from "@/visual/pages";

import { ArrowsFigure } from "./figure";

const page: VisualPage = {
    slug: "arrows",
    name: "Arrows",
    title: "We draw forces as arrows",
    text: "A force has a size and a direction, and so does an arrow. The longer it is, the harder the pull, and it points the way it pulls.",
    Figure: ArrowsFigure,
};

export default page;

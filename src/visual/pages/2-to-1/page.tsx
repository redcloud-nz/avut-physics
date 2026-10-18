import type { VisualPage } from "@/visual/pages";

import { TwoToOneFigure } from "./figure";

const page: VisualPage = {
    slug: "2-to-1",
    name: "2:1",
    title: "A pulley on the load halves the pull",
    text: "Two parts of the rope share the load. The price: the team pulls in 2 m of rope for every metre the load moves.",
    Figure: TwoToOneFigure,
};

export default page;

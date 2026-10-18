import type { VisualPage } from "@/visual/pages";

import { TwoLegsFigure } from "./figure";

const page: VisualPage = {
    slug: "two-legs",
    name: "Two legs",
    title: "Wider legs, harder pull",
    text: "Two legs each take half the load only when they hang side by side. At 120° apart, each holds the whole load.",
    Figure: TwoLegsFigure,
};

export default page;

import type { VisualPage } from "@/visual/pages";

import { TagLineFigure } from "./figure";

const page: VisualPage = {
    slug: "tag-line",
    name: "Tag lines",
    title: "A sideways pull makes the rope pull harder",
    text: "Pull a load out with a tag line and the rope leans over until the pulls balance. Now it holds more than the load weighs.",
    Figure: TagLineFigure,
};

export default page;

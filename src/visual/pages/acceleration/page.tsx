import type { VisualPage } from "@/visual/pages";

import { AccelerationFigure } from "./figure";

const page: VisualPage = {
    slug: "acceleration",
    name: "Acceleration",
    title: "Acceleration is how fast velocity changes",
    text: "This box speeds up by 2 m/s every second. Its velocity (the arrows) grows steadily, so each second it goes further than the one before.",
    Figure: AccelerationFigure,
};

export default page;

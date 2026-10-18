import type { VisualPage } from "@/visual/pages";

import { VelocityFigure } from "./figure";

const page: VisualPage = {
    slug: "velocity",
    name: "Velocity",
    title: "Velocity is how fast, and which way",
    text: "Something moving at 2 metres per second (2 m/s) goes another 2 m every second. The marks are where it was after each second: evenly spaced, because its velocity doesn’t change.",
    Figure: VelocityFigure,
};

export default page;

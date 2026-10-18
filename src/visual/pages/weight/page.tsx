import type { VisualPage } from "@/visual/pages";

import { WeightFigure } from "./figure";

const page: VisualPage = {
    slug: "weight",
    name: "Weight",
    title: "100 kg weighs about 1 kN",
    text: "Weight is the force of gravity on a mass. Gravity speeds falling things up by about 10 m/s every second, so it pulls on every kilogram with about 10 N.",
    Figure: WeightFigure,
};

export default page;

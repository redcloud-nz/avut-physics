import type { VisualPage } from "@/visual/pages";

import { MassFigure } from "./figure";

const page: VisualPage = {
    slug: "mass",
    name: "Mass",
    title: "Mass is how much there is, not how heavy it is",
    text: "Mass is measured in kilograms (kg), and it’s the same everywhere. On the Moon, or floating in space, a 100 kg load is still 100 kg: just as hard to get moving, but lighter or weightless.",
    Figure: MassFigure,
};

export default page;

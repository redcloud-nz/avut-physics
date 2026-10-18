import type { VisualPage } from "@/visual/pages";

import { EquilibriumFigure } from "./figure";

const page: VisualPage = {
    slug: "equilibrium",
    name: "Equilibrium",
    title: "Nothing moves: the forces cancel",
    text: "When something stays still, or moves steadily, the forces on it balance. Tip to tail they lead back to the start, so the third rope must pull against the other two together.",
    Figure: EquilibriumFigure,
};

export default page;

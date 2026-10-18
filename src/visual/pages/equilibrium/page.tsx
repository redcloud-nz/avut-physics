import type { VisualPage } from "@/visual/pages";

import { EquilibriumFigure } from "./figure";

const page: VisualPage = {
    slug: "equilibrium",
    name: "Equilibrium",
    title: "When nothing moves, the forces add to nothing",
    text: "Something that stays still is in equilibrium: the forces on it balance. Added tip to tail, they lead straight back to where they started, so the third rope here must pull against the other two together. The same goes for something moving steadily: if its velocity isn’t changing, the forces on it balance too.",
    Figure: EquilibriumFigure,
};

export default page;

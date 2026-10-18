import twoToOne from "./2-to-1/page";
import fiveToOne from "./5-to-1/page";
import acceleration from "./acceleration/page";
import addingArrows from "./adding-arrows/page";
import arrows from "./arrows/page";
import compound from "./compound/page";
import counting from "./counting/page";
import equilibrium from "./equilibrium/page";
import force from "./force/page";
import friction from "./friction/page";
import introduction from "./introduction/page";
import mass from "./mass/page";
import pulleyOnTheAnchor from "./pulley-on-the-anchor/page";
import pullingOffCentre from "./pulling-off-centre/page";
import pullingSideways from "./pulling-sideways/page";
import redirect from "./redirect/page";
import splittingArrows from "./splitting-arrows/page";
import tMethodCompound from "./t-method-compound/page";
import tMethod from "./t-method/page";
import twoAnchors from "./two-anchors/page";
import units from "./units/page";
import velocity from "./velocity/page";
import weight from "./weight/page";
import zRig from "./z-rig/page";

/*
 * The pages of A Visual Introduction to Rescue Physics, in order. Each is one idea: a headline, a sentence or two, and
 * a figure, and on some pages more for those who want it.
 */

export { SERIES } from "@/visual/series";

export type VisualPage = {
    slug: string;
    /** A word or two, for the list of pages. */
    name: string;
    title: string;
    text: React.ReactNode;
    Figure: () => React.ReactNode;
    /** Further reading, such as the maths, in a drawer that swipes up from under the page. */
    More?: () => React.ReactNode;
};

export const PAGES: VisualPage[] = [
    introduction,
    velocity,
    acceleration,
    mass,
    force,
    weight,
    units,
    arrows,
    addingArrows,
    equilibrium,
    splittingArrows,
    pullingSideways,
    twoAnchors,
    pullingOffCentre,
    redirect,
    pulleyOnTheAnchor,
    twoToOne,
    zRig,
    fiveToOne,
    counting,
    compound,
    tMethod,
    tMethodCompound,
    friction,
];

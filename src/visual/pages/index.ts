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
import inclines from "./inclines/page";
import introduction from "./introduction/page";
import levers from "./levers/page";
import mass from "./mass/page";
import pulleyOnTheAnchor from "./pulley-on-the-anchor/page";
import pullingOffCentre from "./pulling-off-centre/page";
import pullingSideways from "./pulling-sideways/page";
import redirect from "./redirect/page";
import ropeStretch from "./rope-stretch/page";
import safetyFactors from "./safety-factors/page";
import shockLoading from "./shock-loading/page";
import splittingArrows from "./splitting-arrows/page";
import surfaceFriction from "./surface-friction/page";
import tMethodCompound from "./t-method-compound/page";
import tMethod from "./t-method/page";
import theEnd from "./the-end/page";
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
    /** The text as plain words, for search results and links, where `text` isn't plain already. */
    description?: string;
    Figure: () => React.ReactNode;
    /**
     * Further reading, such as the maths, in a drawer (or on a wide screen a column beside the page) that the page's
     * question mark brings up.
     */
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
    inclines,
    surfaceFriction,
    levers,
    safetyFactors,
    shockLoading,
    ropeStretch,
    theEnd,
];

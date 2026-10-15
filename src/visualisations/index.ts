export type Visualisation = {
    href:
        | "/block-on-an-incline"
        | "/ladder-hinge-lower"
        | "/two-point-lower"
        | "/body-belay"
        | "/ute-load";
    title: string;
    description: string;
};

export const incline: Visualisation = {
    href: "/block-on-an-incline",
    title: "Block on an Incline",
    description:
        "Free-body diagram of a block on a slope. Static friction holds the block until the angle exceeds arctan(μs); after that it slides with kinetic friction μk·N.",
};

export const ladderHinge: Visualisation = {
    href: "/ladder-hinge-lower",
    title: "Ladder Hinge Lower",
    description:
        "A ladder hinged at the base of a wall, with a 2 m stretcher hanging from it. A rope from an anchor behind the top of the wall holds one end of the stretcher, and an attachment from the other end runs to the ladder. Everything settles where the torques and forces on the ladder and stretcher balance.",
};

export const twoPointLower: Visualisation = {
    href: "/two-point-lower",
    title: "Two-Point Lower",
    description:
        "A 2 m stretcher lowered over a wall on a rope from an anchor behind its top, with a line from its other end to a ground team out in front, who pull it steadily to keep it off the wall. The stretcher settles where the forces and torques on it balance.",
};

export const bodyBelay: Visualisation = {
    href: "/body-belay",
    title: "Body-Belayed Two-Point Lower",
    description:
        "The two-point lower with no anchor: two belayers standing side by side on the wall top each hold a rope round their waist and lean back against its pull. Shows how the angle between their ropes loads them, and whether their feet grip well enough to stop them sliding towards the edge.",
};

export const uteLoad: Visualisation = {
    href: "/ute-load",
    title: "Loading a Ute",
    description:
        "A dual-cab ute, side on, loaded with crew, fit-out, cargo and a trailer. Shows how the weight shares between the axles, how a tow ball lifts weight off the front wheels, and how close each total comes to the ute's ratings.",
};

/** Listed on the home page (the incline isn't, but keeps its page). Each one also needs its own page under `src/app`. */
export const visualisations: Visualisation[] = [ladderHinge, twoPointLower, bodyBelay, uteLoad];

export type Visualisation = {
  href: "/block-on-an-incline" | "/hinged-beam";
  title: string;
  description: string;
};

export const incline: Visualisation = {
  href: "/block-on-an-incline",
  title: "Block on an Incline",
  description:
    "Free-body diagram of a block on a slope. Static friction holds the block until the angle exceeds arctan(μs); after that it slides with kinetic friction μk·N.",
};

export const hingedBeam: Visualisation = {
  href: "/hinged-beam",
  title: "Hinged Beam",
  description:
    "A beam hinged at the base of a wall. A second, 2 m beam hangs from two cables: one from the wall to one end, one from the other end to the main beam. Everything settles where the torques and forces on both beams balance.",
};

/** Listed on the home page. Each one also needs its own page under `src/app`. */
export const visualisations: Visualisation[] = [incline, hingedBeam];

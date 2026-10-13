import type { ComponentType } from "react";
import HingedBeam from "./hinged-beam";
import Incline from "./incline";

export type Visualisation = {
  id: string;
  title: string;
  description: string;
  Component: ComponentType;
};

/** Add new visualisations here. */
export const visualisations: Visualisation[] = [
  {
    id: "incline",
    title: "Block on an Incline",
    description:
      "Free-body diagram of a block on a slope. Static friction holds the block until the angle exceeds arctan(μs); after that it slides with kinetic friction μk·N.",
    Component: Incline,
  },
  {
    id: "hinged-beam",
    title: "Hinged Beam",
    description:
      "A beam hinged at the base of a wall. A second, 2 m beam hangs from two cables: one from the wall to one end, one from the other end to the main beam. Everything settles where the torques and forces on both beams balance.",
    Component: HingedBeam,
  },
];

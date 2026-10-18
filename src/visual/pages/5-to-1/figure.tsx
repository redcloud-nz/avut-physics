"use client";

import { FIVE_TO_ONE } from "@/articles/pulley-systems";
import { Haul } from "@/visual/common/haul";

/** The anchor pulleys' slings are labelled; the load pulleys' are too short to. */
export const FiveToOneFigure = () => (
    <Haul sys={FIVE_TO_ONE} max={5} stretch={1.3} sling={(id) => id.startsWith("p")} />
);

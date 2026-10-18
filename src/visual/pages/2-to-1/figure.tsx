"use client";

import { TWO_TO_ONE } from "@/articles/pulley-systems";
import { Haul } from "@/visual/common/haul";

export const TwoToOneFigure = () => <Haul sys={TWO_TO_ONE} max={6} sling={() => false} />;

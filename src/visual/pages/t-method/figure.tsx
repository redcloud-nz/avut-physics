"use client";

import { Z_RIG } from "@/articles/pulley-systems";
import { TSteps } from "@/visual/common/haul";

export const ZRigTMethodFigure = () => (
    <TSteps
        sys={Z_RIG}
        steps={[
            { text: "The team pulls the haul line: 1T.", show: ["0.2"] },
            {
                text: "Round the pulleys, the rope keeps its 1T, up to the rope grab.",
                show: ["0.1", "0.0"],
            },
            { text: "Two 1T parts pull the travelling pulley: 2T.", show: ["p2"] },
            {
                text: "The grab adds 2T to the main line’s 1T: 3T on the load. It’s a 3:1.",
                show: ["0.0.g1"],
            },
            { text: "The anchor pulley holds its two parts: 2T.", show: ["p1"] },
        ]}
    />
);

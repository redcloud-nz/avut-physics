"use client";

import { SIX_TO_ONE } from "@/articles/pulley-systems";
import { TSteps } from "@/visual/common/haul";

export const SixToOneTMethodFigure = () => (
    <TSteps
        sys={SIX_TO_ONE}
        steps={[
            { text: "The team pulls: 1T.", show: ["1.1"] },
            { text: "The 2:1’s rope keeps 1T all along.", show: ["1.0"] },
            { text: "Its pulley pulls the Z-rig’s grab with 2T.", show: ["m2"] },
            { text: "So the Z-rig’s whole rope carries 2T.", show: ["0.2", "0.1", "0.0"] },
            { text: "Two 2T parts pull the travelling pulley: 4T.", show: ["p2"] },
            { text: "4T + 2T = 6T on the load. It’s a 6:1.", show: ["0.0.g1"] },
        ]}
    />
);

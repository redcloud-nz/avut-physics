import type { Metadata } from "next";

import VisualisationPage from "@/components/VisualisationPage";
import { twoPointLower } from "@/visualisations";
import TwoPointLower from "@/visualisations/two-point-lower";

export const metadata: Metadata = {
    title: twoPointLower.title,
    description: twoPointLower.description,
};

export default function Page() {
    return (
        <VisualisationPage visualisation={twoPointLower}>
            <TwoPointLower />
        </VisualisationPage>
    );
}

import type { Metadata } from "next";

import VisualisationPage from "@/components/VisualisationPage";
import { fourPointLower } from "@/visualisations";
import FourPointLower from "@/visualisations/four-point-lower";

export const metadata: Metadata = {
    title: fourPointLower.title,
    description: fourPointLower.description,
};

export default function Page() {
    return (
        <VisualisationPage visualisation={fourPointLower}>
            <FourPointLower />
        </VisualisationPage>
    );
}

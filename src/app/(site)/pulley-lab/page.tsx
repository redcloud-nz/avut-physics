import type { Metadata } from "next";

import VisualisationPage from "@/components/VisualisationPage";
import { pulleyLab } from "@/visualisations";
import PulleyLab from "@/visualisations/pulley-lab";

export const metadata: Metadata = { title: pulleyLab.title, description: pulleyLab.description };

export default function Page() {
    return (
        <VisualisationPage visualisation={pulleyLab}>
            <PulleyLab />
        </VisualisationPage>
    );
}

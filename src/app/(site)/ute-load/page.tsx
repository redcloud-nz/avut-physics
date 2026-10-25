import type { Metadata } from "next";

import VisualisationPage from "@/components/VisualisationPage";
import { uteLoad } from "@/visualisations";
import UteLoad from "@/visualisations/ute-load";

export const metadata: Metadata = {
    title: uteLoad.title,
    description: uteLoad.description,
};

export default function Page() {
    return (
        <VisualisationPage visualisation={uteLoad}>
            <UteLoad />
        </VisualisationPage>
    );
}

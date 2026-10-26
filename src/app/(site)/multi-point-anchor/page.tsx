import type { Metadata } from "next";

import VisualisationPage from "@/components/VisualisationPage";
import { multiPointAnchor } from "@/visualisations";
import MultiPointAnchor from "@/visualisations/multi-point-anchor";

export const metadata: Metadata = {
    title: multiPointAnchor.title,
    description: multiPointAnchor.description,
};

export default function Page() {
    return (
        <VisualisationPage visualisation={multiPointAnchor}>
            <MultiPointAnchor />
        </VisualisationPage>
    );
}

import type { Metadata } from "next";

import TowerView from "@/abseil-tower/tower-view";
import VisualisationPage from "@/components/VisualisationPage";

const TITLE = "Abseil Tower";
const DESCRIPTION = "The abseil tower in 3D, for planning rigs on it. Every size is an estimate.";

export const metadata: Metadata = { title: TITLE, description: DESCRIPTION };

/** The abseil tower in 3D: a work in progress, not yet listed on the home page. */
export default function Page() {
    return (
        <VisualisationPage visualisation={{ title: TITLE }}>
            <TowerView />
        </VisualisationPage>
    );
}

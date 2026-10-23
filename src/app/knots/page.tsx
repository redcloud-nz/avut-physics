import type { Metadata } from "next";

import VisualisationPage from "@/components/VisualisationPage";
import Knots from "@/knots/knots";
import { knots } from "@/visualisations";

export const metadata: Metadata = { title: knots.title, description: knots.description };

export default function Page() {
    return (
        <VisualisationPage visualisation={knots}>
            <Knots />
        </VisualisationPage>
    );
}

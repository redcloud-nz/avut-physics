import type { Metadata } from "next";
import VisualisationPage from "@/components/VisualisationPage";
import { hingedBeam } from "@/visualisations";
import HingedBeam from "@/visualisations/hinged-beam";

export const metadata: Metadata = { title: hingedBeam.title, description: hingedBeam.description };

export default function Page() {
  return (
    <VisualisationPage visualisation={hingedBeam}>
      <HingedBeam />
    </VisualisationPage>
  );
}

import type { Metadata } from "next";
import VisualisationPage from "@/components/VisualisationPage";
import { bodyBelay } from "@/visualisations";
import BodyBelay from "@/visualisations/body-belay";

export const metadata: Metadata = { title: bodyBelay.title, description: bodyBelay.description };

export default function Page() {
  return (
    <VisualisationPage visualisation={bodyBelay}>
      <BodyBelay />
    </VisualisationPage>
  );
}

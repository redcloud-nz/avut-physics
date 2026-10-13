import type { Metadata } from "next";
import VisualisationPage from "@/components/VisualisationPage";
import { incline } from "@/visualisations";
import Incline from "@/visualisations/incline";

export const metadata: Metadata = { title: incline.title, description: incline.description };

export default function Page() {
  return (
    <VisualisationPage visualisation={incline}>
      <Incline />
    </VisualisationPage>
  );
}

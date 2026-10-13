import type { Metadata } from "next";
import VisualisationPage from "@/components/VisualisationPage";
import { ladderHinge } from "@/visualisations";
import LadderHinge from "@/visualisations/ladder-hinge";

export const metadata: Metadata = { title: ladderHinge.title, description: ladderHinge.description };

export default function Page() {
  return (
    <VisualisationPage visualisation={ladderHinge}>
      <LadderHinge />
    </VisualisationPage>
  );
}

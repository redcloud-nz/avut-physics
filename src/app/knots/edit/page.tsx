import type { Metadata } from "next";
import { notFound } from "next/navigation";

import VisualisationPage from "@/components/VisualisationPage";
import RopeEditor from "@/knots/rope-editor";
import { knots } from "@/visualisations";

export const metadata: Metadata = { title: "Rope editor", robots: { index: false } };

/** The rope editor, for laying out the knots' steps. Only while developing: it saves into the source. */
export default function Page() {
    if (process.env.NODE_ENV !== "development") notFound();
    return (
        <VisualisationPage visualisation={{ ...knots, title: "Rope editor" }}>
            <RopeEditor />
        </VisualisationPage>
    );
}

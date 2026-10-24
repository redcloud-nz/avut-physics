import type { Metadata } from "next";
import { notFound } from "next/navigation";

import VisualisationPage from "@/components/VisualisationPage";
import RopeEditor from "@/knots/rope-editor";

export const metadata: Metadata = { title: "Rope editor", robots: { index: false } };

/** The rope editor, for laying out the knots' steps. Only while developing: it saves into the source. */
export default function Page() {
    if (process.env.NODE_ENV !== "development") notFound();
    return (
        <VisualisationPage visualisation={{ title: "Rope editor" }}>
            <RopeEditor />
        </VisualisationPage>
    );
}

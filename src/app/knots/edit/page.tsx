import type { Metadata } from "next";
import { notFound } from "next/navigation";

import VisualisationPage from "@/components/VisualisationPage";
import RopeEditor from "@/knots/rope-editor";

export const metadata: Metadata = { title: "Rope editor", robots: { index: false } };

/** The rope editor, for laying out the knots' steps. Only while developing: it saves into the source. */
// Which knot it edits comes from the address, so the page waits for it; it's only ever run while developing.
export const instant = false;

export default async function Page(props: PageProps<"/knots/edit">) {
    if (process.env.NODE_ENV !== "development") notFound();
    const { knot } = await props.searchParams;
    const slug = typeof knot === "string" ? knot : "figure-8";
    return (
        <VisualisationPage visualisation={{ title: "Rope editor" }}>
            {/* Keyed by knot, so going to another starts afresh with its steps. */}
            <RopeEditor key={slug} knot={slug} />
        </VisualisationPage>
    );
}

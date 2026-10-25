import type { Metadata } from "next";
import { notFound } from "next/navigation";

import KnotEditor from "@/knot-editor/editor";

export const metadata: Metadata = { title: "Knot editor", robots: { index: false } };

/** The knot editor, for drawing knots and their tying steps. Only while developing, for now. */
export default function Page() {
    if (process.env.NODE_ENV !== "development") notFound();
    return <KnotEditor />;
}

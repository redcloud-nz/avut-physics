import type { Metadata } from "next";

import KnotEditor from "@/knot-editor/editor";

export const metadata: Metadata = { title: "Knot editor", robots: { index: false } };

/**
 * The knot editor, for drawing knots and their tying steps. It's on the live site but not linked or indexed: a
 * desktop tool, which says so on a small screen, and in a browser that can't open and save files.
 */
export default function Page() {
    return <KnotEditor />;
}

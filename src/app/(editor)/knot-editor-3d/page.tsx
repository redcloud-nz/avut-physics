import type { Metadata } from "next";

import KnotEditor3D from "@/knot-editor-3d/editor";

export const metadata: Metadata = { title: "3D knot editor", robots: { index: false } };

/**
 * The 3D knot editor, for shaping and tightening knots in 3D (the flying fox's figure 8s first). On the live site but
 * not linked or indexed: a desktop tool, which says so on a small screen, and in a browser that can't open and save
 * files.
 */
export default function Page() {
    return <KnotEditor3D />;
}

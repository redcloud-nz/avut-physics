import type { Metadata } from "next";

import Sketch from "./sketch";

export const metadata: Metadata = { title: "Pulley sketch", robots: { index: false } };

/** A scratch page for drawing pulleys face on: two doubles, the top one on the anchor, the bottom one on the load. */
export default function Page() {
    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-8">
            <h1 className="mb-4 text-2xl font-semibold">Pulley sketch</h1>
            <Sketch />
        </div>
    );
}

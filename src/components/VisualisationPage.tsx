import Link from "next/link";

import type { Visualisation } from "@/visualisations";

/** The frame around one visualisation's page: a link home and its title. */
export default function VisualisationPage(props: {
    visualisation: Visualisation;
    children: React.ReactNode;
}) {
    return (
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-4 pb-10">
            <Link href="/" className="text-sm text-link hover:text-highlight">
                ← Physics Visualisations
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight text-ink-bright">
                {props.visualisation.title}
            </h1>
            {props.children}
        </main>
    );
}

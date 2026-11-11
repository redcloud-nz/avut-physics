import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SystemPage } from "@/pulley-systems/system-page";
import { SYSTEMS } from "@/pulley-systems/systems";

export function generateStaticParams() {
    return SYSTEMS.map((s) => ({ system: s.slug }));
}

export async function generateMetadata(
    props: PageProps<"/pulley-systems/[system]">,
): Promise<Metadata> {
    const { system } = await props.params;
    const found = SYSTEMS.find((s) => s.slug === system);
    if (!found) return {};
    return { title: found.name, description: found.text, robots: { index: false } };
}

// As with the visual introduction's pages: every system is prerendered, and awaiting `params` outside a Suspense
// boundary keeps the 404 for a slug that isn't a system.
export const instant = false;

export default async function Page(props: PageProps<"/pulley-systems/[system]">) {
    const { system } = await props.params;
    const found = SYSTEMS.find((s) => s.slug === system);
    if (!found) notFound();
    return <SystemPage key={found.slug} slug={found.slug} />;
}

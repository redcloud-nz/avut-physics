import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { fullName, KNOTS, KNOTS_TITLE } from "@/knots";
import { KnotPage } from "@/knots/knot-page";

export function generateStaticParams() {
    return KNOTS.map((knot) => ({ slug: knot.slug }));
}

export async function generateMetadata(props: PageProps<"/knots/[slug]">): Promise<Metadata> {
    const { slug } = await props.params;
    const knot = KNOTS.find((k) => k.slug === slug);
    if (!knot) return {};
    return {
        title: `${fullName(knot)}, ${KNOTS_TITLE}`,
        description: knot.description,
        openGraph: {
            title: fullName(knot),
            description: knot.description,
            url: `/knots/${slug}`,
            type: "website",
        },
    };
}

// Every slug is prerendered, so moving between knots doesn't wait. Awaiting `params` outside a Suspense boundary
// keeps the 404 for a slug that isn't a knot, so this tells Next's instant-navigation check the wait is expected.
export const instant = false;

export default async function Page(props: PageProps<"/knots/[slug]">) {
    const { slug } = await props.params;
    const knot = KNOTS.find((k) => k.slug === slug);
    if (!knot) notFound();
    return <KnotPage key={slug} slug={slug} />;
}

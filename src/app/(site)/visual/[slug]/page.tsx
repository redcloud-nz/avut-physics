import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card } from "@/visual/card";
import { CONTENTS, PAGES, SERIES } from "@/visual/pages";
import { SERIES_DESCRIPTION } from "@/visual/series";

export function generateStaticParams() {
    return PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/visual/[slug]">): Promise<Metadata> {
    const { slug } = await props.params;
    const page = PAGES.find((p) => p.slug === slug);
    if (!page) return {};
    // The page's own words where they're plain text; the root layout's template adds the site's name to the title.
    const description =
        page.description ?? (typeof page.text === "string" ? page.text : SERIES_DESCRIPTION);
    return {
        title: page.title,
        description,
        openGraph: {
            title: page.title,
            description: `${SERIES}: ${description}`,
            url: `/visual/${slug}`,
            type: "website",
        },
    };
}

// Every slug is prerendered, so a navigation between pages doesn't wait. Awaiting `params` outside a Suspense boundary
// keeps the 404 for a slug that isn't a page (inside one, the page has started streaming before notFound()), so this
// tells Next's instant-navigation check the wait is expected.
export const instant = false;

export default async function Page(props: PageProps<"/visual/[slug]">) {
    const { slug } = await props.params;
    const index = PAGES.findIndex((p) => p.slug === slug);
    if (index < 0) notFound();
    const page = PAGES[index];
    const href = (i: number) =>
        i < 0 || i >= PAGES.length ? "/visual" : `/visual/${PAGES[i].slug}`;
    return (
        <Card
            key={slug}
            index={index}
            contents={CONTENTS}
            title={page.title}
            text={page.text}
            prev={href(index - 1)}
            next={href(index + 1)}
            details={page.More && <page.More />}
        >
            <page.Figure />
        </Card>
    );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card } from "@/visual/card";
import { PAGES, SERIES } from "@/visual/pages";

export function generateStaticParams() {
    return PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/visual/[slug]">): Promise<Metadata> {
    const { slug } = await props.params;
    const page = PAGES.find((p) => p.slug === slug);
    return page ? { title: `${page.title}, ${SERIES}` } : {};
}

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
            total={PAGES.length}
            title={page.title}
            text={page.text}
            prev={href(index - 1)}
            next={href(index + 1)}
        >
            <page.Figure />
        </Card>
    );
}

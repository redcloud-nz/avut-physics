import { notFound } from "next/navigation";

import { PAGES, SERIES } from "@/visual/pages";
import { SHARE_IMAGE_SIZE, shareImage } from "@/visual/share-image";

export const contentType = "image/png";

export function generateStaticParams() {
    return PAGES.map((p) => ({ slug: p.slug }));
}

/** One share image per page, its alt text saying which page it's for. */
export function generateImageMetadata(props: { params: { slug: string } }) {
    const index = PAGES.findIndex((p) => p.slug === props.params.slug);
    if (index < 0) return [];
    return [
        {
            id: "share",
            alt: `${PAGES[index].title}: page ${index + 1} of ${PAGES.length} of ${SERIES}`,
            size: SHARE_IMAGE_SIZE,
            contentType,
        },
    ];
}

export default async function Image(props: { params: Promise<{ slug: string }> }) {
    const { slug } = await props.params;
    const index = PAGES.findIndex((p) => p.slug === slug);
    if (index < 0) notFound();
    return shareImage({
        eyebrow: SERIES,
        title: PAGES[index].title,
        text: `Page ${index + 1} of ${PAGES.length}: ${PAGES[index].name}`,
    });
}

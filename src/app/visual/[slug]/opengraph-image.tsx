import { PAGES, SERIES } from "@/visual/pages";
import { SHARE_IMAGE_SIZE, shareImage } from "@/visual/share-image";

export const alt = SERIES;
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
    return PAGES.map((p) => ({ slug: p.slug }));
}

export default async function Image(props: { params: Promise<{ slug: string }> }) {
    const { slug } = await props.params;
    const index = Math.max(
        0,
        PAGES.findIndex((p) => p.slug === slug),
    );
    return shareImage({
        eyebrow: SERIES,
        title: PAGES[index].title,
        text: `Page ${index + 1} of ${PAGES.length}: ${PAGES[index].name}`,
    });
}

import { notFound } from "next/navigation";

import { systemImage } from "@/pulley-systems/share-image";
import { SERIES, SYSTEMS } from "@/pulley-systems/systems";
import { SHARE_IMAGE_SIZE } from "@/visual/share-image";

export const contentType = "image/png";

export function generateStaticParams() {
    return SYSTEMS.map((s) => ({ system: s.slug }));
}

/** One share image per system, its alt text saying which. */
export function generateImageMetadata(props: { params: { system: string } }) {
    const system = SYSTEMS.find((s) => s.slug === props.params.system);
    if (!system) return [];
    return [
        {
            id: "share",
            alt: `${system.name}, from ${SERIES}: ${system.text}`,
            size: SHARE_IMAGE_SIZE,
            contentType,
        },
    ];
}

export default async function Image(props: { params: Promise<{ system: string }> }) {
    const { system } = await props.params;
    const found = SYSTEMS.find((s) => s.slug === system);
    if (!found) notFound();
    return systemImage(found.slug);
}

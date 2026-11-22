import { notFound } from "next/navigation";

import { RIGS } from "@/abseil-tower/rig";
import { TOWER_TITLE, towerImage } from "@/abseil-tower/share-image";
import { SHARE_IMAGE_SIZE } from "@/visual/share-image";

export const alt = `${TOWER_TITLE}: a rigging plan on the team's training tower, every rope, sling and knot in 3D.`;
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
    return RIGS.map((r) => ({ rig: r.slug }));
}

export default async function Image(props: { params: Promise<{ rig: string }> }) {
    const { rig } = await props.params;
    const image = towerImage(rig);
    if (!image) notFound();
    return image;
}

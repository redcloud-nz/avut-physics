import { SERIES, SERIES_DESCRIPTION } from "@/visual/series";
import { SHARE_IMAGE_SIZE, shareImage } from "@/visual/share-image";

export const alt = SERIES;
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
    return shareImage({
        eyebrow: "Physics Visualisations",
        title: SERIES,
        text: SERIES_DESCRIPTION,
    });
}

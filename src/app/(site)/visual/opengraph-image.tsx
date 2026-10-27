import { SERIES } from "@/visual/series";
import { seriesImage, SHARE_IMAGE_SIZE } from "@/visual/share-image";

export const alt = SERIES;
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
    return seriesImage();
}

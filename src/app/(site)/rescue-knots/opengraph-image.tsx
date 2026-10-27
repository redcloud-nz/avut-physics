import { KNOTS_TITLE } from "@/knots";
import { knotsImage } from "@/knots/share-image";
import { SHARE_IMAGE_SIZE } from "@/visual/share-image";

export const alt = KNOTS_TITLE;
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
    return knotsImage();
}

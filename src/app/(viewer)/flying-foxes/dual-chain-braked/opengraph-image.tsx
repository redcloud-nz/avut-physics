import { FOX_SHARE, foxImage } from "@/flying-fox/share-image";
import { SHARE_IMAGE_SIZE } from "@/visual/share-image";

export const alt = `${FOX_SHARE.title}, a rigging plan: ${FOX_SHARE.text}`;
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
    return foxImage();
}

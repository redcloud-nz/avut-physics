import { knotsImage } from "@/knots/share-image";

/*
 * The knots' share image at an address that doesn't change, for their first page to show. The opengraph-image route's
 * own address carries a hash. Nothing here depends on the request, so it's drawn once, at build time.
 */
export function GET() {
    return knotsImage();
}

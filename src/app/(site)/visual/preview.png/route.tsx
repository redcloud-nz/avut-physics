import { seriesImage } from "@/visual/share-image";

/*
 * The series' share image at an address that doesn't change, for the first page to show. The opengraph-image route's
 * own address carries a hash. Nothing here depends on the request, so it's drawn once, at build time.
 */
export function GET() {
    return seriesImage();
}

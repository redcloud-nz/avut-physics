import { readFileSync } from "node:fs";
import { join } from "node:path";

import { shareImage } from "@/visual/share-image";

import { RIGS } from "./rig";

/*
 * The picture a link to a rigging plan shows when it's shared: its name and what it is beside a still of its 3D view.
 * next/og can't draw the 3D view (there's no WebGL where it runs), so the still is a screenshot kept beside the
 * visualisation, and it needs taking again when the rig changes much. To take one: open the page's 3D view in a
 * browser held to a 1000 × 1000 drawing area at twice the pixels (Chrome's device toolbar: 1000 × 1053, the title bar
 * taking 53), set the view, hide the buttons and legend, screenshot, crop to the drawing and scale it to 1004 pixels
 * square.
 */

/** How big the still is drawn (pixels): the picture's height less its margins, as the other share pictures. */
const DRAWN = 502;

/**
 * A share picture with the still `png` on the right. Each caller reads its own still from a path written out in full,
 * so the build ships that file alone rather than tracing the whole project.
 */
export function stillImage(png: Buffer, words: { eyebrow: string; title: string; text: string }) {
    return shareImage({
        ...words,
        picture: (
            // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain elements only
            <img
                src={`data:image/png;base64,${png.toString("base64")}`}
                alt=""
                width={DRAWN}
                height={DRAWN}
                style={{ borderRadius: 16 }}
            />
        ),
    });
}

export const TOWER_TITLE = "Cracroft Abseil Tower";

/** What the tower's share picture says about the rig at `slug`. */
function towerWords(slug: string) {
    const rig = RIGS.find((r) => r.slug === slug);
    if (!rig) return null;
    return {
        eyebrow: "Rigging plan",
        title: TOWER_TITLE,
        text: `${rig.name}: every rope, sling and knot on the team's training tower, to turn and look at in 3D.`,
    };
}

/** The tower's share picture for the rig at `slug` (the still is of the first rig). */
export function towerImage(slug: string) {
    const words = towerWords(slug);
    return words
        ? stillImage(readFileSync(join(process.cwd(), "src/abseil-tower/share-3d.png")), words)
        : null;
}

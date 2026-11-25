import { readFileSync } from "node:fs";
import { join } from "node:path";

import { stillImage } from "@/abseil-tower/share-image";

/*
 * The picture a link to the flying fox shows when it's shared: its name and what it is beside a still of its overhead
 * view, locked onto the top tower (`?view=overhead&target=top-tower`). It's taken as `stillImage` describes for a 3D
 * still: a 1000 × 1000 drawing area at twice the pixels, zoomed in one step, the buttons, legend and labels hidden,
 * cropped and scaled to 1004 pixels square.
 */

export const FOX_SHARE = {
    eyebrow: "Rigging plan",
    title: "NSW standard dual-hawser flying fox",
    text: "Set up to Scouts NSW's flying fox procedure, with a chain-weight brake: the towers, hawsers, brakes and anchors, in 3D and from above and the side.",
};

export const foxImage = () =>
    stillImage(readFileSync(join(process.cwd(), "src/flying-fox/share-overhead.png")), FOX_SHARE);

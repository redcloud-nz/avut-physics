import { readFileSync } from "node:fs";
import { join } from "node:path";

import { stillImage } from "@/abseil-tower/share-image";

/*
 * The picture a link to the flying fox shows when it's shared: its name and what it is beside a still of its 3D view,
 * from past the landing looking back up the span. See `stillImage` for how the still was taken.
 */

export const FOX_SHARE = {
    eyebrow: "Rigging plan",
    title: "Dual-hawser flying fox",
    text: "Chain-braked, set up to Scouts NSW's flying fox procedure: the towers, hawsers, brakes and anchors in 3D.",
};

export const foxImage = () =>
    stillImage(readFileSync(join(process.cwd(), "src/flying-fox/share-3d.png")), FOX_SHARE);

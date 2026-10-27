import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { endsBothWays, KNOTS } from ".";
import { KnotDrawing, knotView, workedPicture } from "./knot-drawing";

/*
 * The knots in the share picture, drawn to SVG here (Next won't let a route import react-dom/server) and kept in
 * `share-knots.json` for the picture to read. When a knot or the drawing changes, this fails until they're drawn again:
 * `npx vitest run src/knots/share-image.test.ts -u`.
 */
/** The knots shown in the picture, side by side, by their slugs. */
const SHARE_KNOTS = ["joining-8", "figure-8-on-a-bight"];

describe("the share picture's knots", () => {
    it("are drawn as the knots are now", async () => {
        const drawn = SHARE_KNOTS.map((slug) => {
            const knot = KNOTS.find((k) => k.slug === slug)!;
            const worked = workedPicture(knot.file.knot);
            const view = knotView(worked, endsBothWays(knot));
            const svg = renderToStaticMarkup(
                createElement(KnotDrawing, { worked, view, label: null }),
            );
            return { slug, w: view.w, h: view.h, svg };
        });
        await expect(JSON.stringify(drawn, null, 1) + "\n").toMatchFileSnapshot("share-knots.json");
    });
});

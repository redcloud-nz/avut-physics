import { readFileSync } from "node:fs";
import { join } from "node:path";

import { shareImage } from "@/visual/share-image";

import { KNOTS_DESCRIPTION, KNOTS_TITLE } from ".";
import DRAWN from "./share-knots.json";

/*
 * The picture a link to the rescue knots shows when it's shared: the headline beside two knots, drawn as on their
 * pages. Next won't let a route import react-dom/server, so the knots are drawn to SVG ahead, by
 * `share-image.test.ts`, which keeps them in `share-knots.json`. next/og draws without the page's stylesheet, so here
 * the colour tokens each uses are swapped for their values from globals.css and the shades mixed from them worked out,
 * and each is shown as an image.
 */

/** The room the knots have (pixels), as the visual introduction's picture has. */
const ROOM = { w: 480, h: 480 };
const GAP = 40;

/** Each `--knot-*` token's value, from globals.css. */
function knotTokens(): Map<string, string> {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    return new Map(
        [...css.matchAll(/(--knot-[\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]),
    );
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Two colours mixed, `share` of the second (a close enough stand-in for the page's mix in oklab). */
function mix(a: string, b: string, share: number) {
    const [ca, cb] = [channels(a), channels(b)];
    return `#${ca
        .map((v, i) =>
            Math.round(v + (cb[i] - v) * share)
                .toString(16)
                .padStart(2, "0"),
        )
        .join("")}`;
}

/** The drawing's SVG with every token and mix replaced by the colour it comes to. */
function resolved(svg: string, tokens: Map<string, string>) {
    return svg
        .replace(/var\((--knot-[\w-]+)\)/g, (_, name: string) => tokens.get(name) ?? "#000000")
        .replace(
            /color-mix\(in oklab, (#[0-9a-f]{6}), (#[0-9a-f]{6}) ([\d.]+)%\)/gi,
            (_, a: string, b: string, share: string) => mix(a, b, Number(share) / 100),
        )
        .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
}

function Knots() {
    const tokens = knotTokens();
    // One size per millimetre for both, the most that fits them side by side in the room.
    const scale = Math.min(
        (ROOM.w - GAP * (DRAWN.length - 1)) / DRAWN.reduce((w, d) => w + d.w, 0),
        ...DRAWN.map((d) => ROOM.h / d.h),
    );
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: GAP,
                width: ROOM.w,
                height: ROOM.h,
            }}
        >
            {DRAWN.map(({ slug, w, h, svg }) => (
                // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain elements
                <img
                    key={slug}
                    src={`data:image/svg+xml;base64,${Buffer.from(resolved(svg, tokens)).toString("base64")}`}
                    width={Math.round(w * scale)}
                    height={Math.round(h * scale)}
                    alt=""
                />
            ))}
        </div>
    );
}

/** The rescue knots' picture: for links to their first page, and on that page on a wide screen. */
export function knotsImage() {
    return shareImage({
        eyebrow: "Physics Visualisations",
        title: KNOTS_TITLE,
        text: KNOTS_DESCRIPTION,
        picture: <Knots />,
    });
}

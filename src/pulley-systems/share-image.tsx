import { shareImage } from "@/visual/share-image";

import { stillSystem } from "./figure";
import { svgMarkup } from "./svg-markup";
import { SERIES, SYSTEMS, type Slug } from "./systems";

/*
 * The picture a link to a pulley system shows when it's shared: its name and what it is beside its drawing, with no rope
 * pulled in and no track.
 */

/*
 * next/og draws this without the page's stylesheet, so the drawing can't use the colour tokens in globals.css. These are
 * the dark values of those its classes use, given to it in a stylesheet of its own.
 */
const COLOURS = {
    background: "#020617",
    surface: "#0f172a",
    border: "#1e293b",
    ink: "#e2e8f0",
    "ink-muted": "#94a3b8",
    grab: "#34d399",
};
const STYLE = [
    ...(["ink", "ink-muted", "grab"] as const).map((k) => `.text-${k}{color:${COLOURS[k]}}`),
    ...(["background", "surface"] as const).map((k) => `.fill-${k}{fill:${COLOURS[k]}}`),
    ...(["background", "surface", "border", "ink"] as const).map(
        (k) => `.stroke-${k}{stroke:${COLOURS[k]}}`,
    ),
    ".fill-current{fill:currentColor}",
].join("");

/** How tall the drawing is in the picture, in pixels: the picture's height less its margins. */
const DRAWN_HEIGHT = 502;

/** The share picture for the system at `slug`. */
export function systemImage(slug: Slug) {
    const system = SYSTEMS.find((s) => s.slug === slug)!;
    const { width, height, figure } = stillSystem(slug);
    const scale = DRAWN_HEIGHT / height;
    const svg = svgMarkup(
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${width} ${height}`}
            width={width * scale}
            height={DRAWN_HEIGHT}
            className="text-ink-muted"
        >
            <style>{STYLE}</style>
            {figure}
        </svg>,
    );
    return shareImage({
        eyebrow: SERIES,
        title: system.name,
        text: system.text,
        picture: (
            // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain elements only
            <img
                src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`}
                alt=""
                width={width * scale}
                height={DRAWN_HEIGHT}
            />
        ),
    });
}

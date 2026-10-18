import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { SVG } from "@mathjax/src/js/output/svg.js";

import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/color/ColorConfiguration.js";

import { MathJaxNewcmFont } from "@mathjax/mathjax-newcm-font/js/svg.js";

// The font's less-used characters come in separate ranges, loaded here up front so typesetting needn't wait.
import "@mathjax/mathjax-newcm-font/js/svg/dynamic/script.js"; // ℓ

/*
 * TeX typeset by MathJax into SVG drawn in `currentColor`. `tex.tsx` does it on the server, so the page gets finished
 * maths; the visual introduction's details do it in the browser, as their numbers change.
 */

// MathJax still asks to load the ranges imported above; they're already in place.
const IMPORTED_RANGES = ["script"];
mathjax.asyncLoad = (name: string) =>
    IMPORTED_RANGES.some((range) => name.endsWith(`/svg/dynamic/${range}.js`))
        ? Promise.resolve()
        : Promise.reject(new Error(`MathJax needs ${name}: import it in typeset.ts`));

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document("", {
    InputJax: new TeX({ packages: ["base", "ams", "color"] }),
    OutputJax: new SVG({ fontCache: "local", fontData: MathJaxNewcmFont }),
});

/** The SVG for some TeX. */
export function svgFor(tex: string, display: boolean): string {
    try {
        // Its container holds one SVG for displayed maths, but one for each piece inline maths can break between.
        return adaptor.innerHTML(doc.convert(tex, { display }));
    } catch (e) {
        // MathJax asks to retry once it's loaded a font range it lacks: it needs importing above.
        throw new Error(
            `MathJax couldn't typeset ${tex}; it may need another font range imported in typeset.ts`,
            {
                cause: e,
            },
        );
    }
}

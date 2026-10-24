import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { STATE } from "@mathjax/src/js/core/MathItem.js";
import { SerializedMmlVisitor } from "@mathjax/src/js/core/MmlTree/SerializedMmlVisitor.js";
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
 * TeX typeset by MathJax on the server, into SVG drawn in `currentColor`: the page gets finished maths, and the
 * browser never loads MathJax. Screen readers get the same maths as MathML, hidden from sight, in place of the SVG.
 */

// MathJax still asks to load the ranges imported above; they're already in place.
const IMPORTED_RANGES = ["script"];
mathjax.asyncLoad = (name: string) =>
    IMPORTED_RANGES.some((range) => name.endsWith(`/svg/dynamic/${range}.js`))
        ? Promise.resolve()
        : Promise.reject(new Error(`MathJax needs ${name}: import it in tex.tsx`));

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document("", {
    InputJax: new TeX({ packages: ["base", "ams", "color"] }),
    OutputJax: new SVG({ fontCache: "local", fontData: MathJaxNewcmFont }),
});

// Even with a range imported, MathJax only takes it up after asking for it, which it does asynchronously the first
// time a character from it is typeset. Typeset one from each range now, so every typesetting after is synchronous.
await mathjax.handleRetriesFor(() => doc.convert("\\ell", { display: false }));

/** The SVG for some TeX. */
function svgFor(tex: string, display: boolean): string {
    try {
        // Its container holds one SVG for displayed maths, but one for each piece inline maths can break between.
        return adaptor.innerHTML(doc.convert(tex, { display }));
    } catch (e) {
        // MathJax asks to retry once it's loaded a font range it lacks: it needs importing above.
        throw new Error(
            `MathJax couldn't typeset ${tex}; it may need another font range imported in tex.tsx`,
            {
                cause: e,
            },
        );
    }
}

const mathml = new SerializedMmlVisitor();

/** The MathML for some TeX, for screen readers. */
function mathmlFor(tex: string, display: boolean): string {
    // Less the TeX MathJax notes on each element, which no screen reader needs.
    return mathml
        .visitTree(doc.convert(tex, { display, end: STATE.CONVERT }))
        .replace(/ data-[\w-]+="[^"]*"/g, "");
}

/** Inline maths, in a line of text. */
export function M(props: { tex: string }) {
    return (
        <span>
            <span
                aria-hidden
                className="[&>svg]:inline"
                dangerouslySetInnerHTML={{ __html: svgFor(props.tex, false) }}
            />
            <span
                className="sr-only"
                dangerouslySetInnerHTML={{ __html: mathmlFor(props.tex, false) }}
            />
        </span>
    );
}

/** Displayed maths, on its own line(s), scrolling sideways if it's too wide. */
export function Eq(props: { tex: string }) {
    return (
        <div className="overflow-x-auto py-1 text-center text-ink-soft">
            <div
                aria-hidden
                className="[&>svg]:inline-block"
                dangerouslySetInnerHTML={{ __html: svgFor(props.tex, true) }}
            />
            <div
                className="sr-only"
                dangerouslySetInnerHTML={{ __html: mathmlFor(props.tex, true) }}
            />
        </div>
    );
}

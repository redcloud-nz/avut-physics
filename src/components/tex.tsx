import { svgFor } from "./typeset";

/*
 * TeX typeset by MathJax on the server, into SVG drawn in `currentColor`: the page gets finished maths, and the
 * browser never loads MathJax.
 */

/** Inline maths, in a line of text. */
export function M(props: { tex: string }) {
    return (
        <span
            aria-label={props.tex}
            className="[&>svg]:inline"
            dangerouslySetInnerHTML={{ __html: svgFor(props.tex, false) }}
        />
    );
}

/** Displayed maths, on its own line(s), scrolling sideways if it's too wide. */
export function Eq(props: { tex: string }) {
    return (
        <div
            aria-label={props.tex}
            className="overflow-x-auto py-1 text-center text-slate-300 [&>svg]:inline-block"
            dangerouslySetInnerHTML={{ __html: svgFor(props.tex, true) }}
        />
    );
}

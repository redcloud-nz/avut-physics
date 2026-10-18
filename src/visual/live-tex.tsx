"use client";

import { Suspense, use, useMemo } from "react";

/*
 * Maths in a page's details, typeset in the browser so it can show the figure's live numbers. MathJax is big, so it
 * only loads on a page that has some.
 */

let loading: Promise<typeof import("@/components/typeset")> | undefined;
const load = () => (loading ??= import("@/components/typeset"));

/** An arrow's colour in TeX, to tie a number in the maths to its arrow. */
export const ink = (color: string, tex: string) => `\\textcolor{${color}}{${tex}}`;

/** Displayed maths, on its own line, scrolling sideways if it's too wide. */
export function LiveEq(props: { tex: string }) {
    return (
        <Suspense fallback={<div className="h-8" />}>
            <Typeset tex={props.tex} />
        </Suspense>
    );
}

function Typeset(props: { tex: string }) {
    const { svgFor } = use(load());
    const svg = useMemo(() => svgFor(props.tex, true), [svgFor, props.tex]);
    return (
        <div
            aria-label={props.tex}
            className="overflow-x-auto py-1 text-center text-slate-300 [&>svg]:inline-block"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}

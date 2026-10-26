/**
 * The pieces a rope is drawn with (see `picture-drawing.tsx` in the knot editor): a stretch of rope as a tube with an
 * outline, its sheath's weave and a highlight along the top, and the tape round its end, so it's plain which end it is.
 * A stretch redrawn over the rope has square ends, picks up the weave where the rope underneath has it, and stops its
 * outline just short of its ends, so it joins the rope without a seam.
 */

import { svgNumber, svgPoint } from "@/lib/svg-path";

import { centreline, type RopePath } from "./rope-path";

export type RopeColors = { body: string; weave: string; highlight: string; outline: string };

/** How long the tape round the end is (rope widths). */
const TAPE_LENGTH = 1.2;

/** How far short of a redrawn segment's ends its outline stops (rope widths). */
const TRIM = 0.1;

/**
 * One stretch of rope along path data `d`: outline, body, weave and highlight, the weave `offset` along. Given
 * its `length`, the outline stops a little short of each end: the rope underneath already has it there, and a
 * square end's anti-aliased edge would otherwise leave a faint dark line across the rope. Its `width` is the rope's,
 * 1 by default; every width and dash scales with it.
 */
export function Stretch(props: {
    d: string;
    offset: number;
    length?: number;
    colors: RopeColors;
    width?: number;
}) {
    const { d, colors, width = 1 } = props;
    const trim = TRIM * width;
    const [offset, length] = [svgNumber(props.offset), props.length && svgNumber(props.length)];
    const common = {
        d,
        fill: "none",
        strokeLinejoin: "round" as const,
        strokeLinecap: "butt" as const,
    };
    return (
        <>
            <path
                {...common}
                stroke={colors.outline}
                strokeWidth={1.25 * width}
                strokeDasharray={length ? `${length - 2 * trim} ${length}` : undefined}
                strokeDashoffset={length ? -trim : undefined}
            />
            <path {...common} stroke={colors.body} strokeWidth={width} />
            <path
                {...common}
                stroke={colors.weave}
                strokeOpacity={0.3}
                strokeWidth={0.8 * width}
                strokeDasharray={`${0.15 * width} ${0.2 * width}`}
                strokeDashoffset={offset}
            />
            <path
                {...common}
                stroke={colors.highlight}
                strokeOpacity={0.55}
                strokeWidth={0.22 * width}
            />
        </>
    );
}

/**
 * The tape round a rope's end, drawn over the rope's last stretch: along its centreline, back from the end, so it
 * bends with the rope where the end's curved rather than standing off it in a straight line. Its `width` is the
 * rope's, 1 by default.
 */
export function Tape(props: { path: RopePath; colors: RopeColors; width?: number }) {
    const { width = 1 } = props;
    const { points } = centreline(props.path);
    const along = [points[points.length - 1]];
    const tape = TAPE_LENGTH * width;
    let left = tape;
    for (let i = points.length - 1; i > 0 && left > 0; i--) {
        const [a, b] = [points[i - 1], points[i]];
        const step = a.distanceTo(b);
        if (step >= left) {
            along.push(b.add(a.sub(b).scale(left / step)));
            left = 0;
        } else {
            along.push(a);
            left -= step;
        }
    }
    along.reverse();
    return (
        <Stretch
            d={`M ${svgPoint(along[0])} ${along
                .slice(1)
                .map((p) => `L ${svgPoint(p)}`)
                .join(" ")}`}
            offset={0}
            length={tape - left}
            colors={props.colors}
            width={width}
        />
    );
}

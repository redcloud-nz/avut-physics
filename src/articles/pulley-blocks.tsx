import { svgPoint } from "@/lib/svg-path";
import { vec2, type Vector2 } from "@/lib/vector2";

/*
 * Pulleys drawn as they look, a start towards drawings closer to real rigging than the lanes in pulley-figures.tsx.
 * Drawing units are SVG's, y down.
 */

/**
 * A double's two sheaves' radii: drawn side on, one larger than the other, so both show on the one axle. (A real
 * double's are the same size, side by side along the axle, where one would hide the other.)
 */
const SHEAVES = [24, 15];
/** How much plate there is round everything: past the larger sheave, and round the eye and the becket's holes. */
const MATERIAL = 6;
/**
 * The eye's and the becket's holes' radii. The eye sits `MATERIAL` clear of the larger sheave; the becket a little
 * further, `TAB_REACH`, so its tab stands out from the plate.
 */
const EYE = 12;
const BECKET = 6;
const TAB_REACH = 5;
const EYE_Y = -(SHEAVES[0] + MATERIAL + EYE);
const BECKET_Y = SHEAVES[0] + MATERIAL + BECKET + TAB_REACH;
/** The radius of the plate's bottom corners. */
const CORNER = 4;

/** A circle as a closed subpath, so with the even-odd rule it cuts a hole in the shape it's part of. */
const hole = (cy: number, r: number) =>
    `M ${-r} ${cy} A ${r} ${r} 0 1 0 ${r} ${cy} A ${r} ${r} 0 1 0 ${-r} ${cy} Z`;

/**
 * The middle plate round the axle, with `MATERIAL` round everything. Above the axle it narrows from round the larger
 * sheave to round the eye, along straight edges touching both. Below, it's square with rounded corners, and a tab sticking out for the
 * becket, its end round the becket's hole.
 */
const PLATE = (() => {
    const mid = SHEAVES[0] + MATERIAL;
    const eye = EYE + MATERIAL;
    const tab = BECKET + MATERIAL;
    // Where the straight edge from round the eye to round the sheave touches each: at the same angle on both.
    const sine = (eye - mid) / -EYE_Y;
    const cosine = Math.sqrt(1 - sine * sine);
    const p = (x: number, y: number) => svgPoint(vec2(x, y));
    return [
        `M ${p(-eye * cosine, EYE_Y + eye * sine)}`,
        `A ${eye} ${eye} 0 0 1 ${p(eye * cosine, EYE_Y + eye * sine)}`,
        `L ${p(mid * cosine, mid * sine)}`,
        `A ${mid} ${mid} 0 0 1 ${p(mid, 0)}`,
        `L ${p(mid, mid - CORNER)} A ${CORNER} ${CORNER} 0 0 1 ${p(mid - CORNER, mid)}`,
        `L ${p(tab, mid)} L ${p(tab, BECKET_Y)}`,
        `A ${tab} ${tab} 0 0 1 ${p(-tab, BECKET_Y)}`,
        `L ${p(-tab, mid)} L ${p(-mid + CORNER, mid)}`,
        `A ${CORNER} ${CORNER} 0 0 1 ${p(-mid, mid - CORNER)} L ${p(-mid, 0)}`,
        `A ${mid} ${mid} 0 0 1 ${p(-mid * cosine, mid * sine)} Z`,
        hole(EYE_Y, EYE),
        hole(BECKET_Y, BECKET),
    ].join(" ");
})();

/**
 * A double pulley side on: its middle plate, with the eye at the top for its sling and the becket below for tying a
 * rope to, and its two sheaves on one axle in front, the larger behind the smaller. `becket` says which way
 * the becket points: "up" or "down".
 */
export function DoublePulley(props: { at: Vector2; becket: "up" | "down" }) {
    const flip = props.becket === "down" ? 1 : -1;
    return (
        <g transform={`translate(${props.at.x} ${props.at.y}) scale(1 ${flip})`}>
            <path d={PLATE} fillRule="evenodd" className="fill-surface" />
            <path
                d={PLATE}
                fillRule="evenodd"
                fill="currentColor"
                fillOpacity={0.18}
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinejoin="round"
            />
            {SHEAVES.map((r, i) => (
                <g key={i}>
                    <circle r={r} className="fill-background" />
                    <circle
                        r={r}
                        fill="currentColor"
                        fillOpacity={0.3 + 0.15 * i}
                        stroke="currentColor"
                        strokeWidth={1.5}
                    />
                    {/* The groove the rope runs in. */}
                    <circle
                        r={r - 4}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1}
                        opacity={0.5}
                    />
                </g>
            ))}
            {/* The axle's bolt. */}
            <circle r={7} className="fill-background" />
            <circle r={7} fill="currentColor" fillOpacity={0.7} />
            <circle r={4} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.6} />
        </g>
    );
}

/** Where a double pulley's eye and becket are, for slings and ropes to reach: the middles of their holes. */
export function doubleEnds(at: Vector2, becket: "up" | "down") {
    const flip = becket === "down" ? 1 : -1;
    return { eye: at.add(vec2(0, EYE_Y * flip)), becket: at.add(vec2(0, BECKET_Y * flip)) };
}

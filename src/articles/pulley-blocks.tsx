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
const SHEAVES = [27, 16];
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
export function DoublePulley(props: {
    at: Vector2;
    becket: "up" | "down";
    /**
     * Just one part of it, for a rope to go between: the plate, the larger sheave or the smaller one (with the axle's
     * bolt). All of it if not given.
     */
    part?: "plate" | "large" | "small";
}) {
    const flip = props.becket === "down" ? 1 : -1;
    const shows = (part: string) => !props.part || props.part === part;
    return (
        <g transform={`translate(${props.at.x} ${props.at.y}) scale(1 ${flip})`}>
            {shows("plate") && (
                <>
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
                </>
            )}
            {SHEAVES.map(
                (r, i) =>
                    shows(i === 0 ? "large" : "small") && (
                        <g key={i}>
                            <circle r={r} className="fill-background" />
                            <circle
                                r={r}
                                fill="currentColor"
                                fillOpacity={0.3 + 0.15 * i}
                                stroke="currentColor"
                                strokeWidth={1.5}
                            />
                        </g>
                    ),
            )}
            {shows("small") && (
                <>
                    {/* The axle's bolt. */}
                    <circle r={7} className="fill-background" />
                    <circle r={7} fill="currentColor" fillOpacity={0.7} />
                    <circle r={4} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.6} />
                </>
            )}
        </g>
    );
}

/**
 * Where a double pulley's eye and becket are, for ropes to reach: the middles of their holes. `clip` is where a
 * carabiner through the eye has its end: as far into the hole as it reaches into a tab's, where it's centred.
 */
export function doubleEnds(at: Vector2, becket: "up" | "down") {
    const flip = becket === "down" ? 1 : -1;
    const eye = at.add(vec2(0, EYE_Y * flip));
    return {
        eye,
        clip: eye.add(vec2(0, -(EYE - TAB_HOLE) * flip)),
        becket: at.add(vec2(0, BECKET_Y * flip)),
    };
}

/** A tab's hole's radius, and how much there is round it. */
const TAB_HOLE = 6;
const TAB_MATERIAL = 6;

/**
 * A tab sticking out from `base` (a height: an anchor's face, the top of a load) with a hole at `hole` for a carabiner,
 * its end round the hole. Drawn like a pulley's plate.
 */
export function Tab(props: { hole: Vector2; base: number }) {
    const { hole, base } = props;
    const w = TAB_HOLE + TAB_MATERIAL;
    const p = (x: number, y: number) => svgPoint(vec2(hole.x + x, y));
    const d = [
        `M ${p(-w, base)} L ${p(-w, hole.y)}`,
        `A ${w} ${w} 0 0 ${base < hole.y ? 0 : 1} ${p(w, hole.y)} L ${p(w, base)} Z`,
        `M ${p(-TAB_HOLE, hole.y)} A ${TAB_HOLE} ${TAB_HOLE} 0 1 0 ${p(TAB_HOLE, hole.y)}`,
        `A ${TAB_HOLE} ${TAB_HOLE} 0 1 0 ${p(-TAB_HOLE, hole.y)} Z`,
    ].join(" ");
    return (
        <>
            <path d={d} fillRule="evenodd" className="fill-surface" />
            <path
                d={d}
                fillRule="evenodd"
                fill="currentColor"
                fillOpacity={0.18}
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinejoin="round"
            />
        </>
    );
}

/** A carabiner's rod's diameter: a little thicker than the rope. */
const ROD = 5;

/**
 * A carabiner seen edge on, its gate hidden behind its spine: a round rod between the middles of its ends (`ends`),
 * each in a hole it clips through, so its rounded end shows there. Its front half passes over the plates, so draw it
 * over them.
 */
export function Carabiner(props: { ends: [Vector2, Vector2] }) {
    const [a, b] = props.ends;
    const d = `M ${svgPoint(a)} L ${svgPoint(b)}`;
    return (
        <>
            <path d={d} stroke="currentColor" strokeWidth={ROD} strokeLinecap="round" />
            <path d={d} className="stroke-surface" strokeWidth={ROD - 2} strokeLinecap="round" />
            <path
                d={d}
                stroke="currentColor"
                strokeOpacity={0.4}
                strokeWidth={ROD - 2}
                strokeLinecap="round"
            />
        </>
    );
}

/**
 * A double's sheaves, by size: the larger and the smaller, each a centre, a radius (the rope runs on its rim, half
 * hidden behind it) and a layer, the smaller's in front.
 */
export const doubleSheaves = (at: Vector2) => ({
    large: { c: at, r: SHEAVES[0], layer: 0 },
    small: { c: at, r: SHEAVES[1], layer: 1 },
});

/**
 * Somewhere a rope goes: round a sheave (a centre and radius), arriving on one side and leaving on the other, −1 its
 * left and 1 its right as the drawing shows it; or to a point, with radius 0, where it's tied or leaves the drawing.
 */
export type RopeStop = { c: Vector2; r: number; into?: -1 | 1; out?: -1 | 1; layer?: number };

/**
 * The straight part of a rope from one stop to the next: the line touching both, on the sides they ask for. Each
 * centre sits a signed distance from the line, ±its radius; of the four lines that touch both, take the one whose
 * touching points are on the right sides.
 */
function tangent(a: RopeStop, b: RopeStop): [Vector2, Vector2] {
    const d = b.c.sub(a.c);
    const u = d.scale(1 / d.len());
    const n = vec2(-u.y, u.x);
    const ok = (s: RopeStop, side: -1 | 1 | undefined, p: Vector2) =>
        !side || s.r === 0 || Math.sign(p.x - s.c.x) === side;
    for (const ra of a.r ? [a.r, -a.r] : [0]) {
        for (const rb of b.r ? [b.r, -b.r] : [0]) {
            const along = (rb - ra) / d.len();
            const m = u.scale(along).add(n.scale(Math.sqrt(1 - along * along)));
            const p = a.c.sub(m.scale(ra));
            const q = b.c.sub(m.scale(rb));
            if (ok(a, a.out, p) && ok(b, b.into, q)) return [p, q];
        }
    }
    throw new Error("No line touches both stops on the sides asked for");
}

/**
 * A rope through `stops` in order, as pieces of path data to draw each behind the sheave it's on: straight between
 * stops, and round each sheave between them the way it was going as it arrived.
 */
export function ropePieces(stops: RopeStop[]): { d: string; layer: number }[] {
    const parts = stops.slice(1).map((s, i) => tangent(stops[i], s));
    // A straight part between sheaves in different layers goes behind each for its own half.
    const pieces = parts.flatMap(([p, q], i) => {
        const [a, b] = [stops[i], stops[i + 1]];
        const [la, lb] = [a.layer ?? b.layer ?? 0, b.layer ?? a.layer ?? 0];
        const line = (from: Vector2, to: Vector2, layer: number) => ({
            d: `M ${svgPoint(from)} L ${svgPoint(to)}`,
            layer,
        });
        return la === lb ? [line(p, q, la)] : [line(p, p.mid(q), la), line(p.mid(q), q, lb)];
    });
    for (let i = 1; i < parts.length; i++) {
        const { c, r, layer = 0 } = stops[i];
        const [from, to] = [parts[i - 1][1], parts[i][0]];
        const travel = from.sub(parts[i - 1][0]);
        const sweep = from.sub(c).cross(travel) > 0 ? 1 : 0;
        // How far round the sheave, the way it turns.
        let turn = to.sub(c).angle() - from.sub(c).angle();
        if (sweep && turn < 0) turn += 2 * Math.PI;
        if (!sweep && turn > 0) turn -= 2 * Math.PI;
        const large = Math.abs(turn) > Math.PI ? 1 : 0;
        pieces.push({
            d: `M ${svgPoint(from)} A ${r} ${r} 0 ${large} ${sweep} ${svgPoint(to)}`,
            layer,
        });
    }
    return pieces;
}

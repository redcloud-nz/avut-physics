import { svgNumber, svgPoint } from "@/lib/svg-path";
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
 * Faint marks on a sheave, so it shows turning: a few short arcs round the part of it that shows, between `inner`
 * (what's in front of it, the smaller sheave or the bolt) and its rim, `outer`, clear of the rope that runs there.
 */
function sheaveMarks(inner: number, outer: number) {
    const ring = (inner + outer - 2) / 2;
    const count = 3;
    const span = Math.PI / 4;
    const at = (a: number) => svgPoint(vec2(Math.cos(a), Math.sin(a)).scale(ring));
    return Array.from({ length: count }, (_, k) => {
        const a = (2 * Math.PI * k) / count;
        return `M ${at(a)} A ${ring} ${ring} 0 0 1 ${at(a + span)}`;
    }).join(" ");
}

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
    /** How far each sheave has turned, in degrees clockwise as drawn. */
    spins?: { large: number; small: number };
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
                            <g
                                transform={`rotate(${svgNumber(flip * (props.spins?.[i === 0 ? "large" : "small"] ?? 0))})`}
                            >
                                <path
                                    d={sheaveMarks(i === 0 ? SHEAVES[1] : 7, r)}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeOpacity={0.35}
                                    strokeWidth={1.5}
                                    strokeLinecap="round"
                                />
                            </g>
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

/** A piece of a rope: its path data, the layer it's drawn in, and how far along the rope from its first end it starts. */
export type RopePiece = {
    d: string;
    layer: number;
    start: number;
    /** How long it is along the rope's middle. */
    length: number;
    /**
     * Path data for a line along it `offset` to the right of its middle (as it runs), to draw the rope's surface on:
     * it's as long as the middle is, with `pathLength`, so patterns along it keep step with the middle's.
     */
    lane: (offset: number) => string;
};

/** A direction a quarter turn clockwise as drawn from `dir`, a unit long: to the right of something running along it. */
const right = (dir: Vector2) => vec2(-dir.y, dir.x).scale(1 / dir.len());

/**
 * A rope through `stops` in order, as pieces of path data to draw each behind the sheave it's on: straight between
 * stops, and round each sheave between them the way it was going as it arrived. With them, how far each stop's sheave
 * has turned (degrees, clockwise as drawn): the rope can't slip on it, so its rim turns with the rope. The rope's first
 * end is tied, so a point on the rope stays the same distance along it from there; as the rope ahead of a sheave
 * shortens, the rope runs on round it.
 */
export function ropePieces(stops: RopeStop[]): { pieces: RopePiece[]; spins: number[] } {
    const parts = stops.slice(1).map((s, i) => tangent(stops[i], s));
    const pieces: RopePiece[] = [];
    const spins = stops.map(() => 0);
    let along = 0;
    const line = (from: Vector2, to: Vector2, layer: number) => {
        const side = right(to.sub(from));
        const length = from.distanceTo(to);
        pieces.push({
            d: `M ${svgPoint(from)} L ${svgPoint(to)}`,
            layer,
            start: along,
            length,
            lane: (offset) => {
                const by = side.scale(offset);
                return `M ${svgPoint(from.add(by))} L ${svgPoint(to.add(by))}`;
            },
        });
        along += length;
    };
    parts.forEach(([p, q], i) => {
        // A straight part between sheaves in different layers goes behind each for its own half.
        const [a, b] = [stops[i], stops[i + 1]];
        const [la, lb] = [a.layer ?? b.layer ?? 0, b.layer ?? a.layer ?? 0];
        if (la === lb) line(p, q, la);
        else {
            line(p, p.mid(q), la);
            line(p.mid(q), q, lb);
        }
        if (i + 1 === parts.length) return;
        const { c, r, layer = 0 } = b;
        const [from, to] = [q, parts[i + 1][0]];
        const sweep = from.sub(c).cross(q.sub(p)) > 0 ? 1 : 0;
        // How far round the sheave, the way it turns.
        let turn = to.sub(c).angle() - from.sub(c).angle();
        if (sweep && turn < 0) turn += 2 * Math.PI;
        if (!sweep && turn > 0) turn -= 2 * Math.PI;
        const large = Math.abs(turn) > Math.PI ? 1 : 0;
        const [into, out] = [right(q.sub(p)), right(parts[i + 1][1].sub(to))];
        const arc = (from: Vector2, to: Vector2) => {
            const radius = svgNumber(from.distanceTo(c));
            return `M ${svgPoint(from)} A ${radius} ${radius} 0 ${large} ${sweep} ${svgPoint(to)}`;
        };
        pieces.push({
            d: arc(from, to),
            layer,
            start: along,
            length: Math.abs(turn) * r,
            lane: (offset) => arc(from.add(into.scale(offset)), to.add(out.scale(offset))),
        });
        // The less rope there is before the sheave, the further round it's run, the way the rope goes.
        spins[i + 1] = (((sweep ? -1 : 1) * along) / r) * (180 / Math.PI);
        along += Math.abs(turn) * r;
    });
    return { pieces, spins };
}

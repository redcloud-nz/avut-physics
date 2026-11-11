import { svgNumber, svgPoint } from "@/lib/svg-path";
import { vec2, type Vector2 } from "@/lib/vector2";

/*
 * Pulleys drawn as they look, a start towards drawings closer to real rigging than the lanes in pulley-figures.tsx.
 * Drawing units are SVG's, y down.
 */

/**
 * A pulley's sheaves' radii: a single's is the first, and a double has both. Drawn side on, a double's are different
 * sizes, so both show on the one axle. (A real double's are the same size, side by side along the axle, where one would
 * hide the other.)
 */
const SHEAVES = [16, 11.5];
/** How much plate there is round everything: past the larger sheave, and round the eye and the becket's holes. */
const MATERIAL = 3.5;
/**
 * The eye's and the becket's holes' radii. The eye sits `MATERIAL` clear of the larger sheave; the becket a little
 * further, `TAB_REACH`, so its tab stands out from the plate.
 */
const EYE = 6.5;
const BECKET = 4;
const TAB_REACH = 3;
const EYE_Y = -(SHEAVES[0] + MATERIAL + EYE);
const BECKET_Y = SHEAVES[0] + MATERIAL + BECKET + TAB_REACH;
/** The radius of the plate's bottom corners. */
const CORNER = 2;
/** The axle's bolt's radius, and its hole's. */
const BOLT = 4;
const BOLT_HOLE = 2;

/** A circle as a closed subpath, so with the even-odd rule it cuts a hole in the shape it's part of. */
const hole = (cy: number, r: number) =>
    `M ${-r} ${cy} A ${r} ${r} 0 1 0 ${r} ${cy} A ${r} ${r} 0 1 0 ${-r} ${cy} Z`;

/**
 * The middle plate round the axle, with `MATERIAL` round everything, its eye up. Above the axle it narrows from round
 * the larger sheave to round the eye, along straight edges touching both. Below, it's square with rounded corners, with
 * a tab sticking out for the becket if it has one, its end round the becket's hole.
 */
function plate(becket: boolean) {
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
        ...(becket
            ? [
                  `L ${p(tab, mid)} L ${p(tab, BECKET_Y)}`,
                  `A ${tab} ${tab} 0 0 1 ${p(-tab, BECKET_Y)}`,
                  `L ${p(-tab, mid)}`,
              ]
            : []),
        `L ${p(-mid + CORNER, mid)}`,
        `A ${CORNER} ${CORNER} 0 0 1 ${p(-mid, mid - CORNER)} L ${p(-mid, 0)}`,
        `A ${mid} ${mid} 0 0 1 ${p(-mid * cosine, mid * sine)} Z`,
        hole(EYE_Y, EYE),
        ...(becket ? [hole(BECKET_Y, BECKET)] : []),
    ].join(" ");
}

const PLATES = { single: plate(false), double: plate(true) };

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

/** Which way a pulley's eye points, where it's clipped to what holds it: up or down. */
export type EyeWay = "up" | "down";

/**
 * A pulley side on: its middle plate, with the eye for its carabiner, and its sheaves on one axle in front. A single
 * has one sheave; a double two, the larger behind the smaller, and a becket opposite the eye for tying a rope to.
 */
export function Pulley(props: {
    at: Vector2;
    eye: EyeWay;
    sheaves: 1 | 2;
    /**
     * Just one part of it, for a rope to go between: the plate, the larger sheave or the smaller one. The axle's bolt
     * goes with the front one. All of it if not given.
     */
    part?: "plate" | "large" | "small";
    /** How far each sheave has turned, in degrees clockwise as drawn. */
    spins?: { large: number; small?: number };
}) {
    const flip = props.eye === "up" ? 1 : -1;
    const shows = (part: string) => !props.part || props.part === part;
    const d = props.sheaves === 2 ? PLATES.double : PLATES.single;
    const front = props.sheaves === 2 ? "small" : "large";
    return (
        <g transform={`translate(${props.at.x} ${props.at.y}) scale(1 ${flip})`}>
            {shows("plate") && (
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
            )}
            {SHEAVES.slice(0, props.sheaves).map((r, i) => {
                const which = i === 0 ? "large" : "small";
                const inner = which === front ? BOLT : SHEAVES[1];
                return (
                    shows(which) && (
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
                                transform={`rotate(${svgNumber(flip * (props.spins?.[which] ?? 0))})`}
                            >
                                <path
                                    d={sheaveMarks(inner, r)}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeOpacity={0.35}
                                    strokeWidth={1.5}
                                    strokeLinecap="round"
                                />
                            </g>
                        </g>
                    )
                );
            })}
            {shows(front) && (
                <>
                    {/* The axle's bolt. */}
                    <circle r={BOLT} className="fill-background" />
                    <circle r={BOLT} fill="currentColor" fillOpacity={0.7} />
                    <circle
                        r={BOLT_HOLE}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1}
                        opacity={0.6}
                    />
                </>
            )}
        </g>
    );
}

/**
 * Where a pulley's eye and becket are, for ropes to reach: the middles of their holes. `clip` is where a carabiner
 * through the eye has its end: as far into the hole as it reaches into a tab's, where it's centred.
 */
export function pulleyEnds(at: Vector2, eye: EyeWay) {
    const flip = eye === "up" ? 1 : -1;
    const middle = at.add(vec2(0, EYE_Y * flip));
    return {
        eye: middle,
        clip: middle.add(vec2(0, -(EYE - TAB_HOLE) * flip)),
        becket: at.add(vec2(0, BECKET_Y * flip)),
    };
}

/** Where a pulley is whose eye is clipped at `clip`: the other way round from `pulleyEnds`. */
export const pulleyClippedAt = (clip: Vector2, eye: EyeWay) =>
    clip.sub(pulleyEnds(vec2(0, 0), eye).clip);

/**
 * A pulley's sheaves, by size: the larger and the smaller, each a centre, a radius (the rope runs on its rim, half
 * hidden behind it) and a layer, the smaller's in front. A single has just the larger.
 */
export const pulleySheaves = (at: Vector2) => ({
    large: { c: at, r: SHEAVES[0], layer: 0 },
    small: { c: at, r: SHEAVES[1], layer: 1 },
});

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

/** How far the rope's eye reaches past what it's round, and how long its splice is. */
const EYE_REACH = 8;
const SPLICE = 18;

/**
 * A rope's end spliced into an eye round a carabiner's end (`end`, the middle of its rod there), leading off towards
 * `next`, its first stop, for a rope `rope` thick. The eye is a loop of rope round the rod, closing to a throat; past it the splice, where the
 * end is buried back into the rope, tapering smoothly from the eye's sides to the rope. `stop` is where the rope's plain part starts,
 * for its first stop; `eye` and `splice` are path data for the loop (stroked as rope) and the splice (filled, over
 * the loop).
 */
export function ropeEye(end: Vector2, next: RopeStop, rope: number) {
    const [p, q] = tangent({ c: end, r: 0 }, next);
    const u = q.sub(p).scale(1 / q.distanceTo(p));
    const a = (ROD + rope) / 2;
    const throat = end.add(u.scale(a + EYE_REACH));
    const start = throat.add(u.scale(SPLICE));
    // The eye's sides touch the circle round the rod, leaving it at this angle either side of the way to the throat.
    const spread = Math.acos(a / (a + EYE_REACH));
    const turned = (angle: number) =>
        vec2(
            u.x * Math.cos(angle) - u.y * Math.sin(angle),
            u.x * Math.sin(angle) + u.y * Math.cos(angle),
        ).scale(a);
    const eye = [
        `M ${svgPoint(throat)} L ${svgPoint(end.add(turned(spread)))}`,
        `A ${svgNumber(a)} ${svgNumber(a)} 0 1 1 ${svgPoint(end.add(turned(-spread)))} Z`,
    ].join(" ");
    // The splice takes over from the eye's two sides just before they meet, as wide as their outer edges there, and
    // narrows to the rope along curves leaving them the way they run and arriving along the rope, so it has no shoulder.
    // Its top is across the sides, which overlap there, so drawn over them it covers where they meet.
    const along = throat.sub(end.add(turned(spread)));
    const lean = Math.abs(along.cross(u)) / Math.abs(along.dot(u));
    const back = 4.5;
    const top = throat.sub(u.scale(back));
    const half = back * lean + (rope / 2) * Math.sqrt(1 + lean * lean);
    const side = right(u);
    const reach = SPLICE / 2;
    const edge = (sign: number) => {
        const out = side.scale(sign);
        return {
            from: top.add(out.scale(half)),
            c1: top.add(out.scale(half)).add(u.add(out.scale(-lean)).scale(reach / 2)),
            c2: start.add(out.scale(rope / 2)).sub(u.scale(reach)),
            to: start.add(out.scale(rope / 2)),
        };
    };
    const [r, l] = [edge(1), edge(-1)];
    const splice = [
        `M ${svgPoint(r.from)}`,
        `C ${svgPoint(r.c1)} ${svgPoint(r.c2)} ${svgPoint(r.to)}`,
        `L ${svgPoint(l.to)}`,
        `C ${svgPoint(l.c2)} ${svgPoint(l.c1)} ${svgPoint(l.from)} Z`,
    ].join(" ");
    return {
        stop: { c: start, r: 0 } satisfies RopeStop,
        eye,
        splice,
    };
}

/** A Prusik loop's cord's thickness, and how many times it shows wrapped round the rope (three wraps, twice). */
const CORD = 2.5;
const WRAPS = 6;

/** A cord's path drawn with a dark edge, so where it lies against itself each part shows. */
function Cord(props: { d: string; width?: number; cap?: "round" | "butt" }) {
    const width = props.width ?? CORD;
    const cap = props.cap ?? "round";
    return (
        <>
            <path
                d={props.d}
                className="stroke-background"
                strokeWidth={width + 1}
                strokeLinecap={cap}
                strokeLinejoin="round"
            />
            <path
                d={props.d}
                stroke="currentColor"
                strokeWidth={width}
                strokeLinecap={cap}
                strokeLinejoin="round"
            />
        </>
    );
}

/**
 * A Prusik loop on a rope: a loop of cord gripping the rope `rope` thick at `on` (the middle of the hitch, on the
 * rope's middle), and running to a carabiner's end at `to`, round its rod. Side on, the hitch is its wraps lying
 * straight across the rope side by side, with the bridge running along the rope over their ends on the loop's side;
 * the loop's two strands leave from the bridge's middle and close round the carabiner like a rope's eye, one of them
 * with the loop's sewn join on it. Draw it over the rope and under the carabiner.
 */
export function Prusik(props: { on: Vector2; to: Vector2; rope: number }) {
    const { on, to, rope } = props;
    const side = Math.sign(to.x - on.x) || 1;
    const w = (rope + CORD) / 2;
    const pitch = CORD + 0.5;
    const ys = Array.from({ length: WRAPS }, (_, k) => on.y + (k - (WRAPS - 1) / 2) * pitch);
    const wraps = ys
        .map((y) => `M ${svgPoint(vec2(on.x - w, y - 0.4))} L ${svgPoint(vec2(on.x + w, y + 0.4))}`)
        .join(" ");
    const bridge = vec2(on.x + side * w, 0);
    const bridgeD = `M ${svgPoint(vec2(bridge.x, ys[0]))} L ${svgPoint(vec2(bridge.x, ys[WRAPS - 1]))}`;
    // The loop: from the bridge's middle, its strands touch the circle round the rod and go round its far side.
    const throat = vec2(bridge.x, on.y);
    const a = (ROD + CORD) / 2;
    const u = throat.sub(to).scale(1 / throat.distanceTo(to));
    const spread = Math.acos(a / throat.distanceTo(to));
    const turned = (angle: number) =>
        to.add(
            vec2(
                u.x * Math.cos(angle) - u.y * Math.sin(angle),
                u.x * Math.sin(angle) + u.y * Math.cos(angle),
            ).scale(a),
        );
    const loop = [
        `M ${svgPoint(throat)} L ${svgPoint(turned(spread))}`,
        `A ${svgNumber(a)} ${svgNumber(a)} 0 1 1 ${svgPoint(turned(-spread))} Z`,
    ].join(" ");
    // The sewn join, on one strand partway along: a stiff barrel, thicker and paler, its stitching across it.
    const joinFrom = throat.lerp(turned(-spread), 0.3);
    const joinTo = throat.lerp(turned(-spread), 0.65);
    const join = `M ${svgPoint(joinFrom)} L ${svgPoint(joinTo)}`;
    return (
        <g className="text-grab" fill="none">
            <Cord d={loop} />
            <Cord d={wraps} />
            <Cord d={bridgeD} />
            <Cord d={join} width={CORD * 1.8} cap="butt" />
            <path
                d={join}
                className="stroke-ink"
                strokeOpacity={0.45}
                strokeWidth={CORD * 1.8 - 1}
            />
            <path
                d={join}
                className="stroke-background"
                strokeOpacity={0.7}
                strokeWidth={CORD}
                strokeDasharray="0.5 0.7"
            />
        </g>
    );
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

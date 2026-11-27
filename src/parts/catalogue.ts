import { FLAT_HAIRLINE, KNOT_LABELS, layoutRig, rigColor, RIGS } from "@/abseil-tower/rig";
import { towerPieces } from "@/abseil-tower/tower";
import { CHAIN_WEIGHT, chainWeightHanging, chainWeightMass } from "@/flying-fox/chain-weight";
import {
    C,
    PULLEY_COLORS,
    STOP_BLOCK_COLORS,
    TIRFOR_COLORS,
    TROLLEY_COLORS,
} from "@/flying-fox/colors";
import { foxPieces } from "@/flying-fox/fox";
import { chainWeight, chainWeightPieces } from "@/flying-fox/rig/chain-weight";
import { ANCHOR_SHACKLE } from "@/flying-fox/rig/log-anchor";
import { rigPulley } from "@/flying-fox/rig/shared";
import { SADDLE, shearLegGuyLoops, SLING_Z } from "@/flying-fox/rig/shear-leg";
import { backstayLoop, guyLoops } from "@/flying-fox/rig/tower";
import { TREE_SHACKLE } from "@/flying-fox/rig/tree";
import { rigTrolley } from "@/flying-fox/rig/trolleys";
import {
    BLOCKS_X,
    BRAKE,
    groundY,
    HAWSER_R,
    HAWSER_Z,
    LOG,
    onHawser,
    SHEAR_LEG,
    STATIC_X,
    TOWER,
    TREE,
    TROLLEY_X,
} from "@/flying-fox/site";
import { knot3dFile, knotRope } from "@/knot-editor-3d/knot-file";
import { parseKnotFile } from "@/knot-editor/knot-file";
import { KNOTS } from "@/knots";
import { middleLoop } from "@/knots/carabiner";
import MUNTER_2HH_DRAWING from "@/knots/files/munter-and-two-half-hitches.json";
import { vec3, type Vector3 } from "@/lib/vector3";
import {
    baseClamp,
    baseClampWire,
    bolt,
    carabiner,
    CARABINER_R,
    carabinerWith,
    chain,
    CHAIN_10,
    chainLink,
    eyeBolt,
    grigri,
    hangingPath,
    hook,
    pulley,
    shackle,
    sheave,
    stopBlock,
    thimble,
    tirfor,
    turnbuckle,
    wrap,
    zipTrolley,
} from "@/rigging/hardware";
import { axes, knotPieces, liftKnot, numberedRope } from "@/rigging/knot-3d";
import {
    figure8,
    munterTwoHalfHitches,
    loadReleaseHitch as tiedLoadReleaseHitch,
    tiedTo,
} from "@/rigging/knots";
import FIGURE_8_JSON from "@/rigging/knots/figure-8.json";
import MUNTER_HITCH_JSON from "@/rigging/knots/munter-hitch.json";
import { line } from "@/rigging/rope";
import { sling } from "@/rigging/slings";
import type { RigLabel } from "@/scene/pieces";
import { timber, type Piece } from "@/scene/pieces";
import { moved } from "@/scene/transforms";

/**
 * The parts the visualisations build from pieces, each on its own so it can be looked at and refined: the shared
 * hardware, and assemblies as a visualisation rigs them. A part sits about the origin, x along and y up.
 */
export type Part = {
    slug: string;
    name: string;
    /** Where it's used: the shared hardware, or the visualisation that rigs it this way. */
    group: string;
    about: string;
    pieces: () => Piece[];
    /** What's written on it, if anything. */
    labels?: () => RigLabel[];
    /** Its flat views drawn as its visualisation draws them, if they differ from the 3D pieces seen square on. */
    flat?: PartFlat;
};

/**
 * A part's own flat views, in place of the front, side and top: the `main` one it's seen from in its visualisation, and
 * an `alt` one only where it's drawn differently from another way too (the flying fox's turnbuckle looking down and
 * from the side). Its pieces are laid out for each, given the way towards the eye, and drawn as its visualisation draws
 * them: sorted by their groups and shell, and no thinner than `minWidth` (with `thinEdges`). The views needn't agree
 * with each other or the 3D view.
 */
export type PartFlat = {
    main: { azimuth: number; elevation: number };
    alt?: { azimuth: number; elevation: number };
    pieces: (toward: Vector3) => Piece[];
    minWidth?: { rope?: number; steel?: number };
    thinEdges?: boolean;
};

const ORIGIN = vec3(0, 0, 0);
const ALONG = vec3(1, 0, 0);
const UP = vec3(0, 1, 0);
const DOWN = vec3(0, -1, 0);
const ACROSS = vec3(0, 0, 1);
const STEEL = "var(--tower-steel)";
/** The chain weight with its shackle's crown `height` up, and the shackle its ring hangs on. */
const weightOnShackle = (height: number) => [
    ...chainWeightPieces(chainWeight(ORIGIN, height, ALONG), STEEL),
    ...shackle(
        "bow",
        vec3(0, height, 0),
        DOWN,
        DOWN.cross(ALONG.cross(UP)),
        STEEL,
        C.pin,
        CHAIN_WEIGHT.shackle,
    ).pieces,
];
/** How high the chain weight's shackle is at the heaviest rider's furthest push: 0.5 m at rest, lifted 4.2 m. */
const FULL_LIFT = 0.5 + 4.2;

/** A stretch of wire `half` either side of `at` along x, as the trolleys ride. */
const wire = (at: Vector3, half: number): Piece[] =>
    line([at.sub(ALONG.scale(half)), at.add(ALONG.scale(half))], HAWSER_R, C.hawser);

/** A rope round a pulley, out to `a` and `b`. */
function reeved(p: { a: Vector3; b: Vector3 }, centre: Vector3, a: Vector3, b: Vector3, r = 0.004) {
    return line([a, ...wrap(centre, p.a, p.b), b], r, C.returnLine);
}

/** A sling laid out flat on edge as an oval: its two parts `long` apart end to end, round ends `r` across. */
function slingLoop(kind: "round" | "climbing", long: number, r: number): Piece[] {
    const pts = Array.from({ length: 41 }, (_, i) => {
        const t = (2 * Math.PI * i) / 40;
        const end = Math.cos(t) >= 0 ? long / 2 - r : -(long / 2 - r);
        return vec3(end + r * Math.cos(t), 0, r * Math.sin(t));
    });
    return sling(kind, pts, UP, ORIGIN, 1, 1);
}

export const PARTS: Part[] = [
    {
        slug: "carabiner",
        name: "Carabiner",
        group: "Hardware",
        about: "A D-shape triple-lock carabiner (the CT one), traced from a photo: 110 mm from its top bend to its bottom one and 60 mm wide, the narrow top bend and the wide bottom one beside its straight spine, the gate opposite behind its red knurled locking sleeve.",
        pieces: () => carabiner(vec3(0, 0.055, 0), DOWN, ALONG, STEEL),
    },
    {
        slug: "figure-8-rethreaded",
        name: "Figure 8, rethreaded",
        group: "Knots",
        about: "The rethreaded figure 8 from Rescue Knots, lifted into 3D from its drawing: each strand rises where it's on top at a crossing and sinks where it's underneath, round the drawing's bar seen end on.",
        pieces: () => {
            const knot = KNOTS.find((k) => k.slug === "figure-8-rethreaded")!;
            return knotPieces(knot.file.knot, { steel: STEEL });
        },
    },
    {
        slug: "figure-8-trial",
        name: "Figure 8, tightened (trial)",
        group: "Knots",
        about: "Trial: the figure 8 on a bight tightened in 3D round a 5 mm bar (src/rigging/knots/figure-8.json, edited in /knot-editor-3d), its rope numbered in segments from the standing end, with X, Y and Z arrows.",
        ...(() => {
            const file = knot3dFile("figure-8.json", FIGURE_8_JSON);
            const { points, seg } = knotRope(file);
            const rope = () =>
                numberedRope(points, file.diameter / 2, seg, [
                    "var(--knot-orange)",
                    "var(--knot-purple)",
                ]);
            const knotLow = Math.min(...points.filter((p) => p.y > -0.15).map((p) => p.y));
            const arrows = () => axes(vec3(-0.06, knotLow, 0), 0.03);
            return {
                pieces: () => [
                    ...rope().pieces,
                    ...arrows().pieces,
                    ...file.props
                        .filter((p) => p.kind === "bar")
                        .map((bar) => ({
                            kind: "rod" as const,
                            a: bar.at.sub(bar.along.scale(0.04)),
                            b: bar.at.add(bar.along.scale(0.04)),
                            r: bar.r,
                            material: "steel" as const,
                            color: STEEL,
                            capA: true,
                            capB: true,
                        })),
                ],
                labels: () => [...rope().labels, ...arrows().labels],
            };
        })(),
    },
    {
        slug: "tower-f8ob-sling",
        name: "Figure 8 on a bight on its sling's carabiner",
        group: "Abseil tower",
        about: "The photographer's maroon rope (rope-6 in NZRT11) tied to its green sling's carabiner under the overhead beam with a figure 8 on a bight, cut out of the tower as its 3D view lays it out: the carabiner hangs from the sling by its narrow end, and the knot's loop goes round its wide end, lying towards the top rail.",
        pieces: () => towerKnot(false),
        flat: towerKnotFlat(false),
    },
    {
        slug: "tower-f8ob-end",
        name: "Figure 8 on a bight on a rope's end carabiner",
        group: "Abseil tower",
        about: "The same rope's end, a metre down the east face, cut out of the tower as its 3D view lays it out: a figure 8 on a bight with a carabiner clipped through its loop, hanging spine in line with the rope.",
        pieces: () => towerKnot(true),
        flat: towerKnotFlat(true),
    },
    {
        slug: "tower-m2hh",
        name: "Munter and two half hitches on its sling's carabiner",
        group: "Abseil tower",
        about: "The first rope in NZRT11 (rope-1) tied to its red sling's carabiner under the overhead beam with a munter and two half hitches, cut out of the tower as its 3D view lays it out: the knot as finished in /knot-editor-3d on the D hanging square (src/rigging/knots/munter-and-two-half-hitches.json), moved and turned with the carabiner.",
        pieces: () => towerMunter(),
        flat: {
            main: { azimuth: 90, elevation: 90 },
            pieces: (toward) => towerMunter(toward),
            minWidth: FLAT_HAIRLINE,
            thinEdges: true,
        },
    },
    {
        slug: "tower-lrh",
        name: "Load release hitch on its sling's carabiner",
        group: "Abseil tower",
        about: "The first belay in NZRT11 (belay-1, the white rope) from its sling's carabiner under the overhead beam, cut out of the tower as its 3D view lays it out: the load release hitch as finished in /knot-editor-3d (src/rigging/knots/load-release-hitch.json), moved and turned with the carabiner hanging square, its second carabiner below, and the tandem belay prusiks from that.",
        pieces: () => towerLrh(),
        flat: {
            main: { azimuth: 90, elevation: 90 },
            pieces: (toward) => towerLrh(toward),
            minWidth: FLAT_HAIRLINE,
            thinEdges: true,
        },
    },
    {
        slug: "tower-tbp",
        name: "Tandem belay prusiks and their pulley",
        group: "Abseil tower",
        about: "The first belay in NZRT11 (belay-1, the white rope) where it hangs from its load release hitch's second carabiner, cut out of the tower as its 3D view lays it out: the carabiner turned 10° in its own plane from hanging square about the figure 8's loop, centred in its narrow end, and a single prusik minding pulley (red plates) hanging straight down the pull from the middle of its wide end, the bar passing through the middle of the pulley's eyes; the rope from the abseiler past the plates' shoulders, where the tandem belay prusiks sit, one below the other (as tied in /knot-editor-3d, src/rigging/knots/prusik.json: 8 mm cord, three wraps each side of a bridge, each loop up through the carabiner on the spine side of the pulley, hanging loose round its bar, the upper's shorter and inside the lower's; the tower's stand-in cylinder for them is left out; with X, Y and Z arrows, X along the rope), round the sheave and off it towards where its spare lands in its coil on the deck.",
        pieces: () => towerTbp().pieces,
        labels: () => towerTbp().labels,
        flat: {
            main: { azimuth: 90, elevation: 90 },
            pieces: (toward) => towerTbp(toward).pieces,
            minWidth: FLAT_HAIRLINE,
            thinEdges: true,
        },
    },
    {
        slug: "tower-munter",
        name: "Munter hitch on a carabiner",
        group: "Abseil tower",
        about: "The munter hitch round the tower's carabiner's wide end, tightened in /knot-editor-3d from the Rescue Knots drawing (src/rigging/knots/munter-hitch.json). Not yet tied off.",
        pieces: () => munterOnCarabiner(),
        flat: {
            main: { azimuth: 90, elevation: 90 },
            pieces: (toward) => munterOnCarabiner(toward),
            minWidth: FLAT_HAIRLINE,
            thinEdges: true,
        },
    },
    {
        slug: "munter-two-half-hitches",
        name: "Munter hitch and two half hitches",
        group: "Knots",
        about: "The munter hitch tied off with two half hitches on the tower's D carabiner, hanging square, its spine upright: drawn in the knot editor, tightened in stages in /knot-editor-3d round the drawing's HMS carabiner, moved onto the D and finished by hand there (src/rigging/knots/munter-and-two-half-hitches.json). Its standing part carries on down the pull.",
        pieces: () => {
            const { pieces, features } = carabinerWith(ORIGIN, UP, ALONG, STEEL, 0.11);
            const { rope, end } = munterTwoHalfHitches(features);
            return [
                ...pieces,
                ...line([end.add(DOWN.scale(0.15)), ...rope], 0.0055, rigColor("blue"), "rope", {
                    a: true,
                    b: true,
                }),
            ];
        },
    },
    {
        slug: "load-release-hitch",
        name: "Load release hitch",
        group: "Knots",
        about: "The load release hitch between two CT D carabiners, both with their narrow ends towards the anchor above, the upper one hanging square and the lower one settled: 5 mm green cord, doubled from its middle with a figure 8 on a bight round the lower carabiner, rises as a pair to a munter hitch round the upper carabiner, then comes down and wraps round the rising pair almost to the figure 8. Started from the drawn hitch, wrapped and finished by hand in /knot-editor-3d (src/rigging/knots/load-release-hitch.json).",
        pieces: () => loadReleaseHitch(),
    },
    {
        slug: "munter-two-half-hitches-drawn",
        name: "Munter hitch and two half hitches, as drawn",
        group: "Knots",
        about: "The munter hitch tied off with two half hitches as drawn in the knot editor (src/knots/files/munter-and-two-half-hitches.json), lifted into 3D before it's tightened: each strand in the drawing's place, rising a rope's thickness where it's on top at a crossing and sinking where it's underneath, round the drawing's HMS carabiner.",
        pieces: () => {
            const read = parseKnotFile(JSON.stringify(MUNTER_2HH_DRAWING));
            if (read.kind === "error") throw new Error(read.reason);
            const [rope] = liftKnot(read.file.knot);
            const prop = MUNTER_2HH_DRAWING.knot.props[0];
            const loop = middleLoop(prop).map((q) => vec3(q.x / 1000, -q.y / 1000, 0));
            return [
                ...line(rope.points, rope.diameter / 2, rigColor("blue"), "rope", {
                    a: true,
                    b: true,
                }),
                {
                    kind: "strand" as const,
                    points: loop,
                    r: prop.r / 1000,
                    material: "steel" as const,
                    color: STEEL,
                    capA: false,
                    capB: false,
                },
            ];
        },
    },
    {
        slug: "carabiner-oval",
        name: "Carabiner (oval)",
        group: "Hardware",
        about: "An oval triple-lock carabiner (the CT one), traced from a photo, on the pulleys and the dynamic brake: dark grey, the same round both ends, 110 mm from the middle of one end to the other and about 49 mm wide, its straight gate behind its red knurled locking sleeve.",
        pieces: () =>
            carabiner(vec3(0, 0.055, 0), DOWN, ALONG, PULLEY_COLORS.carabiner, 0.11, {
                shape: "oval",
            }),
    },
    {
        slug: "eye-bolt",
        name: "Eye bolt (M12)",
        group: "Hardware",
        about: "A forged lifting eye bolt, M12 to DIN 580: its eye 54 mm across outside and 30 mm inside, standing 53 mm off the steel, with a 30 mm collar.",
        pieces: () => eyeBolt(ORIGIN, UP, ALONG, STEEL).pieces,
    },
    {
        slug: "sheave",
        name: "Sheave and axle",
        group: "Hardware",
        about: "A grooved sheave on its axle bolt, as in the pulleys.",
        pieces: () => [
            ...sheave(ORIGIN, ACROSS, 0.02, 0.026, 0.014, PULLEY_COLORS.sheave),
            ...bolt(ORIGIN, ACROSS, 0.026, 0.004, STEEL),
        ],
    },
    {
        slug: "pulley",
        name: "Rescue pulley",
        group: "Hardware",
        about: "A single rescue pulley with its carabiner, its rope running down both sides.",
        pieces: () => {
            const [a, b] = [vec3(-0.15, -0.35, 0), vec3(0.15, -0.35, 0)];
            const p = pulley({
                centre: ORIGIN,
                toA: a,
                toB: b,
                ropeR: 0.0055,
                colors: PULLEY_COLORS,
            });
            return [...p.pieces, ...reeved(p, ORIGIN, a, b, 0.0055)];
        },
    },
    {
        slug: "zip-trolley",
        name: "Zip trolley",
        group: "Hardware",
        about: "A twin-sheave zip line trolley after the ISC Zip Speed (RP075), on 11 mm wire, its bumper towards +x.",
        pieces: () => [
            ...zipTrolley(ORIGIN, ALONG, ACROSS, HAWSER_R, TROLLEY_COLORS).pieces,
            ...wire(ORIGIN, 0.25),
        ],
    },
    {
        slug: "grigri",
        name: "GRIGRI+",
        group: "Hardware",
        about: "A Petzl GRIGRI+ (assisted-braking belay device), about 115 mm long, hanging from its carabiner: the loaded strand up out of its top by the climber's mark, the brake strand out by the hand's at the far end.",
        pieces: () => {
            // Its coloured front towards the Front view.
            const g = grigri(ORIGIN, UP, ACROSS.neg(), {
                body: "var(--fox-grigri)",
                dark: "var(--rig-black)",
                handle: "var(--fox-grigri-handle)",
                steel: STEEL,
            });
            const clip = 0.11 - g.holeR + 0.005;
            return [
                ...g.pieces,
                ...carabiner(vec3(0, -g.holeR + 0.005, 0), DOWN, ACROSS, STEEL, clip),
                ...line(
                    [g.rope[0].add(vec3(0, 0.2, 0)), ...g.rope, ...g.brake(0.25)],
                    0.0055,
                    C.dropper,
                ),
            ];
        },
    },
    {
        slug: "stop-block",
        name: "Stop block",
        group: "Hardware",
        about: "The team's stop block, from their drawing and a photo: two nylon halves split along 11 mm wire, 100 mm each way, held by four 10 mm brass bolts sunk flush top and bottom, with two eye bolts across it, one high with its eye on the +z side at the −x end, the other low on the far side at the far end.",
        pieces: () => [
            ...stopBlock(ORIGIN, ALONG, UP, ACROSS, HAWSER_R, STOP_BLOCK_COLORS).pieces,
            ...wire(ORIGIN, 0.25),
        ],
    },
    {
        slug: "bow-shackle",
        name: "Bow shackle (19 mm)",
        group: "Hardware",
        about: "A 19 mm bow shackle with a yellow screw pin, after Crosby's G-209: 32 mm between its ears, 73 mm inside from the crown to the pin, its bow 52 mm across inside. Its crown at the origin, its pin towards +x.",
        pieces: () => shackle("bow", ORIGIN, ALONG, UP, STEEL, C.pin).pieces,
    },
    {
        slug: "d-shackle",
        name: "D shackle (19 mm)",
        group: "Hardware",
        about: "A 19 mm D (chain) shackle with a yellow screw pin, after Crosby's G-210: 32 mm between its ears, 73 mm inside from the crown to the pin. Its crown at the origin, its pin towards +x.",
        pieces: () => shackle("d", ORIGIN, ALONG, UP, STEEL, C.pin).pieces,
    },
    {
        slug: "chain-link",
        name: "Chain link (10 mm)",
        group: "Hardware",
        about: "One link of 10 mm galvanised short link chain, as in the flying fox's platform stays: 28 mm long and 14 mm across inside, 34 mm across outside. Its inside starts at the origin and runs towards +x, lying in the x–y plane.",
        pieces: () => chainLink(ORIGIN, ALONG, UP, STEEL, CHAIN_10).pieces,
    },
    {
        slug: "chain",
        name: "Chain (10 mm)",
        group: "Hardware",
        about: `A metre of 10 mm short link chain hung between two points 0.8 m apart, the right one 0.2 m higher: a catenary, each link's end sitting in the next, the links turned a quarter turn to each other. ${Math.round(1 / CHAIN_10.length)} links to the metre.`,
        pieces: () =>
            chain(hangingPath(vec3(-0.4, 0, 0), vec3(0.4, 0.2, 0), 1), ACROSS, STEEL, CHAIN_10)
                .pieces,
    },
    {
        slug: "turnbuckle",
        name: "Turnbuckle (24 mm)",
        group: "Hardware",
        about: "A 24 mm turnbuckle, eye to eye, its rods partly wound out: a forged frame 360 mm long between its hexagon bosses with a window through it, an eye at each end 78 mm long inside.",
        pieces: () => turnbuckle(ORIGIN, ALONG, UP, STEEL).pieces,
    },
    {
        slug: "thimble",
        name: "Thimble and eye",
        group: "Hardware",
        about: "A wire rope thimble for 11 mm wire, 72 mm long and 34 mm wide inside, with the wire's eye round it and its two parts running on side by side.",
        pieces: () => {
            const t = thimble(ORIGIN, ALONG, UP, HAWSER_R, STEEL);
            const [first, last] = [t.wire[0], t.wire.at(-1)!];
            return [
                ...t.pieces,
                ...line(
                    [
                        last.add(ALONG.scale(0.15)),
                        last,
                        ...t.wire.slice(1, -1).reverse(),
                        first,
                        first.add(ALONG.scale(0.15)),
                    ],
                    HAWSER_R,
                    C.hawser,
                ),
            ];
        },
    },
    {
        slug: "base-clamp",
        name: "Double base clamp",
        group: "Hardware",
        about: "A double base (double throat) wire rope grip for 11 mm wire: a forged body with a wire in the throat either side, and two U-bolts staggered along the wires, each hooked over one wire and nutted on the far side.",
        pieces: () => {
            const side = vec3(0, 0, 1);
            const off = side.scale(baseClampWire(HAWSER_R));
            return [
                ...baseClamp(ORIGIN, ALONG, side, HAWSER_R, STEEL),
                ...wire(off, 0.1),
                ...wire(off.neg(), 0.1),
            ];
        },
    },
    {
        slug: "round-sling",
        name: "Round sling (4 t)",
        group: "Hardware",
        about: "A round sling, as the book calls the anchors' 4 t slings, here 1 m long: an endless loop of yarn in a woven sleeve. It isn't round: the sleeve squashes semi-flat, about 50 mm wide and 14 mm thick. Laid out on edge, its two parts either side.",
        pieces: () => slingLoop("round", 1, 0.04),
    },
    {
        slug: "climbing-sling",
        name: "Climbing sling",
        group: "Hardware",
        about: "A climbing sling, 1.2 m long, as on the abseil tower and on the flying fox's bottom shear legs: tape sewn into a loop, flat, 25 mm wide and 3 mm thick. Laid out on edge.",
        pieces: () => slingLoop("climbing", 1.2, 0.03),
    },
    {
        slug: "tirfor",
        name: "Tirfor T-516D",
        group: "Hardware",
        about: "A Tirfor T-516D wire rope winch, 1.6 t, lying on its side: its alloy body 523 mm long and 127 mm thick, the forward lever's telescopic handle closed (650 mm), the reverse lever, the yellow release lever, the rope guide at the load end, and its anchor hook with its latch on the pin at the other.",
        pieces: () => {
            const t = tirfor(ORIGIN, ALONG, UP, TIRFOR_COLORS);
            return [...t.pieces, ...hook(t.pin, ALONG.neg(), t.pinAlong, STEEL).pieces];
        },
    },
    {
        slug: "fox-trolley",
        name: "Trolley, rigged",
        group: "Flying fox",
        about: "A trolley as the flying fox rigs it: the rider's dropper tied into the middle carabiner with a figure 8 on a bight, the back-up and return lines on the one behind, the bumper downhill.",
        pieces: () => {
            const ahead = vec3(1, -0.05, 0).unit();
            const t = rigTrolley(ORIGIN, ahead);
            return [
                ...t.pieces,
                ...line(
                    [ORIGIN.sub(ahead.scale(0.3)), ORIGIN.add(ahead.scale(0.3))],
                    HAWSER_R,
                    C.hawser,
                ),
                ...(() => {
                    const eight = figure8(
                        t.hang,
                        vec3(0, 0, 1),
                        CARABINER_R,
                        t.hang.add(t.hangDown),
                        0.0055,
                    );
                    return line(
                        [...eight.rope, eight.end.add(t.hangDown.scale(0.1))],
                        0.0055,
                        C.dropper,
                        "rope",
                        { a: true },
                    );
                })(),
                ...tiedTo(
                    t.backUp,
                    [t.backUp.add(t.backUpDown.scale(0.35))],
                    0.0055,
                    C.dropper,
                    -0.007,
                    t.backUpDown,
                ),
                ...tiedTo(
                    t.backUp,
                    [t.backUp.add(vec3(-0.2, 0.03, 0))],
                    0.004,
                    C.returnLine,
                    0.007,
                    t.backUpDown,
                ),
            ];
        },
    },
    {
        slug: "fox-return-pulley",
        name: "Return pulley on its eye bolt",
        group: "Flying fox",
        about: "A return pulley as the flying fox hangs it: clipped into the inner of the two eye bolts towards that end of the top cross bar, its eye lying flat, the outer one's standing upright. The line comes in from the trolley and goes across to the other pulley.",
        pieces: () => {
            const rhs = { w: 0.05, h: 0.075 };
            // The top bar's platform-side face, along z, the eye bolts standing out of it.
            const bar = timber(
                vec3(-rhs.w / 2, 0, -0.35),
                vec3(-rhs.w / 2, 0, 0.25),
                UP,
                rhs.w,
                rhs.h,
                "steel",
            ).map((q) => ({ ...q, color: STEEL }));
            const outer = eyeBolt(vec3(0, 0, 0.15), ALONG, UP, STEEL).pieces;
            const [a, b] = [vec3(0.35, -0.25, 0.05), vec3(0.05, -0.12, -0.4)];
            const p = rigPulley(vec3(0.08, -0.15, 0), a, b, 0.004, {
                eyeBolt: { base: ORIGIN, out: ALONG, toward: ACROSS },
            });
            return [
                ...bar,
                ...outer,
                ...p.pieces,
                ...line([a, ...p.round, b], 0.004, C.returnLine),
            ];
        },
    },
    {
        slug: "fox-brake-pulley",
        name: "Brake pulley on its eye bolt",
        group: "Flying fox",
        about: "The brake line's pulley as the flying fox hangs it: clipped into an eye bolt under the brake support's arm, 100 mm in from its end, the line coming back up the span and going straight down to the chain.",
        pieces: () => {
            const arm = 0.05;
            // The eye bolt in the arm's underside, standing down from it.
            const under = vec3(-0.1, -arm / 2, 0);
            const [a, b] = [vec3(0.25, -0.3, 0.05), vec3(-0.1, -0.45, 0)];
            const p = rigPulley(vec3(-0.1, -0.15, 0), a, b, 0.004, {
                eyeBolt: { base: under, out: DOWN },
            });
            const beam = timber(vec3(-0.35, 0, 0), vec3(0, 0, 0), UP, arm, arm, "steel").map(
                (q) => ({ ...q, color: STEEL }),
            );
            return [...beam, ...p.pieces, ...line([a, ...p.round, b], 0.004, C.brakeLine)];
        },
    },
    {
        slug: "fox-dropper",
        name: "Trolley and dropper, rigged",
        group: "Flying fox",
        about: "Trolley A on its hawser at the launch, cut out of the whole: the dropper down through the GRIGRI+ to the rider's tie-in, its brake strand hanging below, and the safety line beside it to its own carabiner.",
        pieces: () => {
            const at = onHawser(TROLLEY_X.a, 1);
            return within(foxPieces(), {
                lo: at.add(vec3(-0.4, -2.4, -0.3)),
                hi: at.add(vec3(0.4, 0.2, 0.3)),
            });
        },
    },
    {
        slug: "fox-brake-blocks",
        name: "Brake blocks, rigged",
        group: "Flying fox",
        about: "The dynamic brake's stop blocks as the flying fox rigs them, cut out of the whole: one on each hawser, the joining rope tied between their inner eyes and drawn up the span by the brake line, trolley B against its block.",
        pieces: () => {
            const at = onHawser(BLOCKS_X, 1);
            return [
                ...within(foxPieces(), {
                    lo: vec3(at.x - 1.6, at.y - 0.6, -1),
                    hi: vec3(at.x + 0.3, at.y + 0.3, 1),
                }),
            ];
        },
    },
    {
        slug: "fox-static-brake",
        name: "Static brake, rigged",
        group: "Flying fox",
        about: "A static brake as the flying fox rigs it, cut out of the whole: a carabiner clipped round the hawser, hanging towards the pull of its rope, which is tied into the carabiner's bottom bar with a figure 8 on a bight and runs out to a picket.",
        pieces: () => {
            const at = onHawser(STATIC_X, 1);
            return [
                ...within(foxPieces(), {
                    lo: at.add(vec3(-0.3, -0.5, -0.3)),
                    hi: at.add(vec3(0.3, 0.1, 0.3)),
                }),
            ];
        },
    },
    {
        slug: "fox-in-line",
        name: "In-line hardware, rigged",
        group: "Flying fox",
        about: "Hawser A's in-line hardware at the log anchor, cut out of the whole (Figure 66): from the round sling, a 19 mm bow shackle, the 24 mm turnbuckle, three 19 mm D shackles, then the hawser's eye round its thimble, its dead end held beside the live part by three double base clamps.",
        pieces: () => {
            const a = ANCHOR_SHACKLE(SLING_Z);
            const along = SADDLE(1).sub(a).unit();
            const far = a.add(along.scale(1.7));
            return within(foxPieces(), {
                lo: vec3(Math.min(a.x, far.x) - 0.2, Math.min(a.y, far.y) - 0.2, a.z - 0.25),
                hi: vec3(Math.max(a.x, far.x) + 0.15, Math.max(a.y, far.y) + 0.2, a.z + 0.25),
            });
        },
    },
    {
        slug: "fox-log-anchor",
        name: "Log anchor, rigged",
        group: "Flying fox",
        about: "The log and picket anchor at the bottom end, cut out of the whole: the log behind two rows of pickets, and the three 4 t round slings basketed round it, one shackled to each hawser and the middle one to the Tirfor.",
        pieces: () => {
            const a = ANCHOR_SHACKLE(0);
            return within(foxPieces(), {
                lo: vec3(a.x - 0.3, a.y - 0.4, -LOG.length / 2 - 0.1),
                hi: vec3(LOG.x + 0.5, a.y + 0.6, LOG.length / 2 + 0.1),
            });
        },
    },
    {
        slug: "fox-tirfor",
        name: "Tirfor and lizard, rigged",
        group: "Flying fox",
        about: "The Tirfor, cut out of the whole, left slack in line as a back-up: lying on the ground, its anchor hook in the log's middle round sling, its 11.5 mm cable and the lizard making one slack curve up to hawser A, the cable's hook on a swaged eye, in the lizard's bottom eye, and the lizard clamped along the hawser by three double base clamps, its free eye a little way past them. Its slack tail runs back over the log. Hawser B's lizard hangs free, waiting.",
        pieces: () => {
            const a = ANCHOR_SHACKLE(0);
            const top = ANCHOR_SHACKLE(SLING_Z).add(
                SADDLE(1).sub(ANCHOR_SHACKLE(SLING_Z)).unit().scale(6),
            );
            return within(foxPieces(), {
                lo: vec3(Math.min(a.x, top.x) - 0.3, a.y - 0.4, -2.5),
                hi: vec3(LOG.x + 1.2, top.y + 0.3, 2.5),
            });
        },
    },
    {
        slug: "fox-tree-anchors",
        name: "Tree anchors, rigged",
        group: "Flying fox",
        about: "The tree at the top end, cut out of the whole: the 4 t round sling choked round the trunk for each hawser, its bow shackle and the hawser's eye, and the backstay's own sling basketed round the trunk above them.",
        pieces: () => {
            const g = groundY(TREE.x);
            return within(foxPieces(), {
                lo: vec3(TREE.x - TREE.r - 0.3, g - 0.1, -TREE.r - 0.7),
                hi: vec3(TREE.x + TREE.r + 1.1, g + 1.1, TREE.r + 0.7),
            });
        },
    },
    {
        slug: "fox-tree-eye",
        name: "Hawser eye at the tree, rigged",
        group: "Flying fox",
        about: "Hawser A's end at the tree, cut out of the whole: a 19 mm bow shackle on the round sling choked round the trunk, the hawser's eye round its thimble on the pin, its dead end held beside the live part by three double base clamps.",
        pieces: () => {
            const a = TREE_SHACKLE(1);
            return within(foxPieces(), {
                lo: a.add(vec3(-0.75, -0.35, -0.6)),
                hi: a.add(vec3(0.85, 0.35, 0.4)),
            });
        },
    },
    {
        slug: "fox-stabiliser",
        name: "Stabiliser pulley on the shear leg",
        group: "Flying fox",
        about: "The stabiliser's pulley as the flying fox hangs it, cut out of the whole: from a climbing sling basketed over the shear leg's top spar, each leg's bight round the carabiner's bar, swung to line up with the pull of the shock cord through it.",
        pieces: () => {
            const spar = vec3(SHEAR_LEG.x, groundY(SHEAR_LEG.x) + SHEAR_LEG.spar, 0);
            return within(foxPieces(), {
                lo: spar.add(vec3(-0.8, -0.8, -1.3)),
                hi: spar.add(vec3(0.5, 0.3, 1.3)),
            });
        },
    },
    {
        slug: "fox-tower",
        name: "Steel tower",
        group: "Flying fox",
        about: "The flying fox's steel tower as rigged, cut out of the whole: the platform and its stays, the saddles, the eye bolts and pulleys, and the brake support.",
        pieces: () =>
            within(foxPieces(), {
                lo: vec3(-1.2, -0.1, -2.2),
                hi: vec3(2, BRAKE.postTop + 0.3, 2.2),
            }),
    },
    {
        slug: "fox-platform-stay-top",
        name: "Platform stay, top",
        group: "Flying fox",
        about: "The top of one of the platform's stays (Appendix E): 6 mm Grade 80 chain from the M16 eye bolt on the bolt through the top cross bar and its upright, down to the platform's front corner, taut and so straight, on a 6 mm D shackle at each end: its pin through the eye bolt's ring, its crown through the chain's end link.",
        pieces: () =>
            within(foxPieces(), {
                lo: vec3(0, TOWER.bar - 0.2, TOWER.z + 1.4),
                hi: vec3(0.3, TOWER.bar + 0.1, TOWER.z + 1.6),
            }),
    },
    {
        slug: "fox-platform-stay-foot",
        name: "Platform stay, foot",
        group: "Flying fox",
        about: "The foot of the same stay: the chain down to its D shackle on the M16 eye bolt in the platform's front corner.",
        pieces: () =>
            within(foxPieces(), {
                lo: vec3(TOWER.shs / 2 + TOWER.platform.depth - 0.25, TOWER.lower, TOWER.z + 1.2),
                hi: vec3(
                    TOWER.shs / 2 + TOWER.platform.depth + 0.15,
                    TOWER.lower + 0.45,
                    TOWER.z + 1.6,
                ),
            }),
    },
    {
        slug: "fox-chain-weight",
        name: "Chain weight, at rest",
        group: "Flying fox",
        about: `The chain brake's weight at rest, its shackle 0.5 m off the ground: 10 mm chain, 10 strands 2.1 to 2.7 m long hung from a big ring on a shackle's pin, heaped on the ground and lifted from the heap's middle. ${Math.round(chainWeightMass())} kg in all, ${Math.round(chainWeightHanging(0.5))} kg of it hanging.`,
        pieces: () => weightOnShackle(0.5),
    },
    {
        slug: "fox-chain-weight-mid",
        name: "Chain weight, half lifted",
        group: "Flying fox",
        about: `The chain brake's weight half lifted, its shackle 1.7 m off the ground: 10 mm chain, 10 strands 2.1 to 2.7 m long hung from a big ring on a shackle's pin, heaped on the ground and lifted from the heap's middle. ${Math.round(chainWeightMass())} kg in all, ${Math.round(chainWeightHanging(1.7))} kg of it hanging.`,
        pieces: () => weightOnShackle(1.7),
    },
    {
        slug: "fox-chain-weight-full",
        name: "Chain weight, fully lifted",
        group: "Flying fox",
        about: `The chain brake's weight as far as the heaviest rider (120 kg) lifts it, 4.2 m, its shackle 4.7 m off the ground: 10 mm chain, 10 strands 2.1 to 2.7 m long hung from a big ring on a shackle's pin, heaped on the ground and lifted from the heap's middle. ${Math.round(chainWeightMass())} kg in all, ${Math.round(chainWeightHanging(FULL_LIFT))} kg of it hanging.`,
        pieces: () => weightOnShackle(FULL_LIFT),
    },
    {
        slug: "fox-tower-top-joint",
        name: "Tower: top bar on an upright",
        group: "Flying fox",
        about: "The top cross bar's end on hawser A's upright, cut out of the whole: the 175 mm M16 eye bolt through the bar and the upright, its nut on the upright's back, the platform's stay hanging from its eye.",
        pieces: () =>
            within(foxPieces(), {
                lo: vec3(-0.15, TOWER.bar - 0.2, TOWER.z + TOWER.half - 0.25),
                hi: vec3(0.25, TOWER.bar + 0.25, TOWER.z + TOWER.half + 0.2),
            }),
    },
    {
        slug: "fox-tower-middle",
        name: "Tower: top bar's middle",
        group: "Flying fox",
        about: "The middle of the top cross bar, cut out of the whole: the braces' tops and the brake support's post behind it, each bolted to it with a 150 mm M16 bolt, and an M16 eye bolt in each 350 mm below the bar.",
        pieces: () =>
            within(foxPieces(), {
                lo: vec3(-0.1, TOWER.bar - 0.45, TOWER.z - 0.35),
                hi: vec3(0.2, TOWER.bar + 0.2, TOWER.z + 0.35),
            }),
    },
    {
        slug: "fox-tower-lower-bar",
        name: "Tower: bottom bar's middle",
        group: "Flying fox",
        about: "The middle of the bottom cross bar, cut out of the whole: the braces and the brake support's post behind it, each bolted to it with a 150 mm M16 bolt, the platform resting on top.",
        pieces: () =>
            within(foxPieces(), {
                lo: vec3(-0.1, TOWER.lower - 0.2, TOWER.z - 0.9),
                hi: vec3(0.2, TOWER.lower + 0.2, TOWER.z + 0.9),
            }),
    },
    {
        slug: "fox-hawser-guide",
        name: "Tower: hawser guide",
        group: "Flying fox",
        about: "Hawser A's guide on the top cross bar, cut out of the whole (Appendix E): a 3 mm steel strap over the bar clamped under it by a 110 mm M16 bolt, two cheeks 32 mm apart on top with a PTFE liner between them for the hawser to sit on, and a bolt across above the hawser.",
        pieces: () =>
            within(foxPieces(), {
                lo: vec3(-0.12, TOWER.bar - 0.2, HAWSER_Z - 0.15),
                hi: vec3(0.25, TOWER.bar + 0.15, HAWSER_Z + 0.15),
            }),
    },
    {
        slug: "fox-tower-brace-foot",
        name: "Tower: brace foot",
        group: "Flying fox",
        about: "A diagonal brace's foot on hawser A's upright, cut out of the whole (Appendix E's \"Diagonal Brace End\"): the brace welded between two 10 mm plates 76 mm apart with a 25 mm spacer behind it, the plates either side of the upright and a 150 mm M16 bolt through them.",
        pieces: () =>
            within(foxPieces(), {
                lo: vec3(-0.15, TOWER.braceFoot - 0.2, TOWER.z + TOWER.half - 0.35),
                hi: vec3(0.15, TOWER.braceFoot + 0.2, TOWER.z + TOWER.half + 0.15),
            }),
    },
    {
        slug: "fox-tower-extension-joint",
        name: "Tower: extension joint",
        group: "Flying fox",
        about: "Where hawser A's upright meets its 2 m extension, cut out of the whole: a joint plate either side and four 125 mm M16 bolts through them.",
        pieces: () =>
            within(foxPieces(), {
                lo: vec3(-0.1, TOWER.joint - 0.4, TOWER.z + TOWER.half - 0.12),
                hi: vec3(0.1, TOWER.joint + 0.4, TOWER.z + TOWER.half + 0.12),
            }),
    },
    {
        slug: "fox-tower-foot",
        name: "Tower: foot",
        group: "Flying fox",
        about: "The foot of hawser A's upright, cut out of the whole: its foot plate and the two 125 mm M16 bolts through the upright and the adjustable foot inside it.",
        pieces: () =>
            within(foxPieces(), {
                lo: vec3(-0.2, -0.02, TOWER.z + TOWER.half - 0.2),
                hi: vec3(0.2, 0.3, TOWER.z + TOWER.half + 0.2),
            }),
    },
    {
        slug: "fox-backstay-loop",
        name: "Backstay loop",
        group: "Flying fox",
        about: "The backstay's figure 8 on a bight at the tower: its loop wrapped diagonally round the joint of the top cross bar and the brake support's post behind it, past the post above the bar on one side, across the bar's front, and back past the post below it on the other, lying flat along their faces.",
        pieces: backstayLoop,
    },
    {
        slug: "fox-guy-loops",
        name: "Guy loops",
        group: "Flying fox",
        about: "The two guys' figure 8s on a bight at the top of one of the tower's uprights: each big loop dropped over the upright's top and slid down to the top cross bar, the second resting on the first where they cross, lying flat along the upright's faces.",
        pieces: guyLoops,
    },
    {
        slug: "fox-shear-leg-guys",
        name: "Shear leg guys",
        group: "Flying fox",
        about: "The two guys' figure 8s on a bight at the top of one of the shear leg's uprights: each big loop dropped over the upright's top and slid down onto the top spar's square lashing, the second resting on the first where they cross.",
        pieces: shearLegGuyLoops,
    },
];

/**
 * The load release hitch: two CT D carabiners, narrow ends up towards the anchor, the upper one hanging square from the
 * origin as it was tied (`loadReleaseHitch` in the knots), the lower one settled below it, and the 5 mm cord between.
 */
function loadReleaseHitch(): Piece[] {
    const upper = carabinerWith(ORIGIN, UP, ALONG.neg(), STEEL, 0.11);
    const { cord, r, lower } = tiedLoadReleaseHitch(upper.features);
    return [
        ...upper.pieces,
        ...carabinerWith(lower.top, lower.down, lower.across, STEEL, 0.11, { settled: true })
            .pieces,
        ...line(cord, r, rigColor("green"), "rope", { a: true, b: true }),
    ];
}

/**
 * The abseil tower's photographer's rope (rope-6) and its sling, cut out round one of its figure 8s on a bight and
 * moved to the origin: the one tied to the sling's carabiner, or (`end`) the one on the rope's end, with the boarding
 * it hangs against. Laid `face` on to the eye for a flat view, as the tower's flat views lay them.
 */
function towerKnot(end: boolean, face?: Vector3): Piece[] {
    const rig = RIGS.find((r) => r.slug === "nzrt11")!;
    const { pieces, labels } = layoutRig(rig, new Set(["sling-9", "rope-6"]), { face });
    const label = labels.find(
        (l) => l.text === KNOT_LABELS.bight && (l.shell !== undefined) === end,
    )!;
    const reach = vec3(0.3, 0.3, 0.3);
    const box = { lo: label.at.sub(reach), hi: label.at.add(reach) };
    return moved(within([...(end ? towerPieces() : []), ...pieces], box), label.at.neg());
}

/** NZRT11's first rope's munter and two half hitches on its sling's carabiner, cut out of the tower. */
function towerMunter(face?: Vector3): Piece[] {
    const rig = RIGS.find((r) => r.slug === "nzrt11")!;
    const { pieces, labels } = layoutRig(rig, new Set(["sling-1", "rope-1"]), { face });
    const label = labels.find((l) => l.text === "M+2HH")!;
    const reach = vec3(0.3, 0.3, 0.3);
    const box = { lo: label.at.sub(reach), hi: label.at.add(reach) };
    return moved(within(pieces, box), label.at.neg());
}

/** NZRT11's first belay's load release hitch on its sling's carabiner, cut out of the tower. */
function towerLrh(face?: Vector3): Piece[] {
    const rig = RIGS.find((r) => r.slug === "nzrt11")!;
    const { pieces, labels } = layoutRig(rig, new Set(["sling-5", "belay-1"]), { face });
    const label = labels.find((l) => l.text === "LRH")!;
    const reach = vec3(0.35, 0.35, 0.35);
    const box = { lo: label.at.sub(reach), hi: label.at.add(reach) };
    // Without the tandem belay prusiks' stand-in cylinder (the rope's own rods), so the rope shows through them.
    const shown = pieces.filter((p) => !(p.kind === "rod" && p.material === "rope"));
    return moved(within(shown, box), label.at.neg());
}

/**
 * The first belay's tandem belay prusiks and pulley as `towerLrh` cuts them out, round their label, with X, Y and Z
 * arrows in the rope's frame so changes to them can be talked through.
 */
function towerTbp(face?: Vector3): { pieces: Piece[]; labels: RigLabel[] } {
    const rig = RIGS.find((r) => r.slug === "nzrt11")!;
    const { pieces, labels } = layoutRig(rig, new Set(["sling-5", "belay-1"]), { face });
    const label = labels.find((l) => l.text === "TBP")!;
    const reach = vec3(0.3, 0.3, 0.3);
    const box = { lo: label.at.sub(reach), hi: label.at.add(reach) };
    // Without the tandem belay prusiks' stand-in cylinder (the rope's own rods), so the rope shows through them.
    const shown = pieces.filter((p) => !(p.kind === "rod" && p.material === "rope"));
    const to = label.at.neg();
    // X, Y and Z arrows beside it, for saying which way to move things: X along the rope towards the abseiler (the
    // last stretch of the rope's run round the sheave and through the prusiks), Y square to it as near straight up as
    // it goes, Z across.
    const run = shown.find(
        (p) => p.kind === "strand" && p.color === rigColor("white") && p.points.length > 10,
    );
    const ropeX =
        run?.kind === "strand" ? run.points.at(-1)!.sub(run.points.at(-2)!).unit() : vec3(1, 0, 0);
    const ropeY = vec3(0, 1, 0).sub(ropeX.scale(ropeX.y)).unit();
    const arrows = axes(vec3(0.04, 0.06, 0.1), 0.04, [ropeX, ropeY, ropeX.cross(ropeY)]);
    return {
        pieces: [...moved(within(shown, box), to), ...arrows.pieces],
        labels: arrows.labels,
    };
}

/**
 * Where a munter hitch sits on a carabiner's wide end: the straight run of its bar from the corner by the spine towards
 * the gate (from `from` to `to` metres across it), which it follows, centred `gate` (metres) on from its middle towards
 * the gate, so the brake strand's turn clears the corner.
 */
const MUNTER_BAR = { from: 0.003, to: 0.03, gate: 0.006 };

/**
 * The munter hitch on the tower's carabiner, as tightened in the 3D knot editor from the Rescue Knots drawing
 * (`knots/munter-hitch.json`, its bar along x through the origin). The carabiner hangs straight, its spine upright,
 * from its narrow end above; the hitch is moved onto the straight run of its wide end, which rises towards the gate, and
 * sheared to follow it. In 3D it hangs in the upright plane across x; in a flat view it's laid `face` on to the eye, pulled along
 * the view, and drawn in a fixed order: the carabiner's body, then its sleeve and grip, the rope in short lengths
 * sorting in front of and behind its bar.
 */
function munterOnCarabiner(face?: Vector3): Piece[] {
    const L = 0.11;
    const { body, sleeve, points, r, y } = munterPlaced(face);
    const color = rigColor("blue");
    if (!face) return [body, ...sleeve, ...line(points, r, color, "rope", { a: true, b: true })];
    // Face on: the rope in short lengths (each reaching a point into the next, so no seam shows), sorting by depth
    // among the carabiner's pieces, which keep their order.
    const group = { at: ORIGIN.add(y.scale(L / 2)) };
    const sleeveR = Math.min(...sleeve.map((p) => (p.kind === "rod" ? p.r : Infinity)));
    const lengths: Piece[] = [];
    for (let i = 0; i < points.length - 1; i += 4)
        lengths.push({
            kind: "strand",
            points: points.slice(Math.max(0, i - 1), Math.min(points.length, i + 6)),
            r,
            material: "rope",
            color,
            capA: i === 0,
            capB: i + 4 >= points.length - 1,
        });
    return [
        { ...body, group: { ...group, order: 1 } },
        ...sleeve.map((p) => ({
            ...p,
            group: { ...group, order: p.kind === "rod" && p.r > sleeveR ? 3 : 2 },
        })),
        ...lengths,
    ];
}

/**
 * The munter hitch on the carabiner as `munterOnCarabiner` draws it: the carabiner's body and sleeve, the rope's points
 * and radius, and the drawing's axes (x across, y up the carabiner, z out of the drawing).
 */
function munterPlaced(face?: Vector3) {
    const L = 0.11;
    const n = face?.unit() ?? ACROSS;
    const seen = DOWN.sub(n.scale(DOWN.dot(n)));
    const pull = seen.len() > 0.5 ? seen.unit() : ALONG;
    // The drawing's axes: x across it, y up it and z out of it towards the viewer. The scenes' x is east, y up and z
    // north, so seen from z, x runs to the right as z × y.
    const [y, z] = [pull.neg(), n];
    const x = z.cross(y);
    const [body, ...sleeve] = carabiner(ORIGIN, y, x, STEEL, L);
    // The wide end's straight run, in the drawing's plane: where the bar is at each end of it, across and up.
    const bar = body.kind === "strand" ? body.points : [];
    const near = (u: number) =>
        bar
            .filter((q) => q.dot(y) < L / 4)
            .reduce((m, q) => (Math.abs(q.dot(x) - u) < Math.abs(m.dot(x) - u) ? q : m));
    const [a, b] = [near(MUNTER_BAR.from), near(MUNTER_BAR.to)];
    const along = b.sub(a).unit();
    const middle = a.lerp(b, 0.5).add(along.scale(MUNTER_BAR.gate));
    const rise = b.sub(a).dot(y) / b.sub(a).dot(x);
    // Each point moved onto the bar's middle and lifted as far as the bar rises where it is across, so the turns follow
    // the slanted bar and the strands still hang straight down.
    const at = (p: Vector3) =>
        middle
            .add(x.scale(p.x))
            .add(y.scale(p.y + rise * p.x))
            .add(z.scale(p.z));
    const file = knot3dFile("munter-hitch.json", MUNTER_HITCH_JSON);
    const points = knotRope(file).points.map(at);
    return { body, sleeve, points, r: file.diameter / 2, x, y, z };
}

/** The tower's figure 8 on a carabiner as its overhead view draws it. */
function towerKnotFlat(end: boolean): PartFlat {
    return {
        // Looking down, as the tower's overhead view sees it, turned so it runs up and down the panel.
        main: { azimuth: 90, elevation: 90 },
        pieces: (toward) => towerKnot(end, toward),
        minWidth: FLAT_HAIRLINE,
        thinEdges: true,
    };
}

/**
 * The pieces inside the box from `lo` to `hi`, to look at one place in a whole rig: everything cut off at the box's
 * walls, so a long bar running through it shows as a stub. A face cut by a wall loses its holes and corner shading.
 */
function within(pieces: Piece[], { lo, hi }: { lo: Vector3; hi: Vector3 }): Piece[] {
    const inside = (c: Vector3) =>
        c.x >= lo.x && c.x <= hi.x && c.y >= lo.y && c.y <= hi.y && c.z >= lo.z && c.z <= hi.z;
    return pieces.flatMap((p): Piece[] => {
        if (p.kind === "strand") {
            // Each stretch inside, as a strand of its own: every segment cut where it crosses the box's walls.
            const runs: Vector3[][] = [];
            let open = false;
            for (let i = 1; i < p.points.length; i++) {
                const cut = clip(p.points[i - 1], p.points[i], lo, hi);
                if (!cut) {
                    open = false;
                    continue;
                }
                if (!open) runs.push([cut[0]]);
                runs[runs.length - 1].push(cut[1]);
                open = cut[1] === p.points[i];
            }
            return runs.map((points) => ({ ...p, points }));
        }
        if (p.kind === "rod") {
            const cut = clip(p.a, p.b, lo, hi);
            if (!cut) return [];
            return [
                {
                    ...p,
                    a: cut[0],
                    b: cut[1],
                    capA: cut[0] === p.a && p.capA,
                    capB: cut[1] === p.b && p.capB,
                },
            ];
        }
        if (p.points.every(inside)) return [p];
        const points = clipPolygon(p.points, lo, hi);
        if (points.length < 3) return [];
        return [{ ...p, points, holes: undefined, shades: undefined }];
    });
}

/** A convex polygon cut to the box (Sutherland–Hodgman, a wall at a time). */
function clipPolygon(points: Vector3[], lo: Vector3, hi: Vector3): Vector3[] {
    let poly = points;
    for (const k of ["x", "y", "z"] as const)
        for (const [bound, keep] of [
            [lo[k], (v: number) => v >= lo[k]],
            [hi[k], (v: number) => v <= hi[k]],
        ] as const) {
            const out: Vector3[] = [];
            poly.forEach((q, i) => {
                const prev = poly[(i + poly.length - 1) % poly.length];
                const [qIn, pIn] = [keep(q[k]), keep(prev[k])];
                if (qIn !== pIn) out.push(prev.lerp(q, (bound - prev[k]) / (q[k] - prev[k])));
                if (qIn) out.push(q);
            });
            poly = out;
            if (poly.length === 0) return [];
        }
    return poly;
}

/** The part of the segment from `a` to `b` inside the box (Liang–Barsky), its ends kept as they are when inside. */
function clip(a: Vector3, b: Vector3, lo: Vector3, hi: Vector3): [Vector3, Vector3] | null {
    const d = b.sub(a);
    let [t0, t1] = [0, 1];
    for (const k of ["x", "y", "z"] as const) {
        if (Math.abs(d[k]) < 1e-12) {
            if (a[k] < lo[k] || a[k] > hi[k]) return null;
            continue;
        }
        const [ta, tb] = [(lo[k] - a[k]) / d[k], (hi[k] - a[k]) / d[k]];
        t0 = Math.max(t0, Math.min(ta, tb));
        t1 = Math.min(t1, Math.max(ta, tb));
        if (t0 > t1) return null;
    }
    return [t0 === 0 ? a : a.add(d.scale(t0)), t1 === 1 ? b : a.add(d.scale(t1))];
}

export const GROUPS = [...new Set(PARTS.map((p) => p.group))];

export const partOf = (slug: string | null): Part => PARTS.find((p) => p.slug === slug) ?? PARTS[0];

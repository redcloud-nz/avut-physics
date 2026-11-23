import { timber, type Piece } from "@/abseil-tower/tower";
import {
    ANCHOR_SHACKLE,
    BLOCKS_X,
    BRAKE,
    C,
    foxPieces,
    groundY,
    HAWSER_R,
    line,
    LOG,
    onHawser,
    PULLEY_COLORS,
    rigPulley,
    rigTrolley,
    SADDLE,
    SHEAR_LEG,
    sling,
    SLING_Z,
    STATIC_X,
    STOP_BLOCK_COLORS,
    tiedTo,
    TREE,
    TREE_SHACKLE,
    TROLLEY_COLORS,
    TROLLEY_X,
} from "@/flying-fox/fox";
import {
    baseClamp,
    baseClampWire,
    bolt,
    carabiner,
    eyeBolt,
    grigri,
    pulley,
    shackle,
    sheave,
    stopBlock,
    thimble,
    turnbuckle,
    wrap,
    zipTrolley,
} from "@/flying-fox/hardware";
import { vec3, type Vector3 } from "@/lib/vector3";

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
};

const ORIGIN = vec3(0, 0, 0);
const ALONG = vec3(1, 0, 0);
const UP = vec3(0, 1, 0);
const DOWN = vec3(0, -1, 0);
const ACROSS = vec3(0, 0, 1);
const STEEL = "var(--tower-steel)";

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
        about: "A screwgate carabiner, 110 mm long and 60 mm wide, its sleeve on the gate side.",
        pieces: () => carabiner(vec3(0, 0.055, 0), DOWN, ALONG, STEEL),
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
        slug: "fox-trolley",
        name: "Trolley, rigged",
        group: "Flying fox",
        about: "A trolley as the flying fox rigs it: the rider's dropper on the middle carabiner, the back-up and return lines on the one behind, the bumper downhill.",
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
                ...tiedTo(t.hang, [t.hang.add(vec3(0, -0.25, 0))], 0.0055, C.dropper),
                ...tiedTo(
                    t.backUp,
                    [t.backUp.add(vec3(-0.03, -0.22, 0))],
                    0.0055,
                    C.dropper,
                    -0.007,
                ),
                ...tiedTo(
                    t.backUp,
                    [t.backUp.add(vec3(-0.2, 0.03, 0))],
                    0.004,
                    C.returnLine,
                    0.007,
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
        about: "A static brake as the flying fox rigs it, cut out of the whole: a carabiner clipped round the hawser, hanging towards the pull of its rope, which is tied round the carabiner's bottom bar and runs out to a picket.",
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
];

/**
 * The pieces inside the box from `lo` to `hi`, to look at one place in a whole rig: rods and faces whose middles are
 * in it, and the stretches of ropes and wires that run through it.
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
        const pts = p.kind === "rod" ? [p.a, p.b] : p.points;
        return inside(pts.reduce((sum, q) => sum.add(q), vec3(0, 0, 0)).scale(1 / pts.length))
            ? [p]
            : [];
    });
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

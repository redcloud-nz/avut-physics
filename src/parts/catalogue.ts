import { timber, type Piece } from "@/abseil-tower/tower";
import {
    BRAKE,
    C,
    foxPieces,
    HAWSER_R,
    line,
    PULLEY_COLORS,
    rigPulley,
    rigTrolley,
    TROLLEY_COLORS,
} from "@/flying-fox/fox";
import { bolt, carabiner, eyeBolt, pulley, sheave, wrap, zipTrolley } from "@/flying-fox/hardware";
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
                ...line([t.hang, t.hang.add(vec3(0, -0.25, 0))], 0.0055, C.dropper),
                ...line([t.backUp, t.backUp.add(vec3(-0.03, -0.22, 0))], 0.0055, C.dropper),
                ...line([t.backUp, t.backUp.add(vec3(-0.2, 0.03, 0))], 0.004, C.returnLine),
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

/** The pieces whose middles are inside the box from `lo` to `hi`, to look at one place in a whole rig. */
function within(pieces: Piece[], { lo, hi }: { lo: Vector3; hi: Vector3 }): Piece[] {
    return pieces.filter((p) => {
        const pts = p.kind === "rod" ? [p.a, p.b] : p.points;
        const c = pts.reduce((sum, q) => sum.add(q), vec3(0, 0, 0)).scale(1 / pts.length);
        return (
            c.x >= lo.x && c.x <= hi.x && c.y >= lo.y && c.y <= hi.y && c.z >= lo.z && c.z <= hi.z
        );
    });
}

export const GROUPS = [...new Set(PARTS.map((p) => p.group))];

export const partOf = (slug: string | null): Part => PARTS.find((p) => p.slug === slug) ?? PARTS[0];

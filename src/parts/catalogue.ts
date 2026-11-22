import { timber, type Piece } from "@/abseil-tower/tower";
import {
    C,
    HAWSER_R,
    line,
    PULLEY_COLORS,
    rigPulley,
    rigTrolley,
    TROLLEY_COLORS,
} from "@/flying-fox/fox";
import {
    bolt,
    carabiner,
    pulley,
    ring,
    RING,
    sheave,
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

export const PARTS: Part[] = [
    {
        slug: "carabiner",
        name: "Carabiner",
        group: "Hardware",
        about: "A screwgate carabiner, 110 mm long and 60 mm wide, its sleeve on the gate side.",
        pieces: () => carabiner(vec3(0, 0.055, 0), DOWN, ALONG, STEEL),
    },
    {
        slug: "ring",
        name: "Steel ring",
        group: "Hardware",
        about: `A welded steel ring, ${RING.r * 2000} mm across its bar's middle and ${RING.bar * 2000} mm bar.`,
        pieces: () => ring(ORIGIN, ALONG, UP, STEEL),
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
        name: "Return pulley in its ring",
        group: "Flying fox",
        about: "A return pulley as the flying fox hangs it: clipped into a steel ring welded to the tower's upright, the carabiner through the ring like links of a chain.",
        pieces: () => {
            const shs = 0.075;
            // The upright's platform-side face, with the ring standing out from it.
            const face = vec3(shs / 2, 0, 0);
            const mount = face.add(vec3(RING.r + 0.006, 0, 0));
            const [a, b] = [vec3(0.25, -0.25, -0.05), vec3(0.2, -0.28, 0.2)];
            const p = rigPulley(mount.add(vec3(0.02, -0.12, 0)), a, b, 0.004, mount, {
                ring: face,
            });
            const post = timber(vec3(0, -0.3, 0), vec3(0, 0.2, 0), ALONG, shs, shs, "steel").map(
                (q) => ({ ...q, color: STEEL }),
            );
            return [...post, ...p.pieces, ...line([a, ...p.round, b], 0.004, C.returnLine)];
        },
    },
];

export const GROUPS = [...new Set(PARTS.map((p) => p.group))];

export const partOf = (slug: string | null): Part => PARTS.find((p) => p.slug === slug) ?? PARTS[0];

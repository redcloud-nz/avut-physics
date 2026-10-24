import { G } from "@/lib/constants";
import { solveBelay, type Belayed } from "@/visualisations/body-belay-solver";
import { SURFACES } from "@/visualisations/body-belay-surfaces";

/*
 * The standing body belays article's figures, worked out by the body belay page's own solver, so they always match
 * what the page shows for the same settings. Each solve takes about a tenth of a second, too slow to do as the
 * site builds, so `npm run figures` saves them in standing-body-belays.figures.json, which the article reads.
 */

const STEEL = SURFACES.find((s) => s.key === "painted-steel")!;

/** The body belay page's defaults, in its units (masses in kg). */
const DEFAULTS = {
    /** A high cube shipping container. */
    wallHeight: 2.89,
    belayerBack: 3,
    gap: 2,
    belayerMass: 80,
    /** An 80 kg casualty in a Ferno Model 71 (13.5 kg with straps and footplate), with a blanket and lashings. */
    stretcherMass: 95,
    /** Dry painted steel, a shipping container's roof. */
    grip: STEEL.dry as number,
    /** A painted steel container rail. */
    edgeFriction: 0.2,
    teamDistance: 4,
    teamPull: 200,
};

type Case = Partial<typeof DEFAULTS>;

/** A training pair (a heavy belayer, a light mock casualty), a real one (a heavy casualty and their gear), and a
 * heavy belayer with a heavy casualty (kg). */
const PAIRS = {
    training: { belayer: 90, stretcher: 70 },
    real: { belayer: 70, stretcher: 120 },
    heavy: { belayer: 100, stretcher: 120 },
};

/** Belayers and stretchers of equal weight, from and to (kg), worked through 10 kg at a time. */
const EQUAL = { from: 40, to: 150, step: 10 };

/** The training loads shaded on the stretcher weight graph (kg). */
const TRAINING = { from: 45, to: 75 };

/** The stretcher weights (kg) the stretcher weight graph is drawn through. */
const GRAPH = { from: 40, to: 140, step: 5 };

/** The belayers' and stretchers' weights (kg) in the table of safety factors by weight. */
const WEIGHT_TABLE = { belayers: [60, 70, 80, 90, 100], stretchers: [75, 95, 115, 135] };

/** How far back from the edge the belayers stand, and how far apart (m), in the table of safety factors by placing. */
const PLACING_TABLE = { backs: [1.5, 2, 3, 4, 6], gaps: [0, 1, 2, 3, 4] };

/** The solver's whole arrangement, stretcher and belayers, for the page's defaults changed by `c`. */
function arrangement(c: Case = {}): Belayed {
    const i = { ...DEFAULTS, ...c };
    const r = solveBelay({
        wallHeight: i.wallHeight,
        belayerBack: i.belayerBack,
        gap: i.gap,
        belayerWeight: i.belayerMass * G,
        grip: i.grip,
        edgeFriction: i.edgeFriction,
        teamDistance: i.teamDistance,
        teamPull: i.teamPull,
        barLength: 2,
        barWeight: i.stretcherMass * G,
    });
    if (r.kind === "none")
        throw new Error(`The body belay solver found no arrangement for ${JSON.stringify(c)}`);
    return r;
}

/** One belayer's load in an arrangement. */
function load(b: Belayed) {
    return {
        /** Each rope's tension at the stretcher (N). */
        loadTension: b.loadTension,
        /** Each rope's tension at the belayer (N). */
        tension: b.tension,
        /** The ground's push up on each belayer's feet (N). */
        up: b.b.ground.y,
        /** The friction each belayer's feet must supply (N). */
        sideways: Math.hypot(b.b.ground.x, b.b.ground.z),
        /** The rope's pull down on each belayer (N). */
        ropeDown: -b.b.pull.y,
        gripNeeded: b.b.gripNeeded,
        /** How far each belayer leans back from upright (radians). */
        lean: b.b.lean,
        /** The footing's safety factor with this grip (the page's default unless given). */
        safety: b.b.safety,
        ropeAngle: b.ropeAngle,
        wrap: b.wrap,
    };
}

/** One belayer's load holding the stretcher still, with the edge's friction not counted, since it can act either way. */
const holding = (c: Case = {}) => load(arrangement({ ...c, edgeFriction: 0 }));

/**
 * The heaviest stretcher (kg, to the nearest 1, from 40 kg) the common case's belayers hold still with at least
 * `safety`, with the footing's friction coefficient `grip`.
 */
function heaviestAt(safety: number, grip: number = DEFAULTS.grip) {
    const holds = (m: number) => grip / holding({ stretcherMass: m }).gripNeeded >= safety;
    // The article reads "up to about m kg", which says nothing if even the lightest fails.
    if (!holds(40))
        throw new Error(`Even a 40 kg stretcher falls short of a safety factor of ${safety}`);
    // The safety factor only falls as the stretcher gets heavier, so step 10 kg at a time, then 1 kg.
    let m = 40;
    while (holds(m + 10)) m += 10;
    while (holds(m + 1)) m++;
    return m;
}

/** `from`, `from + step`, … up to `to`. */
const range = (r: { from: number; to: number; step: number }) =>
    Array.from({ length: Math.round((r.to - r.from) / r.step) + 1 }, (_, i) => r.from + i * r.step);

const point = (p: { x: number; y: number }) => ({ x: p.x, y: p.y });

export function compute() {
    const common = arrangement({ edgeFriction: 0 });
    const { l } = common;
    const pair = (p: { belayer: number; stretcher: number }) => ({
        ...p,
        safety: holding({ belayerMass: p.belayer, stretcherMass: p.stretcher }).safety,
    });
    const graphMasses = range(GRAPH);
    return {
        defaults: DEFAULTS,
        /** One belayer's load holding still in the common case. */
        hold: load(common),
        /** The common case's arrangement, side on, for drawing it (m). */
        scene: {
            feet: point(common.b.feet),
            anchor: point(l.anchor),
            wrapEdge: l.wrapEdge && point(l.wrapEdge),
            barEnd1: point(l.barEnd1),
            barEnd2: point(l.barEnd2),
            lineEdge: l.lineEdge && point(l.lineEdge),
            team: point(l.team),
        },
        pairs: { training: pair(PAIRS.training), real: pair(PAIRS.real), heavy: pair(PAIRS.heavy) },
        /** The least and most safety factor with belayers and stretcher of equal weight, over EQUAL's weights. */
        equal: (() => {
            const safety = range(EQUAL).map(
                (m) => holding({ belayerMass: m, stretcherMass: m }).safety,
            );
            return {
                from: EQUAL.from,
                to: EQUAL.to,
                least: Math.min(...safety),
                most: Math.max(...safety),
            };
        })(),
        training: {
            ...TRAINING,
            safety: [TRAINING.from, TRAINING.to].map((m) => holding({ stretcherMass: m }).safety),
        },
        /** The heaviest stretchers (kg) the common case holds still on dry steel with a safety factor of 2 and of 1,
         * and on wet steel with 1. */
        heaviest: {
            reachesTwo: heaviestAt(2),
            slides: heaviestAt(1),
            wetHolds: heaviestAt(1, STEEL.wet),
        },
        /** The grip needed holding still, by stretcher weight (kg). */
        graph: graphMasses.map((m) => ({
            mass: m,
            gripNeeded: holding({ stretcherMass: m, grip: STEEL.dry }).gripNeeded,
        })),
        weightTable: {
            ...WEIGHT_TABLE,
            safety: WEIGHT_TABLE.belayers.map((b) =>
                WEIGHT_TABLE.stretchers.map(
                    (m) => holding({ belayerMass: b, stretcherMass: m }).safety,
                ),
            ),
        },
        placingTable: {
            ...PLACING_TABLE,
            safety: PLACING_TABLE.backs.map((back) =>
                PLACING_TABLE.gaps.map((gap) => holding({ belayerBack: back, gap }).safety),
            ),
        },
    };
}

export type Figures = ReturnType<typeof compute>;

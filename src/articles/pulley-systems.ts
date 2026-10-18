import { solveLinear, type Matrix } from "@/lib/numeric";

/*
 * The pulley systems in Part 2 of A Gentle Introduction to Rescue Physics, and how they move and pull. Everything lies
 * along one line, as a haul system laid out on the ground does: positions are in metres from the anchor, increasing
 * towards the load. Ropes don't stretch and every part of a rope runs along that line. Without friction a pulley
 * passes on all of a rope's tension; with it, a share of it, whichever way the rope runs through.
 */

export type Body =
    | { kind: "anchor" }
    | { kind: "load"; x: number }
    /** A pulley, either fixed to the anchor or clipped to another body (`on`) and moving with it. */
    | { kind: "pulley"; x: number; fixed?: boolean; on?: string }
    /**
     * A rope grab: clamped to a rope at `y` in the drawing and moving with the body `on` (as a grab on the main line
     * moves with the load), or free, as the end of a rope.
     */
    | { kind: "grab"; x: number; y: number; on?: string }
    /** The end of the rope the team pulls on. */
    | { kind: "haul"; x: number };

/** A rope, through the bodies it runs between from one end to the other. `lanes` is each part's height in drawings. */
export type Rope = { path: string[]; lanes: number[] };

export type PulleySystem = { bodies: Record<string, Body>; ropes: Rope[] };

/** Each moving part's position, in metres from the anchor. */
export type Positions = Record<string, number>;

const startOf = (b: Body) => (b.kind === "anchor" ? 0 : b.x);

/** The body `id` moves with: itself if it moves freely, or null if it's fixed or is the haul end. */
function rootOf(sys: PulleySystem, id: string): string | null {
    const b = sys.bodies[id];
    if (b.kind === "anchor" || b.kind === "haul" || (b.kind === "pulley" && b.fixed)) return null;
    if ((b.kind === "pulley" || b.kind === "grab") && b.on) return rootOf(sys, b.on);
    return id;
}

/** The bodies that move freely, each carrying whatever's clipped to it. */
const freeBodies = (sys: PulleySystem) =>
    Object.keys(sys.bodies).filter((id) => rootOf(sys, id) === id);

/** Which way each part of a rope runs at the start, from one end to the other: +1 towards the load, −1 away. */
const directions = (sys: PulleySystem, rope: Rope) =>
    rope.path
        .slice(1)
        .map((id, i) => Math.sign(startOf(sys.bodies[id]) - startOf(sys.bodies[rope.path[i]])));

/** Which way the haul end moves as the team pulls: away from the pulley it leaves. */
function haulDirection(sys: PulleySystem) {
    for (const rope of sys.ropes) {
        const n = rope.path.length;
        if (sys.bodies[rope.path[n - 1]].kind === "haul") return directions(sys, rope)[n - 2];
    }
    throw new Error("No rope ends at the haul end");
}

/**
 * Where everything is once the team has pulled `pulled` metres of rope through their hands. Each rope keeps its
 * length, so for each the sum of its parts' changes in length is zero: one equation per rope, in each free body's
 * movement.
 */
export function hauled(sys: PulleySystem, pulled: number): Positions {
    const free = freeBodies(sys);
    const haul = haulDirection(sys) * pulled;
    const A: Matrix = sys.ropes.map(() => free.map(() => 0));
    const b = sys.ropes.map(() => 0);
    sys.ropes.forEach((rope, r) => {
        const s = directions(sys, rope);
        // A part from body i to body i + 1 lengthens by s (moved(i + 1) − moved(i)).
        const add = (id: string, k: number) => {
            const root = rootOf(sys, id);
            if (root !== null) A[r][free.indexOf(root)] += k;
            else if (sys.bodies[id].kind === "haul") b[r] -= k * haul;
        };
        s.forEach((si, i) => {
            add(rope.path[i + 1], si);
            add(rope.path[i], -si);
        });
    });
    const moved = solveLinear(A, b);
    if (!moved) throw new Error("The pulley system doesn't move in one way only");
    const at: Positions = {};
    for (const [id, body] of Object.entries(sys.bodies)) {
        const root = rootOf(sys, id);
        at[id] =
            startOf(body) +
            (root !== null ? moved[free.indexOf(root)] : body.kind === "haul" ? haul : 0);
    }
    return at;
}

/** How far the load moves for each metre of rope the team pulls in. */
export const loadPerMetre = (sys: PulleySystem) => {
    const id = loadOf(sys);
    return Math.abs(hauled(sys, 1)[id] - hauled(sys, 0)[id]);
};

const loadOf = (sys: PulleySystem) => {
    const id = Object.keys(sys.bodies).find((k) => sys.bodies[k].kind === "load");
    if (!id) throw new Error("No load");
    return id;
};

export type Pulls = {
    /** The tension in each part of each rope, for each pull of 1 from the team on the haul end. */
    tensions: number[][];
    /** How hard the load is pulled for each pull of 1 from the team: the mechanical advantage. */
    advantage: number;
    /**
     * How hard each body is pulled along the line, + towards the load, by the ropes on it and whatever's clipped to
     * it. A pulley's is the pull on its sling; the anchor's includes its pulleys.
     */
    pull: Record<string, number>;
};

/**
 * The tensions while the team hauls, with each pulley passing on `efficiency` of a rope's tension in the way the rope
 * runs through it. Each rope's parts' tensions are a multiple of its first part's, and those multiples come from which
 * way the rope runs through each pulley. Then each free body balances: what its ropes pull on it, plus the load's pull
 * on the load.
 */
export function pullsOf(sys: PulleySystem, efficiency = 1): Pulls {
    const before = hauled(sys, 0);
    const after = hauled(sys, 1);
    // Each part's tension as a multiple of its rope's first part's.
    const shares = sys.ropes.map((rope) => {
        const s = directions(sys, rope);
        const length = (at: Positions, n: number) =>
            s
                .slice(0, n)
                .reduce((sum, si, i) => sum + si * (at[rope.path[i + 1]] - at[rope.path[i]]), 0);
        const out = [1];
        for (let i = 1; i < s.length; i++) {
            // Rope on the first end's side of this pulley lengthening means it runs that way, so that side pulls harder.
            const runs = length(after, i) - length(before, i);
            const k = runs > 1e-12 ? efficiency : runs < -1e-12 ? 1 / efficiency : 1;
            out.push(out[i - 1] * k);
        }
        return out;
    });

    const free = freeBodies(sys);
    const load = loadOf(sys);
    const hauling = sys.ropes.findIndex(
        (rope) => sys.bodies[rope.path[rope.path.length - 1]].kind === "haul",
    );
    // Unknowns: each rope's first part's tension except the hauling rope's (set by the team's pull of 1), and the load.
    const unknown = sys.ropes.map((_, r) => r).filter((r) => r !== hauling);
    const first = (r: number) => 1 / shares[r][shares[r].length - 1];
    const A: Matrix = free.map(() => [...unknown.map(() => 0), 0]);
    const b = free.map(() => 0);
    sys.ropes.forEach((rope, r) => {
        directions(sys, rope).forEach((si, i) => {
            // A part pulls each of its ends towards the other.
            for (const [id, sign] of [
                [rope.path[i], si],
                [rope.path[i + 1], -si],
            ] as const) {
                const root = rootOf(sys, id);
                if (root === null) continue;
                const row = free.indexOf(root);
                if (r === hauling) b[row] -= sign * shares[r][i] * first(r);
                else A[row][unknown.indexOf(r)] += sign * shares[r][i];
            }
        });
    });
    // The load pulls its body away from the anchor.
    A[free.indexOf(load)][unknown.length] = 1;
    const solved = solveLinear(A, b);
    if (!solved) throw new Error("The pulley system's pulls don't balance in one way only");

    const firsts = sys.ropes.map((_, r) => (r === hauling ? first(r) : solved[unknown.indexOf(r)]));
    const tensions = shares.map((s, r) => s.map((k) => k * firsts[r]));

    // Each body's pull from its own ropes, then everything clipped to it added on.
    const own: Record<string, number> = Object.fromEntries(
        Object.keys(sys.bodies).map((id) => [id, 0]),
    );
    sys.ropes.forEach((rope, r) =>
        directions(sys, rope).forEach((si, i) => {
            own[rope.path[i]] += si * tensions[r][i];
            own[rope.path[i + 1]] -= si * tensions[r][i];
        }),
    );
    const carriedBy = (id: string): string | null => {
        const body = sys.bodies[id];
        if (body.kind === "pulley" && body.fixed) return "anchor";
        if ((body.kind === "pulley" || body.kind === "grab") && body.on) return body.on;
        return null;
    };
    const pull = (id: string): number =>
        Object.keys(sys.bodies)
            .filter((k) => carriedBy(k) === id)
            .reduce((sum, k) => sum + pull(k), own[id]);

    return {
        tensions,
        advantage: solved[unknown.length],
        pull: Object.fromEntries(Object.keys(sys.bodies).map((id) => [id, pull(id)])),
    };
}

/* The systems in the article, laid out as their figures draw them. Parts of a rope are 28 apart in the drawing. */

/** A pulley on the anchor turning the rope back: 1:1. */
export const REDIRECT: PulleySystem = {
    bodies: {
        anchor: { kind: "anchor" },
        p1: { kind: "pulley", x: 0.9, fixed: true },
        load: { kind: "load", x: 4 },
        haul: { kind: "haul", x: 4.3 },
    },
    ropes: [{ path: ["load", "p1", "haul"], lanes: [40, 68] }],
};

/** A rope tied to the anchor, round a pulley on the load and back: 2:1. */
export const TWO_TO_ONE: PulleySystem = {
    bodies: {
        anchor: { kind: "anchor" },
        load: { kind: "load", x: 4 },
        m1: { kind: "pulley", x: 3.75, on: "load" },
        haul: { kind: "haul", x: 1 },
    },
    ropes: [{ path: ["anchor", "m1", "haul"], lanes: [40, 68] }],
};

/** The Z-rig: the main line round a pulley on the anchor, and back round one on a rope grab on the main line: 3:1. */
export const Z_RIG: PulleySystem = {
    bodies: {
        anchor: { kind: "anchor" },
        p1: { kind: "pulley", x: 0.9, fixed: true },
        load: { kind: "load", x: 4 },
        g1: { kind: "grab", x: 3.35, y: 40, on: "load" },
        p2: { kind: "pulley", x: 3.15, on: "g1" },
        haul: { kind: "haul", x: 1 },
    },
    ropes: [{ path: ["load", "p1", "p2", "haul"], lanes: [40, 68, 96] }],
};

/** A 2:1 on a rope grab on the Z-rig's haul line: 6:1. */
export const SIX_TO_ONE: PulleySystem = {
    bodies: {
        ...Z_RIG.bodies,
        g2: { kind: "grab", x: 2.6, y: 96 },
        m2: { kind: "pulley", x: 2.3, on: "g2" },
    },
    ropes: [
        { path: ["load", "p1", "p2", "g2"], lanes: [40, 68, 96] },
        { path: ["anchor", "m2", "haul"], lanes: [124, 152] },
    ],
};

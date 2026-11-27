import { vec3, type Vector3 } from "@/lib/vector3";

/**
 * What the 3D scenes are built from (the abseil tower, the flying fox, the parts): pieces to draw, each a rod, a face
 * or a strand, in a material that sets its colour unless it gives its own, and the labels written on them. The 3D view
 * (`scene-gl.tsx`) and the flat views (`piece-svg.tsx`) both draw them.
 */

/** What a piece is made of, which sets its colour. */
export type Material =
    | "log"
    | "rail"
    | "board"
    | "deck"
    | "steel"
    | "sling"
    | "rope"
    | "bucket"
    | "person";

/** Each material's colour, for a piece that doesn't give its own. */
export const MATERIAL_COLOR: Record<Material, string> = {
    log: "var(--tower-log)",
    rail: "var(--tower-rail)",
    board: "var(--tower-board)",
    deck: "var(--tower-deck)",
    steel: "var(--tower-steel)",
    sling: "var(--knot-yellow)",
    rope: "var(--knot-blue)",
    bucket: "var(--rig-black)",
    person: "var(--rig-person)",
};

/** How wide the gaps between boards are (metres); the flat views draw them no thinner than a pixel. */
export const JOINT_GAP = 0.01;

/** A round piece (a log, a rail or a pipe): a cylinder from `a` to `b`, drawn with a rounded end where `capA`/`capB`. */
export type Rod = {
    kind: "rod";
    a: Vector3;
    b: Vector3;
    r: number;
    material: Material;
    capA: boolean;
    capB: boolean;
    /** A colour in place of its material's (a rig's slings and ropes each have their own). */
    color?: string;
};

/**
 * A flat piece (a deck, boarding, a tread, or one side of a sawn timber): a convex polygon, with level board joints
 * `planks` apart if it has them. A side of a timber has its outward `normal`, so it's left out when it faces away, and
 * its edges drawn.
 */
export type Face = {
    kind: "face";
    points: Vector3[];
    material: Material;
    planks?: number;
    /** The way the boards' joints step across it (straight up unless given: level joints). */
    joints?: Vector3;
    normal?: Vector3;
    /** Its colour, where it isn't its material's. */
    color?: string;
    /** A short label written in its middle, drawn with it so what's in front of it covers both. */
    text?: string;
    /** Holes through it (a plate's), each a loop of points in its plane. */
    holes?: Vector3[][];
    /**
     * A colour at each corner (CSS, one per point), blended across the face in 3D, as for ground that shades smoothly
     * from grass to bare; the flat views keep to `color`.
     */
    shades?: string[];
};

/**
 * Where a piece is in the tower's shell, for the back-to-front sort: `layer` 1 is on one of its sides (railings, beams,
 * corner posts), 2 the boarding outside that, and 3 what sticks out past it (log ends, the outrigger), with
 * `out` the way that side faces. Pieces on a side facing the eye are drawn after everything inside, and those on a side
 * facing away before it. Pieces with no shell are inside.
 */
export type Shell = { out: Vector3; layer: number };

/**
 * A run of rope, tape or wire through `points`, drawn as one line so it bends without showing joins. It sorts as one
 * piece, so long or wrapping runs are split into a few strands.
 */
export type Strand = {
    kind: "strand";
    points: Vector3[];
    r: number;
    material: Material;
    color?: string;
    /** Whether each end is a real end, drawn rounded, or a join to the next strand, drawn so it doesn't show. */
    capA: boolean;
    capB: boolean;
    /**
     * Whether a real end is a cut end of rope, squared off and fused black as by a hot knife, rather than rounded.
     * Only the 3D view draws the difference.
     */
    cutA?: boolean;
    cutB?: boolean;
    /**
     * A shape many strands share (a chain's links), about its own origin: `points` are it moved and turned into place.
     * The 3D view builds it once and draws it at each place it's used, checking from `points` where that is, so pieces
     * moved or turned after they're built still draw right (and any not simply moved and turned are drawn on their own).
     */
    shape?: Vector3[];
    /**
     * Flat tape, for the views that can draw it so: `layers` of it side by side, each `width` wide (lying `across`) and
     * `thickness` thick, fanned apart where they run round what they're on and gathered together at `gather` (a
     * carabiner), over the last `ramp` metres to it.
     */
    tape?: {
        width: number;
        thickness: number;
        across: Vector3;
        layers: number;
        gather: Vector3;
        ramp: number;
        /**
         * Its width and thickness at each point, in place of `width` and `thickness` (as where it bunches up), and the
         * way its width lies there, in place of `across` (as where it twists).
         */
        profile?: { width: number; thickness: number; across?: Vector3 }[];
    };
};

/**
 * Where a piece of a group sorts, for the back-to-front sort: the group's middle `at`, so the group sorts as one, then
 * `ahead` (a direction: the piece comes in front of the rest of its group when it faces the eye), then the piece's own
 * middle; `over` puts a piece over the rest of its group from every side. A railing's pieces are a group, so its posts
 * keep one order against its boards whatever their position, and a stair railing's newels cover its rails' ends.
 */
export type Group = {
    at: Vector3;
    ahead?: Vector3;
    over?: boolean;
    /** Other groups' middles it lies across too (a coil over two deck boards): it sorts with the nearest of them all. */
    across?: Vector3[];
    /** Where it comes among the rest of its group, whatever the view: higher over lower (a carabiner's grip over its sleeve). */
    order?: number;
};

export type Piece = (Rod | Face | Strand) & {
    shell?: Shell;
    group?: Group;
    /**
     * The size of the detail it adds (metres): a plate's edge, a bolt's head. The flat views leave it out when it would
     * be drawn too small to see.
     */
    fine?: number;
    /** Hardware: drawn its true size however far off, never thickened to stay visible as ropes and wire are. */
    toScale?: boolean;
};

/** A piece's points: a rod's two ends, or a face's or strand's points. */
export const piecePoints = (p: Piece): Vector3[] => (p.kind === "rod" ? [p.a, p.b] : p.points);

/**
 * The centrelines of a tape strand's layers: side by side `across`, a little more than the tape's width apart where
 * they run round what they're on, closing in to almost touching at the carabiner they gather at.
 */
export function tapeLayers(p: Strand): Vector3[][] {
    if (!p.tape) return [p.points];
    const { width, layers, gather, ramp } = p.tape;
    const across = p.tape.across.unit();
    const pitch = width + 0.004;
    return Array.from({ length: layers }, (_, k) => {
        const slot = k - (layers - 1) / 2;
        return p.points.map((q) => {
            const spread = 0.15 + 0.85 * Math.min(1, q.distanceTo(gather) / ramp);
            return q.add(across.scale(slot * pitch * spread));
        });
    });
}

const UP = vec3(0, 1, 0);

/** Long pieces are cut into lengths no longer than this, so the back-to-front sort can put each in its place. */
const PIECE = 0.6;

/** A rod cut into short lengths, rounded only at its two real ends. The rigs use it too. */
export function rod(
    a: Vector3,
    b: Vector3,
    r: number,
    material: Material,
    maxPiece = PIECE,
): Rod[] {
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / maxPiece));
    return Array.from({ length: n }, (_, i) => ({
        kind: "rod",
        a: a.lerp(b, i / n),
        b: a.lerp(b, (i + 1) / n),
        r,
        material,
        capA: i === 0,
        capB: i === n - 1,
    }));
}

/**
 * A sawn timber from `a` to `b` (the middles of its ends), `w` wide and `h` deep, its depth as near `up` as it can be:
 * its four long sides, and its two ends unless they're hidden (`ends` false). With `round`, its long edges are rounded
 * to that radius (as a steel section's are), each in a few narrow faces.
 */
export function timber(
    a: Vector3,
    b: Vector3,
    up: Vector3,
    w: number,
    h: number,
    material: Material,
    withEnds = true,
    round = 0,
): Face[] {
    const along = b.sub(a).unit();
    const v = up.sub(along.scale(up.dot(along))).unit();
    const s = along.cross(v).unit();
    // Its outline, anticlockwise from the corner at -s, -v: round each corner in `steps` faces, or square.
    const r = Math.min(round, w / 2, h / 2);
    const steps = r > 0 ? 3 : 0;
    const outline = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
    ].flatMap(([i, j], k) =>
        Array.from({ length: steps + 1 }, (_, m) => {
            const t = Math.PI * (1 + k / 2 + m / (2 * Math.max(steps, 1)));
            return [i * (w / 2 - r) + r * Math.cos(t), j * (h / 2 - r) + r * Math.sin(t)];
        }).slice(0, r > 0 ? steps + 1 : 1),
    );
    const at = (p: Vector3, [x, y]: number[]) => p.add(s.scale(x)).add(v.scale(y));
    const sides: Face[] = outline.map((P, k) => {
        const Q = outline[(k + 1) % outline.length];
        return {
            kind: "face",
            points: [at(a, P), at(b, P), at(b, Q), at(a, Q)],
            material,
            normal: s
                .scale(Q[1] - P[1])
                .sub(v.scale(Q[0] - P[0]))
                .unit(),
        };
    });
    const ends: Face[] = [
        { kind: "face", points: outline.map((P) => at(a, P)), material, normal: along.neg() },
        { kind: "face", points: outline.map((P) => at(b, P)), material, normal: along },
    ];
    return withEnds ? [...sides, ...ends] : sides;
}

/** Where board joints `spacing` apart cross a convex face, stepping across it along its `joints`, as pairs of points. */
export function plankLines(f: Face, spacing: number): [Vector3, Vector3][] {
    const dir = f.joints ?? UP;
    const hs = f.points.map((p) => p.dot(dir));
    const lines: [Vector3, Vector3][] = [];
    for (
        let h = Math.ceil(Math.min(...hs) / spacing + 1e-9) * spacing;
        h < Math.max(...hs) - 1e-9;
        h += spacing
    ) {
        const hits: Vector3[] = [];
        f.points.forEach((a, i) => {
            const j = (i + 1) % f.points.length;
            const [ha, hb] = [hs[i], hs[j]];
            if ((ha - h) * (hb - h) < 0) hits.push(a.lerp(f.points[j], (h - ha) / (hb - ha)));
        });
        if (hits.length === 2) lines.push([hits[0], hits[1]]);
    }
    return lines;
}

/**
 * A label to draw at a point on the rig. One `on` a cylinder (its direction, length and radius) is written along it:
 * on it where it's drawn big enough, beside it otherwise.
 */
export type RigLabel = {
    at: Vector3;
    text: string;
    on?: { along: Vector3; length: number; r: number };
    /** Written light on a dark cylinder, not dark on a light one. */
    light?: boolean;
    /** How big it's written in 3D, as a fraction of the most that fits on what it's on (all of it unless given). */
    size?: number;
    /** How tall its letters are written in 3D (metres), in place of fitting them to what it's on. */
    font?: number;
    /** Where it is in the tower's shell, as what it's written on is, so it sorts with it. */
    shell?: Piece["shell"];
    /** Which side of it an elevation writes it, if not the side of the drawing it's on. */
    side?: "left" | "right";
    /** Which side of it a view looking down writes it, above (north) or below, if not beside it. */
    plan?: "above" | "below";
};

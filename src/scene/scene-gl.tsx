"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ComponentRef,
    type ReactNode,
    type RefObject,
} from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { Line, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";

import { rad } from "@/lib/math";
import { vec3, type Vector3 } from "@/lib/vector3";

import { BOUNDS, FLIPS, type FrameRate } from "./detail";
import Loading3D from "./loading-3d";
import type { RigLabel } from "./pieces";
import {
    JOINT_GAP,
    MATERIAL_COLOR,
    plankLines,
    tapeLayers,
    type Face,
    type Material,
    type Piece,
    type Strand,
} from "./pieces";

/**
 * A scene of pieces in 3D drawn with WebGL: the same pieces as the SVG views, as shaded solids, so whatever's nearer
 * covers what's behind it however they cross. Scene points are compass (x east, y up, z north); three.js wants a right-handed
 * frame, so z is turned round to point south as they go in.
 */
export const T = (p: Vector3) => new THREE.Vector3(p.x, p.y, -p.z);

/** The thinnest some things are drawn (metres of radius), by their material. */
type MinR = Partial<Record<Material, number>>;

/** What the page around it can do to the view: zoom, go back to where it started, or look from a bearing. */
export type GLHandle = {
    zoomBy: (factor: number) => void;
    reset: () => void;
    look: (azimuth: number, elevation: number) => void;
};

/**
 * A point the view's locked onto: it turns about it and zooms towards it, and can't be moved off it. The view eases
 * there, keeping the way it's looking, to `distance` (metres) out from it, and zooms out no further than `FOCUS_OUT`
 * times that.
 */
export type Focus = {
    centre: Vector3;
    distance: number;
    /** For something that moves: how far it's moved from `centre` now, read each frame so the view follows it. */
    moving?: () => Vector3;
    /**
     * Where the point the view turns about may be moved to while it's locked on, as a box (scene coordinates): an axis
     * the box has no depth in stays put, so a tall thing can be panned only up and down. None: it can't be moved off.
     */
    pan?: { lo: Vector3; hi: Vector3 };
};

/** Where a focus is now, moved on from its centre if it moves. */
const focusPoint = (focus: Focus) =>
    T(focus.moving ? focus.centre.add(focus.moving()) : focus.centre);
/** How many times its starting distance out a view locked onto a focus may zoom. */
export const FOCUS_OUT = 2;

/**
 * Where someone stands in the scene, their eye `at`, first looking towards `lookAt`. Standing there, the view turns
 * about the eye, as they'd turn their head, and zooms by narrowing or widening what it takes in; it can't move.
 */
export type Stance = { at: Vector3; lookAt: Vector3; fov?: number };
/**
 * How wide a standing view takes in to start with (degrees high, unless its stance gives its own `fov`), and how narrow
 * and wide it zooms.
 */
const STANCE_FOV = { start: 55, least: 15, most: 80 };

/** What a standing view does when the page's zoom and back-to-start buttons are pressed. */
type StanceButtons = { zoomBy: (factor: number) => void; reset: () => void };

/**
 * What a 3D scene needs besides its pieces: where the camera turns about to start with, how far from it it sits and
 * which way it looks from (degrees: the compass bearing to the eye, and how far above level), how far out it may zoom,
 * the ground, the compass letters round it and how tall they're drawn, the thinnest each material's drawn (metres of
 * radius), how many pixels wide thin pieces' centrelines are also drawn (if at all), so they still show from far off,
 * and whether the point it turns about moves to the depth of whatever's under the pointer as it's zoomed or dragged, as
 * a long scene needs.
 */
export type SceneConfig = {
    centre: Vector3;
    distance: number;
    azimuth: number;
    elevation: number;
    maxDistance: number;
    ground: Piece[];
    compass: [string, Vector3][];
    letter: number;
    minR: MinR;
    hairlines?: number;
    pivotToPointer?: boolean;
    /** How wide the scene is across the starting view (metres): on a narrow screen it starts far enough out to fit. */
    width?: number;
    /** What the canvas is, for a screen reader. */
    label: string;
    /** How close the camera may come (metres; 1.5 unless given), for a scene of small parts. */
    minDistance?: number;
    /** Whether it may look up from below the ground's level, as at a part with no ground. */
    below?: boolean;
    /** The box the point the view turns about stays inside, so the scene can't be moved out of sight. */
    bounds?: { lo: Vector3; hi: Vector3 };
    /** How many times its starting distance out it may zoom, as well as no further than `maxDistance`. */
    zoomOut?: number;
};

/** A scene's `bounds` in three.js's coordinates (z flipped), as a box. */
function boundsBox(scene: SceneConfig): THREE.Box3 | null {
    if (!scene.bounds) return null;
    const [a, b] = [T(scene.bounds.lo), T(scene.bounds.hi)];
    return new THREE.Box3(a.clone().min(b), a.clone().max(b));
}

const FOV = 30;

/**
 * How far out the camera starts on a screen `aspect` wide for each unit high: the scene's own distance, or further on a
 * narrow screen, far enough to fit the scene's width across it.
 */
function startDistance(scene: SceneConfig, aspect: number) {
    if (!scene.width) return scene.distance;
    const across = Math.tan(rad(FOV / 2)) * aspect;
    // No further than the scene lets it zoom out, with a little room to spare.
    return Math.min(Math.max(scene.distance, scene.width / 2 / across), scene.maxDistance / 1.2);
}

/** Where the camera sits for a compass bearing to the eye and a height above level (degrees). */
function eyeAt(target: THREE.Vector3, distance: number, azimuth: number, elevation: number) {
    const [a, e] = [rad(azimuth), rad(elevation)];
    const out = vec3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
    return target.clone().add(T(out).multiplyScalar(distance));
}

/** Turns CSS colours (tokens, `color-mix`, anything) into three.js colours, by letting the browser work them out. */
function colorReader(box: HTMLElement) {
    const probe = document.createElement("span");
    probe.style.display = "none";
    box.appendChild(probe);
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const seen = new Map<string, THREE.Color>();
    const read = (css: string) => {
        const known = seen.get(css);
        if (known) return known;
        probe.style.color = css;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = getComputedStyle(probe).color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        const color = new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
        seen.set(css, color);
        return color;
    };
    const font = getComputedStyle(box).getPropertyValue("--font-geist-mono") || "monospace";
    return { read, font, dispose: () => probe.remove() };
}
export type Colors = ReturnType<typeof colorReader>;

const ColorsContext = createContext<Colors | null>(null);

/** The scene's colour reader, for what's drawn inside a `SceneGL` as its children. */
export function useSceneColors(): Colors {
    const colors = useContext(ColorsContext);
    if (!colors) throw new Error("useSceneColors is only for a SceneGL's children");
    return colors;
}

/** How many sides a rope's or rod's tube has, unless a scene asks for more or fewer. */
const SIDES = 10;

/** A cylinder from `a` to `b` (three.js points), with a ball on each real end. */
/**
 * A rod's solid: a tube with rounded ends where `capA`/`capB`, or for hardware (`flat`), a closed cylinder with flat
 * ends and more sides, as a bolt or a sheave is.
 */
function rodGeometry(
    a: THREE.Vector3,
    b: THREE.Vector3,
    r: number,
    capA: boolean,
    capB: boolean,
    flat = false,
    sides = SIDES,
) {
    const along = b.clone().sub(a);
    const length = along.length();
    const parts: THREE.BufferGeometry[] = [];
    if (length > 1e-6) {
        const tube = new THREE.CylinderGeometry(r, r, length, flat ? 2 * sides : sides, 1, !flat);
        tube.applyQuaternion(
            new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                along.normalize(),
            ),
        );
        tube.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        parts.push(tube);
    }
    for (const [cap, p] of [
        [capA, a],
        [capB, b],
    ] as const)
        if (cap && !flat)
            parts.push(new THREE.SphereGeometry(r, sides, 6).translate(p.x, p.y, p.z));
    return parts.map(bare);
}

/** A tube of radius `r` along a polyline, its rings kept square to the line as it bends. */
export function tubeGeometry(
    points: THREE.Vector3[],
    r: number,
    sides = SIDES,
): THREE.BufferGeometry | null {
    const pts = points.filter((p, i) => i === 0 || p.distanceTo(points[i - 1]) > 1e-6);
    if (pts.length < 2) return null;
    // A closed loop (a ring, a carabiner) turns smoothly through where it starts and ends, so no seam shows there.
    const last = pts.length - 1;
    const closed = last > 2 && pts[0].distanceTo(pts[last]) < 1e-6;
    const tangent = (i: number) => {
        const next = i < last ? pts[i + 1] : closed ? pts[1] : pts[last];
        const prev = i > 0 ? pts[i - 1] : closed ? pts[last - 1] : pts[0];
        return next.clone().sub(prev).normalize();
    };
    // A first ring direction square to the line, then carried along it.
    const t0 = tangent(0);
    const helper = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    let n = helper.cross(t0).normalize();
    const position: number[] = [];
    const normal: number[] = [];
    // Turned with the line from each point to the next (rather than squared to it, which drifts), so a loop's last
    // ring comes back round to its first.
    const turn = new THREE.Quaternion();
    let before = t0;
    pts.forEach((p, i) => {
        const t = tangent(i);
        n = n.applyQuaternion(turn.setFromUnitVectors(before, t));
        n = n.sub(t.clone().multiplyScalar(n.dot(t))).normalize();
        before = t;
        const b = t.clone().cross(n);
        for (let k = 0; k < sides; k++) {
            const th = (2 * Math.PI * k) / sides;
            const dir = n
                .clone()
                .multiplyScalar(Math.cos(th))
                .add(b.clone().multiplyScalar(Math.sin(th)));
            position.push(p.x + r * dir.x, p.y + r * dir.y, p.z + r * dir.z);
            normal.push(dir.x, dir.y, dir.z);
        }
    });
    const index: number[] = [];
    for (let i = 0; i < pts.length - 1; i++)
        for (let k = 0; k < sides; k++) {
            const [a, b] = [i * sides + k, i * sides + ((k + 1) % sides)];
            const [c, d] = [a + sides, b + sides];
            // Wound anticlockwise seen from outside, so the faces' fronts are outside the tube.
            index.push(a, b, c, b, d, c);
        }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
    g.setIndex(index);
    return g;
}

/**
 * A flat ribbon along a polyline: `width` wide lying as near `across` as it can, square to the line, and `thickness`
 * thick. Each of its four sides has its own normals, so it shades flat.
 */
function ribbonGeometry(
    points: THREE.Vector3[],
    across: THREE.Vector3,
    width: number,
    thickness: number,
    profile?: { width: number; thickness: number; across?: THREE.Vector3 }[],
): THREE.BufferGeometry | null {
    const keep = points.map((p, i) => i === 0 || p.distanceTo(points[i - 1]) > 1e-6);
    const pts = points.filter((_, i) => keep[i]);
    const sizes: { width: number; thickness: number; across?: THREE.Vector3 }[] = (
        profile ?? points.map(() => ({ width, thickness }))
    ).filter((_, i) => keep[i]);
    if (pts.length < 2) return null;
    const tangent = (i: number) =>
        pts[Math.min(i + 1, pts.length - 1)]
            .clone()
            .sub(pts[Math.max(i - 1, 0)])
            .normalize();
    // Each point's half-width and half-thickness directions.
    const frames = pts.map((_, i) => {
        const t = tangent(i);
        const w = (sizes[i].across ?? across)
            .clone()
            .sub(t.clone().multiplyScalar(across.dot(t)))
            .normalize();
        const n = t.clone().cross(w);
        return {
            w: w.multiplyScalar(sizes[i].width / 2),
            n: n.multiplyScalar(sizes[i].thickness / 2),
        };
    });
    const position: number[] = [];
    const normal: number[] = [];
    const index: number[] = [];
    // The four sides: the two faces (±n) and the two edges (±w), each a strip of quads.
    for (const [sw, sn, face] of [
        [1, 1, "n"],
        [-1, -1, "n"],
        [1, -1, "w"],
        [-1, 1, "w"],
    ] as const) {
        const base = position.length / 3;
        pts.forEach((p, i) => {
            const { w, n } = frames[i];
            // A side's two corners: across the face for a face, through the thickness for an edge.
            const corners =
                face === "n"
                    ? [w.clone().multiplyScalar(-sw), w.clone().multiplyScalar(sw)]
                    : [n.clone().multiplyScalar(-sn), n.clone().multiplyScalar(sn)];
            const off = face === "n" ? n.clone().multiplyScalar(sn) : w.clone().multiplyScalar(sw);
            const dir = (face === "n" ? n : w)
                .clone()
                .normalize()
                .multiplyScalar(face === "n" ? sn : sw);
            for (const c of corners) {
                const q = p.clone().add(off).add(c);
                position.push(q.x, q.y, q.z);
                normal.push(dir.x, dir.y, dir.z);
            }
        });
        for (let i = 0; i < pts.length - 1; i++) {
            const [a, b, c, d] = [
                base + 2 * i,
                base + 2 * i + 1,
                base + 2 * i + 2,
                base + 2 * i + 3,
            ];
            index.push(a, c, b, b, c, d);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
    g.setIndex(index);
    return g;
}

/** A flat convex polygon, as a fan of triangles. */
function faceGeometry(
    points: THREE.Vector3[],
    holes: THREE.Vector3[][] = [],
): THREE.BufferGeometry {
    const [p0, p1, p2] = points;
    // A face with holes, or more corners than a quad (perhaps concave, as a cut plate's outline), is cut into
    // triangles properly; a triangle or quad is simply fanned.
    const cut = holes.length > 0 || points.length > 4;
    const n = cut ? newell(points) : p1.clone().sub(p0).cross(p2.clone().sub(p0)).normalize();
    const all = [...points, ...holes.flat()];
    const g = new THREE.BufferGeometry();
    g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            all.flatMap((p) => p.toArray()),
            3,
        ),
    );
    g.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(
            all.flatMap(() => n.toArray()),
            3,
        ),
    );
    const index: number[] = [];
    if (cut) {
        // Laid flat in its own plane, and cut into triangles round its holes (its outline may be concave too).
        const u = p1.clone().sub(p0).normalize();
        const v = n.clone().cross(u);
        const flat = (p: THREE.Vector3) => {
            const d = p.clone().sub(p0);
            return new THREE.Vector2(d.dot(u), d.dot(v));
        };
        const tris = THREE.ShapeUtils.triangulateShape(
            points.map(flat),
            holes.map((h) => h.map(flat)),
        );
        for (const [a, b, c] of tris) index.push(a, b, c);
    } else for (let i = 1; i < points.length - 1; i++) index.push(0, i, i + 1);
    g.setIndex(index);
    return g;
}

/** A polygon's unit normal by Newell's method, which holds for a concave one. */
function newell(points: THREE.Vector3[]): THREE.Vector3 {
    const n = new THREE.Vector3();
    points.forEach((p, i) => {
        const q = points[(i + 1) % points.length];
        n.x += (p.y - q.y) * (p.z + q.z);
        n.y += (p.z - q.z) * (p.x + q.x);
        n.z += (p.x - q.x) * (p.y + q.y);
    });
    return n.normalize();
}

/** A geometry with only positions and normals, so any of them merge together. */
function bare(g: THREE.BufferGeometry): THREE.BufferGeometry {
    for (const name of Object.keys(g.attributes))
        if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    return g;
}

/**
 * A rope's cut end at `at`, the rope arriving along `dir`: squared off and fused, as cut with a hot knife. A short band
 * a touch fatter than the rope, where it melted, and its end face, a little ragged.
 */
function cutEnd(
    at: THREE.Vector3,
    dir: THREE.Vector3,
    r: number,
    sides: number,
): THREE.BufferGeometry[] {
    const fat = r * 1.06;
    const band = tubeGeometry(
        [at.clone().sub(dir.clone().multiplyScalar(Math.max(0.003, r * 0.6))), at],
        fat,
        sides,
    );
    // The face: a fan from its middle, its rim a little uneven (the same unevenness every time, so it doesn't flicker).
    const helper = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = helper.clone().cross(dir).normalize();
    const v = dir.clone().cross(u);
    const rim = 2 * sides;
    const position = [at.x, at.y, at.z];
    const normal = [dir.x, dir.y, dir.z];
    for (let k = 0; k < rim; k++) {
        const th = (2 * Math.PI * k) / rim;
        const rough = fat * (1 + 0.07 * Math.sin(5 * th + 1.3) * Math.cos(3 * th));
        const p = at
            .clone()
            .add(u.clone().multiplyScalar(rough * Math.cos(th)))
            .add(v.clone().multiplyScalar(rough * Math.sin(th)))
            .add(dir.clone().multiplyScalar(0.0004 * Math.sin(7 * th)));
        position.push(p.x, p.y, p.z);
        normal.push(dir.x, dir.y, dir.z);
    }
    const index: number[] = [];
    for (let k = 0; k < rim; k++) index.push(0, 1 + k, 1 + ((k + 1) % rim));
    const face = new THREE.BufferGeometry();
    face.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    face.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
    face.setIndex(index);
    return [band, face].filter((g): g is THREE.BufferGeometry => !!g);
}

/** What a gap's colour key starts with, before the colour of its boards. */
const JOINT = "joint:";

/**
 * Every piece's solid, merged into one geometry per colour, and the gaps between boards as strips, merged per colour
 * of the boards they're between. `only` builds just the faces (`flat`, the same however many sides tubes have) or just
 * the rods and strands (`round`).
 */
export function buildScene(pieces: Piece[], minR: MinR, sides = SIDES, only?: "flat" | "round") {
    const byColor = new Map<string, THREE.BufferGeometry[]>();
    // Faces shaded corner to corner, gathered into one mesh, with their corners' colours in order.
    const shadedParts: THREE.BufferGeometry[] = [];
    const shades: string[] = [];
    const add = (color: string, g: THREE.BufferGeometry | null) => {
        if (!g) return;
        const list = byColor.get(color) ?? [];
        list.push(g);
        byColor.set(color, list);
    };
    // Shapes drawn many times: each built once, with where each copy goes.
    const copies = new Map<
        string,
        { parts: Map<string, THREE.BufferGeometry[]>; places: THREE.Matrix4[] }
    >();
    for (const p of pieces) {
        if (only && (p.kind === "face") !== (only === "flat")) continue;
        const color = p.color || MATERIAL_COLOR[p.material];
        // Hardware's drawn its true size; ropes and wire no thinner than the scene's least.
        const r = p.toScale
            ? "r" in p
                ? p.r
                : 0
            : Math.max("r" in p ? p.r : 0, minR[p.material] ?? 0);
        if (p.kind === "rod")
            for (const g of rodGeometry(T(p.a), T(p.b), r, p.capA, p.capB, p.toScale, sides))
                add(color, g);
        else if (p.kind === "strand" && p.tape) {
            // Flat tape: its layers side by side, fanned apart round the beam and gathered at the carabiner.
            const across = T(p.tape.across).normalize();
            for (const layer of tapeLayers(p))
                add(
                    color,
                    ribbonGeometry(
                        layer.map(T),
                        across,
                        p.tape.width,
                        p.tape.thickness,
                        p.tape.profile?.map((q) => ({
                            ...q,
                            across: q.across && T(q.across).normalize(),
                        })),
                    ),
                );
        } else if (p.kind === "strand") {
            // A shape many strands share, simply moved and turned into place (and drawn its own size): built once.
            const place = p.shape && r === p.r ? placeOf(p.shape, p.points) : null;
            if (p.shape && place) {
                const key = `${shapeId(p.shape)} ${color} ${r} ${[p.capA, p.capB, p.cutA, p.cutB].map((b) => +!!b).join("")}`;
                let copy = copies.get(key);
                if (!copy) {
                    const parts = new Map<string, THREE.BufferGeometry[]>();
                    strandSolids({ ...p, points: p.shape }, r, color, sides, (c, g) => {
                        if (g) parts.set(c, [...(parts.get(c) ?? []), g]);
                    });
                    copy = { parts, places: [] };
                    copies.set(key, copy);
                }
                copy.places.push(place);
            } else strandSolids(p, r, color, sides, add);
        } else if (p.shades && !p.holes?.length) {
            shadedParts.push(faceGeometry(p.points.map(T)));
            shades.push(...p.shades);
        } else {
            add(
                color,
                faceGeometry(
                    p.points.map(T),
                    p.holes?.map((h) => h.map(T)),
                ),
            );
            if (p.planks) {
                // The gaps between boards, as thin strips lying in the face (which is pushed back a touch, so they show).
                const [p0, p1, p2] = p.points.map(T);
                const n = p1.clone().sub(p0).cross(p2.clone().sub(p0)).normalize();
                for (const [a, b] of plankLines(p, p.planks)) {
                    const [qa, qb] = [T(a), T(b)];
                    const half = n
                        .clone()
                        .cross(qb.clone().sub(qa))
                        .normalize()
                        .multiplyScalar(JOINT_GAP / 2);
                    const strip = [
                        qa.clone().sub(half),
                        qb.clone().sub(half),
                        qb.clone().add(half),
                        qa.clone().add(half),
                    ];
                    add(`${JOINT}${color}`, faceGeometry(strip));
                }
            }
        }
    }
    const solids = [...byColor].map(([color, parts]) => {
        const geometry = mergeGeometries(parts)!;
        parts.forEach((g) => g.dispose());
        return { color, geometry };
    });
    const shaded = shadedParts.length ? mergeGeometries(shadedParts)! : null;
    shadedParts.forEach((g) => g.dispose());
    const repeats = [...copies].flatMap(([key, { parts, places }]) =>
        [...parts].map(([color, list]) => {
            const geometry = mergeGeometries(list)!;
            list.forEach((g) => g.dispose());
            return { key: `${key} ${color}`, color, geometry, places };
        }),
    );
    return { solids, shaded: shaded && { geometry: shaded, shades }, repeats };
}

/** A strand's solids: its tube, and its ends rounded or cut. */
function strandSolids(
    p: Strand,
    r: number,
    color: string,
    sides: number,
    add: (color: string, g: THREE.BufferGeometry | null) => void,
) {
    // Drawn thicker than it is, it's lifted by as much, so rope lying on a deck stays on it, not in it.
    const lift = new THREE.Vector3(0, r - p.r, 0);
    const points = p.points.map((q) => T(q).add(lift));
    add(color, tubeGeometry(points, r, sides));
    // A closed loop (a chain link) has no ends to show.
    if (points.length > 3 && points[0].distanceTo(points.at(-1)!) < 1e-6) return;
    for (const [cap, cut, q, before] of [
        [p.capA, p.cutA, points[0], points[1]],
        [p.capB, p.cutB, points.at(-1)!, points.at(-2)!],
    ] as const)
        if (cap && cut && before) {
            const fused = `color-mix(in srgb, ${color} 35%, var(--rig-black))`;
            for (const g of cutEnd(q, q.clone().sub(before).normalize(), r, sides)) add(fused, g);
        } else if (cap)
            add(color, bare(new THREE.SphereGeometry(r, sides, 6).translate(q.x, q.y, q.z)));
}

/** A number for each shared shape, for telling them apart. */
const SHAPE_IDS = new WeakMap<Vector3[], number>();
let shapesSeen = 0;
const shapeId = (shape: Vector3[]) => {
    if (!SHAPE_IDS.has(shape)) SHAPE_IDS.set(shape, shapesSeen++);
    return SHAPE_IDS.get(shape)!;
};

/**
 * Where a flat shape (in its x–y plane) has been put to give `points`, as a three.js matrix taking it there, or null if
 * the points aren't it simply moved and turned. Its turn's fitted to all the points (least squares), then checked
 * against each of them.
 */
function placeOf(shape: Vector3[], points: Vector3[]): THREE.Matrix4 | null {
    const n = shape.length;
    if (n < 3 || points.length !== n) return null;
    const mean = (ps: Vector3[]) => ps.reduce((s, q) => s.add(q), vec3(0, 0, 0)).scale(1 / n);
    const [c0, c1] = [mean(shape), mean(points)];
    let [sxx, sxy, syy] = [0, 0, 0];
    let [wx, wy] = [vec3(0, 0, 0), vec3(0, 0, 0)];
    for (let i = 0; i < n; i++) {
        const l = shape[i].sub(c0);
        if (Math.abs(l.z) > 1e-9) return null;
        const w = points[i].sub(c1);
        [sxx, sxy, syy] = [sxx + l.x * l.x, sxy + l.x * l.y, syy + l.y * l.y];
        [wx, wy] = [wx.add(w.scale(l.x)), wy.add(w.scale(l.y))];
    }
    const det = sxx * syy - sxy * sxy;
    if (det < 1e-18) return null;
    const x = wx
        .scale(syy)
        .sub(wy.scale(sxy))
        .scale(1 / det);
    const y = wy
        .scale(sxx)
        .sub(wx.scale(sxy))
        .scale(1 / det);
    const TOL = 1e-6;
    if (Math.abs(x.len() - 1) > TOL || Math.abs(y.len() - 1) > TOL || Math.abs(x.dot(y)) > TOL)
        return null;
    const at = c1.sub(x.scale(c0.x)).sub(y.scale(c0.y));
    for (let i = 0; i < n; i++)
        if (at.add(x.scale(shape[i].x)).add(y.scale(shape[i].y)).distanceTo(points[i]) > TOL)
            return null;
    // In three.js's frame (z turned round), the turn's columns are x, y and x × y, the last turned round once more.
    return new THREE.Matrix4().makeBasis(T(x), T(y), T(x.cross(y)).negate()).setPosition(T(at));
}

/** How thick a piece may be (metres of radius) and still get a hairline. */
const HAIRLINE_R = 0.03;

/**
 * Every thin rod's and strand's centreline, as line segments merged per colour: drawn a pixel wide however far off,
 * so wire and rope still show when they're thinner than a pixel. Up close they're inside their solids, so hidden.
 */
export function buildHairlines(pieces: Piece[]) {
    const byColor = new Map<string, [number, number, number][]>();
    for (const p of pieces) {
        if (p.kind === "face" || p.r > HAIRLINE_R || p.toScale) continue;
        const color = p.color || MATERIAL_COLOR[p.material];
        const list = byColor.get(color) ?? [];
        const pts = p.kind === "rod" ? [p.a, p.b] : p.points;
        for (let i = 0; i + 1 < pts.length; i++)
            list.push(T(pts[i]).toArray(), T(pts[i + 1]).toArray());
        byColor.set(color, list);
    }
    return [...byColor].map(([color, points]) => ({ color, points }));
}

/** A label's text drawn on a canvas, for a texture: `fill` letters, with an outline in `stroke` if given. */
export function textTexture(text: string, font: string, fill: string, stroke?: string) {
    const size = 64;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    ctx.font = `600 ${size}px ${font}`;
    canvas.width = Math.ceil(ctx.measureText(text).width + size * 0.4);
    canvas.height = Math.ceil(size * 1.25);
    ctx.font = `600 ${size}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const [x, y] = [canvas.width / 2, canvas.height / 2 + size * 0.04];
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = size * 0.18;
        ctx.lineJoin = "round";
        ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { texture, aspect: canvas.width / canvas.height, size: canvas.height };
}

/** The smallest a label's letters may be drawn (pixels) before it's left off, as in the SVG views. */
const MIN_FONT = 8;

/**
 * A knot's label, written along its cylinder on the side facing the eye and reading left to right, sized to fit it.
 * It's a flat card in the scene, so whatever's in front of the knot covers its label too. Too small to read, it's left
 * off.
 */
function KnotLabel({ label, colors }: { label: RigLabel; colors: Colors }) {
    const mesh = useRef<THREE.Mesh>(null);
    const { camera, size } = useThree();
    const on = label.on!;
    // Drawn again only when its text changes, not as it moves (as the 3D knot editor's numbers do while dragged).
    const { text, light } = label;
    const card = useMemo(() => {
        const ink = colors.read(light ? "var(--ink-bright)" : "var(--rig-on-rope)");
        const edge = light ? colors.read("var(--rig-on-rope)") : undefined;
        return textTexture(
            text,
            colors.font,
            `#${ink.getHexString()}`,
            edge && `#${edge.getHexString()}`,
        );
    }, [text, light, colors]);
    useEffect(() => () => card.texture.dispose(), [card]);
    const centre = useMemo(() => T(label.at), [label]);
    const axis = useMemo(() => T(on.along).normalize(), [on]);
    // The letters' height that fits on the cylinder (as in the SVG views: 70% of its thickness, the text 72% of its
    // length).
    const font =
        (label.size ?? 1) *
        Math.min(0.7 * 2 * on.r, (0.72 * on.length) / (label.text.length * 0.6));
    useFrame(() => {
        const m = mesh.current;
        if (!m) return;
        const toEye = camera.position.clone().sub(centre);
        const distance = toEye.length();
        const e = toEye.clone().sub(axis.clone().multiplyScalar(toEye.dot(axis)));
        const across = e.length() / distance;
        const pixels =
            (font * size.height) /
            (2 * distance * Math.tan(rad((camera as THREE.PerspectiveCamera).fov) / 2));
        // Seen end on there's no length to write along.
        m.visible = across > 0.3 && pixels * across >= MIN_FONT;
        if (!m.visible) return;
        e.normalize();
        // Along the cylinder, pointing right on the screen, so it reads left to right.
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const u = axis.clone().multiplyScalar(axis.dot(right) < 0 ? -1 : 1);
        const v = e.clone().cross(u);
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, e));
        m.position.copy(centre).add(e.multiplyScalar(on.r * 1.04));
    });
    const h = font * 1.25;
    return (
        <mesh ref={mesh} renderOrder={1}>
            <planeGeometry args={[h * card.aspect, h]} />
            <meshBasicMaterial map={card.texture} transparent depthWrite={false} />
        </mesh>
    );
}

/** A person's letter, lying on their disc and turned to read upright from wherever the eye is. */
function PersonLetter({ face, colors }: { face: Face; colors: Colors }) {
    const mesh = useRef<THREE.Mesh>(null);
    const { camera } = useThree();
    const card = useMemo(
        () =>
            textTexture(
                face.text!,
                colors.font,
                `#${colors.read("var(--rig-on-rope)").getHexString()}`,
            ),
        [face, colors],
    );
    useEffect(() => () => card.texture.dispose(), [card]);
    const centre = useMemo(() => {
        const c = face.points
            .reduce((s, p) => s.add(p), vec3(0, 0, 0))
            .scale(1 / face.points.length);
        return T(c).add(new THREE.Vector3(0, 0.004, 0));
    }, [face]);
    useFrame(() => {
        const m = mesh.current;
        if (!m) return;
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0);
        if (right.lengthSq() < 1e-9) return;
        right.normalize();
        m.quaternion.setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(right, up.clone().cross(right), up),
        );
        m.position.copy(centre);
    });
    const h = 0.5 * 0.55 * 1.25;
    return (
        <mesh ref={mesh} renderOrder={1}>
            <planeGeometry args={[h * card.aspect, h]} />
            <meshBasicMaterial map={card.texture} transparent depthWrite={false} />
        </mesh>
    );
}

/** A compass letter standing on the ground, always facing the eye. */
function CompassLetter({
    text,
    at,
    h,
    colors,
}: {
    text: string;
    at: Vector3;
    h: number;
    colors: Colors;
}) {
    const card = useMemo(
        () => textTexture(text, colors.font, `#${colors.read("var(--ink-muted)").getHexString()}`),
        [text, colors],
    );
    useEffect(() => () => card.texture.dispose(), [card]);
    return (
        <sprite
            position={T(at).add(new THREE.Vector3(0, h / 2, 0))}
            scale={[h * card.aspect, h, 1]}
        >
            <spriteMaterial map={card.texture} transparent depthWrite={false} />
        </sprite>
    );
}

/**
 * Lets go of a built scene's copy on the graphics card. Its geometry can still be drawn: it's sent to the card again.
 */
function disposeBuilt({ solids, shaded, repeats }: ReturnType<typeof buildScene>) {
    solids.forEach((s) => s.geometry.dispose());
    shaded?.geometry.dispose();
    repeats.forEach((s) => s.geometry.dispose());
}

/** The solids and lines, built once for each set of pieces. */
export function Solids({
    pieces,
    colors,
    minR,
    hairlines,
    sides,
}: {
    pieces: Piece[];
    colors: Colors;
    minR: MinR;
    hairlines: number;
    sides: number;
}) {
    // The faces, built once for each set of pieces: they're the same at every detail.
    const flat = useMemo(() => buildScene(pieces, minR, SIDES, "flat"), [pieces, minR]);
    useEffect(() => () => disposeBuilt(flat), [flat]);
    // The rods and strands, for the last two numbers of sides asked for, so Auto stepping a level down and back up (or
    // up and back down) doesn't build them again.
    const built = useMemo(
        () => ({ pieces, minR, levels: new Map<number, ReturnType<typeof buildScene>>() }),
        [pieces, minR],
    );
    const round = useMemo(() => {
        const { levels } = built;
        const had = levels.get(sides);
        const now = had ?? buildScene(built.pieces, built.minR, sides, "round");
        levels.delete(sides);
        levels.set(sides, now);
        if (levels.size > 2) levels.delete(levels.keys().next().value!);
        return now;
    }, [built, sides]);
    // Left for another level, it lets go of the graphics card's copy, keeping its own to draw from again.
    useEffect(() => () => disposeBuilt(round), [round]);
    const solids = [...flat.solids, ...round.solids];
    const { shaded } = flat;
    const { repeats } = round;
    // The shaded faces' corner colours, worked out by the browser and set on their mesh.
    const shadedGeometry = useMemo(() => {
        if (!shaded) return null;
        const rgb = shaded.shades.flatMap((c) => {
            const color = colors.read(c);
            return [color.r, color.g, color.b];
        });
        shaded.geometry.setAttribute("color", new THREE.Float32BufferAttribute(rgb, 3));
        return shaded.geometry;
    }, [shaded, colors]);
    const lines = useMemo(() => (hairlines ? buildHairlines(pieces) : []), [pieces, hairlines]);
    return (
        <>
            {lines.map((s) => (
                <Line
                    key={`line:${s.color}`}
                    points={s.points}
                    segments
                    lineWidth={hairlines}
                    color={colors.read(s.color)}
                />
            ))}
            {shadedGeometry && (
                <mesh geometry={shadedGeometry}>
                    <meshLambertMaterial
                        vertexColors
                        side={THREE.DoubleSide}
                        polygonOffset
                        polygonOffsetFactor={1}
                        polygonOffsetUnits={1}
                    />
                </mesh>
            )}
            {repeats.map((s) => (
                <Repeated
                    key={s.key}
                    geometry={s.geometry}
                    places={s.places}
                    color={colors.read(s.color)}
                />
            ))}
            {solids.map((s, i) =>
                s.color.startsWith(JOINT) ? (
                    // A gap between boards: their colour, in shadow.
                    <mesh key={`${i} ${s.color}`} geometry={s.geometry}>
                        <meshBasicMaterial
                            color={colors
                                .read(s.color.slice(JOINT.length))
                                .clone()
                                .multiplyScalar(0.3)}
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                ) : (
                    <mesh key={`${i} ${s.color}`} geometry={s.geometry}>
                        {/* Pushed back a touch so the gaps between boards, lying on them, show. */}
                        <meshLambertMaterial
                            color={colors.read(s.color)}
                            side={THREE.DoubleSide}
                            polygonOffset
                            polygonOffsetFactor={1}
                            polygonOffsetUnits={1}
                        />
                    </mesh>
                ),
            )}
        </>
    );
}

/** One solid drawn at many places (as a chain's links), in one go. */
function Repeated({
    geometry,
    places,
    color,
}: {
    geometry: THREE.BufferGeometry;
    places: THREE.Matrix4[];
    color: THREE.Color;
}) {
    const mesh = useRef<THREE.InstancedMesh>(null);
    useLayoutEffect(() => {
        const m = mesh.current;
        if (!m) return;
        places.forEach((place, i) => m.setMatrixAt(i, place));
        m.instanceMatrix.needsUpdate = true;
        // Its bounds, from every copy's, so it's left out only when they're all out of view.
        m.computeBoundingSphere();
    }, [places]);
    return (
        <instancedMesh ref={mesh} args={[geometry, undefined, places.length]}>
            <meshLambertMaterial
                color={color}
                side={THREE.DoubleSide}
                polygonOffset
                polygonOffsetFactor={1}
                polygonOffsetUnits={1}
            />
        </instancedMesh>
    );
}

/**
 * Moves the point the view turns about to the depth of whatever's under the pointer, as a zoom or drag starts: along the
 * line through the middle of the view, so nothing on the screen moves. Zooming towards the pointer then carries it
 * onto what's there, and turning swings about something near what's being looked at rather than a point far behind or
 * in front of it.
 */
function PivotToPointer({
    controls,
    limits,
}: {
    controls: RefObject<ComponentRef<typeof OrbitControls> | null>;
    limits: THREE.Box3 | null;
}) {
    const { camera, gl, scene, raycaster } = useThree();
    useEffect(() => {
        const el = gl.domElement;
        const pick = (e: PointerEvent | WheelEvent) => {
            const c = controls.current;
            if (!c) return;
            const box = el.getBoundingClientRect();
            const at = new THREE.Vector2(
                ((e.clientX - box.left) / box.width) * 2 - 1,
                -((e.clientY - box.top) / box.height) * 2 + 1,
            );
            raycaster.setFromCamera(at, camera);
            // Solids only: not the labels drawn over them or the compass letters.
            const hit = raycaster
                .intersectObjects(scene.children, true)
                .find((h) => (h.object as THREE.Mesh).isMesh && h.object.renderOrder === 0);
            if (!hit) return;
            const ahead = c.target.clone().sub(camera.position).normalize();
            const depth = hit.point.clone().sub(camera.position).dot(ahead);
            if (depth <= 0.5) return;
            const pivot = camera.position.clone().add(ahead.multiplyScalar(depth));
            // Not out past the scene's bounds, where the view would jump back as it's kept inside them.
            if (limits && !limits.containsPoint(pivot)) return;
            c.target.copy(pivot);
            c.update();
        };
        // Before the orbit controls see the event.
        el.addEventListener("pointerdown", pick, { capture: true });
        el.addEventListener("wheel", pick, { capture: true, passive: true });
        return () => {
            el.removeEventListener("pointerdown", pick, { capture: true });
            el.removeEventListener("wheel", pick, { capture: true });
        };
    }, [camera, gl, scene, raycaster, controls, limits]);
    return null;
}

/** Says when the first frame has been drawn. */
function FirstFrame({ onDrawn }: { onDrawn: () => void }) {
    const done = useRef(false);
    useFrame(() => {
        if (done.current) return;
        done.current = true;
        onDrawn();
    });
    return null;
}

/** Hands the page its controls, once the camera and orbit controls exist. */
function Handle({
    scene,
    onReady,
    controls,
    onTurn,
    focus,
    standing,
}: {
    scene: SceneConfig;
    onReady: (handle: GLHandle | null) => void;
    controls: RefObject<ComponentRef<typeof OrbitControls> | null>;
    onTurn?: (azimuth: number, elevation: number) => void;
    focus: Focus | null;
    /** A standing view's own buttons, while there is one, which the page's buttons work instead. */
    standing: RefObject<StanceButtons | null>;
}) {
    const { camera } = useThree();
    const size = useThree((s) => s.size);
    const start = startDistance(scene, size.width / Math.max(size.height, 1));
    const placed = useRef(false);
    useEffect(() => {
        const c = controls.current;
        if (!c) return;
        const move = (position: THREE.Vector3, target: THREE.Vector3) => {
            c.target.copy(target);
            camera.position.copy(position);
            c.update();
        };
        // The first view: from the scene's own distance or, on a narrow screen, out far enough to fit it.
        if (!placed.current) {
            placed.current = true;
            if (start !== scene.distance)
                move(
                    eyeAt(T(scene.centre), start, scene.azimuth, scene.elevation),
                    T(scene.centre),
                );
        }
        onReady({
            zoomBy: (factor) => {
                if (standing.current) return standing.current.zoomBy(factor);
                const out = camera.position.clone().sub(c.target).divideScalar(factor);
                move(c.target.clone().add(out), c.target.clone());
            },
            // Back to the start: of the whole scene, or of what it's locked onto, seen from the scene's starting bearing.
            reset: () =>
                standing.current
                    ? standing.current.reset()
                    : focus
                      ? move(
                            eyeAt(
                                focusPoint(focus),
                                focus.distance,
                                scene.azimuth,
                                scene.elevation,
                            ),
                            focusPoint(focus),
                        )
                      : move(
                            eyeAt(T(scene.centre), start, scene.azimuth, scene.elevation),
                            T(scene.centre),
                        ),
            look: (azimuth, elevation) => {
                const distance = camera.position.distanceTo(c.target);
                move(eyeAt(c.target, distance, azimuth, elevation), c.target.clone());
            },
        });
        // Kept within limits as it's moved: the point it turns about inside the scene's bounds (the eye moving with it,
        // so the view slides to a stop at the edge rather than turning), and no further out than the scene allows.
        const box = boundsBox(scene);
        const furthest = Math.min(scene.maxDistance, start * (scene.zoomOut ?? Infinity));
        const panBox = focus?.pan
            ? new THREE.Box3().setFromPoints([T(focus.pan.lo), T(focus.pan.hi)])
            : null;
        const keep = () => {
            if (panBox) {
                const shift = panBox.clampPoint(c.target, new THREE.Vector3()).sub(c.target);
                c.target.add(shift);
                camera.position.add(shift);
            }
            if (box) {
                const shift = box.clampPoint(c.target, new THREE.Vector3()).sub(c.target);
                c.target.add(shift);
                camera.position.add(shift);
            }
            const out = camera.position.clone().sub(c.target);
            if (out.length() > furthest)
                camera.position.copy(c.target).add(out.setLength(furthest));
        };
        c.addEventListener("change", keep);
        keep();
        // Tell the page which way the eye is, so its compass buttons can show a match.
        const report = () => {
            const d = camera.position.clone().sub(c.target);
            const azimuth =
                ((Math.round((Math.atan2(d.x, -d.z) * 180) / Math.PI) % 360) + 360) % 360;
            const elevation = Math.round((Math.asin(d.y / d.length()) * 180) / Math.PI);
            onTurn?.(azimuth, elevation);
        };
        c.addEventListener("change", report);
        report();
        return () => {
            c.removeEventListener("change", keep);
            c.removeEventListener("change", report);
            onReady(null);
        };
    }, [camera, controls, onReady, onTurn, scene, start, focus, standing]);
    return null;
}

/** How long the view takes to ease onto a new focus (milliseconds). */
const FOCUS_EASE = 700;

/**
 * Eases the view onto its focus when it's given one: the point it turns about slides to the focus's centre while the
 * eye comes in or out to its distance, looking the same way throughout. Turning or zooming stops it where it is. The
 * camera's near plane comes in with it, so a small part can be looked at from close up.
 */
function FocusOn({
    focus,
    controls,
    near,
    far,
}: {
    focus: Focus | null;
    controls: RefObject<ComponentRef<typeof OrbitControls> | null>;
    near: number;
    /** How far out the view may zoom when it's not locked onto anything. */
    far: number;
}) {
    const camera = useThree((s) => s.camera);
    const get = useThree((s) => s.get);
    // The furthest out the orbit controls may zoom, set through the store (where they're the default controls).
    const zoomOutTo = useCallback(
        (d: number) => {
            const c = get().controls as { maxDistance: number } | null;
            if (c) c.maxDistance = d;
        },
        [get],
    );
    const ease = useRef<{
        from: THREE.Vector3;
        to: THREE.Vector3;
        dir: THREE.Vector3;
        out: [number, number];
        start: number;
    } | null>(null);
    // Where a moving focus was last frame, once the view's eased onto it, so the view moves on with it.
    const followed = useRef<THREE.Vector3 | null>(null);
    useEffect(() => {
        // Read from the store, as it's changed here rather than drawn from.
        const lens = get().camera;
        if (lens instanceof THREE.PerspectiveCamera) {
            lens.near = focus ? Math.min(near, focus.distance / 40) : near;
            lens.updateProjectionMatrix();
        }
        const c = controls.current;
        if (!c) return;
        // Locked onto a focus, it zooms out only so far from it (set here, not as the controls' prop, so it can be
        // eased into from further out).
        zoomOutTo(focus ? Math.min(far, FOCUS_OUT * focus.distance) : far);
        if (!focus) return;
        const out = camera.position.clone().sub(c.target);
        ease.current = {
            from: c.target.clone(),
            to: focusPoint(focus),
            dir: out.clone().normalize(),
            out: [out.length(), focus.distance],
            start: performance.now(),
        };
        const limit = Math.min(far, FOCUS_OUT * focus.distance);
        const stop = () => {
            ease.current = null;
            zoomOutTo(limit);
        };
        c.addEventListener("start", stop);
        followed.current = null;
        return () => {
            c.removeEventListener("start", stop);
            ease.current = null;
            followed.current = null;
        };
    }, [focus, controls, camera, near, far, get, zoomOutTo]);
    useFrame(() => {
        const e = ease.current;
        const c = controls.current;
        if (!c || !focus) return;
        if (!e) {
            // Eased in (or stopped by a turn or zoom): carried along with a moving focus, looking the same way.
            if (!focus.moving) return;
            const now = focusPoint(focus);
            const before = followed.current;
            followed.current = now;
            if (!before || before.equals(now)) return;
            const by = now.clone().sub(before);
            c.target.add(by);
            camera.position.add(by);
            c.update();
            return;
        }
        // A moving focus is eased onto where it is now.
        if (focus.moving) e.to.copy(focusPoint(focus));
        const t = Math.min((performance.now() - e.start) / FOCUS_EASE, 1);
        const k = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
        // In and out by the same fraction each step, so a long way in doesn't rush the close end.
        const distance = e.out[0] * (e.out[1] / e.out[0]) ** k;
        c.target.lerpVectors(e.from, e.to, k);
        camera.position.copy(c.target).add(e.dir.clone().multiplyScalar(distance));
        // Coming in from further out than it may zoom out to once there, it's let out that far until it's in.
        const limit = focus ? Math.min(far, FOCUS_OUT * focus.distance) : far;
        zoomOutTo(Math.max(limit, distance));
        c.update();
        if (t >= 1) {
            ease.current = null;
            followed.current = c.target.clone();
            zoomOutTo(limit);
        }
    });
    return null;
}

/**
 * Stands the view at a stance: the eye put there, looking towards its `lookAt`, the orbit controls off. Dragging turns
 * the view about the eye (grabbing the scene and pulling it round, as with a street view); scrolling, pinching and the
 * zoom buttons narrow or widen what it takes in. Leaving it, the orbit controls take over turning about a point a
 * little way ahead, at the usual width.
 */
function StandAt({
    stance,
    onButtons,
}: {
    stance: Stance | null;
    /** Told the standing view's buttons while it's there, and `null` once it's gone. */
    onButtons: (buttons: StanceButtons | null) => void;
}) {
    const get = useThree((s) => s.get);
    const gl = useThree((s) => s.gl);
    useEffect(() => {
        const lens = get().camera;
        if (!stance || !(lens instanceof THREE.PerspectiveCamera)) return;
        const at = T(stance.at);
        const [fov, near] = [lens.fov, lens.near];
        // Which way it looks: round from three.js's +z towards +x, and up from level (radians).
        const look = { yaw: 0, pitch: 0 };
        const aim = () => {
            const { yaw, pitch } = look;
            const ahead = new THREE.Vector3(
                Math.cos(pitch) * Math.sin(yaw),
                Math.sin(pitch),
                Math.cos(pitch) * Math.cos(yaw),
            );
            lens.position.copy(at);
            lens.lookAt(at.clone().add(ahead));
        };
        const widen = (f: number) => {
            lens.fov = Math.min(Math.max(f, STANCE_FOV.least), STANCE_FOV.most);
            lens.updateProjectionMatrix();
        };
        const reset = () => {
            const d = T(stance.lookAt).sub(at).normalize();
            look.yaw = Math.atan2(d.x, d.z);
            look.pitch = Math.asin(d.y);
            widen(stance.fov ?? STANCE_FOV.start);
            aim();
        };
        lens.near = 0.05;
        reset();
        onButtons({ zoomBy: (factor) => widen(lens.fov / factor), reset });
        // Turning by dragging, as far as the view's height takes in from top to bottom for a drag of its height.
        const el = gl.domElement;
        const pointers = new Map<number, { x: number; y: number }>();
        let spread = 0;
        const apart = () => {
            const [a, b] = [...pointers.values()];
            return Math.hypot(a.x - b.x, a.y - b.y);
        };
        const onDown = (e: PointerEvent) => {
            el.setPointerCapture(e.pointerId);
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size === 2) spread = apart();
        };
        const onMove = (e: PointerEvent) => {
            const was = pointers.get(e.pointerId);
            if (!was) return;
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size === 2) {
                // A pinch: fingers apart zooms in.
                const now = apart();
                if (spread > 0) widen((lens.fov * spread) / Math.max(now, 1));
                spread = now;
                return;
            }
            const perPixel = rad(lens.fov) / Math.max(el.clientHeight, 1);
            look.yaw += (e.clientX - was.x) * perPixel;
            look.pitch = Math.min(
                Math.max(look.pitch + (e.clientY - was.y) * perPixel, -rad(85)),
                rad(85),
            );
            aim();
        };
        const onUp = (e: PointerEvent) => {
            pointers.delete(e.pointerId);
            spread = 0;
        };
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
            widen(lens.fov * Math.exp(delta * (e.ctrlKey ? 0.01 : 0.0015)));
        };
        el.addEventListener("pointerdown", onDown);
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerup", onUp);
        el.addEventListener("pointercancel", onUp);
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => {
            el.removeEventListener("pointerdown", onDown);
            el.removeEventListener("pointermove", onMove);
            el.removeEventListener("pointerup", onUp);
            el.removeEventListener("pointercancel", onUp);
            el.removeEventListener("wheel", onWheel);
            onButtons(null);
            // Back to the orbit controls, turning about a point 20 m ahead, at the width it had before.
            lens.fov = fov;
            lens.near = near;
            lens.updateProjectionMatrix();
            // The orbit controls, from the store (where they're the default controls).
            const c = get().controls as ComponentRef<typeof OrbitControls> | null;
            if (c) {
                const ahead = new THREE.Vector3();
                lens.getWorldDirection(ahead);
                c.target.copy(lens.position).add(ahead.multiplyScalar(20));
                c.update();
            }
        };
    }, [stance, onButtons, get, gl]);
    return null;
}

export type ViewProps = {
    pieces: Piece[];
    labels: RigLabel[];
    onReady: (handle: GLHandle | null) => void;
    onTurn?: (azimuth: number, elevation: number) => void;
};

/** How finely a scene's drawn: the most pixels per CSS pixel, and how many sides its tubes have. */
export type GLDetail = { dpr: number; sides: number };

/** A scene's pieces in 3D, with its ground and compass, turned, zoomed and moved by dragging. */
export function SceneGL({
    scene,
    pieces,
    labels,
    onReady,
    onTurn,
    detail,
    onFrameRate,
    focus = null,
    stance = null,
    children,
}: ViewProps & {
    scene: SceneConfig;
    /** A point to lock the view onto, or none to move freely. */
    focus?: Focus | null;
    /** Somewhere to stand and look round from, instead of turning about a point. */
    stance?: Stance | null;
    /** How finely to draw it (as fine as the screen allows, up to 2 pixels a CSS pixel, unless given). */
    detail?: GLDetail;
    /** Told when the frame rate stays short of smooth, or has room to spare, for a choice of detail to follow. */
    onFrameRate?: (rate: FrameRate) => void;
    /** More to draw in the scene, which may read its colours with `useSceneColors`. */
    children?: ReactNode;
}) {
    const box = useRef<HTMLDivElement>(null);
    const [colors, setColors] = useState<Colors | null>(null);
    useEffect(() => {
        if (!box.current) return;
        const reader = colorReader(box.current);
        setColors(reader);
        return reader.dispose;
    }, []);
    const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
    const standing = useRef<StanceButtons | null>(null);
    const onStanceButtons = useCallback((b: StanceButtons | null) => {
        standing.current = b;
    }, []);
    // Until the first frame's drawn, the loading message stays up.
    const [drawn, setDrawn] = useState(false);
    const all = useMemo(() => [...scene.ground, ...pieces], [scene, pieces]);
    const target = useMemo(() => T(scene.centre), [scene]);
    const limits = useMemo(() => boundsBox(scene), [scene]);
    const light = T(vec3(0.3, 0.8, 0.5)).multiplyScalar(20);
    const near = Math.min(0.3, (scene.minDistance ?? 1.5) / 5);
    return (
        <div ref={box} className="absolute inset-0 touch-none">
            {!drawn && <Loading3D />}
            {colors && (
                <Canvas
                    camera={{
                        fov: FOV,
                        position: eyeAt(target, scene.distance, scene.azimuth, scene.elevation),
                        near,
                        far: scene.maxDistance * 2.5,
                    }}
                    gl={{ antialias: true, alpha: true }}
                    dpr={[1, detail?.dpr ?? 2]}
                    aria-label={scene.label}
                >
                    <hemisphereLight args={[0xffffff, 0x445544, 1.6]} />
                    <directionalLight position={light} intensity={1.6} />
                    <Solids
                        pieces={all}
                        colors={colors}
                        minR={scene.minR}
                        hairlines={scene.hairlines ?? 0}
                        sides={detail?.sides ?? SIDES}
                    />
                    {onFrameRate && (
                        // Watching for a frame rate that stays short of smooth, or has room to spare: afresh at each
                        // level, so the pause as it changes isn't taken for a slow frame rate.
                        <PerformanceMonitor
                            key={`${detail?.dpr} ${detail?.sides}`}
                            bounds={() => [BOUNDS.short, BOUNDS.spare]}
                            flipflops={FLIPS}
                            onDecline={() => onFrameRate("short")}
                            onIncline={() => onFrameRate("spare")}
                        />
                    )}
                    {labels
                        .filter((l) => l.on)
                        .map((l, i) => (
                            <KnotLabel key={i} label={l} colors={colors} />
                        ))}
                    {pieces.map((p, i) =>
                        p.kind === "face" && p.text ? (
                            <PersonLetter key={i} face={p} colors={colors} />
                        ) : null,
                    )}
                    {scene.compass.map(([text, at]) => (
                        <CompassLetter
                            key={text}
                            text={text}
                            at={at}
                            h={scene.letter}
                            colors={colors}
                        />
                    ))}
                    <OrbitControls
                        ref={controls}
                        target={target}
                        enableDamping={false}
                        // Off while standing somewhere, where the view only turns about the eye.
                        enabled={!stance}
                        // Locked onto a focus, it zooms towards it and can't be moved off it.
                        enablePan={!focus || !!focus.pan}
                        zoomToCursor={!focus}
                        minDistance={focus ? focus.distance / 8 : (scene.minDistance ?? 1.5)}
                        maxDistance={scene.maxDistance}
                        maxPolarAngle={scene.below ? Math.PI : Math.PI / 2}
                        makeDefault
                    />
                    <Handle
                        scene={scene}
                        onReady={onReady}
                        controls={controls}
                        onTurn={onTurn}
                        focus={focus}
                        standing={standing}
                    />
                    <StandAt stance={stance} onButtons={onStanceButtons} />
                    <FocusOn
                        focus={focus}
                        controls={controls}
                        near={near}
                        far={scene.maxDistance}
                    />
                    {scene.pivotToPointer && !focus && !stance && (
                        <PivotToPointer controls={controls} limits={limits} />
                    )}
                    <ColorsContext value={colors}>{children}</ColorsContext>
                    <FirstFrame onDrawn={() => setDrawn(true)} />
                </Canvas>
            )}
        </div>
    );
}

"use client";

import {
    createContext,
    useContext,
    useEffect,
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

import Loading3D from "./loading-3d";
import type { RigLabel } from "./rig";
import {
    groundAt,
    groundCorners,
    plankLines,
    tapeLayers,
    type Face,
    type Material,
    type Piece,
} from "./tower";

/**
 * The tower in 3D drawn with WebGL: the same pieces as the SVG views, as shaded solids, so whatever's nearer covers
 * what's behind it however they cross. Scene points are compass (x east, y up, z north); three.js wants a right-handed
 * frame, so z is turned round to point south as they go in.
 */
export const T = (p: Vector3) => new THREE.Vector3(p.x, p.y, -p.z);

const COLOR: Record<Material, string> = {
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
/** The thinnest some things are drawn (metres of radius), by their material. */
type MinR = Partial<Record<Material, number>>;

/** What the page around it can do to the view: zoom, go back to where it started, or look from a bearing. */
export type GLHandle = {
    zoomBy: (factor: number) => void;
    reset: () => void;
    look: (azimuth: number, elevation: number) => void;
};

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

/** The abseil tower's scene. */
const TOWER: SceneConfig = {
    centre: vec3(4.5 / 2, 5.4, 4.5 / 2),
    distance: 30,
    azimuth: 135,
    elevation: 25,
    maxDistance: 80,
    ground: [
        {
            kind: "face",
            points: groundCorners(),
            material: "deck",
            color: "var(--tower-ground)",
        },
    ],
    compass: [
        ["N", vec3(4.5 / 2, groundAt(4.5 / 2), 4.5 + 1.8)],
        ["S", vec3(4.5 / 2, groundAt(4.5 / 2), -1.8)],
        ["E", vec3(4.5 + 1.8, groundAt(4.5 + 1.8), 4.5 / 2)],
        ["W", vec3(-2.2, groundAt(-2.2), 4.5 / 2)],
    ],
    letter: 0.7,
    minR: { sling: 0.014, rope: 0.012, steel: 0.01 },
    label: "The Cracroft abseil tower in 3D. Drag to turn it, scroll or pinch to zoom, and right-drag or drag with two fingers to move it.",
};
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

/** How wide the gaps between boards are (metres). */
const JOINT_GAP = 0.01;
/** What a gap's colour key starts with, before the colour of its boards. */
const JOINT = "joint:";

/**
 * Every piece's solid, merged into one geometry per colour, and the gaps between boards as strips, merged per colour
 * of the boards they're between.
 */
function buildScene(pieces: Piece[], minR: MinR, sides = SIDES) {
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
    for (const p of pieces) {
        const color = p.color || COLOR[p.material];
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
            // Drawn thicker than it is, it's lifted by as much, so rope lying on a deck stays on it, not in it.
            const lift = new THREE.Vector3(0, r - p.r, 0);
            const points = p.points.map((q) => T(q).add(lift));
            add(color, tubeGeometry(points, r, sides));
            for (const [cap, cut, q, before] of [
                [p.capA, p.cutA, points[0], points[1]],
                [p.capB, p.cutB, points.at(-1)!, points.at(-2)!],
            ] as const)
                if (cap && cut && before) {
                    const fused = `color-mix(in srgb, ${color} 35%, var(--rig-black))`;
                    for (const g of cutEnd(q, q.clone().sub(before).normalize(), r, sides))
                        add(fused, g);
                } else if (cap) {
                    const at = q;
                    add(
                        color,
                        bare(new THREE.SphereGeometry(r, sides, 6).translate(at.x, at.y, at.z)),
                    );
                }
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
    return { solids, shaded: shaded && { geometry: shaded, shades } };
}

/** How thick a piece may be (metres of radius) and still get a hairline. */
const HAIRLINE_R = 0.03;

/**
 * Every thin rod's and strand's centreline, as line segments merged per colour: drawn a pixel wide however far off,
 * so wire and rope still show when they're thinner than a pixel. Up close they're inside their solids, so hidden.
 */
function buildHairlines(pieces: Piece[]) {
    const byColor = new Map<string, [number, number, number][]>();
    for (const p of pieces) {
        if (p.kind === "face" || p.r > HAIRLINE_R || p.toScale) continue;
        const color = p.color || COLOR[p.material];
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

/** The solids and lines, built once for each set of pieces. */
function Solids({
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
    const { solids, shaded } = useMemo(
        () => buildScene(pieces, minR, sides),
        [pieces, minR, sides],
    );
    useEffect(
        () => () => {
            solids.forEach((s) => s.geometry.dispose());
            shaded?.geometry.dispose();
        },
        [solids, shaded],
    );
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
            {solids.map((s) =>
                s.color.startsWith(JOINT) ? (
                    // A gap between boards: their colour, in shadow.
                    <mesh key={s.color} geometry={s.geometry}>
                        <meshBasicMaterial
                            color={colors
                                .read(s.color.slice(JOINT.length))
                                .clone()
                                .multiplyScalar(0.3)}
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                ) : (
                    <mesh key={s.color} geometry={s.geometry}>
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
                .find((h) => h.object.type === "Mesh" && h.object.renderOrder === 0);
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
}: {
    scene: SceneConfig;
    onReady: (handle: GLHandle | null) => void;
    controls: RefObject<ComponentRef<typeof OrbitControls> | null>;
    onTurn: (azimuth: number, elevation: number) => void;
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
                const out = camera.position.clone().sub(c.target).divideScalar(factor);
                move(c.target.clone().add(out), c.target.clone());
            },
            reset: () =>
                move(
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
        const keep = () => {
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
            onTurn(azimuth, elevation);
        };
        c.addEventListener("change", report);
        report();
        return () => {
            c.removeEventListener("change", keep);
            c.removeEventListener("change", report);
            onReady(null);
        };
    }, [camera, controls, onReady, onTurn, scene, start]);
    return null;
}

type ViewProps = {
    pieces: Piece[];
    labels: RigLabel[];
    onReady: (handle: GLHandle | null) => void;
    onTurn: (azimuth: number, elevation: number) => void;
};

/** How finely a scene's drawn: the most pixels per CSS pixel, and how many sides its tubes have. */
export type GLDetail = { dpr: number; sides: number };

/** What a scene's told about how it's keeping up: its frame rate falling short, or with room to spare. */
export type FrameRate = "short" | "spare";

/** The abseil tower in 3D. */
export default function TowerGL(props: ViewProps) {
    return <SceneGL scene={TOWER} {...props} />;
}

/** A scene's pieces in 3D, with its ground and compass, turned, zoomed and moved by dragging. */
export function SceneGL({
    scene,
    pieces,
    labels,
    onReady,
    onTurn,
    detail,
    onFrameRate,
    children,
}: ViewProps & {
    scene: SceneConfig;
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
    // Until the first frame's drawn, the loading message stays up.
    const [drawn, setDrawn] = useState(false);
    const all = useMemo(() => [...scene.ground, ...pieces], [scene, pieces]);
    const target = useMemo(() => T(scene.centre), [scene]);
    const limits = useMemo(() => boundsBox(scene), [scene]);
    const light = T(vec3(0.3, 0.8, 0.5)).multiplyScalar(20);
    return (
        <div ref={box} className="absolute inset-0 touch-none">
            {!drawn && <Loading3D />}
            {colors && (
                <Canvas
                    camera={{
                        fov: FOV,
                        position: eyeAt(target, scene.distance, scene.azimuth, scene.elevation),
                        near: Math.min(0.3, (scene.minDistance ?? 1.5) / 5),
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
                        // Watching for a frame rate that stays under about 45 a second, or over about 58.
                        <PerformanceMonitor
                            bounds={() => [45, 58]}
                            flipflops={4}
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
                        zoomToCursor
                        minDistance={scene.minDistance ?? 1.5}
                        maxDistance={scene.maxDistance}
                        maxPolarAngle={scene.below ? Math.PI : Math.PI / 2}
                        makeDefault
                    />
                    <Handle scene={scene} onReady={onReady} controls={controls} onTurn={onTurn} />
                    {scene.pivotToPointer && <PivotToPointer controls={controls} limits={limits} />}
                    <ColorsContext value={colors}>{children}</ColorsContext>
                    <FirstFrame onDrawn={() => setDrawn(true)} />
                </Canvas>
            )}
        </div>
    );
}

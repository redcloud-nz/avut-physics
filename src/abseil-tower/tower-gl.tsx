"use client";

import { useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";

import { rad } from "@/lib/math";
import { vec3, type Vector3 } from "@/lib/vector3";

import type { RigLabel } from "./rig";
import { groundAt, groundCorners, plankLines, type Face, type Material, type Piece } from "./tower";

/**
 * The tower in 3D drawn with WebGL: the same pieces as the SVG views, as shaded solids, so whatever's nearer covers
 * what's behind it however they cross. Scene points are compass (x east, y up, z north); three.js wants a right-handed
 * frame, so z is turned round to point south as they go in.
 */
const T = (p: Vector3) => new THREE.Vector3(p.x, p.y, -p.z);

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
/** The thinnest some things are drawn (metres of radius), so a rope stays visible from across the tower. */
const MIN_R: Partial<Record<Material, number>> = { sling: 0.014, rope: 0.012, steel: 0.01 };

/** What the page around it can do to the view: zoom, go back to where it started, or look from a bearing. */
export type GLHandle = {
    zoomBy: (factor: number) => void;
    reset: () => void;
    look: (azimuth: number, elevation: number) => void;
};

/** Where the camera turns about to start with, and how far from it it sits. */
const CENTRE = vec3(4.5 / 2, 5.4, 4.5 / 2);
const DISTANCE = 30;
const START_TARGET = T(CENTRE);
const FOV = 30;

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
type Colors = ReturnType<typeof colorReader>;

const SIDES = 10;

/** A cylinder from `a` to `b` (three.js points), with a ball on each real end. */
function rodGeometry(a: THREE.Vector3, b: THREE.Vector3, r: number, capA: boolean, capB: boolean) {
    const along = b.clone().sub(a);
    const length = along.length();
    const parts: THREE.BufferGeometry[] = [];
    if (length > 1e-6) {
        const tube = new THREE.CylinderGeometry(r, r, length, SIDES, 1, true);
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
        if (cap) parts.push(new THREE.SphereGeometry(r, SIDES, 6).translate(p.x, p.y, p.z));
    return parts.map(bare);
}

/** A tube of radius `r` along a polyline, its rings kept square to the line as it bends. */
function tubeGeometry(points: THREE.Vector3[], r: number): THREE.BufferGeometry | null {
    const pts = points.filter((p, i) => i === 0 || p.distanceTo(points[i - 1]) > 1e-6);
    if (pts.length < 2) return null;
    const tangent = (i: number) =>
        pts[Math.min(i + 1, pts.length - 1)]
            .clone()
            .sub(pts[Math.max(i - 1, 0)])
            .normalize();
    // A first ring direction square to the line, then carried along it.
    const t0 = tangent(0);
    const helper = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    let n = helper.cross(t0).normalize();
    const position: number[] = [];
    const normal: number[] = [];
    pts.forEach((p, i) => {
        const t = tangent(i);
        n = n.sub(t.clone().multiplyScalar(n.dot(t))).normalize();
        const b = t.clone().cross(n);
        for (let k = 0; k < SIDES; k++) {
            const th = (2 * Math.PI * k) / SIDES;
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
        for (let k = 0; k < SIDES; k++) {
            const [a, b] = [i * SIDES + k, i * SIDES + ((k + 1) % SIDES)];
            const [c, d] = [a + SIDES, b + SIDES];
            index.push(a, c, b, b, c, d);
        }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
    g.setIndex(index);
    return g;
}

/** A flat convex polygon, as a fan of triangles. */
function faceGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
    const [p0, p1, p2] = points;
    const n = p1.clone().sub(p0).cross(p2.clone().sub(p0)).normalize();
    const g = new THREE.BufferGeometry();
    g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            points.flatMap((p) => p.toArray()),
            3,
        ),
    );
    g.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(
            points.flatMap(() => n.toArray()),
            3,
        ),
    );
    const index: number[] = [];
    for (let i = 1; i < points.length - 1; i++) index.push(0, i, i + 1);
    g.setIndex(index);
    return g;
}

/** A geometry with only positions and normals, so any of them merge together. */
function bare(g: THREE.BufferGeometry): THREE.BufferGeometry {
    for (const name of Object.keys(g.attributes))
        if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    return g;
}

/** How wide the gaps between boards are (metres). */
const JOINT_GAP = 0.01;
/** What a gap's colour key starts with, before the colour of its boards. */
const JOINT = "joint:";

/**
 * Every piece's solid, merged into one geometry per colour, and the gaps between boards as strips, merged per colour
 * of the boards they're between.
 */
function buildScene(pieces: Piece[]) {
    const byColor = new Map<string, THREE.BufferGeometry[]>();
    const add = (color: string, g: THREE.BufferGeometry | null) => {
        if (!g) return;
        const list = byColor.get(color) ?? [];
        list.push(g);
        byColor.set(color, list);
    };
    for (const p of pieces) {
        const color = p.color || COLOR[p.material];
        const r = Math.max("r" in p ? p.r : 0, MIN_R[p.material] ?? 0);
        if (p.kind === "rod")
            for (const g of rodGeometry(T(p.a), T(p.b), r, p.capA, p.capB)) add(color, g);
        else if (p.kind === "strand") {
            // Drawn thicker than it is, it's lifted by as much, so rope lying on a deck stays on it, not in it.
            const lift = new THREE.Vector3(0, r - p.r, 0);
            const points = p.points.map((q) => T(q).add(lift));
            add(color, tubeGeometry(points, r));
            for (const [cap, q] of [
                [p.capA, points[0]],
                [p.capB, points.at(-1)!],
            ] as const)
                if (cap) {
                    const at = q;
                    add(
                        color,
                        bare(new THREE.SphereGeometry(r, SIDES, 6).translate(at.x, at.y, at.z)),
                    );
                }
        } else {
            add(color, faceGeometry(p.points.map(T)));
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
    return solids;
}

/** A label's text drawn on a canvas, for a texture: `fill` letters, with an outline in `stroke` if given. */
function textTexture(text: string, font: string, fill: string, stroke?: string) {
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
    const card = useMemo(() => {
        const ink = colors.read(label.light ? "var(--ink-bright)" : "var(--rig-on-rope)");
        const edge = label.light ? colors.read("var(--rig-on-rope)") : undefined;
        return textTexture(
            label.text,
            colors.font,
            `#${ink.getHexString()}`,
            edge && `#${edge.getHexString()}`,
        );
    }, [label, colors]);
    useEffect(() => () => card.texture.dispose(), [card]);
    const centre = useMemo(() => T(label.at), [label]);
    const axis = useMemo(() => T(on.along).normalize(), [on]);
    // The letters' height that fits on the cylinder (as in the SVG views: 70% of its thickness, the text 72% of its
    // length).
    const font = Math.min(0.7 * 2 * on.r, (0.72 * on.length) / (label.text.length * 0.6));
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
function CompassLetter({ text, at, colors }: { text: string; at: Vector3; colors: Colors }) {
    const card = useMemo(
        () => textTexture(text, colors.font, `#${colors.read("var(--ink-muted)").getHexString()}`),
        [text, colors],
    );
    useEffect(() => () => card.texture.dispose(), [card]);
    const h = 0.7;
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
function Solids({ pieces, colors }: { pieces: Piece[]; colors: Colors }) {
    const solids = useMemo(() => buildScene(pieces), [pieces]);
    useEffect(() => () => solids.forEach((s) => s.geometry.dispose()), [solids]);
    return (
        <>
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

/** Hands the page its controls, once the camera and orbit controls exist. */
function Handle({
    onReady,
    controls,
    onTurn,
}: {
    onReady: (handle: GLHandle | null) => void;
    controls: RefObject<ComponentRef<typeof OrbitControls> | null>;
    onTurn: (azimuth: number, elevation: number) => void;
}) {
    const { camera } = useThree();
    useEffect(() => {
        const c = controls.current;
        if (!c) return;
        const move = (position: THREE.Vector3, target: THREE.Vector3) => {
            c.target.copy(target);
            camera.position.copy(position);
            c.update();
        };
        onReady({
            zoomBy: (factor) => {
                const out = camera.position.clone().sub(c.target).divideScalar(factor);
                move(c.target.clone().add(out), c.target.clone());
            },
            reset: () => move(eyeAt(T(CENTRE), DISTANCE, 135, 25), T(CENTRE)),
            look: (azimuth, elevation) => {
                const distance = camera.position.distanceTo(c.target);
                move(eyeAt(c.target, distance, azimuth, elevation), c.target.clone());
            },
        });
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
            c.removeEventListener("change", report);
            onReady(null);
        };
    }, [camera, controls, onReady, onTurn]);
    return null;
}

export default function TowerGL({
    pieces,
    labels,
    onReady,
    onTurn,
}: {
    pieces: Piece[];
    labels: RigLabel[];
    onReady: (handle: GLHandle | null) => void;
    onTurn: (azimuth: number, elevation: number) => void;
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
    const ground: Piece = useMemo(
        () => ({
            kind: "face",
            points: groundCorners(),
            material: "deck",
            color: "var(--tower-ground)",
        }),
        [],
    );
    const all = useMemo(() => [ground, ...pieces], [ground, pieces]);
    const compass: [string, Vector3][] = [
        ["N", vec3(4.5 / 2, groundAt(4.5 / 2), 4.5 + 1.8)],
        ["S", vec3(4.5 / 2, groundAt(4.5 / 2), -1.8)],
        ["E", vec3(4.5 + 1.8, groundAt(4.5 + 1.8), 4.5 / 2)],
        ["W", vec3(-2.2, groundAt(-2.2), 4.5 / 2)],
    ];
    const light = T(vec3(0.3, 0.8, 0.5)).multiplyScalar(20);
    return (
        <div ref={box} className="absolute inset-0 touch-none">
            {colors && (
                <Canvas
                    camera={{
                        fov: FOV,
                        position: eyeAt(START_TARGET, DISTANCE, 135, 25),
                        near: 0.3,
                        far: 200,
                    }}
                    gl={{ antialias: true, alpha: true }}
                    dpr={[1, 2]}
                    aria-label="The Cracroft abseil tower in 3D. Drag to turn it, scroll or pinch to zoom, and right-drag or drag with two fingers to move it."
                >
                    <hemisphereLight args={[0xffffff, 0x445544, 1.6]} />
                    <directionalLight position={light} intensity={1.6} />
                    <Solids pieces={all} colors={colors} />
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
                    {compass.map(([text, at]) => (
                        <CompassLetter key={text} text={text} at={at} colors={colors} />
                    ))}
                    <OrbitControls
                        ref={controls}
                        target={START_TARGET}
                        enableDamping={false}
                        zoomToCursor
                        minDistance={1.5}
                        maxDistance={80}
                        maxPolarAngle={Math.PI / 2}
                        makeDefault
                    />
                    <Handle onReady={onReady} controls={controls} onTurn={onTurn} />
                </Canvas>
            )}
        </div>
    );
}

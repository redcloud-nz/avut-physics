"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";

import { GizmoHelper } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";

import type { LockedEnd } from "@/lib/rope-3d/curve";
import type { Play } from "@/lib/rope-3d/operations";
import type { Rope3 } from "@/lib/rope-3d/rope";
import { vec3, type Vector3 } from "@/lib/vector3";
import { T, textTexture, tubeGeometry, useSceneColors, type Colors } from "@/scene/scene-gl";

import type { ChooseMode } from "./state";

/** The rope's colours, by turns along it, so each segment shows against the next. */
export const SEGMENT_COLORS = ["var(--knot-orange)", "var(--knot-purple)"] as const;

/** The three axes, as the arrows show them: X across, Y up, Z towards the front. */
export const AXES = [
    { name: "X", dir: vec3(1, 0, 0), color: "var(--knot-red)" },
    { name: "Y", dir: vec3(0, 1, 0), color: "var(--knot-green)" },
    { name: "Z", dir: vec3(0, 0, 1), color: "var(--knot-blue)" },
] as const;

/** A segment's colour: by turns, dimmed out of play while some rope's in play, lighter for the handle. */
export function segmentColor(
    colors: Colors,
    seg: number,
    play: Play | null,
    background: THREE.Color,
) {
    const base = colors.read(SEGMENT_COLORS[(seg - 1) % 2]).clone();
    if (!play) return base;
    if (seg < play.from || seg > play.to) return base.lerp(background, 0.3);
    return seg === play.handle ? base.lerp(new THREE.Color(1, 1, 1), 0.35) : base;
}

/** Each segment's run of points, on to the next one's first point so there's no gap between them. */
function runs(rope: Rope3): { seg: number; points: Vector3[] }[] {
    const out: { seg: number; points: Vector3[] }[] = [];
    let from = 0;
    for (let i = 1; i <= rope.points.length; i++) {
        if (i < rope.points.length && rope.seg[i] === rope.seg[from]) continue;
        out.push({
            seg: rope.seg[from],
            points: rope.points.slice(from, Math.min(i + 1, rope.points.length)),
        });
        from = i;
    }
    return out;
}

export type RopeViewProps = {
    rope: Rope3;
    diameter: number;
    play: Play | null;
    /** Where the handle is, while there's one. */
    handle: Vector3 | null;
    /** The locked ends of the rope in play. */
    locked: [LockedEnd, LockedEnd] | null;
    /** Whether a plain click puts segments in play or takes them out, rather than choosing the handle. */
    choosing: boolean;
    onChoose: (seg: number, mode: ChooseMode) => void;
    /** A drag of one of the handle's arrows: where the handle's wanted, as the pointer moves. */
    onDragStart: () => void;
    onDrag: (goal: Vector3) => void;
    onDragEnd: () => void;
};

/**
 * The rope being edited, drawn inside a `SceneGL`: its segments, each one clickable, the handle's arrows to drag it
 * along X, Y and Z, the locked ends of the rope in play, and the axes in a corner.
 */
export function RopeView(props: RopeViewProps) {
    const { rope, diameter, play, handle, locked } = props;
    const colors = useSceneColors();
    const background = useMemo(() => colors.read("var(--surface)"), [colors]);
    const [hover, setHover] = useState<number | null>(null);
    // A press on the handle's arrows: the click it ends in isn't a choice of segment.
    const pressed = useRef(false);

    const geometries = useMemo(
        () =>
            runs(rope).map((run) => ({
                seg: run.seg,
                geometry: tubeGeometry(run.points.map(T), diameter / 2, 12),
            })),
        [rope, diameter],
    );
    useEffect(() => () => geometries.forEach((g) => g.geometry?.dispose()), [geometries]);

    const click = (seg: number) => (e: ThreeEvent<MouseEvent>) => {
        // A drag that turned the view, or a press on the arrows, isn't a click on the rope.
        if (e.delta > 4 || pressed.current) return;
        e.stopPropagation();
        const n = e.nativeEvent;
        const mode: ChooseMode = n.shiftKey
            ? "range"
            : props.choosing || n.ctrlKey || n.metaKey
              ? "toggle"
              : "handle";
        props.onChoose(seg, mode);
    };

    return (
        <>
            {geometries.map(({ seg, geometry }) =>
                geometry ? (
                    <mesh
                        key={seg}
                        geometry={geometry}
                        onClick={click(seg)}
                        onPointerOver={(e) => {
                            e.stopPropagation();
                            setHover(seg);
                        }}
                        onPointerOut={() => setHover((h) => (h === seg ? null : h))}
                    >
                        <meshLambertMaterial
                            color={segmentColor(colors, seg, play, background)
                                .clone()
                                .lerp(new THREE.Color(1, 1, 1), hover === seg ? 0.2 : 0)}
                        />
                    </mesh>
                ) : null,
            )}
            {locked?.map((end, i) => (
                <LockedMark key={i} end={end} diameter={diameter} colors={colors} />
            ))}
            {handle && (
                <HandleArrows
                    at={handle}
                    diameter={diameter}
                    colors={colors}
                    pressed={pressed}
                    onDragStart={props.onDragStart}
                    onDrag={props.onDrag}
                    onDragEnd={props.onDragEnd}
                />
            )}
            <CornerAxes colors={colors} />
        </>
    );
}

/** A ring round the rope where the rope in play joins the fixed rope: it holds its place and direction there. */
function LockedMark({
    end,
    diameter,
    colors,
}: {
    end: LockedEnd;
    diameter: number;
    colors: Colors;
}) {
    const quaternion = useMemo(
        () =>
            new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                T(end.dir).normalize(),
            ),
        [end],
    );
    return (
        <mesh position={T(end.at)} quaternion={quaternion} renderOrder={1}>
            <torusGeometry args={[diameter * 0.6, diameter * 0.04, 6, 32]} />
            <meshBasicMaterial color={colors.read("var(--ink-bright)")} transparent opacity={0.7} />
        </mesh>
    );
}

/** An arrow from the origin along +y, `length` long: a shaft and a cone. */
function Arrow({
    length,
    r,
    color,
    quaternion,
}: {
    length: number;
    r: number;
    color: THREE.Color;
    quaternion?: THREE.Quaternion;
}) {
    const head = r * 3;
    return (
        <group quaternion={quaternion}>
            <mesh position={[0, (length - head * 2) / 2, 0]} renderOrder={10}>
                <cylinderGeometry args={[r, r, length - head * 2, 8]} />
                <meshBasicMaterial color={color} depthTest={false} transparent />
            </mesh>
            <mesh position={[0, length - head, 0]} renderOrder={10}>
                <coneGeometry args={[head, head * 2, 12]} />
                <meshBasicMaterial color={color} depthTest={false} transparent />
            </mesh>
        </group>
    );
}

/** Turns +y to `dir` (three.js coordinates). */
const turnTo = (dir: THREE.Vector3) =>
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

/**
 * The handle's arrows along X, Y and Z, drawn over everything. Dragging one moves the handle along its axis: to the
 * point on the axis nearest the line under the pointer.
 */
function HandleArrows({
    at,
    diameter,
    colors,
    pressed,
    onDragStart,
    onDrag,
    onDragEnd,
}: {
    at: Vector3;
    diameter: number;
    colors: Colors;
    pressed: RefObject<boolean>;
    onDragStart: () => void;
    onDrag: (goal: Vector3) => void;
    onDragEnd: () => void;
}) {
    const { camera, gl, controls } = useThree();
    const length = diameter * 2.5;
    const [hot, setHot] = useState<string | null>(null);

    /** How far along the axis through `origin` the point nearest the line under the pointer is. */
    const alongAxis = (clientX: number, clientY: number, origin: Vector3, dir: Vector3) => {
        const box = gl.domElement.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(
            new THREE.Vector2(
                ((clientX - box.left) / box.width) * 2 - 1,
                -((clientY - box.top) / box.height) * 2 + 1,
            ),
            camera,
        );
        const [o, a] = [T(origin), T(dir)];
        const { origin: r0, direction: d } = ray.ray;
        const w = o.clone().sub(r0);
        const b = a.dot(d);
        const denominator = 1 - b * b;
        // Looking straight along the axis, there's no telling how far along it.
        if (denominator < 1e-4) return null;
        return (b * d.dot(w) - a.dot(w)) / denominator;
    };

    const press = (dir: Vector3) => (e: ThreeEvent<PointerEvent>) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        pressed.current = true;
        const orbit = controls as unknown as { enabled: boolean } | null;
        if (orbit) orbit.enabled = false;
        const origin = at;
        const t0 = alongAxis(e.clientX, e.clientY, origin, dir) ?? 0;
        onDragStart();
        const move = (m: PointerEvent) => {
            const t = alongAxis(m.clientX, m.clientY, origin, dir);
            if (t !== null) onDrag(origin.add(dir.scale(t - t0)));
        };
        const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            if (orbit) orbit.enabled = true;
            onDragEnd();
            // The click this press ends in comes after it.
            setTimeout(() => (pressed.current = false), 0);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
    };

    return (
        <group position={T(at)}>
            <mesh renderOrder={10}>
                <sphereGeometry args={[diameter * 0.18, 12, 8]} />
                <meshBasicMaterial
                    color={colors.read("var(--ink-bright)")}
                    depthTest={false}
                    transparent
                />
            </mesh>
            {AXES.map((axis) => (
                <group
                    key={axis.name}
                    quaternion={turnTo(T(axis.dir))}
                    onPointerDown={press(axis.dir)}
                    onPointerOver={(e) => {
                        e.stopPropagation();
                        setHot(axis.name);
                        gl.domElement.style.cursor = "grab";
                    }}
                    onPointerOut={() => {
                        setHot((h) => (h === axis.name ? null : h));
                        gl.domElement.style.cursor = "";
                    }}
                >
                    <Arrow
                        length={length}
                        r={diameter * (hot === axis.name ? 0.08 : 0.045)}
                        color={colors.read(axis.color)}
                    />
                    {/* A fatter, unseen grip along the arrow, easier to catch. */}
                    <mesh position={[0, length / 2, 0]} visible={false}>
                        <cylinderGeometry args={[diameter * 0.4, diameter * 0.4, length, 6]} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

/** X, Y and Z arrows in the view's corner, turning as the view turns. */
function CornerAxes({ colors }: { colors: Colors }) {
    const letters = useMemo(
        () =>
            AXES.map((axis) => {
                const color = colors.read(axis.color);
                return textTexture(axis.name, colors.font, `#${color.getHexString()}`);
            }),
        [colors],
    );
    useEffect(() => () => letters.forEach((l) => l.texture.dispose()), [letters]);
    return (
        <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
            <group scale={36}>
                {AXES.map((axis, i) => {
                    const dir = T(axis.dir);
                    const tip = dir.clone().multiplyScalar(1.3);
                    return (
                        <group key={axis.name}>
                            <Arrow
                                length={1}
                                r={0.035}
                                color={colors.read(axis.color)}
                                quaternion={turnTo(dir)}
                            />
                            <sprite position={tip} scale={[0.4 * letters[i].aspect, 0.4, 1]}>
                                <spriteMaterial
                                    map={letters[i].texture}
                                    depthTest={false}
                                    transparent
                                />
                            </sprite>
                        </group>
                    );
                })}
            </group>
        </GizmoHelper>
    );
}

"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";

import { GizmoHelper } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";

import type { Problem } from "@/lib/rope-3d/checks";
import { vec3, type Vector3 } from "@/lib/vector3";
import { T, textTexture, tubeGeometry, useSceneColors, type Colors } from "@/scene/scene-gl";

/** The rope's colours, by turns along it, so each segment shows against the next. */
export const SEGMENT_COLORS = ["var(--knot-orange)", "var(--knot-purple)"] as const;

/** What each role in tightening is painted. */
export const ROLE_COLORS = {
    shorten: "var(--knot-red)",
    hold: "var(--knot-blue)",
    straight: "var(--knot-green)",
} as const;

/** The three axes, as the arrows show them: X across, Y up, Z towards the front. */
export const AXES = [
    { name: "X", dir: vec3(1, 0, 0), color: "var(--knot-red)" },
    { name: "Y", dir: vec3(0, 1, 0), color: "var(--knot-green)" },
    { name: "Z", dir: vec3(0, 0, 1), color: "var(--knot-blue)" },
] as const;

export type PinMark = { at: Vector3; held: boolean; picked: boolean };

export type RopeViewProps = {
    /** The rope as points, with each pin's place among them: segment k runs from `pinAt[k]` to `pinAt[k + 1]`. */
    points: readonly Vector3[];
    pinAt: readonly number[];
    diameter: number;
    /** Each segment's colour (CSS), by its place along the rope. */
    colorOf: (k: number) => string;
    /** The pins to show and click, or none (while tightening). */
    pins: PinMark[] | null;
    /** Where the picked pin's arrows are, while one's picked. */
    handle: Vector3 | null;
    /** Places to mark as wrong. */
    marks: readonly Problem[];
    onSegment: (k: number, shift: boolean) => void;
    onPin: (k: number) => void;
    /** A drag of one of the handle's arrows: where the pin's wanted, as the pointer moves. */
    onDragStart: () => void;
    onDrag: (goal: Vector3) => void;
    onDragEnd: () => void;
};

/**
 * The rope being edited, drawn inside a `SceneGL`: its segments, each one clickable, its pins (drawn over the rope, so
 * those inside the knot show), the picked pin's arrows to drag it along X, Y and Z, marks where something's wrong, and
 * the axes in a corner.
 */
export function RopeView(props: RopeViewProps) {
    const { points, pinAt, diameter, pins, handle, marks } = props;
    const colors = useSceneColors();
    const [hover, setHover] = useState<number | null>(null);
    // A press on the handle's arrows: the click it ends in isn't a choice of segment.
    const pressed = useRef(false);

    const geometries = useMemo(
        () =>
            pinAt
                .slice(0, -1)
                .map((from, k) =>
                    tubeGeometry(points.slice(from, pinAt[k + 1] + 1).map(T), diameter / 2, 12),
                ),
        [points, pinAt, diameter],
    );
    useEffect(() => () => geometries.forEach((g) => g?.dispose()), [geometries]);

    const clicked = (e: ThreeEvent<MouseEvent>) => {
        // A drag that turned the view, or a press on the arrows, isn't a click.
        if (e.delta > 4 || pressed.current) return false;
        e.stopPropagation();
        return true;
    };
    const white = new THREE.Color(1, 1, 1);

    return (
        <>
            {geometries.map((geometry, k) =>
                geometry ? (
                    <mesh
                        key={k}
                        geometry={geometry}
                        onClick={(e) => {
                            if (!clicked(e)) return;
                            // Pins are drawn over the rope but lie inside it: one under the pointer is what's meant.
                            const pin = e.intersections.find(
                                (i) => i.object.userData.pin !== undefined,
                            );
                            if (pin) props.onPin(pin.object.userData.pin as number);
                            else props.onSegment(k, e.nativeEvent.shiftKey);
                        }}
                        onPointerOver={(e) => {
                            e.stopPropagation();
                            setHover(k);
                        }}
                        onPointerOut={() => setHover((h) => (h === k ? null : h))}
                    >
                        <meshLambertMaterial
                            color={colors
                                .read(props.colorOf(k))
                                .clone()
                                .lerp(white, hover === k ? 0.25 : 0)}
                        />
                    </mesh>
                ) : null,
            )}
            {pins?.map((pin, k) => (
                <mesh
                    key={k}
                    position={T(pin.at)}
                    renderOrder={5}
                    userData={{ pin: k }}
                    onClick={(e) => clicked(e) && props.onPin(k)}
                >
                    <sphereGeometry args={[diameter * (pin.picked ? 0.3 : 0.2), 12, 8]} />
                    <meshBasicMaterial
                        color={colors.read(
                            pin.picked
                                ? "var(--highlight)"
                                : pin.held
                                  ? "var(--knot-yellow)"
                                  : "var(--ink-bright)",
                        )}
                        depthTest={false}
                        transparent
                        opacity={0.85}
                    />
                </mesh>
            ))}
            {marks.map((m, i) => (
                <mesh key={i} position={T(m.at)} renderOrder={4}>
                    <sphereGeometry args={[diameter * 0.75, 16, 12]} />
                    <meshBasicMaterial
                        color={colors.read("var(--warning)")}
                        depthTest={false}
                        transparent
                        opacity={0.3}
                    />
                </mesh>
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

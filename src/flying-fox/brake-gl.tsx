"use client";

import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import * as THREE from "three";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import { buildHairlines, buildScene, Solids, T, type Colors } from "@/abseil-tower/tower-gl";

import { brakeRig, loaded, type Pose } from "./fox";
import { heightAt } from "./hawser";
import { sampleAt, type Run, type RunSetup } from "./run";
import type { RunClock } from "./run-clock";

/** A pose for three.js: its axis flipped with the scene (which turns the turn the other way). */
function place(group: THREE.Group, { at, axis, angle }: Pose) {
    group.position.copy(T(at));
    group.quaternion.setFromAxisAngle(T(axis).normalize(), -angle);
}

/**
 * The dynamic brake through a run: its pulleys and chain pile where they're rigged, its blocks, knots, middle
 * carabiner and chain top moved (and turned) whole each frame, and the ropes between them drawn again.
 */
export default function BrakeGL({
    run,
    setup,
    clock,
    sides,
    colors,
}: {
    run: Run;
    setup: RunSetup;
    clock: RunClock;
    sides: number;
    colors: Colors;
}) {
    const rig = useMemo(() => brakeRig(), []);
    // The ropes' colours, which don't change, each drawn as one mesh and one set of hairlines.
    const ropeColors = useMemo(
        () => [...new Set(rig.pose().ropes.flatMap((p) => (p.color ? [p.color] : [])))],
        [rig],
    );
    const groups = useRef(new Map<string, THREE.Group>());
    const meshes = useRef(new Map<string, THREE.Mesh>());
    const lines = useRef(new Map<string, ComponentRef<typeof Line>>());
    useEffect(() => {
        const drawn = meshes.current;
        return () => drawn.forEach((m) => m.geometry.dispose());
    }, []);

    useFrame(() => {
        const s = sampleAt(run, clock.t);
        // Hawser A as it hangs now, the rider's weight on it once they've stepped off.
        const shape = loaded(s.x, setup.trolley + setup.mass * s.load, 160);
        const { poses, ropes } = rig.pose({ pushed: s.pushed, heightA: (x) => heightAt(shape, x) });
        for (const [name, group] of groups.current) {
            const pose = poses.get(name);
            if (pose) place(group, pose);
        }
        const { solids } = buildScene(ropes, {}, sides);
        for (const { color, geometry } of solids) {
            const mesh = meshes.current.get(color);
            if (!mesh) {
                geometry.dispose();
                continue;
            }
            mesh.geometry.dispose();
            mesh.geometry = geometry;
        }
        for (const { color, points } of buildHairlines(ropes))
            lines.current.get(color)?.geometry.setPositions(points.flat());
    });

    const solid = { colors, minR: {}, hairlines: 2.5, sides };
    return (
        <>
            <Solids pieces={rig.fixed} {...solid} />
            {rig.parts.map((p) => (
                <group
                    key={p.name}
                    ref={(g) => {
                        if (g) groups.current.set(p.name, g);
                        else groups.current.delete(p.name);
                    }}
                >
                    <Solids pieces={p.pieces} {...solid} />
                </group>
            ))}
            {ropeColors.map((color) => (
                <mesh
                    key={color}
                    ref={(m) => {
                        if (m) meshes.current.set(color, m);
                        else meshes.current.delete(color);
                    }}
                    frustumCulled={false}
                >
                    <meshLambertMaterial
                        color={colors.read(color)}
                        side={THREE.DoubleSide}
                        polygonOffset
                        polygonOffsetFactor={1}
                        polygonOffsetUnits={1}
                    />
                </mesh>
            ))}
            {ropeColors.map((color) => (
                <Line
                    key={`line:${color}`}
                    ref={(l) => {
                        if (l) lines.current.set(color, l);
                        else lines.current.delete(color);
                    }}
                    points={[
                        [0, 0, 0],
                        [0, 0, 0],
                    ]}
                    segments
                    lineWidth={2.5}
                    color={colors.read(color)}
                />
            ))}
        </>
    );
}

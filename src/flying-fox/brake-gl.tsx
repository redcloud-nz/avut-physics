"use client";

import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import * as THREE from "three";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import { buildHairlines, buildScene, Solids, T, type Colors } from "@/abseil-tower/tower-gl";

import { CHAIN_WEIGHT } from "./chain-weight";
import { brakeRig, C, loaded, type Pose } from "./fox";
import { linkOutline } from "./hardware";
import { heightAt } from "./hawser";
import { sessionAt, type RunSetup, type Session } from "./run";
import type { RunClock } from "./run-clock";

/** A pose for three.js: its axis flipped with the scene (which turns the turn the other way). */
export function place(group: THREE.Group, { at, axis, angle }: Pose) {
    group.position.copy(T(at));
    group.quaternion.setFromAxisAngle(T(axis).normalize(), -angle);
}

/**
 * The dynamic brake through a run: its pulleys and chain pile where they're rigged, its blocks, knots, middle
 * carabiner and chain top moved (and turned) whole each frame, and the ropes between them drawn again.
 */
export default function BrakeGL({
    session,
    setup,
    clock,
    sides,
    colors,
}: {
    session: Session;
    setup: RunSetup;
    clock: RunClock;
    sides: number;
    colors: Colors;
}) {
    const rig = useMemo(() => brakeRig(), []);
    // The ropes' colours, which don't change, each drawn as one mesh and one set of hairlines.
    const ropeColors = useMemo(
        () => [
            ...new Set([...rig.pose().ropes.flatMap((p) => (p.color ? [p.color] : [])), C.steel]),
        ],
        [rig],
    );
    // The chain weight's links, all one shape: a tube round a link's middle line, each placed every frame.
    const link = useMemo(() => {
        const outline = linkOutline(CHAIN_WEIGHT.size).slice(0, -1);
        const curve = new THREE.CatmullRomCurve3(
            outline.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
            true,
        );
        return new THREE.TubeGeometry(curve, 28, CHAIN_WEIGHT.size.r, 6, true);
    }, []);
    const most = useMemo(() => Math.ceil(rig.pose().weight.links.length * 1.1) + 20, [rig]);
    const links = useRef<THREE.InstancedMesh>(null);
    const groups = useRef(new Map<string, THREE.Group>());
    const meshes = useRef(new Map<string, THREE.Mesh>());
    const lines = useRef(new Map<string, ComponentRef<typeof Line>>());
    useEffect(() => {
        const drawn = meshes.current;
        return () => {
            drawn.forEach((m) => m.geometry.dispose());
            link.dispose();
        };
    }, [link]);

    useFrame(() => {
        const s = sessionAt(session, clock.t);
        // The hawsers as they hang now, each with its rider's weight on it once they've stepped off.
        const [a, b] = [s.a, s.b].map((q) => loaded(q.x, setup.trolley + setup.mass * q.load, 160));
        const { poses, ropes, weight } = rig.pose({
            pushed: s.a.pushed,
            pushedB: s.b.pushed,
            heightA: (x) => heightAt(a, x),
            heightB: (x) => heightAt(b, x),
        });
        for (const [name, group] of groups.current) {
            const pose = poses.get(name);
            if (pose) place(group, pose);
        }
        const instanced = links.current;
        if (instanced) {
            const m = new THREE.Matrix4();
            const count = Math.min(weight.links.length, most);
            for (let i = 0; i < count; i++) {
                const { near, d, m: across } = weight.links[i];
                const x = T(d);
                const y = T(across.sub(d.scale(across.dot(d))).unit());
                m.makeBasis(x, y, x.clone().cross(y)).setPosition(T(near));
                instanced.setMatrixAt(i, m);
            }
            instanced.count = count;
            instanced.instanceMatrix.needsUpdate = true;
        }
        const { solids } = buildScene([...ropes, { ...weight.ring, color: C.steel }], {}, sides);
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
            <instancedMesh ref={links} args={[link, undefined, most]} frustumCulled={false}>
                <meshLambertMaterial color={colors.read(C.steel)} />
            </instancedMesh>
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

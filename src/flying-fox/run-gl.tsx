"use client";

import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import * as THREE from "three";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import { Solids, T, tubeGeometry, useSceneColors } from "@/abseil-tower/tower-gl";
import { vec3, type Vector3 } from "@/lib/vector3";

import BrakeGL from "./brake-gl";
import { C, HAWSER_R, HAWSER_Z, hawserY, loaded, moved, runTrolley } from "./fox";
import { heightAt } from "./hawser";
import { sampleAt, type Run, type RunSetup } from "./run";
import type { RunClock } from "./run-clock";

/** How many points hawser A's drawn through as it moves. */
const HAWSER_POINTS = 160;

/** The wire's slope (as an angle) at `x`, either side of the trolley. */
const tilt = (height: (x: number) => number, x: number) =>
    Math.atan2(height(x + 0.1) - height(x - 0.1), 0.2);

/**
 * What moves in a run, in 3D: hawser A sagging under the rider, trolley A on it with the dropper swinging below, and
 * the dynamic brake as the trolley pushes block A down the span. Moved on by `clock` each frame.
 */
export default function RunGL({
    run,
    setup,
    clock,
    sides,
}: {
    run: Run;
    setup: RunSetup;
    clock: RunClock;
    sides: number;
}) {
    const colors = useSceneColors();
    // Trolley A built once at the launch, its pieces about where it sits on the wire and the dropper's about where
    // it hangs from, so each can be moved and turned as a whole.
    const trolley = useMemo(() => {
        const t = runTrolley();
        return {
            pieces: moved(t.pieces, t.at.neg()),
            dropper: moved(t.dropper, t.hang.neg()),
            hangFrom: t.hang.sub(t.at),
            tilt: tilt(hawserY, t.at.x),
        };
    }, []);
    const trolleyGroup = useRef<THREE.Group>(null);
    const dropperGroup = useRef<THREE.Group>(null);
    const hawserMesh = useRef<THREE.Mesh>(null);
    const hairline = useRef<ComponentRef<typeof Line>>(null);
    const hawserColor = colors.read(C.hawser);

    useEffect(
        () => () => {
            hawserMesh.current?.geometry.dispose();
        },
        [],
    );

    // The clock's moved on first, before anything that follows the trolley (the view locked onto it) reads where it is.
    useFrame((_, dt) => clock.advance(dt), -1);
    useFrame(() => {
        const s = sampleAt(run, clock.t);
        // The rider's weight on the hawser as they step off the platform, the trolley's own before.
        const shape = loaded(s.x, setup.trolley + setup.mass * s.load, HAWSER_POINTS);
        const height = (x: number) => heightAt(shape, x);
        const at = vec3(shape.load!.x, shape.load!.y, HAWSER_Z);
        const turn = tilt(height, at.x) - trolley.tilt;
        const g = trolleyGroup.current;
        const d = dropperGroup.current;
        if (g && d) {
            g.position.copy(T(at));
            g.rotation.z = turn;
            const hang = trolley.hangFrom;
            const turned: Vector3 = vec3(
                hang.x * Math.cos(turn) - hang.y * Math.sin(turn),
                hang.x * Math.sin(turn) + hang.y * Math.cos(turn),
                hang.z,
            );
            d.position.copy(T(at.add(turned)));
            d.rotation.z = s.swing;
        }
        // Hawser A, between the tower's cradle and the shear leg's saddle.
        const points = shape.points.map((p) => T(vec3(p.x, p.y, HAWSER_Z)));
        const mesh = hawserMesh.current;
        const tube = tubeGeometry(points, HAWSER_R, sides);
        if (mesh && tube) {
            mesh.geometry.dispose();
            mesh.geometry = tube;
        }
        hairline.current?.geometry.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
    });

    const solid = { colors, minR: {}, hairlines: 2.5, sides };
    return (
        <>
            <group ref={trolleyGroup}>
                <Solids pieces={trolley.pieces} {...solid} />
            </group>
            <group ref={dropperGroup}>
                <Solids pieces={trolley.dropper} {...solid} />
            </group>
            <BrakeGL run={run} setup={setup} clock={clock} sides={sides} colors={colors} />
            <mesh ref={hawserMesh}>
                <meshLambertMaterial
                    color={hawserColor}
                    side={THREE.DoubleSide}
                    polygonOffset
                    polygonOffsetFactor={1}
                    polygonOffsetUnits={1}
                />
            </mesh>
            <Line
                ref={hairline}
                points={[
                    [0, 0, 0],
                    [1, 0, 0],
                ]}
                lineWidth={2.5}
                color={hawserColor}
            />
        </>
    );
}

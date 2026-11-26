"use client";

import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import * as THREE from "three";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import { turnBetween, vec3, type Vector3 } from "@/lib/vector3";
import {
    buildHairlines,
    buildScene,
    Solids,
    T,
    tubeGeometry,
    useSceneColors,
} from "@/scene/scene-gl";
import { moved } from "@/scene/transforms";

import BrakeGL, { place } from "./brake-gl";
import { C } from "./colors";
import { returnRig, runTrolley } from "./fox";
import { heightAt } from "./hawser";
import { sessionAt, type RunSetup, type Session } from "./run";
import type { RunClock } from "./run-clock";
import { HAWSER_R, HAWSER_Z, hawserY, loaded, RETURN_PULLEY } from "./site";

/** How many points the hawsers are drawn through as they move. */
const HAWSER_POINTS = 160;

/** The wire's slope (as an angle) at `x`, either side of the trolley. */
const tilt = (height: (x: number) => number, x: number) =>
    Math.atan2(height(x + 0.1) - height(x - 0.1), 0.2);

/** `v` turned by `angle` about the span's cross axis (as the wire's slope and the rider's swing turn things). */
const turnZ = (v: Vector3, angle: number) =>
    vec3(
        v.x * Math.cos(angle) - v.y * Math.sin(angle),
        v.x * Math.sin(angle) + v.y * Math.cos(angle),
        v.z,
    );

/**
 * What moves through the timeline, in 3D: each hawser sagging under its rider, each trolley on it with its dropper
 * swinging below, the return line between them over the tower's pulleys, and the dynamic brake. Moved on by `clock`
 * each frame.
 */
export default function RunGL({
    session,
    setup,
    clock,
    sides,
}: {
    session: Session;
    setup: RunSetup;
    clock: RunClock;
    sides: number;
}) {
    const colors = useSceneColors();
    // Each trolley built once at the launch, its pieces about where it sits on the wire and the dropper's about where
    // it hangs from, so each can be moved and turned as a whole.
    const trolleys = useMemo(
        () =>
            [1, -1].map((side) => {
                const t = runTrolley(side);
                return {
                    side,
                    pieces: moved(t.pieces, t.at.neg()),
                    dropper: moved(t.dropper, t.hang.neg()),
                    hangFrom: t.hang.sub(t.at),
                    knot: t.knot,
                    // The return line's knot: its carabiner's bar from where the dropper hangs, and where the line
                    // leaves it (which way it's turned to point).
                    bar: t.bar.sub(t.hang),
                    tie: t.tie,
                    tilt: tilt(hawserY, t.at.x),
                };
            }),
        [],
    );
    const line = useMemo(() => returnRig(), []);
    const groups = useRef(new Map<string, THREE.Group>());
    const meshes = useRef(new Map<string, THREE.Mesh>());
    const hairlines = useRef(new Map<string, ComponentRef<typeof Line>>());
    useEffect(() => {
        const drawn = meshes.current;
        return () => drawn.forEach((m) => m.geometry.dispose());
    }, []);
    const hawserColor = colors.read(C.hawser);
    const lineColor = colors.read(C.returnLine);

    // The clock's moved on first, before anything that follows a trolley (the view locked onto it) reads where it is.
    useFrame((_, dt) => clock.advance(dt), -1);
    useFrame(() => {
        const s = sessionAt(session, clock.t);
        const bars: Vector3[] = [];
        for (const tr of trolleys) {
            const state = tr.side > 0 ? s.a : s.b;
            const z = tr.side * HAWSER_Z;
            // Its hawser as it hangs now, its rider's weight on it once they've stepped off.
            const shape = loaded(state.x, setup.trolley + setup.mass * state.load, HAWSER_POINTS);
            const height = (x: number) => heightAt(shape, x);
            const at = vec3(shape.load!.x, shape.load!.y, z);
            const turn = tilt(height, at.x) - tr.tilt;
            const hang = at.add(turnZ(tr.hangFrom, turn));
            // Where the return line's knot is tied, round its carabiner's bar (swinging with the dropper).
            bars.push(hang.add(turnZ(tr.bar, state.swing)));
            const name = tr.side > 0 ? "a" : "b";
            const g = groups.current.get(`trolley-${name}`);
            const d = groups.current.get(`dropper-${name}`);
            if (g && d) {
                g.position.copy(T(at));
                g.rotation.z = turn;
                d.position.copy(T(hang));
                d.rotation.z = state.swing;
            }
            // The hawser, between the tower's cradle and the shear leg's saddle.
            const points = shape.points.map((p) => T(vec3(p.x, p.y, z)));
            const mesh = meshes.current.get(`hawser-${name}`);
            const tube = tubeGeometry(points, HAWSER_R, sides);
            if (mesh && tube) {
                mesh.geometry.dispose();
                mesh.geometry = tube;
            }
            hairlines.current
                .get(`hawser-${name}`)
                ?.geometry.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
        }
        // The return line, from trolley A's knot round the pulleys to trolley B's, each knot turned to point the way
        // the line leaves it: first towards its pulley, then (the line drawn from there) along the line as it sags.
        const knots = (toward: Vector3[]) =>
            trolleys.map((tr, i) => {
                const turn = turnBetween(tr.tie, toward[i]);
                return { turn, tie: bars[i].add(tr.tie.turned(turn.axis, turn.angle)) };
            });
        const first = knots(trolleys.map((tr, i) => RETURN_PULLEY(tr.side).sub(bars[i])));
        const along = line.pose(first[0].tie, first[1].tie, s.slack).leaving;
        const ends = knots(along);
        const { poses, ropes } = line.pose(ends[0].tie, ends[1].tie, s.slack);
        trolleys.forEach((tr, i) => {
            const k = groups.current.get(`knot-${tr.side > 0 ? "a" : "b"}`);
            if (k) place(k, { at: bars[i], ...ends[i].turn });
        });
        for (const [name, pose] of poses) {
            const g = groups.current.get(name);
            if (g) place(g, pose);
        }
        const { solids } = buildScene(ropes, {}, sides);
        const mesh = meshes.current.get("return");
        for (const { geometry } of solids) {
            if (mesh) {
                mesh.geometry.dispose();
                mesh.geometry = geometry;
            } else geometry.dispose();
        }
        const [hair] = buildHairlines(ropes);
        if (hair) hairlines.current.get("return")?.geometry.setPositions(hair.points.flat());
    });

    const solid = { colors, minR: {}, hairlines: 2.5, sides };
    const material = (color: THREE.Color) => (
        <meshLambertMaterial
            color={color}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
        />
    );
    const zero: [number, number, number][] = [
        [0, 0, 0],
        [0, 0, 0],
    ];
    return (
        <>
            {trolleys.map((tr) => {
                const name = tr.side > 0 ? "a" : "b";
                return (
                    <group key={name}>
                        <group
                            ref={(g) => {
                                if (g) groups.current.set(`trolley-${name}`, g);
                                else groups.current.delete(`trolley-${name}`);
                            }}
                        >
                            <Solids pieces={tr.pieces} {...solid} />
                        </group>
                        <group
                            ref={(g) => {
                                if (g) groups.current.set(`dropper-${name}`, g);
                                else groups.current.delete(`dropper-${name}`);
                            }}
                        >
                            <Solids pieces={tr.dropper} {...solid} />
                        </group>
                        <group
                            ref={(g) => {
                                if (g) groups.current.set(`knot-${name}`, g);
                                else groups.current.delete(`knot-${name}`);
                            }}
                        >
                            <Solids pieces={tr.knot} {...solid} />
                        </group>
                        <mesh
                            ref={(m) => {
                                if (m) meshes.current.set(`hawser-${name}`, m);
                                else meshes.current.delete(`hawser-${name}`);
                            }}
                            frustumCulled={false}
                        >
                            {material(hawserColor)}
                        </mesh>
                        <Line
                            ref={(l) => {
                                if (l) hairlines.current.set(`hawser-${name}`, l);
                                else hairlines.current.delete(`hawser-${name}`);
                            }}
                            points={zero}
                            lineWidth={2.5}
                            color={hawserColor}
                        />
                    </group>
                );
            })}
            <Solids pieces={line.fixed} {...solid} />
            {line.parts.map((p) => (
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
            <mesh
                ref={(m) => {
                    if (m) meshes.current.set("return", m);
                    else meshes.current.delete("return");
                }}
                frustumCulled={false}
            >
                {material(lineColor)}
            </mesh>
            <Line
                ref={(l) => {
                    if (l) hairlines.current.set("return", l);
                    else hairlines.current.delete("return");
                }}
                points={zero}
                segments
                lineWidth={2.5}
                color={lineColor}
            />
            <BrakeGL session={session} setup={setup} clock={clock} sides={sides} colors={colors} />
        </>
    );
}

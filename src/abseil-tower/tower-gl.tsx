"use client";

import { vec3 } from "@/lib/vector3";
import { SceneGL, type SceneConfig, type ViewProps } from "@/scene/scene-gl";

import { groundAt, groundCorners } from "./tower";

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

/** The abseil tower in 3D. */
export default function TowerGL(props: ViewProps) {
    return <SceneGL scene={TOWER} {...props} />;
}

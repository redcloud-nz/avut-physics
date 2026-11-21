import { vec2, type Vector2 } from "./vector2";
import { vec3, type Vector3 } from "./vector3";

/**
 * A camera looking at a scene from far off (an orthographic projection: no perspective, so lengths across the view
 * keep one scale wherever they are). It sits `azimuth` radians round the vertical from +z towards +x, and `elevation`
 * radians up from the horizontal. In a scene with x east, y up and z north, the azimuth is the compass bearing from the
 * scene to the camera: π from the south, 3π/2 from the west.
 */
export class OrbitCamera {
    /** Across the view to the right, up the view, and back out of the scene towards the camera. */
    readonly right: Vector3;
    readonly up: Vector3;
    readonly toward: Vector3;

    constructor(
        readonly azimuth: number,
        readonly elevation: number,
    ) {
        const out = vec3(Math.sin(azimuth), 0, Math.cos(azimuth));
        const c = Math.cos(elevation);
        const s = Math.sin(elevation);
        this.right = vec3(-Math.cos(azimuth), 0, Math.sin(azimuth));
        this.up = vec3(-out.x * s, c, -out.z * s);
        this.toward = vec3(out.x * c, s, out.z * c);
    }

    /** Where `p` is in the view: x to the right and y up (scene units), relative to the scene's origin. */
    project(p: Vector3): Vector2 {
        return vec2(p.dot(this.right), p.dot(this.up));
    }

    /** How near `p` is to the camera: the larger, the nearer. Draw the farthest things first. */
    depth(p: Vector3): number {
        return p.dot(this.toward);
    }
}

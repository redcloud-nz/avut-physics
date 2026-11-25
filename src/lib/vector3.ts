import { clamp } from "./math";
import { Vector2 } from "./vector2";

/**
 * An immutable 3D vector. Every operation returns a new vector. It stands for points (positions) as well as vectors
 * (displacements, directions, forces): `distanceTo` and `lerp` are the operations on points, and a point minus a point
 * is the vector between them.
 */
export class Vector3 {
    static readonly ZERO = new Vector3(0, 0, 0);

    constructor(
        readonly x: number,
        readonly y: number,
        readonly z: number,
    ) {}

    add(b: Vector3): Vector3 {
        return new Vector3(this.x + b.x, this.y + b.y, this.z + b.z);
    }

    sub(b: Vector3): Vector3 {
        return new Vector3(this.x - b.x, this.y - b.y, this.z - b.z);
    }

    scale(k: number): Vector3 {
        return new Vector3(this.x * k, this.y * k, this.z * k);
    }

    /** The point `t` of the way from this to `b` (0 here, 1 at b). */
    lerp(b: Vector3, t: number): Vector3 {
        // this + (b - this) * t
        return new Vector3(
            this.x + (b.x - this.x) * t,
            this.y + (b.y - this.y) * t,
            this.z + (b.z - this.z) * t,
        );
    }

    neg(): Vector3 {
        return new Vector3(-this.x, -this.y, -this.z);
    }

    dot(b: Vector3): number {
        return this.x * b.x + this.y * b.y + this.z * b.z;
    }

    cross(b: Vector3): Vector3 {
        return new Vector3(
            this.y * b.z - this.z * b.y,
            this.z * b.x - this.x * b.z,
            this.x * b.y - this.y * b.x,
        );
    }

    len(): number {
        return Math.hypot(this.x, this.y, this.z);
    }

    /** The length across the ground (x and z), leaving out the height. */
    horizontalLen(): number {
        return Math.hypot(this.x, this.z);
    }

    distanceTo(b: Vector3): number {
        return Math.hypot(this.x - b.x, this.y - b.y, this.z - b.z);
    }

    unit(): Vector3 {
        return this.scale(1 / this.len());
    }

    /** The angle between this and `b` (radians, 0 to π). */
    angleTo(b: Vector3): number {
        return Math.acos(clamp(this.dot(b) / this.len() / b.len(), -1, 1));
    }

    /** This vector with z flipped: its mirror image across the z = 0 plane. */
    mirrorZ(): Vector3 {
        return new Vector3(this.x, this.y, -this.z);
    }

    /** The x and y, dropping z: the vector seen along the z axis. */
    xy(): Vector2 {
        return new Vector2(this.x, this.y);
    }
    /** This turned by `angle` about the unit `axis` through the origin (Rodrigues). */
    turned(axis: Vector3, angle: number): Vector3 {
        const [c, s] = [Math.cos(angle), Math.sin(angle)];
        return this.scale(c)
            .add(axis.cross(this).scale(s))
            .add(axis.scale(axis.dot(this) * (1 - c)));
    }
}

export const vec3 = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** The turn that takes direction `from` to direction `to`, about the line square to both. */
export function turnBetween(from: Vector3, to: Vector3): { axis: Vector3; angle: number } {
    const [a, b] = [from.unit(), to.unit()];
    const axis = a.cross(b);
    const sin = axis.len();
    if (sin < 1e-9) return { axis: vec3(0, 0, 1), angle: 0 };
    return { axis: axis.scale(1 / sin), angle: Math.atan2(sin, a.dot(b)) };
}

/** The box `points` span, square to the axes: its lowest and highest corners. */
export function boundsOf(points: readonly Vector3[]): { lo: Vector3; hi: Vector3 } {
    const lo = points.reduce((a, p) =>
        vec3(Math.min(a.x, p.x), Math.min(a.y, p.y), Math.min(a.z, p.z)),
    );
    const hi = points.reduce((a, p) =>
        vec3(Math.max(a.x, p.x), Math.max(a.y, p.y), Math.max(a.z, p.z)),
    );
    return { lo, hi };
}

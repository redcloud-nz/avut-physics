import { clamp } from "./math";
import { Vector2 } from "./vector2";

/** An immutable 3D vector. Every operation returns a new vector. */
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

  neg(): Vector3 {
    return new Vector3(-this.x, -this.y, -this.z);
  }

  dot(b: Vector3): number {
    return this.x * b.x + this.y * b.y + this.z * b.z;
  }

  cross(b: Vector3): Vector3 {
    return new Vector3(this.y * b.z - this.z * b.y, this.z * b.x - this.x * b.z, this.x * b.y - this.y * b.x);
  }

  len(): number {
    return Math.hypot(this.x, this.y, this.z);
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
}

export const vec3 = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** An immutable 2D vector. Every operation returns a new vector. */
export class Vector2 {
    static readonly ZERO = new Vector2(0, 0);

    constructor(
        readonly x: number,
        readonly y: number,
    ) {}

    /** The vector `length` long at `angle` radians anticlockwise from the x axis. */
    static fromAngle(angle: number, length = 1): Vector2 {
        return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
    }

    /** The sum of `vs` (zero for none). */
    static sum(vs: readonly Vector2[]): Vector2 {
        return vs.reduce((sum, v) => sum.add(v), Vector2.ZERO);
    }

    add(b: Vector2): Vector2 {
        return new Vector2(this.x + b.x, this.y + b.y);
    }

    sub(b: Vector2): Vector2 {
        return new Vector2(this.x - b.x, this.y - b.y);
    }

    scale(k: number): Vector2 {
        return new Vector2(this.x * k, this.y * k);
    }

    /** The point `t` of the way from this to `b` (0 here, 1 at b). */
    lerp(b: Vector2, t: number): Vector2 {
        return this.add(b.sub(this).scale(t));
    }

    /** The point halfway between this and `b`. */
    mid(b: Vector2): Vector2 {
        return this.add(b).scale(0.5);
    }

    neg(): Vector2 {
        return new Vector2(-this.x, -this.y);
    }

    dot(b: Vector2): number {
        return this.x * b.x + this.y * b.y;
    }

    /** The z of the 3D cross product (a scalar): positive when `b` is anticlockwise of this. */
    cross(b: Vector2): number {
        return this.x * b.y - this.y * b.x;
    }

    len(): number {
        return Math.hypot(this.x, this.y);
    }

    distanceTo(b: Vector2): number {
        return Math.hypot(this.x - b.x, this.y - b.y);
    }

    unit(): Vector2 {
        return this.scale(1 / this.len());
    }

    /** The unit vector, or `fallback` when this is too short to have a direction. */
    safeUnit(fallback: Vector2): Vector2 {
        return this.len() > 1e-12 ? this.unit() : fallback;
    }

    /** This vector, shortened to `max` if it's longer. */
    clampLen(max: number): Vector2 {
        const l = this.len();
        return l > max ? this.scale(max / l) : this;
    }

    /** This vector turned a quarter turn anticlockwise. */
    perp(): Vector2 {
        return new Vector2(-this.y, this.x);
    }

    /** The angle from the x axis (radians, anticlockwise). */
    angle(): number {
        return Math.atan2(this.y, this.x);
    }
}

export const vec2 = (x: number, y: number) => new Vector2(x, y);

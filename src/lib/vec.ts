/** Minimal 2D vector helpers. */

export type Vec = { x: number; y: number };

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const len = (a: Vec) => Math.hypot(a.x, a.y);
export const unit = (a: Vec) => scale(a, 1 / len(a));
export const cross = (a: Vec, b: Vec) => a.x * b.y - a.y * b.x;

export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (deg: number) => (deg * Math.PI) / 180;

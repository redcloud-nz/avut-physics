/** Scalar helpers. */

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (deg: number) => (deg * Math.PI) / 180;

/** An angle in degrees, brought into (−180, 180]. */
export const wrapDegrees = (angle: number) => {
    const turned = (((angle + 180) % 360) + 360) % 360;
    return turned === 0 ? 180 : turned - 180;
};

/** `value` rounded to `places` decimal places, written as it reads (0.3, not 0.30000000000000004, and never −0). */
export const roundTo = (value: number, places: number) => {
    const k = 10 ** places;
    return Math.round(value * k) / k || 0;
};

/** The linear map taking `domain` onto `range` (either may run backwards). */
export const linearScale =
    ([d0, d1]: readonly [number, number], [r0, r1]: readonly [number, number]) =>
    (v: number) =>
        r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

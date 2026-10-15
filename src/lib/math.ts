/** Scalar helpers. */

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (deg: number) => (deg * Math.PI) / 180;

/** The linear map taking `domain` onto `range` (either may run backwards). */
export const linearScale =
    ([d0, d1]: readonly [number, number], [r0, r1]: readonly [number, number]) =>
    (v: number) =>
        r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

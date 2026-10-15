/**
 * A repeatable source of random inputs for tests: `pick(lo, hi, step)` gives a value from lo to hi on a grid of
 * `step`, to two decimal places. The same seed always gives the same sequence.
 */
export function seededPicker(seed: number) {
    let state = seed;
    const rand = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
    return (lo: number, hi: number, step: number) =>
        Math.round((lo + Math.round((rand() * (hi - lo)) / step) * step) * 100) / 100;
}

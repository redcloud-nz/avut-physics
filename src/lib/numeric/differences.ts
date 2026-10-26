import { transpose, type Matrix } from "./linear";

/**
 * The Jacobian of f at x by central differences, a step of `steps[j]` in each x[j], as rows (one per output).
 * Null if f fails (returns null) at any point it's evaluated at.
 */
export function centralDifferences(
    f: (x: number[]) => number[] | null,
    x: number[],
    steps: number[],
): Matrix | null {
    const columns: number[][] = [];
    for (let j = 0; j < x.length; j++) {
        const step = steps[j];
        const fp = f(x.map((v, k) => (k === j ? v + step : v)));
        const fm = f(x.map((v, k) => (k === j ? v - step : v)));
        if (!fp || !fm) return null;
        columns.push(fp.map((v, i) => (v - fm[i]) / (2 * step)));
    }
    return transpose(columns);
}

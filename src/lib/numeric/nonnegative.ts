import { leastSquares, type Matrix } from "./linear";

/**
 * The x ≥ 0 minimising |Ax − b|² (Lawson and Hanson's method). A is given by its rows. Where several x do as well,
 * a small `damping`·|x|² picks the shortest.
 */
export function nonNegativeLeastSquares(A: Matrix, b: number[], damping = 0): number[] {
    const n = A[0]?.length ?? 0;
    const scale = Math.max(1e-300, ...A.flat().map(Math.abs));
    const tol = 1e-12 * scale * Math.max(1, ...b.map(Math.abs));
    const x = Array<number>(n).fill(0);
    const free = new Set<number>();
    /** The steepest descent of |Ax − b|² + damping |x|², halved: Aᵀ(b − Ax) − damping x. */
    const descent = () => {
        const r = b.map((bi, i) => bi - A[i].reduce((sum, a, j) => sum + a * x[j], 0));
        return x.map((xj, j) => A.reduce((sum, row, i) => sum + row[j] * r[i], 0) - damping * xj);
    };
    /** The least-squares x using only the free columns, the rest held at zero. */
    const solveFree = () => {
        const cols = [...free];
        const z = leastSquares(
            A.map((row) => cols.map((j) => row[j])),
            b,
            damping + 1e-14 * scale * scale,
        );
        const out = Array<number>(n).fill(0);
        cols.forEach((j, k) => (out[j] = z?.[k] ?? 0));
        return out;
    };
    for (let outer = 0; outer < 3 * n + 10; outer++) {
        const w = descent();
        let pick = -1;
        for (let j = 0; j < n; j++)
            if (!free.has(j) && w[j] > tol && (pick < 0 || w[j] > w[pick])) pick = j;
        if (pick < 0) break;
        free.add(pick);
        for (let inner = 0; inner < 3 * n + 10; inner++) {
            const z = solveFree();
            const blocked = [...free].filter((j) => z[j] <= 0);
            if (blocked.length === 0) {
                z.forEach((v, j) => (x[j] = v));
                break;
            }
            // Step towards z only as far as the first free x reaches zero, and fix it there.
            const alpha = Math.min(...blocked.map((j) => x[j] / (x[j] - z[j])));
            for (let j = 0; j < n; j++) x[j] += alpha * (z[j] - x[j]);
            for (const j of [...free])
                if (x[j] <= 1e-15 * scale) {
                    x[j] = 0;
                    free.delete(j);
                }
        }
    }
    return x;
}

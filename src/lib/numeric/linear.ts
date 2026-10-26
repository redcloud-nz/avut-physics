/** Linear algebra on small dense matrices: transposes, exact and least-squares solves. */

/** A matrix, as its rows. */
export type Matrix = number[][];

/** The transpose of A: its columns as rows. */
export const transpose = (A: Matrix): Matrix => (A[0] ?? []).map((_, j) => A.map((row) => row[j]));

/** A with `columns` appended on its right. A column shorter than A is padded with zeros. */
export const withColumns = (A: Matrix, columns: number[][]): Matrix =>
    A.map((row, i) => [...row, ...columns.map((c) => c[i] ?? 0)]);

/** Solve a small linear system by Gaussian elimination with partial pivoting. */
export function solveLinear(A: Matrix, b: number[]): number[] | null {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
        let pivot = col;
        for (let r = col + 1; r < n; r++)
            if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
        if (Math.abs(M[pivot][col]) < 1e-12) return null;
        [M[col], M[pivot]] = [M[pivot], M[col]];
        for (let r = 0; r < n; r++) {
            if (r === col) continue;
            const k = M[r][col] / M[col][col];
            for (let c = col; c <= n; c++) M[r][c] -= k * M[col][c];
        }
    }
    return M.map((row, i) => row[n] / row[i]);
}

/**
 * The x minimising |Ax − b|² + damping·|x|², from the normal equations (AᵀA + damping·I) x = Aᵀb. A is given by
 * its rows. Null if the system is singular.
 */
export function leastSquares(A: Matrix, b: number[], damping: number): number[] | null {
    const n = A[0]?.length ?? 0;
    const AtA = Array.from({ length: n }, (_, i) =>
        Array.from(
            { length: n },
            (_, k) => A.reduce((sum, row) => sum + row[i] * row[k], 0) + (i === k ? damping : 0),
        ),
    );
    const Atb = Array.from({ length: n }, (_, i) =>
        A.reduce((sum, row, j) => sum + row[i] * b[j], 0),
    );
    return solveLinear(AtA, Atb);
}

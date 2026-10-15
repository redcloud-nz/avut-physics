/** Small numerical methods for the solvers. */

/** A matrix, as its rows. */
export type Matrix = number[][];

/** The transpose of A: its columns as rows. */
export const transpose = (A: Matrix): Matrix => (A[0] ?? []).map((_, j) => A.map((row) => row[j]));

/** A with `columns` appended on its right. A column shorter than A is padded with zeros. */
export const withColumns = (A: Matrix, columns: number[][]): Matrix =>
  A.map((row, i) => [...row, ...columns.map((c) => c[i] ?? 0)]);

/** Nelder–Mead minimisation, restarted a few times from the best point to avoid early stalls. */
export function nelderMead(f: (x: number[]) => number, start: number[], step: number): number[] {
  const n = start.length;
  const lerp = (a: number[], b: number[], t: number) => a.map((ai, i) => ai + t * (b[i] - ai));
  let best = start;
  for (let restart = 0; restart < 4; restart++) {
    let simplex = [best, ...best.map((_, i) => best.map((v, j) => (i === j ? v + step : v)))].map((x) => ({ x, v: f(x) }));
    for (let iter = 0; iter < 400 * n; iter++) {
      simplex.sort((a, b) => a.v - b.v);
      const lo = simplex[0];
      const hi = simplex[n];
      const size = Math.max(...simplex.slice(1).map((p) => Math.max(...p.x.map((v, i) => Math.abs(v - lo.x[i])))));
      if (size < 1e-12) break;
      const centroid = lo.x.map((_, i) => simplex.slice(0, n).reduce((sum, p) => sum + p.x[i], 0) / n);
      const at = (t: number) => lerp(centroid, hi.x, t);
      const r = { x: at(-1), v: f(at(-1)) };
      if (r.v < lo.v) {
        const e = { x: at(-2), v: f(at(-2)) };
        simplex[n] = e.v < r.v ? e : r;
      } else if (r.v < simplex[n - 1].v) {
        simplex[n] = r;
      } else {
        const k = { x: at(0.5), v: f(at(0.5)) };
        if (k.v < hi.v) {
          simplex[n] = k;
        } else {
          simplex = simplex.map((p, i) => {
            if (i === 0) return p;
            const x = lerp(lo.x, p.x, 0.5);
            return { x, v: f(x) };
          });
        }
      }
    }
    simplex.sort((a, b) => a.v - b.v);
    best = simplex[0].x;
    step /= 10;
  }
  return best;
}

/** Solve a small linear system by Gaussian elimination with partial pivoting. */
export function solveLinear(A: Matrix, b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
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
    Array.from({ length: n }, (_, k) => A.reduce((sum, row) => sum + row[i] * row[k], 0) + (i === k ? damping : 0)),
  );
  const Atb = Array.from({ length: n }, (_, i) => A.reduce((sum, row, j) => sum + row[i] * b[j], 0));
  return solveLinear(AtA, Atb);
}

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

/**
 * The cells of a grid of values lower than or equal to all eight neighbours, the grid wrapping round at its
 * edges, lowest first. Cells that aren't finite are skipped.
 */
export function gridMinima(grid: number[][]): { i: number; j: number; e: number }[] {
  const ni = grid.length;
  const minima: { i: number; j: number; e: number }[] = [];
  for (let i = 0; i < ni; i++) {
    const nj = grid[i].length;
    for (let j = 0; j < nj; j++) {
      const e = grid[i][j];
      if (!Number.isFinite(e)) continue;
      let isMin = true;
      for (let di = -1; di <= 1 && isMin; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if ((di || dj) && grid[(i + di + ni) % ni][(j + dj + nj) % nj] < e) {
            isMin = false;
            break;
          }
        }
      }
      if (isMin) minima.push({ i, j, e });
    }
  }
  return minima.sort((a, b) => a.e - b.e);
}

/** Searches for a function's lowest points. */

/** Nelder–Mead minimisation, restarted a few times from the best point to avoid early stalls. */
export function nelderMead(f: (x: number[]) => number, start: number[], step: number): number[] {
    const n = start.length;
    const lerp = (a: number[], b: number[], t: number) => a.map((ai, i) => ai + t * (b[i] - ai));
    let best = start;
    for (let restart = 0; restart < 4; restart++) {
        let simplex = [
            best,
            ...best.map((_, i) => best.map((v, j) => (i === j ? v + step : v))),
        ].map((x) => ({ x, v: f(x) }));
        for (let iter = 0; iter < 400 * n; iter++) {
            simplex.sort((a, b) => a.v - b.v);
            const lo = simplex[0];
            const hi = simplex[n];
            const size = Math.max(
                ...simplex
                    .slice(1)
                    .map((p) => Math.max(...p.x.map((v, i) => Math.abs(v - lo.x[i])))),
            );
            if (size < 1e-12) break;
            const centroid = lo.x.map(
                (_, i) => simplex.slice(0, n).reduce((sum, p) => sum + p.x[i], 0) / n,
            );
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

/**
 * The cells of a grid of values lower than or equal to all eight neighbours, lowest first. The grid wraps round at
 * its edges unless `wrap` is false, when a cell at the edge has only the neighbours inside the grid. Cells that
 * aren't finite are skipped.
 */
export function gridMinima(grid: number[][], wrap = true): { i: number; j: number; e: number }[] {
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
                    const n = wrap
                        ? grid[(i + di + ni) % ni][(j + dj + nj) % nj]
                        : grid[i + di]?.[j + dj];
                    if ((di || dj) && n !== undefined && n < e) {
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

/**
 * A golden-section search for the lowest point of f between lo and hi, taking it to have one there: the bracket left
 * after `iterations` steps.
 */
export function goldenSection(
    f: (x: number) => number,
    lo: number,
    hi: number,
    iterations: number,
): [number, number] {
    const ratio = (Math.sqrt(5) - 1) / 2;
    for (let k = 0; k < iterations; k++) {
        const m1 = hi - ratio * (hi - lo);
        const m2 = lo + ratio * (hi - lo);
        if (f(m1) <= f(m2)) hi = m2;
        else lo = m1;
    }
    return [lo, hi];
}

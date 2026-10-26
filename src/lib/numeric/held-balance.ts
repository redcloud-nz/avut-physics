import { centralDifferences } from "./differences";
import { leastSquares, maxAbs, transpose, withColumns } from "./linear";

/**
 * Newton's method on a body's balance with some constraints held exactly at zero (the Karush–Kuhn–Tucker
 * conditions with the active set fixed). The unknowns are the position q and each held constraint's force.
 *
 * - `held(q)`: the held constraints at q, in a fixed order, each with its gap `g` (zero when held). An undefined
 *   entry means that constraint doesn't exist at q, and the solve fails.
 * - `column(p, q)`: the generalised force from a unit force in constraint p.
 * - `applied(q)`: the generalised forces that don't depend on the constraint forces (a new array each call).
 * - `steps`: the central-difference step in each coordinate of q.
 * - `weight`: the force that sets the scale of the tolerances, and of the constraint rows, which are scaled to it so
 *   the two kinds of row weigh alike.
 *
 * Returns the position and each held constraint's force (in `held`'s order), or null if it doesn't converge.
 */
export function solveHeldBalance<P extends { g: number }>(problem: {
    q0: number[];
    held: (q: number[]) => (P | undefined)[];
    column: (p: P, q: number[]) => number[];
    applied: (q: number[]) => number[];
    steps: number[];
    weight: number;
}): { q: number[]; lambda: number[] } | null {
    const { q0, held, column, applied, steps, weight: W } = problem;
    const n = q0.length;
    const residual = (q: number[], l: number[]) => {
        const ps = held(q);
        if (ps.some((p) => !p)) return null;
        const r = applied(q);
        ps.forEach((p, i) => column(p!, q).forEach((v, j) => (r[j] += l[i] * v)));
        return [...r, ...ps.map((p) => W * p!.g)];
    };
    // A first guess at the forces: least squares on the balance at the starting position.
    const ps0 = held(q0);
    if (ps0.some((p) => !p)) return null;
    const cols = ps0.map((p) => column(p!, q0));
    const rhs = applied(q0).map((v) => -v);
    let l = ps0.length === 0 ? [] : (leastSquares(transpose(cols), rhs, 1e-9) ?? ps0.map(() => 0));
    let q = [...q0];
    for (let iter = 0; iter < 40; iter++) {
        const r = residual(q, l);
        if (!r) return null;
        if (maxAbs(r) < 1e-9 * W) return { q, lambda: l };
        // Jacobian: numerically in the position, exactly in the forces (the balance is linear in them).
        const dq = centralDifferences((q) => residual(q, l), q, steps);
        if (!dq) return null;
        const forces = held(q).map((p) => column(p!, q));
        const J = withColumns(dq, forces);
        // Least squares (square and well-posed in the usual case; more contacts than freedoms otherwise).
        const dx = leastSquares(
            J,
            r.map((v) => -v),
            1e-12 * W * W,
        );
        if (!dx) return null;
        q = q.map((v, j) => v + dx[j]);
        l = l.map((v, i) => v + dx[n + i]);
    }
    return null;
}

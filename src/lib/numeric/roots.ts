/** Finding where something changes: by bisection, or exactly for a quadratic. */

/**
 * Bisection for where `before` stops holding, between a (where it holds) and b (where it doesn't): the bracket left
 * after `iterations` halvings.
 */
export function bisect(
    before: (x: number) => boolean,
    a: number,
    b: number,
    iterations: number,
): [number, number] {
    for (let k = 0; k < iterations; k++) {
        const m = (a + b) / 2;
        if (before(m)) a = m;
        else b = m;
    }
    return [a, b];
}

/** The real roots of a t² + b t + c in (0, 1). */
export function rootsInUnit(a: number, b: number, c: number): number[] {
    const roots: number[] = [];
    if (Math.abs(a) < 1e-12) {
        if (Math.abs(b) > 1e-12) roots.push(-c / b);
    } else {
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
            const q = Math.sqrt(disc);
            roots.push((-b - q) / (2 * a), (-b + q) / (2 * a));
        }
    }
    return roots.filter((t) => t > 0 && t < 1);
}

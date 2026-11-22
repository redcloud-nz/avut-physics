import { describe, expect, it } from "vitest";

import {
    ANCHOR_SHACKLE,
    CRADLE_Y,
    FALL,
    foxPieces,
    GRADE,
    groundY,
    hawserY,
    LOG,
    RIDER,
    SADDLE,
    SAG,
    SHEAR_LEG,
    SLING_Z,
    SPAN,
    STATIC_X,
    STEEPEST,
    TOWER,
    TREE,
    TREE_SHACKLE,
} from "./fox";

const degrees = (rad: number) => (rad * 180) / Math.PI;

/**
 * The layout checked against the rules in Scouts NSW's flying fox procedure (PRO5, 2025), worked out here from the
 * exported positions rather than from how the pieces are built.
 */
describe("flying fox layout", () => {
    it("sags 5% of the span at mid-span, unloaded", () => {
        const [a, b] = [
            hawserY(TOWER.shs / 2 + TOWER.rhs.w / 2),
            hawserY(SHEAR_LEG.x + 2 * SHEAR_LEG.r),
        ];
        const mid = hawserY((TOWER.shs / 2 + TOWER.rhs.w / 2 + SHEAR_LEG.x + 2 * SHEAR_LEG.r) / 2);
        expect((a + b) / 2 - mid).toBeCloseTo(0.05 * SPAN, 6);
        expect(SAG).toBeCloseTo(0.05 * SPAN, 9);
        expect(a).toBeCloseTo(CRADLE_Y, 9);
    });

    it("keeps the run's average slope under 45° and its steepest under 65° (Figures 18 and 19)", () => {
        const x0 = TOWER.shs / 2 + TOWER.rhs.w / 2;
        const x1 = SHEAR_LEG.x + 2 * SHEAR_LEG.r;
        const average = Math.atan2(Math.abs(hawserY(x0) - hawserY(x1)), x1 - x0);
        expect(degrees(average)).toBeLessThan(45);
        const steepest = Math.max(
            ...[x0, x1].map((x) => Math.abs(hawserY(x + 0.01) - hawserY(x)) / 0.01),
        );
        expect(degrees(Math.atan(steepest))).toBeLessThan(65);
    });

    it("stands both anchors at least 2.15 times their supports' heights back, the hawsers at 25° or less", () => {
        expect(-TREE.x).toBeGreaterThanOrEqual(2.15 * TOWER.top);
        expect(LOG.x - SHEAR_LEG.x).toBeGreaterThanOrEqual(2.15 * SHEAR_LEG.top);
        for (const s of [-1, 1]) {
            const tree = TREE_SHACKLE(s);
            const top = Math.atan2(CRADLE_Y - tree.y, -tree.x);
            expect(degrees(top)).toBeLessThanOrEqual(25);
            const [saddle, shackle] = [SADDLE(s), ANCHOR_SHACKLE(s * SLING_Z)];
            const bottom = Math.atan2(saddle.y - shackle.y, shackle.x - saddle.x);
            expect(degrees(bottom)).toBeLessThanOrEqual(25);
        }
    });

    it("falls towards the bottom end, the span line at 10° or less (section 4.7)", () => {
        expect(GRADE).toBeGreaterThanOrEqual(0);
        expect(STEEPEST).toBeLessThanOrEqual(0.1);
        const x0 = TOWER.shs / 2 + TOWER.rhs.w / 2;
        const x1 = SHEAR_LEG.x + 2 * SHEAR_LEG.r;
        const fall = hawserY(x0) - hawserY(x1);
        expect(degrees(Math.atan2(fall, x1 - x0))).toBeLessThanOrEqual(10);
    });

    it("keeps the ground level round each end, out past the guys, with the fall and dip between", () => {
        for (const x of [TREE.x, 0, 1.6 * TOWER.top]) expect(groundY(x)).toBeCloseTo(0, 9);
        for (const x of [SHEAR_LEG.x - 1.6 * SHEAR_LEG.top, SHEAR_LEG.x, LOG.x])
            expect(groundY(x)).toBeCloseTo(-FALL, 9);
        expect(groundY(40)).toBeLessThan(-FALL * (40 / SPAN));
    });

    it("keeps a rider's feet off the ground all along the unloaded hawsers", () => {
        const x0 = TOWER.shs / 2 + TOWER.rhs.w / 2;
        const x1 = SHEAR_LEG.x + 2 * SHEAR_LEG.r;
        for (let i = 0; i <= 200; i++) {
            const x = x0 + ((x1 - x0) * i) / 200;
            expect(hawserY(x) - groundY(x)).toBeGreaterThan(RIDER.harness + RIDER.feet);
        }
    });

    it("keeps the unloaded hawsers clear of the ground all along the span", () => {
        const x0 = TOWER.shs / 2 + TOWER.rhs.w / 2;
        const x1 = SHEAR_LEG.x + 2 * SHEAR_LEG.r;
        let lowest = Infinity;
        for (let i = 0; i <= 200; i++) {
            const x = x0 + ((x1 - x0) * i) / 200;
            lowest = Math.min(lowest, hawserY(x) - groundY(x));
        }
        expect(lowest).toBeGreaterThan(2);
    });

    it("makes the H-frame's height twice its width (Figure 32)", () => {
        expect(SHEAR_LEG.spar).toBeCloseTo(2 * SHEAR_LEG.b, 9);
        expect(SHEAR_LEG.top - SHEAR_LEG.spar).toBeGreaterThanOrEqual(0.3 - 1e-9);
        expect(2 * SHEAR_LEG.r).toBeGreaterThanOrEqual(0.125);
    });

    it("hangs riders where they can't reach the hawser (section 6.10)", () => {
        expect(RIDER.harness).toBeGreaterThan(RIDER.reach);
    });

    it("sets the static brakes at least twice a rider's drop from the shear leg (Figure 42)", () => {
        // The drop is from the hawser to the rider's lowest point, their feet.
        expect(SHEAR_LEG.x - STATIC_X).toBeGreaterThanOrEqual(2 * (RIDER.harness + RIDER.feet));
    });

    it("builds every piece from finite numbers", () => {
        for (const p of foxPieces()) {
            const pts = p.kind === "rod" ? [p.a, p.b] : p.points;
            for (const q of pts) expect([q.x, q.y, q.z].every(Number.isFinite)).toBe(true);
        }
    });
});

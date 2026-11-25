import { describe, expect, it } from "vitest";

import {
    ANCHOR_SHACKLE,
    CLEARANCE,
    clearanceAt,
    CRADLE_Y,
    DESCENDER,
    DISMOUNT,
    FALL,
    foxLabels,
    foxPieces,
    foxStances,
    foxTargets,
    GRADE,
    GROUND,
    groundY,
    hawserY,
    loaded,
    LOG,
    REST_X,
    RIDER,
    SADDLE,
    SAG,
    SHEAR_LEG,
    SLING_Z,
    SPAN,
    STAFF_REACH,
    STATIC_X,
    TEST_LOAD,
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
    it("sags 5% of the span at mid-span under the test load, and less unloaded (section 5.5.3)", () => {
        const x0 = TOWER.shs / 2 + TOWER.rhs.w / 2;
        const x1 = SHEAR_LEG.x + 2 * SHEAR_LEG.r;
        const [a, b] = [hawserY(x0), hawserY(x1)];
        const mid = (x0 + x1) / 2;
        const tested = loaded(mid, TEST_LOAD).load!;
        expect((a + b) / 2 - tested.y).toBeCloseTo(0.05 * SPAN, 4);
        expect(SAG).toBeCloseTo(0.05 * SPAN, 9);
        expect(TEST_LOAD).toBeGreaterThanOrEqual(150);
        expect((a + b) / 2 - hawserY(mid)).toBeLessThan(SAG);
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
        expect(groundY(SHEAR_LEG.x) - groundY(0)).toBeCloseTo(-GRADE * SPAN, 9);
        const x0 = TOWER.shs / 2 + TOWER.rhs.w / 2;
        const x1 = SHEAR_LEG.x + 2 * SHEAR_LEG.r;
        const fall = hawserY(x0) - hawserY(x1);
        expect(degrees(Math.atan2(fall, x1 - x0))).toBeLessThanOrEqual(10);
    });

    it("keeps the ground level round each end, out past the guys, and smooth between", () => {
        for (const x of [TREE.x, 0, SHEAR_LEG.x, LOG.x]) {
            const level = x < SPAN / 2 ? 0 : -FALL;
            expect(groundY(x)).toBeCloseTo(level, 9);
        }
        // Roughly level out to the guys' pickets.
        expect(Math.abs(groundY(1.6 * TOWER.top))).toBeLessThan(0.05);
        expect(Math.abs(groundY(SHEAR_LEG.x - 1.6 * SHEAR_LEG.top) + FALL)).toBeLessThan(0.25);
        // No sudden changes of slope: it bends no more sharply than a 15 m radius anywhere.
        const d = 0.5;
        for (let x = TREE.x + d; x < LOG.x - d; x += d) {
            const bend = (groundY(x + d) - 2 * groundY(x) + groundY(x - d)) / (d * d);
            expect(Math.abs(bend)).toBeLessThan(1 / 15);
        }
    });

    /** How far a rider of `mass` kg's feet are off the ground standing up, and their descender, with them at `x`. */
    const rider = (x: number, mass = RIDER.mass) => {
        const trolley = loaded(x, mass, 2).load!.y;
        return {
            standing: trolley - RIDER.harness - RIDER.standing - groundY(x),
            seated: trolley - RIDER.harness - RIDER.seated - groundY(x),
            descender: trolley - DESCENDER - groundY(x),
            trolley,
        };
    };

    it("keeps even the heaviest rider's feet well off the ground along the ride, standing or seated", () => {
        for (let x = 1; x < SPAN; x += 0.5) {
            const r = rider(x);
            expect(r.seated).toBeGreaterThan(
                CLEARANCE.dismount + RIDER.standing - RIDER.seated - 1e-6,
            );
            expect(r.standing).toBeGreaterThan(clearanceAt(x) - 0.05);
        }
    });

    it("brings riders to rest in the dismount zone, whatever their weight", () => {
        for (const mass of [30, 60, 90, 120]) {
            let low = { x: 0, y: Infinity };
            for (let x = 1; x < SPAN; x += 0.25) {
                const y = rider(x, mass).trolley;
                if (y < low.y) low = { x, y };
            }
            expect(low.x).toBeGreaterThan(DISMOUNT.from);
            expect(low.x).toBeLessThan(DISMOUNT.to);
        }
    });

    it("leaves the heaviest rider just short of standing where they rest, and every rider's descender in reach", () => {
        const r = rider(REST_X);
        expect(r.standing).toBeGreaterThan(0);
        expect(r.standing).toBeLessThan(0.25);
        for (const mass of [30, 60, 90, 120])
            for (let x = DISMOUNT.from; x <= DISMOUNT.to; x += 0.5)
                expect(rider(x, mass).descender).toBeLessThanOrEqual(STAFF_REACH);
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
        expect(SHEAR_LEG.x - STATIC_X).toBeGreaterThanOrEqual(2 * (RIDER.harness + RIDER.standing));
    });

    it("builds every piece from finite numbers", () => {
        for (const p of foxPieces()) {
            const pts = p.kind === "rod" ? [p.a, p.b] : p.points;
            for (const q of pts) expect([q.x, q.y, q.z].every(Number.isFinite)).toBe(true);
        }
    });
});

describe("the views' targets", () => {
    it("each stance stands on the site, its eye a person's height up", () => {
        for (const e of foxStances()) {
            expect(Math.abs(e.at.x - (GROUND.x0 + GROUND.x1) / 2), e.slug).toBeLessThan(
                (GROUND.x1 - GROUND.x0) / 2,
            );
            expect(Math.abs(e.at.z), e.slug).toBeLessThan(GROUND.z);
            // On the ground, or the launch platform's deck.
            const feet = e.at.y - 1.7;
            const onDeck = Math.abs(feet - (TOWER.lower + TOWER.rhs.h / 2 + 0.05)) < 1e-9;
            if (!onDeck) expect(feet, e.slug).toBeCloseTo(groundY(e.at.x), 9);
        }
    });

    it("each label belongs to a target", () => {
        const slugs = foxTargets().map((t) => t.slug);
        for (const l of foxLabels()) expect(slugs, l.text).toContain(l.target);
    });
});

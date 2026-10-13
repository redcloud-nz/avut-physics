import { describe, expect, it } from "vitest";
import { len, rad, sub } from "@/lib/vec";
import { solveHeld, solveLevel } from "./ladder-hinge-held";
import { solve } from "./ladder-hinge-solver";
import { heldArrangement, heldViolations, randomInputs, setupFor } from "./ladder-hinge-solver.checks";

describe("held ladder: physics rules", () => {
  it("hold for random setups and angles across the sliders' ranges", { timeout: 60_000 }, () => {
    const failures = randomInputs(300, 3)
      .map((i, k) => {
        const s = setupFor(i);
        const phi = ((k * 0.618034) % 1) * rad(89);
        const r = solveHeld(s, phi);
        return { inputs: i, phi, arrangement: heldArrangement(r), problems: heldViolations(s, phi, r) };
      })
      .filter((f) => f.problems.length > 0);
    expect(failures).toEqual([]);
  });
});

describe("held ladder", () => {
  it("held where it would settle by itself, the team barely has to hold it", () => {
    const s = setupFor({});
    const free = solve(s);
    if (free.kind !== "hinged") throw new Error(free.kind);
    const r = solveHeld(s, free.h.phi);
    if (r.kind !== "held") throw new Error(heldArrangement(r));
    expect(len(r.h.hold!.force)).toBeLessThan(1);
    expect(len(sub(r.h.barEnd1, free.h.barEnd1))).toBeLessThan(1e-3);
    expect(len(sub(r.h.barEnd2, free.h.barEnd2))).toBeLessThan(1e-3);
  });

  // With the ladder's angle and the rope set separately, the rope can level the stretcher all the way down.
  it.each([
    [60, 2.35],
    [45, 3.4],
    [25, 4.85],
    [5, 6.25],
  ])("held at %i°, a %f m rope keeps the stretcher within 1° of level", (angle, rope) => {
    const s = setupFor({ rope });
    const r = solveHeld(s, rad(angle));
    if (r.kind !== "held") throw new Error(heldArrangement(r));
    expect(Math.abs(r.h.tilt)).toBeLessThan(rad(1));
    expect(heldViolations(s, rad(angle), r)).toEqual([]);
  });

  it("with the rope slack, the stretcher hangs from the attachment against the ladder", () => {
    const r = solveHeld(setupFor({ rope: 8 }), rad(45));
    expect(heldArrangement(r)).toBe("held: attachment+ladder, team");
  });

  it("a rope too short for the angle has no position", () => {
    expect(heldArrangement(solveHeld(setupFor({ rope: 1 }), rad(30)))).toBe(
      "none: The rope can't reach the stretcher with the ladder held at this angle.",
    );
  });
});

describe("team keeps the stretcher level", () => {
  // Paying out the rope, the team lowers the ladder to keep the stretcher level, all the way to the ground.
  it.each([
    [2, 68.4],
    [3, 50.2],
    [4, 36.7],
    [5, 23.0],
    [6, 8.7],
  ])("with a %f m rope, holding the ladder at about %f° levels it", (rope, angle) => {
    const s = setupFor({ rope });
    const { result: r, level } = solveLevel(s);
    if (r.kind !== "held") throw new Error(heldArrangement(r));
    expect(level).toBe(true);
    expect(Math.abs(r.h.tilt)).toBeLessThan(rad(0.05));
    expect((r.h.phi * 180) / Math.PI).toBeCloseTo(angle, 0);
    expect(heldViolations(s, r.h.phi, r)).toEqual([]);
  });

  it("where no angle levels it, shows the closest", () => {
    const { result: r, level } = solveLevel(setupFor({ rope: 1 }));
    if (r.kind !== "held") throw new Error(heldArrangement(r));
    expect(level).toBe(false);
    expect(Math.abs(r.h.tilt)).toBeLessThan(rad(5));
  });
});
